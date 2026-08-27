# coding=utf-8
# Copyright 2022 The HuggingFace Inc. team. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""
PyTorch UperNet model, trimmed from EricYu97/MineNetCD's models/upernet.py
(itself based on HuggingFace transformers' UperNet, Apache 2.0) for
BhuNetra's own change-detection integration.

What was removed vs. the official repo's version, and why:
  - The VSSM (Mamba) backbone path and its `vmamba_single` import chain
    are gone entirely. That chain pulls in `triton`, `fvcore`, and a
    custom CUDA "selective scan" kernel -- none of which have Windows
    wheels, and we only ever load `ericyu/minenetcd-upernet-Swin-Diff-B-
    Pretrained`, which doesn't need any of it.
  - The plain "Swin" (single-image) and generic "concat"/"diff" backbone
    branches are gone -- unreachable for our supported checkpoints, dead
    code to carry around otherwise.
  - ResNet_Diff_* is kept (costs nothing extra: just
    `AutoBackbone.from_pretrained`) in case a lighter backbone is ever
    swapped in.

Functionally identical for Swin_Diff_*: Siamese backbone forward pass on
the before/after halves of the batch, per-stage feature subtraction,
optional ChangeFFT-style channel mixing (off for our checkpoint), then
the same UperNet decode + auxiliary head.
"""
from typing import List, Optional, Tuple, Union

import torch
from timm.layers import DropPath
from torch import nn
from torch.nn import CrossEntropyLoss

from transformers import AutoBackbone, UperNetConfig
from transformers.modeling_outputs import SemanticSegmenterOutput
from transformers.modeling_utils import PreTrainedModel

_CONFIG_FOR_DOC = "UperNetConfig"


class UperNetConvModule(nn.Module):
    """conv -> batchnorm -> relu, the basic block UperNet's head is built from."""

    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        kernel_size: Union[int, Tuple[int, int]],
        padding: Union[int, Tuple[int, int], str] = 0,
        bias: bool = False,
        dilation: Union[int, Tuple[int, int]] = 1,
    ) -> None:
        super().__init__()
        self.conv = nn.Conv2d(
            in_channels=in_channels,
            out_channels=out_channels,
            kernel_size=kernel_size,
            padding=padding,
            bias=bias,
            dilation=dilation,
        )
        self.batch_norm = nn.BatchNorm2d(out_channels)
        self.activation = nn.ReLU()

    def forward(self, input: torch.Tensor) -> torch.Tensor:
        output = self.conv(input)
        output = self.batch_norm(output)
        output = self.activation(output)
        return output


class UperNetPyramidPoolingBlock(nn.Module):
    def __init__(self, pool_scale: int, in_channels: int, channels: int) -> None:
        super().__init__()
        self.layers = [
            nn.AdaptiveAvgPool2d(pool_scale),
            UperNetConvModule(in_channels, channels, kernel_size=1),
        ]
        for i, layer in enumerate(self.layers):
            self.add_module(str(i), layer)

    def forward(self, input: torch.Tensor) -> torch.Tensor:
        hidden_state = input
        for layer in self.layers:
            hidden_state = layer(hidden_state)
        return hidden_state


class UperNetPyramidPoolingModule(nn.Module):
    """Pyramid Pooling Module (PPM) used in PSPNet."""

    def __init__(self, pool_scales: Tuple[int, ...], in_channels: int, channels: int, align_corners: bool) -> None:
        super().__init__()
        self.pool_scales = pool_scales
        self.align_corners = align_corners
        self.in_channels = in_channels
        self.channels = channels
        self.blocks = []
        for i, pool_scale in enumerate(pool_scales):
            block = UperNetPyramidPoolingBlock(pool_scale=pool_scale, in_channels=in_channels, channels=channels)
            self.blocks.append(block)
            self.add_module(str(i), block)

    def forward(self, x: torch.Tensor) -> List[torch.Tensor]:
        ppm_outs = []
        for ppm in self.blocks:
            ppm_out = ppm(x)
            upsampled_ppm_out = nn.functional.interpolate(
                ppm_out, size=x.size()[2:], mode="bilinear", align_corners=self.align_corners
            )
            ppm_outs.append(upsampled_ppm_out)
        return ppm_outs


class UperNetHead(nn.Module):
    """Unified Perceptual Parsing for Scene Understanding (https://arxiv.org/abs/1807.10221)."""

    def __init__(self, config, in_channels):
        super().__init__()
        self.config = config
        self.pool_scales = config.pool_scales
        self.in_channels = in_channels
        self.channels = config.hidden_size
        self.align_corners = False
        self.classifier = nn.Conv2d(self.channels, config.num_labels, kernel_size=1)

        self.psp_modules = UperNetPyramidPoolingModule(
            self.pool_scales, self.in_channels[-1], self.channels, align_corners=self.align_corners
        )
        self.bottleneck = UperNetConvModule(
            self.in_channels[-1] + len(self.pool_scales) * self.channels, self.channels, kernel_size=3, padding=1
        )
        self.lateral_convs = nn.ModuleList()
        self.fpn_convs = nn.ModuleList()
        for in_channels in self.in_channels[:-1]:
            l_conv = UperNetConvModule(in_channels, self.channels, kernel_size=1)
            fpn_conv = UperNetConvModule(self.channels, self.channels, kernel_size=3, padding=1)
            self.lateral_convs.append(l_conv)
            self.fpn_convs.append(fpn_conv)

        self.fpn_bottleneck = UperNetConvModule(
            len(self.in_channels) * self.channels, self.channels, kernel_size=3, padding=1
        )

    def init_weights(self):
        self.apply(self._init_weights)

    def _init_weights(self, module):
        if isinstance(module, nn.Conv2d):
            module.weight.data.normal_(mean=0.0, std=self.config.initializer_range)
            if module.bias is not None:
                module.bias.data.zero_()

    def psp_forward(self, inputs):
        x = inputs[-1]
        psp_outs = [x]
        psp_outs.extend(self.psp_modules(x))
        psp_outs = torch.cat(psp_outs, dim=1)
        return self.bottleneck(psp_outs)

    def forward(self, encoder_hidden_states: torch.Tensor) -> torch.Tensor:
        laterals = [lateral_conv(encoder_hidden_states[i]) for i, lateral_conv in enumerate(self.lateral_convs)]
        laterals.append(self.psp_forward(encoder_hidden_states))

        used_backbone_levels = len(laterals)
        for i in range(used_backbone_levels - 1, 0, -1):
            prev_shape = laterals[i - 1].shape[2:]
            laterals[i - 1] = laterals[i - 1] + nn.functional.interpolate(
                laterals[i], size=prev_shape, mode="bilinear", align_corners=self.align_corners
            )

        fpn_outs = [self.fpn_convs[i](laterals[i]) for i in range(used_backbone_levels - 1)]
        fpn_outs.append(laterals[-1])

        for i in range(used_backbone_levels - 1, 0, -1):
            fpn_outs[i] = nn.functional.interpolate(
                fpn_outs[i], size=fpn_outs[0].shape[2:], mode="bilinear", align_corners=self.align_corners
            )
        fpn_outs = torch.cat(fpn_outs, dim=1)
        output = self.fpn_bottleneck(fpn_outs)
        return self.classifier(output)


class UperNetFCNHead(nn.Module):
    """Auxiliary FCN head (https://arxiv.org/abs/1411.4038), used only for its training-time loss signal."""

    def __init__(self, config, in_index: int = 2, kernel_size: int = 3, dilation: Union[int, Tuple[int, int]] = 1) -> None:
        super().__init__()
        self.config = config
        self.in_channels = config.auxiliary_in_channels
        self.channels = config.auxiliary_channels
        self.num_convs = config.auxiliary_num_convs
        self.concat_input = config.auxiliary_concat_input
        self.in_index = in_index

        conv_padding = (kernel_size // 2) * dilation
        convs = [UperNetConvModule(self.in_channels, self.channels, kernel_size=kernel_size, padding=conv_padding, dilation=dilation)]
        for _ in range(self.num_convs - 1):
            convs.append(UperNetConvModule(self.channels, self.channels, kernel_size=kernel_size, padding=conv_padding, dilation=dilation))
        self.convs = nn.Identity() if self.num_convs == 0 else nn.Sequential(*convs)
        if self.concat_input:
            self.conv_cat = UperNetConvModule(
                self.in_channels + self.channels, self.channels, kernel_size=kernel_size, padding=kernel_size // 2
            )
        self.classifier = nn.Conv2d(self.channels, config.num_labels, kernel_size=1)

    def init_weights(self):
        self.apply(self._init_weights)

    def _init_weights(self, module):
        if isinstance(module, nn.Conv2d):
            module.weight.data.normal_(mean=0.0, std=self.config.initializer_range)
            if module.bias is not None:
                module.bias.data.zero_()

    def forward(self, encoder_hidden_states: torch.Tensor) -> torch.Tensor:
        hidden_states = encoder_hidden_states[self.in_index]
        output = self.convs(hidden_states)
        if self.concat_input:
            output = self.conv_cat(torch.cat([hidden_states, output], dim=1))
        return self.classifier(output)


class EinFFT(nn.Module):
    """ChangeFFT-style frequency-domain channel mixing. Unused by our checkpoint
    (config.channel_mixing=False) but kept since it costs nothing extra (pure
    torch) and lets a ChannelMixing-Dropout checkpoint be swapped in later."""

    def __init__(self, dim):
        super().__init__()
        self.hidden_size = dim
        self.num_blocks = 4
        self.block_size = self.hidden_size // self.num_blocks
        assert self.hidden_size % self.num_blocks == 0
        self.sparsity_threshold = 0.01
        self.scale = 0.02

        self.complex_weight_1 = nn.Parameter(torch.randn(2, self.num_blocks, self.block_size, self.block_size) * self.scale)
        self.complex_weight_2 = nn.Parameter(torch.randn(2, self.num_blocks, self.block_size, self.block_size) * self.scale)
        self.complex_bias_1 = nn.Parameter(torch.randn(2, self.num_blocks, self.block_size) * self.scale)
        self.complex_bias_2 = nn.Parameter(torch.randn(2, self.num_blocks, self.block_size) * self.scale)

    def multiply(self, input, weights):
        return torch.einsum("...bd,bdk->...bk", input, weights)

    def forward(self, x):
        x = x.permute(0, 2, 3, 1)
        B, H, W, C = x.shape
        x = x.view(B, H, W, self.num_blocks, self.block_size)
        x = torch.fft.fft2(x, dim=(1, 2), norm="ortho")

        x_real_1 = nn.functional.relu(self.multiply(x.real, self.complex_weight_1[0]) - self.multiply(x.imag, self.complex_weight_1[1]) + self.complex_bias_1[0])
        x_imag_1 = nn.functional.relu(self.multiply(x.real, self.complex_weight_1[1]) + self.multiply(x.imag, self.complex_weight_1[0]) + self.complex_bias_1[1])
        x_real_2 = self.multiply(x_real_1, self.complex_weight_2[0]) - self.multiply(x_imag_1, self.complex_weight_2[1]) + self.complex_bias_2[0]
        x_imag_2 = self.multiply(x_real_1, self.complex_weight_2[1]) + self.multiply(x_imag_1, self.complex_weight_2[0]) + self.complex_bias_2[1]

        x = torch.stack([x_real_2, x_imag_2], dim=-1).float()
        x = nn.functional.softshrink(x, lambd=self.sparsity_threshold) if self.sparsity_threshold else x
        x = torch.view_as_complex(x)
        x = torch.fft.ifft2(x, dim=(1, 2), norm="ortho")
        x = x.to(torch.float32)
        return x.reshape(B, H, W, C).permute(0, 3, 1, 2)


class UperNetPreTrainedModel(PreTrainedModel):
    config_class = UperNetConfig
    main_input_name = "pixel_values"

    def _init_weights(self, module):
        if isinstance(module, UperNetPreTrainedModel):
            module.decode_head.init_weights()
            if module.auxiliary_head is not None:
                module.auxiliary_head.init_weights()

    def init_weights(self):
        self.decode_head.init_weights()
        if self.auxiliary_head is not None:
            self.auxiliary_head.init_weights()


class UperNetForSemanticSegmentation(UperNetPreTrainedModel):
    """Siamese-diff change detector: two backbone passes (before/after halves
    of the batch dim), per-stage feature subtraction, UperNet decode head.
    Supports config.Backbone_type in {"Swin_Diff_T/S/B", "ResNet_Diff_18/50/101"}.
    """

    def __init__(self, config):
        super().__init__(config)

        if "Swin_Diff" in config.Backbone_type:
            self.backbone = AutoBackbone.from_config(config.backbone_config)
            config.auxiliary_in_channels = self.backbone.channels[2]
            config.auxiliary_channels = 256
        elif "ResNet_Diff" in config.Backbone_type:
            resnet_repo = {
                "ResNet_Diff_18": "microsoft/resnet-18",
                "ResNet_Diff_50": "microsoft/resnet-50",
                "ResNet_Diff_101": "microsoft/resnet-101",
            }[config.Backbone_type]
            self.backbone = AutoBackbone.from_pretrained(resnet_repo, out_features=["stage1", "stage2", "stage3", "stage4"])
            config.auxiliary_in_channels = self.backbone.channels[2]
            config.auxiliary_channels = 256
        else:
            raise ValueError(
                f"Unsupported Backbone_type={config.Backbone_type!r}. This trimmed "
                "module only supports Swin_Diff_* and ResNet_Diff_* (no VSSM/Mamba "
                "-- see the module docstring for why)."
            )

        self.decode_head = UperNetHead(config, in_channels=self.backbone.channels)
        # NOTE: `channel_mixing` deliberately holds a ModuleList (or None),
        # not a bool -- this MUST match the official repo's attribute name
        # exactly (verified against the real checkpoint's state_dict keys:
        # "channel_mixing.{0,1,2,3}.complex_weight_1" etc.), or the
        # ChannelMixing-Dropout checkpoint's trained weights silently fail
        # to load (they'd show up as MISSING in from_pretrained's load
        # report and get initialized as uninitialized garbage instead of
        # the real trained values -- confirmed this the hard way: a wrong
        # attribute name here previously produced parameters with
        # mean~4e20/std~3.6e22, not the ~0.02-scale values EinFFT.__init__
        # actually sets). Truthiness of this attribute (ModuleList vs None)
        # is what forward() below checks -- there's no separate bool flag.
        if getattr(config, "channel_mixing", False):
            self.channel_mixing = nn.ModuleList([EinFFT(dim) for dim in self.backbone.channels])
            self.norm = nn.ModuleList([nn.LayerNorm(dim) for dim in self.backbone.channels])
            self.drop_path = DropPath(0.1)
        else:
            self.channel_mixing = None
        self.auxiliary_head = UperNetFCNHead(config) if config.use_auxiliary_head else None

        self.post_init()

    def forward(
        self,
        pixel_values: Optional[torch.Tensor] = None,
        output_attentions: Optional[bool] = None,
        output_hidden_states: Optional[bool] = None,
        labels: Optional[torch.Tensor] = None,
        return_dict: Optional[bool] = None,
    ) -> Union[tuple, SemanticSegmenterOutput]:
        """pixel_values: the "before" and "after" images stacked along the
        batch dimension, e.g. torch.cat([imageA, imageB], dim=0) -- matching
        the official repo's convention (second half = A, first half = B)."""
        return_dict = return_dict if return_dict is not None else self.config.use_return_dict

        half = pixel_values.shape[0] // 2
        outputs_A = self.backbone(pixel_values[half:]).feature_maps
        outputs_B = self.backbone(pixel_values[:half]).feature_maps

        features = []
        for i in range(len(outputs_A)):
            diff = outputs_A[i] - outputs_B[i]
            if self.channel_mixing is not None:
                normed = self.norm[i](diff.permute(0, 2, 3, 1)).permute(0, 3, 1, 2)
                diff = diff + self.drop_path(self.channel_mixing[i](normed))
            features.append(diff)
        features = tuple(features)

        logits = self.decode_head(features)
        logits = nn.functional.interpolate(logits, size=pixel_values.shape[2:], mode="bilinear", align_corners=False)

        auxiliary_logits = None
        if self.auxiliary_head is not None:
            auxiliary_logits = self.auxiliary_head(features)
            auxiliary_logits = nn.functional.interpolate(
                auxiliary_logits, size=pixel_values.shape[2:], mode="bilinear", align_corners=False
            )

        loss = None
        if labels is not None:
            if self.config.num_labels == 1:
                raise ValueError("The number of labels should be greater than one")
            loss_fct = CrossEntropyLoss(ignore_index=self.config.loss_ignore_index)
            loss = loss_fct(logits, labels)
            if auxiliary_logits is not None:
                loss += self.config.auxiliary_loss_weight * loss_fct(auxiliary_logits, labels)

        if not return_dict:
            output = (logits,)
            return ((loss,) + output) if loss is not None else output

        return SemanticSegmenterOutput(loss=loss, logits=logits, hidden_states=None, attentions=None)

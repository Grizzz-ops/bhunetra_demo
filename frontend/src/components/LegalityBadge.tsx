import { legalityMeta } from "@/lib/format";
import { AlertTriangleIcon, CheckCircleIcon, QuestionCircleIcon } from "./icons";

const ICONS = {
  alert: AlertTriangleIcon,
  check: CheckCircleIcon,
  question: QuestionCircleIcon,
};

export function LegalityBadge({
  flag,
  size = "md",
}: {
  flag: string | null | undefined;
  size?: "sm" | "md";
}) {
  const meta = legalityMeta(flag);
  const Icon = ICONS[meta.icon];
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px] gap-1" : "px-2.5 py-1 text-xs gap-1.5";
  return (
    <span
      className={`inline-flex items-center ${pad} rounded-md font-display font-semibold uppercase tracking-wide whitespace-nowrap`}
      style={{ color: meta.color, background: meta.bg }}
    >
      <Icon size={size === "sm" ? 12 : 14} />
      {meta.label}
    </span>
  );
}

export function DataSourceTag({ source }: { source: string }) {
  const isReal = source === "REAL";
  const isMock = source === "MOCK";
  const label = isReal ? "REAL" : isMock ? "MOCK" : source.replace(/_/g, " ");
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-display font-bold uppercase tracking-wider border"
      style={
        isReal
          ? { color: "var(--compliant)", borderColor: "var(--compliant)", background: "var(--compliant-bg)" }
          : isMock
            ? { color: "var(--unverified)", borderColor: "var(--unverified)", background: "var(--unverified-bg)" }
            : { color: "var(--text-muted)", borderColor: "var(--border)" }
      }
    >
      {label}
    </span>
  );
}

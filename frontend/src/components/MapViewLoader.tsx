"use client";

import dynamic from "next/dynamic";
import { SkeletonBlock } from "./Skeletons";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full grid place-items-center bg-surface">
      <SkeletonBlock className="h-full w-full" />
    </div>
  ),
});

export default MapView;

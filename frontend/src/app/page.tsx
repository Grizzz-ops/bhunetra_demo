"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function RootPage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(session ? "/dashboard" : "/login");
  }, [loading, session, router]);

  return (
    <div className="grid h-dvh place-items-center bg-bg">
      <div className="font-display text-sm tracking-widest text-text-faint uppercase">
        BhuNetra
      </div>
    </div>
  );
}

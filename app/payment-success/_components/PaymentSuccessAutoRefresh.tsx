"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 2500;
const MAX_MS = 60_000;

export function PaymentSuccessAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      router.refresh();
    }, POLL_MS);

    const stop = setTimeout(() => clearInterval(interval), MAX_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [active, router]);

  return null;
}

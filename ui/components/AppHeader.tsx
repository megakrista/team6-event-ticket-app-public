"use client";

import { usePathname } from "next/navigation";
import LogoutButton from "@/ui/components/LogoutButton";

const HIDDEN_HEADER_PATHS = new Set(["/login", "/signup"]);

export default function AppHeader() {
  const pathname = usePathname();

  if (!pathname || HIDDEN_HEADER_PATHS.has(pathname)) {
    return null;
  }

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
          Event Ticket App
        </p>
        <LogoutButton />
      </div>
    </header>
  );
}

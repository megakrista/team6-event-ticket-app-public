"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/app/_components/LogoutButton";

const HIDDEN_HEADER_PATHS = new Set(["/login", "/signup"]);

export default function AppHeader() {
  const pathname = usePathname();

  if (!pathname || HIDDEN_HEADER_PATHS.has(pathname)) {
    return null;
  }

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/events"
          className="text-sm font-medium uppercase tracking-wide text-blue-700 hover:text-blue-900"
        >
          Event Ticket App
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/tickets"
            className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            My Tickets
          </Link>
          <Link
            href="/profile"
            className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            Profile
          </Link>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

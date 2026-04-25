"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/app/_components/LogoutButton";

const HIDDEN_HEADER_PATHS = new Set(["/login", "/signup"]);

export default function AppHeader() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/users/me", {
      credentials: "same-origin",
    })
      .then((res) => {
        setIsLoggedIn(res.ok);
      })
      .catch(() => {
        setIsLoggedIn(false);
      });
  }, []);

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
          {isLoggedIn === null ? (
            <div className="h-9 w-32 animate-pulse rounded bg-zinc-200" />
          ) : isLoggedIn ? (
            <>
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
            </>
          ) : (
            <Link
              href="/login"
              className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
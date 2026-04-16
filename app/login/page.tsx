"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { API_ROUTES } from "@/lib/api-routes";
import { type LoginResponse } from "@/types/logintype";

type FormState = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!success) return;

    const timeout = setTimeout(() => {
      router.push("/events");
    }, 900);

    return () => clearTimeout(timeout);
  }, [router, success]);

  useEffect(() => {
    const oauthError = searchParams.get("oauthError");
    if (!oauthError) {
      return;
    }

    const messages: Record<string, string> = {
      google_auth_failed: "Google sign-in was canceled or failed.",
      google_token_failed: "Failed to exchange Google auth token.",
      google_profile_invalid: "Google account verification failed.",
      google_user_failed: "Failed to sign in with this Google account.",
    };

    setError(messages[oauthError] ?? "Google sign-in failed. Please try again.");
  }, [searchParams]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const payload = {
        email: form.email,
        password: form.password,
      };

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as LoginResponse;

      if (!response.ok) {
        setError(data.error ?? "Login failed.");
        return;
      }

      setSuccess(data.message ?? "Login successful.");
      setForm({
        email: "",
        password: "",
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900">Login</h1>

        {success ? (
          <div className="space-y-4 rounded border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <p className="font-medium">{success}</p>
            <p>Redirecting you...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <a
              href={API_ROUTES.googleAuthStart}
              className="flex w-full items-center justify-center gap-2 rounded border border-zinc-300 p-3 text-center font-medium text-zinc-800 hover:bg-zinc-50"
            >
              <GoogleIcon />
              Continue with Google
            </a>

            <div className="text-center text-xs uppercase tracking-wide text-zinc-400">
              or
            </div>

            <input
              name="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
              className="w-full rounded border border-zinc-300 p-3"
              required
            />

            <input
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, password: e.target.value }))
              }
              className="w-full rounded border border-zinc-300 p-3"
              required
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-blue-600 p-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
        )}

        <p className="mt-4 text-sm text-zinc-600">
          No account yet?{" "}
          <Link href="/signup" className="font-medium text-blue-600 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.212 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.841 1.154 7.959 3.041l5.657-5.657C34.053 6.053 29.279 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-0.138-2.65-0.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.841 1.154 7.959 3.041l5.657-5.657C34.053 6.053 29.279 4 24 4c-7.682 0-14.318 4.337-17.694 10.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.176 0 9.86-1.977 13.409-5.192l-6.191-5.238C29.143 35.091 26.715 36 24 36c-5.191 0-9.625-3.327-11.283-7.946l-6.522 5.025C9.53 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-0.792 2.237-2.231 4.166-4.085 5.571l0.003-0.002l6.191 5.238C36.974 39.205 44 34 44 24c0-1.341-0.138-2.65-0.389-3.917z"
      />
    </svg>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type UserProfile } from "@/types/usertype";

type ApiResponse = {
  user?: UserProfile;
  error?: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch("/api/users/me", {
          credentials: "same-origin",
        });

        const data = (await response.json()) as ApiResponse;

        if (!response.ok) {
          if (response.status === 401) {
            router.replace("/login");
            return;
          }
          setError(data.error ?? "Failed to load profile");
          return;
        }

        if (data.user) {
          setUser(data.user);
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 p-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl bg-white p-8 shadow">
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600"></div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-50 p-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl bg-white p-8 shadow">
            <p className="text-center text-red-600">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const joinedDate = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
  }).format(new Date(user.createdAt));

  return (
    <main className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-xl bg-white p-8 shadow">
          <h1 className="mb-6 text-3xl font-bold text-zinc-900">Profile</h1>

          <div className="space-y-6">
            <div className="flex items-center gap-4 border-b border-zinc-200 pb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                {user.firstName.charAt(0)}
                {user.lastName.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-zinc-900">
                  {user.fullName}
                </h2>
                <p className="text-sm text-zinc-500">{user.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-zinc-50 p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    First Name
                  </p>
                  <p className="text-lg font-medium text-zinc-900">
                    {user.firstName}
                  </p>
                </div>

                <div className="rounded-lg bg-zinc-50 p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Last Name
                  </p>
                  <p className="text-lg font-medium text-zinc-900">
                    {user.lastName}
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-zinc-50 p-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Email Address
                </p>
                <p className="text-lg font-medium text-zinc-900">
                  {user.email}
                </p>
              </div>

              <div className="rounded-lg bg-zinc-50 p-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  User ID
                </p>
                <p className="font-mono text-sm text-zinc-700">{user.id}</p>
              </div>

              <div className="rounded-lg bg-zinc-50 p-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Member Since
                </p>
                <p className="text-lg font-medium text-zinc-900">
                  {joinedDate}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

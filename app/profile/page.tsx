"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type UserProfile } from "@/types/usertype";
import FormField from "@/ui/components/FormField";

type ApiResponse = {
  user?: UserProfile;
  error?: string;
  fields?: Record<string, string>;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
          data.user.createdAt = new Date(data.user.createdAt);
          setUser(data.user);
          setEditForm({
            firstName: data.user.firstName,
            lastName: data.user.lastName,
            email: data.user.email,
          });
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [router]);

  function handleEdit() {
    if (!user) return;
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    });
    setFieldErrors({});
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setFieldErrors({});
  }

  function handleChange(field: keyof typeof editForm, value: string) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleSave() {
    if (!user) return;
    setIsSaving(true);
    setFieldErrors({});

    try {
      const response = await fetch("/api/users/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(editForm),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        if (data.fields) {
          setFieldErrors(data.fields);
        } else {
          setError(data.error ?? "Failed to update profile");
        }
        return;
      }

      if (data.user) {
        data.user.createdAt = new Date(data.user.createdAt);
        setUser(data.user);
        setIsEditing(false);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

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
  }).format(user.createdAt);

  return (
    <main className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-xl bg-white p-8 shadow">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-zinc-900">Profile</h1>
            {!isEditing && (
              <button
                onClick={handleEdit}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Edit Profile
              </button>
            )}
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 border-b border-zinc-200 pb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                {(isEditing ? editForm.firstName : user.firstName).charAt(0)}
                {(isEditing ? editForm.lastName : user.lastName).charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-zinc-900">
                  {isEditing
                    ? `${editForm.firstName} ${editForm.lastName}`
                    : user.fullName}
                </h2>
                <p className="text-sm text-zinc-500">
                  {isEditing ? editForm.email : user.email}
                </p>
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="First Name"
                    name="firstName"
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    error={fieldErrors.firstName}
                    required
                  />

                  <FormField
                    label="Last Name"
                    name="lastName"
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    error={fieldErrors.lastName}
                    required
                  />
                </div>

                <FormField
                  label="Email Address"
                  name="email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  error={fieldErrors.email}
                  required
                />

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
            ) : (
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
            )}

            {isEditing && (
              <div className="flex gap-3 border-t border-zinc-200 pt-6">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 rounded bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="flex-1 rounded border border-zinc-300 bg-white px-4 py-3 font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

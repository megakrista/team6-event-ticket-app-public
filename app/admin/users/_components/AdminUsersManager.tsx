"use client";

import { FormEvent, useState } from "react";
import type { UserRole } from "@prisma/client";
import { API_ROUTES } from "@/lib/api-routes";
import FormField from "@/ui/components/FormField";

export type AdminUserItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
};

type AdminUsersManagerProps = {
  initialUsers: AdminUserItem[];
  currentUserId: string;
};

type UserFormState = {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
};

type ApiSuccessPayload = { user?: AdminUserItem };
type ApiErrorPayload = { error?: string; fields?: Record<string, string> };

function toFormState(user: AdminUserItem): UserFormState {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
  };
}

function roleBadgeClasses(role: UserRole): string {
  return role === "ADMIN"
    ? "bg-blue-100 text-blue-800"
    : "bg-zinc-100 text-zinc-700";
}

function formatJoinedDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export default function AdminUsersManager({
  initialUsers,
  currentUserId,
}: AdminUsersManagerProps) {
  const [users, setUsers] = useState(initialUsers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UserFormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [userPendingDelete, setUserPendingDelete] =
    useState<AdminUserItem | null>(null);
  const [rolePendingConfirm, setRolePendingConfirm] = useState<{
    user: AdminUserItem;
    form: UserFormState;
    typedEmail: string;
  } | null>(null);

  function startEdit(user: AdminUserItem) {
    setEditingId(user.id);
    setEditForm(toFormState(user));
    setFieldErrors({});
    setBannerError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setFieldErrors({});
  }

  function updateEditField(field: keyof UserFormState, value: string) {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function submitEdit(targetId: string, form: UserFormState) {
    setFieldErrors({});
    setBannerError(null);
    const actionKey = `edit:${targetId}`;
    setBusyAction(actionKey);

    try {
      const response = await fetch(API_ROUTES.userById(targetId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json().catch(() => ({}))) as
        | ApiSuccessPayload
        | ApiErrorPayload;

      if (!response.ok || !("user" in data) || !data.user) {
        const errorData = data as ApiErrorPayload;
        if (errorData.fields) {
          setFieldErrors(errorData.fields);
        } else {
          setBannerError(errorData.error ?? "Failed to update user.");
        }
        return;
      }

      const updated = data.user;
      setUsers((prev) => prev.map((u) => (u.id === targetId ? updated : u)));
      cancelEdit();
      setRolePendingConfirm(null);
    } catch {
      setBannerError("Network error while updating user.");
    } finally {
      setBusyAction(null);
    }
  }

  function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingId || !editForm) return;

    const target = users.find((u) => u.id === editingId);
    if (!target) return;

    if (editForm.role !== target.role) {
      setBannerError(null);
      setRolePendingConfirm({
        user: target,
        form: editForm,
        typedEmail: "",
      });
      return;
    }

    void submitEdit(editingId, editForm);
  }

  async function confirmDeleteUser() {
    if (!userPendingDelete) return;

    const user = userPendingDelete;
    const actionKey = `delete:${user.id}`;
    setBusyAction(actionKey);
    setBannerError(null);

    try {
      const response = await fetch(API_ROUTES.userById(user.id), {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as ApiErrorPayload;

      if (!response.ok) {
        setBannerError(data.error ?? "Failed to delete user.");
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (editingId === user.id) cancelEdit();
    } catch {
      setBannerError("Network error while deleting user.");
    } finally {
      setUserPendingDelete(null);
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      {bannerError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {bannerError}
        </div>
      ) : null}

      {users.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-zinc-600">No users yet.</p>
        </div>
      ) : null}

      {users.map((user) => {
        const isEditing = editingId === user.id;
        const isEditBusy = busyAction === `edit:${user.id}`;
        const isDeleteBusy = busyAction === `delete:${user.id}`;
        const isSelf = user.id === currentUserId;

        return (
          <article
            key={user.id}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  {user.fullName}
                  {isSelf ? (
                    <span className="ml-2 text-xs font-medium uppercase tracking-wide text-blue-700">
                      You
                    </span>
                  ) : null}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">{user.email}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${roleBadgeClasses(user.role)}`}
              >
                {user.role}
              </span>
            </div>

            <div className="mt-3 grid gap-1 text-sm text-zinc-700 sm:grid-cols-2">
              <p>
                <span className="font-medium">Joined:</span>{" "}
                {formatJoinedDate(user.createdAt)}
              </p>
              <p className="truncate">
                <span className="font-medium">ID:</span>{" "}
                <span className="font-mono text-xs">{user.id}</span>
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => startEdit(user)}
                disabled={isEditBusy || isDeleteBusy}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Edit
              </button>
              {isSelf ? (
                <span
                  title="You cannot delete your own account"
                  className="cursor-not-allowed rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-400"
                >
                  Delete
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setBannerError(null);
                    setUserPendingDelete(user);
                  }}
                  disabled={isDeleteBusy || isEditBusy}
                  className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleteBusy ? "Deleting..." : "Delete"}
                </button>
              )}
            </div>

            {isEditing && editForm ? (
              <form
                onSubmit={handleEditSubmit}
                className="mt-5 space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="First Name"
                    name={`firstName-${user.id}`}
                    value={editForm.firstName}
                    onChange={(e) =>
                      updateEditField("firstName", e.target.value)
                    }
                    error={fieldErrors.firstName}
                    required
                  />
                  <FormField
                    label="Last Name"
                    name={`lastName-${user.id}`}
                    value={editForm.lastName}
                    onChange={(e) =>
                      updateEditField("lastName", e.target.value)
                    }
                    error={fieldErrors.lastName}
                    required
                  />
                </div>
                <FormField
                  label="Email Address"
                  name={`email-${user.id}`}
                  type="email"
                  value={editForm.email}
                  onChange={(e) => updateEditField("email", e.target.value)}
                  error={fieldErrors.email}
                  required
                />
                <div>
                  <FormField
                    as="select"
                    label="Role"
                    name={`role-${user.id}`}
                    value={editForm.role}
                    onChange={(e) => updateEditField("role", e.target.value)}
                    error={fieldErrors.role}
                    disabled={isSelf}
                    required
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </FormField>
                  {isSelf ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      You cannot change your own role — ask another admin.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={isEditBusy}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isEditBusy ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isEditBusy}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </article>
        );
      })}

      {rolePendingConfirm ? (() => {
        const isRoleConfirmBusy =
          busyAction === `edit:${rolePendingConfirm.user.id}`;
        const typedEmailMatches =
          rolePendingConfirm.typedEmail.trim().toLowerCase() ===
          rolePendingConfirm.user.email.toLowerCase();

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
            <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-zinc-900">Change role</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Change{" "}
                <strong>{rolePendingConfirm.user.fullName}</strong> from{" "}
                <strong>{rolePendingConfirm.user.role}</strong> to{" "}
                <strong>{rolePendingConfirm.form.role}</strong>? They will be
                signed out immediately.
              </p>
              <p className="mt-4 text-sm text-zinc-600">
                Type <strong>{rolePendingConfirm.user.email}</strong> to confirm:
              </p>
              <input
                type="text"
                className="mt-2 w-full rounded border border-zinc-300 p-2 text-sm text-zinc-900"
                value={rolePendingConfirm.typedEmail}
                onChange={(e) =>
                  setRolePendingConfirm((prev) =>
                    prev ? { ...prev, typedEmail: e.target.value } : prev,
                  )
                }
                autoFocus
              />
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRolePendingConfirm(null)}
                  disabled={isRoleConfirmBusy}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void submitEdit(
                      rolePendingConfirm.user.id,
                      rolePendingConfirm.form,
                    )
                  }
                  disabled={isRoleConfirmBusy || !typedEmailMatches}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRoleConfirmBusy ? "Saving..." : "Change role"}
                </button>
              </div>
            </div>
          </div>
        );
      })() : null}

      {userPendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Delete user</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Delete &quot;{userPendingDelete.fullName}&quot; (
              {userPendingDelete.email})? They will be signed out immediately
              and can no longer log in.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUserPendingDelete(null)}
                disabled={busyAction === `delete:${userPendingDelete.id}`}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                disabled={busyAction === `delete:${userPendingDelete.id}`}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === `delete:${userPendingDelete.id}`
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

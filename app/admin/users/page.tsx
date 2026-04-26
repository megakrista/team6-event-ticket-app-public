import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { getSessionByToken } from "@/services/sessionservices";
import { listAdminUsers } from "@/services/userservices";
import AdminUsersManager, {
  type AdminUserItem,
} from "@/app/admin/users/_components/AdminUsersManager";
import type { AdminUserListItem } from "@/types/usertype";

export const dynamic = "force-dynamic";

function toAdminUserItem(user: AdminUserListItem): AdminUserItem {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    role: user.role,
    createdAt: new Date(user.createdAt).toISOString(),
  };
}

export default async function AdminUsersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const sessionResult = await getSessionByToken(token);

  if (!sessionResult) {
    redirect("/login");
  }

  if (sessionResult.user.role !== "ADMIN") {
    redirect("/events");
  }

  const users = await listAdminUsers();
  const initialUsers = users.map(toAdminUserItem);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-blue-700">
              Admin
            </p>
            <h1 className="text-3xl font-bold text-zinc-900">User Management</h1>
            <p className="mt-2 text-zinc-600">
              Edit and remove user accounts.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/events"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Back to events
            </Link>
            <Link
              href="/admin/events"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Manage events
            </Link>
            <Link
              href="/admin/venues"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Manage venues
            </Link>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
              Loading users…
            </div>
          }
        >
          <AdminUsersManager
            initialUsers={initialUsers}
            currentUserId={sessionResult.user.id}
          />
        </Suspense>
      </section>
    </main>
  );
}

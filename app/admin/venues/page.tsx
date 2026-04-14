import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { listAdminVenues } from "@/services/venueservices";
import { getSessionByToken } from "@/services/sessionservices";
import AdminVenuesManager, {
  type AdminVenueItem,
} from "@/app/admin/venues/_components/AdminVenuesManager";

export const dynamic = "force-dynamic";

function toAdminVenueItem(
  venue: Awaited<ReturnType<typeof listAdminVenues>>[number],
): AdminVenueItem {
  return {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    latitude: venue.latitude,
    longitude: venue.longitude,
    timezone: venue.timezone,
    eventCount: venue._count.events,
  };
}

export default async function AdminVenuesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const sessionResult = await getSessionByToken(token);

  if (!sessionResult) {
    redirect("/login");
  }

  if (sessionResult.user.role !== "ADMIN") {
    redirect("/events");
  }

  const venues = await listAdminVenues();
  const initialVenues = venues.map(toAdminVenueItem);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-blue-700">
              Admin
            </p>
            <h1 className="text-3xl font-bold text-zinc-900">Venue Management</h1>
            <p className="mt-2 text-zinc-600">
              Add, edit, and remove venues used by events.
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
              href="/admin/venues?create=1"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add venue
            </Link>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
              Loading venues…
            </div>
          }
        >
          <AdminVenuesManager initialVenues={initialVenues} />
        </Suspense>
      </section>
    </main>
  );
}

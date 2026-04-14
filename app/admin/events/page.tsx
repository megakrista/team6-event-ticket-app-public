import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { listAdminEvents } from "@/services/eventservices";
import { getSessionByToken } from "@/services/sessionservices";
import { listVenues } from "@/services/venueservices";
import AdminEventsManager, {
  type AdminEventItem,
  type AdminVenueOption,
} from "@/app/admin/events/_components/AdminEventsManager";

export const dynamic = "force-dynamic";

function prismaEventToAdminItem(
  event: Awaited<ReturnType<typeof listAdminEvents>>[number],
): AdminEventItem {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    category: event.category,
    startsAt: new Date(event.startsAt).toISOString(),
    endsAt: new Date(event.endsAt).toISOString(),
    capacity: event.capacity,
    price: event.price,
    imageUrl: event.imageUrl,
    status: event.status,
    venueId: event.venueId,
    venueName: event.venue.name,
  };
}

function toAdminVenueOption(
  venue: Awaited<ReturnType<typeof listVenues>>[number],
): AdminVenueOption {
  return {
    id: venue.id,
    name: venue.name,
  };
}

export default async function AdminEventsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const sessionResult = await getSessionByToken(token);

  if (!sessionResult) {
    redirect("/login");
  }

  if (sessionResult.user.role !== "ADMIN") {
    redirect("/events");
  }

  const [events, venues] = await Promise.all([listAdminEvents(), listVenues()]);
  const initialEvents = events.map(prismaEventToAdminItem);
  const venueOptions = venues.map(toAdminVenueOption);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-blue-700">
              Admin
            </p>
            <h1 className="text-3xl font-bold text-zinc-900">
              Event Management
            </h1>
            <p className="mt-2 text-zinc-600">
              Edit, delete, and publish events from one place.
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
              href="/admin/events/create"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create event
            </Link>
          </div>
        </div>

        <AdminEventsManager initialEvents={initialEvents} venues={venueOptions} />
      </section>
    </main>
  );
}

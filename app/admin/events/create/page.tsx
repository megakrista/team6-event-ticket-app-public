import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionByToken } from "@/services/sessionservices";
import { listVenues } from "@/services/venueservices";
import CreateEventForm from "@/app/admin/events/create/_components/CreateEventForm";

export default async function CreateEventPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const result = await getSessionByToken(token);

  if (!result || result.user.role !== "ADMIN") {
    redirect("/login");
  }

  const venues = await listVenues();

  return (
    <main className="min-h-screen bg-zinc-50 p-8">
      <CreateEventForm venues={venues} />
    </main>
  );
}

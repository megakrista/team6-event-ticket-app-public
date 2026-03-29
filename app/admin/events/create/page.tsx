import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionByToken } from "@/services/sessionservices";
import CreateEventForm from "./CreateEventForm";

export default async function CreateEventPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const result = await getSessionByToken(token);

  if (!result || result.user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-8">
      <CreateEventForm />
    </main>
  );
}

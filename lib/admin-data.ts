import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth";

export async function requireAdministrator() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  if (actor.role !== "ADMIN") redirect(actor.role === "COORDINATOR" ? "/coordinator" : actor.role === "REVIEWER" ? "/reviewer" : "/portal");
  return actor;
}

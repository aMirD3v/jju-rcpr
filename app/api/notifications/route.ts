import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const notifications = await prisma.notification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json(notifications, { headers: { "Cache-Control": "no-store" } });
}
export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  await prisma.notification.updateMany({ where: { userId: actor.id, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ updated: true });
}

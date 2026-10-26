import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export type SessionActor = { id: string; role: Role; name?: string | null; email?: string | null; passwordResetRequired?: boolean; institution?: string | null };

async function readActor(): Promise<SessionActor | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: Role; sessionVersion?: number; passwordResetRequired?: boolean; institution?: string | null; name?: string | null; email?: string | null } | undefined;
  if (!user?.id || !user.role) return null;
  const current = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, role: true, name: true, email: true, passwordResetRequired: true, institution: true, sessionVersion: true, isActive: true } });
  if (!current || !current.isActive || user.sessionVersion !== current.sessionVersion) return null;
  return current;
}

const getRequestActor = cache(readActor);

export async function getActor(): Promise<SessionActor | null> {
  const actor = await getRequestActor();
  return actor?.passwordResetRequired ? null : actor;
}

export const getPasswordChangeActor = getRequestActor;

export async function requireActor(...roles: Role[]) {
  const actor = await getActor();
  if (!actor) throw new Response("Authentication required", { status: 401 });
  if (roles.length && !roles.includes(actor.role)) throw new Response("Forbidden", { status: 403 });
  return actor;
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getPasswordChangeActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isSameOrigin } from "@/lib/security";

const input = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(12).max(200).regex(/[A-Za-z]/).regex(/[0-9]/) });
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getPasswordChangeActor();
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "The new password must be at least 12 characters and contain a letter and a number." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true } });
  if (!user?.passwordHash || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
  const passwordHash = await hashPassword(parsed.data.newPassword);
  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({ where: { id: actor.id, passwordHash: user.passwordHash }, data: { passwordHash, passwordResetRequired: false, sessionVersion: { increment: 1 } } });
    if (result.count !== 1) return false;
    await tx.auditLog.create({ data: { actorId: actor.id, action: "PASSWORD_CHANGED", resourceType: "User", resourceId: actor.id } });
    return true;
  }, { isolationLevel: "Serializable" });
  if (!changed) return NextResponse.json({ error: "The account changed during this request. Sign in again and retry." }, { status: 409 });
  return NextResponse.json({ updated: true });
}

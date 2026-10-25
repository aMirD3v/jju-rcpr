import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

const input = z.object({ reason: z.string().trim().min(10).max(1000) });
type Context = { params: Promise<{ userId: string }> };

export async function POST(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor();
  if (!actor || actor.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Record a reason for this password reset." }, { status: 400 });
  const { userId } = await params;
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
  if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (!account.isActive) return NextResponse.json({ error: "Activate this account before resetting its password." }, { status: 409 });
  const temporaryPassword = randomBytes(18).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);
  const changed = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({ where: { id: account.id, isActive: true }, data: { passwordHash, passwordResetRequired: true, passwordResetTokenHash: null, passwordResetTokenExpiry: null, failedLoginAttempts: 0, lockoutUntil: null, sessionVersion: { increment: 1 } } });
    if (updated.count !== 1) return false;
    await tx.auditLog.create({ data: { actorId: actor.id, action: "ACCOUNT_PASSWORD_RESET_BY_ADMIN", resourceType: "User", resourceId: account.id, detail: { reason: parsed.data.reason } } });
    await tx.notification.create({ data: { userId: account.id, type: "ACTION_REQUIRED", title: "Temporary password issued", body: "The system administrator reset your sign-in access. Change the temporary password immediately after signing in.", link: "/change-password" } });
    return true;
  }, { isolationLevel: "Serializable" });
  if (!changed) return NextResponse.json({ error: "This account changed while access was being reset. Refresh and try again." }, { status: 409 });
  return NextResponse.json({ temporaryPassword });
}

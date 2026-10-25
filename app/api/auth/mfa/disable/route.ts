import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { consumeRecoveryCode, verifyTotp } from "@/lib/mfa";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor(); if (!actor) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const parsed = z.object({ password: z.string().min(1).max(200), code: z.string().min(6).max(20) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Provide your password and authenticator or recovery code." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user?.mfaEnabled || !user.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) return NextResponse.json({ error: "The account security check failed." }, { status: 403 });
  const validTotp = user.mfaSecretEncrypted ? verifyTotp(user.mfaSecretEncrypted, parsed.data.code) : false;
  if (!validTotp && !(await consumeRecoveryCode(actor.id, parsed.data.code))) return NextResponse.json({ error: "The account security check failed." }, { status: 403 });
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { mfaEnabled: false, mfaSecretEncrypted: null, sessionVersion: { increment: 1 } } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: actor.id } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "MFA_DISABLED", resourceType: "User", resourceId: actor.id } });
  });
  return NextResponse.json({ disabled: true });
}

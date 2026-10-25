import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { verifyTotp } from "@/lib/mfa";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor(); if (!actor) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const parsed = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter the six digit code from your authenticator." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { mfaEnabled: true, mfaSecretEncrypted: true } });
  if (!user?.mfaSecretEncrypted || user.mfaEnabled || !verifyTotp(user.mfaSecretEncrypted, parsed.data.code)) return NextResponse.json({ error: "The authenticator code is invalid or setup has expired." }, { status: 400 });
  await prisma.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({ where: { id: actor.id, mfaEnabled: false, mfaSecretEncrypted: user.mfaSecretEncrypted }, data: { mfaEnabled: true } });
    if (changed.count !== 1) throw new Error("MFA_SETUP_CHANGED");
    await tx.auditLog.create({ data: { actorId: actor.id, action: "MFA_ENABLED", resourceType: "User", resourceId: actor.id } });
  });
  return NextResponse.json({ enabled: true });
}

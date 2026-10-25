import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { encryptTotpSecret, hashRecoveryCode, makeRecoveryCodes, newTotpSecret } from "@/lib/mfa";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor(); if (!actor) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { mfaEnabled: true } });
  if (!user || user.mfaEnabled) return NextResponse.json({ error: "MFA is already enabled or the account is unavailable." }, { status: 409 });
  let secret: string; let encrypted: string; try { secret = newTotpSecret(); encrypted = encryptTotpSecret(secret); } catch { return NextResponse.json({ error: "MFA encryption is not configured. Contact the system administrator." }, { status: 503 }); }
  const recovery = makeRecoveryCodes();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { mfaSecretEncrypted: encrypted, mfaEnabled: false } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: actor.id } });
    await tx.mfaRecoveryCode.createMany({ data: recovery.map((code) => ({ userId: actor.id, tokenHash: hashRecoveryCode(code) })) });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "MFA_SETUP_STARTED", resourceType: "User", resourceId: actor.id } });
  });
  const issuer = encodeURIComponent("JJU-RCPR"); const account = encodeURIComponent(actor.email ?? actor.id);
  return NextResponse.json({ secret, otpauthUrl: `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`, recoveryCodes: recovery });
}

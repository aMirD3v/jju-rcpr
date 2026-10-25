import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { isSameOrigin } from "@/lib/security";

const input = z.object({ token: z.string().min(32).max(200), password: z.string().min(12).max(200).regex(/[A-Za-z]/).regex(/[0-9]/) });
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Use a password of at least 12 characters with a letter and a number." }, { status: 400 });
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const user = await prisma.user.findFirst({ where: { passwordResetTokenHash: tokenHash, passwordResetTokenExpiry: { gt: new Date() } }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "This password reset link is invalid or expired. Request another link." }, { status: 400 });
  const passwordHash = await hashPassword(parsed.data.password);
  let tokenUsed = false;
  await prisma.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({ where: { id: user.id, passwordResetTokenHash: tokenHash, passwordResetTokenExpiry: { gt: new Date() } }, data: { passwordHash, passwordResetRequired: false, passwordResetTokenHash: null, passwordResetTokenExpiry: null, failedLoginAttempts: 0, lockoutUntil: null, sessionVersion: { increment: 1 } } });
    if (changed.count !== 1) throw new Error("RESET_TOKEN_ALREADY_USED");
    await tx.auditLog.create({ data: { actorId: user.id, action: "PASSWORD_RESET_COMPLETED", resourceType: "User", resourceId: user.id } });
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "RESET_TOKEN_ALREADY_USED") { tokenUsed = true; return; }
    throw error;
  });
  if (tokenUsed) return NextResponse.json({ error: "This password reset link has already been used." }, { status: 409 });
  return NextResponse.json({ updated: true });
}

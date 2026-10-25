import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import { sendPasswordResetEmail } from "@/lib/email";

const input = z.object({ email: z.string().trim().email().max(254) });
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() }, select: { id: true, name: true, email: true, emailVerifiedAt: true } });
  if (user?.emailVerifiedAt) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordResetTokenHash: tokenHash, passwordResetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000) } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "PASSWORD_RESET_REQUESTED", resourceType: "User", resourceId: user.id } });
    });
    await sendPasswordResetEmail(user.email, user.name, token);
  }
  return NextResponse.json({ message: "If a verified account uses that address and email delivery is configured, reset instructions will be sent." });
}

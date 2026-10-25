import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
const input = z.object({ token: z.string().min(32).max(200) });
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Verification link is invalid or expired." }, { status: 400 });
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const user = await prisma.user.findFirst({ where: { verificationTokenHash: tokenHash, verificationTokenExpiry: { gt: new Date() }, emailVerifiedAt: null }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Verification link is invalid or expired." }, { status: 400 });
  const verified = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({ where: { id: user.id, verificationTokenHash: tokenHash, verificationTokenExpiry: { gt: new Date() }, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date(), verificationTokenHash: null, verificationTokenExpiry: null } });
    if (updated.count !== 1) return false;
    await tx.auditLog.create({ data: { actorId: user.id, action: "EMAIL_VERIFIED", resourceType: "User", resourceId: user.id } });
    return true;
  }, { isolationLevel: "Serializable" });
  if (!verified) return NextResponse.json({ error: "Verification link is invalid or expired." }, { status: 400 });
  return NextResponse.json({ verified: true });
}

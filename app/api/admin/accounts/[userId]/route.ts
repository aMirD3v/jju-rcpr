import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

const input = z.discriminatedUnion("action", [z.object({ action: z.literal("VERIFY_RESEARCHER") }), z.object({ action: z.literal("ACTIVATE") }), z.object({ action: z.literal("DEACTIVATE"), reason: z.string().trim().min(10).max(1000) }), z.object({ action: z.literal("UPDATE_REVIEWER_PROFILE"), reviewerExpertise: z.array(z.string().trim().min(2).max(80)).max(30), maxActiveAssignments: z.number().int().min(1).max(100).nullable() })]);
type Context = { params: Promise<{ userId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor();
  if (!actor || actor.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid account action and provide any required reason." }, { status: 400 });
  const { userId } = await params;
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true, emailVerifiedAt: true } });
  if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (parsed.data.action === "UPDATE_REVIEWER_PROFILE") {
    const profile = parsed.data;
    if (target.role !== "REVIEWER") return NextResponse.json({ error: "Only reviewer accounts have reviewer profiles." }, { status: 409 });
    const expertise = [...new Set(parsed.data.reviewerExpertise.map((item) => item.trim()).filter(Boolean))];
    const account = await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({ where: { id: target.id, role: "REVIEWER" }, data: { reviewerExpertise: expertise, maxActiveAssignments: profile.maxActiveAssignments } });
      if (changed.count !== 1) return false;
      await tx.auditLog.create({ data: { actorId: actor.id, action: "REVIEWER_PROFILE_UPDATED", resourceType: "User", resourceId: target.id, detail: { reviewerExpertise: expertise, maxActiveAssignments: profile.maxActiveAssignments } } });
      return true;
    });
    return account ? NextResponse.json({ updated: true }) : NextResponse.json({ error: "Reviewer profile could not be updated." }, { status: 409 });
  }
  if (parsed.data.action === "VERIFY_RESEARCHER" && (target.role !== "RESEARCHER" || target.emailVerifiedAt)) return NextResponse.json({ error: "Only a pending researcher account can be verified." }, { status: 409 });
  if (parsed.data.action === "ACTIVATE" && target.isActive) return NextResponse.json({ error: "This account is already active." }, { status: 409 });
  if (parsed.data.action === "DEACTIVATE") {
    if (target.id === actor.id) return NextResponse.json({ error: "You cannot deactivate your own administrator account." }, { status: 400 });
    if (!target.isActive) return NextResponse.json({ error: "This account is already inactive." }, { status: 409 });
  }
  const update = parsed.data.action === "VERIFY_RESEARCHER"
    ? { emailVerifiedAt: new Date(), verificationTokenHash: null, verificationTokenExpiry: null }
    : { isActive: parsed.data.action === "ACTIVATE", ...(parsed.data.action === "DEACTIVATE" ? { sessionVersion: { increment: 1 } } : {}) };
  const account = await prisma.$transaction(async (tx) => {
    if (parsed.data.action === "DEACTIVATE" && target.role === "ADMIN") {
      const activeAdmins = await tx.user.count({ where: { role: "ADMIN", isActive: true } });
      if (activeAdmins <= 1) return "LAST_ACTIVE_ADMIN" as const;
    }
    const changed = await tx.user.updateMany({ where: { id: target.id, ...(parsed.data.action === "VERIFY_RESEARCHER" ? { role: "RESEARCHER" as const, emailVerifiedAt: null } : { isActive: target.isActive }) }, data: update });
    if (changed.count !== 1) return "CHANGED" as const;
    await tx.auditLog.create({ data: { actorId: actor.id, action: parsed.data.action === "VERIFY_RESEARCHER" ? "RESEARCHER_EMAIL_VERIFIED_BY_ADMIN" : parsed.data.action === "ACTIVATE" ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DEACTIVATED", resourceType: "User", resourceId: target.id, detail: parsed.data.action === "DEACTIVATE" ? { reason: parsed.data.reason } : undefined } });
    if (parsed.data.action === "VERIFY_RESEARCHER") await tx.notification.create({ data: { userId: target.id, type: "INFO", title: "Account verified", body: "The research office has verified your account. You can now sign in to JJU-RCPR.", link: "/sign-in" } });
    return "UPDATED" as const;
  }, { isolationLevel: "Serializable" });
  if (account === "LAST_ACTIVE_ADMIN") return NextResponse.json({ error: "The last active administrator account cannot be deactivated." }, { status: 409 });
  if (account !== "UPDATED") return NextResponse.json({ error: "The account changed while this action was being processed. Refresh and try again." }, { status: 409 });
  return NextResponse.json({ updated: true });
}

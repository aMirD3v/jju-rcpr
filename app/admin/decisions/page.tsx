import { AdminDecisionOversight } from "@/components/admin/decision-oversight";
import { requireAdministrator } from "@/lib/admin-data";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Decision oversight" };

export default async function AdminDecisionsPage() {
  await requireAdministrator();
  const decisions = await prisma.researchDecision.findMany({
    where: {
      status: { in: ["ACCEPTED", "REJECTED"] },
      submission: { status: { in: ["ACCEPTED", "REJECTED"] } },
    },
    select: {
      id: true,
      status: true,
      feedback: true,
      isOverride: true,
      overrideReason: true,
      createdAt: true,
      decisionMaker: { select: { name: true } },
      submission: {
        select: {
          id: true,
          referenceNumber: true,
          title: true,
          researcher: { select: { name: true, email: true } },
          call: {
            select: {
              title: true,
              coordinator: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const seen = new Set<string>();
  const current = decisions.filter((decision) => {
    if (seen.has(decision.submission.id)) return false;
    seen.add(decision.submission.id);
    return true;
  });

  return (
    <AdminDecisionOversight
      decisions={current.map((decision) => ({
        ...decision,
        status: decision.status as "ACCEPTED" | "REJECTED",
        createdAt: decision.createdAt.toISOString(),
      }))}
    />
  );
}

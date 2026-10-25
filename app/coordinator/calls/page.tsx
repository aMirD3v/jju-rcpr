import { CoordinatorCallsWorkspace } from "@/components/coordinator/admin-workspaces";
import { requireCoordinator } from "@/lib/coordinator-data";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Research calls" };
export default async function CoordinatorCallsPage() {
  const actor = await requireCoordinator();
  const calls = await prisma.researchCall.findMany({ where: { coordinatorId: actor.id }, include: { _count: { select: { submissions: true } }, criteria: { orderBy: { position: "asc" } }, requiredDocuments: { orderBy: { position: "asc" } } }, orderBy: { updatedAt: "desc" } });
  return <CoordinatorCallsWorkspace calls={calls} />;
}

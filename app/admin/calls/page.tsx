import { AdminCallSupervision } from "@/components/admin/call-supervision";
import { requireAdministrator } from "@/lib/admin-data";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Call supervision" };

export default async function AdminCallsPage() {
  await requireAdministrator();
  const [calls, coordinators] = await Promise.all([
    prisma.researchCall.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        opensAt: true,
        closesAt: true,
        coordinatorId: true,
        coordinator: { select: { name: true, email: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({
      where: {
        role: "COORDINATOR",
        isActive: true,
        emailVerifiedAt: { not: null },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AdminCallSupervision
      calls={calls.map((call) => ({
        ...call,
        opensAt: call.opensAt.toISOString(),
        closesAt: call.closesAt.toISOString(),
      }))}
      coordinators={coordinators}
      now={new Date().toISOString()}
    />
  );
}

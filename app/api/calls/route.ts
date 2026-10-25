import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  const calls = await prisma.researchCall.findMany({
    where: { status: "OPEN", opensAt: { lte: now }, closesAt: { gte: now } },
    select: { id: true, title: true, description: true, topics: true, requirements: true, requiredDocuments: { orderBy: { position: "asc" }, select: { id: true, label: true, description: true } }, acceptedFileTypes: true, opensAt: true, closesAt: true, criteria: { orderBy: { position: "asc" } } },
    orderBy: { closesAt: "asc" },
  });
  return Response.json(calls, { headers: { "Cache-Control": "no-store" } });
}

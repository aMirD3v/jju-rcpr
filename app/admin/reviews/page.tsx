import { AdminReviewSupervision } from "@/components/admin/review-supervision";
import { requireAdministrator } from "@/lib/admin-data";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Review supervision" };

export default async function AdminReviewsPage() {
  await requireAdministrator();
  const assignments = await prisma.reviewerAssignment.findMany({
    where: {
      supersededAt: null,
      status: { in: ["PENDING", "ACCEPTED"] },
    },
    select: {
      id: true,
      dueAt: true,
      status: true,
      reviewerId: true,
      reviewer: { select: { name: true, email: true } },
      submission: {
        select: {
          id: true,
          referenceNumber: true,
          title: true,
          call: {
            select: {
              title: true,
              coordinator: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { dueAt: "asc" },
  });

  return (
    <AdminReviewSupervision
      assignments={assignments.map((assignment) => ({
        ...assignment,
        status: assignment.status as "PENDING" | "ACCEPTED",
        dueAt: assignment.dueAt.toISOString(),
      }))}
      now={new Date().toISOString()}
    />
  );
}

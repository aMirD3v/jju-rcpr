import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDocumentBucket, getStorageClient } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in to access this document." }, { status: 401 });
  const { documentId } = await params;
  const document = await prisma.submissionDocument.findUnique({
    where: { id: documentId },
    include: { version: { select: { round: true } }, submission: { include: {
      assignments: { where: { supersededAt: null }, select: { reviewerId: true, status: true } },
      call: { select: { coordinatorId: true } },
    } } },
  });
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const submission = document.submission;
  const allowed = (actor.role === "RESEARCHER" && submission.researcherId === actor.id) || (actor.role === "COORDINATOR" && submission.call.coordinatorId === actor.id) || (actor.role === "REVIEWER" && submission.assignments.some((a) => a.reviewerId === actor.id && ["PENDING", "ACCEPTED", "COMPLETED"].includes(a.status)));
  if (!allowed) return NextResponse.json({ error: "You are not authorized to access this document." }, { status: 403 });
  try {
    const extension = document.originalName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "file";
    const downloadName = actor.role === "REVIEWER" ? `Review-document-${document.id.slice(-6)}.${extension}` : document.originalName;
    const url = await getSignedUrl(getStorageClient(), new GetObjectCommand({ Bucket: getDocumentBucket(), Key: document.objectKey, ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}` }), { expiresIn: 60 });
    return NextResponse.redirect(url, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Document retrieval signing failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Document storage is unavailable." }, { status: 503 });
  }
}

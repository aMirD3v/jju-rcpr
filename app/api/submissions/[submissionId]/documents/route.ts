import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDocumentBucket, getStorageClient } from "@/lib/storage";
import { isSameOrigin } from "@/lib/security";

const MAX_SIZE = 20 * 1024 * 1024;
const MAX_FILES_PER_VERSION = 5;
const MAX_VERSION_BYTES = 50 * 1024 * 1024;
function isPdf(buffer: Buffer) { return buffer.subarray(0, 5).toString("ascii") === "%PDF-"; }
function isDocx(buffer: Buffer) { return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) && buffer.includes(Buffer.from("[Content_Types].xml")) && buffer.includes(Buffer.from("word/")); }

export async function POST(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor();
  if (!actor || actor.role !== "RESEARCHER") return NextResponse.json({ error: "Researcher sign in is required." }, { status: 401 });
  const { submissionId } = await params;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SIZE + 1024 * 1024) return NextResponse.json({ error: "The upload request is too large." }, { status: 413 });
  const submission = await prisma.researchSubmission.findFirst({ where: { id: submissionId, researcherId: actor.id }, include: { call: { select: { acceptedFileTypes: true } } } });
  if (!submission || submission.status !== "SUBMITTED") return NextResponse.json({ error: "Documents can only be added to an active submitted version." }, { status: 409 });
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a document to upload." }, { status: 400 });
  if (file.size < 1 || file.size > MAX_SIZE) return NextResponse.json({ error: "Documents must be smaller than 20 MB." }, { status: 413 });
  const latestVersion = await prisma.submissionVersion.findUnique({ where: { submissionId_round: { submissionId, round: submission.currentRound } } });
  if (!latestVersion) return NextResponse.json({ error: "The current submission version is unavailable." }, { status: 409 });
  const existingFiles = await prisma.submissionDocument.findMany({ where: { versionId: latestVersion.id }, select: { byteSize: true } });
  if (existingFiles.length >= MAX_FILES_PER_VERSION || existingFiles.reduce((sum, item) => sum + item.byteSize, 0) + file.size > MAX_VERSION_BYTES) return NextResponse.json({ error: "Each version can include up to five documents and 50 MB total." }, { status: 413 });
  const extension = file.name.split(".").pop()?.toLowerCase();
  const expected = extension === "pdf" ? "application/pdf" : extension === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : extension === "doc" ? "application/msword" : "";
  if (!expected || !submission.call.acceptedFileTypes.includes(expected)) return NextResponse.json({ error: "This document type is not accepted by the call." }, { status: 415 });
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!(extension === "pdf" ? isPdf(buffer) : extension === "docx" ? isDocx(buffer) : buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])))) return NextResponse.json({ error: "The document contents do not match its file type." }, { status: 400 });
  const objectKey = `submissions/${submissionId}/${randomUUID()}.${extension}`;
  const originalName = file.name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 240);
  if (!originalName) return NextResponse.json({ error: "The file name is invalid." }, { status: 400 });
  const checksum = createHash("sha256").update(buffer).digest("hex");
  let stored = false;
  try {
    await getStorageClient().send(new PutObjectCommand({ Bucket: getDocumentBucket(), Key: objectKey, Body: buffer, ContentType: expected, Metadata: { sha256: checksum } }));
    stored = true;
    const document = await prisma.$transaction(async (tx) => {
      const currentSubmission = await tx.researchSubmission.findFirst({ where: { id: submissionId, researcherId: actor.id, status: "SUBMITTED", currentRound: submission.currentRound }, select: { id: true } });
      if (!currentSubmission) throw new Error("UPLOAD_CLOSED");
      const currentFiles = await tx.submissionDocument.findMany({ where: { versionId: latestVersion.id }, select: { byteSize: true } });
      if (currentFiles.length >= MAX_FILES_PER_VERSION || currentFiles.reduce((sum, item) => sum + item.byteSize, 0) + buffer.length > MAX_VERSION_BYTES) throw new Error("UPLOAD_LIMIT");
      const saved = await tx.submissionDocument.create({ data: { submissionId, versionId: latestVersion.id, originalName, objectKey, mimeType: expected, byteSize: buffer.length, checksum } });
      await tx.workflowEvent.create({ data: { submissionId, actorId: actor.id, eventType: "DOCUMENT_UPLOADED", detail: { documentId: saved.id, round: submission.currentRound } } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: "SUBMISSION_DOCUMENT_UPLOADED", resourceType: "SubmissionDocument", resourceId: saved.id, detail: { submissionId, byteSize: saved.byteSize, mimeType: saved.mimeType, checksum } } });
      return saved;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ id: document.id, originalName: document.originalName, byteSize: document.byteSize }, { status: 201 });
  } catch (error) {
    console.error("Document upload failed", error instanceof Error ? error.name : "unknown");
    if (stored) {
      try { await getStorageClient().send(new DeleteObjectCommand({ Bucket: getDocumentBucket(), Key: objectKey })); }
      catch { console.error("Orphan document cleanup failed"); }
    }
    if (error instanceof Error && error.message === "UPLOAD_CLOSED") return NextResponse.json({ error: "The current version has moved into review and no longer accepts documents." }, { status: 409 });
    if (error instanceof Error && error.message === "UPLOAD_LIMIT") return NextResponse.json({ error: "Each version can include up to five documents and 50 MB total." }, { status: 413 });
    return NextResponse.json({ error: "Document storage is unavailable. Contact the research office." }, { status: 503 });
  }
}

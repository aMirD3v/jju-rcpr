import { S3Client } from "@aws-sdk/client-s3";

const usingR2 = Boolean(process.env.R2_ACCESS_KEY_ID);
export const documentBucket = usingR2 ? process.env.R2_BUCKET_NAME : process.env.MINIO_BUCKET;

export function getStorageClient() {
  if (!documentBucket) throw new Error("Document storage bucket is not configured.");
  if (usingR2) {
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_SECRET_ACCESS_KEY) throw new Error("Cloudflare R2 credentials are incomplete.");
    return new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! } });
  }
  if (!process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY) throw new Error("MinIO credentials are not configured.");
  const endpoint = process.env.MINIO_ENDPOINT || "localhost";
  const port = process.env.MINIO_PORT || "9000";
  const useSSL = process.env.MINIO_USE_SSL === "true";
  return new S3Client({ region: "us-east-1", endpoint: `${useSSL ? "https" : "http"}://${endpoint}:${port}`, forcePathStyle: true, credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY, secretAccessKey: process.env.MINIO_SECRET_KEY } });
}

export function getDocumentBucket() {
  if (!documentBucket) throw new Error("Document storage bucket is not configured.");
  return documentBucket;
}

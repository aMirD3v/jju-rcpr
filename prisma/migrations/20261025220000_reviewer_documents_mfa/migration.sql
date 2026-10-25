ALTER TABLE "User"
ADD COLUMN "reviewerExpertise" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "maxActiveAssignments" INTEGER,
ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mfaSecretEncrypted" TEXT;

CREATE TABLE "CallDocumentRequirement" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CallDocumentRequirement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CallDocumentRequirement_callId_position_key" ON "CallDocumentRequirement"("callId", "position");
CREATE INDEX "CallDocumentRequirement_callId_idx" ON "CallDocumentRequirement"("callId");

ALTER TABLE "CallDocumentRequirement"
ADD CONSTRAINT "CallDocumentRequirement_callId_fkey"
FOREIGN KEY ("callId") REFERENCES "ResearchCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubmissionDocument"
ADD COLUMN "requirementId" TEXT;

ALTER TABLE "SubmissionDocument"
ADD CONSTRAINT "SubmissionDocument_requirementId_fkey"
FOREIGN KEY ("requirementId") REFERENCES "CallDocumentRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MfaRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MfaRecoveryCode_tokenHash_key" ON "MfaRecoveryCode"("tokenHash");
CREATE INDEX "MfaRecoveryCode_userId_usedAt_idx" ON "MfaRecoveryCode"("userId", "usedAt");

ALTER TABLE "MfaRecoveryCode"
ADD CONSTRAINT "MfaRecoveryCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

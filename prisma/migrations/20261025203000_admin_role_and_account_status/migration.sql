ALTER TYPE "Role" ADD VALUE 'ADMIN';

ALTER TABLE "User"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

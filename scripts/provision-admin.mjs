import { randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const { DATABASE_URL, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_NAME, INITIAL_ADMIN_INSTITUTION, INITIAL_ADMIN_PASSWORD } = process.env;
if (![DATABASE_URL, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_NAME, INITIAL_ADMIN_PASSWORD].every(Boolean)) {
  throw new Error("Set DATABASE_URL, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_NAME, and INITIAL_ADMIN_PASSWORD in the private environment before provisioning.");
}
if (INITIAL_ADMIN_PASSWORD.length < 16 || !/[A-Za-z]/.test(INITIAL_ADMIN_PASSWORD) || !/[0-9]/.test(INITIAL_ADMIN_PASSWORD)) {
  throw new Error("Initial administrator password must be at least 16 characters and include a letter and a number.");
}

const email = INITIAL_ADMIN_EMAIL.toLowerCase();
const salt = randomBytes(16).toString("hex");
const passwordHash = `scrypt:${salt}:${scryptSync(INITIAL_ADMIN_PASSWORD, salt, 64).toString("hex")}`;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
try {
  const account = await prisma.$transaction(async (tx) => {
    if (await tx.user.count({ where: { role: "ADMIN" } })) throw new Error("An administrator already exists. No account was changed.");
    if (await tx.user.findUnique({ where: { email }, select: { id: true } })) throw new Error("An account with that email already exists. No account was changed.");
    const user = await tx.user.create({ data: { email, name: INITIAL_ADMIN_NAME, institution: INITIAL_ADMIN_INSTITUTION || null, role: "ADMIN", emailVerifiedAt: new Date(), passwordHash, passwordResetRequired: true }, select: { id: true, email: true } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "INITIAL_ADMIN_PROVISIONED", resourceType: "User", resourceId: user.id } });
    return user;
  }, { isolationLevel: "Serializable" });
  console.log(`Initial system administrator created for ${account.email}. Sign in and change the temporary password immediately.`);
} finally {
  await prisma.$disconnect();
}

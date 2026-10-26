import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export async function verifyCredentials(emailInput: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: emailInput.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      institution: true,
      passwordHash: true,
      emailVerifiedAt: true,
      isActive: true,
      failedLoginAttempts: true,
      lockoutUntil: true,
      mfaEnabled: true,
      mfaSecretEncrypted: true,
      passwordResetRequired: true,
      sessionVersion: true,
    },
  });
  if (!user?.passwordHash || !user.emailVerifiedAt || !user.isActive) {
    return { status: "INVALID" as const };
  }
  if (user.lockoutUntil && user.lockoutUntil > new Date()) {
    return { status: "LOCKED" as const };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    await recordFailedLogin(user.id, user.failedLoginAttempts);
    return { status: "INVALID" as const };
  }
  return { status: "VALID" as const, user };
}

export async function recordFailedLogin(userId: string, attempts: number) {
  const failedLoginAttempts = attempts + 1;
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts,
      lockoutUntil:
        failedLoginAttempts >= 5
          ? new Date(Date.now() + 15 * 60 * 1000)
          : null,
    },
  });
}

export async function clearFailedLogins(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockoutUntil: null },
  });
}

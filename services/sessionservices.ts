import crypto from "node:crypto";
import prisma from "@/lib/prisma";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const IDLE_TIMEOUT_MS = HOUR_MS;
const ABSOLUTE_TIMEOUT_MS = 8 * HOUR_MS;
const REFRESH_THRESHOLD_MS = 15 * MINUTE_MS;

export function hashSessionToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(
    Date.now() + Math.min(IDLE_TIMEOUT_MS, ABSOLUTE_TIMEOUT_MS),
  );

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function getSessionByToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const now = new Date();
  const nowMs = now.getTime();
  const tokenHash = hashSessionToken(token);

  const session = await prisma.session.findUnique({
    where: {
      tokenHash,
      expiresAt: { gt: now },
    },
    include: {
      user: {
        select: { id: true, email: true, role: true, deletedAt: true },
      },
    },
  });

  if (!session || session.user.deletedAt) {
    return null;
  }

  const remainingMs = session.expiresAt.getTime() - nowMs;
  const absoluteMaxExpiresAtMs =
    session.createdAt.getTime() + ABSOLUTE_TIMEOUT_MS;

  let expiresAt = session.expiresAt;
  let touched = false;

  if (remainingMs <= REFRESH_THRESHOLD_MS) {
    const nextExpiresAtMs = Math.min(
      nowMs + IDLE_TIMEOUT_MS,
      absoluteMaxExpiresAtMs,
    );

    if (nextExpiresAtMs > session.expiresAt.getTime()) {
      const updated = await prisma.session.update({
        where: { id: session.id },
        data: { expiresAt: new Date(nextExpiresAtMs) },
        select: { expiresAt: true },
      });

      expiresAt = updated.expiresAt;
      touched = true;
    }
  }

  return {
    session,
    user: session.user,
    expiresAt,
    touched,
  };
}

export async function deleteSession(token: string | undefined) {
  if (!token) {
    return;
  }

  const tokenHash = hashSessionToken(token);

  await prisma.session.deleteMany({
    where: { tokenHash },
  });
}
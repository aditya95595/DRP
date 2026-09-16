import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function ensureGuild(guildId: string, name?: string) {
  return prisma.guild.upsert({
    where: { id: guildId },
    update: name ? { name } : {},
    create: { id: guildId, name },
  });
}

export async function writeAudit(guildId: string, actorId: string | null, action: string, target?: string, metadata: Record<string, unknown> = {}) {
  return prisma.auditLog.create({
    data: { guildId, actorId, action, target, metadata: JSON.parse(JSON.stringify(metadata)) },
  });
}

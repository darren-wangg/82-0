/**
 * Prisma client singleton (Prisma 7, driver-adapter mode with @prisma/adapter-pg).
 * Cached on globalThis in dev so hot reloads don't exhaust connections.
 *
 * No live Postgres exists yet — the client only connects on first query, so
 * importing this module is safe at build time. Once DATABASE_URL points at a
 * real database, run `npx prisma migrate dev` to create the schema.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://placeholder@localhost:5432/x",
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type Db = typeof prisma;

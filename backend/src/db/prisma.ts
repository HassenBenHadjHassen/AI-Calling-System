import { PrismaClient } from "@prisma/client";

// Ensure a single PrismaClient instance across the app (useful for dev with HMR)
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
	globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}

export default prisma;

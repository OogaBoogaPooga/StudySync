import { PrismaClient } from '@prisma/client';

// Single shared Prisma instance (avoids exhausting SQLite connections during dev reloads)
export const prisma = globalThis.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma;

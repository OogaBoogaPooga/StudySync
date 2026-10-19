import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const adapter = new PrismaLibSQL(libsql);

// Single shared Prisma instance (avoids exhausting connections during dev reloads)
export const prisma = globalThis.__prisma || new PrismaClient({ adapter });
if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma;

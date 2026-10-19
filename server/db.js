import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const adapter = new PrismaLibSql(libsql);

export const prisma = globalThis.__prisma || new PrismaClient({ adapter });
if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma;

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPrismaClient() {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to the database.");
  }

  const client = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });
  // Un seul client par process (évite d'ouvrir un pool à chaque rechargement HMR en dev).
  globalForPrisma.prisma = client;
  return client;
}

/** Créé au premier accès : importer ce module ne requiert pas DATABASE_URL. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

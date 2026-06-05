import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "@/lib/generated/prisma/client";

/** Increment after schema changes so dev HMR drops a cached PrismaClient. */
const PRISMA_SCHEMA_REVISION = 2;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaRevision?: number;
};

function createPrismaClient(databaseUrl: string) {
  const adapter = new PrismaMariaDb(databaseUrl);
  return new PrismaClient({ adapter });
}

function assetAssignmentHasExpectedReturn(
  client: PrismaClient,
): boolean | null {
  const fields = (
    client as {
      _runtimeDataModel?: {
        models?: { AssetAssignment?: { fields?: { name: string }[] } };
      };
    }
  )._runtimeDataModel?.models?.AssetAssignment?.fields;

  if (!fields) {
    return null;
  }

  return fields.some((field) => field.name === "expectedReturnAt");
}

/** Dev HMR can keep an outdated client after `prisma generate` — recreate if delegates/fields are missing. */
function isPrismaClientStale(client: PrismaClient) {
  if (!("supplier" in client)) {
    return true;
  }

  const hasExpectedReturn = assetAssignmentHasExpectedReturn(client);
  if (hasExpectedReturn === false) {
    return true;
  }

  if (process.env.NODE_ENV !== "production") {
    return globalForPrisma.prismaSchemaRevision !== PRISMA_SCHEMA_REVISION;
  }

  return false;
}

function getPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to the database.");
  }

  const cached = globalForPrisma.prisma;
  if (cached && !isPrismaClientStale(cached)) {
    return cached;
  }

  const client = createPrismaClient(databaseUrl);
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaSchemaRevision = PRISMA_SCHEMA_REVISION;
  }
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, receiver);

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },
});

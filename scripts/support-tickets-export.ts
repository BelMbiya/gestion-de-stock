/**
 * Lot 5 : sauvegarde les tickets d'assistance (et leurs mises a jour) avant la suppression des tables.
 * Lecture seule sur la base ; ecrit backups/support-tickets-AAAA-MM-JJ.json (dossier ignore par git).
 *
 *   npm run db:support-export
 */
import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../lib/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL est requis.");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });

type Row = Record<string, unknown>;

async function tableExists(table: string) {
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    table,
  );
  return rows.length > 0;
}

async function main() {
  if (!(await tableExists("SupportTicket"))) {
    console.log("Table SupportTicket absente : migration deja appliquee, rien a exporter.");
    return;
  }

  // Les modeles ne sont plus dans le client Prisma : lecture brute des tables.
  const tickets = await prisma.$queryRawUnsafe<Row[]>("SELECT * FROM `SupportTicket` ORDER BY `openedAt`");
  const updates = await prisma.$queryRawUnsafe<Row[]>("SELECT * FROM `SupportTicketUpdate` ORDER BY `createdAt`");

  const dir = path.resolve(__dirname, "..", "backups");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `support-tickets-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(
    file,
    JSON.stringify({ exportedAt: new Date().toISOString(), tickets, updates }, null, 2),
    "utf8",
  );

  console.log(`${tickets.length} ticket(s) et ${updates.length} mise(s) a jour sauvegardes dans ${path.relative(process.cwd(), file)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * Rapport a blanc du lot 5 (suppression Assistance IT + revocation d'acces User.active). Lecture seule.
 * Fonctionne avant comme apres la migration ; apres migration, « changements » doit valoir 0.
 *
 *   npm run db:lot5-report
 */
import "dotenv/config";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../lib/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL est requis.");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });

type Row = Record<string, unknown>;
const MANAGER_ROLES = new Set(["ADMIN", "IT_MANAGER"]);

async function exists(table: string, column?: string) {
  const rows = column
    ? await prisma.$queryRawUnsafe<Row[]>(
        "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
        table,
        column,
      )
    : await prisma.$queryRawUnsafe<Row[]>(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
        table,
      );
  return rows.length > 0;
}

async function count(sql: string) {
  const [row] = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(sql);
  return Number(row.n);
}

function latestBackup() {
  const dir = path.resolve(__dirname, "..", "backups");
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).filter((name) => /^support-tickets-.*\.json$/.test(name)).sort().pop();
  if (!file) return null;
  const content = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as { tickets: unknown[]; updates: unknown[] };
  return { file, tickets: content.tickets.length, updates: content.updates.length };
}

async function main() {
  const hasTickets = await exists("SupportTicket");
  const hasActive = await exists("User", "active");
  const lines: string[] = [];
  let changes = 0;
  let blocking = 0;

  lines.push("# Rapport a blanc — lot 5", "");
  lines.push(`Etat : ${hasTickets || !hasActive ? "migration a appliquer" : "migration appliquee"}`, "");

  // 1. Tickets d'assistance
  lines.push("## Tickets d'assistance (tables supprimees)");
  if (hasTickets) {
    const tickets = await prisma.$queryRawUnsafe<Row[]>(
      "SELECT `reference`, `title`, `status`, `category`, DATE_FORMAT(`openedAt`, '%d/%m/%Y') AS opened FROM `SupportTicket` ORDER BY `openedAt`",
    );
    const updates = await count("SELECT COUNT(*) AS n FROM `SupportTicketUpdate`");
    changes += tickets.length + updates;
    lines.push(`- ${tickets.length} ticket(s), ${updates} mise(s) a jour seront supprimes :`);
    for (const ticket of tickets) {
      lines.push(`  - ${ticket.reference} « ${ticket.title} » — ${ticket.category}, ${ticket.status}, ouvert le ${ticket.opened}`);
    }
    const backup = latestBackup();
    if (!backup) {
      lines.push("- Sauvegarde JSON : ABSENTE (lancer `npm run db:support-export` avant la migration)");
    } else {
      const complete = backup.tickets === tickets.length && backup.updates === updates;
      lines.push(
        `- Sauvegarde JSON : backups/${backup.file} (${backup.tickets} ticket(s), ${backup.updates} mise(s) a jour)${complete ? " — complete" : " — INCOMPLETE, a refaire"}`,
      );
    }
  } else {
    lines.push("- Tables deja supprimees.");
  }
  lines.push("");

  // 2. Journal d'audit : la valeur d'enum retiree ne doit plus etre utilisee
  const auditBlocking = await count("SELECT COUNT(*) AS n FROM `AuditLog` WHERE `action` = 'SUPPORT_TICKET_UPDATE'");
  blocking += auditBlocking;
  lines.push("## Journal d'audit");
  lines.push(`- Lignes SUPPORT_TICKET_UPDATE : ${auditBlocking}${auditBlocking ? " — BLOQUANT (la migration echouerait)" : " (valeur retiree sans perte)"}`);
  lines.push("");

  // 3. Comptes
  const users = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT \`role\`, ${hasActive ? "`active`" : "1"} AS active, \`firebaseUid\` FROM \`User\``,
  );
  const byRole = new Map<string, number>();
  for (const user of users) byRole.set(String(user.role), (byRole.get(String(user.role)) ?? 0) + 1);
  const activeManagers = users.filter((user) => MANAGER_ROLES.has(String(user.role)) && Number(user.active) === 1).length;
  const pending = users.filter((user) => /^(tech-|pending:)/.test(String(user.firebaseUid))).length;
  if (!hasActive) changes += 1;
  if (activeManagers === 0) blocking += 1;

  lines.push("## Comptes (User.active)");
  lines.push(`- Colonne active : ${hasActive ? "presente" : "a ajouter — tous les comptes restent actifs (defaut true)"}`);
  lines.push(`- ${users.length} compte(s) : ${[...byRole].map(([role, n]) => `${role} ${n}`).join(", ")}`);
  lines.push(`- Gestionnaires actifs (Admin / Manager IT) : ${activeManagers}${activeManagers ? "" : " — BLOQUANT"}`);
  lines.push(`- Comptes jamais connectes (uid provisoire) : ${pending} — ils se relient par email verifie, sans impact`);
  lines.push("");

  // 4. Donnees metier : aucune modification attendue
  const [assets, assignments, holders, movements, incidents] = await Promise.all([
    count("SELECT COUNT(*) AS n FROM `Asset`"),
    count("SELECT COUNT(*) AS n FROM `AssetAssignment`"),
    count("SELECT COUNT(*) AS n FROM `Holder`"),
    count("SELECT COUNT(*) AS n FROM `StockMovement`"),
    count("SELECT COUNT(*) AS n FROM `Incident`"),
  ]);
  lines.push("## Donnees metier (inchangees)");
  lines.push(`- Materiel ${assets} · affectations ${assignments} · detenteurs ${holders} · mouvements ${movements} · pannes ${incidents}`);
  lines.push("");

  lines.push(`**Changements : ${changes}** · **Bloquants : ${blocking}**`);
  console.log(lines.join("\n"));
  if (blocking) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * Rapport a blanc de la migration du lot 3 (mode de suivi + detenteurs).
 * Lecture seule : aucune ecriture en base. Fonctionne avant comme apres la migration
 * (colonnes absentes lues comme vides) ; apres migration, « changements » doit valoir 0.
 *
 *   npm run db:migration-report            -> rapport dans la console
 *   npm run db:migration-report -- out.md  -> rapport aussi ecrit dans un fichier
 */
import "dotenv/config";

import { writeFileSync } from "node:fs";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../lib/generated/prisma/client";
import {
  type MigrationSnapshot,
  planTrackingAndHoldersMigration,
  trackingModeForGroup,
} from "../lib/migrations/tracking-and-holders";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL est requis.");
}
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });

type Row = Record<string, unknown>;

async function columnExists(table: string, column: string) {
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND LOWER(table_name) = LOWER(?) AND column_name = ?",
    table,
    column,
  );
  return rows.length > 0;
}

async function tableExists(table: string) {
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND LOWER(table_name) = LOWER(?)",
    table,
  );
  return rows.length > 0;
}

const text = (value: unknown) => (value === null || value === undefined ? null : String(value));

async function main() {
  const [hasTracking, hasHolderId, hasKind, hasHolders] = await Promise.all([
    columnExists("Asset", "trackingMode"),
    columnExists("AssetAssignment", "holderId"),
    columnExists("AssetAssignment", "kind"),
    tableExists("Holder"),
  ]);

  const assets = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT id, sku, name, assetGroup, custodianName, processLabel, status, quantityOnHand,
            ${hasTracking ? "trackingMode" : "NULL AS trackingMode"}
     FROM \`Asset\``,
  );
  const assignments = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT id, assetId, status, ${hasHolderId ? "holderId" : "NULL AS holderId"}, ${hasKind ? "kind" : "NULL AS kind"}
     FROM \`AssetAssignment\``,
  );
  const holders = hasHolders
    ? await prisma.$queryRawUnsafe<Row[]>("SELECT id, fullName, type FROM `Holder`")
    : [];

  const snapshot: MigrationSnapshot = {
    assets: assets.map((a) => ({
      id: String(a.id),
      assetGroup: text(a.assetGroup),
      custodianName: text(a.custodianName),
      processLabel: text(a.processLabel),
      status: String(a.status),
      trackingMode: text(a.trackingMode),
    })),
    assignments: assignments.map((x) => ({
      id: String(x.id),
      assetId: String(x.assetId),
      status: String(x.status),
      holderId: text(x.holderId),
      kind: text(x.kind),
    })),
    holders: holders.map((h) => ({ id: String(h.id), fullName: String(h.fullName), type: String(h.type) })),
  };

  const plan = planTrackingAndHoldersMigration(snapshot);
  const assetById = new Map(assets.map((a) => [String(a.id), a]));
  const assetsPerHolder = new Map<string, number>();
  for (const link of plan.assignmentLinks) {
    assetsPerHolder.set(link.holderKey, (assetsPerHolder.get(link.holderKey) ?? 0) + 1);
  }

  const persons = plan.holdersToCreate.filter((h) => h.type === "PERSON");
  const collectives = plan.holdersToCreate.filter((h) => h.type === "COLLECTIVE");
  const bulkAssets = assets
    .filter((a) => trackingModeForGroup(text(a.assetGroup)) === "BULK")
    .sort((a, b) => Number(b.quantityOnHand) - Number(a.quantityOnHand));

  const lines: string[] = [];
  const out = (line = "") => lines.push(line);

  out("# Rapport a blanc — migration lot 3 (mode de suivi et detenteurs)");
  out();
  out(`Base : ${new URL(databaseUrl!).pathname.slice(1)} · etat du schema : ${hasTracking ? "migration A deja appliquee" : "avant migration"}`);
  out();
  out("## Synthese");
  out(`- Actifs : ${assets.length} -> ${plan.summary.serialized} unitaires, ${plan.summary.bulk} en vrac`);
  out(
    hasTracking
      ? `- Changements de mode : ${plan.assetModes.length}`
      : `- Mode de suivi a poser : colonne absente, ${plan.summary.serialized} resteront unitaires (valeur par defaut), ${plan.summary.bulk} passeront en vrac`,
  );
  out(`- Detenteurs a creer : ${plan.summary.holders} (${persons.length} personnes, ${collectives.length} collectifs)`);
  out(`- Affectations a relier (dotations) : ${plan.summary.dotations} sur ${assignments.length}`);
  out(`- Anomalies a corriger a la main : ${plan.summary.anomalies}`);
  out(`- Total des changements : ${plan.summary.changes}`);
  out(`- Mouvements de stock crees : 0 · totaux inchanges (${assets.length} actifs, ${assignments.length} affectations)`);
  out();
  out("## Detenteurs collectifs");
  for (const h of collectives) out(`- ${h.fullName} : ${assetsPerHolder.get(h.key) ?? 0} materiel(s)`);
  out();
  out("## Personnes detenant le plus de materiel");
  for (const h of [...persons].sort((a, b) => (assetsPerHolder.get(b.key) ?? 0) - (assetsPerHolder.get(a.key) ?? 0)).slice(0, 10)) {
    out(`- ${h.fullName} : ${assetsPerHolder.get(h.key) ?? 0} materiel(s)${h.process ? ` · process ${h.process}` : ""}`);
  }
  out(`- ... et ${Math.max(0, persons.length - 10)} autres personnes`);
  out();
  out(`## Articles en vrac (${bulkAssets.length})`);
  for (const a of bulkAssets) out(`- ${a.name} (${a.sku}) : ${a.quantityOnHand} · ${a.assetGroup}`);
  out();
  out("## Anomalies");
  for (const anomaly of plan.anomalies) {
    const asset = assetById.get(anomaly.assetId);
    out(`- [${anomaly.type}] ${asset?.name ?? "?"} (${asset?.sku ?? anomaly.assetId}) — ${anomaly.detail}`);
  }
  if (plan.anomalies.length === 0) out("- aucune");

  const report = lines.join("\n");
  console.log(report);

  const target = process.argv[2];
  if (target) {
    writeFileSync(target, `${report}\n`);
    console.log(`\nRapport ecrit dans ${target}`);
  }
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

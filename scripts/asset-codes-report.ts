/**
 * Rapport a blanc de la migration du lot 4 (types, familles, codes MS-0001…). Lecture seule.
 * Fonctionne avant comme apres la migration ; apres migration, « changements » doit valoir 0.
 *
 *   npm run db:codes-report                       -> rapport dans la console
 *   npm run db:codes-report -- rapport.md codes.tsv -> rapport + table « ref. import -> code »
 */
import "dotenv/config";

import { writeFileSync } from "node:fs";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../lib/generated/prisma/client";
import { KYC_TYPE_OVERRIDES } from "../lib/catalog/type-overrides";
import { findAssetTypeDefinition } from "../lib/catalog/asset-type-catalog";
import { type CodesMigrationSnapshot, planAssetCodesMigration } from "../lib/migrations/asset-codes";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL est requis.");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });

type Row = Record<string, unknown>;
const text = (value: unknown) => (value === null || value === undefined ? null : String(value));

async function exists(table: string, column?: string) {
  const rows = column
    ? await prisma.$queryRawUnsafe<Row[]>(
        "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND LOWER(table_name) = LOWER(?) AND column_name = ?",
        table,
        column,
      )
    : await prisma.$queryRawUnsafe<Row[]>(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND LOWER(table_name) = LOWER(?)",
        table,
      );
  return rows.length > 0;
}

async function main() {
  const [hasTypes, hasImportRef] = await Promise.all([exists("AssetType"), exists("Asset", "importRef")]);

  const assets = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT a.id, a.sku, ${hasImportRef ? "a.importRef" : "NULL AS importRef"}, a.name, a.trackingMode, a.status, a.serialNumber,
            ${hasTypes ? "t.prefix" : "NULL"} AS typePrefix, c.name AS categoryName,
            EXISTS (SELECT 1 FROM \`AssetAssignment\` x WHERE x.assetId = a.id AND x.status = 'ACTIVE') AS hasActiveAssignment
     FROM \`Asset\` a
     JOIN \`Category\` c ON c.id = a.categoryId
     ${hasTypes ? "LEFT JOIN `AssetType` t ON t.id = a.typeId" : ""}`,
  );
  const categories = await prisma.$queryRawUnsafe<Row[]>("SELECT id, name FROM `Category`");
  const types = hasTypes ? await prisma.$queryRawUnsafe<Row[]>("SELECT prefix, nextNumber FROM `AssetType`") : [];

  const snapshot: CodesMigrationSnapshot = {
    assets: assets.map((a) => ({
      id: String(a.id),
      sku: String(a.sku),
      importRef: text(a.importRef),
      name: String(a.name),
      trackingMode: String(a.trackingMode),
      status: String(a.status),
      serialNumber: text(a.serialNumber),
      typePrefix: text(a.typePrefix),
      hasActiveAssignment: Number(a.hasActiveAssignment) === 1,
      categoryName: String(a.categoryName),
    })),
    categories: categories.map((c) => ({ id: String(c.id), name: String(c.name) })),
    types: types.map((t) => ({ prefix: String(t.prefix), nextNumber: Number(t.nextNumber) })),
  };

  const plan = planAssetCodesMigration(snapshot, KYC_TYPE_OVERRIDES);
  const lines: string[] = [];
  const out = (line = "") => lines.push(line);

  out("# Rapport a blanc — migration lot 4 (types, familles, codes materiel)");
  out();
  out(`Base : ${new URL(databaseUrl!).pathname.slice(1)} · etat : ${hasTypes ? "migration deja appliquee" : "avant migration"}`);
  out();
  out("## Synthese");
  out(`- Materiels : ${plan.summary.assetsBefore} -> ${plan.summary.assetsAfter} (${plan.summary.splits} lignes multiples decoupees, ${plan.summary.newAssets} nouvelles fiches)`);
  out(`- Codes attribues : ${plan.summary.coded}`);
  out(`- Sans type : ${plan.summary.unclassified}${plan.blocking ? " — **MIGRATION BLOQUEE** (etape B refusee)" : ""}`);
  out(`- Familles a creer : ${plan.familiesToCreate.join(", ") || "aucune"}`);
  out(`- Categories renommees : ${plan.categoriesToRename.map((c) => `${c.from} -> ${c.to}`).join(", ") || "aucune"}`);
  out(`- Anciennes categories retirees : ${plan.categoriesToRemove.join(", ") || "aucune"}`);
  out(`- Total des changements : ${plan.summary.changes}`);
  out();

  if (plan.unclassified.length > 0) {
    out("## Materiels sans type (a fixer dans lib/catalog/type-overrides.ts et la migration)");
    for (const item of plan.unclassified) out(`- ${item.name} (${item.sku})`);
    out();
  }

  out("## Codes par type");
  const byPrefix = new Map<string, typeof plan.codes>();
  for (const code of plan.codes) byPrefix.set(code.prefix, [...(byPrefix.get(code.prefix) ?? []), code]);
  for (const [prefix, codes] of [...byPrefix].sort((a, b) => b[1].length - a[1].length)) {
    const type = findAssetTypeDefinition(prefix)!;
    const first = codes[0];
    const last = codes[codes.length - 1];
    out(
      `- ${prefix.padEnd(4)} ${type.name} (${type.family}) : ${codes.length} — ${first.code} = ${first.name} [${first.importRef}]` +
        (codes.length > 1 ? ` … ${last.code} = ${last.name} [${last.importRef}]` : ""),
    );
  }
  out();
  out("## Lignes multiples decoupees");
  for (const split of plan.splits) out(`- ${split.sku} « ${split.count} ${split.baseName} » -> ${split.count} fiches « ${split.baseName} »`);
  if (plan.splits.length === 0) out("- aucune");
  out();
  out("## Anomalies");
  for (const anomaly of plan.anomalies) out(`- ${anomaly.sku} — ${anomaly.detail}`);
  if (plan.anomalies.length === 0) out("- aucune");

  const report = lines.join("\n");
  console.log(report);

  const [reportFile, mappingFile] = process.argv.slice(2);
  if (reportFile) writeFileSync(reportFile, `${report}\n`);
  if (mappingFile) {
    const rows = plan.codes.map((code) => [code.importRef, code.code, code.name, code.prefix, code.family].join("\t"));
    writeFileSync(mappingFile, `ref_import\tcode\tnom\ttype\tfamille\n${rows.join("\n")}\n`);
    console.log(`\nTable des codes : ${mappingFile} (${rows.length} lignes)`);
  }
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

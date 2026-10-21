/**
 * Sauvegarde complete de la base (mysqldump) dans backups/ (dossier ignore par Git : donnees reelles).
 *
 *   npm run db:backup
 *
 * Restauration : mysql -u <user> -p <base> < backups/<fichier>.sql
 * MYSQLDUMP_PATH permet d'indiquer l'executable s'il n'est pas dans le PATH.
 */
import "dotenv/config";

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL est requis.");
}

const url = new URL(databaseUrl);
const database = url.pathname.slice(1);
const windowsDefault = "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe";
const executable =
  process.env.MYSQLDUMP_PATH ?? (process.platform === "win32" && existsSync(windowsDefault) ? windowsDefault : "mysqldump");

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const directory = path.join(process.cwd(), "backups");
mkdirSync(directory, { recursive: true });
const file = path.join(directory, `${database}-${stamp}.sql`);

const result = spawnSync(
  executable,
  [
    `--host=${url.hostname}`,
    `--port=${url.port || "3306"}`,
    `--user=${decodeURIComponent(url.username)}`,
    "--single-transaction",
    "--routines",
    "--triggers",
    "--default-character-set=utf8mb4",
    `--result-file=${file}`,
    database,
  ],
  // Mot de passe par variable d'environnement : jamais sur la ligne de commande.
  { env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) }, encoding: "utf8" },
);

if (result.error || result.status !== 0) {
  console.error(result.error?.message ?? result.stderr);
  process.exit(1);
}

console.log(`Sauvegarde : ${file} (${Math.round(statSync(file).size / 1024)} Ko)`);

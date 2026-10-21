// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const relative = (file: string) => path.relative(root, file).replaceAll("\\", "/");
const source = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const stockRoutes = ["app/api/stock", "app/api/assignments", "app/api/holders"]
  .flatMap((dir) => walk(path.join(root, dir)))
  .filter((file) => file.endsWith("route.ts"));

describe("Garde-fou : l'auteur d'une action vient de la session, jamais du client", () => {
  it("couvre les routes stock, affectations et detenteurs", () => {
    expect(stockRoutes.map(relative)).toEqual(
      expect.arrayContaining(["app/api/holders/route.ts", "app/api/stock/[id]/status/route.ts"]),
    );
  });

  it("aucune de ces routes ne lit un auteur dans le corps de la requete", () => {
    const offenders = stockRoutes.filter((file) =>
      /body\.(performedById|issuedById|returnedById|actorId|assignedToId)\b/.test(readFileSync(file, "utf8")),
    );

    expect(offenders.map(relative)).toEqual([]);
  });
});

describe("Garde-fou : la fiche article passe par les verrous metier", () => {
  it("PATCH verifie les champs modifiables et DELETE verifie l'historique", () => {
    const route = source("app/api/stock/[id]/route.ts");

    expect(route).toMatch(/assertEditableFields\(/);
    expect(route).toMatch(/assertAssetDeletable\(/);
  });

  it("les mouvements passent par le service atomique (plus d'ecriture directe de quantite)", () => {
    // Seule la creation d'article (app/api/stock/route.ts) fixe une quantite initiale.
    const offenders = stockRoutes
      .filter((file) => relative(file) !== "app/api/stock/route.ts")
      .filter((file) => /quantityOnHand:\s*(?!\{)/.test(readFileSync(file, "utf8")));

    expect(offenders.map(relative)).toEqual([]);
    expect(source("app/api/stock/movements/route.ts")).toMatch(/recordStockMovement\(/);
  });
});

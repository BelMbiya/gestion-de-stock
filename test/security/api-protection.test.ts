// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const HTTP_METHODS = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function relative(file: string) {
  return path.relative(root, file).replaceAll("\\", "/");
}

const routeFiles = walk(path.join(root, "app", "api")).filter((file) =>
  file.endsWith("route.ts"),
);

describe("Garde-fou : toutes les routes API sont protegees par withAuth", () => {
  it("trouve des routes a verifier", () => {
    expect(routeFiles.length).toBeGreaterThan(20);
  });

  it("n'expose aucun handler HTTP declare en function (non enveloppe)", () => {
    const offenders = routeFiles.filter((file) =>
      new RegExp(`export\\s+(async\\s+)?function\\s+(${HTTP_METHODS})\\b`).test(
        readFileSync(file, "utf8"),
      ),
    );

    expect(offenders.map(relative)).toEqual([]);
  });

  it("enveloppe chaque handler exporte dans withAuth(...)", () => {
    const offenders: string[] = [];

    for (const file of routeFiles) {
      const source = readFileSync(file, "utf8");
      const exported = [
        ...source.matchAll(new RegExp(`export\\s+const\\s+(${HTTP_METHODS})\\s*=\\s*([^\\n]*)`, "g")),
      ];

      if (exported.length === 0) {
        offenders.push(`${relative(file)} (aucun handler withAuth)`);
      }

      for (const [, method, rhs] of exported) {
        if (!rhs.trimStart().startsWith("withAuth(")) {
          offenders.push(`${relative(file)} ${method}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("importe le vrai withAuth (pas une implementation locale)", () => {
    const offenders = routeFiles.filter((file) => {
      const source = readFileSync(file, "utf8");
      return !/import\s*\{[^}]*\bwithAuth\b[^}]*\}\s*from\s*"@\/lib\/auth\/with-auth"/.test(source);
    });

    expect(offenders.map(relative)).toEqual([]);
  });
});

describe("Garde-fou : le front n'appelle jamais fetch directement", () => {
  const clientFiles = [
    ...walk(path.join(root, "components")),
    ...walk(path.join(root, "app")).filter(
      (file) => !relative(file).startsWith("app/api/"),
    ),
  ].filter((file) => /\.(tsx?|jsx?)$/.test(file));

  it("passe par apiFetch pour porter le token", () => {
    const offenders = clientFiles.filter((file) =>
      /(?<![\w.])fetch\s*\(/.test(readFileSync(file, "utf8")),
    );

    expect(offenders.map(relative)).toEqual([]);
  });
});

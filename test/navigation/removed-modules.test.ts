// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";
import { KYC_NAV, KYC_SHEET_LABELS } from "@/lib/kyc-excel/terminology";

const root = path.resolve(__dirname, "../..");
const exists = (relative: string) => existsSync(path.join(root, relative));
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

describe("S1 — renommage des onglets (l'import Excel garde ses noms de feuilles)", () => {
  it("les onglets s'appellent Stock et Affectations", () => {
    expect(KYC_NAV.STOCK).toBe("Stock");
    expect(KYC_NAV.ASSIGNMENTS).toBe("Affectations");
  });

  it("les noms de feuilles Excel restent inchanges pour l'import", () => {
    expect(KYC_SHEET_LABELS.IN_STORE).toBe("IN STORE");
    expect(KYC_SHEET_LABELS.WORKSTATIONS).toBe("Workstations");
  });

  it("aucun ecran n'affiche plus les noms de feuilles comme titre", () => {
    const offenders = readdirSync(path.join(root, "components"))
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => /KYC_SHEET_LABELS\.(IN_STORE|WORKSTATIONS)/.test(read(`components/${file}`)));

    expect(offenders).toEqual([]);
  });
});

describe("S2/S3/S4 — modules supprimes", () => {
  it.each([
    "app/(dashboard)/assistance",
    "app/(dashboard)/rapports",
    "app/(dashboard)/techniciens",
    "app/api/support-tickets",
    "app/api/technicians",
    "components/support-tickets-content.tsx",
    "components/reports-content.tsx",
    "components/technicians-content.tsx",
    "lib/support-ticket-filters.ts",
    "lib/support-ticket-serializer.ts",
  ])("%s n'existe plus", (relative) => {
    expect(exists(relative)).toBe(false);
  });

  it("le schema ne contient plus les tickets d'assistance", () => {
    const schema = read("prisma/schema.prisma");
    expect(schema).not.toMatch(/SupportTicket/);
    expect(schema).not.toMatch(/SUPPORT_TICKET_UPDATE/);
  });

  it("le code applicatif ne reference plus les tickets d'assistance", () => {
    for (const file of ["app/api/notifications/route.ts", "lib/stock/asset-state.ts", "components/dashboard-layout.tsx"]) {
      expect(read(file)).not.toMatch(/supportTicket|SupportTicket/i);
    }
  });

  it("une migration supprime les tables tickets (mises a jour d'abord) et ajoute User.active", () => {
    const dir = readdirSync(path.join(root, "prisma/migrations")).find((name) =>
      name.endsWith("_remove_support_tickets_user_active"),
    );
    expect(dir).toBeDefined();

    const sql = read(`prisma/migrations/${dir}/migration.sql`);
    const dropUpdates = sql.indexOf("DROP TABLE `SupportTicketUpdate`");
    const dropTickets = sql.indexOf("DROP TABLE `SupportTicket`");
    expect(dropUpdates).toBeGreaterThanOrEqual(0);
    expect(dropTickets).toBeGreaterThan(dropUpdates);
    expect(sql).toMatch(/ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true/);
  });

  it("le rapport complet n'est plus tronque (aucun take > 1 dans /api/reports)", () => {
    const source = read("app/api/reports/route.ts");
    const takes = [...source.matchAll(/take:\s*(\d+)/g)].map(([, value]) => Number(value));
    expect(takes.filter((value) => value > 1)).toEqual([]);
  });
});

describe("S5 — les anciens liens ne tombent pas en 404", () => {
  it("redirige /techniciens, /rapports et /assistance (redirections temporaires)", async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: "/techniciens", destination: "/parametres?onglet=utilisateurs", permanent: false },
        { source: "/rapports", destination: "/", permanent: false },
        { source: "/assistance", destination: "/", permanent: false },
      ]),
    );
  });
});

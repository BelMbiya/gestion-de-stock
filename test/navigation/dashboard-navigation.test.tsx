import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardLayout } from "@/components/dashboard-layout";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/dashboard-user-menu", () => ({ DashboardUserMenu: () => null }));

describe("S1 — navigation reduite a 6 onglets", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ openIncidents: 0, stockAlerts: { count: 0 }, assignmentReturnAlerts: { count: 0 } }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("affiche exactement : Tableau de bord, Stock, Affectations, Pannes, Historique, Parametres", () => {
    render(<DashboardLayout>contenu</DashboardLayout>);

    const nav = screen.getByRole("navigation");
    const links = within(nav)
      .getAllByRole("link")
      .map((link) => [link.textContent?.trim(), link.getAttribute("href")]);

    expect(links).toEqual([
      ["Tableau de bord", "/"],
      ["Stock", "/inventory"],
      ["Affectations", "/affectations"],
      ["Pannes", "/pannes"],
      ["Historique", "/historique"],
      ["Parametres", "/parametres"],
    ]);
  });

  it("n'affiche plus Assistance IT, Rapports ni Techniciens", () => {
    render(<DashboardLayout>contenu</DashboardLayout>);

    const nav = screen.getByRole("navigation");
    expect(within(nav).queryByText("Assistance IT")).not.toBeInTheDocument();
    expect(within(nav).queryByText("Rapports")).not.toBeInTheDocument();
    expect(within(nav).queryByText("Techniciens")).not.toBeInTheDocument();
  });
});

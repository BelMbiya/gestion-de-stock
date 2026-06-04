import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardContent } from "@/components/dashboard-content";

describe("DashboardContent", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          stats: [
            {
              label: "Actifs IT",
              value: "3",
              hint: "Depuis la base",
              icon: "HardDrive",
            },
          ],
          inventoryItems: [
            {
              sku: "IT-LAP-042",
              title: "Dell Latitude 7420",
              category: "Laptop",
              qty: 1,
              location: "Kinshasa HQ",
              value: "$1240",
              updated: "02/06/2026 13:00",
              status: "Disponible",
            },
          ],
          incidents: [
            {
              id: "INC-NEW-001",
              asset: "Dell Latitude 7420",
              issue: "Nouvelle panne",
              owner: "Non assigne",
              severity: "Moyenne",
              status: "Identification",
              statusCode: "IDENTIFIED",
              progress: 15,
            },
            {
              id: "INC-2406-018",
              asset: "Cisco ISR 4331",
              issue: "Perte intermittente de liaison WAN",
              owner: "Administrateur IT",
              severity: "Haute",
              status: "Diagnostic",
              statusCode: "DIAGNOSING",
              progress: 42,
            },
          ],
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("affiche les statistiques, le stock et les pannes venant de l'API dashboard", async () => {
    render(<DashboardContent />);

    expect(await screen.findByText("Actifs IT")).toBeInTheDocument();
    expect(screen.getAllByText("Dell Latitude 7420").length).toBeGreaterThan(0);
    expect(screen.getByText("Cisco ISR 4331")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/dashboard", {
      cache: "no-store",
    });
  });

  it("met a jour le cycle de resolution quand on selectionne une carte panne", async () => {
    render(<DashboardContent />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Panne INC-2406-018 - Cisco ISR 4331" }),
    );

    const cyclePanel = screen.getByTestId("resolution-cycle-panel");
    expect(cyclePanel).toHaveTextContent("Cycle de resolution");
    expect(cyclePanel).toHaveTextContent("INC-2406-018");
    expect(cyclePanel).toHaveTextContent("Diagnostic");
  });
});

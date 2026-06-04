import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MovementsContent } from "@/components/movements-content";

const movementsPayload = {
  assets: [{ id: "asset-1", name: "Cisco ISR 4331" }],
  locations: [
    { id: "location-1", name: "Site Mining A" },
    { id: "location-2", name: "Datacenter Kinshasa" },
  ],
  movements: [
    {
      id: "movement-1",
      asset: "Cisco ISR 4331",
      fromLocation: "Site Mining A",
      movedAt: "02/06/2026 13:00",
      performedBy: "System",
      quantity: 1,
      reason: "Transfert maintenance",
      toLocation: "Datacenter Kinshasa",
      type: "Transfert",
    },
  ],
};

describe("MovementsContent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation(async (_url, init) => ({
      ok: true,
      json: async () => (init?.method ? {} : movementsPayload),
    }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("cree un mouvement en popup avec le payload de tracabilite attendu", async () => {
    render(<MovementsContent />);

    expect(await screen.findByText("Transfert maintenance")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un mouvement" }));
    fireEvent.change(screen.getByDisplayValue("Materiel"), {
      target: { value: "asset-1" },
    });
    fireEvent.change(screen.getByDisplayValue("Ajustement"), {
      target: { value: "TRANSFER" },
    });
    fireEvent.change(screen.getByDisplayValue("Depuis"), {
      target: { value: "location-1" },
    });
    fireEvent.change(screen.getByDisplayValue("Vers"), {
      target: { value: "location-2" },
    });
    fireEvent.change(screen.getByPlaceholderText("Motif"), {
      target: { value: "Remplacement routeur sur site" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/movements", {
        method: "POST",
        body: JSON.stringify({
          assetId: "asset-1",
          fromLocationId: "location-1",
          quantity: "1",
          reason: "Remplacement routeur sur site",
          toLocationId: "location-2",
          type: "TRANSFER",
        }),
      });
    });
  });

  it("supprime un mouvement via son endpoint dedie", async () => {
    render(<MovementsContent />);

    await screen.findByText("Transfert maintenance");
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/movements/movement-1", {
        method: "DELETE",
      });
    });
  });
});

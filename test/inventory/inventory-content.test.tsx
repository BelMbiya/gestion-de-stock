import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InventoryContent } from "@/components/inventory-content";

const inventoryPayload = {
  assets: [
    {
      id: "asset-1",
      sku: "IT-RTR-015",
      serialNumber: "RTR-4331-00015",
      name: "Cisco ISR 4331",
      category: "Network",
      location: "Site Mining A",
      status: "Critique",
      assignedTo: "Departement IT",
      openIncident: "INC-2406-018",
      value: "$3820",
      updatedAt: "02/06/2026 13:00",
    },
  ],
  categories: [{ id: "category-1", name: "Network" }],
  locations: [{ id: "location-1", name: "Site Mining A" }],
};

describe("InventoryContent", () => {
  const fetchMock = vi.fn();

  function findFetchCall(url: string, method?: string) {
    return fetchMock.mock.calls.find(
      ([callUrl, init]) =>
        callUrl === url && (method ? init?.method === method : true),
    );
  }

  beforeEach(() => {
    fetchMock.mockImplementation(async (_url, init) => ({
      ok: true,
      json: async () => (init?.method ? {} : inventoryPayload),
    }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("affiche les materiels, affectations et pannes ouvertes depuis l'API inventory", async () => {
    render(<InventoryContent />);

    expect(await screen.findByText("Cisco ISR 4331")).toBeInTheDocument();
    expect(screen.getAllByText("Site Mining A").length).toBeGreaterThan(0);
    expect(screen.getByText("Departement IT")).toBeInTheDocument();
    expect(screen.getByText("INC-2406-018")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copier la reference" }),
    ).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/inventory", {
      cache: "no-store",
    });
  });

  it("cree un materiel depuis la popup avec un payload integre", async () => {
    render(<InventoryContent />);

    await screen.findByText("Cisco ISR 4331");
    fireEvent.click(screen.getByRole("button", { name: "Add New" }));
    fireEvent.change(screen.getByPlaceholderText("SKU"), {
      target: { value: "IT-LAP-042" },
    });
    fireEvent.change(screen.getByPlaceholderText("Nom du materiel"), {
      target: { value: "Dell Latitude 7450" },
    });
    fireEvent.change(screen.getByPlaceholderText("Numero de serie"), {
      target: { value: "DL-7450-42" },
    });
    fireEvent.change(screen.getByDisplayValue("Categorie"), {
      target: { value: "category-1" },
    });
    fireEvent.change(screen.getByDisplayValue("Localisation"), {
      target: { value: "location-1" },
    });
    fireEvent.change(screen.getByLabelText("Valeur d'achat"), {
      target: { value: "1450" },
    });
    fireEvent.change(screen.getByLabelText("Statut du materiel"), {
      target: { value: "AVAILABLE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() => {
      const postCall = findFetchCall("/api/inventory", "POST");
      expect(postCall).toBeDefined();
      expect(postCall?.[1]).toMatchObject({
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      expect(JSON.parse(String(postCall?.[1]?.body))).toEqual(
        expect.objectContaining({
          categoryId: "category-1",
          locationId: "location-1",
          imageUrl: "",
          name: "Dell Latitude 7450",
          purchaseValue: "1450",
          serialNumber: "DL-7450-42",
          sku: "IT-LAP-042",
          status: "AVAILABLE",
        }),
      );
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/inventory", {
      cache: "no-store",
    });
  });

  it("ouvre les actions rapides depuis le bouton Action", async () => {
    render(<InventoryContent />);

    await screen.findByText("Cisco ISR 4331");
    fireEvent.click(screen.getByRole("button", { name: "Action" }));

    expect(screen.getByText("Actions rapides")).toBeInTheDocument();
    expect(
      screen.getByText("Allouer un materiel a un agent"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enregistrer un mouvement de stock"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Declarer une panne liee au materiel"),
    ).toBeInTheDocument();
  });

  it("modifie et supprime un materiel avec les bons endpoints", async () => {
    render(<InventoryContent />);

    await screen.findByText("Cisco ISR 4331");
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.change(screen.getByPlaceholderText("Nom du materiel"), {
      target: { value: "Cisco ISR 4331 HA" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      const patchCall = findFetchCall("/api/inventory/asset-1", "PATCH");
      expect(patchCall).toBeDefined();
      expect(patchCall?.[1]).toMatchObject({
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual(
        expect.objectContaining({
          categoryId: "category-1",
          locationId: "location-1",
          imageUrl: "",
          name: "Cisco ISR 4331 HA",
          purchaseValue: "3820",
          serialNumber: "RTR-4331-00015",
          sku: "IT-RTR-015",
          status: "BROKEN",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await waitFor(() => {
      expect(findFetchCall("/api/inventory/asset-1", "DELETE")).toBeDefined();
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InventoryContent } from "@/components/inventory-content";
import { KYC_IN_STORE_COLUMNS, KYC_PROCO_COLUMNS } from "@/lib/kyc-excel/terminology";

const inventoryPayload = {
  assets: [
    {
      id: "asset-1",
      sku: "KYC-LAPTOP-0001",
      serialNumber: "5CG9053387",
      name: "HP LAPTOP I5",
      model: "HP MT44 MOBILE THIN CLIENT",
      brand: "HP",
      imageUrl: null,
      category: "Laptop",
      location: "Mandala Square",
      status: "Assigne",
      assignedTo: "JONATHAN MUSOZO",
      custodianName: "JONATHAN MUSOZO",
      ownerLabel: "Business Development Head",
      workstationCode: null,
      processLabel: null,
      assetGroup: "Laptop",
      systemOs: "WINDOWS 11 64Bits",
      storageRam: "256GB16GB",
      openIncident: null,
      value: "$300.00",
      updatedAt: "02/06/2026 13:00",
    },
  ],
  categories: [{ id: "category-1", name: "Laptop" }],
  locations: [{ id: "location-1", name: "Mandala Square" }],
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

  it("affiche les materiels KYC depuis l'API inventory", async () => {
    render(<InventoryContent />);

    expect(await screen.findByText("HP LAPTOP I5")).toBeInTheDocument();
    expect(screen.getByText("JONATHAN MUSOZO")).toBeInTheDocument();
    expect(screen.getByText("Mandala Square")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/inventory", {
      cache: "no-store",
    });
  });

  it("cree un materiel depuis la popup avec un payload integre", async () => {
    render(<InventoryContent />);

    await screen.findByText("HP LAPTOP I5");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    fireEvent.change(screen.getByPlaceholderText(KYC_PROCO_COLUMNS.NO), {
      target: { value: "IT-LAP-042" },
    });
    fireEvent.change(screen.getByPlaceholderText(KYC_PROCO_COLUMNS.DESCRIPTION), {
      target: { value: "Dell Latitude 7450" },
    });
    fireEvent.change(screen.getByPlaceholderText(KYC_PROCO_COLUMNS.SERIAL_NUMBER), {
      target: { value: "DL-7450-42" },
    });
    fireEvent.change(screen.getByDisplayValue("Categorie"), {
      target: { value: "category-1" },
    });
    fireEvent.change(screen.getByDisplayValue(KYC_PROCO_COLUMNS.LOCATION), {
      target: { value: "location-1" },
    });
    fireEvent.change(screen.getByLabelText("Valeur d'achat"), {
      target: { value: "1450" },
    });
    fireEvent.change(screen.getByLabelText(KYC_PROCO_COLUMNS.STATUS), {
      target: { value: "AVAILABLE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() => {
      const postCall = findFetchCall("/api/inventory", "POST");
      expect(postCall).toBeDefined();
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
  });

  it("ouvre les actions rapides", async () => {
    render(<InventoryContent />);

    await screen.findByText("HP LAPTOP I5");
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));

    expect(screen.getByText(`Allouer ${KYC_IN_STORE_COLUMNS.ITEM}`)).toBeInTheDocument();
    expect(screen.getByText("Mouvement de stock")).toBeInTheDocument();
    expect(screen.getByText("Declarer une panne")).toBeInTheDocument();
  });

  it("modifie et supprime un materiel avec les bons endpoints", async () => {
    render(<InventoryContent />);

    await screen.findByText("HP LAPTOP I5");
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.change(screen.getByPlaceholderText(KYC_PROCO_COLUMNS.DESCRIPTION), {
      target: { value: "HP LAPTOP I5 HA" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      const patchCall = findFetchCall("/api/inventory/asset-1", "PATCH");
      expect(patchCall).toBeDefined();
      expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual(
        expect.objectContaining({
          name: "HP LAPTOP I5 HA",
          imageUrl: "",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await waitFor(() => {
      expect(findFetchCall("/api/inventory/asset-1", "DELETE")).toBeDefined();
    });
  });
});

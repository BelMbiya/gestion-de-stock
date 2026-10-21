import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StockManagementContent } from "@/components/stock-management-content";
import { KYC_IN_STORE_COLUMNS, KYC_UI } from "@/lib/kyc-excel/terminology";

const laptop = {
  id: "asset-1",
  sku: "LAP-0001",
  importRef: "KYC-ITEQUI-0001",
  typeId: "type-lap",
  type: "Laptop",
  barcode: null,
  serialNumber: "5CD123",
  name: "HP LAPTOP I5",
  description: null,
  brand: null,
  model: null,
  imageUrl: null,
  category: "Informatique",
  categoryId: "cat-info",
  location: "Mandala Square",
  locationId: "loc-1",
  supplier: "-",
  supplierId: "",
  status: "Disponible",
  statusCode: "AVAILABLE",
  condition: "Bon etat",
  conditionCode: "GOOD",
  unit: "unite",
  trackingMode: "SERIALIZED",
  trackingModeLabel: "Unitaire",
  quantityOnHand: 1,
  minQuantity: 0,
  stockStatus: "NONE",
  stockStatusLabel: "-",
  assignedTo: "En stock",
  holderId: null,
  activeAssignmentId: null,
  custodianName: null,
  openIncident: null,
  value: "-",
  purchaseValue: "",
  purchaseDate: "",
  warrantyUntil: "",
};

const payload = {
  summary: {
    serialized: { total: 1, assigned: 0 },
    bulk: { references: 0, pieces: 0 },
    stockAlerts: 0,
    overdueLoans: 0,
    available: 1,
    valuedAssets: 0,
    totalValue: "0,00 $US",
  },
  alerts: [],
  assets: [laptop],
  categories: [{ id: "cat-info", name: "Informatique" }],
  types: [
    { id: "type-lap", prefix: "LAP", name: "Laptop", family: "Informatique", defaultTrackingMode: "SERIALIZED" },
    { id: "type-ms", prefix: "MS", name: "Souris", family: "Périphériques", defaultTrackingMode: "BULK" },
  ],
  locations: [{ id: "loc-1", name: "Mandala Square" }],
  holders: [],
  suppliers: [],
  movements: [],
  sessions: [],
};

const fetchMock = vi.fn();

function bodyOf(url: string, method: string) {
  const call = fetchMock.mock.calls.find(([calledUrl, init]) => calledUrl === url && init?.method === method);
  return call ? JSON.parse(String(call[1]?.body)) : null;
}

describe("Codes materiel dans le module Stock", () => {
  beforeEach(() => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = init?.method ? { ok: true } : payload;
      return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("affiche le code et la reference d'import dans le catalogue", async () => {
    render(<StockManagementContent />);

    const row = (await screen.findByText("HP LAPTOP I5")).closest("tr") as HTMLElement;
    expect(within(row).getByText("LAP-0001")).toBeInTheDocument();
    expect(within(row).getByText("KYC-ITEQUI-0001")).toBeInTheDocument();
  });

  it("la creation demande le type de materiel, plus le code ni la categorie", async () => {
    render(<StockManagementContent />);

    await screen.findByText("HP LAPTOP I5");
    fireEvent.click(screen.getByRole("button", { name: `Nouvel ${KYC_IN_STORE_COLUMNS.ITEM}` }));

    expect(screen.queryByLabelText(`${KYC_UI.NO} *`)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Categorie *")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Type de materiel *"), { target: { value: "type-ms" } });
    // Le mode de suivi suit le type choisi (souris : en vrac).
    expect(screen.getByRole("radio", { name: /En vrac/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.change(screen.getByLabelText(`${KYC_UI.DESCRIPTION} *`), { target: { value: "Souris Logitech" } });
    fireEvent.click(screen.getByRole("button", { name: `Creer ${KYC_IN_STORE_COLUMNS.ITEM}` }));

    await waitFor(() => {
      expect(bodyOf("/api/stock", "POST")).toMatchObject({ typeId: "type-ms", trackingMode: "BULK", name: "Souris Logitech" });
    });
    const body = bodyOf("/api/stock", "POST");
    expect(body).not.toHaveProperty("sku");
    expect(body).not.toHaveProperty("categoryId");
  });

  it("en modification, le code est en lecture seule et n'est pas envoye", async () => {
    render(<StockManagementContent />);

    const row = (await screen.findByText("HP LAPTOP I5")).closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Modifier" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("LAP-0001")).toBeInTheDocument();
    expect(within(dialog).getByText("KYC-ITEQUI-0001")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(bodyOf("/api/stock/asset-1", "PATCH")).not.toBeNull();
    });
    expect(bodyOf("/api/stock/asset-1", "PATCH")).not.toHaveProperty("sku");
    expect(bodyOf("/api/stock/asset-1", "PATCH")).not.toHaveProperty("typeId");
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StockManagementContent } from "@/components/stock-management-content";

const stockPayload = {
  summary: {
    available: 1,
    lowStock: 1,
    totalArticles: 1,
    totalQuantity: 8,
    totalValue: "9 920,00 $US",
  },
  alerts: [
    {
      id: "asset-alert",
      sku: "IT-UPS-028",
      barcode: null,
      serialNumber: null,
      name: "APC Smart UPS",
      description: null,
      brand: null,
      model: null,
      imageUrl: null,
      category: "Power",
      categoryId: "category-2",
      location: "DTC",
      locationId: "location-2",
      supplier: "-",
      supplierId: "",
      status: "Maintenance",
      statusCode: "MAINTENANCE",
      condition: "Bon etat",
      conditionCode: "GOOD",
      unit: "piece",
      quantityOnHand: 1,
      minQuantity: 2,
      reorderPoint: 2,
      maxQuantity: null,
      stockStatus: "LOW",
      stockStatusLabel: "Stock bas",
      assignedTo: "-",
      openIncident: null,
      value: "$920",
      purchaseValue: "920",
      purchaseDate: "",
      warrantyUntil: "",
    },
  ],
  assets: [
    {
      id: "asset-1",
      sku: "IT-LAP-042",
      barcode: "EAN-LAP-7420",
      serialNumber: "DL-7420-00042",
      name: "Dell Latitude 7420",
      description: null,
      brand: "Dell",
      model: "7420",
      imageUrl: null,
      category: "Laptop",
      categoryId: "category-1",
      location: "Siege",
      locationId: "location-1",
      supplier: "PROCO IT Supply",
      supplierId: "supplier-1",
      status: "Disponible",
      statusCode: "AVAILABLE",
      condition: "Bon etat",
      conditionCode: "GOOD",
      unit: "piece",
      quantityOnHand: 8,
      minQuantity: 2,
      reorderPoint: 3,
      maxQuantity: 20,
      stockStatus: "OK",
      stockStatusLabel: "OK",
      assignedTo: "-",
      openIncident: "INC-2406-018",
      value: "$9 920",
      purchaseValue: "1240",
      purchaseDate: "",
      warrantyUntil: "",
    },
  ],
  categories: [{ id: "category-1", name: "Laptop" }],
  locations: [{ id: "location-1", name: "Siege" }],
  suppliers: [
    {
      id: "supplier-1",
      name: "PROCO IT Supply",
      code: "PROC-IT",
      assetsCount: 1,
    },
  ],
  movements: [
    {
      id: "mov-1",
      assetId: "asset-1",
      asset: "Dell Latitude 7420",
      type: "IN",
      quantity: 8,
      fromLocation: "-",
      toLocation: "Siege",
      reason: "Reception",
      movedAt: "03/06/2026 10:00",
    },
  ],
  sessions: [
    {
      id: "session-1",
      name: "Inventaire Q2",
      checksCount: 2,
      isOpen: true,
      startedAt: "03/06/2026",
      variance: { found: 1, missing: 1, damaged: 0, moved: 0 },
    },
  ],
};

const inventorySessionsPayload = {
  sessions: [
    {
      id: "session-1",
      name: "Inventaire Q2",
      isOpen: true,
      checks: [
        {
          id: "check-1",
          sku: "IT-LAP-042",
          asset: "Dell Latitude 7420",
          imageUrl: null,
          status: "FOUND",
          expectedLocation: "Siege",
          notes: null,
        },
      ],
    },
  ],
};

const tracePayload = {
  asset: stockPayload.assets[0],
  movements: [
    {
      id: "mov-1",
      typeLabel: "Entree stock",
      quantity: 8,
      movedAt: "03/06/2026",
      reason: "Reception",
    },
  ],
  auditTrail: [
    {
      id: "log-1",
      action: "UPDATE",
      description: "Quantite ajustee",
      createdAt: "03/06/2026",
    },
  ],
};

describe("StockManagementContent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const text =
        method === "GET"
          ? url.includes("/trace")
            ? JSON.stringify(tracePayload)
            : url.includes("/inventory-sessions")
              ? JSON.stringify(inventorySessionsPayload)
              : JSON.stringify(stockPayload)
          : JSON.stringify({ ok: true });

      return {
        ok: true,
        status: 200,
        text: async () => text,
        json: async () => JSON.parse(text),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("ouvre le popup de detail au clic sur une ligne du catalogue", async () => {
    render(<StockManagementContent />);

    const name = await screen.findByText("Dell Latitude 7420");
    fireEvent.click(name.closest("tr")!);

    expect(
      await screen.findByRole("dialog", { name: /Dell Latitude 7420/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Identification")).toBeInTheDocument();
    expect(screen.getByText("EAN-LAP-7420")).toBeInTheDocument();
    expect(screen.getByText("DL-7420-00042")).toBeInTheDocument();
  });

  it("charge le catalogue depuis /api/stock", async () => {
    render(<StockManagementContent />);

    expect(await screen.findByText("Dell Latitude 7420")).toBeInTheDocument();
    expect(screen.getByText("INC-2406-018")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/stock", {
      cache: "no-store",
    });
  });

  it("cree un article via POST /api/stock", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(screen.getByRole("button", { name: "Nouvel article" }));
    fireEvent.change(screen.getByLabelText("SKU *"), {
      target: { value: "IT-KEY-001" },
    });
    fireEvent.change(screen.getByLabelText("Designation *"), {
      target: { value: "Clavier mecanique" },
    });
    fireEvent.change(screen.getByLabelText("Quantite en stock *"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByLabelText("Categorie *"), {
      target: { value: "category-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Creer l'article" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/stock",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("modifie un article via PATCH /api/stock/:id", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.change(screen.getByLabelText("Designation *"), {
      target: { value: "Dell Latitude 7420 Pro" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/stock/asset-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  it("supprime un article via DELETE /api/stock/:id", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/stock/asset-1", {
        method: "DELETE",
      });
    });
  });

  it("affiche la tracabilite depuis /api/stock/:id/trace", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(screen.getByRole("button", { name: "Trace" }));

    expect(await screen.findByText("Tracabilite article")).toBeInTheDocument();
    expect(await screen.findByText("Entree stock")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/stock/asset-1/trace", {
      cache: "no-store",
    });
  });

  it("enregistre un mouvement via POST /api/stock/movements", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(screen.getByRole("button", { name: "Mouvements" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer mouvement" }));
    fireEvent.change(screen.getByDisplayValue("Article"), {
      target: { value: "asset-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Valider mouvement" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/stock/movements",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("affiche les alertes stock bas", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(screen.getByRole("button", { name: "Alertes" }));

    expect(await screen.findByText("APC Smart UPS")).toBeInTheDocument();
    expect(screen.getAllByText("Stock bas").length).toBeGreaterThan(0);
  });

  it("demarre une session inventaire et reconcilie un controle", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(screen.getByRole("button", { name: "Inventaire physique" }));

    fireEvent.change(
      screen.getByPlaceholderText("Nom de la session (ex. Inventaire Q2 2026)"),
      { target: { value: "Inventaire terrain" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Demarrer inventaire" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/inventory-sessions",
        expect.objectContaining({ method: "POST" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Reconcilier" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/inventory-sessions", {
        cache: "no-store",
      });
    });

    const statusSelect = await screen.findByDisplayValue("Trouve");
    fireEvent.change(statusSelect, { target: { value: "MISSING" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/inventory-checks/check-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  it("cree un fournisseur via POST /api/suppliers", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(screen.getByRole("button", { name: "Fournisseurs" }));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter fournisseur" }));
    fireEvent.change(screen.getByPlaceholderText("Code fournisseur *"), {
      target: { value: "NEW-SUP" },
    });
    fireEvent.change(screen.getByPlaceholderText("Raison sociale *"), {
      target: { value: "Nouveau Fournisseur" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/suppliers",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("modifie un fournisseur via PATCH /api/suppliers/:id", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(screen.getByRole("button", { name: "Fournisseurs" }));

    const supplierRow = screen.getByText("PROCO IT Supply").closest("tr");
    expect(supplierRow).toBeTruthy();
    fireEvent.click(
      supplierRow!.querySelector('button[class*="bg-white/10"]') as HTMLButtonElement,
    );

    await screen.findByText("Modifier le fournisseur");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/suppliers/supplier-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });
});

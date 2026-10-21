import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StockManagementContent } from "@/components/stock-management-content";
import { KYC_IN_STORE_COLUMNS, KYC_UI } from "@/lib/kyc-excel/terminology";
import { selectKycAsset } from "@/test/helpers/select-kyc-asset";

const baseAsset = {
  description: null,
  imageUrl: null,
  supplier: "-",
  supplierId: "",
  condition: "Bon etat",
  conditionCode: "GOOD",
  holderId: null,
  activeAssignmentId: null,
  custodianName: null,
  openIncident: null,
  purchaseDate: "",
  warrantyUntil: "",
};

const laptop = {
  ...baseAsset,
  id: "asset-1",
  sku: "LAP-0001",
  importRef: "IT-LAP-042",
  typeId: "type-lap",
  type: "Laptop",
  typePrefix: "LAP",
  barcode: "EAN-LAP-7420",
  serialNumber: "DL-7420-00042",
  name: "Dell Latitude 7420",
  brand: "Dell",
  model: "7420",
  category: "Laptop",
  categoryId: "category-1",
  location: "Siege",
  locationId: "location-1",
  supplier: "PROCO IT Supply",
  supplierId: "supplier-1",
  status: "Affecte",
  statusCode: "ASSIGNED",
  unit: "unite",
  trackingMode: "SERIALIZED",
  trackingModeLabel: "Unitaire",
  quantityOnHand: 1,
  minQuantity: 0,
  stockStatus: "NONE",
  stockStatusLabel: "-",
  assignedTo: "PAPY ADIKAKA",
  holderId: "holder-1",
  activeAssignmentId: "asg-1",
  openIncident: "INC-2406-018",
  value: "$1240",
  purchaseValue: "1240",
};

const mice = {
  ...baseAsset,
  id: "asset-mice",
  sku: "MS-0001",
  importRef: "STO-0013",
  typeId: "type-ms",
  type: "Souris",
  typePrefix: "MS",
  barcode: null,
  serialNumber: null,
  name: "Mouse vodacom",
  brand: null,
  model: null,
  category: "Accessoire",
  categoryId: "category-2",
  location: "Siege",
  locationId: "location-1",
  status: "Disponible",
  statusCode: "AVAILABLE",
  unit: "piece",
  trackingMode: "BULK",
  trackingModeLabel: "En vrac",
  quantityOnHand: 8,
  minQuantity: 10,
  stockStatus: "LOW",
  stockStatusLabel: "Stock bas",
  assignedTo: "En stock",
  value: "-",
  purchaseValue: "",
};

const stockPayload = {
  summary: {
    serialized: { total: 1, assigned: 1 },
    bulk: { references: 1, pieces: 8 },
    stockAlerts: 1,
    overdueLoans: 0,
    available: 0,
    valuedAssets: 1,
    totalValue: "1 240,00 $US",
  },
  alerts: [mice],
  assets: [laptop, mice],
  categories: [
    { id: "category-1", name: "Informatique" },
    { id: "category-2", name: "Périphériques" },
  ],
  types: [
    { id: "type-lap", prefix: "LAP", name: "Laptop", family: "Informatique", defaultTrackingMode: "SERIALIZED" },
    { id: "type-cbl", prefix: "CBL", name: "Câble", family: "Périphériques", defaultTrackingMode: "BULK" },
    { id: "type-ms", prefix: "MS", name: "Souris", family: "Périphériques", defaultTrackingMode: "BULK" },
  ],
  locations: [
    { id: "location-1", name: "Siege" },
    { id: "location-2", name: "ATS" },
  ],
  holders: [{ id: "holder-2", fullName: "HUGUETTE LEPELE", type: "PERSON" }],
  suppliers: [{ id: "supplier-1", name: "PROCO IT Supply", code: "PROC-IT", assetsCount: 1 }],
  movements: [
    {
      id: "mov-1",
      assetId: "asset-mice",
      asset: "Mouse vodacom",
      type: "OUT",
      typeLabel: "Sortie stock",
      quantity: 2,
      fromLocation: "-",
      toLocation: "-",
      beneficiary: "HUGUETTE LEPELE",
      performedBy: "Technicien",
      reason: "Remplacement",
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
  asset: laptop,
  movements: [{ id: "mov-1", typeLabel: "Transfert", quantity: 1, movedAt: "03/06/2026", reason: "Demenagement" }],
  assignments: [],
  auditTrail: [{ id: "log-1", action: "ASSIGN", description: "Dotation remise", createdAt: "03/06/2026" }],
};

function bodyOf(url: string, method: string) {
  const call = fetchMock.mock.calls.find(([calledUrl, init]) => calledUrl === url && init?.method === method);
  return call ? JSON.parse(String(call[1]?.body)) : null;
}

const fetchMock = vi.fn();

function rowOf(name: string) {
  return screen.getByText(name).closest("tr") as HTMLElement;
}

describe("StockManagementContent", () => {
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

      return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("charge le catalogue : mode de suivi, detenteur du materiel unitaire, quantite du vrac", async () => {
    render(<StockManagementContent />);

    expect(await screen.findByText("Dell Latitude 7420")).toBeInTheDocument();
    expect(within(rowOf("Dell Latitude 7420")).getByText("Unitaire")).toBeInTheDocument();
    expect(within(rowOf("Dell Latitude 7420")).getByText("PAPY ADIKAKA")).toBeInTheDocument();
    expect(within(rowOf("Mouse vodacom")).getByText("En vrac")).toBeInTheDocument();
    expect(within(rowOf("Mouse vodacom")).getByText("8 piece")).toBeInTheDocument();
    expect(screen.getByText("INC-2406-018")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/stock", { cache: "no-store" });
  });

  it("ouvre le popup de detail au clic sur une ligne du catalogue", async () => {
    render(<StockManagementContent />);

    fireEvent.click(rowOf(await screen.findByText("Dell Latitude 7420").then((el) => el.textContent!)));

    expect(await screen.findByRole("dialog", { name: /Dell Latitude 7420/i })).toBeInTheDocument();
    expect(screen.getByText("Identification")).toBeInTheDocument();
    expect(screen.getByText("EAN-LAP-7420")).toBeInTheDocument();
    expect(screen.getByText("DL-7420-00042")).toBeInTheDocument();
  });

  it("cree un article en vrac avec quantite initiale et seuil", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(screen.getByRole("button", { name: `Nouvel ${KYC_IN_STORE_COLUMNS.ITEM}` }));
    fireEvent.change(screen.getByLabelText("Type de materiel *"), { target: { value: "type-cbl" } });
    fireEvent.change(screen.getByLabelText(`${KYC_UI.DESCRIPTION} *`), { target: { value: "Cable HDMI" } });
    fireEvent.change(screen.getByLabelText("Quantite initiale"), { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText(/Seuil d'alerte/), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: `Creer ${KYC_IN_STORE_COLUMNS.ITEM}` }));

    await waitFor(() => {
      expect(bodyOf("/api/stock", "POST")).toMatchObject({
        typeId: "type-cbl",
        trackingMode: "BULK",
        quantityOnHand: "25",
        minQuantity: "5",
      });
    });
  });

  it("la fiche n'envoie jamais statut, site, quantite ni mode en modification", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(within(rowOf("Dell Latitude 7420")).getByRole("button", { name: "Modifier" }));
    fireEvent.change(screen.getByLabelText(`${KYC_UI.DESCRIPTION} *`), { target: { value: "Dell Latitude 7420 Pro" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(bodyOf("/api/stock/asset-1", "PATCH")).toMatchObject({ name: "Dell Latitude 7420 Pro" });
    });
    const body = bodyOf("/api/stock/asset-1", "PATCH");
    for (const locked of ["status", "locationId", "quantityOnHand", "trackingMode", "sku", "typeId", "categoryId"]) {
      expect(body).not.toHaveProperty(locked);
    }
  });

  it("affiche le refus de l'API au lieu de l'ignorer", async () => {
    render(<StockManagementContent />);
    await screen.findByText("Dell Latitude 7420");
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      status: 409,
      text: async () => "",
      json: async () => ({ error: "Cet article a un historique : reformez-le." }),
    }));

    fireEvent.click(within(rowOf("Dell Latitude 7420")).getByRole("button", { name: "Supprimer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("reformez-le");
  });

  it("supprime une saisie via DELETE /api/stock/:id", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(within(rowOf("Dell Latitude 7420")).getByRole("button", { name: "Supprimer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/stock/asset-1", { method: "DELETE" });
    });
  });

  it("change l'etat d'un materiel avec un motif", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(within(rowOf("Dell Latitude 7420")).getByRole("button", { name: "Etat" }));
    fireEvent.change(screen.getByLabelText("Nouvel etat *"), { target: { value: "MAINTENANCE" } });
    fireEvent.change(screen.getByLabelText("Motif *"), { target: { value: "Ecran casse" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(bodyOf("/api/stock/asset-1/status", "POST")).toEqual({ target: "MAINTENANCE", reason: "Ecran casse" });
    });
  });

  it("affiche la tracabilite depuis /api/stock/:id/trace", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(within(rowOf("Dell Latitude 7420")).getByRole("button", { name: "Trace" }));

    expect(await screen.findByText(`Tracabilite ${KYC_IN_STORE_COLUMNS.ITEM}`)).toBeInTheDocument();
    expect(await screen.findByText("Transfert")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/stock/asset-1/trace", { cache: "no-store" });
  });

  it("enregistre une sortie d'article en vrac avec beneficiaire", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(screen.getByRole("button", { name: KYC_UI.MOVEMENTS }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer mouvement" }));
    selectKycAsset(`${KYC_UI.DESCRIPTION} *`, "Mouse vodacom");
    fireEvent.change(screen.getByLabelText("Type de mouvement *"), { target: { value: "OUT" } });
    fireEvent.change(screen.getByLabelText("Quantite *"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Beneficiaire (facultatif)"), { target: { value: "holder-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider le mouvement" }));

    await waitFor(() => {
      expect(bodyOf("/api/stock/movements", "POST")).toEqual({
        assetId: "asset-mice",
        type: "OUT",
        quantity: "2",
        holderId: "holder-2",
        reason: "",
      });
    });
  });

  it("un materiel unitaire ne propose que le transfert de site", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(within(rowOf("Dell Latitude 7420")).getByRole("button", { name: "Mouvement" }));

    const typeSelect = screen.getByLabelText("Type de mouvement *");
    expect(within(typeSelect).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["TRANSFER"]);
  });

  it("affiche les alertes : uniquement le vrac sous son seuil", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(screen.getByRole("button", { name: "Alertes" }));

    expect(await screen.findAllByText("Mouse vodacom")).not.toHaveLength(0);
    expect(screen.getAllByText("Stock bas").length).toBeGreaterThan(0);
  });

  it("demarre une session inventaire et reconcilie un controle", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(screen.getByRole("button", { name: KYC_UI.INVENTORY_CHECKS }));
    fireEvent.change(screen.getByPlaceholderText("Nom de la session (ex. Inventaire Q2 2026)"), {
      target: { value: "Inventaire terrain" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Demarrer inventaire" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/inventory-sessions", expect.objectContaining({ method: "POST" }));
    });

    fireEvent.click(screen.getByRole("button", { name: "Reconcilier" }));
    const statusSelect = await screen.findByDisplayValue("Trouve");
    fireEvent.change(statusSelect, { target: { value: "MISSING" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/inventory-checks/check-1", expect.objectContaining({ method: "PATCH" }));
    });
  });

  it("cree un fournisseur via POST /api/suppliers", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(screen.getByRole("button", { name: KYC_IN_STORE_COLUMNS.VENDOR }));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter fournisseur" }));
    fireEvent.change(screen.getByPlaceholderText("Code fournisseur *"), { target: { value: "NEW-SUP" } });
    fireEvent.change(screen.getByPlaceholderText("Raison sociale *"), { target: { value: "Nouveau Fournisseur" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/suppliers", expect.objectContaining({ method: "POST" }));
    });
  });

  it("modifie un fournisseur via PATCH /api/suppliers/:id", async () => {
    render(<StockManagementContent />);

    await screen.findByText("Dell Latitude 7420");
    fireEvent.click(screen.getByRole("button", { name: KYC_IN_STORE_COLUMNS.VENDOR }));
    fireEvent.click(screen.getByRole("button", { name: "Modifier fournisseur PROC-IT" }));
    await screen.findByText("Modifier le fournisseur");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/suppliers/supplier-1", expect.objectContaining({ method: "PATCH" }));
    });
  });
});

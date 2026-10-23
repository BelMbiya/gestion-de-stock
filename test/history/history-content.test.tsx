import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HistoryContent } from "@/components/history-content";
import { selectKycAsset } from "@/test/helpers/select-kyc-asset";

const historyPayload = {
  assets: [
    {
      category: "Réseau",
      id: "asset-1",
      location: "Mandala Square",
      name: "Cisco ISR 4331",
      sku: "SW-0001",
    },
  ],
  events: [
    {
      asset: "Cisco ISR 4331",
      assetCode: "SW-0001",
      assetId: "asset-1",
      date: "03/06/2026 09:00",
      detail: "Incident identifie et diagnostic en cours.",
      id: "incident-update-1",
      metadata: "Diagnostic",
      owner: "Technicien Reseau",
      title: "INC-2406-018",
      type: "Suivi panne",
    },
    {
      asset: "Cisco ISR 4331",
      assetCode: "SW-0001",
      assetId: "asset-1",
      date: "02/06/2026 13:00",
      detail: "Demenagement du local reseau.",
      id: "movement-1",
      metadata: "Kinshasa HQ -> Mandala Square",
      owner: "Administrateur IT",
      title: "Transfert",
      type: "Mouvement",
    },
  ],
};

const techniciansPayload = {
  technicians: [{ id: "tech-1", name: "Technicien Reseau" }],
};

vi.mock("@/lib/pdf-export", () => ({
  exportTablePdf: vi.fn(async () => undefined),
}));

const fetchMock = vi.fn();

describe("HistoryContent", () => {
  beforeEach(() => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () => (url.includes("/api/technicians") ? techniciansPayload : historyPayload),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("affiche chaque evenement avec le code materiel, l'evenement et son contexte", async () => {
    render(<HistoryContent />);

    const row = (await screen.findByText("Demenagement du local reseau.")).closest("tr") as HTMLElement;
    expect(within(row).getByText("SW-0001")).toBeInTheDocument();
    expect(within(row).getByText("Mouvement")).toBeInTheDocument();
    expect(within(row).getByText("Transfert")).toBeInTheDocument();
    expect(within(row).getByText("Kinshasa HQ -> Mandala Square")).toBeInTheDocument();
    expect(screen.getByText("Suivi panne")).toBeInTheDocument();
  });

  it("resume le nombre d'evenements au lieu de cartes superflues", async () => {
    render(<HistoryContent />);

    expect(await screen.findByText("2 evenements")).toBeInTheDocument();
    expect(screen.queryByText("Vue consolidee du cycle de vie du parc IT.")).not.toBeInTheDocument();
  });

  it("filtre par materiel", async () => {
    render(<HistoryContent />);

    await screen.findByText("Demenagement du local reseau.");
    selectKycAsset("Materiel", "Cisco ISR 4331");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/history?assetId=asset-1", { cache: "no-store" });
    });
  });

  it("propose l'export PDF, la periode et le technicien", async () => {
    render(<HistoryContent />);

    expect(await screen.findByText("Exporter PDF")).toBeInTheDocument();
    expect(screen.getByLabelText("Technicien")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Periode"), { target: { value: "week" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/history?period=week", { cache: "no-store" });
    });
  });

  it("une periode personnalisee remplace « date precise » et « intervalle » (champs Du / Au)", async () => {
    render(<HistoryContent />);

    await screen.findByText("Exporter PDF");
    expect(screen.queryByLabelText("Date precise")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Du")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Periode"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("Du"), { target: { value: "2026-06-01" } });
    fireEvent.change(screen.getByLabelText("Au"), { target: { value: "2026-06-30" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/history?startDate=2026-06-01&endDate=2026-06-30", {
        cache: "no-store",
      });
    });
  });

  it("filtre la liste par texte et reinitialise tous les filtres", async () => {
    render(<HistoryContent />);

    await screen.findByText("Demenagement du local reseau.");
    fireEvent.change(screen.getByLabelText("Recherche"), { target: { value: "INC-2406" } });

    expect(screen.queryByText("Demenagement du local reseau.")).not.toBeInTheDocument();
    expect(screen.getByText("1 evenement")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reinitialiser" }));

    expect(screen.getByText("Demenagement du local reseau.")).toBeInTheDocument();
    expect(screen.getByLabelText("Recherche")).toHaveValue("");
  });
});

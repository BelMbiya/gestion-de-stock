import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HistoryContent } from "@/components/history-content";

const historyPayload = {
  assets: [
    {
      category: "Network",
      id: "asset-1",
      location: "Site Mining A",
      name: "Cisco ISR 4331",
      sku: "IT-RTR-015",
    },
  ],
  events: [
    {
      asset: "Cisco ISR 4331",
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
      assetId: "asset-1",
      date: "02/06/2026 13:00",
      detail: "Affectation reseau au site Mining A.",
      id: "movement-1",
      metadata: "Kinshasa HQ -> Site Mining A",
      owner: "Administrateur IT",
      title: "Transport / Transfert",
      type: "Deplacement",
    },
  ],
};

const techniciansPayload = {
  technicians: [{ id: "tech-1", name: "Technicien Reseau" }],
};

vi.mock("@/lib/pdf-export", () => ({
  exportTablePdf: vi.fn(async () => undefined),
}));

describe("HistoryContent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          url.includes("/api/technicians") ? techniciansPayload : historyPayload,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("affiche l'historique consolide et filtre par materiel", async () => {
    render(<HistoryContent />);

    expect((await screen.findAllByText("Cisco ISR 4331")).length).toBeGreaterThan(0);
    expect(screen.getByText("Suivi panne")).toBeInTheDocument();
    expect(screen.getByText("Deplacement")).toBeInTheDocument();
    expect(screen.getByText("Incident identifie et diagnostic en cours.")).toBeInTheDocument();
    expect(screen.queryByText("Diagnostic")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Materiel"), {
      target: { value: "asset-1" },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/history?assetId=asset-1", {
        cache: "no-store",
      });
    });
  });

  it("propose l'export PDF et les filtres periode, date et technicien", async () => {
    render(<HistoryContent />);

    expect(await screen.findByText("Exporter PDF")).toBeInTheDocument();
    expect(screen.getByLabelText("Periode")).toBeInTheDocument();
    expect(screen.getByLabelText("Date precise")).toBeInTheDocument();
    expect(screen.getByLabelText("Technicien")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Periode"), {
      target: { value: "week" },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/history?period=week", {
        cache: "no-store",
      });
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IncidentsContent } from "@/components/incidents-content";

const incidentsPayload = {
  assets: [{ id: "asset-1", name: "Cisco ISR 4331" }],
  incidents: [
    {
      id: "incident-1",
      reference: "INC-2406-018",
      title: "Perte intermittente de liaison WAN",
      description: "Instabilite observee sur la liaison principale.",
      asset: "Cisco ISR 4331",
      location: "Site Mining A",
      reporter: "Administrateur IT",
      assignee: "Equipe reseau",
      severity: "Haute",
      status: "Diagnostic",
      progress: 42,
      identifiedAt: "02/06/2026 13:00",
      updates: [
        {
          id: "update-1",
          author: "Administrateur IT",
          comment: "Incident identifie et diagnostic en cours.",
          statusTo: "Diagnostic",
          createdAt: "02/06/2026 13:15",
        },
      ],
    },
  ],
  users: [{ id: "user-1", name: "Equipe reseau" }],
};

describe("IncidentsContent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation(async (_url, init) => ({
      ok: true,
      json: async () => (init?.method ? {} : incidentsPayload),
    }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("affiche le suivi d'une panne de l'identification a la resolution", async () => {
    render(<IncidentsContent />);

    expect(
      await screen.findByText("Perte intermittente de liaison WAN"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Cisco ISR 4331").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Equipe reseau").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Instabilite observee sur la liaison principale."),
    ).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/incidents", {
      cache: "no-store",
    });
  });

  it("declare une panne depuis la popup avec les donnees attendues", async () => {
    render(<IncidentsContent />);

    await screen.findByText("Perte intermittente de liaison WAN");
    fireEvent.click(screen.getByRole("button", { name: "Declarer une panne" }));
    fireEvent.change(screen.getByPlaceholderText("Reference"), {
      target: { value: "INC-2406-099" },
    });
    fireEvent.change(screen.getByPlaceholderText("Titre de la panne"), {
      target: { value: "Onduleur en alarme" },
    });
    fireEvent.change(screen.getByDisplayValue("Materiel"), {
      target: { value: "asset-1" },
    });
    fireEvent.change(screen.getByDisplayValue("Technicien"), {
      target: { value: "user-1" },
    });
    fireEvent.change(screen.getByDisplayValue("Moyenne"), {
      target: { value: "CRITICAL" },
    });
    fireEvent.change(screen.getByDisplayValue("Identification"), {
      target: { value: "IN_PROGRESS" },
    });
    fireEvent.change(screen.getByLabelText("Historique de panne"), {
      target: { value: "Diagnostic terrain lance" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Declarer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/incidents", {
        method: "POST",
        body: JSON.stringify({
          assetId: "asset-1",
          assigneeId: "user-1",
          comment: "Diagnostic terrain lance",
          description: "",
          reference: "INC-2406-099",
          severity: "CRITICAL",
          status: "IN_PROGRESS",
          title: "Onduleur en alarme",
          history: "Diagnostic terrain lance",
        }),
      });
    });
  });

  it("charge les pannes avec filtres d'exportation", async () => {
    render(<IncidentsContent />);

    await screen.findByText("Perte intermittente de liaison WAN");
    fireEvent.change(screen.getByLabelText("Criticite"), {
      target: { value: "HIGH" },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/incidents?severity=HIGH", {
        cache: "no-store",
      });
    });
  });

  it("modifie le statut d'une panne et conserve la tracabilite envoyee", async () => {
    render(<IncidentsContent />);

    await screen.findByText("Perte intermittente de liaison WAN");
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.change(screen.getByLabelText("Historique de panne"), {
      target: { value: "Piece remplacee et validation utilisateur demandee" },
    });
    fireEvent.change(screen.getByDisplayValue("Diagnostic"), {
      target: { value: "RESOLVED" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/incidents/incident-1", {
        method: "PATCH",
        body: JSON.stringify({
          assetId: "asset-1",
          assigneeId: "user-1",
          comment: "Piece remplacee et validation utilisateur demandee",
          description: "Instabilite observee sur la liaison principale.",
          reference: "INC-2406-018",
          severity: "HIGH",
          status: "RESOLVED",
          title: "Perte intermittente de liaison WAN",
          history: "Piece remplacee et validation utilisateur demandee",
        }),
      });
    });

    fireEvent.click(screen.getByTitle("Supprimer la panne"));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/incidents/incident-1", {
        method: "DELETE",
      });
    });
  });
});

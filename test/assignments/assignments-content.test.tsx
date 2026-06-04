import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssignmentsContent } from "@/components/assignments-content";

const assignmentsPayload = {
  assets: [{ id: "asset-1", name: "Cisco ISR 4331" }],
  assignments: [
    {
      agent: "Berami Mbaya",
      asset: "Cisco ISR 4331",
      assetId: "asset-1",
      category: "Network",
      department: "Departement IT",
      departmentId: "department-1",
      id: "assignment-1",
      location: "Site Mining A",
      notes: "Remis avec chargeur et sacoche.",
      remiseAt: "2 juin 2026",
      remiseAtInput: "2026-06-02",
      expectedReturnAt: "12 juin 2026",
      expectedReturnAtInput: "2026-06-12",
      returnedAt: "-",
      returnedAtInput: "",
      daysUntilReturn: 9,
      returnAlert: null,
      returnAlertLabel: null,
      status: "Alloue",
      statusCode: "ACTIVE",
      userId: "user-1",
    },
  ],
  departments: [{ id: "department-1", name: "Departement IT" }],
  users: [{ email: "berami@example.com", id: "user-1", name: "Berami Mbaya" }],
};

describe("AssignmentsContent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation(async (_url, init) => {
      const body = init?.method ? {} : assignmentsPayload;
      const text = JSON.stringify(body);
      return {
        ok: true,
        text: async () => text,
        json: async () => body,
      };
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("affiche les materiels alloues aux agents avec date et etat", async () => {
    render(<AssignmentsContent />);

    expect(await screen.findByText("Cisco ISR 4331")).toBeInTheDocument();
    expect(screen.getByText("Berami Mbaya")).toBeInTheDocument();
    expect(screen.getAllByText("Departement IT").length).toBeGreaterThan(0);
    expect(screen.getByText("2 juin 2026")).toBeInTheDocument();
    expect(screen.getAllByText("Alloue").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith("/api/assignments", {
      cache: "no-store",
    });
  });

  it("cree une affectation avec agent, date de remise, etat et notes", async () => {
    render(<AssignmentsContent />);

    await screen.findByText("Cisco ISR 4331");
    fireEvent.click(screen.getByRole("button", { name: "Allouer un materiel" }));
    fireEvent.change(screen.getByLabelText("Materiel affecte"), {
      target: { value: "asset-1" },
    });
    fireEvent.change(screen.getByLabelText("Agent beneficiaire"), {
      target: { value: "user-1" },
    });
    fireEvent.change(screen.getByLabelText("Departement beneficiaire"), {
      target: { value: "department-1" },
    });
    fireEvent.change(screen.getByLabelText("Etat affectation"), {
      target: { value: "ACTIVE" },
    });
    fireEvent.change(screen.getByLabelText("Date de remise"), {
      target: { value: "2026-06-03" },
    });
    fireEvent.change(screen.getByLabelText("Retour prevu"), {
      target: { value: "2026-06-20" },
    });
    fireEvent.change(screen.getByPlaceholderText("Notes, etat physique, accessoires remis..."), {
      target: { value: "Laptop remis avec chargeur original." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Allouer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/assignments",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            assetId: "asset-1",
            assignedAt: "2026-06-03",
            assignedToId: "user-1",
            departmentId: "department-1",
            expectedReturnAt: "2026-06-20",
            notes: "Laptop remis avec chargeur original.",
            returnedAt: "",
            status: "ACTIVE",
          }),
        }),
      );
    });
  });

  it("modifie le retour puis supprime une affectation", async () => {
    render(<AssignmentsContent />);

    await screen.findByText("Cisco ISR 4331");
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.change(screen.getByLabelText("Etat affectation"), {
      target: { value: "RETURNED" },
    });
    fireEvent.change(screen.getByLabelText("Retour effectif"), {
      target: { value: "2026-06-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/assignments/assignment-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            assetId: "asset-1",
            assignedAt: "2026-06-02",
            assignedToId: "user-1",
            departmentId: "department-1",
            expectedReturnAt: "2026-06-12",
            notes: "Remis avec chargeur et sacoche.",
            returnedAt: "2026-06-12",
            status: "RETURNED",
          }),
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/assignments/assignment-1", {
        method: "DELETE",
      });
    });
  });
});

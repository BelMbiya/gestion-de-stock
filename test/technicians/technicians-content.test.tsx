import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TechniciansContent } from "@/components/technicians-content";

const techniciansPayload = {
  departments: [{ id: "department-1", name: "Departement IT" }],
  technicians: [
    {
      activeAssignments: 2,
      activeIncidents: 1,
      department: "Departement IT",
      departmentId: "department-1",
      email: "reseau.tech@procordc.com",
      id: "tech-1",
      name: "Technicien Reseau",
      photoUrl: null,
      role: "TECHNICIAN",
    },
  ],
};

describe("TechniciansContent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation(async (_url, init) => ({
      ok: true,
      json: async () => (init?.method ? {} : techniciansPayload),
    }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("affiche les techniciens IT et leurs charges actives", async () => {
    render(<TechniciansContent />);

    expect(await screen.findByText("Technicien Reseau")).toBeInTheDocument();
    expect(screen.getByText("reseau.tech@procordc.com")).toBeInTheDocument();
    expect(screen.getAllByText("Departement IT").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith("/api/technicians", {
      cache: "no-store",
    });
  });

  it("cree un technicien avec role et departement", async () => {
    render(<TechniciansContent />);

    await screen.findByText("Technicien Reseau");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un technicien" }));
    fireEvent.change(screen.getByPlaceholderText("Nom complet"), {
      target: { value: "Support IT Terrain" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email professionnel"), {
      target: { value: "support.it@procordc.com" },
    });
    fireEvent.change(screen.getByLabelText("Role IT"), {
      target: { value: "TECHNICIAN" },
    });
    fireEvent.change(screen.getByLabelText("Departement IT"), {
      target: { value: "department-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/technicians", {
        method: "POST",
        body: JSON.stringify({
          departmentId: "department-1",
          email: "support.it@procordc.com",
          name: "Support IT Terrain",
          photoUrl: "",
          role: "TECHNICIAN",
        }),
      });
    });
  });

  it("modifie puis supprime un technicien", async () => {
    render(<TechniciansContent />);

    await screen.findByText("Technicien Reseau");
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.change(screen.getByPlaceholderText("Nom complet"), {
      target: { value: "Technicien Reseau Senior" },
    });
    fireEvent.change(screen.getByLabelText("Role IT"), {
      target: { value: "IT_MANAGER" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/technicians/tech-1", {
        method: "PATCH",
        body: JSON.stringify({
          departmentId: "department-1",
          email: "reseau.tech@procordc.com",
          name: "Technicien Reseau Senior",
          photoUrl: "",
          role: "IT_MANAGER",
        }),
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/technicians/tech-1", {
        method: "DELETE",
      });
    });
  });
});

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsContent } from "@/components/settings-content";

const usersPayload = {
  departments: [{ id: "department-1", name: "Departement IT" }],
  users: [
    {
      active: true,
      activeAssignments: 0,
      activeIncidents: 0,
      department: "Departement IT",
      departmentId: "department-1",
      email: "it.manager@procordc.com",
      id: "user-manager",
      isCurrentUser: true,
      name: "Manager IT",
      role: "IT_MANAGER",
    },
    {
      active: true,
      activeAssignments: 2,
      activeIncidents: 1,
      department: "Departement IT",
      departmentId: "department-1",
      email: "reseau.tech@procordc.com",
      id: "user-tech",
      isCurrentUser: false,
      name: "Technicien Reseau",
      role: "TECHNICIAN",
    },
    {
      active: false,
      activeAssignments: 0,
      activeIncidents: 0,
      department: "Non renseigne",
      departmentId: null,
      email: "ancien.agent@procordc.com",
      id: "user-old",
      isCurrentUser: false,
      name: "Ancien Agent",
      role: "EMPLOYEE",
    },
  ],
};

const settingsPayload = { categories: [], departments: [], locations: [] };

type FetchInit = { method?: string; body?: string } | undefined;

describe("S2 — Parametres > Utilisateurs (ex-onglet Techniciens)", () => {
  const fetchMock = vi.fn();
  let deleteResponse: { ok: boolean; status: number; json: () => Promise<unknown> };

  beforeEach(() => {
    deleteResponse = { ok: true, status: 200, json: async () => ({ ok: true }) };
    fetchMock.mockImplementation(async (url: string, init: FetchInit) => {
      if (init?.method === "DELETE") return deleteResponse;
      if (init?.method) return { ok: true, status: 200, json: async () => ({}) };
      return {
        ok: true,
        status: 200,
        json: async () => (url.startsWith("/api/users") ? usersPayload : settingsPayload),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function rowOf(name: string) {
    return (await screen.findByText(name)).closest("tr") as HTMLElement;
  }

  it("propose deux onglets : Utilisateurs et Referentiels", async () => {
    render(<SettingsContent initialTab="users" />);

    expect(screen.getByRole("tab", { name: "Utilisateurs" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Referentiels" })).toHaveAttribute("aria-selected", "false");
    expect(await screen.findByText("Technicien Reseau")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/users", { cache: "no-store" });
  });

  it("par defaut, ouvre les referentiels", async () => {
    render(<SettingsContent />);

    expect(screen.getByRole("tab", { name: "Referentiels" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("button", { name: "Ajouter un referentiel" })).toBeInTheDocument();
  });

  it("liste tous les comptes (y compris Employe) avec role, statut et charges en cours", async () => {
    render(<SettingsContent initialTab="users" />);

    const tech = await rowOf("Technicien Reseau");
    expect(within(tech).getByText("Technicien")).toBeInTheDocument();
    expect(within(tech).getByText("Actif")).toBeInTheDocument();
    expect(within(tech).getByText("2 affectation(s) · 1 panne(s)")).toBeInTheDocument();

    const old = await rowOf("Ancien Agent");
    expect(within(old).getByText("Employe")).toBeInTheDocument();
    expect(within(old).getByText("Desactive")).toBeInTheDocument();
    expect(within(old).getByRole("button", { name: "Reactiver" })).toBeInTheDocument();
  });

  it("protege le compte courant : ni desactivation ni suppression de soi-meme", async () => {
    render(<SettingsContent initialTab="users" />);

    const me = await rowOf("it.manager@procordc.com");
    expect(within(me).getByText("Vous")).toBeInTheDocument();
    expect(within(me).queryByRole("button", { name: "Desactiver" })).not.toBeInTheDocument();
    expect(within(me).queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
  });

  it("ajoute un utilisateur avec role et departement", async () => {
    render(<SettingsContent initialTab="users" />);

    await screen.findByText("Technicien Reseau");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un utilisateur" }));
    fireEvent.change(screen.getByPlaceholderText("Nom complet"), { target: { value: "Support IT Terrain" } });
    fireEvent.change(screen.getByPlaceholderText("Email professionnel"), { target: { value: "support.it@procordc.com" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "TECHNICIAN" } });
    fireEvent.change(screen.getByLabelText("Departement"), { target: { value: "department-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/users", {
        method: "POST",
        body: JSON.stringify({
          departmentId: "department-1",
          email: "support.it@procordc.com",
          name: "Support IT Terrain",
          role: "TECHNICIAN",
        }),
      });
    });
  });

  it("modifie un utilisateur", async () => {
    render(<SettingsContent initialTab="users" />);

    fireEvent.click(within(await rowOf("Technicien Reseau")).getByRole("button", { name: "Modifier" }));
    fireEvent.change(screen.getByPlaceholderText("Nom complet"), { target: { value: "Technicien Reseau Senior" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "IT_MANAGER" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/users/user-tech", {
        method: "PATCH",
        body: JSON.stringify({
          departmentId: "department-1",
          email: "reseau.tech@procordc.com",
          name: "Technicien Reseau Senior",
          role: "IT_MANAGER",
        }),
      });
    });
  });

  it("revoque l'acces d'un utilisateur sans supprimer son historique", async () => {
    render(<SettingsContent initialTab="users" />);

    fireEvent.click(within(await rowOf("Technicien Reseau")).getByRole("button", { name: "Desactiver" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/users/user-tech/access", {
        method: "PATCH",
        body: JSON.stringify({ active: false }),
      });
    });
  });

  it("supprime apres confirmation et affiche le refus metier (409) dans la page", async () => {
    deleteResponse = {
      ok: false,
      status: 409,
      json: async () => ({ error: "Ce compte a un historique : desactivez-le plutot que de le supprimer." }),
    };
    render(<SettingsContent initialTab="users" />);

    fireEvent.click(within(await rowOf("Technicien Reseau")).getByRole("button", { name: "Supprimer" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByText("Ce compte a un historique : desactivez-le plutot que de le supprimer.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/users/user-tech", { method: "DELETE" });
  });

  it("n'envoie rien si la suppression n'est pas confirmee", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<SettingsContent initialTab="users" />);

    fireEvent.click(within(await rowOf("Technicien Reseau")).getByRole("button", { name: "Supprimer" }));

    expect(fetchMock).not.toHaveBeenCalledWith("/api/users/user-tech", { method: "DELETE" });
  });
});

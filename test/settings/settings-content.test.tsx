import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsContent } from "@/components/settings-content";

const settingsPayload = {
  categories: [
    {
      description: "Equipements reseau",
      id: "category-1",
      name: "Network",
    },
  ],
  departments: [
    {
      description: "Support et infrastructure",
      id: "department-1",
      name: "Departement IT",
    },
  ],
  locations: [
    {
      code: "KIN-DC",
      description: "Salle serveur principale",
      id: "location-1",
      name: "Datacenter Kinshasa",
    },
  ],
};

describe("SettingsContent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation(async (_url, init) => ({
      ok: true,
      json: async () => (init?.method ? {} : settingsPayload),
    }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("cree un referentiel localisation en popup avec code obligatoire", async () => {
    render(<SettingsContent />);

    expect(await screen.findByText("Datacenter Kinshasa")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un referentiel" }));
    fireEvent.change(screen.getByDisplayValue("Categorie"), {
      target: { value: "location" },
    });
    fireEvent.change(screen.getByPlaceholderText("Nom"), {
      target: { value: "Site Mining A" },
    });
    fireEvent.change(screen.getByPlaceholderText("Code localisation"), {
      target: { value: "MINE-A" },
    });
    fireEvent.change(screen.getByPlaceholderText("Description"), {
      target: { value: "Bureau IT site minier" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          code: "MINE-A",
          description: "Bureau IT site minier",
          name: "Site Mining A",
          type: "location",
        }),
      });
    });
  });

  it("modifie puis supprime un referentiel avec son type conserve", async () => {
    render(<SettingsContent />);

    await screen.findByText("Network");
    fireEvent.click(screen.getAllByRole("button", { name: "Modifier" })[0]);
    fireEvent.change(screen.getByPlaceholderText("Nom"), {
      target: { value: "Network Core" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/settings/category/category-1", {
        method: "PATCH",
        body: JSON.stringify({
          code: "",
          description: "Equipements reseau",
          name: "Network Core",
          type: "category",
        }),
      });
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Supprimer" })[0]);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/settings/category/category-1", {
        method: "DELETE",
      });
    });
  });
});

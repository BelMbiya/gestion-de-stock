import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssignmentsContent } from "@/components/assignments-content";
import { selectKycAsset } from "@/test/helpers/select-kyc-asset";

const activeLoan = {
  id: "assignment-1",
  assetId: "asset-1",
  asset: "Cisco ISR 4331",
  sku: "IT-RTR-015",
  serialNumber: "FTX-001",
  category: "Network",
  location: "Mandala Square",
  holderId: "holder-1",
  holder: "PAPY ADIKAKA",
  holderType: "PERSON",
  holderDetail: "INBOUND",
  kind: "LOAN",
  kindLabel: "Pret",
  notes: "Remis avec chargeur.",
  remiseAt: "2 juin 2026",
  expectedReturnAt: "12 juin 2026",
  expectedReturnAtInput: "2026-06-12",
  returnedAt: "-",
  daysUntilReturn: -3,
  returnAlert: "OVERDUE",
  returnAlertLabel: "Retour en retard",
  returnOutcome: null,
  issuedBy: "Technicien A",
  status: "En cours",
  statusCode: "ACTIVE",
};

const closedDotation = {
  ...activeLoan,
  id: "assignment-2",
  assetId: "asset-9",
  asset: "HP LAPTOP I5",
  sku: "KYC-ITEQUI-0001",
  kind: "DOTATION",
  kindLabel: "Dotation",
  expectedReturnAt: "-",
  expectedReturnAtInput: "",
  returnAlert: null,
  returnAlertLabel: null,
  daysUntilReturn: null,
  returnedAt: "3 juin 2026",
  returnOutcome: "Bon etat",
  status: "Retourne",
  statusCode: "RETURNED",
};

const assignmentsPayload = {
  assets: [
    { id: "asset-1", name: "Cisco ISR 4331", sku: "IT-RTR-015", model: null, serialNumber: "FTX-001", assignable: false },
    { id: "asset-2", name: "Dell Latitude 7420", sku: "IT-LAP-042", model: "7420", serialNumber: "DL-42", assignable: true },
  ],
  holders: [
    { id: "holder-1", fullName: "PAPY ADIKAKA", typeLabel: "Personne", process: "INBOUND", department: null },
    { id: "holder-2", fullName: "AGENTS", typeLabel: "Collectif", process: null, department: null },
  ],
  assignments: [activeLoan, closedDotation],
};

const holdersPayload = {
  departments: [],
  holders: [
    {
      id: "holder-1", type: "PERSON", typeLabel: "Personne", fullName: "PAPY ADIKAKA", matricule: null,
      process: "INBOUND", departmentId: null, department: null, active: true, activeAssignments: 1, toRecover: false,
    },
    {
      id: "holder-3", type: "PERSON", typeLabel: "Personne", fullName: "ANCIEN AGENT", matricule: "M-1",
      process: null, departmentId: null, department: null, active: false, activeAssignments: 2, toRecover: true,
    },
  ],
};

const fetchMock = vi.fn();

function bodyOf(url: string, method: string) {
  const call = fetchMock.mock.calls.find(([calledUrl, init]) => calledUrl === url && init?.method === method);
  return call ? JSON.parse(String(call[1]?.body)) : null;
}

describe("AssignmentsContent", () => {
  beforeEach(() => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const body = init?.method ? { ok: true } : url.startsWith("/api/holders") ? holdersPayload : assignmentsPayload;
      return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("liste les affectations en cours avec detenteur, type et alerte de retard", async () => {
    render(<AssignmentsContent />);

    const row = (await screen.findAllByText("Cisco ISR 4331"))
      .map((element) => element.closest("tr"))
      .find(Boolean) as HTMLElement;
    expect(within(row).getByText("PAPY ADIKAKA")).toBeInTheDocument();
    expect(within(row).getByText("Pret")).toBeInTheDocument();
    expect(within(row).getByText(/Retour en retard \(3 j de retard\)/)).toBeInTheDocument();
    // Par defaut : seulement les affectations en cours.
    expect(screen.queryByText("HP LAPTOP I5")).not.toBeInTheDocument();
  });

  it("n'offre plus de suppression d'affectation (historique conserve)", async () => {
    render(<AssignmentsContent />);

    await screen.findAllByText("Cisco ISR 4331");
    expect(screen.queryByRole("button", { name: /supprimer/i })).not.toBeInTheDocument();
  });

  it("alloue un materiel disponible en dotation", async () => {
    render(<AssignmentsContent />);

    await screen.findAllByText("Cisco ISR 4331");
    fireEvent.click(screen.getByRole("button", { name: /Allouer/ }));
    selectKycAsset("Materiel *", "Dell Latitude 7420");
    selectKycAsset("Detenteur *", "AGENTS");
    fireEvent.click(screen.getByRole("button", { name: "Allouer" }));

    await waitFor(() => {
      expect(bodyOf("/api/assignments", "POST")).toMatchObject({
        assetId: "asset-2",
        holderId: "holder-2",
        kind: "DOTATION",
        expectedReturnAt: "",
      });
    });
  });

  it("un pret exige une date de retour", async () => {
    render(<AssignmentsContent />);

    await screen.findAllByText("Cisco ISR 4331");
    fireEvent.click(screen.getByRole("button", { name: /Allouer/ }));
    const returnDate = screen.getByLabelText(/Retour prevu/);
    expect(returnDate).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Pret/ }));

    expect(screen.getByLabelText(/Retour prevu/)).toBeEnabled();
    expect(screen.getByLabelText(/Retour prevu/)).toBeRequired();
  });

  it("enregistre un retour avec l'etat constate", async () => {
    render(<AssignmentsContent />);

    await screen.findAllByText("Cisco ISR 4331");
    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    fireEvent.click(screen.getByRole("radio", { name: /A reparer/ }));
    fireEvent.change(screen.getByLabelText("Condition constatee"), { target: { value: "DAMAGED" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le retour" }));

    await waitFor(() => {
      expect(bodyOf("/api/assignments/assignment-1/return", "POST")).toEqual({
        outcome: "TO_REPAIR",
        condition: "DAMAGED",
        notes: "",
      });
    });
  });

  it("reaffecte a un autre detenteur", async () => {
    render(<AssignmentsContent />);

    await screen.findAllByText("Cisco ISR 4331");
    fireEvent.click(screen.getByRole("button", { name: "Reaffecter" }));
    selectKycAsset("Nouveau detenteur *", "AGENTS");
    fireEvent.click(screen.getByRole("button", { name: "Reaffecter" }));

    await waitFor(() => {
      expect(bodyOf("/api/assignments/assignment-1/reassign", "POST")).toMatchObject({
        holderId: "holder-2",
        kind: "DOTATION",
      });
    });
  });

  it("affiche le refus metier renvoye par l'API", async () => {
    render(<AssignmentsContent />);

    await screen.findAllByText("Cisco ISR 4331");
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      status: 400,
      text: async () => "",
      json: async () => ({ error: "Ce detenteur est inactif : il ne peut plus recevoir de materiel." }),
    }));
    fireEvent.click(screen.getByRole("button", { name: "Reaffecter" }));
    selectKycAsset("Nouveau detenteur *", "AGENTS");
    fireEvent.click(screen.getByRole("button", { name: "Reaffecter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("inactif");
  });

  it("onglet Detenteurs : signale le materiel a recuperer chez un detenteur inactif", async () => {
    render(<AssignmentsContent />);

    await screen.findAllByText("Cisco ISR 4331");
    fireEvent.click(screen.getByRole("tab", { name: "Detenteurs" }));
    fireEvent.change(await screen.findByLabelText("Filtrer les detenteurs"), { target: { value: "all" } });

    expect(await screen.findByText("ANCIEN AGENT")).toBeInTheDocument();
    expect(screen.getByText("A recuperer")).toBeInTheDocument();
    expect(screen.getByText(/1 detenteur\(s\) inactif\(s\) detiennent encore du materiel/)).toBeInTheDocument();
  });
});

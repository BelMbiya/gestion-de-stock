// @vitest-environment node
import { describe, expect, it } from "vitest";

import { DomainError } from "@/lib/domain-error";
import { createUser, deleteUser, listUsers, setUserActive, updateUser } from "@/lib/users/user-service";

import { appUser, createFakeStockDb } from "../helpers/fake-stock-db";

const manager = appUser();
const tech = appUser({
  id: "user-tech",
  email: "tech@procordc.com",
  name: "Technicien",
  role: "TECHNICIAN",
  firebaseUid: "firebase-uid-tech",
});

async function refused(promise: Promise<unknown>, status: 400 | 404 | 409) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).status).toBe(status);
  return (error as DomainError).message;
}

describe("S2 — creer un compte autorise", () => {
  it("normalise l'email et le nom, role Technicien par defaut, compte actif", async () => {
    const db = createFakeStockDb({ user: [manager] });

    const user = await createUser(db as never, { email: "  Jean.Mukendi@ProcoRDC.com ", name: "  Jean Mukendi " });

    expect(user).toMatchObject({
      email: "jean.mukendi@procordc.com",
      name: "Jean Mukendi",
      role: "TECHNICIAN",
      active: true,
      departmentId: null,
    });
  });

  it("reserve un identifiant Firebase provisoire qui ne peut pas entrer en collision avec un vrai uid", async () => {
    const db = createFakeStockDb();

    const user = await createUser(db as never, { email: "agent@procordc.com" });

    // Un uid Firebase est alphanumerique : le « : » rend toute collision impossible.
    expect(user.firebaseUid).toBe("pending:agent@procordc.com");
  });

  it.each([[""], ["   "], ["pas-un-email"], ["a@b"], [42]])("refuse l'email invalide %j (400)", async (email) => {
    const db = createFakeStockDb();

    expect(await refused(createUser(db as never, { email }), 400)).toMatch(/email/i);
  });

  it("refuse un role inconnu au lieu de le remplacer en silence (400)", async () => {
    const db = createFakeStockDb();

    expect(await refused(createUser(db as never, { email: "x@procordc.com", role: "SUPERUSER" }), 400)).toMatch(/role/i);
  });

  it("refuse un email deja utilise, meme avec une casse differente (409)", async () => {
    const db = createFakeStockDb({ user: [manager] });

    expect(await refused(createUser(db as never, { email: "IT.Manager@procordc.com" }), 409)).toMatch(/existe deja/i);
  });
});

describe("S2 — modifier un compte", () => {
  it("modifie nom, role et departement", async () => {
    const db = createFakeStockDb({ user: [manager, tech] });

    await updateUser(db as never, manager.id, tech.id, {
      email: tech.email,
      name: "Technicien Senior",
      role: "IT_MANAGER",
      departmentId: "dep-it",
    });

    expect(db.row("user", tech.id)).toMatchObject({ name: "Technicien Senior", role: "IT_MANAGER", departmentId: "dep-it" });
  });

  it("refuse de prendre l'email d'un autre compte (409)", async () => {
    const db = createFakeStockDb({ user: [manager, tech] });

    await refused(updateUser(db as never, manager.id, tech.id, { email: manager.email }), 409);
  });

  it("refuse de changer son propre role (on ne s'enferme pas dehors)", async () => {
    const db = createFakeStockDb({ user: [manager, appUser({ id: "user-admin-2", email: "a2@procordc.com" })] });

    expect(
      await refused(updateUser(db as never, manager.id, manager.id, { email: manager.email, role: "TECHNICIAN" }), 409),
    ).toMatch(/propre/i);
  });

  it("refuse de retirer le dernier gestionnaire actif (Manager IT ou Admin)", async () => {
    const db = createFakeStockDb({ user: [manager, tech] });

    expect(
      await refused(updateUser(db as never, tech.id, manager.id, { email: manager.email, role: "TECHNICIAN" }), 409),
    ).toMatch(/dernier/i);
  });

  it("404 pour un compte inexistant", async () => {
    const db = createFakeStockDb({ user: [manager] });

    await refused(updateUser(db as never, manager.id, "inconnu", { email: "x@procordc.com" }), 404);
  });
});

describe("S2 — revoquer l'acces sans perdre l'historique", () => {
  it("desactive puis reactive un compte", async () => {
    const db = createFakeStockDb({ user: [manager, tech] });

    await setUserActive(db as never, manager.id, tech.id, false);
    expect(db.row("user", tech.id)?.active).toBe(false);

    await setUserActive(db as never, manager.id, tech.id, true);
    expect(db.row("user", tech.id)?.active).toBe(true);
  });

  it("refuse de se desactiver soi-meme", async () => {
    const db = createFakeStockDb({ user: [manager, appUser({ id: "user-admin-2", email: "a2@procordc.com" })] });

    expect(await refused(setUserActive(db as never, manager.id, manager.id, false), 409)).toMatch(/propre/i);
  });

  it("refuse de desactiver le dernier gestionnaire actif", async () => {
    const db = createFakeStockDb({ user: [manager, tech] });

    expect(await refused(setUserActive(db as never, tech.id, manager.id, false), 409)).toMatch(/dernier/i);
  });
});

describe("S2 — supprimer un compte", () => {
  it("supprime un compte cree par erreur (sans historique)", async () => {
    const db = createFakeStockDb({ user: [manager, tech] });

    await deleteUser(db as never, manager.id, tech.id);

    expect(db.row("user", tech.id)).toBeUndefined();
  });

  it("refuse de se supprimer soi-meme", async () => {
    const db = createFakeStockDb({ user: [manager, appUser({ id: "user-admin-2", email: "a2@procordc.com" })] });

    expect(await refused(deleteUser(db as never, manager.id, manager.id), 409)).toMatch(/propre/i);
  });

  it("refuse de supprimer le dernier gestionnaire actif", async () => {
    const db = createFakeStockDb({ user: [manager, tech] });

    expect(await refused(deleteUser(db as never, tech.id, manager.id), 409)).toMatch(/dernier/i);
  });

  it.each([
    ["asset", { id: "a", createdById: "user-tech" }],
    ["assetAssignment", { id: "as", issuedById: "user-tech" }],
    ["assetAssignment", { id: "as", returnedById: "user-tech" }],
    ["stockMovement", { id: "mv", performedById: "user-tech" }],
    ["incident", { id: "i", reporterId: "user-tech" }],
    ["incident", { id: "i", assigneeId: "user-tech" }],
    ["incidentUpdate", { id: "u", authorId: "user-tech" }],
    ["inventoryCheck", { id: "c", checkedById: "user-tech" }],
    ["auditLog", { id: "l", actorId: "user-tech" }],
  ] as const)("refuse (409, « desactivez ») un compte avec historique : %s", async (model, row) => {
    const db = createFakeStockDb({ user: [manager, tech], [model]: [row] });

    expect(await refused(deleteUser(db as never, manager.id, tech.id), 409)).toMatch(/desactivez/i);
    expect(db.row("user", tech.id)).toBeDefined();
  });
});

describe("S2 — lister les comptes", () => {
  it("liste tous les comptes quel que soit le role, avec leurs charges en cours et le compte courant", async () => {
    const employee = appUser({ id: "user-emp", email: "emp@procordc.com", name: "Agent", role: "EMPLOYEE" });
    const db = createFakeStockDb({
      user: [tech, manager, employee],
      assetAssignment: [
        { id: "as-1", issuedById: "user-tech", status: "ACTIVE" },
        { id: "as-2", issuedById: "user-tech", status: "RETURNED" },
      ],
      incident: [
        { id: "i-1", assigneeId: "user-tech", status: "DIAGNOSING" },
        { id: "i-2", assigneeId: "user-tech", status: "CLOSED" },
      ],
    });

    const users = await listUsers(db as never, manager.id);

    expect(users.map((user) => user.id).sort()).toEqual(["user-emp", "user-manager", "user-tech"]);
    expect(users.find((user) => user.id === "user-tech")).toMatchObject({
      activeAssignments: 1,
      activeIncidents: 1,
      isCurrentUser: false,
    });
    expect(users.find((user) => user.id === "user-manager")?.isCurrentUser).toBe(true);
    // Jamais d'identifiant Firebase vers le navigateur.
    expect(users.every((user) => !("firebaseUid" in user))).toBe(true);
  });
});

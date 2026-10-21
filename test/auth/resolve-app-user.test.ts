// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type AppUserStore, createResolveAppUser } from "@/lib/auth/resolve-app-user";

const admin = {
  id: "user-admin",
  email: "it.admin@procordc.com",
  name: "Administrateur IT",
  role: "IT_MANAGER" as const,
};

function setup() {
  const store = {
    findByFirebaseUid: vi.fn<AppUserStore["findByFirebaseUid"]>().mockResolvedValue(null),
    findByEmail: vi.fn<AppUserStore["findByEmail"]>().mockResolvedValue(null),
    linkFirebaseUid: vi.fn<AppUserStore["linkFirebaseUid"]>().mockResolvedValue(undefined),
  } satisfies AppUserStore;

  return { store, resolve: createResolveAppUser(store) };
}

describe("resolveAppUser", () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it("retrouve l'utilisateur par firebaseUid sans re-liaison", async () => {
    deps.store.findByFirebaseUid.mockResolvedValue(admin);

    const user = await deps.resolve({ uid: "uid-admin", email: admin.email, email_verified: true });

    expect(user).toEqual(admin);
    expect(deps.store.findByFirebaseUid).toHaveBeenCalledWith("uid-admin");
    expect(deps.store.findByEmail).not.toHaveBeenCalled();
    expect(deps.store.linkFirebaseUid).not.toHaveBeenCalled();
  });

  it("relie un compte cree par seed/Techniciens via un email verifie", async () => {
    deps.store.findByEmail.mockResolvedValue(admin);

    const user = await deps.resolve({
      uid: "real-google-uid",
      email: admin.email,
      email_verified: true,
    });

    expect(user).toEqual(admin);
    expect(deps.store.findByEmail).toHaveBeenCalledWith("it.admin@procordc.com");
    expect(deps.store.linkFirebaseUid).toHaveBeenCalledWith("user-admin", "real-google-uid");
  });

  it("normalise l'email (casse, espaces) avant la recherche", async () => {
    deps.store.findByEmail.mockResolvedValue(admin);

    await deps.resolve({
      uid: "real-google-uid",
      email: "  IT.Admin@ProcoRDC.com ",
      email_verified: true,
    });

    expect(deps.store.findByEmail).toHaveBeenCalledWith("it.admin@procordc.com");
  });

  it("ATTAQUE : refuse l'usurpation par un email non verifie", async () => {
    deps.store.findByEmail.mockResolvedValue(admin);

    const user = await deps.resolve({
      uid: "attacker-uid",
      email: admin.email,
      email_verified: false,
    });

    expect(user).toBeNull();
    expect(deps.store.findByEmail).not.toHaveBeenCalled();
    expect(deps.store.linkFirebaseUid).not.toHaveBeenCalled();
  });

  it("ATTAQUE : refuse quand email_verified est absent du token", async () => {
    deps.store.findByEmail.mockResolvedValue(admin);

    const user = await deps.resolve({ uid: "attacker-uid", email: admin.email });

    expect(user).toBeNull();
    expect(deps.store.linkFirebaseUid).not.toHaveBeenCalled();
  });

  it("refuse un compte inconnu avec email verifie", async () => {
    const user = await deps.resolve({
      uid: "stranger-uid",
      email: "stranger@gmail.com",
      email_verified: true,
    });

    expect(user).toBeNull();
    expect(deps.store.linkFirebaseUid).not.toHaveBeenCalled();
  });

  it("refuse un token sans email (ex. connexion anonyme)", async () => {
    const user = await deps.resolve({ uid: "anonymous-uid" });

    expect(user).toBeNull();
    expect(deps.store.findByEmail).not.toHaveBeenCalled();
  });
});

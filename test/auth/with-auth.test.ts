// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type AuthenticatedUser,
  type TokenClaims,
  createWithAuth,
} from "@/lib/auth/with-auth";

const appUser: AuthenticatedUser = {
  id: "user-1",
  email: "tech@procordc.com",
  name: "Technicien",
  role: "TECHNICIAN",
};

const validClaims: TokenClaims = {
  uid: "firebase-uid-1",
  email: "tech@procordc.com",
  email_verified: true,
};

function setup() {
  const verifyIdToken = vi.fn<(token: string) => Promise<TokenClaims>>();
  const resolveUser = vi.fn<(claims: TokenClaims) => Promise<AuthenticatedUser | null>>();
  const handler = vi.fn(async () => Response.json({ ok: true }));
  const withAuth = createWithAuth({ verifyIdToken, resolveUser });

  return { verifyIdToken, resolveUser, handler, route: withAuth(handler) };
}

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/stock", { headers });
}

const context = { params: Promise.resolve({}) };

describe("withAuth — authentification (401)", () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it("refuse une requete sans en-tete Authorization sans toucher a la base", async () => {
    const response = await deps.route(request(), context);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Non authentifie" });
    expect(deps.verifyIdToken).not.toHaveBeenCalled();
    expect(deps.resolveUser).not.toHaveBeenCalled();
    expect(deps.handler).not.toHaveBeenCalled();
  });

  it.each([
    ["schema Basic", "Basic dXNlcjpwYXNz"],
    ["Bearer vide", "Bearer "],
    ["Bearer sans espace", "Bearertoken"],
    ["token seul", "eyJhbGciOi"],
  ])("refuse un en-tete mal forme (%s)", async (_label, value) => {
    const response = await deps.route(request({ Authorization: value }), context);

    expect(response.status).toBe(401);
    expect(deps.verifyIdToken).not.toHaveBeenCalled();
    expect(deps.handler).not.toHaveBeenCalled();
  });

  it("refuse un token invalide, expire ou d'un autre projet", async () => {
    deps.verifyIdToken.mockRejectedValue(new Error("auth/id-token-expired"));

    const response = await deps.route(
      request({ Authorization: "Bearer expired-token" }),
      context,
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Non authentifie" });
    expect(deps.verifyIdToken).toHaveBeenCalledWith("expired-token");
    expect(deps.resolveUser).not.toHaveBeenCalled();
    expect(deps.handler).not.toHaveBeenCalled();
  });

  it("ne divulgue pas le detail de l'erreur de verification", async () => {
    deps.verifyIdToken.mockRejectedValue(new Error("Firebase ID token has invalid signature"));

    const response = await deps.route(request({ Authorization: "Bearer forged" }), context);
    const body = await response.json();

    expect(JSON.stringify(body)).not.toMatch(/signature/i);
  });
});

describe("withAuth — autorisation (403)", () => {
  it("refuse un compte Firebase valide absent de la table User", async () => {
    const deps = setup();
    deps.verifyIdToken.mockResolvedValue(validClaims);
    deps.resolveUser.mockResolvedValue(null);

    const response = await deps.route(request({ Authorization: "Bearer valid" }), context);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Compte non autorise" });
    expect(deps.resolveUser).toHaveBeenCalledWith(validClaims);
    expect(deps.handler).not.toHaveBeenCalled();
  });
});

describe("withAuth — acces autorise", () => {
  it("transmet requete, contexte et utilisateur au handler", async () => {
    const deps = setup();
    deps.verifyIdToken.mockResolvedValue(validClaims);
    deps.resolveUser.mockResolvedValue(appUser);
    const req = request({ Authorization: "Bearer valid-token" });

    const response = await deps.route(req, context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(deps.verifyIdToken).toHaveBeenCalledWith("valid-token");
    expect(deps.handler).toHaveBeenCalledWith(req, context, appUser);
  });

  it("accepte le schema Bearer quelle que soit la casse", async () => {
    const deps = setup();
    deps.verifyIdToken.mockResolvedValue(validClaims);
    deps.resolveUser.mockResolvedValue(appUser);

    const response = await deps.route(request({ Authorization: "bearer valid-token" }), context);

    expect(response.status).toBe(200);
    expect(deps.verifyIdToken).toHaveBeenCalledWith("valid-token");
  });

  it("ne masque pas une panne de base en 401/403", async () => {
    const deps = setup();
    deps.verifyIdToken.mockResolvedValue(validClaims);
    deps.resolveUser.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      deps.route(request({ Authorization: "Bearer valid-token" }), context),
    ).rejects.toThrow("ECONNREFUSED");
    expect(deps.handler).not.toHaveBeenCalled();
  });
});

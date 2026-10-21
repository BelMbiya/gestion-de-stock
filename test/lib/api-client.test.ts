import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApiFetch } from "@/lib/api-client";

function setup(tokens: (string | null)[] = ["token-1"]) {
  const getToken = vi.fn<(forceRefresh: boolean) => Promise<string | null>>();
  for (const token of tokens) {
    getToken.mockResolvedValueOnce(token);
  }
  const fetchImpl = vi.fn<typeof fetch>();
  const onUnauthenticated = vi.fn();
  const onForbidden = vi.fn();
  const apiFetch = createApiFetch({ getToken, fetchImpl, onUnauthenticated, onForbidden });

  return { getToken, fetchImpl, onUnauthenticated, onForbidden, apiFetch };
}

function headersOf(call: Parameters<typeof fetch>) {
  return new Headers(call[1]?.headers);
}

describe("apiFetch", () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it("ajoute le token Firebase en en-tete Authorization", async () => {
    deps.fetchImpl.mockResolvedValue(new Response("{}", { status: 200 }));

    await deps.apiFetch("/api/stock");

    expect(deps.getToken).toHaveBeenCalledWith(false);
    const [url] = deps.fetchImpl.mock.calls[0];
    expect(url).toBe("/api/stock");
    expect(headersOf(deps.fetchImpl.mock.calls[0]).get("Authorization")).toBe(
      "Bearer token-1",
    );
  });

  it("conserve methode, corps, cache et en-tetes existants", async () => {
    deps.fetchImpl.mockResolvedValue(new Response("{}", { status: 201 }));

    await deps.apiFetch("/api/stock", {
      method: "POST",
      body: JSON.stringify({ name: "Laptop" }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });

    const init = deps.fetchImpl.mock.calls[0][1];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ name: "Laptop" }));
    expect(init?.cache).toBe("no-store");
    const headers = headersOf(deps.fetchImpl.mock.calls[0]);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer token-1");
  });

  it("ne laisse pas un appelant ecraser l'en-tete Authorization", async () => {
    deps.fetchImpl.mockResolvedValue(new Response("{}", { status: 200 }));

    await deps.apiFetch("/api/stock", { headers: { Authorization: "Bearer forged" } });

    expect(headersOf(deps.fetchImpl.mock.calls[0]).get("Authorization")).toBe(
      "Bearer token-1",
    );
  });

  it("retourne la reponse telle quelle en cas de succes", async () => {
    const ok = new Response(JSON.stringify({ items: [] }), { status: 200 });
    deps.fetchImpl.mockResolvedValue(ok);

    const response = await deps.apiFetch("/api/stock");

    expect(response).toBe(ok);
    expect(deps.onUnauthenticated).not.toHaveBeenCalled();
    expect(deps.onForbidden).not.toHaveBeenCalled();
  });

  it("sans session : n'appelle pas le reseau et redirige vers la connexion", async () => {
    deps = setup([null]);

    const response = await deps.apiFetch("/api/stock");

    expect(response.status).toBe(401);
    expect(deps.fetchImpl).not.toHaveBeenCalled();
    expect(deps.onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it("sur 401 : rafraichit le token et rejoue une seule fois", async () => {
    deps = setup(["stale-token", "fresh-token"]);
    deps.fetchImpl
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const response = await deps.apiFetch("/api/stock", { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(deps.getToken).toHaveBeenNthCalledWith(1, false);
    expect(deps.getToken).toHaveBeenNthCalledWith(2, true);
    expect(deps.fetchImpl).toHaveBeenCalledTimes(2);
    expect(deps.fetchImpl.mock.calls[1][1]?.method).toBe("DELETE");
    expect(headersOf(deps.fetchImpl.mock.calls[1]).get("Authorization")).toBe(
      "Bearer fresh-token",
    );
    expect(deps.onUnauthenticated).not.toHaveBeenCalled();
  });

  it("sur 401 persistant : redirige vers la connexion sans boucler", async () => {
    deps = setup(["stale-token", "still-bad"]);
    deps.fetchImpl.mockResolvedValue(new Response("{}", { status: 401 }));

    const response = await deps.apiFetch("/api/stock");

    expect(response.status).toBe(401);
    expect(deps.fetchImpl).toHaveBeenCalledTimes(2);
    expect(deps.onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it("sur 403 : signale le compte non autorise sans rejouer", async () => {
    deps.fetchImpl.mockResolvedValue(new Response("{}", { status: 403 }));

    const response = await deps.apiFetch("/api/stock");

    expect(response.status).toBe(403);
    expect(deps.fetchImpl).toHaveBeenCalledTimes(1);
    expect(deps.onForbidden).toHaveBeenCalledTimes(1);
    expect(deps.onUnauthenticated).not.toHaveBeenCalled();
  });

  it("transmet un FormData sans imposer de Content-Type (upload d'image)", async () => {
    deps.fetchImpl.mockResolvedValue(new Response("{}", { status: 201 }));
    const form = new FormData();
    form.append("file", new Blob(["img"], { type: "image/png" }), "a.png");

    await deps.apiFetch("/api/uploads/asset-image", { method: "POST", body: form });

    expect(deps.fetchImpl.mock.calls[0][1]?.body).toBe(form);
    expect(headersOf(deps.fetchImpl.mock.calls[0]).has("Content-Type")).toBe(false);
  });
});

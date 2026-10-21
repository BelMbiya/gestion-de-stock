export type ApiFetchDependencies = {
  /** ID token de la session courante ; null si personne n'est connecte. */
  getToken(forceRefresh: boolean): Promise<string | null>;
  fetchImpl?: typeof fetch;
  onUnauthenticated(): void;
  onForbidden(): void;
};

export type ApiFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Client des routes /api : porte le token Firebase et gere 401/403. */
export function createApiFetch(deps: ApiFetchDependencies): ApiFetch {
  const fetchImpl: typeof fetch = deps.fetchImpl ?? ((...args) => fetch(...args));

  function send(input: string, init: RequestInit | undefined, token: string) {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetchImpl(input, { ...init, headers });
  }

  return async function apiFetch(input, init) {
    const token = await deps.getToken(false);
    if (!token) {
      deps.onUnauthenticated();
      return Response.json({ error: "Non authentifie" }, { status: 401 });
    }

    let response = await send(input, init, token);

    if (response.status === 401) {
      // Token expire entre deux rafraichissements automatiques : un seul nouvel essai.
      const freshToken = await deps.getToken(true);
      if (freshToken) {
        response = await send(input, init, freshToken);
      }
      if (response.status === 401) {
        deps.onUnauthenticated();
        return response;
      }
    }

    if (response.status === 403) {
      deps.onForbidden();
    }

    return response;
  };
}

// Plusieurs appels paralleles peuvent echouer ensemble : une seule redirection.
let isRedirecting = false;

function redirectOnce(path: string, beforeRedirect?: () => Promise<void>) {
  if (isRedirecting) {
    return;
  }
  isRedirecting = true;
  void (beforeRedirect?.() ?? Promise.resolve()).finally(() => {
    window.location.assign(path);
  });
}

async function loadAuth() {
  const { auth } = await import("@/firebase");
  return auth;
}

export const apiFetch = createApiFetch({
  async getToken(forceRefresh) {
    const auth = await loadAuth();
    await auth.authStateReady();
    return auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : null;
  },
  onUnauthenticated() {
    redirectOnce("/sign-in");
  },
  onForbidden() {
    redirectOnce("/sign-in?reason=forbidden", async () => {
      const [{ signOut }, auth] = await Promise.all([import("firebase/auth"), loadAuth()]);
      await signOut(auth);
    });
  },
});

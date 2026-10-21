import { verifyFirebaseIdToken } from "./firebase-admin";
import { resolveAppUser } from "./resolve-app-user";
import type { AuthenticatedUser, TokenClaims } from "./types";

export type { AuthenticatedUser, TokenClaims } from "./types";

export type AuthDependencies = {
  verifyIdToken(token: string): Promise<TokenClaims>;
  resolveUser(claims: TokenClaims): Promise<AuthenticatedUser | null>;
};

export type AuthenticatedHandler<Context> = (
  request: Request,
  context: Context,
  user: AuthenticatedUser,
) => Response | Promise<Response>;

function readBearerToken(request: Request) {
  const match = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}

const unauthenticated = () => Response.json({ error: "Non authentifie" }, { status: 401 });
const forbidden = () => Response.json({ error: "Compte non autorise" }, { status: 403 });

/** Decorator : protege un route handler (401 sans token valide, 403 hors liste blanche). */
export function createWithAuth(deps: AuthDependencies) {
  return function withAuth<Context = unknown>(handler: AuthenticatedHandler<Context>) {
    return async function authenticatedRoute(request: Request, context: Context) {
      const token = readBearerToken(request);
      if (!token) {
        return unauthenticated();
      }

      let claims: TokenClaims;
      try {
        claims = await deps.verifyIdToken(token);
      } catch {
        return unauthenticated();
      }

      // Une panne de base doit remonter en 500, pas se deguiser en refus d'acces.
      const user = await deps.resolveUser(claims);
      if (!user) {
        return forbidden();
      }

      return handler(request, context, user);
    };
  };
}

export const withAuth = createWithAuth({
  verifyIdToken: verifyFirebaseIdToken,
  resolveUser: resolveAppUser,
});

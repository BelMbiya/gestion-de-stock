import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import type { TokenClaims } from "./types";

/**
 * verifyIdToken n'a besoin que du projectId : la signature est controlee avec
 * les cles publiques de Google. Aucune cle de compte de service n'est requise.
 */
function getAdminAuth() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID (ou NEXT_PUBLIC_FIREBASE_PROJECT_ID) est requis.");
  }

  return getAuth(getApps()[0] ?? initializeApp({ projectId }));
}

/** Verifie signature, audience (projet), emetteur et expiration du token. */
export async function verifyFirebaseIdToken(token: string): Promise<TokenClaims> {
  const decoded = await getAdminAuth().verifyIdToken(token);
  return {
    uid: decoded.uid,
    email: decoded.email,
    email_verified: decoded.email_verified,
  };
}

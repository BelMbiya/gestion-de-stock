import { prisma } from "@/lib/prisma";

import type { AuthenticatedUser, TokenClaims } from "./types";

export type AppUserStore = {
  findByFirebaseUid(uid: string): Promise<AuthenticatedUser | null>;
  findByEmail(email: string): Promise<AuthenticatedUser | null>;
  linkFirebaseUid(userId: string, uid: string): Promise<void>;
};

/**
 * Liste blanche : seul un compte present dans la table User est autorise.
 * La liaison par email n'est faite que si Firebase certifie l'email verifie,
 * sinon n'importe qui pourrait creer un compte avec l'email d'un admin.
 */
export function createResolveAppUser(store: AppUserStore) {
  return async function resolveAppUser(
    claims: TokenClaims,
  ): Promise<AuthenticatedUser | null> {
    const linked = await store.findByFirebaseUid(claims.uid);
    if (linked) {
      return linked;
    }

    const email = claims.email?.trim().toLowerCase();
    if (!email || claims.email_verified !== true) {
      return null;
    }

    const user = await store.findByEmail(email);
    if (!user) {
      return null;
    }

    await store.linkFirebaseUid(user.id, claims.uid);
    return user;
  };
}

const appUserSelect = { id: true, email: true, name: true, role: true } as const;

export const prismaAppUserStore: AppUserStore = {
  findByFirebaseUid: (firebaseUid) =>
    prisma.user.findUnique({ where: { firebaseUid }, select: appUserSelect }),
  findByEmail: (email) =>
    prisma.user.findUnique({ where: { email }, select: appUserSelect }),
  async linkFirebaseUid(id, firebaseUid) {
    await prisma.user.update({ where: { id }, data: { firebaseUid } });
  },
};

export const resolveAppUser = createResolveAppUser(prismaAppUserStore);

import { prisma } from "@/lib/prisma";

import type { AuthenticatedUser, TokenClaims } from "./types";

/** Ligne lue en base : « active » sert au controle d'acces et ne sort pas du resolveur. */
export type StoredAppUser = AuthenticatedUser & { active: boolean };

export type AppUserStore = {
  findByFirebaseUid(uid: string): Promise<StoredAppUser | null>;
  findByEmail(email: string): Promise<StoredAppUser | null>;
  linkFirebaseUid(userId: string, uid: string): Promise<void>;
};

/**
 * Liste blanche : seul un compte present dans la table User est autorise.
 * La liaison par email n'est faite que si Firebase certifie l'email verifie,
 * sinon n'importe qui pourrait creer un compte avec l'email d'un admin.
 * Un compte desactive (acces revoque) est refuse, qu'il soit deja relie ou non.
 */
function allowed({ active, ...user }: StoredAppUser): AuthenticatedUser | null {
  return active ? user : null;
}

export function createResolveAppUser(store: AppUserStore) {
  return async function resolveAppUser(
    claims: TokenClaims,
  ): Promise<AuthenticatedUser | null> {
    const linked = await store.findByFirebaseUid(claims.uid);
    if (linked) {
      return allowed(linked);
    }

    const email = claims.email?.trim().toLowerCase();
    if (!email || claims.email_verified !== true) {
      return null;
    }

    const user = await store.findByEmail(email);
    if (!user?.active) {
      return null;
    }

    await store.linkFirebaseUid(user.id, claims.uid);
    return allowed(user);
  };
}

const appUserSelect = { id: true, email: true, name: true, role: true, active: true } as const;

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

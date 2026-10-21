import type { UserRole } from "@/lib/generated/prisma/enums";

/** Ce que l'on retient d'un ID token Firebase verifie. */
export type TokenClaims = {
  uid: string;
  email?: string;
  email_verified?: boolean;
};

/** Utilisateur Stock IT autorise (DTO : uniquement les champs utiles aux handlers). */
export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
};

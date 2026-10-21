import type { MovementType, TrackingMode } from "@/lib/generated/prisma/enums";

import { StockRuleError } from "./errors";
import { getTrackingPolicy } from "./tracking-policy";

export const movementTypes = ["IN", "OUT", "RETURN", "ADJUSTMENT", "TRANSFER"] as const;

export const movementTypeLabels: Record<MovementType, string> = {
  IN: "Entree stock",
  OUT: "Sortie stock",
  RETURN: "Retour stock",
  ADJUSTMENT: "Ajustement",
  TRANSFER: "Transfert",
};

export type MovementAsset = {
  trackingMode: TrackingMode;
  quantityOnHand: number;
  locationId: string | null;
};

/** Saisie brute (corps de requete) : chaque champ est verifie ici. */
export type MovementInput = {
  type?: unknown;
  quantity?: unknown;
  delta?: unknown;
  reason?: unknown;
  toLocationId?: unknown;
  holderId?: unknown;
};

export type MovementPlan = {
  type: MovementType;
  /** Variation signee de la quantite (0 pour un transfert). */
  change: number;
  nextQuantity: number;
  toLocationId: string | null;
  reason: string | null;
  holderId: string | null;
};

function toInteger(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Calcule un mouvement de stock sans rien ecrire ; leve StockRuleError si la regle est violee. */
export function planMovement(asset: MovementAsset, input: MovementInput): MovementPlan {
  const type = movementTypes.find((candidate) => candidate === input.type);
  if (!type) {
    throw new StockRuleError(
      "Type de mouvement obligatoire : entree, sortie, retour, ajustement ou transfert.",
    );
  }

  if (!getTrackingPolicy(asset.trackingMode).allowedMovements.includes(type)) {
    throw new StockRuleError(
      "Materiel unitaire : utilisez une affectation, un retour ou « Changer l'etat ». " +
        "Seul le transfert de site est un mouvement.",
    );
  }

  const reason = optionalText(input.reason);
  const holderId = optionalText(input.holderId);
  if (holderId && type !== "OUT") {
    throw new StockRuleError("Un beneficiaire ne peut etre indique que sur une sortie de stock.");
  }

  const base = { type, reason, holderId, toLocationId: null };

  if (type === "TRANSFER") {
    if (input.quantity !== undefined && input.quantity !== null && toInteger(input.quantity) !== asset.quantityOnHand) {
      throw new StockRuleError(
        "Transfert partiel impossible : un article en vrac est sur un seul site, transferez la ligne entiere.",
      );
    }
    const toLocationId = optionalText(input.toLocationId);
    if (!toLocationId) {
      throw new StockRuleError("Le transfert requiert un site de destination.");
    }
    if (toLocationId === asset.locationId) {
      throw new StockRuleError("Le site de destination est le meme site que le site actuel.");
    }
    return { ...base, change: 0, nextQuantity: asset.quantityOnHand, toLocationId };
  }

  if (type === "ADJUSTMENT") {
    const delta = toInteger(input.delta);
    if (!Number.isInteger(delta) || delta === 0) {
      throw new StockRuleError("L'ajustement est un ecart entier non nul (ex. +3 ou -2).");
    }
    if (!reason) {
      throw new StockRuleError("Le motif est obligatoire pour un ajustement.");
    }
    const nextQuantity = asset.quantityOnHand + delta;
    if (nextQuantity < 0) {
      throw new StockRuleError(
        `L'ajustement ferait passer le stock sous 0 (${asset.quantityOnHand} en stock).`,
      );
    }
    return { ...base, change: delta, nextQuantity };
  }

  const quantity = toInteger(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new StockRuleError("Quantite invalide : un entier superieur ou egal a 1 est attendu.");
  }
  if (type === "OUT" && quantity > asset.quantityOnHand) {
    throw new StockRuleError(`Stock insuffisant (${asset.quantityOnHand} disponible(s)).`);
  }

  const change = type === "OUT" ? -quantity : quantity;
  return { ...base, change, nextQuantity: asset.quantityOnHand + change };
}

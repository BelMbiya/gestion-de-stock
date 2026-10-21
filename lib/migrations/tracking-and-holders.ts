import type { HolderType, TrackingMode } from "@/lib/generated/prisma/enums";
import {
  classifyHolderType,
  isUnknownHolderName,
  normalizeHolderName,
  UNKNOWN_HOLDER_NAME,
} from "@/lib/holders/holder-names";

export { normalizeHolderName, UNKNOWN_HOLDER_NAME };

/** Feuilles Excel dont les lignes sont des quantites (et non des materiels numerotes). */
const BULK_GROUPS = new Set(["IN STORE", "OTHER ASSETS"]);

export function trackingModeForGroup(assetGroup: string | null | undefined): TrackingMode {
  return BULK_GROUPS.has((assetGroup ?? "").trim().toUpperCase()) ? "BULK" : "SERIALIZED";
}

export type MigrationSnapshot = {
  assets: Array<{
    id: string;
    assetGroup: string | null;
    custodianName: string | null;
    processLabel: string | null;
    status: string;
    trackingMode: string | null;
  }>;
  assignments: Array<{
    id: string;
    assetId: string;
    status: string;
    holderId: string | null;
    kind: string | null;
  }>;
  holders: Array<{ id: string; fullName: string; type: string }>;
};

export type MigrationAnomaly = {
  type: "HOLDER_UNKNOWN" | "LOST_WITH_ACTIVE_ASSIGNMENT" | "NO_CUSTODIAN";
  assignmentId: string;
  assetId: string;
  detail: string;
};

export type MigrationPlan = {
  assetModes: Array<{ assetId: string; trackingMode: TrackingMode }>;
  holdersToCreate: Array<{ key: string; fullName: string; type: HolderType; process: string | null }>;
  assignmentLinks: Array<{ assignmentId: string; holderKey: string; kind: "DOTATION" }>;
  anomalies: MigrationAnomaly[];
  summary: {
    serialized: number;
    bulk: number;
    holders: number;
    dotations: number;
    anomalies: number;
    changes: number;
  };
};

/** Cle du detenteur pour un nom de l'Excel ; null si aucun nom. */
export function holderKeyFor(custodianName: string | null) {
  if (custodianName === null || custodianName.trim() === "") return null;
  const name = isUnknownHolderName(custodianName) ? UNKNOWN_HOLDER_NAME : custodianName;
  return normalizeHolderName(name);
}

/**
 * Plan de migration pur (aucune ecriture) : sert au rapport a blanc puis a l'application.
 * Rejoue sur une base deja migree, il ne propose aucun changement (idempotent).
 */
export function planTrackingAndHoldersMigration(snapshot: MigrationSnapshot): MigrationPlan {
  const assetsById = new Map(snapshot.assets.map((asset) => [asset.id, asset]));

  const assetModes = snapshot.assets.flatMap((asset) => {
    const trackingMode = trackingModeForGroup(asset.assetGroup);
    return asset.trackingMode === trackingMode ? [] : [{ assetId: asset.id, trackingMode }];
  });

  // Detenteurs a creer : un par nom distinct, process repris s'il est unique.
  const existingKeys = new Set(snapshot.holders.map((holder) => normalizeHolderName(holder.fullName).key));
  const candidates = new Map<string, { fullName: string; processes: Set<string> }>();
  for (const asset of snapshot.assets) {
    const name = holderKeyFor(asset.custodianName);
    if (!name || existingKeys.has(name.key)) continue;
    const candidate = candidates.get(name.key) ?? { fullName: name.display, processes: new Set<string>() };
    if (asset.processLabel?.trim()) candidate.processes.add(asset.processLabel.trim());
    candidates.set(name.key, candidate);
  }
  const holdersToCreate = [...candidates].map(([key, candidate]) => ({
    key,
    fullName: candidate.fullName,
    type: classifyHolderType(candidate.fullName),
    process: candidate.processes.size === 1 ? [...candidate.processes][0] : null,
  }));

  const assignmentLinks: MigrationPlan["assignmentLinks"] = [];
  const anomalies: MigrationAnomaly[] = [];

  for (const assignment of snapshot.assignments) {
    const asset = assetsById.get(assignment.assetId);
    const name = holderKeyFor(asset?.custodianName ?? null);

    if (assignment.holderId === null) {
      if (name) {
        assignmentLinks.push({ assignmentId: assignment.id, holderKey: name.key, kind: "DOTATION" });
      } else {
        anomalies.push({
          type: "NO_CUSTODIAN",
          assignmentId: assignment.id,
          assetId: assignment.assetId,
          detail: "Affectation sans nom de detenteur dans l'Excel : a rattacher a la main.",
        });
      }
    }

    if (assignment.status !== "ACTIVE" || !asset) continue;

    if (isUnknownHolderName(asset.custodianName) && asset.custodianName !== null && asset.custodianName.trim() !== "") {
      anomalies.push({
        type: "HOLDER_UNKNOWN",
        assignmentId: assignment.id,
        assetId: asset.id,
        detail: `Detenteur « ${asset.custodianName.trim()} » dans l'Excel : rattache a « ${UNKNOWN_HOLDER_NAME} », a identifier.`,
      });
    }
    if (asset.status === "LOST") {
      anomalies.push({
        type: "LOST_WITH_ACTIVE_ASSIGNMENT",
        assignmentId: assignment.id,
        assetId: asset.id,
        detail: "Materiel perdu encore affecte : enregistrer le retour « perdu » pour cloturer.",
      });
    }
  }

  const serialized = snapshot.assets.filter((asset) => trackingModeForGroup(asset.assetGroup) === "SERIALIZED").length;

  return {
    assetModes,
    holdersToCreate,
    assignmentLinks,
    anomalies,
    summary: {
      serialized,
      bulk: snapshot.assets.length - serialized,
      holders: holdersToCreate.length,
      dotations: assignmentLinks.length,
      anomalies: anomalies.length,
      changes: assetModes.length + holdersToCreate.length + assignmentLinks.length,
    },
  };
}

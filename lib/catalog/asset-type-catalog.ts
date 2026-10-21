import type { TrackingMode } from "@/lib/generated/prisma/enums";

/** Familles = categories de l'application. L'ordre est celui de l'affichage. */
export const ASSET_FAMILIES = [
  { code: "INFO", name: "Informatique" },
  { code: "PERI", name: "Périphériques" },
  { code: "RES", name: "Réseau" },
  { code: "ENE", name: "Énergie" },
  { code: "MOB", name: "Mobilier" },
  { code: "EQP", name: "Équipements" },
  { code: "VEH", name: "Véhicules" },
] as const;

export type AssetFamilyName = (typeof ASSET_FAMILIES)[number]["name"];

export type AssetTypeDefinition = {
  prefix: string;
  name: string;
  family: AssetFamilyName;
  defaultTrackingMode: TrackingMode;
  /** Motif de reconnaissance d'un nom de l'Excel (insensible a la casse). */
  pattern: RegExp;
};

/**
 * Catalogue des types, dans l'ORDRE DE PRIORITE du classement : le plus specifique d'abord
 * (« lenovo battery » est une batterie avant d'etre un Lenovo, « Stabiliser Server » un stabilisateur).
 * Toute modification des motifs doit etre reportee dans la migration SQL 20261022100000.
 */
export const ASSET_TYPE_CATALOG: readonly AssetTypeDefinition[] = [
  { prefix: "BAT", name: "Batterie", family: "Périphériques", defaultTrackingMode: "BULK", pattern: /batter(y|ie)/i },
  { prefix: "CBL", name: "Câble", family: "Périphériques", defaultTrackingMode: "BULK", pattern: /c[aâ]ble/i },
  { prefix: "ENR", name: "Onduleur / stabilisateur", family: "Énergie", defaultTrackingMode: "SERIALIZED", pattern: /\bups\b|stabili[sz]er|electrical modul|onduleur/i },
  { prefix: "SRV", name: "Serveur / baie", family: "Informatique", defaultTrackingMode: "SERIALIZED", pattern: /server|serveur|\brack\b/i },
  { prefix: "PRN", name: "Imprimante", family: "Périphériques", defaultTrackingMode: "SERIALIZED", pattern: /deskjet|laser ?jet|printer|imprimante/i },
  { prefix: "SCN", name: "Scanner", family: "Périphériques", defaultTrackingMode: "SERIALIZED", pattern: /scanner/i },
  { prefix: "POI", name: "Pointeuse", family: "Équipements", defaultTrackingMode: "SERIALIZED", pattern: /lecteurs? de pr.sence|pointeuse/i },
  { prefix: "OUT", name: "Outillage / EPI", family: "Équipements", defaultTrackingMode: "SERIALIZED", pattern: /drilling|grinder|blower|\bsaw\b|goggles|viewfinder/i },
  { prefix: "LAP", name: "Laptop", family: "Informatique", defaultTrackingMode: "SERIALIZED", pattern: /laptop|lenovo|asus|\bdell\b/i },
  { prefix: "DSK", name: "Ordinateur de bureau", family: "Informatique", defaultTrackingMode: "SERIALIZED", pattern: /desktop|\bcomputers?\b/i },
  { prefix: "MON", name: "Écran", family: "Informatique", defaultTrackingMode: "SERIALIZED", pattern: /monitor|[eé]cran/i },
  { prefix: "TV", name: "Téléviseur", family: "Périphériques", defaultTrackingMode: "SERIALIZED", pattern: /\btv\b|t[eé]l[eé]viseur/i },
  { prefix: "MS", name: "Souris", family: "Périphériques", defaultTrackingMode: "BULK", pattern: /mouse|souris/i },
  { prefix: "KB", name: "Clavier", family: "Périphériques", defaultTrackingMode: "BULK", pattern: /keyboard|clavier/i },
  { prefix: "HS", name: "Casque", family: "Périphériques", defaultTrackingMode: "BULK", pattern: /headset|casque/i },
  { prefix: "WCM", name: "Webcam", family: "Périphériques", defaultTrackingMode: "BULK", pattern: /webcam/i },
  { prefix: "SW", name: "Switch", family: "Réseau", defaultTrackingMode: "SERIALIZED", pattern: /switch/i },
  { prefix: "FW", name: "Pare-feu", family: "Réseau", defaultTrackingMode: "SERIALIZED", pattern: /firewall|fortinet|pare-feu/i },
  { prefix: "MDM", name: "Modem", family: "Réseau", defaultTrackingMode: "BULK", pattern: /modem/i },
  { prefix: "PRJ", name: "Projecteur", family: "Périphériques", defaultTrackingMode: "SERIALIZED", pattern: /projector|projecteur/i },
  { prefix: "EXT", name: "Rallonge", family: "Énergie", defaultTrackingMode: "BULK", pattern: /extension|rallonge/i },
  { prefix: "CHR", name: "Chaise", family: "Mobilier", defaultTrackingMode: "BULK", pattern: /chair|chaise/i },
  { prefix: "TBL", name: "Table", family: "Mobilier", defaultTrackingMode: "BULK", pattern: /\btable\b/i },
  { prefix: "ARM", name: "Armoire / casier", family: "Mobilier", defaultTrackingMode: "BULK", pattern: /cupboard|locker|armoire|casier/i },
  { prefix: "CLM", name: "Climatiseur", family: "Équipements", defaultTrackingMode: "SERIALIZED", pattern: /air conditioner|climatiseur/i },
  { prefix: "ELM", name: "Électroménager", family: "Équipements", defaultTrackingMode: "BULK", pattern: /kettle|water fountain|fontaine|bouilloire/i },
  { prefix: "VEH", name: "Véhicule", family: "Véhicules", defaultTrackingMode: "SERIALIZED", pattern: /toyota|v[eé]hicule/i },
];

const byPrefix = new Map(ASSET_TYPE_CATALOG.map((type) => [type.prefix, type]));

export function findAssetTypeDefinition(prefix: string) {
  return byPrefix.get(prefix) ?? null;
}

/** Type reconnu pour un nom de materiel, ou null (jamais de type devine). */
export function classifyAssetName(name: string): string | null {
  const value = name.trim();
  if (!value) return null;
  return ASSET_TYPE_CATALOG.find((type) => type.pattern.test(value))?.prefix ?? null;
}

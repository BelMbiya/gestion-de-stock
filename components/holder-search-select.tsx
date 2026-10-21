"use client";

import { AssetSearchSelect } from "@/components/asset-search-select";

export type HolderOption = {
  id: string;
  fullName: string;
  typeLabel: string;
  process?: string | null;
  department?: string | null;
};

type HolderSearchSelectProps = {
  holders: HolderOption[];
  label?: string;
  onValueChange: (holderId: string) => void;
  required?: boolean;
  value: string;
};

/** Recherche d'un detenteur par nom, type, process ou departement. */
export function HolderSearchSelect({
  holders,
  label = "Detenteur",
  onValueChange,
  required,
  value,
}: HolderSearchSelectProps) {
  return (
    <AssetSearchSelect
      assets={holders.map((holder) => ({
        id: holder.id,
        name: holder.fullName,
        sku: holder.typeLabel,
        model: [holder.department, holder.process].filter(Boolean).join(" · ") || null,
      }))}
      label={label}
      onValueChange={onValueChange}
      placeholder="Rechercher un detenteur (nom, process, departement)"
      required={required}
      value={value}
    />
  );
}

"use client";

import type { ReactNode } from "react";
import { History, Pencil } from "lucide-react";
import Link from "next/link";

import { AssetImageThumb } from "@/components/asset-image-thumb";
import { CopyReferenceButton } from "@/components/copy-reference-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ArticleDetailData = {
  id: string;
  sku: string;
  barcode: string | null;
  serialNumber: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  imageUrl: string | null;
  category: string;
  location: string;
  supplier: string;
  status: string;
  condition: string;
  unit: string;
  quantityOnHand: number;
  minQuantity: number;
  reorderPoint: number;
  maxQuantity: number | null;
  stockStatusLabel: string;
  assignedTo: string;
  openIncident: string | null;
  value: string;
  purchaseValue: string;
  purchaseDate: string;
  warrantyUntil: string;
  createdAt?: string;
  updatedAt?: string;
};

function DetailField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  const empty =
    value === null ||
    value === undefined ||
    value === "" ||
    value === "-";

  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-white break-words">
        {empty ? "—" : value}
      </p>
    </div>
  );
}

function StockBadge({ status }: { status: string }) {
  if (status === "OUT" || status === "Rupture") {
    return <Badge className="bg-[#ff2f45]/20 text-[#ff9aa5]">{status}</Badge>;
  }
  if (status === "LOW" || status === "Stock bas") {
    return <Badge className="bg-amber-500/20 text-amber-200">{status}</Badge>;
  }
  if (status === "OVER" || status === "Surstock") {
    return <Badge className="bg-purple-500/20 text-purple-200">{status}</Badge>;
  }
  return <Badge className="bg-white/10 text-white">{status}</Badge>;
}

type ArticleDetailDialogProps = {
  asset: ArticleDetailData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onTrace: () => void;
};

export function ArticleDetailDialog({
  asset,
  open,
  onOpenChange,
  onEdit,
  onTrace,
}: ArticleDetailDialogProps) {
  if (!asset) {
    return null;
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="!flex max-h-[min(92vh,52rem)] w-[min(calc(100vw-2rem),42rem)] max-w-none flex-col gap-0 overflow-hidden border-white/10 bg-[#11183b] p-0 text-white sm:max-w-none">
        <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5">
          <div className="flex gap-4">
            <AssetImageThumb
              alt={asset.name}
              className="shrink-0"
              imageUrl={asset.imageUrl}
              size="lg"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <DialogTitle className="text-left text-xl leading-tight">
                {asset.name}
              </DialogTitle>
              <DialogDescription className="text-left font-mono text-sm text-[#6fb6ff]">
                {asset.sku}
              </DialogDescription>
              <div className="flex flex-wrap gap-2">
                <StockBadge status={asset.stockStatusLabel} />
                <Badge className="bg-white/10">{asset.status}</Badge>
                <Badge className="bg-white/6 text-slate-300">{asset.condition}</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {asset.description ? (
            <p className="mb-5 rounded-lg border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-300">
              {asset.description}
            </p>
          ) : null}

          <section className="mb-5">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#6fb6ff]">
              Identification
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Code-barres" value={asset.barcode} />
              <DetailField label="N° serie" value={asset.serialNumber} />
              <DetailField label="Marque" value={asset.brand} />
              <DetailField label="Modele" value={asset.model} />
              <DetailField label="Categorie" value={asset.category} />
            </div>
          </section>

          <section className="mb-5">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#6fb6ff]">
              Stock
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField
                label="Quantite en stock"
                value={`${asset.quantityOnHand} ${asset.unit}`}
              />
              <DetailField label="Stock minimum" value={String(asset.minQuantity)} />
              <DetailField
                label="Seuil reapprovisionnement"
                value={String(asset.reorderPoint)}
              />
              <DetailField
                label="Stock maximum"
                value={
                  asset.maxQuantity != null ? String(asset.maxQuantity) : null
                }
              />
            </div>
          </section>

          <section className="mb-5">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#6fb6ff]">
              Localisation et fournisseur
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Emplacement" value={asset.location} />
              <DetailField label="Fournisseur" value={asset.supplier} />
              <DetailField label="Affecte a" value={asset.assignedTo} />
            </div>
          </section>

          <section className="mb-5">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#6fb6ff]">
              Valeur et dates
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Valeur estimee" value={asset.value} />
              <DetailField
                label="Prix d'achat (USD)"
                value={asset.purchaseValue ? `$${asset.purchaseValue}` : null}
              />
              <DetailField label="Date d'achat" value={asset.purchaseDate} />
              <DetailField label="Fin de garantie" value={asset.warrantyUntil} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#6fb6ff]">
              Suivi
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Panne ouverte
                </p>
                {asset.openIncident ? (
                  <div className="mt-0.5 flex items-center gap-1">
                    <Link
                      className="text-sm text-[#6fb6ff] hover:underline"
                      href={`/pannes?ref=${asset.openIncident}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {asset.openIncident}
                    </Link>
                    <CopyReferenceButton value={asset.openIncident} />
                  </div>
                ) : (
                  <p className="mt-0.5 text-sm text-white">—</p>
                )}
              </div>
              {asset.createdAt ? (
                <DetailField label="Cree le" value={asset.createdAt} />
              ) : null}
              {asset.updatedAt ? (
                <DetailField label="Modifie le" value={asset.updatedAt} />
              ) : null}
            </div>
          </section>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-white/10 px-6 py-4">
          <Button
            className="bg-white/10"
            onClick={() => {
              onOpenChange(false);
              onEdit();
            }}
            type="button"
          >
            <Pencil className="size-4" />
            Modifier
          </Button>
          <Button
            className="bg-[#6fb6ff]/20 text-white"
            onClick={() => {
              onOpenChange(false);
              onTrace();
            }}
            type="button"
          >
            <History className="size-4" />
            Tracabilite
          </Button>
          <Button
            className="ml-auto bg-white/6 text-slate-300"
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

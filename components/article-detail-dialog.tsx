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

import {
  KYC_IN_STORE_COLUMNS,
  KYC_OTHER_ASSETS_COLUMNS,
  KYC_SHEET_LABELS,
  KYC_UI,
} from "@/lib/kyc-excel/terminology";

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
  systemOs?: string | null;
  storageRam?: string | null;
  ownerLabel?: string | null;
  custodianName?: string | null;
  workstationCode?: string | null;
  processLabel?: string | null;
  assetGroup?: string | null;
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
              <DetailField label={KYC_UI.BARCODE} value={asset.barcode} />
              <DetailField label={KYC_UI.SERIAL_NUMBER} value={asset.serialNumber} />
              <DetailField label={KYC_OTHER_ASSETS_COLUMNS.BRAND} value={asset.brand} />
              <DetailField label={KYC_UI.MODEL} value={asset.model} />
              <DetailField label={KYC_UI.CATEGORY} value={asset.category} />
              <DetailField label={KYC_UI.GROUP} value={asset.assetGroup} />
              <DetailField label={KYC_UI.WORK_STATION} value={asset.workstationCode} />
              <DetailField label={KYC_UI.PROCESS} value={asset.processLabel} />
            </div>
          </section>

          <section className="mb-5">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              Configuration
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label={KYC_UI.SYSTEM} value={asset.systemOs} />
              <DetailField label={KYC_UI.HDD_RAM} value={asset.storageRam} />
            </div>
          </section>

          <section className="mb-5">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              {KYC_SHEET_LABELS.IN_STORE}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField
                label={KYC_IN_STORE_COLUMNS.NUMBER}
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
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              {KYC_UI.LOCATION} & {KYC_IN_STORE_COLUMNS.VENDOR}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label={KYC_UI.LOCATION} value={asset.location} />
              <DetailField label={KYC_IN_STORE_COLUMNS.VENDOR} value={asset.supplier} />
              <DetailField label={KYC_UI.OWNER} value={asset.ownerLabel} />
              <DetailField
                label={KYC_UI.DESIGNATED_CUSTODIAN}
                value={asset.custodianName ?? asset.assignedTo}
              />
            </div>
          </section>

          <section className="mb-5">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              Valeur et dates
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label={KYC_UI.ASSET_VALUE} value={asset.value} />
              <DetailField
                label={KYC_UI.PURCHASE_PRICE}
                value={asset.purchaseValue ? `$${asset.purchaseValue}` : null}
              />
              <DetailField label={KYC_UI.PURCHASE_DATE} value={asset.purchaseDate} />
              <DetailField label={KYC_UI.WARRANTY_UNTIL} value={asset.warrantyUntil} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#6fb6ff]">
              Suivi
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {KYC_UI.OPEN_INCIDENT}
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
                <DetailField label={KYC_UI.CREATED_AT} value={asset.createdAt} />
              ) : null}
              {asset.updatedAt ? (
                <DetailField label={KYC_UI.UPDATED_AT} value={asset.updatedAt} />
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

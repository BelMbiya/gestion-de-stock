"use client";

import { Database, MapPin, Plus, Search } from "lucide-react";

import { AssetImageThumb } from "@/components/asset-image-thumb";
import { AssetImageUpload } from "@/components/asset-image-upload";
import { ExportPdfButton } from "@/components/export-pdf-button";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { KYC_IN_STORE_COLUMNS, KYC_PROCO_COLUMNS, KYC_SHEET_LABELS, KYC_UI, KYC_WORKSTATION_COLUMNS } from "@/lib/kyc-excel/terminology";
import { ui } from "@/lib/ui-styles";

type InventoryAsset = {
  id: string;
  sku: string;
  serialNumber: string | null;
  name: string;
  model: string | null;
  brand: string | null;
  imageUrl: string | null;
  category: string;
  location: string;
  status: string;
  assignedTo: string;
  custodianName: string | null;
  ownerLabel: string | null;
  workstationCode: string | null;
  processLabel: string | null;
  assetGroup: string | null;
  systemOs: string | null;
  storageRam: string | null;
  openIncident: string | null;
  value: string;
  updatedAt: string;
};

type ReferenceItem = {
  id: string;
  name: string;
};

type InventoryForm = {
  categoryId: string;
  locationId: string;
  name: string;
  purchaseValue: string;
  serialNumber: string;
  sku: string;
  status: string;
  imageUrl: string;
};

const emptyForm: InventoryForm = {
  categoryId: "",
  locationId: "",
  name: "",
  purchaseValue: "",
  serialNumber: "",
  sku: "",
  status: "AVAILABLE",
  imageUrl: "",
};

const statusToFormValue: Record<string, string> = {
  Assigne: "ASSIGNED",
  Critique: "BROKEN",
  Disponible: "AVAILABLE",
  Maintenance: "MAINTENANCE",
  Perdu: "LOST",
  Reforme: "RETIRED",
};

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Critique" || status === "Perdu"
      ? "bg-red-900/40 text-red-200"
      : status === "Maintenance" || status === "Assigne"
        ? "bg-slate-700 text-slate-200"
        : "bg-slate-800 text-slate-300";

  return <Badge className={tone}>{status}</Badge>;
}


export function InventoryContent() {
  const [assets, setAssets] = useState<InventoryAsset[]>([]);
  const [categories, setCategories] = useState<ReferenceItem[]>([]);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [locations, setLocations] = useState<ReferenceItem[]>([]);
  const [form, setForm] = useState<InventoryForm>(emptyForm);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const filteredAssets = assets.filter((asset) => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      return true;
    }

    return [
      asset.assignedTo,
      asset.assetGroup ?? "",
      asset.brand ?? "",
      asset.category,
      asset.custodianName ?? "",
      asset.location,
      asset.model ?? "",
      asset.name,
      asset.openIncident ?? "",
      asset.processLabel ?? "",
      asset.serialNumber ?? "",
      asset.sku,
      asset.status,
      asset.systemOs ?? "",
      asset.workstationCode ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  async function loadInventory() {
    try {
      const response = await fetch("/api/inventory", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Inventory API failed");
      }

      const data = await response.json();
      setAssets(data.assets);
      setCategories(data.categories);
      setLocations(data.locations);
    } catch {
      setError("Impossible de charger l'inventaire depuis la base.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInventory();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = editingAssetId
      ? `/api/inventory/${editingAssetId}`
      : "/api/inventory";
    const method = editingAssetId ? "PATCH" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setForm(emptyForm);
    setEditingAssetId(null);
    setIsFormOpen(false);
    await loadInventory();
  }

  function handleEdit(asset: InventoryAsset) {
    const category = categories.find((item) => item.name === asset.category);
    const location = locations.find((item) => item.name === asset.location);

    setEditingAssetId(asset.id);
    setIsFormOpen(true);
    setForm({
      categoryId: category?.id ?? "",
      locationId: location?.id ?? "",
      name: asset.name,
      purchaseValue: asset.value === "-" ? "" : asset.value.replace("$", ""),
      serialNumber: asset.serialNumber ?? "",
      sku: asset.sku,
      status: statusToFormValue[asset.status] ?? "AVAILABLE",
      imageUrl: asset.imageUrl ?? "",
    });
  }

  async function handleDelete(id: string) {
    await fetch(`/api/inventory/${id}`, {
      method: "DELETE",
    });
    await loadInventory();
  }

  return (
    <section className={ui.page}>
        <header className={`${ui.header} md:flex md:items-center md:justify-between`}>
          <div>
            <p className={ui.eyebrow}>{KYC_SHEET_LABELS.PROCO_KYC_CALL_IT_EQUIPEMENT}</p>
            <h1 className={ui.title}>{KYC_SHEET_LABELS.PROCO_KYC_CALL_IT_EQUIPEMENT}</h1>
            <p className={ui.subtitle}>
              {isLoading ? "Chargement..." : `${assets.length} actif(s) en base`}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 md:mt-0">
            <ExportPdfButton
              disabled={isLoading}
              filename="inventaire-kyc"
              sections={[
                {
                  columns: [
                    KYC_PROCO_COLUMNS.NO,
                    KYC_WORKSTATION_COLUMNS.WORK_STATION,
                    KYC_PROCO_COLUMNS.DESCRIPTION,
                    KYC_PROCO_COLUMNS.SERIAL_NUMBER,
                    "Categorie",
                    KYC_PROCO_COLUMNS.LOCATION,
                    KYC_PROCO_COLUMNS.DESIGNATED_CUSTODIAN,
                    KYC_PROCO_COLUMNS.STATUS,
                  ],
                  rows: filteredAssets.map((asset) => [
                    asset.sku,
                    asset.workstationCode ?? "-",
                    asset.name,
                    asset.serialNumber ?? "-",
                    asset.category,
                    asset.location,
                    asset.custodianName ?? asset.assignedTo,
                    asset.status,
                  ]),
                },
              ]}
              subtitle={`${filteredAssets.length} ligne(s)`}
              title="Inventaire KYC"
            />
            <Button className={ui.btnSecondary} onClick={() => setIsActionOpen(true)} type="button">
              Actions
            </Button>
            <Button
              className={ui.btnPrimary}
              onClick={() => {
                setEditingAssetId(null);
                setForm(emptyForm);
                setIsFormOpen(true);
              }}
              type="button"
            >
              <Plus className="size-4" />
              Ajouter
            </Button>
          </div>
        </header>

        <Dialog onOpenChange={setIsActionOpen} open={isActionOpen}>
          <DialogContent className="w-[min(calc(100vw-2rem),34rem)] max-w-none border-white/10 bg-[#11183b] p-6 text-white sm:max-w-none">
            <DialogHeader>
              <DialogTitle>Actions rapides</DialogTitle>
              <DialogDescription className="text-slate-400">
                Choisissez une operation liee au cycle de vie du materiel IT.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <Link className="flex items-center justify-between rounded border border-white/10 px-3 py-2 text-sm hover:bg-slate-800" href="/affectations">
                Allouer {KYC_IN_STORE_COLUMNS.ITEM}
              </Link>
              <Link className="flex items-center justify-between rounded border border-white/10 px-3 py-2 text-sm hover:bg-slate-800" href="/mouvements">
                Mouvement de stock
              </Link>
              <Link className="flex items-center justify-between rounded border border-white/10 px-3 py-2 text-sm hover:bg-slate-800" href="/pannes">
                Declarer une panne
              </Link>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog onOpenChange={setIsFormOpen} open={isFormOpen}>
          <DialogContent className="w-[min(calc(100vw-2rem),52rem)] max-w-none border-white/10 bg-[#11183b] p-6 text-white sm:max-w-none">
            <DialogHeader>
              <DialogTitle>
                {editingAssetId
                  ? `Modifier ${KYC_IN_STORE_COLUMNS.ITEM}`
                  : `Ajouter ${KYC_IN_STORE_COLUMNS.ITEM}`}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Renseignez le prix d&apos;achat et le statut operationnel du
                materiel. La colonne Panne affiche automatiquement une panne
                ouverte liee a l&apos;actif.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4 md:grid-cols-2 [&_input]:h-11 [&_select]:h-11"
              onSubmit={handleSubmit}
            >
              <Input
                className="border-white/10 bg-white/6 text-white"
                onChange={(event) =>
                  setForm((value) => ({ ...value, sku: event.target.value }))
                }
                placeholder={KYC_PROCO_COLUMNS.NO}
                required
                value={form.sku}
              />
              <Input
                className="border-white/10 bg-white/6 text-white"
                onChange={(event) =>
                  setForm((value) => ({ ...value, name: event.target.value }))
                }
                placeholder={KYC_PROCO_COLUMNS.DESCRIPTION}
                required
                value={form.name}
              />
              <Input
                className="border-white/10 bg-white/6 text-white"
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    serialNumber: event.target.value,
                  }))
                }
                placeholder={KYC_PROCO_COLUMNS.SERIAL_NUMBER}
                value={form.serialNumber}
              />
              <div className="md:col-span-2">
                <AssetImageUpload
                  alt={form.name || KYC_UI.PHOTO}
                  imageUrl={form.imageUrl || null}
                  onImageUrlChange={(url) =>
                    setForm((value) => ({ ...value, imageUrl: url ?? "" }))
                  }
                />
              </div>
              <select
                className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm text-white"
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    categoryId: event.target.value,
                  }))
                }
                required
                value={form.categoryId}
              >
                <option value="">Categorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm text-white"
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    locationId: event.target.value,
                  }))
                }
                value={form.locationId}
              >
                <option value="">{KYC_PROCO_COLUMNS.LOCATION}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Valeur d&apos;achat (USD)
                <Input
                  aria-label="Valeur d'achat"
                  className="border-white/10 bg-white/6 text-white"
                  inputMode="decimal"
                  min="0"
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      purchaseValue: event.target.value,
                    }))
                  }
                  placeholder="Ex. 1240"
                  step="0.01"
                  type="number"
                  value={form.purchaseValue}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Statut ({KYC_PROCO_COLUMNS.STATUS})
                <select
                  aria-label={KYC_PROCO_COLUMNS.STATUS}
                  className="h-11 rounded-lg border border-white/10 bg-[#11183b] px-3 text-sm text-white"
                  onChange={(event) =>
                    setForm((value) => ({ ...value, status: event.target.value }))
                  }
                  value={form.status}
                >
                  <option value="AVAILABLE">Disponible</option>
                  <option value="ASSIGNED">Assigne</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="BROKEN">Critique</option>
                  <option value="RETIRED">Reforme</option>
                  <option value="LOST">Perdu</option>
                </select>
              </label>
              <div className="flex gap-2 md:col-span-2">
                <Button
                  className="flex-1 bg-[#ff2f45] text-white hover:bg-[#ff4b5e]"
                  type="submit"
                >
                  {editingAssetId ? "Enregistrer" : "Ajouter"}
                </Button>
                {editingAssetId ? (
                  <Button
                    className="bg-[#ff2f45]/20 text-[#ff7a88] hover:bg-[#ff2f45]/30"
                    onClick={async () => {
                      await handleDelete(editingAssetId);
                      setEditingAssetId(null);
                      setForm(emptyForm);
                      setIsFormOpen(false);
                    }}
                    type="button"
                  >
                    Supprimer
                  </Button>
                ) : null}
                {editingAssetId ? (
                  <Button
                    className="bg-white/10 text-white hover:bg-white/15"
                    onClick={() => {
                      setEditingAssetId(null);
                      setForm(emptyForm);
                      setIsFormOpen(false);
                    }}
                    type="button"
                  >
                    Annuler
                  </Button>
                ) : null}
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Card className={`${ui.panel} ${ui.tablePanel}`}>
          <CardHeader className={`${ui.panelHeader} gap-3 md:grid md:grid-cols-[1fr_18rem]`}>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Database className="size-4" />
              Liste des actifs
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                className={`${ui.input} pl-9`}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={`${KYC_PROCO_COLUMNS.NO}, ${KYC_PROCO_COLUMNS.SERIAL_NUMBER}, ${KYC_PROCO_COLUMNS.DESIGNATED_CUSTODIAN}, ${KYC_PROCO_COLUMNS.LOCATION}…`}
                value={searchQuery}
              />
            </div>
          </CardHeader>
          <CardContent className={ui.tablePanelBody}>
            {error ? (
              <p className="rounded-xl bg-[#ff2f45]/15 p-4 text-sm text-[#ff91a0]">
                {error}
              </p>
            ) : null}
            {!error && isLoading ? (
              <p className="rounded-xl bg-white/6 p-4 text-sm text-slate-300">
                Chargement de l&apos;inventaire...
              </p>
            ) : null}
            {!error && !isLoading ? (
              <div className={ui.tableWrap}>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    {[
                      "Photo",
                      KYC_PROCO_COLUMNS.NO,
                      KYC_WORKSTATION_COLUMNS.WORK_STATION,
                      KYC_PROCO_COLUMNS.DESCRIPTION,
                      KYC_PROCO_COLUMNS.SERIAL_NUMBER,
                      "Categorie",
                      KYC_PROCO_COLUMNS.LOCATION,
                      KYC_PROCO_COLUMNS.DESIGNATED_CUSTODIAN,
                      `${KYC_PROCO_COLUMNS.SYSTEM} / ${KYC_PROCO_COLUMNS.HDD_RAM}`,
                      KYC_PROCO_COLUMNS.STATUS,
                      "Actions",
                    ].map((head) => (
                      <TableHead className="text-xs text-slate-500" key={head}>
                        {head}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => (
                    <TableRow className="border-white/6" key={asset.id}>
                      <TableCell>
                        <AssetImageThumb alt={asset.name} imageUrl={asset.imageUrl} size="sm" />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{asset.sku}</TableCell>
                      <TableCell className="text-xs">{asset.workstationCode ?? "-"}</TableCell>
                      <TableCell>
                        <p className="font-medium">{asset.name}</p>
                        {asset.model ? (
                          <p className="text-xs text-slate-500">{asset.model}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {asset.serialNumber ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm">{asset.category}</TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          {asset.location}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {asset.custodianName ?? asset.assignedTo}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {[asset.systemOs, asset.storageRam].filter(Boolean).join(" · ") || "-"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={asset.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            className={ui.btnSecondary}
                            onClick={() => handleEdit(asset)}
                            size="sm"
                            type="button"
                          >
                            Modifier
                          </Button>
                          <Button
                            className="bg-red-900/30 text-red-200 hover:bg-red-900/50"
                            onClick={() => handleDelete(asset.id)}
                            size="sm"
                            type="button"
                          >
                            Supprimer
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
  );
}

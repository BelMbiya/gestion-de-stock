"use client";

import { AlertTriangle, ChevronRight, Database, MapPin, Plus, Search } from "lucide-react";

import { AssetImageThumb } from "@/components/asset-image-thumb";
import { AssetImageUpload } from "@/components/asset-image-upload";
import { CopyReferenceButton } from "@/components/copy-reference-button";
import { ExportPdfButton } from "@/components/export-pdf-button";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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

type InventoryAsset = {
  id: string;
  sku: string;
  serialNumber: string | null;
  name: string;
  imageUrl: string | null;
  category: string;
  location: string;
  status: string;
  assignedTo: string;
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
  if (status === "Critique") {
    return (
      <Badge className="bg-[#ff2f45]/20 text-[#ff7a88] hover:bg-[#ff2f45]/20">
        {status}
      </Badge>
    );
  }

  if (status === "Maintenance") {
    return (
      <Badge className="bg-[#6fb6ff]/20 text-[#9fd0ff] hover:bg-[#6fb6ff]/20">
        {status}
      </Badge>
    );
  }

  if (status === "Assigne") {
    return (
      <Badge className="bg-[#6fb6ff]/20 text-[#9fd0ff] hover:bg-[#6fb6ff]/20">
        {status}
      </Badge>
    );
  }

  return <Badge className="bg-white/10 text-white">{status}</Badge>;
}

function formatAssetValue(value: string) {
  return value === "-" ? "Non renseignee" : value;
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
      asset.category,
      asset.location,
      asset.name,
      asset.openIncident ?? "",
      asset.serialNumber ?? "",
      asset.sku,
      asset.status,
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
    <section className="flex h-full min-h-0 flex-col gap-5 text-white">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/6 p-5 shadow-2xl shadow-black/30 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#6fb6ff]">
              Inventaire
            </p>
            <h1 className="mt-2 text-3xl font-black">Gestion du materiel IT</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Consultez les actifs, leur localisation, leur affectation et les
              pannes ouvertes directement depuis la base de donnees.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ExportPdfButton
              disabled={isLoading}
              filename="inventaire-materiel"
              sections={[
                {
                  columns: [
                    "SKU",
                    "Materiel",
                    "Categorie",
                    "Localisation",
                    "Affectation",
                    "Valeur",
                    "Statut",
                    "Panne",
                  ],
                  rows: filteredAssets.map((asset) => [
                    asset.sku,
                    asset.name,
                    asset.category,
                    asset.location,
                    asset.assignedTo,
                    formatAssetValue(asset.value),
                    asset.status,
                    asset.openIncident ?? "Aucune panne ouverte",
                  ]),
                },
              ]}
              subtitle={`PROCO & Cie - ${filteredAssets.length} materiel(s) exporte(s)`}
              title="Inventaire materiel IT"
            />
            <Button
              className="h-10 rounded-full bg-white/8 px-4 font-bold text-white hover:bg-white/12"
              onClick={() => setIsActionOpen(true)}
              type="button"
            >
              Action
              <ChevronRight className="size-4" />
            </Button>
            <Button
              className="h-10 rounded-full bg-white/8 px-4 font-bold text-white hover:bg-white/12"
              onClick={() =>
                listRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
              type="button"
            >
              Liste materiel
              <ChevronRight className="size-4" />
            </Button>
            <Button
              className="h-10 rounded-full bg-[#ff2f45] px-4 font-bold text-white hover:bg-[#ff4b5e]"
              onClick={() => {
                setEditingAssetId(null);
                setForm(emptyForm);
                setIsFormOpen(true);
              }}
              type="button"
            >
              <Plus className="size-4" />
              Add New
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
              <Link
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-bold text-white hover:bg-white/10"
                href="/affectations"
              >
                Allouer un materiel a un agent
                <ChevronRight className="size-4 text-[#6fb6ff]" />
              </Link>
              <Link
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-bold text-white hover:bg-white/10"
                href="/mouvements"
              >
                Enregistrer un mouvement de stock
                <ChevronRight className="size-4 text-[#6fb6ff]" />
              </Link>
              <Link
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-bold text-white hover:bg-white/10"
                href="/pannes"
              >
                Declarer une panne liee au materiel
                <ChevronRight className="size-4 text-[#6fb6ff]" />
              </Link>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog onOpenChange={setIsFormOpen} open={isFormOpen}>
          <DialogContent className="w-[min(calc(100vw-2rem),52rem)] max-w-none border-white/10 bg-[#11183b] p-6 text-white sm:max-w-none">
            <DialogHeader>
              <DialogTitle>
                {editingAssetId ? "Modifier le materiel" : "Ajouter un materiel"}
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
                placeholder="SKU"
                required
                value={form.sku}
              />
              <Input
                className="border-white/10 bg-white/6 text-white"
                onChange={(event) =>
                  setForm((value) => ({ ...value, name: event.target.value }))
                }
                placeholder="Nom du materiel"
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
                placeholder="Numero de serie"
                value={form.serialNumber}
              />
              <div className="md:col-span-2">
                <AssetImageUpload
                  alt={form.name || "Photo materiel"}
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
                <option value="">Localisation</option>
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
                Statut du materiel
                <select
                  aria-label="Statut du materiel"
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

        <Card
          className="min-h-0 flex-1 border-white/10 bg-[#11183b]/95 text-white ring-0"
          ref={listRef}
        >
          <CardHeader className="gap-4 md:grid md:grid-cols-[1fr_20rem] md:items-center">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-black">
                <Database className="size-5 text-[#6fb6ff]" />
                Actifs en base
              </CardTitle>
              <CardDescription className="text-slate-400">
                {isLoading ? "Chargement..." : `${assets.length} materiel(s)`}
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-10 border-white/10 bg-white/6 pl-9 text-white"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Rechercher par SKU, materiel, categorie, localisation..."
                value={searchQuery}
              />
            </div>
          </CardHeader>
          <CardContent>
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
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    {[
                      ["Photo", "Image du materiel"],
                      ["SKU", "Reference interne du materiel"],
                      ["Materiel", "Nom et numero de serie"],
                      ["Categorie", "Famille d'equipement"],
                      ["Localisation", "Site ou entrepot"],
                      ["Affectation", "Agent ou service alloue"],
                      ["Valeur", "Prix d'achat en USD"],
                      [
                        "Statut",
                        "Etat operationnel : disponible, assigne, maintenance, critique...",
                      ],
                      [
                        "Panne",
                        "Reference de la panne ouverte liee au materiel, sinon aucune",
                      ],
                      ["Actions", "Modifier ou supprimer"],
                    ].map(([head, hint]) => (
                      <TableHead
                        className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-slate-400"
                        key={head}
                        title={hint}
                      >
                        {head}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => (
                    <TableRow className="border-white/6 hover:bg-white/5" key={asset.id}>
                      <TableCell>
                        <AssetImageThumb
                          alt={asset.name}
                          imageUrl={asset.imageUrl}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-400">
                        {asset.sku}
                      </TableCell>
                      <TableCell>
                        <p className="font-bold text-white">{asset.name}</p>
                        <p className="text-xs text-slate-500">
                          {asset.serialNumber ?? "Sans numero de serie"}
                        </p>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {asset.category}
                      </TableCell>
                      <TableCell className="text-[#8cc6ff]">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          {asset.location}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {asset.assignedTo}
                      </TableCell>
                      <TableCell
                        className={
                          asset.value === "-"
                            ? "text-xs text-slate-500"
                            : "font-semibold text-white"
                        }
                      >
                        {formatAssetValue(asset.value)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={asset.status} />
                      </TableCell>
                      <TableCell>
                        {asset.openIncident ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Badge className="bg-[#ff2f45]/20 text-[#ff7a88]">
                              <AlertTriangle className="size-3" />
                              {asset.openIncident}
                            </Badge>
                            <CopyReferenceButton value={asset.openIncident} />
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Aucune panne ouverte</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            className="bg-white/10 text-white hover:bg-white/15"
                            onClick={() => handleEdit(asset)}
                            type="button"
                          >
                            Modifier
                          </Button>
                          <Button
                            className="bg-[#ff2f45]/20 text-[#ff7a88] hover:bg-[#ff2f45]/30"
                            onClick={() => handleDelete(asset.id)}
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
            ) : null}
          </CardContent>
        </Card>
      </section>
  );
}

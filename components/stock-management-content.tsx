"use client";

import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  History,
  Package,
  Plus,
  Search,
  Trash2,
  Truck,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { ArticleDetailDialog } from "@/components/article-detail-dialog";
import { AssetImageThumb } from "@/components/asset-image-thumb";
import { AssetImageUpload } from "@/components/asset-image-upload";
import { CopyReferenceButton } from "@/components/copy-reference-button";

import { ExportPdfButton } from "@/components/export-pdf-button";
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

type StockAsset = {
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
  categoryId: string;
  location: string;
  locationId: string;
  supplier: string;
  supplierId: string;
  status: string;
  statusCode: string;
  condition: string;
  conditionCode: string;
  unit: string;
  quantityOnHand: number;
  minQuantity: number;
  reorderPoint: number;
  maxQuantity: number | null;
  stockStatus: string;
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

type StockPayload = {
  alerts: StockAsset[];
  assets: StockAsset[];
  categories: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  movements: {
    id: string;
    assetId: string;
    asset: string;
    type: string;
    quantity: number;
    fromLocation: string;
    toLocation: string;
    reason: string;
    movedAt: string;
  }[];
  sessions: {
    id: string;
    name: string;
    checksCount: number;
    isOpen: boolean;
    startedAt: string;
    variance?: {
      found: number;
      missing: number;
      damaged: number;
      moved: number;
    };
  }[];
  summary: {
    available: number;
    lowStock: number;
    totalArticles: number;
    totalQuantity: number;
    totalValue: string;
  };
  suppliers: {
    id: string;
    name: string;
    code: string;
    assetsCount: number;
  }[];
};

type ArticleForm = {
  barcode: string;
  brand: string;
  categoryId: string;
  condition: string;
  description: string;
  imageUrl: string;
  locationId: string;
  maxQuantity: string;
  minQuantity: string;
  model: string;
  name: string;
  purchaseDate: string;
  purchaseValue: string;
  quantityOnHand: string;
  reorderPoint: string;
  serialNumber: string;
  sku: string;
  status: string;
  supplierId: string;
  unit: string;
  warrantyUntil: string;
};

const emptyArticleForm: ArticleForm = {
  barcode: "",
  brand: "",
  categoryId: "",
  condition: "GOOD",
  description: "",
  imageUrl: "",
  locationId: "",
  maxQuantity: "",
  minQuantity: "0",
  model: "",
  name: "",
  purchaseDate: "",
  purchaseValue: "",
  quantityOnHand: "1",
  reorderPoint: "1",
  serialNumber: "",
  sku: "",
  status: "AVAILABLE",
  supplierId: "",
  unit: "unite",
  warrantyUntil: "",
};

const tabs = [
  { id: "articles", label: "Articles", icon: Package },
  { id: "movements", label: "Mouvements", icon: Truck },
  { id: "alerts", label: "Alertes", icon: AlertTriangle },
  { id: "inventory", label: "Inventaire physique", icon: ClipboardList },
  { id: "suppliers", label: "Fournisseurs", icon: Warehouse },
] as const;

type TabId = (typeof tabs)[number]["id"];

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

export function StockManagementContent() {
  const [data, setData] = useState<StockPayload | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("articles");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isArticleOpen, setIsArticleOpen] = useState(false);
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [isSupplierOpen, setIsSupplierOpen] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [articleForm, setArticleForm] = useState<ArticleForm>(emptyArticleForm);
  const [movementForm, setMovementForm] = useState({
    assetId: "",
    fromLocationId: "",
    quantity: "1",
    reason: "",
    toLocationId: "",
    type: "IN",
  });
  const [supplierForm, setSupplierForm] = useState({
    code: "",
    name: "",
    email: "",
    phone: "",
  });
  const [sessionName, setSessionName] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [traceAssetId, setTraceAssetId] = useState<string | null>(null);
  const [traceData, setTraceData] = useState<{
    asset: StockAsset;
    movements: { id: string; typeLabel: string; quantity: number; movedAt: string; reason: string }[];
    auditTrail: { id: string; action: string; description: string; createdAt: string }[];
  } | null>(null);
  const [inventoryDetail, setInventoryDetail] = useState<{
    id: string;
    name: string;
    isOpen: boolean;
    checks: {
      id: string;
      sku: string;
      asset: string;
      imageUrl: string | null;
      status: string;
      expectedLocation: string;
      notes: string | null;
    }[];
  } | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [detailAsset, setDetailAsset] = useState<StockAsset | null>(null);

  async function loadStock() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/stock", { cache: "no-store" });
      const text = await response.text();
      if (!response.ok) {
        let message = `Erreur ${response.status}`;
        if (text) {
          try {
            const body = JSON.parse(text) as { error?: string };
            message = body.error ?? message;
          } catch {
            message = text;
          }
        }
        setLoadError(message);
        setData(null);
        return;
      }
      if (!text) {
        setLoadError("Reponse vide du serveur. Relancez le serveur apres prisma generate.");
        setData(null);
        return;
      }
      const payload = JSON.parse(text) as StockPayload;
      setData(payload);
      window.dispatchEvent(new Event("stock-it:notifications-changed"));
    } catch {
      setLoadError("Impossible de charger le stock. Verifiez la base et relancez npm run dev.");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStock();
  }, []);

  useEffect(() => {
    if (activeTab !== "inventory") {
      return;
    }
    void loadInventorySessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function loadInventorySessions() {
    const response = await fetch("/api/inventory-sessions", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      sessions: {
        id: string;
        name: string;
        isOpen: boolean;
        checks: {
          id: string;
          sku: string;
          asset: string;
          imageUrl: string | null;
          status: string;
          expectedLocation: string;
          notes: string | null;
        }[];
      }[];
    };
    if (inventoryDetail) {
      const refreshed = payload.sessions.find((s) => s.id === inventoryDetail.id);
      if (refreshed) {
        setInventoryDetail(refreshed);
      }
    }
  }

  async function openTraceability(assetId: string) {
    setTraceAssetId(assetId);
    setTraceData(null);
    const response = await fetch(`/api/stock/${assetId}/trace`, { cache: "no-store" });
    if (response.ok) {
      setTraceData(await response.json());
    }
  }

  async function deleteArticle(id: string) {
    if (!confirm("Supprimer cet article et son historique de mouvements ?")) {
      return;
    }
    await fetch(`/api/stock/${id}`, { method: "DELETE" });
    await loadStock();
  }

  async function updateInventoryCheck(
    checkId: string,
    status: string,
    notes?: string,
  ) {
    await fetch(`/api/inventory-checks/${checkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes }),
    });
    await loadInventorySessions();
    await loadStock();
  }

  async function closeInventorySession(sessionId: string) {
    await fetch(`/api/inventory-sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ close: true }),
    });
    setInventoryDetail(null);
    await loadStock();
    await loadInventorySessions();
  }

  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = editingSupplierId
      ? `/api/suppliers/${editingSupplierId}`
      : "/api/suppliers";
    await fetch(url, {
      method: editingSupplierId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(supplierForm),
    });
    setIsSupplierOpen(false);
    setEditingSupplierId(null);
    setSupplierForm({ code: "", name: "", email: "", phone: "" });
    await loadStock();
  }

  async function deleteSupplier(id: string) {
    if (!confirm("Supprimer ce fournisseur ?")) {
      return;
    }
    await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    await loadStock();
  }

  const filteredAssets = useMemo(() => {
    if (!data) return [];
    const query = searchQuery.toLowerCase().trim();
    if (!query) return data.assets;
    return data.assets.filter((asset) =>
      [
        asset.sku,
        asset.barcode ?? "",
        asset.name,
        asset.brand ?? "",
        asset.category,
        asset.location,
        asset.supplier,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [data, searchQuery]);

  async function handleArticleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = editingArticleId ? `/api/stock/${editingArticleId}` : "/api/stock";
    await fetch(url, {
      method: editingArticleId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(articleForm),
    });
    setIsArticleOpen(false);
    setEditingArticleId(null);
    setArticleForm(emptyArticleForm);
    await loadStock();
  }

  function openArticleDetail(asset: StockAsset) {
    setDetailAsset(asset);
  }

  function openEditArticle(asset: StockAsset) {
    setEditingArticleId(asset.id);
    setArticleForm({
      barcode: asset.barcode ?? "",
      brand: asset.brand ?? "",
      categoryId: asset.categoryId,
      condition: asset.conditionCode,
      description: asset.description ?? "",
      imageUrl: asset.imageUrl ?? "",
      locationId: asset.locationId,
      maxQuantity: asset.maxQuantity?.toString() ?? "",
      minQuantity: String(asset.minQuantity),
      model: asset.model ?? "",
      name: asset.name,
      purchaseDate: asset.purchaseDate,
      purchaseValue: asset.purchaseValue,
      quantityOnHand: String(asset.quantityOnHand),
      reorderPoint: String(asset.reorderPoint),
      serialNumber: asset.serialNumber ?? "",
      sku: asset.sku,
      status: asset.statusCode,
      supplierId: asset.supplierId,
      unit: asset.unit,
      warrantyUntil: asset.warrantyUntil,
    });
    setIsArticleOpen(true);
  }

  async function handleMovementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await fetch("/api/stock/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(movementForm),
    });
    setIsMovementOpen(false);
    await loadStock();
  }

  async function startInventorySession() {
    if (!sessionName.trim()) return;
    await fetch("/api/inventory-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sessionName }),
    });
    setSessionName("");
    await loadStock();
    await loadInventorySessions();
  }

  async function openInventorySession(sessionId: string) {
    const response = await fetch("/api/inventory-sessions", { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as {
      sessions: typeof inventoryDetail[];
    };
    const session = payload.sessions.find((s) => s?.id === sessionId);
    if (session) {
      setInventoryDetail(session);
    }
  }

  if (isLoading) {
    return (
      <section className="flex flex-col gap-5 text-white">
        <Card className="border-white/10 bg-white/6 text-white ring-0">
          <CardContent className="p-6">Chargement du stock...</CardContent>
        </Card>
      </section>
    );
  }

  if (loadError || !data) {
    return (
      <section className="flex flex-col gap-5 text-white">
        <Card className="border-white/10 bg-[#11183b]/95 text-white ring-0">
          <CardContent className="flex flex-col gap-4 p-6">
            <p className="text-sm text-[#ff7a88]">
              {loadError ?? "Donnees de stock indisponibles."}
            </p>
            <p className="text-sm text-slate-400">
              Si vous venez d&apos;ajouter la gestion de stock, executez{" "}
              <code className="rounded bg-white/10 px-1">npx prisma migrate deploy</code> puis{" "}
              <code className="rounded bg-white/10 px-1">npx prisma generate</code> et relancez{" "}
              <code className="rounded bg-white/10 px-1">npm run dev</code>.
            </p>
            <Button
              className="w-fit bg-[#6fb6ff] text-[#0d1433] hover:bg-[#9fd0ff]"
              onClick={() => void loadStock()}
              type="button"
            >
              Reessayer
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5 pb-4 text-white">
      <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/6 p-5 shadow-2xl shadow-black/30 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#6fb6ff]">
            Gestion de stock
          </p>
          <h1 className="mt-2 text-3xl font-black">Stock IT complet</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Articles, quantites, seuils, mouvements, fournisseurs et inventaires
            physiques dans un module unique.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportPdfButton
            filename="gestion-stock-it"
            sections={[
              {
                columns: [
                  "SKU",
                  "Article",
                  "Qte",
                  "Seuil",
                  "Emplacement",
                  "Statut stock",
                  "Valeur",
                ],
                rows: filteredAssets.map((asset) => [
                  asset.sku,
                  asset.name,
                  String(asset.quantityOnHand),
                  String(asset.reorderPoint),
                  asset.location,
                  asset.stockStatusLabel,
                  asset.value,
                ]),
              },
            ]}
            subtitle={`PROCO & Cie - ${filteredAssets.length} article(s)`}
            title="Gestion de stock IT"
          />
          <Button
            className="bg-[#ff2f45] text-white hover:bg-[#ff4b5e]"
            onClick={() => {
              setEditingArticleId(null);
              setArticleForm(emptyArticleForm);
              setIsArticleOpen(true);
            }}
            type="button"
          >
            <Plus className="size-4" />
            Nouvel article
          </Button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border-white/10 bg-[#11183b]/95 ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Boxes className="size-5 text-[#6fb6ff]" />
              {data.summary.totalArticles}
            </CardTitle>
            <CardDescription className="text-slate-400">Articles</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-white/10 bg-[#11183b]/95 ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="size-5 text-[#6fb6ff]" />
              {data.summary.totalQuantity}
            </CardTitle>
            <CardDescription className="text-slate-400">Quantite totale</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-white/10 bg-[#11183b]/95 ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Warehouse className="size-5 text-[#6fb6ff]" />
              {data.summary.totalValue}
            </CardTitle>
            <CardDescription className="text-slate-400">Valeur stock</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-white/10 bg-[#11183b]/95 ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="size-5 text-[#6fb6ff]" />
              {data.summary.lowStock}
            </CardTitle>
            <CardDescription className="text-slate-400">Alertes</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-white/10 bg-[#11183b]/95 ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="size-5 text-[#6fb6ff]" />
              {data.summary.available}
            </CardTitle>
            <CardDescription className="text-slate-400">Disponibles</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              className={
                activeTab === tab.id
                  ? "bg-[#6fb6ff]/20 text-white"
                  : "bg-white/8 text-slate-300 hover:bg-white/12"
              }
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <Icon className="size-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {activeTab === "articles" ? (
        <Card className="border-white/10 bg-[#11183b]/95 ring-0">
          <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Catalogue articles</CardTitle>
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-10 border-white/10 bg-white/6 pl-9"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SKU, code-barres, nom, marque..."
                value={searchQuery}
              />
            </div>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  {[
                    "Photo",
                    "SKU",
                    "Article",
                    "Qte",
                    "Seuils",
                    "Emplacement",
                    "Fournisseur",
                    "Stock",
                    "Statut",
                    "Panne",
                    "Valeur",
                    "Actions",
                  ].map((h) => (
                    <TableHead className="text-slate-400" key={h}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map((asset) => (
                  <TableRow
                    className="cursor-pointer border-white/6 hover:bg-white/5"
                    key={asset.id}
                    onClick={() => openArticleDetail(asset)}
                  >
                    <TableCell className="w-[3.5rem]">
                      <AssetImageThumb
                        alt={asset.name}
                        imageUrl={asset.imageUrl}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{asset.sku}</TableCell>
                    <TableCell>
                      <p className="font-bold">{asset.name}</p>
                      <p className="text-xs text-slate-500">
                        {asset.brand} {asset.model} · {asset.barcode ?? "Sans code-barres"}
                      </p>
                    </TableCell>
                    <TableCell>
                      {asset.quantityOnHand} {asset.unit}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      min {asset.minQuantity} / seuil {asset.reorderPoint}
                      {asset.maxQuantity ? ` / max ${asset.maxQuantity}` : ""}
                    </TableCell>
                    <TableCell>{asset.location}</TableCell>
                    <TableCell>{asset.supplier}</TableCell>
                    <TableCell>
                      <StockBadge status={asset.stockStatusLabel} />
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-white/10">{asset.status}</Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {asset.openIncident ? (
                        <div className="flex items-center gap-1">
                          <Link
                            className="text-xs text-[#6fb6ff] hover:underline"
                            href={`/pannes?ref=${asset.openIncident}`}
                          >
                            {asset.openIncident}
                          </Link>
                          <CopyReferenceButton value={asset.openIncident} />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </TableCell>
                    <TableCell>{asset.value}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          className="bg-white/10 text-xs"
                          onClick={() => openEditArticle(asset)}
                          type="button"
                        >
                          Modifier
                        </Button>
                        <Button
                          aria-label="Trace"
                          className="bg-[#6fb6ff]/20 text-xs text-white"
                          onClick={() => void openTraceability(asset.id)}
                          type="button"
                        >
                          <History className="size-3" />
                          Trace
                        </Button>
                        <Button
                          aria-label="Supprimer"
                          className="bg-[#ff2f45]/20 text-xs text-[#ff9aa5]"
                          onClick={() => void deleteArticle(asset.id)}
                          type="button"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "movements" ? (
        <Card className="border-white/10 bg-[#11183b]/95 ring-0">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Mouvements de stock</CardTitle>
            <Button
              className="bg-[#ff2f45]"
              onClick={() => setIsMovementOpen(true)}
              type="button"
            >
              Enregistrer mouvement
            </Button>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  {["Date", "Article", "Type", "Qte", "Depuis", "Vers", "Motif"].map((h) => (
                    <TableHead className="text-slate-400" key={h}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.movements.map((m) => (
                  <TableRow className="border-white/6" key={m.id}>
                    <TableCell>{m.movedAt}</TableCell>
                    <TableCell>{m.asset}</TableCell>
                    <TableCell>{m.type}</TableCell>
                    <TableCell>{m.quantity}</TableCell>
                    <TableCell>{m.fromLocation}</TableCell>
                    <TableCell>{m.toLocation}</TableCell>
                    <TableCell>{m.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "alerts" ? (
        <Card className="border-white/10 bg-[#11183b]/95 ring-0">
          <CardHeader>
            <CardTitle>Alertes stock bas et ruptures</CardTitle>
            <CardDescription className="text-slate-400">
              Articles en seuil bas, rupture ou surstock.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.alerts.length === 0 ? (
              <p className="p-4 text-slate-400">Aucune alerte active.</p>
            ) : (
              <div className="overflow-auto [scrollbar-gutter:stable]">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="w-[4rem] px-4 text-slate-400">
                        Photo
                      </TableHead>
                      <TableHead className="w-[14%] px-4 text-slate-400">
                        Reference
                      </TableHead>
                      <TableHead className="w-[24%] px-4 text-slate-400">
                        Materiel
                      </TableHead>
                      <TableHead className="w-[14%] px-4 text-slate-400">
                        Quantite
                      </TableHead>
                      <TableHead className="w-[14%] px-4 text-slate-400">
                        Seuil
                      </TableHead>
                      <TableHead className="w-[18%] px-4 text-slate-400">
                        Localisation
                      </TableHead>
                      <TableHead className="w-[10%] px-4 text-slate-400">
                        Statut
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.alerts.map((asset) => (
                        <TableRow
                          className="cursor-pointer border-white/6 hover:bg-white/5"
                          key={asset.id}
                          onClick={() => openArticleDetail(asset)}
                        >
                          <TableCell className="px-4 align-top">
                            <AssetImageThumb
                              alt={asset.name}
                              imageUrl={asset.imageUrl}
                              size="sm"
                            />
                          </TableCell>
                          <TableCell className="px-4 align-top font-mono text-xs text-[#6fb6ff]">
                            {asset.sku}
                          </TableCell>
                          <TableCell className="px-4 align-top font-medium text-white">
                            {asset.name}
                          </TableCell>
                        <TableCell className="px-4 align-top text-sm text-slate-300">
                          {asset.quantityOnHand} {asset.unit}
                        </TableCell>
                        <TableCell className="px-4 align-top text-sm text-slate-300">
                          {asset.reorderPoint}
                          {asset.minQuantity > 0
                            ? ` (min. ${asset.minQuantity})`
                            : null}
                        </TableCell>
                        <TableCell className="px-4 align-top text-sm text-slate-300">
                          {asset.location}
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <StockBadge status={asset.stockStatusLabel} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "inventory" ? (
        <Card className="border-white/10 bg-[#11183b]/95 ring-0">
          <CardHeader>
            <CardTitle>Inventaire physique</CardTitle>
            <CardDescription>
              Lancez une session de comptage pour verifier le parc sur le terrain.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input
                className="h-11 max-w-md border-white/10 bg-white/6"
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Nom de la session (ex. Inventaire Q2 2026)"
                value={sessionName}
              />
              <Button
                className="bg-[#ff2f45]"
                onClick={() => void startInventorySession()}
                type="button"
              >
                Demarrer inventaire
              </Button>
            </div>
            {data.sessions.map((session) => (
              <div
                className="rounded-xl border border-white/10 bg-white/6 p-4"
                key={session.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{session.name}</p>
                    <p className="text-sm text-slate-400">
                      {session.startedAt} · {session.checksCount} controles ·{" "}
                      {session.isOpen ? "En cours" : "Cloture"}
                      {session.variance ? (
                        <>
                          {" "}
                          · OK {session.variance.found} · Manquants{" "}
                          {session.variance.missing} · Endommages{" "}
                          {session.variance.damaged} · Deplaces{" "}
                          {session.variance.moved}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="bg-white/10"
                      onClick={() => void openInventorySession(session.id)}
                      type="button"
                    >
                      Reconcilier
                    </Button>
                    {session.isOpen ? (
                      <Button
                        className="bg-[#6fb6ff]/20"
                        onClick={() => void closeInventorySession(session.id)}
                        type="button"
                      >
                        Cloturer
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {inventoryDetail ? (
              <Card className="border-white/10 bg-[#0d1433] ring-0">
                <CardHeader>
                  <CardTitle>Reconciliation — {inventoryDetail.name}</CardTitle>
                  <CardDescription>
                    Marquez chaque ligne: trouve, manquant, endommage ou deplace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="min-h-0 max-h-[min(28rem,50vh)] overflow-auto p-0 [scrollbar-gutter:stable]">
                  <Table className="table-fixed">
                    <TableHeader className="sticky top-0 z-10 bg-[#0d1433]">
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="w-[4rem] px-4 text-slate-400">
                          Photo
                        </TableHead>
                        <TableHead className="w-[14%] px-4 text-slate-400">
                          Reference
                        </TableHead>
                        <TableHead className="w-[26%] px-4 text-slate-400">
                          Materiel
                        </TableHead>
                        <TableHead className="w-[28%] px-4 text-slate-400">
                          Emplacement attendu
                        </TableHead>
                        <TableHead className="w-[22%] px-4 text-slate-400">
                          Statut
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryDetail.checks.map((check) => (
                        <TableRow
                          className="border-white/6 hover:bg-white/5"
                          key={check.id}
                        >
                          <TableCell className="px-4 align-top">
                            <AssetImageThumb
                              alt={check.asset}
                              imageUrl={check.imageUrl}
                              size="sm"
                            />
                          </TableCell>
                          <TableCell className="px-4 align-top font-mono text-xs text-[#6fb6ff]">
                            {check.sku}
                          </TableCell>
                          <TableCell className="px-4 align-top font-medium text-white">
                            {check.asset}
                          </TableCell>
                          <TableCell className="px-4 align-top text-sm text-slate-300">
                            {check.expectedLocation}
                          </TableCell>
                          <TableCell className="px-4 align-top">
                            <select
                              aria-label={`Statut inventaire ${check.sku}`}
                              className="h-9 w-full min-w-[9rem] rounded-lg border border-white/10 bg-[#11183b] px-2 text-sm text-white"
                              onChange={(e) =>
                                void updateInventoryCheck(
                                  check.id,
                                  e.target.value,
                                  check.notes ?? undefined,
                                )
                              }
                              value={check.status}
                            >
                              <option value="FOUND">Trouve</option>
                              <option value="MISSING">Manquant</option>
                              <option value="DAMAGED">Endommage</option>
                              <option value="MOVED">Deplace</option>
                            </select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "suppliers" ? (
        <Card className="border-white/10 bg-[#11183b]/95 ring-0">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Fournisseurs</CardTitle>
            <Button
              className="bg-[#ff2f45]"
              onClick={() => {
                setEditingSupplierId(null);
                setSupplierForm({ code: "", name: "", email: "", phone: "" });
                setIsSupplierOpen(true);
              }}
              type="button"
            >
              Ajouter fournisseur
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  {["Code", "Nom", "Articles lies", "Actions"].map((h) => (
                    <TableHead className="text-slate-400" key={h}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.suppliers.map((s) => (
                  <TableRow className="border-white/6" key={s.id}>
                    <TableCell className="font-mono">{s.code}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>{s.assetsCount}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          aria-label={`Modifier fournisseur ${s.code}`}
                          className="bg-white/10 text-xs"
                          onClick={() => {
                            setEditingSupplierId(s.id);
                            setSupplierForm({
                              code: s.code,
                              name: s.name,
                              email: "",
                              phone: "",
                            });
                            setIsSupplierOpen(true);
                          }}
                          type="button"
                        >
                          Modifier
                        </Button>
                        <Button
                          className="bg-[#ff2f45]/20 text-xs text-[#ff9aa5]"
                          onClick={() => void deleteSupplier(s.id)}
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
          </CardContent>
        </Card>
      ) : null}

      <Dialog onOpenChange={setIsArticleOpen} open={isArticleOpen}>
        <DialogContent className="!flex max-h-[min(92vh,52rem)] w-[min(calc(100vw-2rem),58rem)] max-w-none flex-col gap-0 overflow-hidden border-white/10 bg-[#11183b] p-0 text-white sm:max-w-none">
          <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5">
            <DialogTitle className="text-lg">
              {editingArticleId ? "Modifier l'article" : "Nouvel article de stock"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Tous les champs requis pour une gestion de stock professionnelle.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <form
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            id="article-stock-form"
            onSubmit={handleArticleSubmit}
          >
            {(
              [
                ["sku", "SKU *", articleForm.sku, true],
                ["barcode", "Code-barres", articleForm.barcode, false],
                ["name", "Designation *", articleForm.name, true],
                ["brand", "Marque", articleForm.brand, false],
                ["model", "Modele", articleForm.model, false],
                ["serialNumber", "N° serie", articleForm.serialNumber, false],
                ["quantityOnHand", "Quantite en stock *", articleForm.quantityOnHand, true],
                ["unit", "Unite", articleForm.unit, false],
                ["minQuantity", "Stock minimum", articleForm.minQuantity, false],
                ["reorderPoint", "Seuil reappro", articleForm.reorderPoint, false],
                ["maxQuantity", "Stock maximum", articleForm.maxQuantity, false],
                ["purchaseValue", "Prix achat (USD)", articleForm.purchaseValue, false],
                ["purchaseDate", "Date achat", articleForm.purchaseDate, false],
                ["warrantyUntil", "Fin garantie", articleForm.warrantyUntil, false],
              ] as const
            ).map(([key, label, value, required]) => (
              <label className="flex flex-col gap-1 text-sm text-slate-300" key={key}>
                {label}
                <Input
                  className="border-white/10 bg-white/6"
                  onChange={(e) =>
                    setArticleForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  required={required}
                  type={key.includes("Date") ? "date" : key.includes("Quantity") || key === "purchaseValue" || key === "quantityOnHand" ? "number" : "text"}
                  value={value as string}
                />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Categorie *
              <select
                className="h-11 rounded-lg border border-white/10 bg-[#0d1433] px-3"
                onChange={(e) => setArticleForm((f) => ({ ...f, categoryId: e.target.value }))}
                required
                value={articleForm.categoryId}
              >
                <option value="">Choisir</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Emplacement
              <select
                className="h-11 rounded-lg border border-white/10 bg-[#0d1433] px-3"
                onChange={(e) => setArticleForm((f) => ({ ...f, locationId: e.target.value }))}
                value={articleForm.locationId}
              >
                <option value="">Non localise</option>
                {data.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Fournisseur
              <select
                className="h-11 rounded-lg border border-white/10 bg-[#0d1433] px-3"
                onChange={(e) => setArticleForm((f) => ({ ...f, supplierId: e.target.value }))}
                value={articleForm.supplierId}
              >
                <option value="">Aucun</option>
                {data.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Etat materiel
              <select
                className="h-11 rounded-lg border border-white/10 bg-[#0d1433] px-3"
                onChange={(e) => setArticleForm((f) => ({ ...f, condition: e.target.value }))}
                value={articleForm.condition}
              >
                <option value="NEW">Neuf</option>
                <option value="GOOD">Bon etat</option>
                <option value="FAIR">Etat moyen</option>
                <option value="POOR">Mauvais etat</option>
                <option value="DAMAGED">Endommage</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Statut operationnel
              <select
                className="h-11 rounded-lg border border-white/10 bg-[#0d1433] px-3"
                onChange={(e) => setArticleForm((f) => ({ ...f, status: e.target.value }))}
                value={articleForm.status}
              >
                <option value="AVAILABLE">Disponible</option>
                <option value="ASSIGNED">Assigne</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="BROKEN">Critique</option>
                <option value="RETIRED">Reforme</option>
                <option value="LOST">Perdu</option>
              </select>
            </label>
            <div className="md:col-span-2 xl:col-span-3">
              <AssetImageUpload
                alt={articleForm.name || "Photo article"}
                imageUrl={articleForm.imageUrl || null}
                onImageUrlChange={(url) =>
                  setArticleForm((f) => ({ ...f, imageUrl: url ?? "" }))
                }
              />
            </div>
            <label className="flex flex-col gap-1 text-sm text-slate-300 md:col-span-2 xl:col-span-3">
              Description
              <Input
                className="border-white/10 bg-white/6"
                onChange={(e) =>
                  setArticleForm((f) => ({ ...f, description: e.target.value }))
                }
                value={articleForm.description}
              />
            </label>
          </form>
          </div>
          <div className="shrink-0 border-t border-white/10 px-6 py-4">
            <Button
              className="w-full bg-[#ff2f45] sm:w-auto"
              form="article-stock-form"
              type="submit"
            >
              {editingArticleId ? "Enregistrer" : "Creer l'article"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setIsMovementOpen} open={isMovementOpen}>
        <DialogContent className="w-[min(calc(100vw-2rem),32rem)] max-w-none border-white/10 bg-[#11183b] p-6 text-white sm:max-w-none">
          <DialogHeader>
            <DialogTitle>Mouvement de stock</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={handleMovementSubmit}>
            <select
              className="h-11 rounded-lg border border-white/10 bg-[#0d1433] px-3"
              onChange={(e) => setMovementForm((f) => ({ ...f, assetId: e.target.value }))}
              required
              value={movementForm.assetId}
            >
              <option value="">Article</option>
              {data.assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.sku} - {a.name} ({a.quantityOnHand})
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-lg border border-white/10 bg-[#0d1433] px-3"
              onChange={(e) => setMovementForm((f) => ({ ...f, type: e.target.value }))}
              value={movementForm.type}
            >
              <option value="IN">Entree</option>
              <option value="OUT">Sortie</option>
              <option value="RETURN">Retour</option>
              <option value="ADJUSTMENT">Ajustement (qty absolue)</option>
              <option value="TRANSFER">Transfert emplacement</option>
            </select>
            <Input
              onChange={(e) => setMovementForm((f) => ({ ...f, quantity: e.target.value }))}
              placeholder="Quantite"
              type="number"
              value={movementForm.quantity}
            />
            <select
              className="h-11 rounded-lg border border-white/10 bg-[#0d1433] px-3"
              onChange={(e) =>
                setMovementForm((f) => ({ ...f, fromLocationId: e.target.value }))
              }
              value={movementForm.fromLocationId}
            >
              <option value="">Depuis</option>
              {data.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-lg border border-white/10 bg-[#0d1433] px-3"
              onChange={(e) => setMovementForm((f) => ({ ...f, toLocationId: e.target.value }))}
              value={movementForm.toLocationId}
            >
              <option value="">Vers</option>
              {data.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <Input
              onChange={(e) => setMovementForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Motif"
              value={movementForm.reason}
            />
            <Button className="bg-[#ff2f45]" type="submit">
              Valider mouvement
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setIsSupplierOpen} open={isSupplierOpen}>
        <DialogContent className="w-[min(calc(100vw-2rem),28rem)] max-w-none border-white/10 bg-[#11183b] p-6 text-white sm:max-w-none">
          <DialogHeader>
            <DialogTitle>
              {editingSupplierId ? "Modifier le fournisseur" : "Nouveau fournisseur"}
            </DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={saveSupplier}>
            <Input
              onChange={(e) => setSupplierForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="Code fournisseur *"
              required
              value={supplierForm.code}
            />
            <Input
              onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Raison sociale *"
              required
              value={supplierForm.name}
            />
            <Input
              onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Email"
              value={supplierForm.email}
            />
            <Input
              onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Telephone"
              value={supplierForm.phone}
            />
            <Button className="bg-[#ff2f45]" type="submit">
              Enregistrer
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ArticleDetailDialog
        asset={detailAsset}
        onEdit={() => {
          if (detailAsset) {
            openEditArticle(detailAsset);
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDetailAsset(null);
          }
        }}
        onTrace={() => {
          if (detailAsset) {
            void openTraceability(detailAsset.id);
          }
        }}
        open={detailAsset !== null}
      />

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setTraceAssetId(null);
            setTraceData(null);
          }
        }}
        open={traceAssetId !== null}
      >
        <DialogContent className="!flex max-h-[min(90vh,40rem)] w-[min(calc(100vw-2rem),52rem)] max-w-none flex-col gap-0 overflow-hidden border-white/10 bg-[#11183b] p-0 text-white sm:max-w-none">
          <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-4">
            <DialogTitle>Tracabilite article</DialogTitle>
            <DialogDescription className="text-slate-400">
              {traceData?.asset.name ?? "Chargement..."} ·{" "}
              <Link className="text-[#6fb6ff] hover:underline" href="/historique">
                Historique complet
              </Link>
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {!traceData ? (
              <p className="text-slate-400">Chargement de la trace...</p>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-[#6fb6ff]">
                    Mouvements de stock
                  </h3>
                  {traceData.movements.length === 0 ? (
                    <p className="text-sm text-slate-400">Aucun mouvement.</p>
                  ) : (
                    <ul className="space-y-2">
                      {traceData.movements.map((m) => (
                        <li
                          className="rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm"
                          key={m.id}
                        >
                          <span className="font-medium">{m.typeLabel}</span> · qte{" "}
                          {m.quantity} · {m.movedAt}
                          <p className="text-xs text-slate-400">{m.reason}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-[#6fb6ff]">
                    Journal d&apos;audit
                  </h3>
                  {traceData.auditTrail.length === 0 ? (
                    <p className="text-sm text-slate-400">Aucune entree.</p>
                  ) : (
                    <ul className="space-y-2">
                      {traceData.auditTrail.map((log) => (
                        <li
                          className="rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm"
                          key={log.id}
                        >
                          <span className="font-mono text-xs text-slate-400">
                            {log.action}
                          </span>{" "}
                          · {log.createdAt}
                          <p>{log.description}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

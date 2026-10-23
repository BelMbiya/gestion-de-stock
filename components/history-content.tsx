"use client";

import { Clock, RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AssetSearchSelect } from "@/components/asset-search-select";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api-client";
import { KYC_UI } from "@/lib/kyc-excel/terminology";
import { ui } from "@/lib/ui-styles";

type HistoryAsset = {
  category: string;
  id: string;
  location: string;
  model?: string | null;
  name: string;
  serialNumber?: string | null;
  sku: string;
};

type HistoryEvent = {
  asset: string;
  assetCode?: string;
  assetId: string;
  date: string;
  detail: string;
  id: string;
  metadata: string;
  owner: string;
  title: string;
  type: string;
};

type HistoryData = {
  assets: HistoryAsset[];
  events: HistoryEvent[];
};

type TechnicianOption = { id: string; name: string };

/** « Personnalisee » remplace l'ancienne date precise et l'intervalle (meme date Du / Au = un seul jour). */
const periodOptions = [
  { label: "Toute periode", value: "" },
  { label: "Aujourd'hui", value: "day" },
  { label: "7 derniers jours", value: "week" },
  { label: "30 derniers jours", value: "month" },
  { label: "12 derniers mois", value: "year" },
  { label: "Personnalisee…", value: "custom" },
] as const;

const selectClass = `${ui.input} h-10 w-full rounded-md px-3 text-sm text-white`;

const typeTones: Record<string, string> = {
  Panne: "bg-red-900/40 text-red-200",
  "Suivi panne": "bg-red-900/25 text-red-200",
  Affectation: "bg-sky-900/40 text-sky-200",
  Mouvement: "bg-slate-700 text-slate-200",
};

function TypeBadge({ type }: { type: string }) {
  return <Badge className={typeTones[type] ?? "bg-slate-800 text-slate-300"}>{type}</Badge>;
}

function buildHistoryQuery(params: {
  assetId: string;
  technicianId: string;
  period: string;
  startDate: string;
  endDate: string;
}) {
  const search = new URLSearchParams();
  if (params.assetId) search.set("assetId", params.assetId);
  if (params.technicianId) search.set("technicianId", params.technicianId);
  if (params.period === "custom") {
    if (params.startDate) search.set("startDate", params.startDate);
    if (params.endDate) search.set("endDate", params.endDate);
  } else if (params.period) {
    search.set("period", params.period);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

export function HistoryContent() {
  const [assets, setAssets] = useState<HistoryAsset[]>([]);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [period, setPeriod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const historyQuery = useMemo(
    () =>
      buildHistoryQuery({
        assetId: selectedAssetId,
        technicianId: selectedTechnicianId,
        period,
        startDate,
        endDate,
      }),
    [endDate, period, selectedAssetId, selectedTechnicianId, startDate],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setIsLoading(true);
      const response = await apiFetch(`/api/history${historyQuery}`, { cache: "no-store" });
      const data: HistoryData = await response.json();
      if (!cancelled) {
        setAssets(data.assets);
        setEvents(data.events);
        setIsLoading(false);
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [historyQuery]);

  useEffect(() => {
    async function loadTechnicians() {
      const response = await apiFetch("/api/users", { cache: "no-store" });
      const data: { users: TechnicianOption[] } = await response.json();
      setTechnicians(data.users.map(({ id, name }) => ({ id, name })));
    }
    void loadTechnicians();
  }, []);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return events;
    return events.filter((event) =>
      [event.assetCode, event.asset, event.date, event.detail, event.metadata, event.owner, event.title, event.type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [events, searchQuery]);

  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);
  const selectedTechnician = technicians.find((technician) => technician.id === selectedTechnicianId);
  const periodLabel =
    period === "custom"
      ? `du ${startDate || "…"} au ${endDate || "…"}`
      : periodOptions.find((option) => option.value === period)?.label ?? "Toute periode";
  const hasFilters = Boolean(selectedAssetId || selectedTechnicianId || period || searchQuery);

  function resetFilters() {
    setSelectedAssetId("");
    setSelectedTechnicianId("");
    setPeriod("");
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
  }

  const exportSubtitle = [
    `Genere le ${new Date().toLocaleString("fr-FR")}`,
    `Materiel : ${selectedAsset ? `${selectedAsset.sku} ${selectedAsset.name}` : "tous"}`,
    `Technicien : ${selectedTechnician?.name ?? "tous"}`,
    `Periode : ${periodLabel}`,
  ].join(" · ");

  return (
    <section className={ui.page}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="min-w-0">
          <h1 className={ui.title}>{KYC_UI.HISTORY}</h1>
          <p className={ui.subtitle}>Cycle de vie du parc : mouvements, affectations et pannes.</p>
        </div>
        <ExportPdfButton
          disabled={isLoading}
          filename="historique-materiel"
          sections={[
            {
              columns: ["Date", "Type", "Code", "Materiel", "Evenement", "Par", "Detail"],
              rows: filteredEvents.map((event) => [
                event.date,
                event.type,
                event.assetCode ?? "",
                event.asset,
                [event.title, event.metadata].filter(Boolean).join(" — "),
                event.owner,
                event.detail,
              ]),
            },
          ]}
          subtitle={`PROCO & Cie - ${exportSubtitle}`}
          title={`${KYC_UI.HISTORY} IT`}
        />
      </header>

      <Card className={`${ui.panel} shrink-0 ring-0`}>
        <CardContent className="space-y-3 p-3">
          <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(14rem,2fr)_auto]">
            <AssetSearchSelect
              assets={assets}
              emptyLabel={`${KYC_UI.ALL} — materiel`}
              label="Materiel"
              onValueChange={setSelectedAssetId}
              placeholder="Code, nom, numero de serie…"
              value={selectedAssetId}
            />
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Technicien
              <select className={selectClass} onChange={(event) => setSelectedTechnicianId(event.target.value)} value={selectedTechnicianId}>
                <option value="">Tous</option>
                {technicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Periode
              <select className={selectClass} onChange={(event) => setPeriod(event.target.value)} value={period}>
                {periodOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Recherche
              <span className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  className={`${ui.input} h-10 pl-9 text-white`}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Type, detenteur, motif…"
                  value={searchQuery}
                />
              </span>
            </label>
            <Button className={`h-10 ${ui.btnSecondary}`} disabled={!hasFilters} onClick={resetFilters} type="button">
              <RotateCcw className="size-4" />
              Reinitialiser
            </Button>
          </div>

          {period === "custom" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:w-1/2">
              <label className="flex flex-col gap-1 text-xs text-slate-300">
                Du
                <Input className={`${ui.input} h-10 text-white`} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-300">
                Au
                <Input className={`${ui.input} h-10 text-white`} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
              </label>
            </div>
          ) : null}

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{plural(filteredEvents.length, "evenement")}</span>
            <span>Materiel : {selectedAsset ? `${selectedAsset.sku} · ${selectedAsset.name}` : "tous"}</span>
            <span>Technicien : {selectedTechnician?.name ?? "tous"}</span>
            <span>Periode : {periodLabel}</span>
          </p>
        </CardContent>
      </Card>

      <Card className={`${ui.panel} flex min-h-[22rem] flex-1 flex-col overflow-hidden py-0 ring-0`}>
        {isLoading ? (
          <p className="m-4 rounded-md bg-slate-800/50 p-4 text-sm text-slate-400">Chargement de l&apos;historique...</p>
        ) : filteredEvents.length === 0 ? (
          <p className="m-4 rounded-md bg-slate-800/50 p-4 text-sm text-slate-400">Aucun evenement pour les filtres selectionnes.</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
            <Table className="min-w-[60rem] table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-[#0d1330] shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="w-[9.5rem] text-xs text-slate-500">Date</TableHead>
                  <TableHead className="w-[8rem] text-xs text-slate-500">Type</TableHead>
                  <TableHead className="w-[15rem] text-xs text-slate-500">Materiel</TableHead>
                  <TableHead className="w-[15rem] text-xs text-slate-500">Evenement</TableHead>
                  <TableHead className="w-[10rem] text-xs text-slate-500">Par</TableHead>
                  <TableHead className="text-xs text-slate-500">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow className="border-white/6" key={event.id}>
                    <TableCell className="align-top text-xs text-slate-400">
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <Clock className="size-3.5 shrink-0 text-slate-500" />
                        {event.date}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <TypeBadge type={event.type} />
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">
                      {event.assetCode ? <p className="font-mono text-xs text-slate-400">{event.assetCode}</p> : null}
                      <p className="break-words font-medium text-white">{event.asset}</p>
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">
                      <p className="break-words text-slate-200">{event.title}</p>
                      {event.metadata && event.metadata !== "-" ? (
                        <p className="break-words text-xs text-slate-500">{event.metadata}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words align-top text-slate-300">{event.owner}</TableCell>
                    <TableCell className="whitespace-normal break-words align-top text-sm leading-6 text-slate-300">
                      {event.detail}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </section>
  );
}

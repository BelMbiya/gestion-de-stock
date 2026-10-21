"use client";

import { Clock, History, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AssetSearchSelect } from "@/components/asset-search-select";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ui } from "@/lib/ui-styles";
import { KYC_SHEET_LABELS, KYC_UI } from "@/lib/kyc-excel/terminology";
import { apiFetch } from "@/lib/api-client";

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

type TechnicianOption = {
  id: string;
  name: string;
};

const periodOptions = [
  { label: "Toute periode", value: "" },
  { label: "Aujourd'hui", value: "day" },
  { label: "7 derniers jours", value: "week" },
  { label: "30 derniers jours", value: "month" },
  { label: "12 derniers mois", value: "year" },
] as const;

function TypeBadge({ type }: { type: string }) {
  if (type === "Panne" || type === "Suivi panne") {
    return <Badge className="bg-red-900/40 text-red-200">{type}</Badge>;
  }

  if (type === "Affectation") {
    return <Badge className="bg-slate-700 text-slate-200">{type}</Badge>;
  }

  return <Badge className="bg-slate-800 text-slate-300">{type}</Badge>;
}

function buildHistoryQuery(params: {
  assetId: string;
  date: string;
  endDate: string;
  period: string;
  startDate: string;
  technicianId: string;
}) {
  const search = new URLSearchParams();

  if (params.assetId) {
    search.set("assetId", params.assetId);
  }
  if (params.technicianId) {
    search.set("technicianId", params.technicianId);
  }
  if (params.date) {
    search.set("date", params.date);
  } else {
    if (params.period) {
      search.set("period", params.period);
    }
    if (params.startDate) {
      search.set("startDate", params.startDate);
    }
    if (params.endDate) {
      search.set("endDate", params.endDate);
    }
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

export function HistoryContent() {
  const [assets, setAssets] = useState<HistoryAsset[]>([]);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [period, setPeriod] = useState("");
  const [specificDate, setSpecificDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const historyQuery = useMemo(
    () =>
      buildHistoryQuery({
        assetId: selectedAssetId,
        date: specificDate,
        endDate,
        period,
        startDate,
        technicianId: selectedTechnicianId,
      }),
    [
      endDate,
      period,
      selectedAssetId,
      selectedTechnicianId,
      specificDate,
      startDate,
    ],
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
      const response = await apiFetch("/api/technicians", { cache: "no-store" });
      const data: { technicians: { id: string; name: string }[] } =
        await response.json();
      setTechnicians(
        data.technicians.map((technician) => ({
          id: technician.id,
          name: technician.name,
        })),
      );
    }

    void loadTechnicians();
  }, []);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      return events;
    }

    return events.filter((event) =>
      [event.asset, event.date, event.detail, event.owner, event.title, event.type]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [events, searchQuery]);

  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);
  const selectedTechnician = technicians.find(
    (technician) => technician.id === selectedTechnicianId,
  );

  const exportSubtitle = useMemo(() => {
    const parts = [
      `Genere le ${new Date().toLocaleString("fr-FR")}`,
      selectedAsset ? `${KYC_UI.DESCRIPTION}: ${selectedAsset.name}` : `${KYC_UI.DESCRIPTION}: ${KYC_UI.ALL}`,
      selectedTechnician
        ? `Technicien: ${selectedTechnician.name}`
        : "Technicien: tous",
    ];

    if (specificDate) {
      parts.push(`Date: ${specificDate}`);
    } else if (period) {
      const label = periodOptions.find((option) => option.value === period)?.label;
      parts.push(`Periode: ${label ?? period}`);
    } else if (startDate || endDate) {
      parts.push(`Intervalle: ${startDate || "..."} -> ${endDate || "..."}`);
    } else {
      parts.push("Periode: complete");
    }

    return parts.join(" · ");
  }, [
    endDate,
    period,
    selectedAsset,
    selectedTechnician,
    specificDate,
    startDate,
  ]);

  return (
    <section className={ui.page}>
      <header className={`${ui.header} xl:flex xl:items-center xl:justify-between`}>
        <div>
          <p className={ui.eyebrow}>{KYC_UI.HISTORY}</p>
          <h1 className={ui.title}>{KYC_UI.HISTORY}</h1>
          <p className={`${ui.subtitle} mt-1 max-w-3xl`}>
            {KYC_UI.MOVEMENTS}, affectations et {KYC_UI.INCIDENT} par periode, {KYC_UI.DATE},{" "}
            {KYC_UI.TECHNICIAN} ou {KYC_UI.DESCRIPTION}.
          </p>
        </div>
        <ExportPdfButton
          disabled={isLoading}
          filename="historique-materiel"
          sections={[
            {
              columns: ["Date", "Type", KYC_UI.DESCRIPTION, "Titre", "Responsable", "Detail"],
              rows: filteredEvents.map((event) => [
                event.date,
                event.type,
                event.asset,
                event.title,
                event.owner,
                event.detail,
              ]),
            },
          ]}
          subtitle={`PROCO & Cie - ${exportSubtitle}`}
          title={`${KYC_UI.HISTORY} IT`}
        />
      </header>

      <Card className={`${ui.panel} ring-0`}>
        <CardHeader className={ui.panelHeader}>
          <CardTitle className="text-base font-semibold">Filtres d&apos;historique</CardTitle>
          <CardDescription className={ui.subtitle}>
            Combinez periode, {KYC_UI.DATE}, {KYC_UI.TECHNICIAN} et {KYC_UI.DESCRIPTION} avant export.
          </CardDescription>
        </CardHeader>
        <CardContent className={`${ui.panelBody} grid gap-3 md:grid-cols-2 xl:grid-cols-3`}>
          <AssetSearchSelect
            assets={assets}
            emptyLabel={`${KYC_UI.ALL} — ${KYC_UI.DESCRIPTION}`}
            label={KYC_UI.DESCRIPTION}
            onValueChange={setSelectedAssetId}
            value={selectedAssetId}
          />
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Technicien
            <select
              className={`${ui.input} rounded-md px-3 text-white`}
              onChange={(event) => setSelectedTechnicianId(event.target.value)}
              value={selectedTechnicianId}
            >
              <option value="">Tous les techniciens</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Periode
            <select
              className={`${ui.input} rounded-md px-3 text-white`}
              onChange={(event) => {
                setPeriod(event.target.value);
                if (event.target.value) {
                  setSpecificDate("");
                }
              }}
              value={period}
            >
              {periodOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Date precise
            <Input
              className={`${ui.input} text-white`}
              onChange={(event) => {
                setSpecificDate(event.target.value);
                if (event.target.value) {
                  setPeriod("");
                  setStartDate("");
                  setEndDate("");
                }
              }}
              type="date"
              value={specificDate}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Debut intervalle
            <Input
              className={`${ui.input} text-white`}
              disabled={Boolean(specificDate)}
              onChange={(event) => setStartDate(event.target.value)}
              type="date"
              value={startDate}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Fin intervalle
            <Input
              className={`${ui.input} text-white`}
              disabled={Boolean(specificDate)}
              onChange={(event) => setEndDate(event.target.value)}
              type="date"
              value={endDate}
            />
          </label>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className={`${ui.panel} ring-0`}>
          <CardHeader className={ui.panelHeader}>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <History className="size-4 text-slate-400" />
              {filteredEvents.length}
            </CardTitle>
            <CardDescription className={ui.subtitle}>
              Evenements historises
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className={`${ui.panel} ring-0 md:col-span-2`}>
          <CardHeader className={ui.panelHeader}>
            <CardTitle className="text-base font-semibold">
              {selectedAsset?.name ?? KYC_UI.ALL_DESCRIPTIONS}
            </CardTitle>
            <CardDescription className={ui.subtitle}>
              {selectedAsset
                ? `${selectedAsset.sku} · ${selectedAsset.category} · ${selectedAsset.location}`
                : "Vue consolidee du cycle de vie du parc IT."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <Input
          className={`${ui.input} pl-9 text-white`}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={`${KYC_UI.TYPE}, ${KYC_UI.DESCRIPTION}, ${KYC_UI.USER}, ${KYC_UI.DETAIL}…`}
          value={searchQuery}
        />
      </div>

      <Card className={`${ui.panel} ${ui.tablePanel}`}>
        <CardContent className={ui.tablePanelBody}>
          {isLoading ? (
            <p className="rounded-md bg-slate-800/50 p-4 text-sm text-slate-400">
              Chargement de l&apos;historique...
            </p>
          ) : filteredEvents.length === 0 ? (
            <p className="rounded-md bg-slate-800/50 p-4 text-sm text-slate-400">
              Aucun evenement pour les filtres selectionnes.
            </p>
          ) : (
            <div className={ui.tableWrap}>
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="w-[14%] text-xs text-slate-500">Date</TableHead>
                  <TableHead className="w-[14%] text-xs text-slate-500">Type</TableHead>
                  <TableHead className="w-[22%] text-xs text-slate-500">{KYC_UI.DESCRIPTION}</TableHead>
                  <TableHead className="w-[22%] text-xs text-slate-500">Titre</TableHead>
                  <TableHead className="w-[14%] text-xs text-slate-500">Responsable</TableHead>
                  <TableHead className="w-[14%] text-xs text-slate-500">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow className="border-white/6" key={event.id}>
                    <TableCell className="whitespace-normal align-top text-xs text-slate-400">
                      <span className="flex items-start gap-2">
                        <Clock className="size-4 text-slate-500" />
                        {event.date}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <TypeBadge type={event.type} />
                    </TableCell>
                    <TableCell className="whitespace-normal break-words align-top font-medium">
                      {event.asset}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words align-top">
                      {event.title}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words align-top text-slate-300">
                      {event.owner}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words align-top text-sm leading-6 text-slate-300">
                      {event.detail}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

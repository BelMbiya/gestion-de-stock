"use client";

import { Clock, History, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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

type HistoryAsset = {
  category: string;
  id: string;
  location: string;
  name: string;
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
    return <Badge className="bg-[#ff2f45]/20 text-[#ff9aa5]">{type}</Badge>;
  }

  if (type === "Affectation") {
    return <Badge className="bg-[#6fb6ff]/20 text-[#9fd0ff]">{type}</Badge>;
  }

  return <Badge className="bg-white/10 text-white">{type}</Badge>;
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
      const response = await fetch(`/api/history${historyQuery}`, { cache: "no-store" });
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
      const response = await fetch("/api/technicians", { cache: "no-store" });
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
      selectedAsset ? `Materiel: ${selectedAsset.name}` : "Materiel: tous",
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
    <section className="flex flex-col gap-5 pb-2 text-white">
      <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/6 p-5 shadow-2xl shadow-black/30 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#6fb6ff]">
            Historique
          </p>
          <h1 className="mt-2 text-3xl font-black">Historique complet materiel</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Consultez et exportez les deplacements, transports, affectations et
            pannes par periode, date, technicien ou materiel.
          </p>
        </div>
        <ExportPdfButton
          disabled={isLoading}
          filename="historique-materiel"
          sections={[
            {
              columns: ["Date", "Type", "Materiel", "Titre", "Responsable", "Detail"],
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
          title="Historique materiel IT"
        />
      </header>

      <Card className="border-white/10 bg-[#11183b]/95 text-white ring-0">
        <CardHeader>
          <CardTitle className="text-lg">Filtres d&apos;historique</CardTitle>
          <CardDescription className="text-slate-400">
            Combinez periode, date precise, technicien et materiel avant export.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Materiel
            <select
              className="h-11 rounded-xl border border-white/10 bg-[#0d1433] px-3 text-white"
              onChange={(event) => setSelectedAssetId(event.target.value)}
              value={selectedAssetId}
            >
              <option value="">Tous les materiels</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.sku} - {asset.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Technicien
            <select
              className="h-11 rounded-xl border border-white/10 bg-[#0d1433] px-3 text-white"
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
              className="h-11 rounded-xl border border-white/10 bg-[#0d1433] px-3 text-white"
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
              className="h-11 border-white/10 bg-[#0d1433] text-white"
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
              className="h-11 border-white/10 bg-[#0d1433] text-white"
              disabled={Boolean(specificDate)}
              onChange={(event) => setStartDate(event.target.value)}
              type="date"
              value={startDate}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Fin intervalle
            <Input
              className="h-11 border-white/10 bg-[#0d1433] text-white"
              disabled={Boolean(specificDate)}
              onChange={(event) => setEndDate(event.target.value)}
              type="date"
              value={endDate}
            />
          </label>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-[#11183b]/95 text-white ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-5 text-[#6fb6ff]" />
              {filteredEvents.length}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Evenements historises
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-white/10 bg-[#11183b]/95 text-white ring-0 md:col-span-2">
          <CardHeader>
            <CardTitle>{selectedAsset?.name ?? "Tous les materiels"}</CardTitle>
            <CardDescription className="text-slate-400">
              {selectedAsset
                ? `${selectedAsset.sku} · ${selectedAsset.category} · ${selectedAsset.location}`
                : "Vue consolidee du cycle de vie du parc IT."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="h-11 border-white/10 bg-white/6 pl-11 text-white"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Rechercher type, materiel, agent, detail..."
          value={searchQuery}
        />
      </div>

      <Card className="border-white/10 bg-[#11183b]/95 text-white ring-0">
        <CardContent className="p-4">
          {isLoading ? (
            <p className="rounded-xl bg-white/6 p-4 text-sm text-slate-300">
              Chargement de l&apos;historique...
            </p>
          ) : filteredEvents.length === 0 ? (
            <p className="rounded-xl bg-white/6 p-4 text-sm text-slate-300">
              Aucun evenement pour les filtres selectionnes.
            </p>
          ) : (
            <Table className="table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-[#11183b]">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="w-[14%] text-slate-400">Date</TableHead>
                  <TableHead className="w-[14%] text-slate-400">Type</TableHead>
                  <TableHead className="w-[22%] text-slate-400">Materiel</TableHead>
                  <TableHead className="w-[22%] text-slate-400">Titre</TableHead>
                  <TableHead className="w-[14%] text-slate-400">Responsable</TableHead>
                  <TableHead className="w-[14%] text-slate-400">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow className="border-white/6 hover:bg-white/5" key={event.id}>
                    <TableCell className="whitespace-normal align-top text-xs text-slate-400">
                      <span className="flex items-start gap-2">
                        <Clock className="size-4 text-[#6fb6ff]" />
                        {event.date}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <TypeBadge type={event.type} />
                    </TableCell>
                    <TableCell className="whitespace-normal break-words align-top font-bold">
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
          )}
        </CardContent>
      </Card>
    </section>
  );
}

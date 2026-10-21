"use client";

import {
  Clock,
  Headphones,
  LifeBuoy,
  Mail,
  Phone,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AssetSearchSelect } from "@/components/asset-search-select";
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
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getSupportStatusLabel,
  supportTicketCategoryOptions,
  supportTicketPriorityOptions,
  supportTicketStatusOptions,
} from "@/lib/support-ticket-serializer";
import { KYC_UI } from "@/lib/kyc-excel/terminology";
import { ui } from "@/lib/ui-styles";
import { apiFetch } from "@/lib/api-client";

type TicketUpdate = {
  id: string;
  author: string;
  comment: string;
  statusTo: string | null;
  createdAt: string;
};

type SupportTicket = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  requester: string;
  assignee: string;
  asset: string;
  contactEmail: string | null;
  contactPhone: string | null;
  progress: number;
  openedAt: string;
  updates: TicketUpdate[];
};

type ReferenceItem = {
  email?: string;
  id: string;
  name: string;
  sku?: string;
  serialNumber?: string | null;
  model?: string | null;
};

type TicketForm = {
  assetId: string;
  assigneeId: string;
  category: string;
  comment: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
  priority: string;
  reference: string;
  requesterId: string;
  status: string;
  title: string;
};

const emptyForm: TicketForm = {
  assetId: "",
  assigneeId: "",
  category: "OTHER",
  comment: "",
  contactEmail: "",
  contactPhone: "",
  description: "",
  priority: "MEDIUM",
  reference: "",
  requesterId: "",
  status: "OPEN",
  title: "",
};

const periodOptions = [
  { label: "Toute periode", value: "" },
  { label: "Aujourd'hui", value: "day" },
  { label: "7 derniers jours", value: "week" },
  { label: "30 derniers jours", value: "month" },
  { label: "12 derniers mois", value: "year" },
] as const;

function buildTicketsQuery(params: {
  assetId: string;
  assigneeId: string;
  category: string;
  endDate: string;
  period: string;
  priority: string;
  specificDate: string;
  startDate: string;
  status: string;
}) {
  const search = new URLSearchParams();
  if (params.assetId) search.set("assetId", params.assetId);
  if (params.assigneeId) search.set("assigneeId", params.assigneeId);
  if (params.category) search.set("category", params.category);
  if (params.priority) search.set("priority", params.priority);
  if (params.status) search.set("status", params.status);
  if (params.specificDate) {
    search.set("date", params.specificDate);
  } else {
    if (params.period) search.set("period", params.period);
    if (params.startDate) search.set("startDate", params.startDate);
    if (params.endDate) search.set("endDate", params.endDate);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

function PriorityBadge({ priority }: { priority: string }) {
  const isHigh = priority === "Haute" || priority === "Urgente";
  return (
    <Badge
      className={
        isHigh ? "bg-red-900/40 text-red-200" : "bg-slate-800 text-slate-300"
      }
    >
      {priority}
    </Badge>
  );
}

function notifyChanged() {
  window.dispatchEvent(new Event("stock-it:notifications-changed"));
}

export function SupportTicketsContent() {
  const [assets, setAssets] = useState<ReferenceItem[]>([]);
  const [users, setUsers] = useState<ReferenceItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [period, setPeriod] = useState("");
  const [specificDate, setSpecificDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [form, setForm] = useState<TicketForm>(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<SupportTicket | null>(null);

  const ticketsQuery = useMemo(
    () =>
      buildTicketsQuery({
        assetId: selectedAssetId,
        assigneeId: selectedAssigneeId,
        category: selectedCategory,
        endDate,
        period,
        priority: selectedPriority,
        specificDate,
        startDate,
        status: selectedStatus,
      }),
    [
      endDate,
      period,
      selectedAssetId,
      selectedAssigneeId,
      selectedCategory,
      selectedPriority,
      selectedStatus,
      specificDate,
      startDate,
    ],
  );

  const filteredTickets = tickets.filter((ticket) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return [
      ticket.reference,
      ticket.title,
      ticket.requester,
      ticket.assignee,
      ticket.asset,
      ticket.category,
      ticket.priority,
      ticket.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const stats = useMemo(
    () => ({
      open: tickets.filter(
        (t) => t.status !== "Resolu" && t.status !== "Cloture",
      ).length,
      urgent: tickets.filter((t) => t.priority === "Urgente").length,
      resolved: tickets.filter((t) => t.status === "Resolu").length,
      total: tickets.length,
    }),
    [tickets],
  );

  async function loadTickets() {
    setIsLoading(true);
    setError("");
    try {
      const response = await apiFetch(`/api/support-tickets${ticketsQuery}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Support tickets API failed");
      const data = await response.json();
      setAssets(data.assets);
      setUsers(data.users);
      setTickets(data.tickets);
    } catch {
      setError("Impossible de charger les tickets d'assistance.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketsQuery]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = editingTicketId
      ? `/api/support-tickets/${editingTicketId}`
      : "/api/support-tickets";
    const method = editingTicketId ? "PATCH" : "POST";

    const response = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        history: form.comment || undefined,
      }),
    });

    if (!response.ok) {
      setError("Enregistrement du ticket impossible.");
      return;
    }

    setForm(emptyForm);
    setEditingTicketId(null);
    setIsFormOpen(false);
    notifyChanged();
    await loadTickets();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Supprimer ce ticket d'assistance ?")) return;
    await apiFetch(`/api/support-tickets/${id}`, { method: "DELETE" });
    notifyChanged();
    await loadTickets();
  }

  function openEdit(ticket: SupportTicket) {
    setEditingTicketId(ticket.id);
    setForm({
      assetId: assets.find((a) => ticket.asset.includes(a.sku ?? ""))?.id ?? "",
      assigneeId: users.find((u) => u.name === ticket.assignee)?.id ?? "",
      category:
        supportTicketCategoryOptions.find((o) => o.label === ticket.category)
          ?.value ?? "OTHER",
      comment: "",
      contactEmail: ticket.contactEmail ?? "",
      contactPhone: ticket.contactPhone ?? "",
      description: ticket.description ?? "",
      priority:
        supportTicketPriorityOptions.find((o) => o.label === ticket.priority)
          ?.value ?? "MEDIUM",
      reference: ticket.reference,
      requesterId: users.find((u) => u.name === ticket.requester)?.id ?? "",
      status:
        supportTicketStatusOptions.find((o) => o.label === ticket.status)
          ?.value ?? "OPEN",
      title: ticket.title,
    });
    setIsFormOpen(true);
  }

  const exportSubtitle = useMemo(() => {
    return [
      `Genere le ${new Date().toLocaleString("fr-FR")}`,
      `${filteredTickets.length} ticket(s)`,
      selectedStatus
        ? `Statut: ${getSupportStatusLabel(selectedStatus)}`
        : "Statut: tous",
    ].join(" · ");
  }, [filteredTickets.length, selectedStatus]);

  return (
    <section className={ui.page}>
      <header className={`${ui.header} shrink-0`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={ui.eyebrow}>Assistance IT</p>
            <h1 className={ui.title}>Tickets support</h1>
            <p className={ui.subtitle}>
              Demandes d&apos;assistance utilisateurs et suivi IT
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportPdfButton
              filename="tickets-support"
              sections={[
                {
                  columns: [
                    "Reference",
                    "Titre",
                    "Demandeur",
                    "Assigne",
                    "Categorie",
                    "Priorite",
                    "Statut",
                  ],
                  rows: filteredTickets.map((t) => [
                    t.reference,
                    t.title,
                    t.requester,
                    t.assignee,
                    t.category,
                    t.priority,
                    t.status,
                  ]),
                },
              ]}
              subtitle={exportSubtitle}
              title="Tickets support IT"
            />
            <Button
              className={ui.btnPrimary}
              onClick={() => {
                setEditingTicketId(null);
                setForm(emptyForm);
                setIsFormOpen(true);
              }}
              type="button"
            >
              <LifeBuoy className="size-4" />
              Nouveau ticket
            </Button>
          </div>
        </div>
      </header>

      <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className={`${ui.panel} ring-0`}>
          <CardHeader className={ui.panelHeader}>
            <CardTitle className="text-2xl font-semibold">{stats.open}</CardTitle>
            <CardDescription className="text-slate-400">Ouverts</CardDescription>
          </CardHeader>
        </Card>
        <Card className={`${ui.panel} ring-0`}>
          <CardHeader className={ui.panelHeader}>
            <CardTitle className="text-2xl font-semibold text-red-300">
              {stats.urgent}
            </CardTitle>
            <CardDescription className="text-slate-400">Urgents</CardDescription>
          </CardHeader>
        </Card>
        <Card className={`${ui.panel} ring-0`}>
          <CardHeader className={ui.panelHeader}>
            <CardTitle className="text-2xl font-semibold">{stats.resolved}</CardTitle>
            <CardDescription className="text-slate-400">Resolus</CardDescription>
          </CardHeader>
        </Card>
        <Card className={`${ui.panel} ring-0`}>
          <CardHeader className={ui.panelHeader}>
            <CardTitle className="text-2xl font-semibold">{stats.total}</CardTitle>
            <CardDescription className="text-slate-400">Total</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className={`${ui.panel} shrink-0 ring-0`}>
        <CardHeader className={`${ui.panelHeader} gap-1`}>
          <CardTitle className="text-sm font-semibold">Filtres</CardTitle>
        </CardHeader>
        <CardContent className={`${ui.panelBody} grid gap-2 pt-0 md:grid-cols-2 xl:grid-cols-4`}>
          <AssetSearchSelect
            assets={assets}
            emptyLabel={`${KYC_UI.ALL} — ${KYC_UI.DESCRIPTION}`}
            label={`${KYC_UI.DESCRIPTION} ${KYC_UI.OPTIONAL}`}
            onValueChange={setSelectedAssetId}
            value={selectedAssetId}
          />
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            Assigne a
            <select
              className={`${ui.input} px-2.5 text-sm text-white`}
              onChange={(e) => setSelectedAssigneeId(e.target.value)}
              value={selectedAssigneeId}
            >
              <option value="">Tous</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            Categorie
            <select
              className={`${ui.input} px-2.5 text-sm text-white`}
              onChange={(e) => setSelectedCategory(e.target.value)}
              value={selectedCategory}
            >
              {supportTicketCategoryOptions.map((o) => (
                <option key={o.value || "all-cat"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            Priorite
            <select
              className={`${ui.input} px-2.5 text-sm text-white`}
              onChange={(e) => setSelectedPriority(e.target.value)}
              value={selectedPriority}
            >
              {supportTicketPriorityOptions.map((o) => (
                <option key={o.value || "all-pri"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            Statut
            <select
              className={`${ui.input} px-2.5 text-sm text-white`}
              onChange={(e) => setSelectedStatus(e.target.value)}
              value={selectedStatus}
            >
              {supportTicketStatusOptions.map((o) => (
                <option key={o.value || "all-st"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            Periode
            <select
              className={`${ui.input} px-2.5 text-sm text-white`}
              onChange={(e) => {
                setPeriod(e.target.value);
                if (e.target.value) setSpecificDate("");
              }}
              value={period}
            >
              {periodOptions.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            Date precise
            <Input
              className={`${ui.input} text-sm text-white`}
              onChange={(e) => {
                setSpecificDate(e.target.value);
                if (e.target.value) {
                  setPeriod("");
                  setStartDate("");
                  setEndDate("");
                }
              }}
              type="date"
              value={specificDate}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            Recherche
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                className={`${ui.input} pl-9 text-sm text-white`}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Reference, titre, demandeur..."
                value={searchQuery}
              />
            </div>
          </label>
        </CardContent>
      </Card>

      <Dialog onOpenChange={setIsFormOpen} open={isFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>
              {editingTicketId ? "Modifier le ticket" : "Nouveau ticket support"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Demande d&apos;assistance IT — reference generee automatiquement si vide
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
            <Input
              className={`${ui.input} text-white md:col-span-2`}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Titre du ticket *"
              required
              value={form.title}
            />
            <Input
              className={`${ui.input} text-white`}
              onChange={(e) =>
                setForm((f) => ({ ...f, reference: e.target.value }))
              }
              placeholder="Reference (auto si vide)"
              value={form.reference}
            />
            <select
              className={`${ui.input} px-2.5 text-sm text-white`}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
              value={form.category}
            >
              {supportTicketCategoryOptions
                .filter((o) => o.value)
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </select>
            <select
              className={`${ui.input} px-2.5 text-sm text-white`}
              onChange={(e) =>
                setForm((f) => ({ ...f, priority: e.target.value }))
              }
              value={form.priority}
            >
              {supportTicketPriorityOptions
                .filter((o) => o.value)
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </select>
            <select
              className={`${ui.input} px-2.5 text-sm text-white`}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value }))
              }
              value={form.status}
            >
              {supportTicketStatusOptions
                .filter((o) => o.value)
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </select>
            <select
              className={`${ui.input} px-2.5 text-sm text-white`}
              onChange={(e) =>
                setForm((f) => ({ ...f, assigneeId: e.target.value }))
              }
              value={form.assigneeId}
            >
              <option value="">Non assigne</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <select
              className={`${ui.input} px-2.5 text-sm text-white`}
              onChange={(e) =>
                setForm((f) => ({ ...f, requesterId: e.target.value }))
              }
              value={form.requesterId}
            >
              <option value="">Demandeur interne</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <AssetSearchSelect
              className="md:col-span-2"
              emptyLabel={`${KYC_UI.DESCRIPTION} ${KYC_UI.OPTIONAL}`}
              label={`${KYC_UI.DESCRIPTION} ${KYC_UI.OPTIONAL}`}
              assets={assets}
              onValueChange={(assetId) =>
                setForm((f) => ({ ...f, assetId }))
              }
              value={form.assetId}
            />
            <Input
              className={`${ui.input} text-white`}
              onChange={(e) =>
                setForm((f) => ({ ...f, contactEmail: e.target.value }))
              }
              placeholder="Email contact"
              type="email"
              value={form.contactEmail}
            />
            <Input
              className={`${ui.input} text-white`}
              onChange={(e) =>
                setForm((f) => ({ ...f, contactPhone: e.target.value }))
              }
              placeholder="Telephone contact"
              value={form.contactPhone}
            />
            <textarea
              className={`min-h-20 rounded-md border px-3 py-2 text-sm text-white md:col-span-2 ${ui.input}`}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Description du probleme"
              value={form.description}
            />
            <Input
              className={`${ui.input} text-white md:col-span-2`}
              onChange={(e) =>
                setForm((f) => ({ ...f, comment: e.target.value }))
              }
              placeholder={
                editingTicketId
                  ? "Commentaire / mise a jour (historique)"
                  : "Commentaire initial (optionnel)"
              }
              value={form.comment}
            />
            <div className="flex gap-2 md:col-span-2">
              <Button className={`flex-1 ${ui.btnPrimary}`} type="submit">
                {editingTicketId ? "Enregistrer" : "Creer le ticket"}
              </Button>
              {editingTicketId ? (
                <Button
                  className="bg-red-900/30 text-red-200 hover:bg-red-900/50"
                  onClick={() => void handleDelete(editingTicketId)}
                  type="button"
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setDetailTicket(null)}
        open={Boolean(detailTicket)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-slate-900 text-white">
          {detailTicket ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Headphones className="size-5 text-red-400" />
                  {detailTicket.reference} — {detailTicket.title}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {detailTicket.category} · {detailTicket.priority} ·{" "}
                  {detailTicket.status}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-slate-300">
                {detailTicket.description ?? "Aucune description."}
              </p>
              <div className="space-y-2 border-t border-white/10 pt-3">
                <p className="text-xs uppercase text-slate-500">Historique</p>
                {detailTicket.updates.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucune mise a jour.</p>
                ) : (
                  detailTicket.updates.map((update) => (
                    <div
                      className="rounded-md border border-white/10 bg-slate-800/50 p-3 text-sm"
                      key={update.id}
                    >
                      <p className="text-xs text-slate-500">
                        {update.author} · {update.createdAt}
                        {update.statusTo ? ` · ${update.statusTo}` : ""}
                      </p>
                      <p className="mt-1 text-slate-200">{update.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {error ? (
        <Card className={`${ui.panel} shrink-0 border-red-900/40 ring-0`}>
          <CardContent className={`${ui.panelBody} text-sm text-red-200`}>
            {error}
          </CardContent>
        </Card>
      ) : null}

      <Card className={`${ui.panel} ${ui.tablePanel}`}>
        <CardContent className={ui.tablePanelBody}>
          {isLoading ? (
            <p className="text-sm text-slate-400">Chargement des tickets...</p>
          ) : filteredTickets.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun ticket pour ces filtres.</p>
          ) : (
            <div className={ui.tableWrap}>
              <Table className="table-fixed min-w-[960px]">
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="w-[22%] text-xs text-slate-500">
                      Ticket
                    </TableHead>
                    <TableHead className="w-[16%] text-xs text-slate-500">
                      Demandeur
                    </TableHead>
                    <TableHead className="w-[14%] text-xs text-slate-500">
                      Assigne
                    </TableHead>
                    <TableHead className="w-[10%] text-xs text-slate-500">
                      Priorite
                    </TableHead>
                    <TableHead className="w-[16%] text-xs text-slate-500">
                      Progression
                    </TableHead>
                    <TableHead className="w-[12%] text-xs text-slate-500">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow
                      className="cursor-pointer border-white/6"
                      key={ticket.id}
                      onClick={() => setDetailTicket(ticket)}
                    >
                      <TableCell className="whitespace-normal break-words align-top">
                        <span className="inline-flex items-center gap-1.5">
                          <p className="font-mono text-xs text-slate-400">
                            {ticket.reference}
                          </p>
                          <CopyReferenceButton value={ticket.reference} />
                        </span>
                        <p className="mt-1 font-medium text-white">{ticket.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {ticket.category}
                          {ticket.asset !== "—"
                            ? ` · ${KYC_UI.DESCRIPTION}: ${ticket.asset}`
                            : ""}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-normal break-words align-top text-slate-300">
                        <span className="flex items-start gap-2">
                          <UserRound className="size-4 shrink-0 text-slate-500" />
                          {ticket.requester}
                        </span>
                        {ticket.contactEmail ? (
                          <span className="mt-2 flex items-start gap-2 text-xs text-slate-400">
                            <Mail className="size-3.5 shrink-0" />
                            {ticket.contactEmail}
                          </span>
                        ) : null}
                        {ticket.contactPhone ? (
                          <span className="mt-1 flex items-start gap-2 text-xs text-slate-400">
                            <Phone className="size-3.5 shrink-0" />
                            {ticket.contactPhone}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words align-top text-slate-300">
                        {ticket.assignee}
                        <span className="mt-2 flex items-start gap-2 text-xs text-slate-400">
                          <Clock className="size-4 shrink-0 text-slate-500" />
                          {ticket.openedAt}
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        <PriorityBadge priority={ticket.priority} />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="mb-2 flex justify-between gap-2 text-[0.65rem] text-slate-500">
                          <span>{ticket.status}</span>
                          <span>{ticket.progress}%</span>
                        </div>
                        <Progress
                          className="[&_[data-slot=progress-indicator]]:bg-red-600 [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-white/10"
                          value={ticket.progress}
                        />
                      </TableCell>
                      <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-2">
                          <Button
                            className={`h-8 px-2 text-xs ${ui.btnSecondary}`}
                            onClick={() => openEdit(ticket)}
                            type="button"
                          >
                            Modifier
                          </Button>
                          <Button
                            className="h-8 bg-red-900/30 px-2 text-xs text-red-200 hover:bg-red-900/50"
                            onClick={() => void handleDelete(ticket.id)}
                            type="button"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
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

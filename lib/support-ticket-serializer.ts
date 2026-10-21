const categoryLabels: Record<string, string> = {
  HARDWARE: "Materiel",
  SOFTWARE: "Logiciel",
  NETWORK: "Reseau",
  ACCESS: "Acces / compte",
  OTHER: "Autre",
};

const priorityLabels: Record<string, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  URGENT: "Urgente",
};

const statusLabels: Record<string, string> = {
  OPEN: "Ouvert",
  IN_PROGRESS: "En cours",
  WAITING_USER: "Attente utilisateur",
  RESOLVED: "Resolu",
  CLOSED: "Cloture",
};

const progressBase: Record<string, number> = {
  OPEN: 10,
  IN_PROGRESS: 45,
  WAITING_USER: 60,
  RESOLVED: 100,
  CLOSED: 100,
};

function calculateProgress(status: string, updateCount: number) {
  if (status === "RESOLVED" || status === "CLOSED") {
    return 100;
  }

  const base = progressBase[status] ?? 0;
  return Math.min(base + Math.min(updateCount * 4, 25), 95);
}

export const supportTicketCategoryOptions = [
  { label: "Toutes categories", value: "" },
  { label: "Materiel", value: "HARDWARE" },
  { label: "Logiciel", value: "SOFTWARE" },
  { label: "Reseau", value: "NETWORK" },
  { label: "Acces / compte", value: "ACCESS" },
  { label: "Autre", value: "OTHER" },
] as const;

export const supportTicketPriorityOptions = [
  { label: "Toutes priorites", value: "" },
  { label: "Basse", value: "LOW" },
  { label: "Moyenne", value: "MEDIUM" },
  { label: "Haute", value: "HIGH" },
  { label: "Urgente", value: "URGENT" },
] as const;

export const supportTicketStatusOptions = [
  { label: "Tous statuts", value: "" },
  { label: "Ouvert", value: "OPEN" },
  { label: "En cours", value: "IN_PROGRESS" },
  { label: "Attente utilisateur", value: "WAITING_USER" },
  { label: "Resolu", value: "RESOLVED" },
  { label: "Cloture", value: "CLOSED" },
] as const;

type SupportTicketWithRelations = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  contactEmail: string | null;
  contactPhone: string | null;
  openedAt: Date;
  requester: { name: string | null; email: string } | null;
  assignee: { name: string | null } | null;
  asset: { name: string; sku: string } | null;
  updates: {
    id: string;
    comment: string;
    statusTo: string | null;
    createdAt: Date;
    author: { name: string | null } | null;
  }[];
};

export function serializeSupportTicket(ticket: SupportTicketWithRelations) {
  return {
    id: ticket.id,
    reference: ticket.reference,
    title: ticket.title,
    description: ticket.description,
    category: categoryLabels[ticket.category] ?? ticket.category,
    priority: priorityLabels[ticket.priority] ?? ticket.priority,
    status: statusLabels[ticket.status] ?? ticket.status,
    requester:
      ticket.requester?.name ??
      ticket.requester?.email ??
      ticket.contactEmail ??
      "Non renseigne",
    assignee: ticket.assignee?.name ?? "Non assigne",
    asset: ticket.asset ? `${ticket.asset.sku} — ${ticket.asset.name}` : "—",
    contactEmail: ticket.contactEmail,
    contactPhone: ticket.contactPhone,
    progress: calculateProgress(ticket.status, ticket.updates.length),
    openedAt: ticket.openedAt.toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }),
    updates: ticket.updates.map((update) => ({
      id: update.id,
      author: update.author?.name ?? "Systeme",
      comment: update.comment,
      statusTo: update.statusTo
        ? statusLabels[update.statusTo] ?? update.statusTo
        : null,
      createdAt: update.createdAt.toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    })),
  };
}

export function getCategoryLabel(value: string) {
  return categoryLabels[value] ?? value;
}

export function getPriorityLabel(value: string) {
  return priorityLabels[value] ?? value;
}

export function getSupportStatusLabel(value: string) {
  return statusLabels[value] ?? value;
}

import type { PrismaClient } from "./generated/prisma/client";

export async function nextSupportTicketReference(prisma: PrismaClient) {
  const year = new Date().getFullYear();
  const prefix = `SUP-${year}-`;
  const last = await prisma.supportTicket.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const lastNum = last
    ? Number.parseInt(String(last.reference).slice(prefix.length), 10)
    : 0;
  return `${prefix}${String(Number.isFinite(lastNum) ? lastNum + 1 : 1).padStart(4, "0")}`;
}

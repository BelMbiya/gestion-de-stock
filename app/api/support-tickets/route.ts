import { revalidateTag, unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import {
  buildSupportTicketWhere,
  hasSupportTicketListFilters,
  parseSupportTicketSearchParams,
} from "@/lib/support-ticket-filters";
import {
  nextSupportTicketReference,
  serializeSupportTicket,
} from "@/lib/support-ticket-serializer";
import { kycAssetListSelect } from "@/lib/kyc-excel/asset-select";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const categoryValues = ["HARDWARE", "SOFTWARE", "NETWORK", "ACCESS", "OTHER"] as const;
const priorityValues = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const statusValues = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_USER",
  "RESOLVED",
  "CLOSED",
] as const;

const ticketInclude = {
  asset: {
    select: kycAssetListSelect,
  },
  assignee: true,
  requester: true,
  updates: {
    include: { author: true },
    orderBy: { createdAt: "desc" as const },
  },
};

function normalizeCategory(category: unknown) {
  return categoryValues.find((value) => value === category) ?? "OTHER";
}

function normalizePriority(priority: unknown) {
  return priorityValues.find((value) => value === priority) ?? "MEDIUM";
}

function normalizeStatus(status: unknown) {
  return statusValues.find((value) => value === status) ?? "OPEN";
}

function revalidateSupportViews() {
  revalidateTag("dashboard", "max");
  revalidateTag("history", "max");
  revalidateTag("support-tickets", "max");
  revalidateTag("notifications", "max");
  revalidateTag("reports", "max");
}

async function fetchSupportTicketsPayload(
  where?: ReturnType<typeof buildSupportTicketWhere>,
) {
  const [tickets, assets, users] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: ticketInclude,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.asset.findMany({
      orderBy: { name: "asc" },
      select: kycAssetListSelect,
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);

  return {
    assets,
    users: users.map((user) => ({
      id: user.id,
      name: user.name ?? user.email,
      email: user.email,
      role: user.role,
    })),
    tickets: tickets.map((ticket) => serializeSupportTicket(ticket)),
  };
}

const getSupportTicketsData = unstable_cache(
  async () => fetchSupportTicketsPayload(),
  ["support-tickets-data"],
  {
    revalidate: 60,
    tags: ["support-tickets"],
  },
);

export async function GET(request: Request) {
  const filters = parseSupportTicketSearchParams(new URL(request.url).searchParams);

  if (!hasSupportTicketListFilters(filters)) {
    return NextResponse.json(await getSupportTicketsData());
  }

  return NextResponse.json(
    await fetchSupportTicketsPayload(buildSupportTicketWhere(filters)),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const status = normalizeStatus(body.status);
  const history = body.history ?? body.comment;
  const reference =
    body.reference && String(body.reference).trim()
      ? String(body.reference)
      : await nextSupportTicketReference(prisma);

  const ticket = await prisma.supportTicket.create({
    data: {
      reference,
      title: String(body.title),
      description: body.description ? String(body.description) : null,
      category: normalizeCategory(body.category),
      priority: normalizePriority(body.priority),
      status,
      requesterId: body.requesterId ? String(body.requesterId) : null,
      assigneeId: body.assigneeId ? String(body.assigneeId) : null,
      assetId: body.assetId ? String(body.assetId) : null,
      contactEmail: body.contactEmail ? String(body.contactEmail) : null,
      contactPhone: body.contactPhone ? String(body.contactPhone) : null,
      updates: history
        ? {
            create: {
              comment: String(history),
              statusTo: status,
              authorId: body.assigneeId ? String(body.assigneeId) : null,
            },
          }
        : undefined,
    },
  });

  revalidateSupportViews();

  return NextResponse.json({ ticket }, { status: 201 });
}

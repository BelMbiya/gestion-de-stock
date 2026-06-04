import { revalidateTag, unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import {
  buildIncidentWhere,
  hasIncidentListFilters,
  parseIncidentSearchParams,
} from "@/lib/incident-filters";
import { serializeIncident } from "@/lib/incident-serializer";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const severityValues = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const statusValues = [
  "IDENTIFIED",
  "DIAGNOSING",
  "IN_PROGRESS",
  "WAITING_PART",
  "RESOLVED",
  "CLOSED",
] as const;

const incidentInclude = {
  asset: {
    include: {
      location: true,
    },
  },
  assignee: true,
  reporter: true,
  updates: {
    include: {
      author: true,
    },
    orderBy: {
      createdAt: "desc" as const,
    },
  },
};

function normalizeSeverity(severity: unknown) {
  return severityValues.find((value) => value === severity) ?? "MEDIUM";
}

function normalizeStatus(status: unknown) {
  return statusValues.find((value) => value === status) ?? "IDENTIFIED";
}

async function fetchIncidentsPayload(where?: ReturnType<typeof buildIncidentWhere>) {
  const [incidents, assets, users] = await Promise.all([
    prisma.incident.findMany({
      where,
      include: incidentInclude,
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.asset.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      where: {
        role: {
          in: ["ADMIN", "IT_MANAGER", "TECHNICIAN"],
        },
      },
      select: { id: true, name: true, email: true },
    }),
  ]);

  return {
    assets,
    users: users.map((user) => ({
      id: user.id,
      name: user.name ?? user.email,
      email: user.email,
    })),
    incidents: incidents.map((incident) => serializeIncident(incident)),
  };
}

const getIncidentsData = unstable_cache(
  async () => fetchIncidentsPayload(),
  ["incidents-data"],
  {
    revalidate: 60,
    tags: ["incidents"],
  },
);

export async function GET(request: Request) {
  const filters = parseIncidentSearchParams(new URL(request.url).searchParams);

  if (!hasIncidentListFilters(filters)) {
    return NextResponse.json(await getIncidentsData());
  }

  return NextResponse.json(
    await fetchIncidentsPayload(buildIncidentWhere(filters)),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const status = normalizeStatus(body.status);
  const history = body.history ?? body.comment;

  const incident = await prisma.incident.create({
    data: {
      reference: String(body.reference),
      title: String(body.title),
      description: body.description ? String(body.description) : null,
      assetId: String(body.assetId),
      severity: normalizeSeverity(body.severity),
      status,
      reporterId: body.reporterId ? String(body.reporterId) : null,
      assigneeId: body.assigneeId ? String(body.assigneeId) : null,
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

  revalidateTag("dashboard", "max");
  revalidateTag("history", "max");
  revalidateTag("incidents", "max");
  revalidateTag("inventory", "max");
  revalidateTag("notifications", "max");
  revalidateTag("reports", "max");

  return NextResponse.json({ incident }, { status: 201 });
}

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";

const severityValues = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const statusValues = [
  "IDENTIFIED",
  "DIAGNOSING",
  "IN_PROGRESS",
  "WAITING_PART",
  "RESOLVED",
  "CLOSED",
] as const;

function normalizeSeverity(severity: unknown) {
  return severityValues.find((value) => value === severity);
}

function normalizeStatus(status: unknown) {
  return statusValues.find((value) => value === status);
}

export const PATCH = withAuth(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const body = await request.json();
  const status = normalizeStatus(body.status);
  const history = body.history ?? body.comment;

  const incident = await prisma.incident.update({
    where: { id },
    data: {
      reference: body.reference ? String(body.reference) : undefined,
      title: body.title ? String(body.title) : undefined,
      description:
        body.description === undefined ? undefined : body.description || null,
      assetId: body.assetId ? String(body.assetId) : undefined,
      severity: normalizeSeverity(body.severity),
      status,
      reporterId:
        body.reporterId === undefined ? undefined : body.reporterId || null,
      assigneeId:
        body.assigneeId === undefined ? undefined : body.assigneeId || null,
      resolvedAt: status === "RESOLVED" ? new Date() : undefined,
      closedAt: status === "CLOSED" ? new Date() : undefined,
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

  return NextResponse.json({ incident });
});

export const DELETE = withAuth(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;

  await prisma.incident.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true });
});

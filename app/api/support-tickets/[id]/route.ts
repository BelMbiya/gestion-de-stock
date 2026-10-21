import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const categoryValues = ["HARDWARE", "SOFTWARE", "NETWORK", "ACCESS", "OTHER"] as const;
const priorityValues = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const statusValues = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_USER",
  "RESOLVED",
  "CLOSED",
] as const;

function normalizeCategory(category: unknown) {
  return categoryValues.find((value) => value === category);
}

function normalizePriority(priority: unknown) {
  return priorityValues.find((value) => value === priority);
}

function normalizeStatus(status: unknown) {
  return statusValues.find((value) => value === status);
}

function revalidateSupportViews() {
  revalidateTag("dashboard", "max");
  revalidateTag("history", "max");
  revalidateTag("support-tickets", "max");
  revalidateTag("notifications", "max");
  revalidateTag("reports", "max");
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const status = normalizeStatus(body.status);
  const history = body.history ?? body.comment;

  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: {
      reference: body.reference ? String(body.reference) : undefined,
      title: body.title ? String(body.title) : undefined,
      description:
        body.description === undefined ? undefined : body.description || null,
      category: normalizeCategory(body.category),
      priority: normalizePriority(body.priority),
      status,
      requesterId:
        body.requesterId === undefined ? undefined : body.requesterId || null,
      assigneeId:
        body.assigneeId === undefined ? undefined : body.assigneeId || null,
      assetId: body.assetId === undefined ? undefined : body.assetId || null,
      contactEmail:
        body.contactEmail === undefined ? undefined : body.contactEmail || null,
      contactPhone:
        body.contactPhone === undefined ? undefined : body.contactPhone || null,
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

  revalidateSupportViews();

  return NextResponse.json({ ticket });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  await prisma.supportTicket.delete({
    where: { id },
  });

  revalidateSupportViews();

  return NextResponse.json({ ok: true });
}

import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const checkStatuses = ["FOUND", "MISSING", "DAMAGED", "MOVED"] as const;

function normalizeCheckStatus(status: unknown) {
  return checkStatuses.find((value) => value === status);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const status = normalizeCheckStatus(body.status);

  if (!status) {
    return NextResponse.json({ error: "Statut de controle invalide" }, { status: 400 });
  }

  const check = await prisma.inventoryCheck.update({
    where: { id },
    data: {
      status,
      notes: body.notes === undefined ? undefined : body.notes || null,
    },
    include: {
      asset: true,
      session: true,
    },
  });

  if (status === "MOVED" && body.newLocationId) {
    await prisma.asset.update({
      where: { id: check.assetId },
      data: { locationId: String(body.newLocationId) },
    });
  }

  revalidateTag("stock", "max");
  revalidateTag("dashboard", "max");
  revalidateTag("inventory", "max");

  return NextResponse.json({ check });
}

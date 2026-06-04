import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessions = await prisma.inventorySession.findMany({
    include: {
      checks: {
        include: {
          asset: true,
          expectedLocation: true,
          checkedBy: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      name: session.name,
      description: session.description,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      isOpen: !session.endedAt,
      checks: session.checks.map((check) => ({
        id: check.id,
        asset: check.asset.name,
        sku: check.asset.sku,
        imageUrl: check.asset.imageUrl,
        status: check.status,
        notes: check.notes,
        expectedLocation: check.expectedLocation?.name ?? "-",
        checkedBy: check.checkedBy?.name ?? "-",
        checkedAt: check.checkedAt.toISOString(),
      })),
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const assets = await prisma.asset.findMany({
    select: { id: true, locationId: true },
  });

  const session = await prisma.inventorySession.create({
    data: {
      name: String(body.name),
      description: body.description ? String(body.description) : null,
      checks: {
        create: assets.map((asset) => ({
          assetId: asset.id,
          expectedLocationId: asset.locationId,
          status: "FOUND",
        })),
      },
    },
    include: { _count: { select: { checks: true } } },
  });

  revalidateTag("stock", "max");
  revalidateTag("dashboard", "max");

  return NextResponse.json({ session }, { status: 201 });
}

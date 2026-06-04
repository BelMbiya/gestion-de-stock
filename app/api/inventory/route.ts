import { revalidateTag, unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { normalizeImageUrl } from "@/lib/asset-image";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const assetStatusLabels: Record<string, string> = {
  AVAILABLE: "Disponible",
  ASSIGNED: "Assigne",
  MAINTENANCE: "Maintenance",
  BROKEN: "Critique",
  RETIRED: "Reforme",
  LOST: "Perdu",
};

const assetStatusValues = [
  "AVAILABLE",
  "ASSIGNED",
  "MAINTENANCE",
  "BROKEN",
  "RETIRED",
  "LOST",
] as const;

function normalizeAssetStatus(status: unknown) {
  return assetStatusValues.find((value) => value === status) ?? "AVAILABLE";
}

const getInventoryData = unstable_cache(
  async () => {
  const assets = await prisma.asset.findMany({
    include: {
      assignments: {
        include: {
          assignedTo: true,
          department: true,
        },
        orderBy: {
          assignedAt: "desc",
        },
        take: 1,
      },
      category: true,
      incidents: {
        orderBy: {
          updatedAt: "desc",
        },
        take: 1,
        where: {
          status: {
            notIn: ["RESOLVED", "CLOSED"],
          },
        },
      },
      location: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const [categories, locations] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
  ]);

  return {
    categories,
    locations,
    assets: assets.map((asset) => {
      const currentAssignment = asset.assignments[0];
      const openIncident = asset.incidents[0];

      return {
        id: asset.id,
        sku: asset.sku,
        serialNumber: asset.serialNumber,
        name: asset.name,
        imageUrl: asset.imageUrl,
        category: asset.category.name,
        location: asset.location?.name ?? "Non localise",
        status: assetStatusLabels[asset.status] ?? asset.status,
        assignedTo:
          currentAssignment?.assignedTo?.name ??
          currentAssignment?.department?.name ??
          "Stock IT",
        openIncident: openIncident?.reference ?? null,
        value: asset.purchaseValue ? `$${asset.purchaseValue.toString()}` : "-",
        updatedAt: asset.updatedAt.toLocaleString("fr-FR", {
          dateStyle: "short",
          timeStyle: "short",
        }),
      };
    }),
  };
  },
  ["inventory-data"],
  {
    revalidate: 60,
    tags: ["inventory"],
  },
);

export async function GET() {
  return NextResponse.json(await getInventoryData());
}

export async function POST(request: Request) {
  const body = await request.json();

  const asset = await prisma.asset.create({
    data: {
      sku: String(body.sku),
      serialNumber: body.serialNumber ? String(body.serialNumber) : null,
      name: String(body.name),
      imageUrl: normalizeImageUrl(body.imageUrl),
      description: body.description ? String(body.description) : null,
      status: normalizeAssetStatus(body.status),
      purchaseValue: body.purchaseValue ? String(body.purchaseValue) : null,
      categoryId: String(body.categoryId),
      locationId: body.locationId ? String(body.locationId) : null,
    },
  });

  revalidateTag("dashboard", "max");
  revalidateTag("history", "max");
  revalidateTag("inventory", "max");
  revalidateTag("reports", "max");

  return NextResponse.json({ asset }, { status: 201 });
}

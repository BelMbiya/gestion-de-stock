import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const suppliers = await prisma.supplier.findMany({
    include: { _count: { select: { assets: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      notes: supplier.notes,
      assetsCount: supplier._count.assets,
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  const supplier = await prisma.supplier.create({
    data: {
      name: String(body.name),
      code: String(body.code),
      email: body.email ? String(body.email) : null,
      phone: body.phone ? String(body.phone) : null,
      address: body.address ? String(body.address) : null,
      notes: body.notes ? String(body.notes) : null,
    },
  });

  revalidateTag("stock", "max");
  revalidateTag("inventory", "max");

  return NextResponse.json({ supplier }, { status: 201 });
}

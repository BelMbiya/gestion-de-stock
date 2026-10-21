import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async () => {
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
});

export const POST = withAuth(async (request: Request) => {
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

  return NextResponse.json({ supplier }, { status: 201 });
});

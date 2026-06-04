import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      name: body.name ? String(body.name) : undefined,
      code: body.code ? String(body.code) : undefined,
      email: body.email === undefined ? undefined : body.email || null,
      phone: body.phone === undefined ? undefined : body.phone || null,
      address: body.address === undefined ? undefined : body.address || null,
      notes: body.notes === undefined ? undefined : body.notes || null,
    },
  });

  revalidateTag("stock", "max");
  revalidateTag("inventory", "max");

  return NextResponse.json({ supplier });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  await prisma.supplier.delete({ where: { id } });
  revalidateTag("stock", "max");
  revalidateTag("inventory", "max");

  return NextResponse.json({ ok: true });
}

import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const session = await prisma.inventorySession.update({
    where: { id },
    data: {
      name: body.name ? String(body.name) : undefined,
      description:
        body.description === undefined ? undefined : body.description || null,
      endedAt: body.close ? new Date() : undefined,
    },
  });

  revalidateTag("stock", "max");
  revalidateTag("dashboard", "max");

  return NextResponse.json({ session });
}

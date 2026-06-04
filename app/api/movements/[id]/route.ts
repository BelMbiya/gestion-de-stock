import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  await prisma.stockMovement.delete({
    where: { id },
  });

  revalidateTag("movements", "max");
  revalidateTag("history", "max");
  revalidateTag("inventory", "max");
  revalidateTag("dashboard", "max");
  revalidateTag("reports", "max");

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";

export const PATCH = withAuth(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
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

  return NextResponse.json({ session });
});

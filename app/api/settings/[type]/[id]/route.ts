import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";

const settingTypes = ["category", "location", "department"] as const;

function normalizeType(type: unknown) {
  return settingTypes.find((value) => value === type);
}

export const PATCH = withAuth(async (
  request: Request,
  { params }: { params: Promise<{ id: string; type: string }> },
) => {
  const { id, type: rawType } = await params;
  const type = normalizeType(rawType);
  const body = await request.json();

  if (!type) {
    return NextResponse.json({ error: "Invalid setting type" }, { status: 400 });
  }

  const data = {
    description: body.description === undefined ? undefined : body.description || null,
    name: body.name ? String(body.name) : undefined,
  };

  const item =
    type === "category"
      ? await prisma.category.update({ where: { id }, data })
      : type === "department"
        ? await prisma.department.update({ where: { id }, data })
        : await prisma.location.update({
            where: { id },
            data: {
              ...data,
              code: body.code ? String(body.code) : undefined,
            },
          });

  return NextResponse.json({ item });
});

export const DELETE = withAuth(async (
  _request: Request,
  { params }: { params: Promise<{ id: string; type: string }> },
) => {
  const { id, type: rawType } = await params;
  const type = normalizeType(rawType);

  if (!type) {
    return NextResponse.json({ error: "Invalid setting type" }, { status: 400 });
  }

  if (type === "category") {
    await prisma.category.delete({ where: { id } });
  } else if (type === "department") {
    await prisma.department.delete({ where: { id } });
  } else {
    await prisma.location.delete({ where: { id } });
  }

  return NextResponse.json({ ok: true });
});

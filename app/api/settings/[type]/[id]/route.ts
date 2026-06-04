import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const settingTypes = ["category", "location", "department"] as const;

function normalizeType(type: unknown) {
  return settingTypes.find((value) => value === type);
}

function revalidateSettingsViews() {
  revalidateTag("settings", "max");
  revalidateTag("inventory", "max");
  revalidateTag("dashboard", "max");
  revalidateTag("reports", "max");
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
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

  revalidateSettingsViews();

  return NextResponse.json({ item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
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

  revalidateSettingsViews();

  return NextResponse.json({ ok: true });
}

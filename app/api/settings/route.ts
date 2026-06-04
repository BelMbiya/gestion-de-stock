import { revalidateTag, unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const settingTypes = ["category", "location", "department"] as const;

function normalizeType(type: unknown) {
  return settingTypes.find((value) => value === type);
}

const getSettingsData = unstable_cache(
  async () => {
    const [categories, departments, locations] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.department.findMany({ orderBy: { name: "asc" } }),
      prisma.location.findMany({ orderBy: { name: "asc" } }),
    ]);

    return { categories, departments, locations };
  },
  ["settings-data"],
  {
    revalidate: 60,
    tags: ["settings", "inventory", "dashboard"],
  },
);

export async function GET() {
  return NextResponse.json(await getSettingsData());
}

export async function POST(request: Request) {
  const body = await request.json();
  const type = normalizeType(body.type);

  if (!type) {
    return NextResponse.json({ error: "Invalid setting type" }, { status: 400 });
  }

  const data = {
    description: body.description ? String(body.description) : null,
    name: String(body.name),
  };

  const item =
    type === "category"
      ? await prisma.category.create({ data })
      : type === "department"
        ? await prisma.department.create({ data })
        : await prisma.location.create({
            data: {
              ...data,
              code: String(body.code),
            },
          });

  revalidateTag("settings", "max");
  revalidateTag("inventory", "max");
  revalidateTag("dashboard", "max");
  revalidateTag("reports", "max");

  return NextResponse.json({ item }, { status: 201 });
}

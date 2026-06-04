import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const technicianRoles = ["TECHNICIAN", "IT_MANAGER", "ADMIN"] as const;

function normalizeRole(role: unknown) {
  return technicianRoles.find((value) => value === role);
}

function revalidateTechnicianViews() {
  revalidateTag("technicians", "max");
  revalidateTag("incidents", "max");
  revalidateTag("assignments", "max");
  revalidateTag("dashboard", "max");
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const technician = await prisma.user.update({
    where: { id },
    data: {
      departmentId:
        body.departmentId === undefined ? undefined : body.departmentId || null,
      email: body.email ? String(body.email) : undefined,
      name: body.name === undefined ? undefined : body.name || null,
      photoUrl: body.photoUrl === undefined ? undefined : body.photoUrl || null,
      role: normalizeRole(body.role),
    },
  });

  revalidateTechnicianViews();

  return NextResponse.json({ technician });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  await prisma.user.delete({
    where: { id },
  });

  revalidateTechnicianViews();

  return NextResponse.json({ ok: true });
}

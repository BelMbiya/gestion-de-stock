import { NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { domainErrorResponse } from "@/lib/domain-error";
import type { HolderType } from "@/lib/generated/prisma/enums";
import { holderTypeLabels } from "@/lib/holders/holder-names";
import { createHolder, holderFlags } from "@/lib/holders/holder-service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Liste des detenteurs avec le materiel detenu actuellement. */
export const GET = withAuth(async () => {
  const [holders, departments] = await Promise.all([
    prisma.holder.findMany({
      include: {
        department: true,
        _count: { select: { assignments: { where: { status: "ACTIVE" } } } },
      },
      orderBy: [{ active: "desc" }, { fullName: "asc" }],
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({
    departments: departments.map((department) => ({ id: department.id, name: department.name })),
    holders: holders.map((holder) => ({
      id: holder.id,
      type: holder.type,
      typeLabel: holderTypeLabels[holder.type],
      fullName: holder.fullName,
      matricule: holder.matricule,
      process: holder.process,
      departmentId: holder.departmentId,
      department: holder.department?.name ?? null,
      active: holder.active,
      activeAssignments: holder._count.assignments,
      ...holderFlags(holder, holder._count.assignments),
    })),
  });
});

export const POST = withAuth(async (request: Request) => {
  try {
    const body = await request.json();
    const holder = await prisma.$transaction((tx) =>
      createHolder(tx, {
        type: body.type as HolderType,
        fullName: body.fullName,
        matricule: body.matricule,
        process: body.process,
        departmentId: body.departmentId,
      }),
    );
    return NextResponse.json({ holder }, { status: 201 });
  } catch (error) {
    return domainErrorResponse(error);
  }
});

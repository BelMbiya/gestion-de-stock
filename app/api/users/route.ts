import { NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { domainErrorResponse } from "@/lib/domain-error";
import { prisma } from "@/lib/prisma";
import { createUser, listUsers } from "@/lib/users/user-service";

export const dynamic = "force-dynamic";

/** Comptes autorises a se connecter (liste blanche) + departements pour le formulaire. */
export const GET = withAuth(async (_request: Request, _context: unknown, user) => {
  const [users, departments] = await Promise.all([
    listUsers(prisma, user.id),
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));

  return NextResponse.json({
    departments,
    users: users.map((item) => ({
      ...item,
      department: (item.departmentId && departmentNames.get(item.departmentId)) || "Non renseigne",
    })),
  });
});

export const POST = withAuth(async (request: Request) => {
  try {
    const body = await request.json();
    const created = await prisma.$transaction((tx) => createUser(tx, body), { isolationLevel: "Serializable" });
    return NextResponse.json({ user: { id: created.id } }, { status: 201 });
  } catch (error) {
    return domainErrorResponse(error);
  }
});

import { NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { domainErrorResponse } from "@/lib/domain-error";
import { prisma } from "@/lib/prisma";
import { deleteUser, updateUser } from "@/lib/users/user-service";

type Context = { params: Promise<{ id: string }> };

// Serializable : deux retraits simultanes ne peuvent pas laisser l'application sans gestionnaire.
const serializable = { isolationLevel: "Serializable" as const };

export const PATCH = withAuth(async (request: Request, { params }: Context, user) => {
  try {
    const { id } = await params;
    const body = await request.json();
    await prisma.$transaction((tx) => updateUser(tx, user.id, id, body), serializable);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainErrorResponse(error);
  }
});

export const DELETE = withAuth(async (_request: Request, { params }: Context, user) => {
  try {
    const { id } = await params;
    await prisma.$transaction((tx) => deleteUser(tx, user.id, id), serializable);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainErrorResponse(error);
  }
});

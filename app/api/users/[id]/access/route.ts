import { NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { domainErrorResponse } from "@/lib/domain-error";
import { prisma } from "@/lib/prisma";
import { UserRuleError } from "@/lib/users/errors";
import { setUserActive } from "@/lib/users/user-service";

type Context = { params: Promise<{ id: string }> };

/** Revoque ou retablit l'acces d'un compte (l'historique est conserve). */
export const PATCH = withAuth(async (request: Request, { params }: Context, user) => {
  try {
    const { id } = await params;
    const body = await request.json();
    if (typeof body.active !== "boolean") {
      throw new UserRuleError("Indiquez si l'acces est actif (true) ou revoque (false).");
    }
    await prisma.$transaction((tx) => setUserActive(tx, user.id, id, body.active), {
      isolationLevel: "Serializable",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainErrorResponse(error);
  }
});

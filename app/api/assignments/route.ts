import { revalidateTag, unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import {
  AssignmentError,
  assertAssetAssignable,
  createAssignmentAudit,
  syncAssignmentSideEffects,
  validateAssignmentPayload,
} from "@/lib/apply-assignment";
import {
  getAssignmentReturnAlert,
  getAssignmentReturnAlertLabel,
  getDaysUntilDate,
} from "@/lib/assignment-alerts";
import { getStockLevelStatus, getStockLevelLabel } from "@/lib/stock-management";
import {
  assignmentStatusLabels,
  normalizeAssignmentStatus,
  revalidateAssignmentTags,
} from "@/lib/assignment-management";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function parseDate(value: unknown) {
  return value ? new Date(String(value)) : null;
}

function formatDate(value: Date | null) {
  return value
    ? value.toLocaleDateString("fr-FR", {
        dateStyle: "medium",
      })
    : "-";
}

function formatDateInput(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function revalidateAll() {
  for (const tag of revalidateAssignmentTags()) {
    revalidateTag(tag, "max");
  }
}

const getAssignmentsData = unstable_cache(
  async () => {
    const [assignments, assets, users, departments] = await Promise.all([
      prisma.assetAssignment.findMany({
        include: {
          asset: {
            include: {
              category: true,
              location: true,
            },
          },
          assignedTo: true,
          department: true,
        },
        orderBy: {
          assignedAt: "desc",
        },
      }),
      prisma.asset.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          sku: true,
          status: true,
          quantityOnHand: true,
          reorderPoint: true,
          minQuantity: true,
          maxQuantity: true,
        },
      }),
      prisma.user.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.department.findMany({
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      assets: assets.map((asset) => {
        const stockLevel = getStockLevelStatus(
          asset.quantityOnHand,
          asset.reorderPoint,
          asset.minQuantity,
          asset.maxQuantity,
        );
        const assignable =
          stockLevel !== "OUT" &&
          asset.quantityOnHand > 0 &&
          (asset.status === "AVAILABLE" || asset.status === "ASSIGNED");

        return {
          assignable,
          id: asset.id,
          name: `${asset.sku} — ${asset.name} (${asset.quantityOnHand} en stock, ${getStockLevelLabel(stockLevel)}, ${asset.status})${assignable ? "" : " — non affectable"}`,
          stockLevel,
        };
      }),
      departments,
      users: users.map((user) => ({
        email: user.email,
        id: user.id,
        name: user.name ?? user.email,
      })),
      assignments: assignments.map((assignment) => {
        const returnAlert = getAssignmentReturnAlert(
          assignment.expectedReturnAt,
          assignment.status,
        );

        return {
          agent:
            assignment.assignedTo?.name ??
            assignment.assignedTo?.email ??
            "Non assigne",
          asset: assignment.asset.name,
          assetId: assignment.assetId,
          category: assignment.asset.category.name,
          department: assignment.department?.name ?? "Non renseigne",
          departmentId: assignment.departmentId,
          id: assignment.id,
          location: assignment.asset.location?.name ?? "Non localise",
          notes: assignment.notes ?? "-",
          remiseAtInput: formatDateInput(assignment.assignedAt),
          remiseAt: formatDate(assignment.assignedAt),
          expectedReturnAtInput: formatDateInput(assignment.expectedReturnAt),
          expectedReturnAt: formatDate(assignment.expectedReturnAt),
          returnedAtInput: formatDateInput(assignment.returnedAt),
          returnedAt: formatDate(assignment.returnedAt),
          daysUntilReturn: assignment.expectedReturnAt
            ? getDaysUntilDate(assignment.expectedReturnAt)
            : null,
          returnAlert,
          returnAlertLabel: getAssignmentReturnAlertLabel(returnAlert),
          status: assignmentStatusLabels[assignment.status] ?? assignment.status,
          statusCode: assignment.status,
          userId: assignment.assignedToId,
        };
      }),
    };
  },
  ["assignments-data"],
  {
    revalidate: 60,
    tags: ["assignments", "inventory", "dashboard", "stock"],
  },
);

export async function GET() {
  return NextResponse.json(await getAssignmentsData());
}

function assignmentErrorResponse(error: unknown) {
  if (error instanceof AssignmentError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  console.error("[assignments]", error);
  const message =
    error instanceof Error ? error.message : "Erreur serveur lors de l'affectation";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const status = normalizeAssignmentStatus(body.status);
  const assetId = String(body.assetId);

  const validationError = validateAssignmentPayload(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  if (status === "RETURNED") {
    return NextResponse.json(
      {
        error:
          "Impossible de creer directement une affectation retournee. Allouez d'abord le materiel.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (status === "ACTIVE" || status === "TRANSFERRED") {
        await assertAssetAssignable(tx, assetId);
      }

      const created = await tx.assetAssignment.create({
        data: {
          assetId,
          assignedAt: parseDate(body.assignedAt) ?? new Date(),
          expectedReturnAt: parseDate(body.expectedReturnAt),
          assignedToId: body.assignedToId ? String(body.assignedToId) : null,
          departmentId: body.departmentId ? String(body.departmentId) : null,
          notes: body.notes ? String(body.notes) : null,
          returnedAt: null,
          status,
        },
      });

      await syncAssignmentSideEffects(
        tx,
        assetId,
        null,
        status,
        `Affectation materiel (${status})`,
      );

      await createAssignmentAudit(
        tx,
        "CREATE",
        created.id,
        assetId,
        `Nouvelle affectation ${status}`,
      );

      const asset = await tx.asset.findUnique({
        where: { id: assetId },
        select: { quantityOnHand: true },
      });

      return { assignment: created, quantityOnHand: asset?.quantityOnHand ?? null };
    });

    revalidateAll();

    return NextResponse.json(
      {
        assignment: result.assignment,
        quantityOnHand: result.quantityOnHand,
      },
      { status: 201 },
    );
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

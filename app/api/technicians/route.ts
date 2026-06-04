import { revalidateTag, unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const technicianRoles = ["TECHNICIAN", "IT_MANAGER", "ADMIN"] as const;

function normalizeRole(role: unknown) {
  return technicianRoles.find((value) => value === role) ?? "TECHNICIAN";
}

function firebaseUidFromEmail(email: string) {
  return `tech-${email.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function revalidateTechnicianViews() {
  revalidateTag("technicians", "max");
  revalidateTag("incidents", "max");
  revalidateTag("assignments", "max");
  revalidateTag("dashboard", "max");
}

const getTechniciansData = unstable_cache(
  async () => {
    const [technicians, departments] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: {
            in: [...technicianRoles],
          },
        },
        include: {
          department: true,
          assignedIncidents: true,
          assignments: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.department.findMany({
        orderBy: {
          name: "asc",
        },
      }),
    ]);

    return {
      departments,
      technicians: technicians.map((technician) => ({
        activeAssignments: technician.assignments.filter(
          (assignment) => assignment.status === "ACTIVE",
        ).length,
        activeIncidents: technician.assignedIncidents.filter(
          (incident) => !["RESOLVED", "CLOSED"].includes(incident.status),
        ).length,
        department: technician.department?.name ?? "Non renseigne",
        departmentId: technician.departmentId,
        email: technician.email,
        id: technician.id,
        name: technician.name ?? technician.email,
        photoUrl: technician.photoUrl,
        role: technician.role,
      })),
    };
  },
  ["technicians-data"],
  {
    revalidate: 60,
    tags: ["technicians", "incidents", "assignments"],
  },
);

export async function GET() {
  return NextResponse.json(await getTechniciansData());
}

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email);

  const technician = await prisma.user.create({
    data: {
      departmentId: body.departmentId ? String(body.departmentId) : null,
      email,
      firebaseUid: body.firebaseUid
        ? String(body.firebaseUid)
        : firebaseUidFromEmail(email),
      name: body.name ? String(body.name) : null,
      photoUrl: body.photoUrl ? String(body.photoUrl) : null,
      role: normalizeRole(body.role),
    },
  });

  revalidateTechnicianViews();

  return NextResponse.json({ technician }, { status: 201 });
}

import type { Prisma } from "@/lib/generated/prisma/client";
import type { UserRole } from "@/lib/generated/prisma/enums";

import { UserConflictError, UserNotFoundError, UserRuleError } from "./errors";

type Tx = Prisma.TransactionClient;

export const userRoles = ["ADMIN", "IT_MANAGER", "TECHNICIAN", "AUDITOR", "EMPLOYEE"] as const satisfies readonly UserRole[];

export const userRoleLabels: Record<UserRole, string> = {
  ADMIN: "Admin",
  IT_MANAGER: "Manager IT",
  TECHNICIAN: "Technicien",
  AUDITOR: "Auditeur",
  EMPLOYEE: "Employe",
};

/** Roles qui administrent l'application : il en faut toujours au moins un actif. */
const MANAGER_ROLES: UserRole[] = ["ADMIN", "IT_MANAGER"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type UserInput = {
  email: unknown;
  name?: unknown;
  role?: unknown;
  departmentId?: unknown;
};

type StoredUser = {
  id: string;
  email: string;
  role: UserRole;
  active: boolean;
};

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email)) {
    throw new UserRuleError("Adresse email invalide.");
  }
  return email;
}

function normalizeRole(value: unknown): UserRole {
  if (value === undefined || value === null || value === "") {
    return "TECHNICIAN";
  }
  const role = userRoles.find((candidate) => candidate === value);
  if (!role) {
    throw new UserRuleError("Role inconnu.");
  }
  return role;
}

/** Uid provisoire tant que la personne ne s'est pas connectee : un vrai uid Firebase n'a jamais de « : ». */
export function pendingFirebaseUid(email: string) {
  return `pending:${email}`;
}

async function assertEmailFree(tx: Tx, email: string, excludeId?: string) {
  const taken = await tx.user.findFirst({
    where: { email, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (taken) {
    throw new UserConflictError("Un compte existe deja pour cet email.");
  }
}

async function findUser(tx: Tx, id: string) {
  const user = (await tx.user.findUnique({ where: { id } })) as StoredUser | null;
  if (!user) {
    throw new UserNotFoundError();
  }
  return user;
}

function assertNotSelf(actorId: string, targetId: string, action: string) {
  if (actorId === targetId) {
    throw new UserConflictError(`Vous ne pouvez pas ${action} votre propre compte.`);
  }
}

/** Refuse toute action qui laisserait l'application sans gestionnaire actif. */
async function assertKeepsAManager(tx: Tx, target: StoredUser, next: { role: UserRole; active: boolean } | null) {
  const wasManager = target.active && MANAGER_ROLES.includes(target.role);
  const staysManager = next !== null && next.active && MANAGER_ROLES.includes(next.role);
  if (!wasManager || staysManager) {
    return;
  }

  const otherManagers = await tx.user.count({
    where: { id: { not: target.id }, active: true, role: { in: MANAGER_ROLES } },
  });
  if (otherManagers === 0) {
    throw new UserConflictError("Impossible : c'est le dernier Manager IT ou Admin actif.");
  }
}

async function hasHistory(tx: Tx, userId: string) {
  const counts = await Promise.all([
    tx.asset.count({ where: { createdById: userId } }),
    tx.assetAssignment.count({ where: { issuedById: userId } }),
    tx.assetAssignment.count({ where: { returnedById: userId } }),
    tx.stockMovement.count({ where: { performedById: userId } }),
    tx.incident.count({ where: { reporterId: userId } }),
    tx.incident.count({ where: { assigneeId: userId } }),
    tx.incidentUpdate.count({ where: { authorId: userId } }),
    tx.inventoryCheck.count({ where: { checkedById: userId } }),
    tx.auditLog.count({ where: { actorId: userId } }),
  ]);
  return counts.some((count) => count > 0);
}

export async function createUser(tx: Tx, input: UserInput) {
  const email = normalizeEmail(input.email);
  const role = normalizeRole(input.role);
  await assertEmailFree(tx, email);

  return tx.user.create({
    data: {
      email,
      name: optionalText(input.name),
      role,
      departmentId: optionalText(input.departmentId),
      active: true,
      firebaseUid: pendingFirebaseUid(email),
    },
  });
}

export async function updateUser(tx: Tx, actorId: string, id: string, input: UserInput) {
  const target = await findUser(tx, id);
  const email = normalizeEmail(input.email);
  const role = input.role === undefined ? target.role : normalizeRole(input.role);

  if (role !== target.role) {
    assertNotSelf(actorId, id, "changer le role de");
    await assertKeepsAManager(tx, target, { role, active: target.active });
  }
  await assertEmailFree(tx, email, id);

  return tx.user.update({
    where: { id },
    data: {
      email,
      role,
      ...(input.name !== undefined ? { name: optionalText(input.name) } : {}),
      ...(input.departmentId !== undefined ? { departmentId: optionalText(input.departmentId) } : {}),
    },
  });
}

/** Revoque (ou retablit) l'acces sans toucher a l'historique du compte. */
export async function setUserActive(tx: Tx, actorId: string, id: string, active: boolean) {
  const target = await findUser(tx, id);
  if (!active) {
    assertNotSelf(actorId, id, "desactiver");
    await assertKeepsAManager(tx, target, { role: target.role, active: false });
  }
  return tx.user.update({ where: { id }, data: { active } });
}

export async function deleteUser(tx: Tx, actorId: string, id: string) {
  const target = await findUser(tx, id);
  assertNotSelf(actorId, id, "supprimer");
  await assertKeepsAManager(tx, target, null);

  if (await hasHistory(tx, id)) {
    throw new UserConflictError(
      "Ce compte a un historique (affectations, mouvements, pannes…) : desactivez-le plutot que de le supprimer.",
    );
  }
  await tx.user.delete({ where: { id } });
}

/** Tous les comptes autorises, sans l'uid Firebase, avec leurs charges en cours. */
export async function listUsers(tx: Tx, currentUserId: string) {
  const users = (await tx.user.findMany({ orderBy: { name: "asc" } })) as Array<
    StoredUser & { name: string | null; departmentId: string | null }
  >;
  const ids = users.map((user) => user.id);
  const [assignments, incidents] = await Promise.all([
    tx.assetAssignment.findMany({ where: { status: "ACTIVE", issuedById: { in: ids } }, select: { issuedById: true } }),
    tx.incident.findMany({
      where: { status: { notIn: ["RESOLVED", "CLOSED"] }, assigneeId: { in: ids } },
      select: { assigneeId: true },
    }),
  ]);
  const countBy = (values: Array<string | null>) =>
    values.reduce<Map<string, number>>((map, value) => (value ? map.set(value, (map.get(value) ?? 0) + 1) : map), new Map());
  const assignmentsByUser = countBy(assignments.map((row) => row.issuedById));
  const incidentsByUser = countBy(incidents.map((row) => row.assigneeId));

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name ?? user.email,
    role: user.role,
    active: user.active,
    departmentId: user.departmentId,
    activeAssignments: assignmentsByUser.get(user.id) ?? 0,
    activeIncidents: incidentsByUser.get(user.id) ?? 0,
    isCurrentUser: user.id === currentUserId,
  }));
}

/**
 * Base en memoire au format Prisma (sous-ensemble) pour tester les services du stock
 * sans MySQL. Les conditions `where` sont appliquees au moment de l'ecriture, comme
 * en base : c'est ce qui permet de tester les mises a jour atomiques (concurrence).
 *
 * Surface supportee : findUnique, findFirst, findMany, count, create, update,
 * updateMany, delete. Filtres : egalite, { not }, { in }, { notIn }, { gte }, { lt }.
 * Ecritures : valeur directe, { increment }, { decrement }.
 */
type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

const MODELS = [
  "asset",
  "assetAssignment",
  "holder",
  "stockMovement",
  "auditLog",
  "incident",
  "inventoryCheck",
  "category",
  "assetType",
  "user",
  "incidentUpdate",
] as const;

export type FakeModelName = (typeof MODELS)[number];

function matchesValue(actual: unknown, condition: unknown): boolean {
  if (condition !== null && typeof condition === "object" && !(condition instanceof Date)) {
    const c = condition as Record<string, unknown>;
    if ("not" in c) return actual !== c.not;
    if ("in" in c) return (c.in as unknown[]).includes(actual);
    if ("notIn" in c) return !(c.notIn as unknown[]).includes(actual);
    if ("gte" in c) return (actual as number) >= (c.gte as number);
    if ("lt" in c) return (actual as number | Date) < (c.lt as number | Date);
  }
  return actual === condition;
}

function matches(row: Row, where: Where = {}) {
  return Object.entries(where).every(([key, condition]) => matchesValue(row[key], condition));
}

function applyData(row: Row, data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === "object" && !(value instanceof Date)) {
      const op = value as Record<string, number>;
      if ("increment" in op) {
        row[key] = (row[key] as number) + op.increment;
        continue;
      }
      if ("decrement" in op) {
        row[key] = (row[key] as number) - op.decrement;
        continue;
      }
    }
    row[key] = value;
  }
}

function createModel(name: FakeModelName, tables: Record<string, Row[]>, counter: { n: number }) {
  const rows = () => tables[name];
  return {
    async findUnique({ where }: { where: Where }) {
      const row = rows().find((r) => matches(r, where));
      return row ? { ...row } : null;
    },
    async findFirst({ where }: { where?: Where } = {}) {
      const row = rows().find((r) => matches(r, where));
      return row ? { ...row } : null;
    },
    async findMany({ where }: { where?: Where } = {}) {
      return rows().filter((r) => matches(r, where)).map((r) => ({ ...r }));
    },
    async count({ where }: { where?: Where } = {}) {
      return rows().filter((r) => matches(r, where)).length;
    },
    async create({ data }: { data: Record<string, unknown> }) {
      counter.n += 1;
      const row: Row = { id: `${name}-${counter.n}`, createdAt: new Date(), ...data } as Row;
      rows().push(row);
      return { ...row };
    },
    async update({ where, data }: { where: Where; data: Record<string, unknown> }) {
      const row = rows().find((r) => matches(r, where));
      if (!row) throw new Error(`${name} introuvable (${JSON.stringify(where)})`);
      applyData(row, data);
      return { ...row };
    },
    async updateMany({ where, data }: { where: Where; data: Record<string, unknown> }) {
      const targets = rows().filter((r) => matches(r, where));
      for (const row of targets) applyData(row, data);
      return { count: targets.length };
    },
    async delete({ where }: { where: Where }) {
      const index = rows().findIndex((r) => matches(r, where));
      if (index < 0) throw new Error(`${name} introuvable`);
      const [row] = rows().splice(index, 1);
      return row;
    },
  };
}

export type FakeStockDb = ReturnType<typeof createFakeStockDb>;

export function createFakeStockDb(seed: Partial<Record<FakeModelName, Row[]>> = {}) {
  const tables = Object.fromEntries(
    MODELS.map((model) => [model, (seed[model] ?? []).map((row) => ({ ...row }))]),
  ) as Record<FakeModelName, Row[]>;
  const counter = { n: 0 };
  const models = Object.fromEntries(
    MODELS.map((model) => [model, createModel(model, tables, counter)]),
  ) as { [K in FakeModelName]: ReturnType<typeof createModel> };

  return {
    ...models,
    /** Etat brut, pour les assertions. */
    tables,
    row(model: FakeModelName, id: string) {
      return tables[model].find((r) => r.id === id);
    },
  };
}

// ---- Jeux de donnees reutilisables ----

export const laptop = (overrides: Partial<Row> = {}): Row => ({
  id: "laptop-1",
  sku: "KYC-ITEQUI-0001",
  name: "HP LAPTOP I5",
  trackingMode: "SERIALIZED",
  status: "AVAILABLE",
  condition: "GOOD",
  quantityOnHand: 1,
  minQuantity: 0,
  locationId: "loc-mandala",
  ...overrides,
});

export const mice = (overrides: Partial<Row> = {}): Row => ({
  id: "mice-1",
  sku: "STO-0003",
  name: "Mouse vodacom",
  trackingMode: "BULK",
  status: "AVAILABLE",
  condition: "GOOD",
  quantityOnHand: 129,
  minQuantity: 0,
  locationId: "loc-mandala",
  ...overrides,
});

export const assetType = (overrides: Partial<Row> = {}): Row => ({
  id: "type-lap",
  prefix: "LAP",
  name: "Laptop",
  categoryId: "cat-info",
  defaultTrackingMode: "SERIALIZED",
  nextNumber: 1,
  active: true,
  ...overrides,
});

export const person = (overrides: Partial<Row> = {}): Row => ({
  id: "holder-papy",
  type: "PERSON",
  fullName: "PAPY ADIKAKA",
  matricule: null,
  process: "INBOUND",
  departmentId: null,
  active: true,
  ...overrides,
});

export const appUser = (overrides: Partial<Row> = {}): Row => ({
  id: "user-manager",
  email: "it.manager@procordc.com",
  name: "Manager IT",
  role: "IT_MANAGER",
  active: true,
  firebaseUid: "firebase-uid-manager",
  departmentId: null,
  ...overrides,
});

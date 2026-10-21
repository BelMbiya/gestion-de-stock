import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/lib/generated/prisma/client";
import {
  assertSeedAllowed,
  SeedRefusedError,
  seedKycInventory,
} from "@/lib/import-kyc-inventory";

function fakePrisma(assetCount: number) {
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const model = { deleteMany, createMany: vi.fn(), create: vi.fn(), upsert: vi.fn() };
  const client = new Proxy(
    { asset: { ...model, count: vi.fn().mockResolvedValue(assetCount) } },
    {
      get(target, property) {
        return property in target
          ? target[property as keyof typeof target]
          : model;
      },
    },
  );
  return { client: client as unknown as PrismaClient, deleteMany };
}

describe("assertSeedAllowed", () => {
  it("autorise le seed sur une base vide", async () => {
    const { client } = fakePrisma(0);
    await expect(assertSeedAllowed(client)).resolves.toBeUndefined();
  });

  it("refuse le seed si la base contient deja des actifs", async () => {
    const { client } = fakePrisma(422);
    await expect(assertSeedAllowed(client)).rejects.toBeInstanceOf(SeedRefusedError);
    await expect(assertSeedAllowed(client)).rejects.toThrow(/--reset/);
  });

  it("autorise le reimport explicite avec reset", async () => {
    const { client } = fakePrisma(422);
    await expect(assertSeedAllowed(client, { reset: true })).resolves.toBeUndefined();
  });
});

describe("seedKycInventory", () => {
  it("n'efface aucune donnee quand le seed est refuse", async () => {
    const { client, deleteMany } = fakePrisma(10);

    await expect(seedKycInventory(client, "admin-id")).rejects.toBeInstanceOf(
      SeedRefusedError,
    );
    expect(deleteMany).not.toHaveBeenCalled();
  });
});

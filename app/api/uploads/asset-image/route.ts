import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  getAssetImageExtension,
  isAllowedAssetImageMime,
  validateAssetImageFile,
} from "@/lib/asset-image-upload";

export const dynamic = "force-dynamic";

const uploadDir = path.join(process.cwd(), "public", "uploads", "assets");

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier image requis" }, { status: 400 });
    }

    const validationError = validateAssetImageFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (!isAllowedAssetImageMime(file.type)) {
      return NextResponse.json({ error: "Type de fichier non autorise" }, { status: 400 });
    }

    await mkdir(uploadDir, { recursive: true });

    const extension = getAssetImageExtension(file.type);
    const filename = `${randomUUID()}.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    await writeFile(path.join(uploadDir, filename), bytes);

    return NextResponse.json({
      url: `/uploads/assets/${filename}`,
    });
  } catch (error) {
    console.error("[POST /api/uploads/asset-image]", error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer l'image" },
      { status: 500 },
    );
  }
}

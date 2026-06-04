import { describe, expect, it } from "vitest";

import { normalizeImageUrl } from "@/lib/asset-image";
import { validateAssetImageFile } from "@/lib/asset-image-upload";

describe("asset-image", () => {
  it("normalise une URL image ou renvoie null", () => {
    expect(normalizeImageUrl("  https://cdn.example.com/pc.jpg  ")).toBe(
      "https://cdn.example.com/pc.jpg",
    );
    expect(normalizeImageUrl("")).toBeNull();
    expect(normalizeImageUrl("   ")).toBeNull();
    expect(normalizeImageUrl("/uploads/assets/abc.jpg")).toBe(
      "/uploads/assets/abc.jpg",
    );
  });

  it("valide taille et format des fichiers image", () => {
    const valid = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(valid, "size", { value: 1024 });

    expect(validateAssetImageFile(valid)).toBeNull();
    expect(
      validateAssetImageFile(new File(["x"], "doc.pdf", { type: "application/pdf" })),
    ).toMatch(/format/i);
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetImageUpload } from "@/components/asset-image-upload";

describe("AssetImageUpload", () => {
  const fetchMock = vi.fn();
  const onImageUrlChange = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "/uploads/assets/test.jpg" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("televerse une image selectionnee et met a jour l'URL", async () => {
    render(
      <AssetImageUpload
        alt="Laptop"
        imageUrl={null}
        onImageUrlChange={onImageUrlChange}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["img"], "laptop.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 500 });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/uploads/asset-image",
        expect.objectContaining({ method: "POST" }),
      );
      expect(onImageUrlChange).toHaveBeenCalledWith("/uploads/assets/test.jpg");
    });
  });

  it("affiche une erreur pour un format refuse", async () => {
    render(
      <AssetImageUpload
        alt="Doc"
        imageUrl={null}
        onImageUrlChange={onImageUrlChange}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["x"], "file.pdf", { type: "application/pdf" })],
      },
    });

    expect(
      await screen.findByText(/Format accepte/i),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

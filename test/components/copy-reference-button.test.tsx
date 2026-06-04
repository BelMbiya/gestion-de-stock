import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CopyReferenceButton } from "@/components/copy-reference-button";

describe("CopyReferenceButton", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText },
    });
    writeText.mockResolvedValue(undefined);
  });

  afterEach(() => {
    writeText.mockReset();
  });

  it("copie la reference panne dans le presse-papiers", async () => {
    render(<CopyReferenceButton value="INC-2406-018" />);

    fireEvent.click(screen.getByRole("button", { name: "Copier la reference" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("INC-2406-018");
    });
  });
});

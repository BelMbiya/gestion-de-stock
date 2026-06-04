import { render, screen, waitFor } from "@testing-library/react";
import { onAuthStateChanged } from "firebase/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGuard } from "@/components/auth-guard";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
  }),
}));

vi.mock("@/firebase", () => ({
  auth: {},
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
}));

describe("AuthGuard", () => {
  beforeEach(() => {
    replace.mockClear();
    vi.mocked(onAuthStateChanged).mockReset();
  });

  it("redirige vers sign-in sans session", async () => {
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
      (callback as (user: null) => void)(null);
      return vi.fn();
    });

    render(
      <AuthGuard>
        <p>Dashboard protege</p>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/sign-in");
    });
  });

  it("affiche le contenu avec une session active", async () => {
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
      (callback as (user: { uid: string }) => void)({ uid: "user-1" });
      return vi.fn();
    });

    render(
      <AuthGuard>
        <p>Dashboard protege</p>
      </AuthGuard>,
    );

    expect(await screen.findByText("Dashboard protege")).toBeInTheDocument();
  });
});

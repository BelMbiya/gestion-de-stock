import { readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignInPage from "@/app/sign-in/page";

const replace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/firebase", () => ({
  auth: {},
  googleProvider: {},
}));

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
}));

function withoutSession() {
  vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
    (callback as (user: null) => void)(null);
    return vi.fn();
  });
}

describe("Page de connexion — inscription libre supprimee", () => {
  beforeEach(() => {
    replace.mockClear();
    searchParams = new URLSearchParams();
    vi.mocked(signInWithEmailAndPassword).mockReset();
    withoutSession();
  });

  it("n'affiche plus de lien de creation de compte", async () => {
    render(<SignInPage />);

    expect(await screen.findByRole("button", { name: /se connecter/i })).toBeInTheDocument();
    expect(screen.queryByText(/creer un (nouveau )?compte/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/j'ai deja un compte/i)).not.toBeInTheDocument();
  });

  it("le formulaire ne fait que se connecter", async () => {
    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({} as never);
    render(<SignInPage />);

    fireEvent.change(await screen.findByPlaceholderText("it@procordc.com"), {
      target: { value: "tech@procordc.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/minimum 6 caracteres/i), {
      target: { value: "secret-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    await waitFor(() => {
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        {},
        "tech@procordc.com",
        "secret-123",
      );
    });
  });

  it("n'embarque plus l'API de creation de compte Firebase", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../../app/sign-in/page.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/createUserWithEmailAndPassword/);
  });

  it("garde la connexion Google", async () => {
    render(<SignInPage />);

    expect(
      await screen.findByRole("button", { name: /continuer avec google/i }),
    ).toBeInTheDocument();
  });
});

describe("Page de connexion — compte non autorise", () => {
  beforeEach(() => {
    withoutSession();
  });

  it("explique le refus quand l'API a repondu 403", async () => {
    searchParams = new URLSearchParams("reason=forbidden");

    render(<SignInPage />);

    expect(await screen.findByText(/compte non autorise/i)).toBeInTheDocument();
  });

  it("n'affiche pas ce message par defaut", async () => {
    searchParams = new URLSearchParams();

    render(<SignInPage />);

    await screen.findByRole("button", { name: /se connecter/i });
    expect(screen.queryByText(/compte non autorise/i)).not.toBeInTheDocument();
  });
});

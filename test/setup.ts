import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Les tests de composants simulent `fetch` : apiFetch y delegue directement.
// Le transport du token (en-tete, 401/403) est teste dans test/lib/api-client.test.ts.
vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiFetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
  };
});

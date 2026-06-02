import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("renvoie un element React", () => {
    const element = Home();

    expect(element).toBeDefined();
    expect(element.type).toBe("main");
  });
});

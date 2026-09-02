import { describe, expect, it } from "vitest";
import { formatLigne, parseLigne } from "../src/ligne.js";

describe("parseLigne (nature LIGNE)", () => {
  it("parses Access example 36 / 9351.3", () => {
    expect(parseLigne("36 / 9351.3")).toEqual({ groupeLigne: 36, indiceLigne: "9351.3" });
  });

  it("parses compact slash", () => {
    expect(parseLigne("36/9351.3")).toEqual({ groupeLigne: 36, indiceLigne: "9351.3" });
  });

  it("parses comma separator used in bilan NumLivrable", () => {
    expect(parseLigne("36,476")).toEqual({ groupeLigne: 36, indiceLigne: "476" });
    expect(parseLigne("36,7506")).toEqual({ groupeLigne: 36, indiceLigne: "7506" });
  });

  it("parses dotted groupe.indice (36.9351.3)", () => {
    expect(parseLigne("36.9351.3")).toEqual({ groupeLigne: 36, indiceLigne: "9351.3" });
  });

  it("parses integer-only ligne", () => {
    expect(parseLigne("36")).toEqual({ groupeLigne: 36, indiceLigne: "" });
    expect(parseLigne(36)).toEqual({ groupeLigne: 36, indiceLigne: "" });
  });

  it("returns null for empty", () => {
    expect(parseLigne("")).toBeNull();
    expect(parseLigne(null)).toBeNull();
  });

  it("round-trips formatLigne", () => {
    expect(formatLigne(36, "9351.3")).toBe("36 / 9351.3");
    expect(formatLigne(36, "")).toBe("36");
  });
});

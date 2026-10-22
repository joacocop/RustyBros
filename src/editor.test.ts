import { describe, expect, it } from "vitest";
import { clampTrim, timecode } from "./editor";

describe("selección de recorte", () => {
  it("no permite cruzar los extremos ni salir del video", () => {
    expect(clampTrim({ start: 2, end: 8 }, 10, "start", 9).start).toBe(7.9);
    expect(clampTrim({ start: 2, end: 8 }, 10, "end", 0).end).toBe(2.1);
    expect(clampTrim({ start: 2, end: 8 }, 10, "end", 99).end).toBe(10);
    expect(clampTrim({ start: 2, end: 8 }, 10, "start", -5).start).toBe(0);
  });
  it("permite clips menores que el intervalo mínimo habitual", () => {
    expect(clampTrim({ start: 0, end: 0.05 }, 0.05, "start", 1)).toEqual({
      start: 0,
      end: 0.05,
    });
  });
});

it("muestra centésimas sin desbordes al redondear", () => {
  expect(timecode(59.999)).toBe("01:00.00");
  expect(timecode(3661.23)).toBe("01:01:01.23");
});

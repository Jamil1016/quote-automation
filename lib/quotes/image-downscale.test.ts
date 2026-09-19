import { test, expect } from "@playwright/test";
import { fitDimensions } from "./image-downscale";

test("scales the longest edge down to max, keeps aspect", () => {
  expect(fitDimensions(2400, 1200, 1200)).toEqual({ width: 1200, height: 600 });
  expect(fitDimensions(1200, 2400, 1200)).toEqual({ width: 600, height: 1200 });
});

test("never upscales", () => {
  expect(fitDimensions(800, 600, 1200)).toEqual({ width: 800, height: 600 });
});

test("square clamps to max", () => {
  expect(fitDimensions(3000, 3000, 1200)).toEqual({ width: 1200, height: 1200 });
});

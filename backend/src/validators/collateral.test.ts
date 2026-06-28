import {
  createCollateralSchema,
  updateCollateralSchema,
  toValidationMessagesByField,
} from "./collateral";

describe("collateral validators", () => {
  describe("createCollateralSchema", () => {
    it("accepts valid payload", () => {
      const parsed = createCollateralSchema.parse({
        animal_type: "cattle",
        count: 4,
        appraised_value: 150000,
      });

      expect(parsed).toEqual({
        animal_type: "cattle",
        count: 4,
        appraised_value: 150000,
      });
    });

    it("rejects invalid payload and exposes field dictionary", () => {
      const result = createCollateralSchema.safeParse({
        animal_type: "",
        count: 0,
        appraised_value: -10,
      });

      expect(result.success).toBe(false);
      if (result.success) return;

      const details = toValidationMessagesByField(result.error.issues);
      expect(details).toHaveProperty("animal_type");
      expect(details).toHaveProperty("count");
      expect(details).toHaveProperty("appraised_value");
    });
  });

  describe("updateCollateralSchema", () => {
    it("accepts partial updates for allowed fields", () => {
      const parsed = updateCollateralSchema.parse({ appraised_value: 99.5 });
      expect(parsed).toEqual({ appraised_value: 99.5 });
    });

    it("rejects empty payload", () => {
      const result = updateCollateralSchema.safeParse({});
      expect(result.success).toBe(false);
      if (result.success) return;
      const details = toValidationMessagesByField(result.error.issues);
      expect(details).toHaveProperty("_root");
    });

    it("rejects unknown fields", () => {
      const result = updateCollateralSchema.safeParse({ unsupported: true });
      expect(result.success).toBe(false);
    });
  });
});

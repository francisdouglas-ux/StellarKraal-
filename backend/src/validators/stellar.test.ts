import { stellarPublicKeySchema, validateStellarPublicKey } from "./stellar";

describe("Stellar Public Key Validator", () => {
  describe("Valid keys", () => {
    const validKeys = [
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
      "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    ];

    validKeys.forEach((key) => {
      it(`should accept valid key: ${key.substring(0, 10)}...`, () => {
        const result = stellarPublicKeySchema.safeParse(key);
        expect(result.success).toBe(true);
      });

      it(`should validate using helper function: ${key.substring(0, 10)}...`, () => {
        const result = validateStellarPublicKey(key);
        expect(result.success).toBe(true);
        expect(result.data).toBe(key);
        expect(result.error).toBeUndefined();
      });
    });
  });

  describe("Invalid keys", () => {
    const invalidCases = [
      {
        key: "SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
        reason: "starts with S (secret key)",
      },
      {
        key: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCC",
        reason: "too short (52 chars)",
      },
      {
        key: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNEXTRA",
        reason: "too long (61 chars)",
      },
      {
        key: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCW0",
        reason: "invalid base32 (contains 0)",
      },
      {
        key: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWX",
        reason: "invalid checksum",
      },
      {
        key: "",
        reason: "empty string",
      },
      {
        key: "not-a-stellar-key",
        reason: "random string",
      },
      {
        key: "MAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
        reason: "starts with M (muxed account)",
      },
    ];

    invalidCases.forEach(({ key, reason }) => {
      it(`should reject key: ${reason}`, () => {
        const result = stellarPublicKeySchema.safeParse(key);
        expect(result.success).toBe(false);
      });

      it(`should return error using helper function: ${reason}`, () => {
        const result = validateStellarPublicKey(key);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.data).toBeUndefined();
      });
    });
  });

  describe("Edge cases", () => {
    it("should reject null", () => {
      const result = stellarPublicKeySchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it("should reject undefined", () => {
      const result = stellarPublicKeySchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });

    it("should reject number", () => {
      const result = stellarPublicKeySchema.safeParse(12345);
      expect(result.success).toBe(false);
    });

    it("should reject object", () => {
      const result = stellarPublicKeySchema.safeParse({ key: "GABC..." });
      expect(result.success).toBe(false);
    });

    it("should reject array", () => {
      const result = stellarPublicKeySchema.safeParse(["GABC..."]);
      expect(result.success).toBe(false);
    });

    it("should handle whitespace", () => {
      const keyWithSpaces = " GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN ";
      const result = stellarPublicKeySchema.safeParse(keyWithSpaces);
      expect(result.success).toBe(false); // Should not auto-trim
    });
  });
});
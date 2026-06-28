import { z } from "zod";

/**
 * Shared collateral field schemas used across create/update endpoints.
 */
const animalTypeSchema = z.string().trim().min(1, "animal_type is required");
const countSchema = z.number().int("count must be an integer").gt(0, "count must be greater than 0");
const appraisedValueSchema = z
  .number()
  .gt(0, "appraised_value must be greater than 0");

/**
 * POST /api/v1/collateral request schema.
 */
export const createCollateralSchema = z
  .object({
    animal_type: animalTypeSchema,
    count: countSchema,
    appraised_value: appraisedValueSchema,
  })
  .strict();

/**
 * PATCH /api/v1/collateral/:id request schema.
 * Validates the same fields as create, but all are optional.
 */
export const updateCollateralSchema = z
  .object({
    animal_type: animalTypeSchema.optional(),
    count: countSchema.optional(),
    appraised_value: appraisedValueSchema.optional(),
  })
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one updatable field must be provided",
    path: ["_root"],
  });

/**
 * Converts Zod issues into a dictionary keyed by field.
 * Values are arrays to support multiple messages per field.
 * @param issues - Zod validation issues.
 * @returns Dictionary mapping field names to validation messages.
 */
export function toValidationMessagesByField(issues: z.ZodIssue[]): Record<string, string[]> {
  return issues.reduce<Record<string, string[]>>((acc, issue) => {
    const field = issue.path.length > 0 ? issue.path.join(".") : "_root";
    if (!acc[field]) acc[field] = [];
    acc[field].push(issue.message);
    return acc;
  }, {});
}

export type CreateCollateralInput = z.infer<typeof createCollateralSchema>;
export type UpdateCollateralInput = z.infer<typeof updateCollateralSchema>;

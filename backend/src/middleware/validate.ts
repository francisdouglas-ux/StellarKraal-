import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Returns an Express middleware that validates req.body against the given Zod schema.
 * Unknown fields are stripped (uses schema.strip() behaviour via safeParse).
 * On failure, responds 400 with { errors: [{ field, message }] }.
 *
 * @example
 * router.post("/loan/request", validate(loanRequestSchema), handler);
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

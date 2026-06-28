import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

type ValidationErrorShape = 'list' | 'dictionary';

interface ValidateOptions {
  statusCode?: number;
  errorShape?: ValidationErrorShape;
}

/**
 * Returns an Express middleware that validates req.body against the given Zod schema.
 * Unknown fields are stripped (uses schema.strip() behaviour via safeParse).
 * On failure, responds with a configurable status code and error envelope.
 *
 * @param schema - The Zod schema to validate against.
 * @param options - Validation response options.
 * @returns Express middleware function that validates and parses the request body.
 * @example
 * router.post("/loan/request", validate(loanRequestSchema, { statusCode: 422 }), handler);
 */
export function validate(schema: ZodSchema, options: ValidateOptions = {}) {
  const statusCode = options.statusCode ?? 400;
  const errorShape = options.errorShape ?? 'list';

  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      if (errorShape === 'dictionary') {
        const details = result.error.issues.reduce<Record<string, string[]>>((acc, issue) => {
          const field = issue.path.length > 0 ? issue.path.join('.') : '_root';
          if (!acc[field]) acc[field] = [];
          acc[field].push(issue.message);
          return acc;
        }, {});

        res.status(statusCode).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details,
        });
        return;
      }

      res.status(statusCode).json({
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

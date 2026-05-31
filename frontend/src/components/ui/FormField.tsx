"use client";
import { forwardRef, useId } from "react";

// Shared base classes for all input-like elements
export const inputBase =
  "w-full rounded-xl border px-4 py-3 text-brown-700 placeholder-brown-500 bg-white " +
  "transition focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold " +
  "disabled:bg-brown-50 disabled:text-brown-400 disabled:cursor-not-allowed";

export const inputIdle = "border-brown-300";
export const inputError = "border-error focus:ring-error/30 focus:border-error";

// ── Label ────────────────────────────────────────────────────────────────────

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ children, required, className = "", ...props }: LabelProps) {
  return (
    <label className={`block text-sm font-medium text-brown-700 mb-1 ${className}`} {...props}>
      {children}
      {required && (
        <span className="text-error ml-0.5" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

// ── FieldError ───────────────────────────────────────────────────────────────

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-error-dark">
      {message}
    </p>
  );
}

// ── Input ────────────────────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id: idProp, className = "", required, ...props },
  ref
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const errorId = `${id}-error`;

  return (
    <div>
      {label && (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      )}
      <input
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        required={required}
        className={`${inputBase} ${error ? inputError : inputIdle} ${className}`}
        {...props}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
});

// ── Textarea ─────────────────────────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, id: idProp, className = "", required, ...props },
  ref
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const errorId = `${id}-error`;

  return (
    <div>
      {label && (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      )}
      <textarea
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        required={required}
        className={`${inputBase} ${error ? inputError : inputIdle} resize-y min-h-[6rem] ${className}`}
        {...props}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
});

// ── Select ───────────────────────────────────────────────────────────────────

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, id: idProp, className = "", required, children, ...props },
  ref
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const errorId = `${id}-error`;

  return (
    <div>
      {label && (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      )}
      <select
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        required={required}
        className={`${inputBase} ${error ? inputError : inputIdle} appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235D3C15' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_1rem_center] pr-10 ${className}`}
        {...props}
      >
        {children}
      </select>
      <FieldError id={errorId} message={error} />
    </div>
  );
});

// ── Checkbox ─────────────────────────────────────────────────────────────────

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, id: idProp, className = "", ...props },
  ref
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const errorId = `${id}-error`;

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="checkbox"
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`h-4 w-4 rounded border-brown-300 text-gold-600 accent-gold-600 focus:ring-2 focus:ring-gold/40 disabled:cursor-not-allowed ${error ? "border-error" : ""} ${className}`}
          {...props}
        />
        <label htmlFor={id} className="text-sm text-brown-700 select-none">
          {label}
        </label>
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  );
});

// ── Radio ────────────────────────────────────────────────────────────────────

export interface RadioOption {
  value: string;
  label: string;
}

export interface RadioGroupProps {
  name: string;
  label?: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function RadioGroup({ name, label, options, value, onChange, error, disabled }: RadioGroupProps) {
  const groupId = useId();
  const errorId = `${groupId}-error`;

  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      {label && <legend className="text-sm font-medium text-brown-700 mb-2">{label}</legend>}
      <div className="space-y-2">
        {options.map((opt) => {
          const id = `${groupId}-${opt.value}`;
          return (
            <div key={opt.value} className="flex items-center gap-2">
              <input
                type="radio"
                id={id}
                name={name}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange?.(opt.value)}
                disabled={disabled}
                className={`h-4 w-4 border-brown-300 text-gold-600 accent-gold-600 focus:ring-2 focus:ring-gold/40 disabled:cursor-not-allowed ${error ? "border-error" : ""}`}
              />
              <label htmlFor={id} className="text-sm text-brown-700 select-none">
                {opt.label}
              </label>
            </div>
          );
        })}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

import React from "react";

interface HeadingProps {
  children: React.ReactNode;
  className?: string;
}

export function H1({ children, className = "" }: HeadingProps) {
  return <h1 className={`text-h1 ${className}`}>{children}</h1>;
}

export function H2({ children, className = "" }: HeadingProps) {
  return <h2 className={`text-h2 ${className}`}>{children}</h2>;
}

export function H3({ children, className = "" }: HeadingProps) {
  return <h3 className={`text-h3 ${className}`}>{children}</h3>;
}

export function H4({ children, className = "" }: HeadingProps) {
  return <h4 className={`text-h4 ${className}`}>{children}</h4>;
}

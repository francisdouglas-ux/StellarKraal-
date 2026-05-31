import React from 'react';

interface EmptyStateProps {
  illustration?: React.ReactNode;
  heading: string;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
  icon?: string;
}

export default function EmptyState({
  illustration,
  heading,
  message,
  ctaLabel,
  onCta,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Icon or illustration */}
      <div
        aria-hidden="true"
        className="mb-6 text-6xl text-brown/30 flex items-center justify-center"
      >
        {illustration || <span className="text-5xl">{icon || '📭'}</span>}
      </div>

      {/* Heading */}
      <h3 className="text-xl font-semibold text-brown mb-2">{heading}</h3>

      {/* Message */}
      <p role="status" className="text-brown/70 mb-6 text-sm max-w-sm">
        {message}
      </p>

      {/* CTA Button */}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="bg-gold text-brown px-6 py-2.5 rounded-xl font-semibold hover:bg-gold/80 transition focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

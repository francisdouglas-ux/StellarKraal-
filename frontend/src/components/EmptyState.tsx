interface Props {
  illustration: React.ReactNode;
  heading: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ illustration, heading, message, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-brown/30">{illustration}</div>
      <h3 className="text-lg font-semibold text-brown mb-1">{heading}</h3>
      <p className="text-sm text-brown/60 max-w-xs mb-4">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="bg-brown text-cream px-5 py-2 rounded-xl font-semibold hover:bg-brown/80 transition text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

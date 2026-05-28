"use client";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface Props {
  healthFactor: number; // bps, e.g. 10_000 = 1.0x
  onRepay: () => void;
  onDismiss: () => void;
}

export default function LiquidationWarningModal({ healthFactor, onRepay, onDismiss }: Props) {
  const ratio = (healthFactor / 10_000).toFixed(2);

  return (
    <Modal
      open
      onClose={onDismiss}
      title="⚠️ Liquidation Warning"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
          <Button variant="secondary" onClick={onRepay}>
            Repay Now
          </Button>
        </>
      }
    >
      <p className="text-sm text-brown-600 mb-4">
        Your health factor is{" "}
        <strong className="text-error-dark">{ratio}x</strong>, which is critically low. If it
        falls below <strong>1.0x</strong>, your collateral may be liquidated.
      </p>
      <ul className="text-sm text-brown-600 space-y-1 list-disc list-inside">
        <li>Repay part of your loan to restore your health factor.</li>
        <li>Add more collateral to increase your buffer.</li>
        <li>Act quickly — liquidation can happen at any time.</li>
      </ul>
    </Modal>
  );
}

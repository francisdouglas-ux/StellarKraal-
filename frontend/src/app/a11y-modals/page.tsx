"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import LiquidationWarningModal from "@/components/LiquidationWarningModal";
import ShortcutsHelpModal from "@/components/ShortcutsHelpModal";
import OnboardingModal from "@/components/OnboardingModal";
import Modal from "@/components/ui/Modal";

export default function A11yModalsTest() {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  return (
    <div className="p-8">
      <h1>A11y Modals Test</h1>
      <button onClick={() => setActiveModal("basic")} data-testid="open-basic">
        Open Basic Modal
      </button>
      <button onClick={() => setActiveModal("confirm")} data-testid="open-confirm">
        Open Confirm
      </button>
      <button onClick={() => setActiveModal("liquidation")} data-testid="open-liquidation">
        Open Liquidation
      </button>
      <button onClick={() => setActiveModal("shortcuts")} data-testid="open-shortcuts">
        Open Shortcuts
      </button>
      <button onClick={() => setActiveModal("onboarding")} data-testid="open-onboarding">
        Open Onboarding
      </button>

      <Modal open={activeModal === "basic"} onClose={() => setActiveModal(null)} title="Basic Modal">
        <p>Basic Modal Content</p>
      </Modal>

      <ConfirmDialog
        open={activeModal === "confirm"}
        onCancel={() => setActiveModal(null)}
        onConfirm={() => setActiveModal(null)}
        title="Confirm Dialog"
        message="Are you sure?"
      />

      {activeModal === "liquidation" && (
        <LiquidationWarningModal
          healthFactor={9000}
          onDismiss={() => setActiveModal(null)}
          onRepay={() => setActiveModal(null)}
        />
      )}

      {activeModal === "shortcuts" && (
        <ShortcutsHelpModal
          shortcuts={[{ key: "c", label: "Create", hint: "c", action: () => {} }]}
          onClose={() => setActiveModal(null)}
        />
      )}

      <OnboardingModal isOpen={activeModal === "onboarding"} onClose={() => setActiveModal(null)} />
    </div>
  );
}

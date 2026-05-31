'use client';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type AnimalType = 'cattle' | 'goat' | 'sheep';

export interface WizardState {
  // Step 1 – Collateral
  animalType: AnimalType;
  count: string;
  appraisedValue: string;
  collateralId: string; // returned after register

  // Step 2 – Amount
  loanAmount: string;
  loanTermDays: string;

  // Meta
  step: number;
  loading: boolean;
  error: string | null;
}

interface WizardCtx extends WizardState {
  setField: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
  canProceed: () => boolean;
}

const defaults: WizardState = {
  animalType: 'cattle',
  count: '',
  appraisedValue: '',
  collateralId: '',
  loanAmount: '',
  loanTermDays: '30',
  step: 1,
  loading: false,
  error: null,
};

const STORAGE_KEY = 'loan_wizard_state';

const LoanWizardContext = createContext<WizardCtx | null>(null);

export function LoanWizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WizardState>(defaults);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch {
        // Ignore parse errors
      }
    }
    setMounted(true);
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, mounted]);

  function setField<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function canProceed(): boolean {
    if (state.step === 1) {
      return (
        !!state.count &&
        !!state.appraisedValue &&
        parseInt(state.count) > 0 &&
        parseInt(state.appraisedValue) > 0
      );
    }
    if (state.step === 2) {
      return !!state.loanAmount && parseInt(state.loanAmount) > 0;
    }
    return true;
  }

  function nextStep() {
    if (canProceed()) {
      setState((s) => ({ ...s, step: Math.min(s.step + 1, 4), error: null }));
    }
  }

  function prevStep() {
    setState((s) => ({ ...s, step: Math.max(s.step - 1, 1), error: null }));
  }

  function reset() {
    setState(defaults);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <LoanWizardContext.Provider
      value={{ ...state, setField, nextStep, prevStep, reset, canProceed }}
    >
      {children}
    </LoanWizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(LoanWizardContext);
  if (!ctx) throw new Error('useWizard must be used inside LoanWizardProvider');
  return ctx;
}

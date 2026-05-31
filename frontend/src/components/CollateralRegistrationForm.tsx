'use client';
import { useState, useEffect, useCallback } from 'react';
import { signTransaction } from '@/lib/freighterClient';
import { submitSignedXdr } from '@/lib/stellarUtils';
import ConfirmDialog from '@/components/ConfirmDialog';
import Spinner from '@/components/Spinner';
import { Input, Select, Button } from '@/components/ui';
"use client";
import { useState, useEffect, useCallback } from "react";
import { signTransaction } from "@/lib/freighterClient";
import { submitSignedXdr } from "@/lib/stellarUtils";
import ConfirmDialog from "@/components/ConfirmDialog";
import Spinner from "@/components/Spinner";
import { motion, useReducedMotion } from "framer-motion";
import { submitVariants } from "@/lib/animations";
import { Input, Select, Button } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Props {
  walletAddress: string;
  onSuccess?: (collateralId: string) => void;
}

interface FormData {
  animalType: string;
  quantity: string;
  weight: string;
  healthStatus: string;
  location: string;
  appraisedValue: string;
  breed: string;
  age: string;
  image: File | null;
}

interface FormErrors {
  animalType?: string;
  quantity?: string;
  weight?: string;
  healthStatus?: string;
  location?: string;
  appraisedValue?: string;
  breed?: string;
  age?: string;
  image?: string;
}

const ANIMAL_TYPES = ['cattle', 'goat', 'sheep'];
const HEALTH_STATUSES = ['excellent', 'good', 'fair', 'poor'];
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const AUTO_SAVE_INTERVAL = 5000;
const STORAGE_KEY = 'stellarkraal_collateral_form';

export default function CollateralRegistrationForm({ walletAddress, onSuccess }: Props) {
  const reduced = useReducedMotion();
  const toast = useToast();
  const [formData, setFormData] = useState<FormData>({
    animalType: 'cattle',
    quantity: '',
    weight: '',
    healthStatus: 'good',
    location: '',
    appraisedValue: '',
    breed: '',
    age: '',
    image: null,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.walletAddress === walletAddress && parsed.data) {
          setShowRestorePrompt(true);
        }
      } catch {
        // ignore
      }
    }
  }, [walletAddress]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (formData.quantity || formData.weight || formData.location || formData.appraisedValue) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ walletAddress, data: formData, timestamp: new Date().toISOString() })
        );
        setLastSaved(new Date());
      }
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [formData, walletAddress]);

  const restoreSavedData = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.data) {
          setFormData(parsed.data);
          setShowRestorePrompt(false);
        }
      } catch {
        /* ignore */
      }
    }
  };

  const dismissRestore = () => {
    setShowRestorePrompt(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const validateField = useCallback(
    (name: keyof FormData, value: string | File | null): string | undefined => {
      switch (name) {
        case 'breed':
          if (!value || (typeof value === 'string' && value.trim().length === 0))
            return 'Breed is required';
          if (typeof value === 'string' && value.trim().length < 2)
            return 'Breed must be at least 2 characters';
          break;
        case 'age': {
          if (!value || (typeof value === 'string' && value.trim().length === 0))
            return 'Age is required';
          const ageNum = parseInt(value as string);
          if (isNaN(ageNum) || ageNum < 0) return 'Age must be a valid number';
          break;
        }
        case 'image': {
          if (!value) return 'Image is required';
          if (value instanceof File) {
            const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (!validTypes.includes(value.type))
              return 'Only image files are allowed (JPEG, PNG, WebP, GIF)';
            if (value.size > 5 * 1024 * 1024) return 'Image must be smaller than 5MB';
          }
          break;
        }
        case 'quantity': {
          if (!value) return 'Quantity is required';
          const qty = parseInt(value as string);
          if (isNaN(qty) || qty <= 0) return 'Quantity must be a positive number';
          break;
        }
        case 'weight': {
          if (!value) return 'Estimated weight is required';
          const wt = parseFloat(value as string);
          if (isNaN(wt) || wt <= 0) return 'Weight must be a positive number';
          break;
        }
        case 'location':
          if (!value || (typeof value === 'string' && value.trim().length === 0))
            return 'Location is required';
          if (typeof value === 'string' && value.trim().length < 3)
            return 'Location must be at least 3 characters';
          break;
        case 'appraisedValue': {
          if (!value) return 'Appraised value is required';
          const val = parseInt(value as string);
          if (isNaN(val) || val <= 0) return 'Appraised value must be a positive number';
          break;
        }
      }
      return undefined;
    },
    []
  );

  const handleChange = (name: keyof FormData, value: string | File | null) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleChange('image', file);

    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    (Object.keys(formData) as Array<keyof FormData>).forEach((key) => {
      const error = validateField(key, formData[key]);
      if (error) newErrors[key] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setShowConfirm(true);
  };

  const registerCollateral = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/collateral/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: walletAddress,
          animal_type: formData.animalType,
          count: parseInt(formData.quantity),
          appraised_value: parseInt(formData.appraisedValue),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Registration failed');
      }
      const { xdr } = await res.json();
      const { signedTxXdr } = await signTransaction(xdr, {
        network: process.env.NEXT_PUBLIC_NETWORK || 'TESTNET',
      });
      const result = await submitSignedXdr(signedTxXdr);
      toast.success(`Collateral registered successfully! ID: ${result}`);
      localStorage.removeItem(STORAGE_KEY);
      setLastSaved(null);
      setFormData({
        animalType: 'cattle',
        quantity: '',
        weight: '',
        healthStatus: 'good',
        location: '',
        appraisedValue: '',
        breed: '',
        age: '',
        image: null,
      });
      setImagePreview(null);
      setErrors({});
      onSuccess?.(result);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      setStatus(`error:${error}`);
    } catch (e: any) {
      toast.error(e.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const isError = status?.startsWith('error:');

  return (
    <div className="bg-white rounded-2xl p-6 shadow space-y-4">
      {showRestorePrompt && (
        <div className="bg-gold-100 border border-gold-300 rounded-xl p-4">
          <p className="text-sm text-brown-700 mb-2">
            You have unsaved progress. Would you like to restore it?
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={restoreSavedData}>
              Restore
            </Button>
            <Button size="sm" variant="ghost" onClick={dismissRestore}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <h2 className="text-xl font-semibold text-brown-700">Register Livestock Collateral</h2>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Select
          label="Animal Type"
          required
          value={formData.animalType}
          onChange={(e) => handleChange('animalType', e.target.value)}
          disabled={loading}
        >
          {ANIMAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </Select>

        <Input
          label="Quantity"
          required
          type="number"
          placeholder="Number of animals"
          value={formData.quantity}
          onChange={(e) => handleChange('quantity', e.target.value)}
          error={errors.quantity}
          disabled={loading}
        />

        <Input
          label="Estimated Weight (kg)"
          required
          type="number"
          step="0.1"
          placeholder="Average weight per animal"
          value={formData.weight}
          onChange={(e) => handleChange('weight', e.target.value)}
          error={errors.weight}
          disabled={loading}
        />

        <Select
          label="Health Status"
          required
          value={formData.healthStatus}
          onChange={(e) => handleChange('healthStatus', e.target.value)}
          disabled={loading}
        >
          {HEALTH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Select>

        <Input
          label="Location"
          required
          type="text"
          placeholder="Farm or region name"
          value={formData.location}
          onChange={(e) => handleChange('location', e.target.value)}
          error={errors.location}
          disabled={loading}
        />

        <Input
          label="Appraised Value (stroops)"
          required
          type="number"
          placeholder="Total value in stroops"
          value={formData.appraisedValue}
          onChange={(e) => handleChange('appraisedValue', e.target.value)}
          error={errors.appraisedValue}
          disabled={loading}
        />

        <Input
          label="Breed"
          required
          type="text"
          placeholder="e.g., Holstein, Boer, Merino"
          value={formData.breed}
          onChange={(e) => handleChange('breed', e.target.value)}
          error={errors.breed}
          disabled={loading}
        />

        <Input
          label="Age (years)"
          required
          type="number"
          placeholder="Age of the animal"
          value={formData.age}
          onChange={(e) => handleChange('age', e.target.value)}
          error={errors.age}
          disabled={loading}
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-brown-700">
            Animal Photo <span className="text-error">*</span>
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            disabled={loading}
            className="block w-full text-sm text-brown-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gold file:text-brown hover:file:bg-gold/80 disabled:opacity-50"
            aria-label="Upload animal photo"
          />
          {errors.image && <p className="text-sm text-error">{errors.image}</p>}
          {imagePreview && (
            <div className="mt-3 relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-48 rounded-lg border border-brown/10"
              />
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, image: null }));
                  setImagePreview(null);
                  setErrors((prev) => ({ ...prev, image: undefined }));
                }}
                className="absolute top-2 right-2 bg-error text-white rounded-full p-1 hover:bg-error/80"
                aria-label="Remove image"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
        <motion.button
          type="submit"
          variants={reduced ? undefined : submitVariants}
          animate={loading ? "loading" : "idle"}
          className="w-full bg-brown text-cream py-2.5 rounded-xl font-semibold hover:bg-brown/80 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Spinner />
              Processing…
            </>
          ) : (
            'Register Collateral'
          )}
        </button>
      </form>

      {lastSaved && !loading && (
        <p className="text-xs text-brown-400 text-center">
          Auto-saved at {lastSaved.toLocaleTimeString()}
        </p>
      )}

      {status && (
        <div
          role="status"
          className={`p-3 rounded-xl text-sm ${
            isError ? 'bg-error-light text-error-dark' : 'bg-success-light text-success-dark'
          }`}
        >
          {isError ? status.replace('error:', '') : status}
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Register Collateral"
        message={`Register ${formData.quantity} ${formData.animalType}(s) with appraised value of ${formData.appraisedValue} stroops as on-chain collateral? This action cannot be undone.`}
        confirmLabel="Register"
        onConfirm={() => {
          setShowConfirm(false);
          registerCollateral();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

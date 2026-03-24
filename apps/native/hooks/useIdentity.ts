/**
 * useIdentity — persists the verified Aadhaar identity in SecureStore.
 *
 * The stored value is the full verifyQR response (minus the raw UID, which
 * never leaves the server). It is keyed by IDENTITY_KEY and serialised as
 * JSON. The hook loads on mount and exposes save / clear helpers.
 */

import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";

const IDENTITY_KEY = "elector.verified-identity";

export type VerifiedIdentity = {
  userId: string;
  voterToken: string;
  displayName: string;
  dob: string;
  age: number;
  gender: string;
  photo: string | null;
  signatureValid: boolean;
  qrFormat: string;
  /** ISO string of when the identity was verified */
  verifiedAt: string;
};

type UseIdentityReturn = {
  identity: VerifiedIdentity | null;
  /** true while loading from SecureStore on mount */
  isLoading: boolean;
  /** Persist a new identity (merged with verifiedAt timestamp) */
  saveIdentity: (data: Omit<VerifiedIdentity, "verifiedAt">) => Promise<void>;
  /** Clear the stored identity (logout) */
  clearIdentity: () => Promise<void>;
};

export function useIdentity(): UseIdentityReturn {
  const [identity, setIdentity] = useState<VerifiedIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load from SecureStore on mount
  useEffect(() => {
    SecureStore.getItemAsync(IDENTITY_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setIdentity(JSON.parse(raw));
          } catch {
            // corrupted — ignore
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const saveIdentity = useCallback(
    async (data: Omit<VerifiedIdentity, "verifiedAt">) => {
      const full: VerifiedIdentity = { ...data, verifiedAt: new Date().toISOString() };
      await SecureStore.setItemAsync(IDENTITY_KEY, JSON.stringify(full));
      setIdentity(full);
    },
    []
  );

  const clearIdentity = useCallback(async () => {
    await SecureStore.deleteItemAsync(IDENTITY_KEY);
    setIdentity(null);
  }, []);

  return { identity, isLoading, saveIdentity, clearIdentity };
}

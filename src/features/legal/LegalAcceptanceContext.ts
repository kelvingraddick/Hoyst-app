import {createContext, useContext} from 'react';

export type LegalAcceptanceState = {
  uid?: string;
  accepted?: boolean;
  error?: string;
  retry: () => void;
  acknowledge: () => Promise<void>;
};
export const LegalAcceptanceContext = createContext<LegalAcceptanceState>({
  retry: () => {},
  acknowledge: () => Promise.reject(new Error('Sign in to continue.')),
});
export function useLegalAcceptance() {
  return useContext(LegalAcceptanceContext);
}
export function useHasLegalAcceptance() {
  return useLegalAcceptance().accepted === true;
}

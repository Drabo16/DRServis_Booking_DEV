'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';

interface SaveStatusContextType {
  isSaving: boolean;
  savingMessage: string;
  startSaving: (message?: string) => void;
  stopSaving: () => void;
}

const SaveStatusContext = createContext<SaveStatusContextType | undefined>(undefined);

export function SaveStatusProvider({ children }: { children: ReactNode }) {
  const [isSaving, setIsSaving] = useState(false);
  const [savingMessage, setSavingMessage] = useState('Ukládání...');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startSaving = useCallback((message = 'Ukládání...') => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsSaving(true);
    setSavingMessage(message);
  }, []);

  const stopSaving = useCallback(() => {
    // Keep visible for at least 300ms so user can see it
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsSaving(false);
      timeoutRef.current = null;
    }, 300);
  }, []);

  return (
    <SaveStatusContext.Provider value={{ isSaving, savingMessage, startSaving, stopSaving }}>
      {children}
    </SaveStatusContext.Provider>
  );
}

export function useSaveStatus() {
  const context = useContext(SaveStatusContext);
  if (context === undefined) {
    throw new Error('useSaveStatus must be used within a SaveStatusProvider');
  }
  return context;
}

'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

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

  const startSaving = useCallback((message = 'Ukládání...') => {
    console.log('💾 Start saving:', message);
    setIsSaving(true);
    setSavingMessage(message);
  }, []);

  const stopSaving = useCallback(() => {
    console.log('✅ Stop saving');
    // Keep visible for at least 500ms so user can see it
    setTimeout(() => {
      setIsSaving(false);
    }, 500);
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

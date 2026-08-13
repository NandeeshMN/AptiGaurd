import React, { createContext, useContext, useState, useCallback } from 'react';
import { ActionConfirmation } from '../components/ActionConfirmation';

interface ConfirmationConfig {
  message: string;
  type?: 'success' | 'warning' | 'error';
  duration?: number;
}

interface ActionConfirmationContextType {
  showConfirmation: (config: ConfirmationConfig) => void;
}

const ActionConfirmationContext = createContext<ActionConfirmationContextType | undefined>(undefined);

export const ActionConfirmationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [confirmation, setConfirmation] = useState<ConfirmationConfig | null>(null);

  const showConfirmation = useCallback((config: ConfirmationConfig) => {
    setConfirmation(config);
  }, []);

  const handleClose = useCallback(() => {
    setConfirmation(null);
  }, []);

  return (
    <ActionConfirmationContext.Provider value={{ showConfirmation }}>
      {children}
      {confirmation && (
        <ActionConfirmation
          message={confirmation.message}
          type={confirmation.type}
          duration={confirmation.duration || 2500}
          onClose={handleClose}
        />
      )}
    </ActionConfirmationContext.Provider>
  );
};

export const useActionConfirmation = () => {
  const context = useContext(ActionConfirmationContext);
  if (!context) {
    throw new Error('useActionConfirmation must be used within an ActionConfirmationProvider');
  }
  return context;
};

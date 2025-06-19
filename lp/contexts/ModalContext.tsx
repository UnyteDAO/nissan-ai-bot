'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface FormData {
  organization: string;
  name: string;
  email: string;
  communitySize: string;
  message: string;
}

interface ModalContextType {
  isContactFormOpen: boolean;
  openContactForm: () => void;
  closeContactForm: () => void;
  formData: FormData;
  setFormData: (data: FormData) => void;
  resetFormData: () => void;
}

const initialFormData: FormData = {
  organization: '',
  name: '',
  email: '',
  communitySize: '',
  message: ''
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const openContactForm = () => setIsContactFormOpen(true);
  const closeContactForm = () => setIsContactFormOpen(false);
  const resetFormData = () => setFormData(initialFormData);

  return (
    <ModalContext.Provider value={{ 
      isContactFormOpen, 
      openContactForm, 
      closeContactForm,
      formData,
      setFormData,
      resetFormData
    }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
'use client';

import { useModal } from '@/contexts/ModalContext';
import ContactFormModal from './ContactFormModal';

export default function ClientModal() {
  const { isContactFormOpen, closeContactForm } = useModal();
  return <ContactFormModal isOpen={isContactFormOpen} onClose={closeContactForm} />;
}
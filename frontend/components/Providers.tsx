'use client';
import type { ReactNode } from 'react';
import { ConfirmProvider } from './ui/Confirm';
import { ToastProvider } from './ui/Toast';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}

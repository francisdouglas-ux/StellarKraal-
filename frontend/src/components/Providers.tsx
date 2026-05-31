'use client';

import React from 'react';
import { Provider } from 'react-redux';
import { store } from '@/store/store';
import { ToastProvider, ToastContainer } from '@/components/toast';
import OfflineBanner from '@/components/OfflineBanner';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <Provider store={store}>
      <ToastProvider>
        <OfflineBanner />
        {children}
        <ToastContainer />
      </ToastProvider>
    </Provider>
  );
}

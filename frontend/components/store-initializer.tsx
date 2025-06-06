'use client';

import { useEffect } from 'react';
import { useUserStore } from '@/lib/store/use-user-store';

export function StoreInitializer() {
  useEffect(() => {
    // Fetch user data once on initial mount
    useUserStore.getState().fetchUser();

    // Optional: Clean up listener on unmount if needed,
    // but the store itself handles unsubscribing on subsequent fetches.
    // return () => {
    //   useUserStore.getState().clearUser();
    // };
  }, []); // Empty dependency array ensures it runs only once

  return null; // This component doesn't render anything
} 
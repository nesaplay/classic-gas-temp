import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface UserState {
  user: User | null;
  isLoadingUser: boolean;
  fetchUser: () => Promise<void>;
  clearUser: () => void;
}

let authListener: { subscription: { unsubscribe: () => void } } | null = null;

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isLoadingUser: true,

  fetchUser: async () => {
    const supabase = createClient();
    set({ isLoadingUser: true });

    // Initial fetch
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      set({ user: user, isLoadingUser: false });
    } catch (error) {
      console.error("Error fetching user:", error);
      set({ user: null, isLoadingUser: false });
    }

    authListener?.subscription.unsubscribe();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      if (currentUser?.id !== get().user?.id) {
         set({ user: currentUser, isLoadingUser: false });
      }
      if (get().isLoadingUser) {
         set({ isLoadingUser: false });
      }
    });
    authListener = data;
  },

  clearUser: () => {
     authListener?.subscription.unsubscribe();
     authListener = null;
     set({ user: null, isLoadingUser: false });
  },
})); 
import { create } from "zustand";
import { PROJECT_CONFIG } from "../constants";

const defaultActiveSection = {
  id: "",
  label: "",
  assistantId: PROJECT_CONFIG.sections[0].assistantId,
  assistantName: "",
  welcomeMessage: ["How can I help you today?"],
};

interface ChatStore {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  toggleOpen: () => void;

  loading: boolean;
  setLoading: (loading: boolean) => void;
  context: { data: Record<string, unknown> | null, filters: Record<string, unknown> | null } | null;
  setContext: (contextUpdate: { data?: Record<string, unknown> | null, filters?: Record<string, unknown> | null } | null) => void;
  showContext: boolean;
  setShowContext: (showContext: boolean) => void;
  activeSection: {
    id: string;
    assistantId: string;
  } | null;
  setActiveSection: (
    activeSection: {
      id: string;
      assistantId: string;
    } | null,
  ) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),

  context: { data: null, filters: null },
  setContext: (contextUpdate) => set((state) => ({
    context: contextUpdate === null
      ? { data: null, filters: null }
      : { ...(state.context || { data: null, filters: null }), ...contextUpdate }
  })),
  
  activeSection: defaultActiveSection,
  setActiveSection: (activeSection) =>
    set({ activeSection: activeSection === null ? defaultActiveSection : activeSection }),
  
  showContext: false,
  setShowContext: (showContext) => set({ showContext }),
  loading: false,
  setLoading: (loading) => set({ loading }),
}));

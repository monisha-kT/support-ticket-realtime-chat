import { create } from 'zustand';

const useStore = create((set) => ({
  user: null,
  tickets: [],
  messages: [],
  setUser: (user) => set({ user }),
  setTickets: (tickets) => set({ tickets }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
}));

export default useStore;
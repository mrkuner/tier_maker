import { create } from 'zustand'

const useAuthStore = create((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  loginOpen: false,
  openLogin: () => set({ loginOpen: true }),
  closeLogin: () => set({ loginOpen: false }),
}))

export default useAuthStore

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const usePrefsStore = create(
  persist(
    (set) => ({
      modoTexto: false,
      setModoTexto: (v) => set({ modoTexto: !!v }),
      toggleModoTexto: () => set((s) => ({ modoTexto: !s.modoTexto })),
    }),
    {
      name: 'tier_maker:prefs',
      version: 1,
    },
  ),
)

export default usePrefsStore

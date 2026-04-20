import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useUserStore = create(
  persist(
    (set) => ({
      nombre: '',
      setNombre: (nombre) => set({ nombre }),
    }),
    { name: 'tier_maker:user' },
  ),
)

export default useUserStore

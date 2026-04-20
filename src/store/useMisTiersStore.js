import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useMisTiersStore = create(
  persist(
    (set) => ({
      tokens: {},
      addMiTier: (id, token) =>
        set((state) =>
          state.tokens[id] === token
            ? state
            : { tokens: { ...state.tokens, [id]: token } },
        ),
      removeMiTier: (id) =>
        set((state) => {
          if (!(id in state.tokens)) return state
          const next = { ...state.tokens }
          delete next[id]
          return { tokens: next }
        }),
      pruneMisTiers: (existentesIds) =>
        set((state) => {
          const s = new Set(existentesIds)
          const entries = Object.entries(state.tokens).filter(([k]) => s.has(k))
          if (entries.length === Object.keys(state.tokens).length) return state
          return { tokens: Object.fromEntries(entries) }
        }),
    }),
    {
      name: 'tier_maker:mis_tiers',
      version: 2,
      migrate: (persistedState, version) => {
        if (version < 2) return { tokens: {} }
        return persistedState
      },
    },
  ),
)

export default useMisTiersStore

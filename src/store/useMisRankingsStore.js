import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useMisRankingsStore = create(
  persist(
    (set, get) => ({
      rankings: {},
      getRankingId: (tierId) => get().rankings[tierId]?.ranking_id ?? null,
      getNombre: (tierId) => get().rankings[tierId]?.nombre ?? null,
      setRanking: (tierId, ranking_id, nombre) =>
        set((state) => ({
          rankings: {
            ...state.rankings,
            [tierId]: { ranking_id, nombre: nombre ?? null },
          },
        })),
      clearRanking: (tierId) =>
        set((state) => {
          if (!(tierId in state.rankings)) return state
          const next = { ...state.rankings }
          delete next[tierId]
          return { rankings: next }
        }),
    }),
    {
      name: 'tier_maker:mis_rankings',
      version: 1,
    },
  ),
)

export default useMisRankingsStore

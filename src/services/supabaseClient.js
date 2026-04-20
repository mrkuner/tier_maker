import { createClient } from '@supabase/supabase-js'
import useMisTiersStore from '../store/useMisTiersStore.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const tokenClientCache = new Map()

export function supabaseForTier(tierId) {
  const token = useMisTiersStore.getState().tokens?.[tierId]
  if (!token) return supabase
  let client = tokenClientCache.get(token)
  if (!client) {
    client = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { 'x-tier-token': token } },
    })
    tokenClientCache.set(token, client)
  }
  return client
}

export default supabase

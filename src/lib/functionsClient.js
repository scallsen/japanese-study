import { supabase } from './supabase.js'

// supabase.functions.invoke only ever reports a generic "Edge Function returned
// a non-2xx status code"; the real reason is in the response body. Every caller
// here is an action where the user needs to know why they were refused, so the
// unwrapping lives in one place rather than being rediscovered per call site.
export async function callFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, body ? { body } : undefined)
  if (error || data?.error) {
    let message = data?.error ?? error?.message
    try {
      const payload = await error?.context?.json()
      if (payload?.error) message = payload.error
    } catch { /* keep the generic message */ }
    throw new Error(message || `${name} failed`)
  }
  return data
}

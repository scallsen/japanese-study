import { supabase } from '../../lib/supabase.js'

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = error.message
    try {
      const payload = await error.context?.json()
      if (payload?.error) message = payload.error
    } catch { /* keep the generic message */ }
    throw new Error(message || `${name} failed`)
  }
  return data
}

// → { title, story, tokens, questions: [{ id, question, correct_answer, acceptable_variations }] }
// The function streams heartbeat spaces to dodge the gateway's 150s idle
// timeout, then the JSON payload as the final line — so the body arrives as
// text and errors come back as { error } with a 200 status.
export async function generateStory({ learnerContext, mode, basedOn, format, length }) {
  const data = await invoke('story-generate', { learnerContext, mode, basedOn, format, length })
  const payload = typeof data === 'string' ? JSON.parse(data.trim()) : data
  if (payload?.error) throw new Error(payload.error)
  return payload
}

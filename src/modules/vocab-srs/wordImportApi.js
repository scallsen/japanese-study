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
  if (data?.error) throw new Error(data.error)
  return data
}

// → { words: [{ id, surface, reading, meaning, jmdictId }], truncated }
export function extractWordsFromText(text) {
  return invoke('word-import', { mode: 'text', text })
}

export function extractWordsFromImage(image, mediaType) {
  return invoke('word-import', { mode: 'image', image, mediaType })
}

// Reads a File into { image: base64 (no data: prefix), mediaType }.
export function readImageAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      const commaIdx = result.indexOf(',')
      const mediaType = result.slice(5, result.indexOf(';')) || file.type || 'image/png'
      resolve({ image: result.slice(commaIdx + 1), mediaType })
    }
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}

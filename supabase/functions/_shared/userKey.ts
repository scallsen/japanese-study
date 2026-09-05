import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
const ENCRYPTION_SECRET = Deno.env.get('API_KEY_ENCRYPTION_SECRET')

const admin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

// Encrypted at rest on top of whatever the platform already does, so that a
// leaked database dump alone doesn't hand over working Anthropic keys — the
// decryption secret lives only in the function's environment.
//
// SHA-256 of the secret rather than PBKDF2: the input is a high-entropy env
// var, not a human password, so key stretching buys nothing here.
async function deriveKey() {
  if (!ENCRYPTION_SECRET) throw new Error('Server misconfigured: API_KEY_ENCRYPTION_SECRET is not set')
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ENCRYPTION_SECRET))
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(plain: string) {
  const key = await deriveKey()
  // A fresh IV per encryption — reusing one under AES-GCM is catastrophic.
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain))
  const packed = new Uint8Array(iv.length + cipher.byteLength)
  packed.set(iv)
  packed.set(new Uint8Array(cipher), iv.length)
  return btoa(String.fromCharCode(...packed))
}

export async function decryptSecret(stored: string) {
  const packed = Uint8Array.from(atob(stored), c => c.charCodeAt(0))
  const key = await deriveKey()
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: packed.slice(0, 12) },
    key,
    packed.slice(12),
  )
  return new TextDecoder().decode(plain)
}

// The last four characters, which is all the UI ever gets back. Everything
// else about the key stays server-side for its whole life.
export function keyHint(apiKey: string) {
  return apiKey.slice(-4)
}

export function looksLikeAnthropicKey(value: unknown): value is string {
  return typeof value === 'string' && /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(value.trim())
}

/**
 * The caller's own key, decrypted, or null if they haven't set one.
 * A user on their own key is not metered — see the quota bypass in the
 * AI functions.
 */
export async function getUserApiKey(userId: string): Promise<string | null> {
  if (!admin || !ENCRYPTION_SECRET) return null
  const { data, error } = await admin
    .from('user_api_keys')
    .select('encrypted_key')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.encrypted_key) return null
  try {
    return await decryptSecret(data.encrypted_key)
  } catch (err) {
    // A key that can't be decrypted (rotated secret, corrupt row) must fall
    // back to the app's own key and quota rather than failing the request.
    console.error('[userKey] decrypt failed', err)
    return null
  }
}

export function adminClient() {
  return admin
}

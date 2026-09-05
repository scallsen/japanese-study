// The OAuth providers offered for both sign-in and account linking. One list
// so the sign-in dialog and the account page's linked-accounts section can't
// drift apart. Each id must match a provider enabled in the Supabase
// dashboard — the code shipping ahead of that toggle is expected: the button
// simply errors until the project is configured.
export const AUTH_PROVIDERS = [
  { id: 'github', label: 'GitHub' },
  { id: 'google', label: 'Google' },
]

// Identities created by the magic-link flow report this provider. It has no
// OAuth button and can't be unlinked like the others, so it's named here
// rather than being a bare string in three places.
export const EMAIL_PROVIDER = 'email'

export function providerLabel(id) {
  if (id === EMAIL_PROVIDER) return 'Email'
  return AUTH_PROVIDERS.find(p => p.id === id)?.label ?? id
}

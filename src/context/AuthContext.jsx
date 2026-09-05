import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import SignInDialog from '../components/SignInDialog.jsx'

const AuthContext = createContext(null)

// Where an OAuth round trip or a magic link should land the user back.
// Deliberately drops the hash: Supabase appends its own fragment, and
// returning to '#/vocab-srs' would collide with it.
function redirectTarget() {
  return window.location.origin + window.location.pathname
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chooserOpen, setChooserOpen] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Use functional update to preserve reference on token refresh (same user ID).
      // Without this, every TOKEN_REFRESHED event re-runs useProgress's effect → loading flash.
      setUser(prev => {
        const next = session?.user ?? null
        if (prev?.id === next?.id) return prev
        return next
      })
    })

    return () => subscription.unsubscribe()
  }, [])

  // Kept parameterless so the six existing call sites (AuthSlot, VocabSrsModule,
  // StoryModule, EpisodeDrill, ...) need no change: with more than one provider
  // available, "Sign in" can no longer mean "redirect to GitHub" — it has to ask.
  function signIn() {
    setChooserOpen(true)
  }

  function signInWithProvider(provider) {
    return supabase?.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTarget() },
    })
  }

  function signInWithEmail(email) {
    return supabase?.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTarget() },
    })
  }

  function signOut() {
    return supabase?.auth.signOut()
  }

  // Attaches another provider to the *current* account rather than starting a
  // second one. Requires "Manual linking" to be enabled for the project.
  function linkProvider(provider) {
    return supabase?.auth.linkIdentity({
      provider,
      options: { redirectTo: redirectTarget() },
    })
  }

  function unlinkProvider(identity) {
    return supabase?.auth.unlinkIdentity(identity)
  }

  // onAuthStateChange above intentionally keeps the previous object when the
  // id is unchanged, so a change to identities alone (linking/unlinking) would
  // never reach the UI. This forces the new object through.
  async function refreshUser() {
    const { data } = await supabase.auth.getUser()
    setUser(data?.user ?? null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signInWithProvider,
      signInWithEmail,
      signOut,
      linkProvider,
      unlinkProvider,
      refreshUser,
    }}>
      {children}
      <SignInDialog
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onProvider={signInWithProvider}
        onEmail={signInWithEmail}
      />
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}

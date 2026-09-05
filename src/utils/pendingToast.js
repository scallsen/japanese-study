// A toast that has to outlive the navigation that caused it. The page that
// knows the outcome (account deleted) unmounts immediately afterwards, so
// firing the toast there would spend most of its duration mid-transition —
// the destination shows it instead.
//
// sessionStorage rather than localStorage: a flag that never gets consumed
// should die with the tab, not resurface days later announcing "Account
// deleted". Reading it also clears it, so StrictMode's double-invoked effects
// show the toast once rather than twice.
const KEY = 'pending-toast'

export function setPendingToast(message) {
  try {
    sessionStorage.setItem(KEY, message)
  } catch {
    // storage unavailable — the toast is a nicety, not worth failing over
  }
}

export function takePendingToast() {
  try {
    const message = sessionStorage.getItem(KEY)
    if (message) sessionStorage.removeItem(KEY)
    return message
  } catch {
    return null
  }
}

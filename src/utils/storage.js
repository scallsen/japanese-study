export function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable or quota exceeded — silently ignore
  }
}

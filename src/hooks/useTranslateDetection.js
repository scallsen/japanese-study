import { useEffect, useState } from 'react'

// Chrome (and other Chromium browsers) stamp one of these classes onto
// <html> the instant a translation is applied — whether the learner invoked
// it manually (right-click → Translate) despite the page's own notranslate
// hint, or an older/unaffected browser ignores that hint outright. It's the
// only translation-state signal exposed to page script, so it's what this
// polls for rather than trying to diff rendered text.
const TRANSLATED_CLASSES = ['translated-ltr', 'translated-rtl']

export function useTranslateDetection() {
  const [translated, setTranslated] = useState(false)

  useEffect(() => {
    const root = document.documentElement

    function check() {
      setTranslated(TRANSLATED_CLASSES.some(c => root.classList.contains(c)))
    }

    check()
    const observer = new MutationObserver(check)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return translated
}

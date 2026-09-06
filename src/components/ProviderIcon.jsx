import { EMAIL_PROVIDER } from '../data/authProviders.js'

// Brand marks for the sign-in providers, inline rather than as files in
// public/: they render at one size beside a label, and inlining lets GitHub's
// monochrome mark inherit the button's own color instead of shipping a second
// asset per variant.
//
// Google's is the one mark that keeps its own colors — its brand guidelines
// require the four-color G, so it can't follow currentColor.
const GITHUB_PATH = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8Z'

const GOOGLE_PATHS = [
  { d: 'M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z', fill: '#4285F4' },
  { d: 'M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z', fill: '#34A853' },
  { d: 'M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z', fill: '#FBBC05' },
  { d: 'M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z', fill: '#EA4335' },
]

export default function ProviderIcon({ provider, size = 16 }) {
  // A fixed-size slot even for a provider with no mark, so a row without one
  // keeps its label aligned with the rows that have one.
  const box = { width: size, height: size, flexShrink: 0 }

  if (provider === 'github') {
    return (
      <svg style={box} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d={GITHUB_PATH} />
      </svg>
    )
  }

  if (provider === 'google') {
    return (
      <svg style={box} viewBox="0 0 18 18" aria-hidden="true">
        {GOOGLE_PATHS.map(p => <path key={p.fill} d={p.d} fill={p.fill} />)}
      </svg>
    )
  }

  // The magic-link identity has no brand mark of its own, and a blank slot
  // beside a labelled row reads as something failing to load.
  if (provider === EMAIL_PROVIDER) {
    return (
      <svg style={box} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <rect x="1.7" y="3.3" width="12.6" height="9.4" rx="1.4" />
        <path d="M2.4 4.6 8 8.7l5.6-4.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return <span style={box} aria-hidden="true" />
}

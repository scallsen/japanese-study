import { describe, it, expect, beforeAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import SettingsLabPage from './SettingsLabPage.jsx'

// PageHeader reads window.innerWidth during render; this repo has no jsdom.
beforeAll(() => {
  globalThis.window = { innerWidth: 1280, addEventListener() {}, removeEventListener() {} }
})

const VARIANTS = ['today', 'anatomy', 'tabs', 'presets', 'oncard']
const CONTEXTS = ['genki-1', 'nsm-n2', 'word-import']

describe('SettingsLabPage', () => {
  it.each(VARIANTS.flatMap(v => CONTEXTS.map(c => [v, c])))('renders %s on %s', (variant, context) => {
    const html = renderToStaticMarkup(<SettingsLabPage initialVariant={variant} initialContext={context} />)
    expect(html).toContain('Drill settings')
    expect(html).toContain('経験')
  })
})

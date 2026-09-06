import { describe, it, expect, beforeAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import SettingsLabPage from './SettingsLabPage.jsx'

// PageHeader reads window.innerWidth during render; this repo has no jsdom.
beforeAll(() => {
  globalThis.window = { innerWidth: 1280, addEventListener() {}, removeEventListener() {} }
})

const VARIANTS = ['today', 'anatomy', 'tabs', 'presets', 'oncard']
const CONTEXTS = ['genki-1', 'nsm-n2', 'word-import']

const CONTROL_STYLES = ['switch', 'chip', 'segmented', 'checkbox']

describe('SettingsLabPage', () => {
  it.each(VARIANTS.flatMap(v => CONTEXTS.map(c => [v, c])))('renders %s on %s', (variant, context) => {
    const html = renderToStaticMarkup(<SettingsLabPage initialVariant={variant} initialContext={context} />)
    expect(html).toContain('Drill settings')
    expect(html).toContain('経験')
  })

  it.each(CONTROL_STYLES)('renders the anatomy panel with %s controls', style => {
    const html = renderToStaticMarkup(<SettingsLabPage initialVariant="anatomy" initialControlStyle={style} />)
    expect(html).toContain('Card front')
    expect(html).toContain('Furigana')
  })

  it('offers the backup voice row when the device has voices', () => {
    const html = renderToStaticMarkup(<SettingsLabPage initialVariant="anatomy" initialBrowserVoices />)
    expect(html).toContain('>Backup voice<')
  })

  it.each(['anatomy', 'tabs', 'presets', 'oncard'])('hides the backup voice row in %s when the device has none', variant => {
    const html = renderToStaticMarkup(<SettingsLabPage initialVariant={variant} initialBrowserVoices={false} />)
    // The explanatory copy above the panel still names it, so assert on the
    // control's own label text rather than any occurrence of the phrase.
    expect(html).not.toContain('>Backup voice<')
  })
})

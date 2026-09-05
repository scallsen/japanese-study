import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import AuthSlot from '../components/AuthSlot.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import Button from '../components/Button.jsx'
import TextInput from '../components/TextInput.jsx'
import Select from '../components/Select.jsx'
import DataList from '../components/DataList.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import Modal from '../components/Modal.jsx'
import Markdown from '../components/Markdown.jsx'
// Inlined at build time by Vite, so the modal always shows the committed file
// rather than a copy that drifts from it.
import PRIVACY_MD from '../../PRIVACY.md?raw'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { setPendingToast } from '../utils/pendingToast.js'
import { AUTH_PROVIDERS, EMAIL_PROVIDER, providerLabel } from '../data/authProviders.js'
import { AI_DAILY_LIMITS } from '../data/aiLimits.js'
import { useAiUsage } from '../hooks/useAiUsage.js'
import { useApiKeyStatus } from '../hooks/useApiKeyStatus.js'
import { callFunction } from '../lib/functionsClient.js'
import { useProgress } from '../hooks/useProgress.js'
import { migrateProgress } from '../modules/vocab-srs/migrate.js'
import { resolveCard } from '../modules/vocab-srs/srs.js'
import { buildAnkiTsv, buildBackupJson, downloadFile, timestampedName } from '../utils/exportData.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, DANGER,
  FS_BASE, FS_SM, FS_CONTENT_HEADING,
  SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32,
} from '../data/theme.js'

const COLUMN_WIDTH = 640

export default function AccountPage() {
  const { user, loading, signIn, signOut, linkProvider, unlinkProvider, refreshUser } = useAuth()
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  // null until the user picks one, so the control reflects whether a key is
  // actually stored — and lets them choose "own" before entering one.
  const [providerChoice, setProviderChoice] = useState(null)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const isMobile = useIsMobile()

  // Above the early returns below — hooks can't run conditionally.
  const { usage } = useAiUsage()
  const { hint: keyHint, loading: keyLoading, refresh: refreshKey } = useApiKeyStatus()
  const { data: srsRaw } = useProgress('vocab-srs')

  const shell = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: FONT,
    letterSpacing: TRACKING,
    color: TEXT,
  }

  // Centred column: the scroll area centres its single child, and every
  // section inside is full width of that child.
  const scroll = {
    flex: 1,
    overflowY: 'auto',
    padding: SPACE_24,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  }

  const column = {
    width: '100%',
    maxWidth: COLUMN_WIDTH,
    display: 'flex',
    flexDirection: 'column',
    gap: SPACE_32,
  }

  const crumbs = [{ label: 'Japanese Study', href: '#/' }, { label: 'Account' }]

  if (loading) {
    return <div style={shell}><PageHeader crumbs={crumbs} rightSlot={<AuthSlot />} /></div>
  }

  if (!user) {
    return (
      <div style={shell}>
        <PageHeader crumbs={crumbs} rightSlot={<AuthSlot />} />
        <div style={scroll}>
          <div style={{ ...column, alignItems: 'center', gap: SPACE_16 }}>
            <div style={{ fontSize: FS_CONTENT_HEADING }}>Sign in to manage your account</div>
            <Button size="lg" onClick={signIn}>Sign in</Button>
          </div>
        </div>
      </div>
    )
  }

  const identities = user.identities ?? []
  const byProvider = new Map(identities.map(i => [i.provider, i]))
  // Supabase refuses to remove the last identity, which would leave the
  // account with no way back in. Reflect that rather than letting it fail.
  const canUnlink = identities.length > 1

  async function handleLink(id) {
    setError(null)
    setBusy(true)
    const { error: err } = (await linkProvider(id)) ?? {}
    if (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  async function handleUnlink(identity) {
    setError(null)
    setBusy(true)
    const { error: err } = (await unlinkProvider(identity)) ?? {}
    if (err) setError(err.message)
    else await refreshUser()
    setBusy(false)
  }

  async function saveApiKey() {
    setError(null)
    setBusy(true)
    try {
      await callFunction('user-api-key', { action: 'save', apiKey: keyInput.trim() })
      setKeyInput('')
      await refreshKey()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  async function removeApiKey() {
    setError(null)
    setBusy(true)
    try {
      await callFunction('user-api-key', { action: 'remove' })
      await refreshKey()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  async function handleDelete() {
    setConfirmingDelete(false)
    setError(null)
    setBusy(true)
    try {
      await callFunction('delete-account')
    } catch (err) {
      setError(err.message)
      setBusy(false)
      return
    }
    // Handed to the destination rather than shown here: this page unmounts a
    // moment later, which would eat most of the toast's duration.
    setPendingToast('Account deleted')
    await signOut()
    window.location.hash = '#/'
  }

  // migrateProgress is safe on null (fresh install) and normalises old shapes.
  const srsProgress = migrateProgress(srsRaw)
  const srsCards = Object.values(srsProgress.cards ?? {}).map(card => resolveCard(card))
  const deckNames = Object.fromEntries(
    Object.entries(srsProgress.decks ?? {}).map(([id, deck]) => [id, deck.name])
  )
  const exportableCards = srsCards.filter(card => card.front && card.back)

  function exportAnki() {
    downloadFile(
      timestampedName('japanese-study-anki', 'tsv'),
      buildAnkiTsv(srsCards, deckNames),
      'text/tab-separated-values',
    )
  }

  async function exportBackup() {
    setError(null)
    setBusy(true)
    const [progressRes, storiesRes] = await Promise.all([
      supabase.from('progress').select('namespace, payload, updated_at').eq('user_id', user.id),
      supabase.from('stories').select('*').eq('user_id', user.id),
    ])
    const failure = progressRes.error || storiesRes.error
    if (failure) {
      setError(`Could not build backup: ${failure.message}`)
      setBusy(false)
      return
    }
    downloadFile(
      timestampedName('japanese-study-backup', 'json'),
      buildBackupJson({ progress: progressRes.data ?? [], stories: storiesRes.data ?? [] }),
      'application/json',
    )
    setBusy(false)
  }

  const meta = user.user_metadata ?? {}
  const profileRows = [
    { id: 'email', label: 'Email', value: user.email ?? 'Not set' },
    { id: 'name', label: 'Display name', value: meta.full_name || meta.user_name || 'Not set' },
    { id: 'since', label: 'Member since', value: new Date(user.created_at).toLocaleDateString() },
  ]

  const profileColumns = [
    { key: 'label', width: 150 },
    { key: 'value', flex: 1, tone: 'muted', wrap: true },
  ]

  // Every provider gets a row whether linked or not, so the list doubles as
  // the place to add one — a linked row offers Unlink, an unlinked row Link.
  // A magic-link identity has no OAuth button of its own, so it only appears
  // once it exists.
  const emailIdentity = byProvider.get(EMAIL_PROVIDER)
  const accountRows = [
    ...AUTH_PROVIDERS.map(p => ({ id: p.id, label: p.label, identity: byProvider.get(p.id) })),
    ...(emailIdentity ? [{ id: EMAIL_PROVIDER, label: providerLabel(EMAIL_PROVIDER), identity: emailIdentity }] : []),
  ]

  const accountColumns = [
    { key: 'label', width: 150 },
    {
      key: 'detail',
      flex: 1,
      tone: 'muted',
      wrap: true,
      render: row => (row.identity ? (row.identity.identity_data?.email ?? 'Connected') : 'Not connected'),
    },
    {
      key: 'action',
      width: 90,
      align: 'right',
      render: row => (row.identity ? (
        <Button variant="ghost-muted" size="sm" disabled={!canUnlink || busy} onClick={() => handleUnlink(row.identity)}>
          Unlink
        </Button>
      ) : (
        <Button variant="neutral" size="sm" disabled={busy} onClick={() => handleLink(row.id)}>
          Link
        </Button>
      )),
    },
  ]

  // Selecting "free" while a key is stored has to actually remove it — the
  // server decides which key it uses by whether one exists, so leaving it
  // behind would make this control lie about what's happening.
  const provider = providerChoice ?? (keyHint ? 'own' : 'free')

  function handleProviderChange(next) {
    setProviderChoice(next)
    if (next === 'free' && keyHint) removeApiKey()
  }

  const providerRows = [
    {
      id: 'provider',
      label: 'Provider',
      control: (
        <Select
          value={provider}
          onChange={handleProviderChange}
          disabled={busy || keyLoading}
          options={[
            { value: 'free', label: 'Free limited usage' },
            { value: 'own', label: 'Your own account' },
          ]}
        />
      ),
    },
    ...(provider === 'own' ? [{
      id: 'key',
      label: 'Anthropic API key',
      control: keyLoading ? (
        <span style={{ color: TEXT_MUTED, fontSize: FS_SM }}>Loading&hellip;</span>
      ) : keyHint ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE_8 }}>
          <span style={{ fontSize: FS_BASE }}>sk-ant-&hellip;{keyHint}</span>
          <Button variant="ghost-muted" size="sm" disabled={busy} onClick={removeApiKey}>Remove</Button>
        </span>
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE_8, width: '100%' }}>
          <TextInput
            type="password"
            value={keyInput}
            onChange={setKeyInput}
            placeholder="sk-ant-..."
            disabled={busy}
            autoComplete="off"
            style={{ flex: 1, minWidth: 120 }}
          />
          <Button size="sm" disabled={busy || !keyInput.trim()} onClick={saveApiKey}>Save</Button>
        </span>
      ),
    }] : []),
  ]

  const providerColumns = [
    { key: 'label', width: 150 },
    { key: 'control', flex: 1, render: row => row.control },
  ]

  const usingOwnKey = provider === 'own' && !!keyHint

  const usageColumns = [
    { key: 'label', width: 220 },
    {
      key: 'used',
      flex: 1,
      tone: 'muted',
      // On their own key there is no cap to count against, so the useful
      // figure is what they've actually spent rather than what's left.
      render: row => (usingOwnKey
        ? `${usage.today[row.feature] ?? 0} today (${usage.lifetime[row.feature] ?? 0} lifetime)`
        : `${usage.today[row.feature] ?? 0} of ${row.limit}`),
    },
  ]

  return (
    <div style={shell}>
      <PageHeader crumbs={crumbs} rightSlot={<AuthSlot />} />
      <div style={scroll}>
        <div style={column}>

          <section>
            <SectionHeader title="Profile" />
            <DataList columns={profileColumns} rows={profileRows} maxWidth={COLUMN_WIDTH} />
          </section>

          <section>
            <SectionHeader title="Sign-in method" />
            <DataList columns={accountColumns} rows={accountRows} maxWidth={COLUMN_WIDTH} />
            <div style={{ color: TEXT_MUTED, fontSize: FS_SM, marginTop: SPACE_12, lineHeight: 1.5 }}>
              You need at least one sign-in method linked.
            </div>
          </section>

          <section>
            <SectionHeader title="AI usage" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_16 }}>
              <DataList
                columns={providerColumns}
                rows={providerRows}
                maxWidth={COLUMN_WIDTH}
              />
              <DataList
                columns={usageColumns}
                rows={AI_DAILY_LIMITS}
                rowKey={row => row.feature}
                maxWidth={COLUMN_WIDTH}
              />
            </div>
            <div style={{ color: TEXT_MUTED, fontSize: FS_SM, marginTop: SPACE_12, lineHeight: 1.5 }}>
              {usingOwnKey
                ? 'Billed to your Anthropic account. Your key is stored encrypted and never shown again — only the last four characters come back.'
                : 'Resets at 00:00 UTC. Generating a story and reading words from a photo both call Claude, so they’re capped per day.'}
            </div>
          </section>

          <section>
            <SectionHeader title="Your data" />
            <div style={{ display: 'flex', gap: SPACE_8, flexWrap: 'wrap' }}>
              <Button variant="neutral" disabled={busy} onClick={exportBackup}>
                Download all data (JSON)
              </Button>
              <Button variant="neutral" disabled={busy || exportableCards.length === 0} onClick={exportAnki}>
                {exportableCards.length > 0
                  ? `Export ${exportableCards.length} cards for Anki`
                  : 'No cards to export'}
              </Button>
              <Button variant="danger-outline" disabled={busy} onClick={() => setConfirmingDelete(true)}>
                Delete account
              </Button>
            </div>
          </section>

          {error && (
            <div style={{ color: DANGER, fontSize: FS_BASE, lineHeight: 1.5 }}>{error}</div>
          )}

          <div>
            <button
              onClick={() => setPrivacyOpen(true)}
              className="muted-link"
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontFamily: FONT, fontSize: FS_SM, letterSpacing: TRACKING, color: TEXT_MUTED,
              }}
            >
              Privacy policy
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title="Privacy policy"
        size="lg"
        isMobile={isMobile}
      >
        {/* The document keeps its own H1 so it reads properly as a file on
            GitHub; here the modal header already carries the title. */}
        <Markdown source={PRIVACY_MD.replace(/^#\s+.*\n+/, '')} />
      </Modal>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete account?"
        message="This permanently deletes your review progress, decks, and generated stories. This cannot be undone."
        confirmLabel="Delete account"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}

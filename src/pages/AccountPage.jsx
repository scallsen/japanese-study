import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import Button from '../components/Button.jsx'
import DataList from '../components/DataList.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { AUTH_PROVIDERS, EMAIL_PROVIDER, providerLabel } from '../data/authProviders.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, DANGER,
  FS_BASE, FS_SM, FS_CONTENT_HEADING,
  SPACE_12, SPACE_16, SPACE_24, SPACE_32,
} from '../data/theme.js'

const COLUMN_WIDTH = 640

export default function AccountPage() {
  const { user, loading, signIn, signOut, linkProvider, unlinkProvider, refreshUser } = useAuth()
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

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
    return <div style={shell}><PageHeader crumbs={crumbs} /></div>
  }

  if (!user) {
    return (
      <div style={shell}>
        <PageHeader crumbs={crumbs} />
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

  async function handleDelete() {
    setConfirmingDelete(false)
    setError(null)
    setBusy(true)
    const { data, error: err } = await supabase.functions.invoke('delete-account')
    if (err || data?.error) {
      setError(data?.error ?? err.message)
      setBusy(false)
      return
    }
    await signOut()
    window.location.hash = '#/'
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

  return (
    <div style={shell}>
      <PageHeader crumbs={crumbs} />
      <div style={scroll}>
        <div style={column}>

          <section>
            <SectionHeader title="Profile" />
            <DataList columns={profileColumns} rows={profileRows} maxWidth={COLUMN_WIDTH} />
          </section>

          <section>
            <SectionHeader title="Linked accounts" />
            <DataList columns={accountColumns} rows={accountRows} maxWidth={COLUMN_WIDTH} />
            <div style={{ color: TEXT_MUTED, fontSize: FS_SM, marginTop: SPACE_12, lineHeight: 1.5 }}>
              Linking a second account lets you sign in either way. You can&rsquo;t remove your only sign-in method.
            </div>
          </section>

          <section>
            <SectionHeader title="Session" />
            <Button variant="neutral" onClick={signOut}>Sign out</Button>
          </section>

          <section>
            <SectionHeader title="Danger zone" />
            <div style={{ color: TEXT_MUTED, fontSize: FS_SM, marginBottom: SPACE_12, lineHeight: 1.5 }}>
              Deleting your account permanently removes your review progress, decks, and any
              stories you generated. This cannot be undone.
            </div>
            <Button variant="danger-outline" disabled={busy} onClick={() => setConfirmingDelete(true)}>
              Delete account
            </Button>
          </section>

          {error && (
            <div style={{ color: DANGER, fontSize: FS_BASE, lineHeight: 1.5 }}>{error}</div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete account?"
        message="This permanently deletes your review progress, decks, and generated stories. Your published stories will disappear for everyone. This cannot be undone."
        confirmLabel="Delete account"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}

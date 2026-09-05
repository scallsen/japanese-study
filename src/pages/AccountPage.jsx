import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import Button from '../components/Button.jsx'
import Card from '../components/Card.jsx'
import DataList from '../components/DataList.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { AUTH_PROVIDERS, providerLabel } from '../data/authProviders.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, DANGER,
  FS_BASE, FS_SM, FS_CONTENT_HEADING,
  SPACE_4, SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32,
} from '../data/theme.js'

function Field({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_4 }}>
      <span style={{ color: TEXT_MUTED, fontSize: FS_SM }}>{label}</span>
      <span style={{ fontSize: FS_BASE }}>{value}</span>
    </div>
  )
}

export default function AccountPage() {
  const { user, loading, signIn, signOut, linkProvider, unlinkProvider, refreshUser } = useAuth()
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const shell = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: FONT,
    letterSpacing: TRACKING,
    color: TEXT,
  }

  const crumbs = [{ label: 'Japanese Study', href: '#/' }, { label: 'Account' }]

  if (loading) {
    return (
      <div style={shell}>
        <PageHeader crumbs={crumbs} />
      </div>
    )
  }

  if (!user) {
    return (
      <div style={shell}>
        <PageHeader crumbs={crumbs} />
        <div style={{ flex: 1, overflowY: 'auto', padding: SPACE_24, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: SPACE_16 }}>
          <div style={{ fontSize: FS_CONTENT_HEADING }}>Sign in to manage your account</div>
          <Button size="lg" onClick={signIn}>Sign in</Button>
        </div>
      </div>
    )
  }

  const identities = user.identities ?? []
  const linked = new Set(identities.map(i => i.provider))
  const unlinkable = AUTH_PROVIDERS.filter(p => !linked.has(p.id))
  // Supabase refuses to remove the last identity, which would leave the
  // account with no way back in. Reflect that in the UI rather than letting
  // the request fail.
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

  const columns = [
    { key: 'provider', width: 110, render: row => providerLabel(row.provider) },
    { key: 'email', flex: 1, tone: 'muted', wrap: true, render: row => row.identity_data?.email ?? '' },
    {
      key: 'action',
      width: 90,
      align: 'right',
      render: row => (
        <Button variant="ghost-muted" size="sm" disabled={!canUnlink || busy} onClick={() => handleUnlink(row)}>
          Unlink
        </Button>
      ),
    },
  ]

  const meta = user.user_metadata ?? {}

  return (
    <div style={shell}>
      <PageHeader crumbs={crumbs} />
      <div style={{ flex: 1, overflowY: 'auto', padding: SPACE_24 }}>
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: SPACE_32 }}>

          <section>
            <SectionHeader title="Profile" />
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_16 }}>
                <Field label="Email" value={user.email ?? 'Not set'} />
                <Field label="Display name" value={meta.full_name || meta.user_name || 'Not set'} />
                <Field label="Member since" value={new Date(user.created_at).toLocaleDateString()} />
              </div>
            </Card>
          </section>

          <section>
            <SectionHeader title="Linked accounts" />
            <DataList
              columns={columns}
              rows={identities}
              rowKey={row => row.identity_id ?? row.provider}
              emptyMessage="No linked accounts."
            />
            {unlinkable.length > 0 && (
              <div style={{ display: 'flex', gap: SPACE_8, marginTop: SPACE_12, flexWrap: 'wrap' }}>
                {unlinkable.map(p => (
                  <Button key={p.id} variant="neutral" size="sm" disabled={busy} onClick={() => handleLink(p.id)}>
                    Link {p.label}
                  </Button>
                ))}
              </div>
            )}
            <div style={{ color: TEXT_MUTED, fontSize: FS_SM, marginTop: SPACE_12, lineHeight: 1.5 }}>
              Linking a second account lets you sign in either way. You can&rsquo;t remove your only sign-in method.
            </div>
          </section>

          <section>
            <SectionHeader title="Session" />
            <Button variant="danger-outline" onClick={signOut}>Sign out</Button>
          </section>

          {error && (
            <div style={{ color: DANGER, fontSize: FS_SM, lineHeight: 1.5 }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  )
}

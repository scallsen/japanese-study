import { Handle, Position } from '@xyflow/react'
import { FONT, TRACKING, TEXT_MUTED, FS_CAPTION } from '../../data/theme.js'

const ACCENT = '#8B7CF8'

export default function GrammarGroupNode({ data }) {
  const { label, count, isGateway } = data
  return (
    <div style={{
      width: '100%', height: '100%',
      border: isGateway ? `1px solid ${ACCENT}44` : '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      background: isGateway ? `${ACCENT}08` : 'rgba(255,255,255,0.02)',
      fontFamily: FONT,
      letterSpacing: TRACKING,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#444', border: 'none', width: 7, height: 7, top: 18 }} />
      <div style={{
        fontSize: FS_CAPTION,
        color: TEXT_MUTED,
        padding: '7px 10px 0',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        opacity: 0.6,
        pointerEvents: 'none',
      }}>
        {label}{count != null ? ` · ${count}` : ''}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#444', border: 'none', width: 7, height: 7, top: 18 }} />
    </div>
  )
}

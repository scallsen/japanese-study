import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { FONT, TRACKING, TEXT, TEXT_MUTED } from '../../data/theme.js'

export default function GrammarNode({ data }) {
  const { label, sublabel, isUnlocked, isKnown, isSelected, onToggle, accent } = data
  const [isHovered, setIsHovered] = useState(false)
  const [isBtnHovered, setIsBtnHovered] = useState(false)

  const bg = isKnown
    ? isHovered ? `${accent}33` : `${accent}22`
    : isUnlocked
    ? isHovered ? '#303030' : '#2A2A2A'
    : isHovered ? '#222222' : '#1C1C1C'

  const border = isSelected
    ? `2px solid ${accent}`
    : isKnown
    ? `1.5px solid ${accent}88`
    : isUnlocked
    ? isHovered ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.1)'
    : '1px solid #252525'

  const labelColor = isUnlocked ? TEXT : '#3A3A3A'
  const sublabelColor = isUnlocked ? TEXT_MUTED : '#2E2E2E'

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: bg,
        border,
        borderRadius: 8,
        padding: '10px 12px',
        width: 178,
        fontFamily: FONT,
        letterSpacing: TRACKING,
        userSelect: 'none',
        cursor: 'pointer',
        transition: 'background 100ms, border-color 100ms',
        boxShadow: isSelected ? `0 0 0 2px ${accent}30` : 'none',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#444', border: 'none', width: 7, height: 7 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
        {!isUnlocked && <span style={{ fontSize: 11, color: '#3A3A3A', flexShrink: 0 }}>▪</span>}
        {isKnown && <span style={{ fontSize: 11, color: accent, flexShrink: 0 }}>✓</span>}
        <span style={{ fontSize: 13, color: labelColor, lineHeight: 1.3 }}>{label}</span>
      </div>

      <div style={{ fontSize: 11, color: sublabelColor, marginBottom: isUnlocked ? 8 : 0 }}>
        {sublabel}
      </div>

      {isUnlocked && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          onMouseEnter={(e) => { e.stopPropagation(); setIsBtnHovered(true) }}
          onMouseLeave={(e) => { e.stopPropagation(); setIsBtnHovered(false) }}
          style={{
            background: isKnown
              ? isBtnHovered ? `${accent}45` : `${accent}30`
              : isBtnHovered ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: `1px solid ${isKnown ? `${accent}88` : isBtnHovered ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 4,
            color: isKnown ? accent : isBtnHovered ? TEXT : TEXT_MUTED,
            fontSize: 11,
            padding: '3px 0',
            cursor: 'pointer',
            pointerEvents: 'all',
            fontFamily: FONT,
            letterSpacing: TRACKING,
            width: '100%',
            transition: 'all 120ms',
          }}
        >
          {isKnown ? 'Known' : 'Mark as known'}
        </button>
      )}

      <Handle type="source" position={Position.Right} style={{ background: '#444', border: 'none', width: 7, height: 7 }} />
    </div>
  )
}

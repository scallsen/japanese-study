import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { FONT, TRACKING, TEXT, TEXT_MUTED } from '../../data/theme.js'

export default function GrammarNode({ data }) {
  const { label, sublabel, isUnlocked, isKnown, isSelected, onToggle, accent, hideHandles, category } = data

  const BADGE = category === 'Particle'
    ? { label: 'particle', color: '#7BBAD6', bg: '#1C3545' }
    : category === 'Connector'
    ? { label: 'connector', color: '#D4A970', bg: '#3A2C14' }
    : category === 'Form'
    ? { label: 'form', color: '#7BC4A0', bg: '#1A3226' }
    : null
  const [isHovered, setIsHovered] = useState(false)
  const [isCheckHovered, setIsCheckHovered] = useState(false)

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
  const showCheck = (isUnlocked || isKnown) && (isHovered || isKnown)

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: bg,
        border,
        borderRadius: 8,
        padding: '10px 12px',
        width: 190,
        height: 96,
        overflow: 'hidden',
        boxSizing: 'border-box',
        fontFamily: FONT,
        letterSpacing: TRACKING,
        userSelect: 'none',
        cursor: 'pointer',
        transition: 'background 100ms, border-color 100ms',
        boxShadow: isSelected ? `0 0 0 2px ${accent}30` : 'none',
      }}
    >
      {!hideHandles && <Handle type="target" position={Position.Left} style={{ background: '#444', border: 'none', width: 7, height: 7 }} />}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          {!isUnlocked && <span style={{ fontSize: 11, color: '#3A3A3A', flexShrink: 0 }}>▪</span>}
          <span style={{ fontSize: 13, color: labelColor, lineHeight: 1.3 }}>{label}</span>
        </div>
        <span
          onClick={(e) => { if (!showCheck) return; e.stopPropagation(); onToggle() }}
          onMouseEnter={(e) => { e.stopPropagation(); setIsCheckHovered(true) }}
          onMouseLeave={(e) => { e.stopPropagation(); setIsCheckHovered(false) }}
          style={{
            fontSize: 11,
            color: showCheck ? (isKnown ? accent : isCheckHovered ? TEXT : TEXT_MUTED) : 'transparent',
            flexShrink: 0,
            lineHeight: 1,
            pointerEvents: showCheck ? 'all' : 'none',
            width: 20,
            height: 20,
            borderRadius: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: showCheck
              ? isKnown
                ? isCheckHovered ? `${accent}44` : `${accent}28`
                : isCheckHovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'
              : 'transparent',
            transition: 'background 100ms, color 100ms',
          }}
        >✓</span>
      </div>

      <div style={{
        fontSize: 11, color: sublabelColor,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {sublabel}
      </div>

      {isUnlocked && BADGE && (
        <div style={{
          display: 'inline-block',
          marginTop: 6,
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: 9,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: BADGE.color,
          background: BADGE.bg,
        }}>
          {BADGE.label}
        </div>
      )}

      {!hideHandles && <Handle type="source" position={Position.Right} style={{ background: '#444', border: 'none', width: 7, height: 7 }} />}
    </div>
  )
}

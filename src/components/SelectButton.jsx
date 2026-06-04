import { useState } from 'react'

export default function SelectButton({ selected, bgColor = '#DDDDDD', dotColor, subtext, onClick, children, centered, minHeight, horizontal, fontSize = 13 }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: selected ? bgColor : hovered ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: selected ? 'rgba(0,0,0,0.85)' : hovered ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.5)',
        boxShadow: selected && hovered ? 'inset 0 0 0 100px rgba(0,0,0,0.10)' : 'none',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 6,
        padding: horizontal ? '10px 12px' : '7px 12px',
        paddingRight: dotColor && selected ? 28 : undefined,
        fontSize,
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'background 130ms, color 130ms',
        width: '100%',
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        alignItems: horizontal ? 'center' : (centered ? 'center' : 'flex-start'),
        justifyContent: horizontal ? 'space-between' : 'center',
        gap: horizontal ? 8 : 2,
        minHeight: minHeight ?? undefined,
      }}
    >
      {children}
      {subtext && (
        <span style={{ color: selected ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.55)', fontSize, flexShrink: horizontal ? 0 : undefined }}>
          {subtext}
        </span>
      )}
      {dotColor && selected && (
        <span style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          pointerEvents: 'none',
        }} />
      )}
    </button>
  )
}

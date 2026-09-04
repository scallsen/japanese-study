import { useRef } from 'react'
import Button from './Button.jsx'

// A Button that opens a file picker. VocabSrsModule's FileInput and
// WordImportPanel's FileTrigger were the same label-wrapping-a-hidden-input
// with a hand-styled neutral face; this keeps the hidden input and lets the
// visible part be the real Button. `capture` passes through for the mobile
// "Take photo" case. The input's value is reset after each pick so choosing
// the same file twice in a row still fires onChange.
export default function FileButton({ accept, capture, onFile, variant = 'neutral', size = 'md', disabled = false, children }) {
  const inputRef = useRef(null)
  return (
    <>
      <Button variant={variant} size={size} disabled={disabled} onClick={() => inputRef.current?.click()}>
        {children}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </>
  )
}

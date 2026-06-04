import './FlipCard.css';

export default function FlipCard({
  front,
  back,
  width = '320px',
  height = '180px',
  className = '',
  flipped = false,
  onFlip,
  animate = true,
  overlay = null,
  focusHint = '↵ Flip card',
  onFocusActivate = null,
}) {
  function handleClick() {
    onFlip?.(!flipped);
  }

  function handleKeyDown(e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (onFocusActivate) onFocusActivate();
      else handleClick();
    }
  }

  return (
    <div className={`fc-wrapper ${className}`} style={{ width, height }}>
      <div className="fc-shadow" />
      <div className="fc-container">
        <div className="fc-hover" tabIndex={0} onClick={handleClick} onKeyDown={handleKeyDown}>
          <div className={`fc-inner ${flipped ? 'fc-inner--flipped' : ''}`} style={animate ? undefined : { transition: 'none' }}>
            <div className="fc-face fc-face--front">{front}</div>
            <div className="fc-face fc-face--back">{back}</div>
          </div>
          <div className="fc-focus-hint">{focusHint}</div>
        </div>
      </div>
      {overlay}
    </div>
  );
}

export default function SpeakerIcon({ muted = false, size = 20, style }) {
  if (muted) {
    return (
      <svg width={size} height={size} viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
        <path d="M19 7H22V10H19V7Z" fill="currentColor"/>
        <path d="M19 10H22V13H19V10Z" fill="currentColor"/>
        <path d="M19 28H22V31H19V28Z" fill="currentColor"/>
        <path d="M19 31H22V34H19V31Z" fill="currentColor"/>
        <path d="M28 28H31V31H28V28Z" fill="currentColor"/>
        <path d="M7 7H10V10H7V7Z" fill="currentColor"/>
        <path d="M10 10H13V13H10V10Z" fill="currentColor"/>
        <path d="M16 16H19V19H16V16Z" fill="currentColor"/>
        <path d="M19 19H22V22H19V19Z" fill="currentColor"/>
        <path d="M22 22H25V25H22V22Z" fill="currentColor"/>
        <path d="M25 25H28V28H25V25Z" fill="currentColor"/>
        <path d="M31 31H34V34H31V31Z" fill="currentColor"/>
        <path d="M19 28H16V31H19V28Z" fill="currentColor"/>
        <path d="M13 22H10V25H13V22Z" fill="currentColor"/>
        <path d="M16 13H13V16H16V13Z" fill="currentColor"/>
        <path d="M16 25H13V28H16V25Z" fill="currentColor"/>
        <path d="M10 16H7V25H10V16Z" fill="currentColor"/>
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
      <path d="M19 7H22V34H19V7Z" fill="currentColor"/>
      <path d="M28 19H31V22H28V19Z" fill="currentColor"/>
      <path d="M25 16H28V19H25V16Z" fill="currentColor"/>
      <path d="M28 10H31V13H28V10Z" fill="currentColor"/>
      <path d="M34 16H37V25H34V16Z" fill="currentColor"/>
      <path d="M31 25H34V28H31V25Z" fill="currentColor"/>
      <path d="M28 28H31V31H28V28Z" fill="currentColor"/>
      <path d="M31 13H34V16H31V13Z" fill="currentColor"/>
      <path d="M25 22H28V25H25V22Z" fill="currentColor"/>
      <path d="M19 28H16V31H19V28Z" fill="currentColor"/>
      <path d="M13 22H10V25H13V22Z" fill="currentColor"/>
      <path d="M13 16H10V19H13V16Z" fill="currentColor"/>
      <path d="M16 13H13V16H16V13Z" fill="currentColor"/>
      <path d="M19 10H16V13H19V10Z" fill="currentColor"/>
      <path d="M16 25H13V28H16V25Z" fill="currentColor"/>
      <path d="M10 16H7V25H10V16Z" fill="currentColor"/>
    </svg>
  )
}

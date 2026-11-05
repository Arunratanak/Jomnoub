// The Jomnoub mark: a green rounded square with a check
// (inverse: white square with a green check, for use on green backgrounds)
export function LogoMark({ size = 28, inverse = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill={inverse ? '#fff' : '#188038'} />
      <path d="M9 16.5l5 5L23.5 11" fill="none" stroke={inverse ? '#188038' : '#fff'} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo() {
  return (
    <>
      <LogoMark />
      <span className="logo-text">Jomnoub</span>
    </>
  );
}

// The Jomnoub app icon (inverse: with a light ring, for use on green backgrounds)
export function LogoMark({ size = 28, inverse = false }) {
  return (
    <img
      className={`logo-mark${inverse ? ' logo-mark-inverse' : ''}`}
      src={size > 48 ? '/icon-192.png' : '/favicon-48.png'}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
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

export function Logo({ size = 32 }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }} aria-hidden="true">
      <img src="/qdet-logo.png" alt="" />
    </span>
  );
}

/** Nút bấm dùng chung — §0.4 spec. variant: primary | secondary | text */
export default function Button({
  variant = 'primary',
  size,
  children,
  onClick,
  disabled,
  type = 'button',
  className = '',
  ariaLabel,
}) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

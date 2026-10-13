import { createPortal } from 'react-dom'

export default function ModalBackdrop({ children, className = '', ...props }) {
  const classes = [...new Set(['modal-backdrop', ...className.split(/\s+/).filter(Boolean)])].join(' ')
  return createPortal(
    <div className={classes} {...props}>{children}</div>,
    document.body
  )
}

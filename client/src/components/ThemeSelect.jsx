import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

export default function ThemeSelect({ value, onChange, children, className = "", style = {} }) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, openUpward: false })
  const buttonRef = useRef(null)
  const menuRef = useRef(null)

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const openUpward = spaceBelow < 220 && rect.top > 220
      setCoords({
        top: openUpward ? rect.top - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        openUpward
      })
    }
  }

  useEffect(() => {
    if (isOpen) {
      updateCoords()
      window.addEventListener('resize', updateCoords)
      window.addEventListener('scroll', updateCoords, true)
      return () => {
        window.removeEventListener('resize', updateCoords)
        window.removeEventListener('scroll', updateCoords, true)
      }
    }
  }, [isOpen])

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Parse children to extract options
  const options = React.Children.toArray(children)
    .filter(child => child && child.type === 'option')
    .map(child => ({
      value: child.props.value !== undefined ? child.props.value : child.props.children,
      label: child.props.children
    }))

  const selectedOption = options.find(o => String(o.value) === String(value)) || options[0]

  const handleSelect = (optValue) => {
    setIsOpen(false)
    if (onChange) {
      onChange({
        target: {
          value: optValue
        }
      })
    }
  }

  // Separate layout styles for container, and visual styles for button
  const {
    flex,
    flexGrow,
    flexShrink,
    flexBasis,
    gridArea,
    alignSelf,
    justifySelf,
    width,
    minWidth,
    maxWidth,
    margin,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    ...buttonStyle
  } = style;

  return (
    <div
      style={{
        width: width || (flex || flexGrow ? undefined : '100%'),
        display: style.display || 'inline-block',
        flex,
        flexGrow,
        flexShrink,
        flexBasis,
        gridArea,
        alignSelf,
        justifySelf,
        minWidth,
        maxWidth,
        margin,
        marginLeft,
        marginRight,
        marginTop,
        marginBottom
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`input-field ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          cursor: 'pointer',
          textAlign: 'left',
          paddingLeft: '12px',
          paddingRight: '28px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-primary)',
          borderRadius: '10px',
          width: '100%',
          height: '40px',
          fontSize: '14px',
          outline: 'none',
          position: 'relative',
          ...buttonStyle,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : 'Select option'}
        </span>
        <ChevronDown 
          size={13} 
          style={{ 
            color: 'currentColor', 
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            position: 'absolute',
            right: '8px',
            top: '50%',
            marginTop: '-6px',
            pointerEvents: 'none'
          }} 
        />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="animate-fade-in"
          style={{
            position: 'fixed',
            top: coords.openUpward ? 'auto' : `${coords.top}px`,
            bottom: coords.openUpward ? `${window.innerHeight - coords.top}px` : 'auto',
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            minWidth: '130px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 9999,
            maxHeight: '220px',
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {options.map((opt, index) => {
            const isSelected = String(opt.value) === String(value)
            return (
              <button
                key={`${opt.value}-${index}`}
                type="button"
                onClick={() => handleSelect(opt.value)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  background: isSelected ? 'var(--accent-primary)' : 'transparent',
                  color: isSelected ? '#ffffff' : 'var(--text-primary)',
                  border: 'none',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                  display: 'block',
                  fontWeight: isSelected ? 600 : 400
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.target.style.background = 'var(--bg-secondary)'
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.target.style.background = 'transparent'
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { localDateString } from '../utils/date'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function ThemeDatePicker({
  value = '',
  onChange,
  placeholder = 'Select date',
  min,
  max,
  style = {},
  className = 'input-field'
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, openUpward: false })
  const inputRef = useRef(null)
  const portalRef = useRef(null)
  const isDateAllowed = (date) => (!min || date >= min) && (!max || date <= max)

  // Parse current selected date or fallback to today
  const selectedDate = value ? new Date(value + 'T00:00:00') : null
  const [viewDate, setViewDate] = useState(() => selectedDate || new Date())

  // Update view date when value changes externally
  useEffect(() => {
    if (value) {
      const parsed = new Date(value + 'T00:00:00')
      if (!isNaN(parsed.getTime())) {
        setViewDate(parsed)
      }
    }
  }, [value])

  const updatePosition = () => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    const calendarHeight = 310
    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < calendarHeight && rect.top > calendarHeight

    setCoords({
      top: openUpward ? rect.top - calendarHeight - 6 : rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - 300),
      openUpward
    })
  }

  useEffect(() => {
    if (isOpen) {
      updatePosition()
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
      return () => {
        window.removeEventListener('resize', updatePosition)
        window.removeEventListener('scroll', updatePosition, true)
      }
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target) &&
        portalRef.current && !portalRef.current.contains(e.target)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleSelectDay = (day) => {
    const year = viewDate.getFullYear()
    const month = String(viewDate.getMonth() + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    const formatted = `${year}-${month}-${dayStr}`
    if (!isDateAllowed(formatted)) return
    
    if (onChange) {
      onChange({ target: { value: formatted, name: inputRef.current?.name } })
    }
    setIsOpen(false)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    if (onChange) {
      onChange({ target: { value: '', name: inputRef.current?.name } })
    }
    setIsOpen(false)
  }

  const handleSelectToday = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const dayStr = String(today.getDate()).padStart(2, '0')
    const formatted = `${year}-${month}-${dayStr}`
    if (!isDateAllowed(formatted)) return
    setViewDate(today)
    if (onChange) {
      onChange({ target: { value: formatted, name: inputRef.current?.name } })
    }
    setIsOpen(false)
  }

  const changeMonth = (delta) => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  const changeYear = (e) => {
    const newYear = parseInt(e.target.value, 10)
    setViewDate(prev => new Date(newYear, prev.getMonth(), 1))
  }

  // Format display string DD-MM-YYYY
  const displayValue = selectedDate && !isNaN(selectedDate.getTime())
    ? `${String(selectedDate.getDate()).padStart(2, '0')}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${selectedDate.getFullYear()}`
    : ''

  // Calendar calculations
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const today = new Date()
  const isCurrentMonthToday = today.getFullYear() === year && today.getMonth() === month

  // Build grid days
  const gridCells = []
  // Prev month padding
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    gridCells.push({ day: daysInPrevMonth - i, isCurrentMonth: false })
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const formatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const isSelected = selectedDate && selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === d
    const isToday = isCurrentMonthToday && today.getDate() === d
    gridCells.push({ day: d, isCurrentMonth: true, isSelected, isToday, isDisabled: !isDateAllowed(formatted) })
  }
  // Next month padding
  const remaining = 42 - gridCells.length
  for (let i = 1; i <= remaining; i++) {
    gridCells.push({ day: i, isCurrentMonth: false })
  }

  // Years option list (current year +- 10)
  const currentYr = new Date().getFullYear()
  const years = Array.from({ length: 21 }, (_, index) => currentYr - 10 + index)

  return (
    <div ref={inputRef} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <div
        onClick={() => setIsOpen(open => !open)}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
          padding: '9px 12px',
          ...style
        }}
      >
        <span style={{ color: displayValue ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 13, fontWeight: displayValue ? 600 : 400 }}>
          {displayValue || placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {displayValue && (
            <span onClick={handleClear} style={{ color: '#94a3b8', cursor: 'pointer', padding: 2 }} title="Clear date">
              <X size={14} />
            </span>
          )}
          <CalendarIcon size={15} style={{ color: '#6366f1' }} />
        </div>
      </div>

      {isOpen && createPortal(
        <div
          ref={portalRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: 280,
            background: '#ffffff',
            border: '1px solid rgba(15, 23, 42, 0.15)',
            borderRadius: 14,
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.15), 0 2px 6px rgba(0, 0, 0, 0.05)',
            zIndex: 99999,
            padding: 14,
            fontFamily: "'Inter', sans-serif",
            animation: 'fadeIn 0.15s ease'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
            >
              <ChevronLeft size={16} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                {MONTH_NAMES[month]}
              </span>
              <select
                value={year}
                onChange={changeYear}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: 6,
                  padding: '2px 4px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 6 }}>
            {DAY_NAMES.map(day => (
              <span key={day} style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
                {day}
              </span>
            ))}
          </div>

          {/* Day Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, textAlign: 'center' }}>
            {gridCells.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return (
                  <span key={idx} style={{ padding: '6px 0', fontSize: 12, color: '#cbd5e1', userSelect: 'none' }}>
                    {cell.day}
                  </span>
                )
              }
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={cell.isDisabled}
                  onClick={() => handleSelectDay(cell.day)}
                  style={{
                    padding: '6px 0',
                    fontSize: 12,
                    fontWeight: cell.isSelected || cell.isToday ? 700 : 500,
                    border: cell.isToday && !cell.isSelected ? '1px solid #6366f1' : 'none',
                    borderRadius: 8,
                    background: cell.isSelected ? '#6366f1' : 'transparent',
                    color: cell.isDisabled ? '#cbd5e1' : cell.isSelected ? '#ffffff' : cell.isToday ? '#6366f1' : '#0f172a',
                    cursor: cell.isDisabled ? 'not-allowed' : 'pointer',
                    opacity: cell.isDisabled ? 0.55 : 1,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    if (!cell.isSelected && !cell.isDisabled) e.currentTarget.style.background = '#f1f5f9'
                  }}
                  onMouseLeave={e => {
                    if (!cell.isSelected && !cell.isDisabled) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>

          {/* Action Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              onClick={handleClear}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleSelectToday}
              disabled={!isDateAllowed(localDateString())}
              style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Today
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

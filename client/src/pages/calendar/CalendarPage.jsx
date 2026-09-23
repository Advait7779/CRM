import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import toast from 'react-hot-toast'
import { apiGet } from '../../utils/api'
import { Wrench, CheckSquare, RefreshCw, Calendar as CalendarIcon, Filter } from 'lucide-react'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const localizer = momentLocalizer(moment)

export default function CalendarPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [activeFilter, setActiveFilter] = useState('all')

  useEffect(() => {
    apiGet('/calendar/events')
      .then(rows => setEvents(rows.map(item => ({
        ...item,
        start: new Date(`${String(item.start).slice(0, 10)}T09:00:00`),
        end: new Date(`${String(item.end).slice(0, 10)}T10:00:00`)
      }))))
      .catch(error => toast.error(`Failed to load calendar: ${error.message}`))
  }, [])

  const counts = useMemo(() => {
    const res = { all: events.length, install: 0, task: 0, renewal: 0 }
    for (const e of events) {
      if (res[e.type] !== undefined) res[e.type]++
    }
    return res
  }, [events])

  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') return events
    return events.filter(e => e.type === activeFilter)
  }, [events, activeFilter])

  const eventStyleGetter = event => {
    const isRenewal = event.type === 'renewal'
    const isInstall = event.type === 'install'
    const bg = isRenewal ? '#f59e0b' : isInstall ? '#10b981' : '#6366f1'

    return {
      style: {
        backgroundColor: bg,
        borderRadius: 6,
        color: 'white',
        border: 'none',
        fontSize: 12,
        fontWeight: 600,
        padding: '3px 8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Operational Calendar & Schedule</h1>
          <p className="page-subtitle">Track field installations, customer service renewals, and team tasks in one unified view.</p>
        </div>
      </div>

      {/* Top Stat Overview */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
        <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
            <CalendarIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{counts.all}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Scheduled</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <Wrench size={20} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{counts.install}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Field Installations</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
            <CheckSquare size={20} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{counts.task}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Assigned Tasks</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
            <RefreshCw size={20} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{counts.renewal}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Service Renewals</div>
          </div>
        </div>
      </div>

      {/* Filter and Legend Bar */}
      <div className="glass-card" style={{ padding: '10px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginRight: 4 }}>Filter:</span>
          {[
            { key: 'all', label: `All (${counts.all})` },
            { key: 'install', label: `Installations (${counts.install})`, color: '#10b981' },
            { key: 'task', label: `Tasks (${counts.task})`, color: '#6366f1' },
            { key: 'renewal', label: `Renewals (${counts.renewal})`, color: '#f59e0b' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: activeFilter === f.key ? 700 : 500,
                cursor: 'pointer',
                border: activeFilter === f.key ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                backgroundColor: activeFilter === f.key ? 'var(--primary-color)' : 'var(--bg-secondary)',
                color: activeFilter === f.key ? '#ffffff' : 'var(--text-primary)',
                transition: 'all 0.15s ease'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Color Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#10b981' }} />
            <span>Installation</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#6366f1' }} />
            <span>Task</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            <span>Renewal</span>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 20, height: '70vh' }}>
        <Calendar
          localizer={localizer}
          events={filteredEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%', color: 'var(--text-primary)' }}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={event => {
            if (event.path) {
              toast.success(`Opening ${event.title}`)
              navigate(event.path)
            }
          }}
        />
      </div>
      <style>{`
        .rbc-calendar { background: transparent; }
        .rbc-header { border-bottom: 1px solid var(--border-subtle) !important; padding: 10px 0 !important; font-weight: 700; color: #4f46e5; font-size: 13px; }
        .rbc-month-view { border: 1px solid var(--border-color) !important; border-radius: 12px; overflow: hidden; }
        .rbc-day-bg { border-right: 1px solid var(--border-subtle) !important; border-bottom: 1px solid var(--border-subtle) !important; }
        .rbc-off-range-bg { background: var(--bg-secondary) !important; opacity: 0.6; }
        .rbc-today { background: rgba(99,102,241,0.08) !important; }
        .rbc-month-row { border-bottom: 1px solid var(--border-subtle) !important; }
        .rbc-btn-group button { background: var(--bg-secondary) !important; border: 1px solid var(--border-color) !important; color: var(--text-secondary) !important; padding: 6px 14px; font-weight: 600; font-size: 13px; border-radius: 8px; }
        .rbc-btn-group button.rbc-active { background: rgba(99,102,241,0.15) !important; color: #4f46e5 !important; font-weight: 700 !important; border-color: #6366f1 !important; }
        .rbc-toolbar-label { color: var(--text-primary); font-weight: 800; font-size: 16px; }
      `}</style>
    </div>
  )
}

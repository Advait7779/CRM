import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { Bell, Search, LogOut, Settings, User, CheckCheck, Calendar, Menu } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiGet } from '../utils/api'

const notifIcons = { lead: '🎯', renewal: '🔄', ticket: '🎫', payment: '💰', install: '🔧' }

export default function Topbar({ setMobileOpen, onLogoutClick }) {
  const { user } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const navigate = useNavigate()
  const location = useLocation()
  const showSearch = ['/leads', '/customers', '/quotations', '/installations', '/accounts', '/renewals', '/tickets', '/inventory', '/employees', '/users', '/tasks', '/my-work', '/hrms'].some(p => location.pathname.startsWith(p))
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const notifRef  = useRef(null)
  const profileRef = useRef(null)

  const formattedDate = (() => {
    const date = new Date()
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' })
    const day = date.getDate()
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    const year = date.getFullYear()
    return `${weekday}, ${day} ${month} ${year}`
  })()

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    const query = search.trim()
    if (query.length < 2) {
      setSearchResults([])
      return undefined
    }
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        setSearchResults(await apiGet(`/search?q=${encodeURIComponent(query)}`))
      } catch (error) {
        toast.error(error.message)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  return (
    <header className="app-topbar">
      {/* Mobile Hamburger Button */}
      <button
        type="button"
        onClick={() => setMobileOpen && setMobileOpen(o => !o)}
        className="mobile-hamburger-btn"
        title="Open Menu"
      >
        <Menu size={20} />
      </button>

      {/* Dashboard Welcome Header */}
      {location.pathname === '/' && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
            letterSpacing: '-0.01em'
          }}>
            Welcome Back, {user?.name?.split(' ')[0] || 'Super'} 👋
          </span>
        </div>
      )}

      {/* Search — only on data pages */}
      {showSearch && (
      <div className="topbar-search" style={{ flex: 1, maxWidth: 360, position: 'relative', display: 'flex', gap: 0 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search leads, customers, invoices..."
          className="input-field"
          style={{ height: 38, fontSize: 13, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none' }}
        />
        <button
          type="button"
          style={{
            height: 38, width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#6366f1', border: 'none', borderRadius: '0 10px 10px 0',
            cursor: 'pointer', flexShrink: 0, color: 'white',
          }}
        >
          <Search size={15} />
        </button>
        {search.trim().length >= 2 && (
          <div style={{
            position: 'absolute', top: 44, left: 0, right: 0, zIndex: 250,
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.28)',
            maxHeight: 360, overflowY: 'auto'
          }}>
            {searching && <div style={{ padding: 14, color: 'var(--text-secondary)', fontSize: 13 }}>Searching...</div>}
            {!searching && searchResults.length === 0 && (
              <div style={{ padding: 14, color: 'var(--text-secondary)', fontSize: 13 }}>No matching records</div>
            )}
            {!searching && searchResults.map(result => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => {
                  navigate(result.path)
                  setSearch('')
                  setSearchResults([])
                }}
                style={{
                  width: '100%', padding: '11px 14px', display: 'flex', gap: 10,
                  textAlign: 'left', background: 'transparent', border: 'none',
                  borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', color: 'var(--text-primary)'
                }}
              >
                <span style={{ color: '#6366f1', fontSize: 11, fontWeight: 700, width: 58 }}>{result.type}</span>
                <span>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{result.title}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{result.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        {/* Current Date Display */}
        <div className="topbar-date" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          color: 'var(--text-primary)', 
          fontSize: 13, 
          fontWeight: 700, 
          marginRight: 12,
        }}>
          <Calendar size={16} style={{ color: '#0d9488' }} />
          <span>{formattedDate}</span>
        </div>

        {/* Notifications */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="topbar-icon-btn"
            style={{
              background: notifOpen ? 'var(--bg-secondary)' : 'transparent',
              position: 'relative',
            }}
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: 6,
                width: 8, height: 8, borderRadius: '50%',
                background: '#ef4444',
                border: '2px solid var(--bg-primary)',
              }} />
            )}
          </button>

          {notifOpen && (
            <div style={{
              position: 'absolute', top: 46, right: 0,
              width: 340, background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              zIndex: 200, overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</div>
                  {unreadCount > 0 && <div style={{ fontSize: 12, color: '#6366f1', marginTop: 2 }}>{unreadCount} unread</div>}
                </div>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} style={{ fontSize: 12, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    style={{
                      padding: '14px 18px',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      background: n.read ? 'transparent' : 'rgba(99,102,241,0.06)',
                      transition: 'background 0.2s',
                      display: 'flex', gap: 12,
                    }}
                  >
                    <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{notifIcons[n.type] || '🔔'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {n.title}
                        {!n.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setProfileOpen(o => !o)}
            style={{
              width: 38, height: 38,
              borderRadius: '50%',
              background: profileOpen ? 'var(--bg-secondary)' : 'transparent',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#6366f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: 'white',
              boxShadow: '0 4px 12px rgba(99,102,241,0.2)',
            }}>{user?.name?.charAt(0) || 'U'}</div>
          </button>

          {profileOpen && (
            <div style={{
              position: 'absolute', top: 50, right: 0,
              width: 200, background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              zIndex: 200, overflow: 'hidden', padding: 8,
            }}>
              {[
                { icon: User, label: 'My Profile', action: () => { navigate('/profile'); setProfileOpen(false); } },
                { icon: Settings, label: 'Settings', action: () => { navigate('/settings'); setProfileOpen(false); } },
              ].map(item => (
                <button key={item.label} onClick={item.action} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', background: 'none', border: 'none',
                  color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 8,
                  fontSize: 13, transition: 'all 0.2s',
                }}>
                  <item.icon size={15} /> {item.label}
                </button>
              ))}
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
              <button onClick={() => { onLogoutClick(); setProfileOpen(false); }} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', background: 'none', border: 'none',
                color: '#ef4444', cursor: 'pointer', borderRadius: 8, fontSize: 13,
              }}>
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

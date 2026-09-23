import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../utils/api'
import {
  LayoutDashboard, Users, UserCheck, FileText, Wrench, CreditCard,
  RefreshCw, HeadphonesIcon, Package, UserCog,
  CheckSquare, Calendar, ChevronDown, ChevronRight,
  Zap, Shield, X, MessageSquare, ClipboardCheck
} from 'lucide-react'

const NAV_ITEMS = [
  { path: '/',          icon: LayoutDashboard, label: 'Dashboard',      end: true, color: '#3b82f6' },
  { path: '/tasks',     icon: CheckSquare,     label: 'My Tasks',       color: '#10b981' },
  { path: '/my-work',   icon: ClipboardCheck,  label: 'My Work & HR',   color: '#6366f1' },
  { path: '/calendar',  icon: Calendar,        label: 'Calendar',       color: '#ef4444' },
  { path: '/chat',      icon: MessageSquare,   label: 'Chat',           color: '#10b981', isChat: true },
  { path: '/customers', icon: UserCheck,       label: 'Customers',      color: '#10b981' },
  { path: '/installations', icon: Wrench,          label: 'Installations',  color: '#8b5cf6' },
  { path: '/renewals',      icon: RefreshCw,       label: 'Renewals',       color: '#ec4899' },
  // {
  //   label: 'Finance', icon: CreditCard, color: '#f59e0b', children: [
  //     { path: '/accounts', icon: CreditCard, label: 'Accounts', color: '#fb923c' },
  //   ]
  // },
  { path: '/inventory',    icon: Package,         label: 'Inventory',      color: '#10b981' },
  { path: '/users',        icon: Shield,          label: 'System Users',   color: '#f97316' },
  {
    label: 'Management', icon: Shield, color: '#06b6d4', children: [
      { path: '/employees',  icon: UserCog,       label: 'Employees',      color: '#a78bfa' },
      { path: '/hrms',       icon: ClipboardCheck,label: 'HRMS',           color: '#06b6d4' },
    ]
  },
]

const PATH_ROLES = {
  '/customers': ['super_admin', 'director', 'sales_manager', 'sales_executive'],
  '/installations': ['super_admin', 'director', 'installation_manager', 'gps_installer', 'cctv_technician', 'website_developer'],
  '/renewals': ['super_admin', 'director', 'sales_manager', 'sales_executive', 'accounts'],
  '/tickets': ['super_admin', 'director', 'support_executive', 'installation_manager', 'gps_installer', 'cctv_technician'],
  '/accounts': ['super_admin', 'director', 'accounts'],
  '/inventory': ['super_admin', 'director', 'installation_manager', 'gps_installer', 'cctv_technician', 'website_developer'],
  '/employees': ['super_admin', 'director'],
  '/hrms': ['super_admin', 'director'],
  '/users': ['super_admin', 'director']
}

function NavItem({ item, isChild = false, onLinkClick, unreadChatCount = 0 }) {
  const location = useLocation()
  const [open, setOpen] = useState(() => {
    if (!item.children) return false
    return item.children.some(c => location.pathname.startsWith(c.path))
  })
  const Icon = item.icon

  if (item.children) {
    const isAnyActive = item.children.some(c => location.pathname.startsWith(c.path))
    return (
      <div style={{ marginBottom: '4px' }}>
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] font-semibold transition-all duration-200 group ${
            isAnyActive ? 'text-slate-100 bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
          style={{ cursor: 'pointer' }}
        >
          <Icon size={20} style={{ color: item.color }} />
          <span className="flex-1 text-left">{item.label}</span>
          {open ? <ChevronDown size={16} style={{ opacity: 0.7 }} /> : <ChevronRight size={16} style={{ opacity: 0.7 }} />}
        </button>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', paddingLeft: '20px' }}>
            {item.children.map(child => (
              <NavItem key={child.path} item={child} isChild={true} onLinkClick={onLinkClick} unreadChatCount={unreadChatCount} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={item.path}
      end={item.end}
      onClick={onLinkClick}
      className={({ isActive }) =>
        `flex items-center justify-between transition-all duration-200 group ${
          isChild 
            ? `gap-3 px-3 py-2 rounded-xl text-[13.5px] font-medium ${isActive ? 'nav-item-active' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}` 
            : `gap-3 px-3.5 py-2.5 rounded-xl text-[14px] font-semibold ${isActive ? 'nav-item-active' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`
        }`
      }
      style={{ marginBottom: '4px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Icon size={isChild ? 18 : 20} style={{ color: item.color }} />
        <span>{item.label}</span>
      </div>
      {item.isChat && unreadChatCount > 0 && (
        <span style={{
          background: '#10b981',
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: 700,
          padding: '2px 7px',
          borderRadius: '9999px',
          lineHeight: 1.2,
          boxShadow: '0 0 10px rgba(16,185,129,0.5)'
        }}>
          {unreadChatCount}
        </span>
      )}
    </NavLink>
  )
}

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const { user } = useAuth()
  const [unreadChatCount, setUnreadChatCount] = useState(0)

  useEffect(() => {
    let isMounted = true
    const fetchUnread = () => {
      apiGet('/chat/unread-count')
        .then(data => {
          if (isMounted && data?.unreadCount !== undefined) {
            setUnreadChatCount(data.unreadCount)
          }
        })
        .catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 5000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  const canView = (path) => !PATH_ROLES[path] || PATH_ROLES[path].includes(user?.role)
  const visibleItems = NAV_ITEMS
    .map(item => item.children ? { ...item, children: item.children.filter(child => canView(child.path)) } : item)
    .filter(item => item.children ? item.children.length > 0 : canView(item.path))

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      <div
        onClick={() => setMobileOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 7, 18, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 998,
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? 'auto' : 'none',
          visibility: mobileOpen ? 'visible' : 'hidden',
          transition: 'opacity 0.35s ease, visibility 0.35s ease',
        }}
      />

      <aside
        className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: '260px',
          minHeight: '100vh',
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          zIndex: 999,
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/logo.png"
              alt="Logo"
              style={{
                width: 36, height: 36, borderRadius: 10,
                objectFit: 'cover', flexShrink: 0
              }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>CRM-KGSOFTWARE</div>
              <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 600, letterSpacing: '0.05em' }}>MANAGEMENT SUITE</div>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setMobileOpen && setMobileOpen(false)}
            title="Close Menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {visibleItems.map((item, i) => (
            <NavItem 
              key={item.path || item.label + i} 
              item={item} 
              onLinkClick={() => setMobileOpen && setMobileOpen(false)} 
              unreadChatCount={unreadChatCount}
            />
          ))}
        </nav>

        {/* User info at bottom */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#6366f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0
            }}>
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'User'}</div>
              <div style={{ fontSize: 11, color: '#6366f1', textTransform: 'capitalize' }}>{user?.role?.replace(/_/g, ' ') || 'Role'}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useAuth } from '../context/AuthContext'

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const { logout } = useAuth()
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
  }, [location])

  return (
    <div className="app-layout-container">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="app-main-content">
        <Topbar
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          onLogoutClick={() => setLogoutConfirmOpen(true)}
        />
        <main style={{ flex: 1, padding: '88px 28px 28px', minHeight: '100vh' }}>
          <Outlet />
        </main>
      </div>

      {/* Logout Confirmation Dialog */}
      {logoutConfirmOpen && (
        <div className="modal-backdrop" onClick={() => setLogoutConfirmOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center', padding: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Sign Out</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>Are you sure you want to sign out of your account?</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setLogoutConfirmOpen(false)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}>Cancel</button>
              <button onClick={() => { setLogoutConfirmOpen(false); logout(); }} className="btn-danger" style={{ padding: '8px 16px', fontSize: 13 }}>Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import ModalBackdrop from '../components/ModalBackdrop'
import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const { user, logout, restoreSuperAdmin, impersonating } = useAuth()
  const [restoring, setRestoring] = useState(false)
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
          {impersonating && (
            <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '12px 16px', marginBottom: 20, borderRadius: 12, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--text-primary)' }}>
              <span>Viewing as <strong>{user?.name}</strong> ({user?.role?.replaceAll('_', ' ')}).</span>
              <button className="btn-secondary" disabled={restoring} onClick={async () => {
                setRestoring(true)
                try { await restoreSuperAdmin() } catch (error) { toast.error(error.message); setRestoring(false) }
              }}>{restoring ? 'Returning...' : 'Return to Super Admin'}</button>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Logout Confirmation Dialog */}
      {logoutConfirmOpen && (
        <ModalBackdrop className="modal-backdrop" onClick={() => setLogoutConfirmOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center', padding: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Sign Out</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>Are you sure you want to sign out of your account?</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setLogoutConfirmOpen(false)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}>Cancel</button>
              <button onClick={() => { setLogoutConfirmOpen(false); logout(); }} className="btn-danger" style={{ padding: '8px 16px', fontSize: 13 }}>Sign Out</button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </div>
  )
}

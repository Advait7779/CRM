import { useEffect, useState } from 'react'
import { Plus, X, Key, Eye, EyeOff, Trash2, ShieldCheck, ShieldAlert, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeSelect from '../../components/ThemeSelect'
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/api'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'

const ROLES = [
  'director', 'accounts', 'sales_manager', 'sales_executive',
  'installation_manager', 'gps_installer', 'cctv_technician',
  'website_developer', 'digital_marketing', 'support_executive'
]

const emptyForm = { name: '', email: '', phone: '', role: 'support_executive', password: '' }

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalUser, setEditModalUser] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role: 'support_executive' })
  const [resetModalUser, setResetModalUser] = useState(null)
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null)
  const [resetPasswordInput, setResetPasswordInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    apiGet('/users').then(setUsers).catch(error => toast.error(error.message))
  }, [])

  const createUser = async event => {
    event.preventDefault()
    if (form.password.length < 12) return toast.error('Initial password must be at least 12 characters')
    try {
      const created = await apiPost('/users', form)
      setUsers(current => [...current, created])
      setModalOpen(false)
      setForm(emptyForm)
      toast.success('System user created')
    } catch (error) { toast.error(error.message) }
  }

  const changeRole = async (user, role) => {
    if (user.role === 'super_admin') {
      return toast.error('Super Admin root account privileges cannot be demoted')
    }
    try {
      const updated = await apiPut(`/users/${user.id}`, { role })
      setUsers(current => current.map(item => item.id === user.id ? updated : item))
      toast.success('User role updated')
    } catch (error) { toast.error(error.message) }
  }

  const deleteUser = user => {
    if (user.role === 'super_admin') {
      return toast.error('Super Admin root account cannot be deleted')
    }
    setConfirmDeleteUser(user)
  }

  const handleConfirmDeleteUser = async () => {
    if (!confirmDeleteUser) return
    try {
      await apiDelete(`/users/${confirmDeleteUser.id}`)
      setUsers(current => current.filter(item => item.id !== confirmDeleteUser.id))
      toast.success(`User ${confirmDeleteUser.name} removed from system`)
      setConfirmDeleteUser(null)
    } catch (error) { toast.error(error.message) }
  }

  const resetPassword = user => {
    setResetModalUser(user)
    setResetPasswordInput('')
    setShowPassword(false)
  }

  const handleConfirmResetPassword = async event => {
    event.preventDefault()
    if (!resetPasswordInput || resetPasswordInput.length < 12) {
      return toast.error('Password must be at least 12 characters')
    }
    try {
      await apiPut(`/users/${resetModalUser.id}/password`, { newPassword: resetPasswordInput })
      toast.success(`Password updated for ${resetModalUser.name}`)
      setResetModalUser(null)
      setResetPasswordInput('')
    } catch (error) {
      toast.error(error.message)
    }
  }

  const openEditModal = user => {
    setEditModalUser(user)
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'support_executive'
    })
  }

  const handleSaveEdit = async event => {
    event.preventDefault()
    if (!editModalUser) return
    try {
      const updated = await apiPut(`/users/${editModalUser.id}`, editForm)
      setUsers(current => current.map(item => item.id === editModalUser.id ? { ...item, ...updated } : item))
      toast.success('User details updated successfully')
      setEditModalUser(null)
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div><h1 className="page-title">System Users</h1><p className="page-subtitle">Create login accounts and assign access roles.</p></div>
        <button className="btn-primary" onClick={() => setModalOpen(true)} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}><Plus size={16} /> Add User</button>
      </div>
      <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 160 }}>
        <table className="data-table" style={{ overflow: 'visible', minWidth: 750 }}>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th style={{ width: 220 }}>Role Access</th><th>Created</th><th>Action</th></tr></thead>
          <tbody>
            {users.map((user, idx) => {
              const isSuperAdmin = user.role === 'super_admin'
              return (
                <tr key={user.id} style={{ position: 'relative', zIndex: users.length - idx }}>
                  <td style={{ fontWeight: 600 }}>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.phone || '—'}</td>
                  <td style={{ position: 'relative' }}>
                    {isSuperAdmin ? (
                      <span className="badge badge-purple" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13 }}>
                        <ShieldCheck size={14} /> Super Admin (Root)
                      </span>
                    ) : (
                      <ThemeSelect value={user.role} onChange={event => changeRole(user, event.target.value)}>
                        {ROLES.map(role => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}
                      </ThemeSelect>
                    )}
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        title="Edit User Details"
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', cursor: 'pointer'
                        }}
                        onClick={() => openEditModal(user)}
                      >
                        <Pencil size={15} style={{ color: '#f59e0b' }} />
                      </button>
                      {!isSuperAdmin && (
                        <button
                          title="Reset User Password"
                          style={{
                            width: 32, height: 32, borderRadius: 8,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer'
                          }}
                          onClick={() => resetPassword(user)}
                        >
                          <Key size={15} style={{ color: '#6366f1' }} />
                        </button>
                      )}
                      {!isSuperAdmin ? (
                        <button
                          title="Remove System User"
                          style={{
                            width: 32, height: 32, borderRadius: 8,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer'
                          }}
                          onClick={() => deleteUser(user)}
                        >
                          <Trash2 size={15} style={{ color: '#ef4444' }} />
                        </button>
                      ) : (
                        <button
                          title="Super Admin root account cannot be deleted"
                          disabled
                          style={{
                            width: 32, height: 32, borderRadius: 8,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.25)', opacity: 0.5, cursor: 'not-allowed'
                          }}
                        >
                          <ShieldAlert size={15} style={{ color: '#94a3b8' }} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={event => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><h2>Create System User</h2><button onClick={() => setModalOpen(false)} style={{ border: 0, background: 'none', color: 'var(--text-secondary)' }}><X /></button></div>
            <form onSubmit={createUser}>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Name</label><input className="input-field" value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} required /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="input-field" type="email" value={form.email} onChange={e => setForm(current => ({ ...current, email: e.target.value }))} required /></div>
                <div className="form-group"><label className="form-label">Phone</label><input className="input-field" value={form.phone} onChange={e => setForm(current => ({ ...current, phone: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Role</label><ThemeSelect value={form.role} onChange={e => setForm(current => ({ ...current, role: e.target.value }))}>{ROLES.map(role => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}</ThemeSelect></div>
                <div className="form-group"><label className="form-label">Initial Password</label><input className="input-field" type="password" minLength={12} value={form.password} onChange={e => setForm(current => ({ ...current, password: e.target.value }))} required /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}><button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary">Create User</button></div>
            </form>
          </div>
        </div>
      )}
      {resetModalUser && (
        <div className="modal-backdrop" onClick={() => setResetModalUser(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Reset Password</h2>
              <button onClick={() => setResetModalUser(null)} style={{ border: 0, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleConfirmResetPassword}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Set a new password for <strong style={{ color: 'var(--text-primary)' }}>{resetModalUser.name}</strong> (minimum 12 characters):
              </p>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={12}
                    className="input-field"
                    style={{ paddingRight: 40 }}
                    value={resetPasswordInput}
                    onChange={e => setResetPasswordInput(e.target.value)}
                    placeholder="Enter new strong password..."
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => setResetModalUser(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Update Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editModalUser && (
        <div className="modal-backdrop" onClick={() => setEditModalUser(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Edit User Details</h2>
              <button onClick={() => setEditModalUser(null)} style={{ border: 0, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    className="input-field"
                    value={editForm.name}
                    onChange={e => setEditForm(current => ({ ...current, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    className="input-field"
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm(current => ({ ...current, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    className="input-field"
                    value={editForm.phone}
                    onChange={e => setEditForm(current => ({ ...current, phone: e.target.value }))}
                    placeholder="+91..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">System Role</label>
                  {editModalUser.role === 'super_admin' ? (
                    <input
                      className="input-field"
                      value="Super Admin (Root Account)"
                      disabled
                      style={{ opacity: 0.7, cursor: 'not-allowed' }}
                    />
                  ) : (
                    <ThemeSelect
                      value={editForm.role}
                      onChange={e => setEditForm(current => ({ ...current, role: e.target.value }))}
                    >
                      {ROLES.map(role => (
                        <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>
                      ))}
                    </ThemeSelect>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                <button type="button" className="btn-secondary" onClick={() => setEditModalUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteUser)}
        onClose={() => setConfirmDeleteUser(null)}
        title="Remove System User"
        subtitle="Confirm user access revocation"
        message={
          confirmDeleteUser ? (
            <>Are you sure you want to remove <strong style={{ color: 'var(--text-primary)' }}>{confirmDeleteUser.name}</strong> ({confirmDeleteUser.email})? This will permanently revoke their access to the system.</>
          ) : null
        }
        confirmText="Remove User"
        onConfirm={handleConfirmDeleteUser}
      />
    </div>
  )
}

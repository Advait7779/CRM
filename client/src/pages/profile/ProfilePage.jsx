import { useEffect, useState } from 'react'
import { Lock, Save, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { apiGet, apiPut } from '../../utils/api'

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [activity, setActivity] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiGet('/auth/profile')
      .then(profile => setForm({ name: profile.name || '', email: profile.email || '', phone: profile.phone || '' }))
      .catch(error => toast.error(error.message))
    if (['super_admin', 'director'].includes(user?.role)) {
      apiGet('/activity').then(setActivity).catch(() => {})
    }
  }, [user?.role])

  const saveProfile = async event => {
    event.preventDefault()
    setSaving(true)
    try {
      const updated = await apiPut('/auth/profile', { name: form.name, phone: form.phone })
      setForm(current => ({ ...current, ...updated }))
      updateUser(updated)
      toast.success('Profile updated')
    } catch (error) { toast.error(error.message) }
    finally { setSaving(false) }
  }

  const changePassword = async event => {
    event.preventDefault()
    if (password.newPassword !== password.confirmPassword) return toast.error('New passwords do not match')
    if (password.newPassword.length < 12) return toast.error('Password must be at least 12 characters')
    try {
      const result = await apiPut('/auth/password', { currentPassword: password.currentPassword, newPassword: password.newPassword })
      updateUser({ token: result.token })
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast.success('Password updated')
    } catch (error) { toast.error(error.message) }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">My Profile</h1><p className="page-subtitle">Manage your persisted profile and account password.</p></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 24 }}>
        <div className="glass-card" style={{ padding: 28, textAlign: 'center', alignSelf: 'start' }}>
          <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#6366f1', display: 'grid', placeItems: 'center', color: 'white', fontSize: 36, fontWeight: 800, margin: '0 auto 16px' }}>{form.name.charAt(0) || 'U'}</div>
          <h2>{form.name || user?.name}</h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, color: '#6366f1', textTransform: 'capitalize' }}><ShieldCheck size={15} /> {user?.role?.replaceAll('_', ' ')}</div>
          <p style={{ color: 'var(--text-secondary)', marginTop: 14 }}>{form.email}</p>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>{form.phone || 'No phone number'}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <form className="glass-card" onSubmit={saveProfile} style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Profile Details</h3>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Full Name</label><input className="input-field" value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} required /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="input-field" value={form.email} disabled /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="input-field" value={form.phone} onChange={e => setForm(current => ({ ...current, phone: e.target.value }))} /></div>
            </div>
            <button className="btn-primary" disabled={saving} style={{ marginTop: 18 }}><Save size={15} /> {saving ? 'Saving...' : 'Save Profile'}</button>
          </form>

          <form className="glass-card" onSubmit={changePassword} style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Change Password</h3>
            <div className="form-grid-3">
              <div className="form-group"><label className="form-label">Current Password</label><input className="input-field" type="password" value={password.currentPassword} onChange={e => setPassword(current => ({ ...current, currentPassword: e.target.value }))} required /></div>
              <div className="form-group"><label className="form-label">New Password</label><input className="input-field" type="password" minLength={12} value={password.newPassword} onChange={e => setPassword(current => ({ ...current, newPassword: e.target.value }))} required /></div>
              <div className="form-group"><label className="form-label">Confirm Password</label><input className="input-field" type="password" value={password.confirmPassword} onChange={e => setPassword(current => ({ ...current, confirmPassword: e.target.value }))} required /></div>
            </div>
            <button className="btn-primary" style={{ marginTop: 18 }}><Lock size={15} /> Update Password</button>
          </form>

          {activity.length > 0 && (
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ marginBottom: 14 }}>Recent Audit Activity</h3>
              {activity.slice(0, 12).map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
                  <span><strong>{item.userName || 'System'}</strong> {item.action} {item.entity}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{new Date(item.createdAt).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

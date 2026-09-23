import { useEffect, useState } from 'react'
import { MessageSquare, Phone, Save, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { apiGet, apiPut } from '../../utils/api'

export default function SettingsPage() {
  const { user } = useAuth()
  const [form, setForm] = useState({ sms_webhook_url: '', whatsapp_webhook_url: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const isAdmin = ['super_admin', 'director'].includes(user?.role)

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    apiGet('/settings')
      .then(data => setForm({ sms_webhook_url: data.sms_webhook_url || '', whatsapp_webhook_url: data.whatsapp_webhook_url || '' }))
      .catch(error => toast.error(error.message))
      .finally(() => setLoading(false))
  }, [isAdmin])

  const saveSettings = async event => {
    event.preventDefault()
    setSaving(true)
    try {
      const updated = await apiPut('/settings', form)
      setForm({ sms_webhook_url: updated.sms_webhook_url || '', whatsapp_webhook_url: updated.whatsapp_webhook_url || '' })
      toast.success('Settings saved successfully')
    } catch (error) { toast.error(error.message) }
    finally { setSaving(false) }
  }

  if (!isAdmin) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div><h1 className="page-title">Settings</h1><p className="page-subtitle">You do not have permission to access settings.</p></div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div><h1 className="page-title">Settings</h1><p className="page-subtitle">Loading...</p></div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure SMS & WhatsApp API integrations for notifications.</p>
        </div>
      </div>

      <form onSubmit={saveSettings}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* SMS API Webhook */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'grid', placeItems: 'center' }}>
                <Phone size={18} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>SMS API</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Advait Digital SMS Gateway</p>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                SMS Webhook URL
                <ExternalLink size={12} style={{ color: 'var(--text-secondary)' }} />
              </label>
              <textarea
                className="input-field"
                value={form.sms_webhook_url}
                onChange={e => setForm(current => ({ ...current, sms_webhook_url: e.target.value }))}
                placeholder="https://appapi.advaitdigital.co.in/api/smsapi?key=..."
                style={{ minHeight: 120, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }}
              />
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                Paste the full SMS API endpoint URL including all query parameters (key, route, sender, number, sms, templateid).
              </p>
            </div>
          </div>

          {/* WhatsApp WABA Webhook */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #25d366, #128c7e)', display: 'grid', placeItems: 'center' }}>
                <MessageSquare size={18} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>WhatsApp WABA API</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>WhatsApp Business API Gateway</p>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                WhatsApp Webhook URL
                <ExternalLink size={12} style={{ color: 'var(--text-secondary)' }} />
              </label>
              <textarea
                className="input-field"
                value={form.whatsapp_webhook_url}
                onChange={e => setForm(current => ({ ...current, whatsapp_webhook_url: e.target.value }))}
                placeholder="https://api.example.com/whatsapp/webhook?..."
                style={{ minHeight: 120, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }}
              />
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                Paste the full WhatsApp WABA API webhook URL for sending messages and notifications.
              </p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" disabled={saving} style={{ padding: '10px 28px', fontSize: 14 }}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}

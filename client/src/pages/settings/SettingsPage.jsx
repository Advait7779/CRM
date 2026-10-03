import { useEffect, useState } from 'react'
import { MessageSquare, Phone, PhoneCall, Save, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { apiGet, apiPut } from '../../utils/api'

const CUSTOMER_SETTING_KEYS = ['sms_webhook_url', 'whatsapp_webhook_url', 'rcs_webhook_url', 'voice_call_webhook_url']
const JUSTDIAL_GROUPS = [
  { id: 'cctv', title: 'CCTV', description: 'CCTV installation and repair enquiries' },
  { id: 'gps_fuel', title: 'GPS & Fuel Sensor', description: 'GPS tracking and fuel sensor enquiries' },
  { id: 'digital', title: 'Digital Services', description: 'SMS, WABA, RCS, voice, website, software, and digital marketing enquiries' }
]
const JUSTDIAL_CHANNELS = [
  { id: 'sms', label: 'SMS' },
  { id: 'rcs', label: 'RCS' },
  { id: 'voice', label: 'Voice Call' },
  { id: 'whatsapp', label: 'WhatsApp WABA' }
]
const SETTING_KEYS = [
  ...CUSTOMER_SETTING_KEYS,
  'new_lead_sms_webhook_url',
  ...JUSTDIAL_GROUPS.flatMap(group => JUSTDIAL_CHANNELS.map(channel => `justdial_${group.id}_${channel.id}_webhook_url`))
]
const emptySettings = () => Object.fromEntries(SETTING_KEYS.map(key => [key, '']))
const readSettings = data => Object.fromEntries(SETTING_KEYS.map(key => [key, data?.[key] || '']))

export default function SettingsPage() {
  const { user } = useAuth()
  const [form, setForm] = useState(emptySettings)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const isAdmin = ['super_admin', 'director'].includes(user?.role)

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    apiGet('/settings')
      .then(data => setForm(readSettings(data)))
      .catch(error => toast.error(error.message))
      .finally(() => setLoading(false))
  }, [isAdmin])

  const saveSettings = async event => {
    event.preventDefault()
    setSaving(true)
    try {
      const updated = await apiPut('/settings', form)
      setForm(readSettings(updated))
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
          <p className="page-subtitle">Configure separate notification URLs for new customers and Justdial enquiries.</p>
        </div>
      </div>

      <form onSubmit={saveSettings}>
        <h2 style={{ fontSize: 19, margin: '0 0 6px' }}>New Customer Notifications</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 18px' }}>These four URLs run when a customer profile is created.</p>
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

          {/* RCS Webhook */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'grid', placeItems: 'center' }}>
                <MessageSquare size={18} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>RCS API</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Rich Communication Services Gateway</p>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                RCS Webhook URL
                <ExternalLink size={12} style={{ color: 'var(--text-secondary)' }} />
              </label>
              <textarea
                className="input-field"
                value={form.rcs_webhook_url}
                onChange={e => setForm(current => ({ ...current, rcs_webhook_url: e.target.value }))}
                placeholder="https://api.example.com/send-rcs?phone=..."
                style={{ minHeight: 120, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }}
              />
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                Paste the full RCS API URL. The phone or number value is replaced, or phone is appended when absent.
              </p>
            </div>
          </div>

          {/* Voice Call Webhook */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #ec4899, #be185d)', display: 'grid', placeItems: 'center' }}>
                <PhoneCall size={18} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Voice Call API</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Automated Voice Call Gateway</p>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Voice Call Webhook URL
                <ExternalLink size={12} style={{ color: 'var(--text-secondary)' }} />
              </label>
              <textarea
                className="input-field"
                value={form.voice_call_webhook_url}
                onChange={e => setForm(current => ({ ...current, voice_call_webhook_url: e.target.value }))}
                placeholder="https://api.example.com/voice-call?phone=..."
                style={{ minHeight: 120, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }}
              />
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                Paste the full Voice Call API URL. The phone or number value is replaced, or phone is appended when absent.
              </p>
            </div>
          </div>
        </div>

        <section className="glass-card" style={{ padding: 28, marginTop: 36 }}>
          <h2 style={{ fontSize: 19, margin: '0 0 6px' }}>New Lead SMS</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 18px' }}>Runs when a lead is created in this CRM. Use an approved enquiry template; the New Customer SMS URL above remains for customer profiles.</p>
          <div className="form-group">
            <label className="form-label">New Lead SMS URL</label>
            <textarea
              className="input-field"
              value={form.new_lead_sms_webhook_url}
              onChange={e => setForm(current => ({ ...current, new_lead_sms_webhook_url: e.target.value }))}
              placeholder="https://provider.example/send-sms?number={phone}&templateid=..."
              style={{ minHeight: 92, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }}
            />
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>Use {'{phone}'} in the recipient parameter, or an existing phone/number parameter will be replaced.</p>
          </div>
        </section>

        <div style={{ marginTop: 36, marginBottom: 18 }}>
          <h2 style={{ fontSize: 19, margin: '0 0 6px' }}>Justdial Enquiry Notifications</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Use approved, product-specific provider URLs. Only newly received Justdial leads in a recognised group use these URLs. Leave a field empty to disable that channel.</p>
        </div>
        {JUSTDIAL_GROUPS.map(group => (
          <section key={group.id} className="glass-card" style={{ padding: 28, marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>{group.title}</h3>
            <p style={{ margin: '0 0 18px', fontSize: 12, color: 'var(--text-secondary)' }}>{group.description}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
              {JUSTDIAL_CHANNELS.map(channel => {
                const key = `justdial_${group.id}_${channel.id}_webhook_url`
                return (
                  <div className="form-group" key={key}>
                    <label className="form-label">{channel.label} URL</label>
                    <textarea
                      className="input-field"
                      value={form[key]}
                      onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))}
                      placeholder={`https://provider.example/send-${channel.id}?phone={phone}`}
                      style={{ minHeight: 92, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }}
                    />
                  </div>
                )
              })}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>Use {'{phone}'} in the recipient parameter, or the existing phone/number parameter will be replaced. Justdial DNC marked numbers are skipped.</p>
          </section>
        ))}

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" disabled={saving} style={{ padding: '10px 28px', fontSize: 14 }}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}

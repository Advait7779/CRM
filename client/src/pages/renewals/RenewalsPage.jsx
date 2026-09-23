import { useState, useEffect } from 'react'
import { apiGetAll, apiPost } from '../../utils/api'
import { localDateString } from '../../utils/date'
import ThemeSelect from '../../components/ThemeSelect'
import ThemeDatePicker from '../../components/ThemeDatePicker'
import { Plus, Search, AlertTriangle, RefreshCw, Send, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'

const money = value => '\u20B9' + Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })


export default function RenewalsPage() {
  const [renewals, setRenewals] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    customerId: '', type: 'GPS Renewal', nextDue: '', amount: ''
  })

  useEffect(() => {
    Promise.all([apiGetAll('/renewals'), apiGetAll('/customers')])
      .then(([renewalRows, customerRows]) => {
        setRenewals(renewalRows)
        setCustomers(customerRows)
        if (customerRows[0]) setForm(current => ({ ...current, customerId: customerRows[0].id }))
      })
      .catch(err => toast.error('Failed to load renewals: ' + err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleCreateRenewal = async (e) => {
    e.preventDefault()
    if (!form.nextDue || !form.amount) return toast.error('Next due date and amount are required')
    const nextDate = new Date(form.nextDue)
    const diffTime = nextDate - new Date()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const payload = {
      customerId: Number(form.customerId),
      type: form.type,
      lastDate: localDateString(),
      nextDue: form.nextDue,
      amount: Number(form.amount),
      daysLeft: diffDays,
      status: diffDays < 0 ? 'Overdue' : diffDays <= 7 ? 'Due Soon' : 'Active'
    }
    try {
      const created = await apiPost('/renewals', payload)
      setRenewals(prev => [created, ...prev])
      toast.success('Renewal schedule added')
      setModalOpen(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const overdueCount = renewals.filter(r => r.daysLeft < 0).length

  const filtered = renewals.filter(r => {
    const matchSearch = r.customer.toLowerCase().includes(search.toLowerCase()) || r.type.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'All' || r.type.includes(filterType)
    return matchSearch && matchType
  })

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading renewals...</div>

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div>
          <h1 className="page-title">Renewals Tracker</h1>
          <p className="page-subtitle">Track service subscriptions, domain hosting expiries, and CCTV annual maintenance renewals.</p>
        </div>
        <button className="btn-primary" onClick={() => setModalOpen(true)} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          + Add Renewal Schedule
        </button>
      </div>

      {overdueCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 12, marginBottom: 20 }}>
          <AlertTriangle style={{ color: '#ef4444' }} />
          <div style={{ fontSize: 13, color: '#fca5a5' }}>
            <strong>Action Required:</strong> You have {overdueCount} overdue subscription(s). Use the reminder action after notification providers are configured.
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 280, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input
            className="input-field"
            style={{ paddingLeft: 36, height: 38 }}
            placeholder="Search renewals..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['All', 'GPS', 'CCTV', 'Website', 'Voice'].map(tp => (
            <button
              key={tp}
              onClick={() => setFilterType(tp)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                border: `1px solid ${filterType === tp ? '#6366f1' : 'var(--border-subtle)'}`,
                background: filterType === tp ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: filterType === tp ? '#4f46e5' : 'var(--text-secondary)',
                fontWeight: filterType === tp ? 700 : 500,
                whiteSpace: 'nowrap'
              }}
            >
              {tp}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="data-table" style={{ minWidth: 850 }}>
          <thead>
            <tr>
              <th>Client Customer</th>
              <th>Renewal Type</th>
              <th>Last Renewal</th>
              <th>Next Due Date</th>
              <th>Renewal Price</th>
              <th>Time Left</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.customer}</td>
                <td>
                  <span className="badge badge-purple">{r.type}</span>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.lastDate}</td>
                <td style={{ color: 'var(--text-primary)', fontSize: 13 }}>{r.nextDue}</td>
                <td style={{ fontWeight: 600 }}>{money(r.amount)}</td>
                <td>
                  {r.daysLeft < 0 ? (
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>Overdue by {Math.abs(r.daysLeft)}d</span>
                  ) : r.daysLeft <= 7 ? (
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>{r.daysLeft}d left</span>
                  ) : (
                    <span style={{ color: '#10b981' }}>{r.daysLeft}d left</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${r.status === 'Active' ? 'badge-success' : r.status === 'Overdue' ? 'badge-danger' : 'badge-warning'}`}>
                    {r.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      title="Renew Subscription Now"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer'
                      }}
                      onClick={async () => {
                        try {
                          const result = await apiPost(`/renewals/${r.id}/renew`, {})
                          setRenewals(prev => prev.map(item => item.id === r.id ? result.renewal : item))
                          toast.success(`Renewal processed and invoice ${result.invoice.id} created`)
                        } catch (error) {
                          toast.error(error.message)
                        }
                      }}
                    >
                      <RefreshCw size={15} style={{ color: '#10b981' }} />
                    </button>
                    <button
                      title="Generate Renewal Invoice"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', cursor: 'pointer'
                      }}
                      onClick={async () => {
                        try {
                          const invoice = await apiPost(`/renewals/${r.id}/generate-invoice`, {})
                          toast.success(`Invoice ${invoice.id} created for ${r.customer}`)
                        } catch (error) {
                          toast.error(error.message)
                        }
                      }}
                    >
                      <Receipt size={15} style={{ color: '#3b82f6' }} />
                    </button>
                    <button
                      title="Send Renewal Reminder"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer'
                      }}
                      onClick={async () => {
                        try {
                          const result = await apiPost(`/renewals/${r.id}/remind`, {})
                          const delivered = Object.entries(result.channels || {})
                            .filter(([, status]) => status === 'Delivered')
                            .map(([channel]) => channel)
                          toast.success(delivered.length
                            ? `Reminder delivered via ${delivered.join(', ')} to ${r.customer}`
                            : 'Reminder processed. Configure SMTP or another provider for external delivery.')
                        } catch (error) {
                          toast.error(error.message)
                        }
                      }}
                    >
                      <Send size={15} style={{ color: '#6366f1' }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Add Renewal Schedule</h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>
            <form onSubmit={handleCreateRenewal}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Client Customer *</label>
                  <ThemeSelect className="input-field" value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: Number(e.target.value) }))}>
                    {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </ThemeSelect>
                </div>
                <div className="form-group">
                  <label className="form-label">Renewal Module Type *</label>
                  <ThemeSelect className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="GPS Renewal">🛰️ GPS System Renewal</option>
                    <option value="SIM card Renewal">📱 SIM card Renewal</option>
                    <option value="Website Hosting Renewal">🌐 Website Hosting Renewal</option>
                    <option value="Domain Renewal">🌐 Domain Renewal</option>
                    <option value="SSL Renewal">🔒 SSL Renewal</option>
                    <option value="CCTV AMC Renewal">📹 CCTV AMC Renewal</option>
                    <option value="SMS Package Renewal">💬 SMS Package Renewal</option>
                    <option value="RCS Renewal">💬 RCS Renewal</option>
                    <option value="Voice Package Renewal">📞 Voice Package Renewal</option>
                  </ThemeSelect>
                </div>
                <div className="form-group">
                  <label className="form-label">Next Renewal Due Date *</label>
                  <ThemeDatePicker value={form.nextDue} onChange={e => setForm(f => ({ ...f, nextDue: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Renewal Amount (₹) *</label>
                  <input className="input-field" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Add Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

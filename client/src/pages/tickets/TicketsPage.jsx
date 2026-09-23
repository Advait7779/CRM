import { useState, useEffect } from 'react'
import { apiGetAll, apiPost, apiPut } from '../../utils/api'
import { Plus, Search, CheckCircle2 } from 'lucide-react'
import ThemeSelect from '../../components/ThemeSelect'
import toast from 'react-hot-toast'

export default function TicketsPage() {
  const [tickets, setTickets] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    customerId: '', subject: '', service: 'GPS Offline', priority: 'High', desc: ''
  })

  useEffect(() => {
    Promise.all([apiGetAll('/tickets'), apiGetAll('/customers')])
      .then(([ticketRows, customerRows]) => {
        setTickets(ticketRows)
        setCustomers(customerRows)
        if (customerRows[0]) setForm(current => ({ ...current, customerId: customerRows[0].id }))
      })
      .catch(err => toast.error('Failed to load tickets: ' + err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleCreateTicket = async (e) => {
    e.preventDefault()
    if (!form.subject) return toast.error('Please enter a ticket subject')
    try {
      const created = await apiPost('/tickets', {
        customerId: form.customerId,
        subject: form.subject,
        service: form.service,
        priority: form.priority,
        status: 'Open',
        description: form.desc
      })
      setTickets(prev => [created, ...prev])
      toast.success('Support ticket created')
      setModalOpen(false)
      setForm({ customerId: customers[0]?.id || '', subject: '', service: 'GPS Offline', priority: 'High', desc: '' })
    } catch (err) {
      toast.error(err.message)
    }
  }

  const filtered = tickets.filter(t => {
    const matchSearch = t.customer.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase())
    const matchPrio = filterPriority === 'All' || t.priority === filterPriority
    return matchSearch && matchPrio
  })

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading tickets...</div>

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div>
          <h1 className="page-title">Service Support Tickets</h1>
          <p className="page-subtitle">File and track customer complaints, device replacements, offline alerts, and resolution times.</p>
        </div>
        <button className="btn-primary" onClick={() => setModalOpen(true)} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          <Plus size={16} /> File Ticket
        </button>
      </div>

      {/* Filter Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 280, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input
            className="input-field"
            style={{ paddingLeft: 36, height: 38 }}
            placeholder="Search ticket subject..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['All', 'High', 'Medium', 'Low'].map(prio => (
            <button
              key={prio}
              onClick={() => setFilterPriority(prio)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                border: `1px solid ${filterPriority === prio ? '#6366f1' : 'var(--border-subtle)'}`,
                background: filterPriority === prio ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: filterPriority === prio ? '#4f46e5' : 'var(--text-secondary)',
                fontWeight: filterPriority === prio ? 700 : 500,
                whiteSpace: 'nowrap'
              }}
            >
              {prio} Priority
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="data-table" style={{ minWidth: 850 }}>
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Customer</th>
              <th>Issue Subject</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Filed Date</th>
              <th>SLA Resolution</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 600 }}>{t.id}</td>
                <td>{t.customer}</td>
                <td style={{ color: '#f1f5f9', fontSize: 13 }}>{t.subject}</td>
                <td>
                  <span className="badge badge-purple">{t.service}</span>
                </td>
                <td>
                  <span className={`badge ${t.priority === 'High' ? 'badge-danger' : t.priority === 'Medium' ? 'badge-warning' : 'badge-info'}`}>
                    {t.priority}
                  </span>
                </td>
                <td style={{ color: '#94a3b8', fontSize: 13 }}>{String(t.createdAt || '').slice(0, 10)}</td>
                <td>
                  {t.status === 'Resolved' ? (
                    <span className="badge badge-success" style={{ fontSize: 11 }}>SLA Met</span>
                  ) : (
                    <span className={`badge ${t.priority === 'High' ? 'badge-danger' : t.priority === 'Medium' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: 11 }}>
                      {t.priority === 'High' ? '⚡ 4h Target' : t.priority === 'Medium' ? '⏳ 24h Target' : '🕒 48h Target'}
                    </span>
                  )}
                </td>
                <td>
                  <span className={`badge ${t.status === 'Resolved' ? 'badge-success' : t.status === 'In Progress' ? 'badge-info' : 'badge-warning'}`}>
                    {t.status}
                  </span>
                </td>
                <td>
                  {t.status !== 'Resolved' && (
                    <button
                      title="Resolve Support Ticket"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer'
                      }}
                      onClick={async () => {
                        try {
                          const updated = await apiPut(`/tickets/${t.id}`, { status: 'Resolved' })
                          setTickets(prev => prev.map(item => item.id === t.id ? { ...item, ...updated, status: 'Resolved', resolution: 'Resolved' } : item))
                          toast.success('Ticket resolved')
                        } catch (err) {
                          toast.error(err.message)
                        }
                      }}
                    >
                      <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                    </button>
                  )}
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
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>File Support Ticket</h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>
            <form onSubmit={handleCreateTicket}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Client Customer *</label>
                  <ThemeSelect value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: Number(e.target.value) }))}>
                    {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </ThemeSelect>
                </div>
                <div className="form-group">
                  <label className="form-label">Subject / Issue Title *</label>
                  <input className="input-field" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Device not sending data" required />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Ticket Category *</label>
                    <ThemeSelect value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))}>
                      <option value="GPS Offline">🛰️ GPS Offline Alert</option>
                      <option value="CCTV Offline">📹 CCTV Offline Alert</option>
                      <option value="Battery Issue">🔋 Battery / Replacement Issue</option>
                      <option value="Website Issue">🌐 Website Issue</option>
                      <option value="SMS Issue">💬 SMS / Gateway issue</option>
                      <option value="Voice Issue">📞 Voice API issue</option>
                      <option value="Other">❓ Other complaint</option>
                    </ThemeSelect>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority Escalation</label>
                    <ThemeSelect value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="High">🔴 High Priority (4h SLA)</option>
                      <option value="Medium">🟡 Medium Priority (12h SLA)</option>
                      <option value="Low">🔵 Low Priority (24h SLA)</option>
                    </ThemeSelect>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Detailed Complaint Description</label>
                  <textarea className="input-field" rows={3} value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="Include IMEI, vehicle no or screen details..." />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">File Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

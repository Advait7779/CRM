import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGetAll, apiPost, apiPut, apiDelete } from '../../utils/api'
import ThemeSelect from '../../components/ThemeSelect'
import ThemeDatePicker from '../../components/ThemeDatePicker'
import { Plus, Search, Phone, MessageCircle, X, User, Globe, Share2, Pencil, Trash2, UserCheck, FilePlus } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'

const LEAD_STATUSES = ['New', 'Contacted', 'Demo Given', 'Quotation Sent', 'Negotiation', 'Won', 'Lost']
const LEAD_SOURCES  = ['Website', 'Facebook', 'WhatsApp', 'Reference', 'Call', 'Justdial']
const SERVICES      = ['GPS Tracking', 'CCTV', 'Website Design', 'SMS Package', 'RCS Messaging', 'Voice Package', 'Digital Marketing']
const EXECUTIVES    = ['Rahul Sharma', 'Priya Patel', 'Amit Singh', 'Sneha Joshi']

const SOURCE_ICON = {
  Website: Globe, Facebook: Share2, WhatsApp: MessageCircle, Reference: User, Call: Phone, Justdial: Globe
}
const SOURCE_COLOR = {
  Website: '#6366f1', Facebook: '#3b82f6', WhatsApp: '#10b981', Reference: '#f59e0b', Call: '#8b5cf6', Justdial: '#f97316'
}
const STATUS_COLOR = {
  'New': '#60a5fa', 'Contacted': '#c084fc', 'Demo Given': '#f59e0b',
  'Quotation Sent': '#fb923c', 'Negotiation': '#f97316', 'Won': '#10b981', 'Lost': '#ef4444', 'Converted': '#10b981'
}

const EMPTY_FORM = {
  name: '', phone: '', email: '', company: '', source: 'Website',
  service: 'GPS Tracking', status: 'New', exec: '', followUp: '', notes: ''
}



function LeadModal({ lead, onClose, onSave, isNew }) {
  const [form, setForm] = useState(lead ? { ...lead } : { ...EMPTY_FORM })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.phone) return toast.error('Name and phone are required')
    onSave(form, lead?.id)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{isNew ? '+ New Lead' : 'Edit Lead'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid-2" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Customer name" required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input className="input-field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 XXXXXXXXXX" required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="input-field" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@domain.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Company</label>
              <input className="input-field" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Company name" />
            </div>
            <div className="form-group">
              <label className="form-label">Lead Source</label>
              <ThemeSelect className="input-field" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
              </ThemeSelect>
            </div>
            <div className="form-group">
              <label className="form-label">Service Interest</label>
              <ThemeSelect className="input-field" value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))}>
                {form.service && !SERVICES.includes(form.service) && <option value={form.service}>{form.service}</option>}
                {SERVICES.map(s => <option key={s}>{s}</option>)}
              </ThemeSelect>
            </div>
            <div className="form-group">
              <label className="form-label">Lead Status</label>
              <ThemeSelect className="input-field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {form.status === 'Converted' && <option value="Converted">Converted</option>}
                {LEAD_STATUSES.map(s => <option key={s}>{s}</option>)}
              </ThemeSelect>
            </div>
            <div className="form-group">
              <label className="form-label">Assigned Executive</label>
              <ThemeSelect className="input-field" value={form.exec} onChange={e => setForm(f => ({ ...f, exec: e.target.value }))}>
                <option value="">Select Executive</option>
                {EXECUTIVES.map(s => <option key={s}>{s}</option>)}
              </ThemeSelect>
            </div>
            <div className="form-group">
              <label className="form-label">Follow-up Date</label>
              <ThemeDatePicker value={form.followUp || ''} onChange={e => setForm(f => ({ ...f, followUp: e.target.value }))} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Notes</label>
            <textarea className="input-field" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Lead details, requirements, etc." style={{ resize: 'vertical' }} />
          </div>
          {isNew && (
            <div style={{ padding: 14, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#10b981' }}>
              ✓ Auto notifications will be sent via WhatsApp, SMS &amp; Email when this lead is created
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">
              {isNew ? '+ Create Lead' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LeadsPage() {
  const [leads, setLeads]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterSource, setFilter] = useState('All')
  const [modal, setModal]         = useState(null) // null | { lead, isNew }
  const [confirmDeleteLead, setConfirmDeleteLead] = useState(null)

  useEffect(() => {
    apiGetAll('/leads')
      .then(data => setLeads(data))
      .catch(err => toast.error('Failed to load leads: ' + err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = leads.filter(l => {
    const matchSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || (l.company || '').toLowerCase().includes(search.toLowerCase())
    const matchSrc    = filterSource === 'All' || l.source === filterSource
    return matchSearch && matchSrc
  })

  const handleSave = async (form, id) => {
    try {
      if (id) {
        const updated = await apiPut(`/leads/${id}`, form)
        setLeads(prev => prev.map(l => l.id === id ? updated : l))
        toast.success('Lead updated successfully!')
      } else {
        const created = await apiPost('/leads', form)
        setLeads(prev => [created, ...prev])
        toast.success('Lead created')
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const navigate = useNavigate()

  const handleConvertLead = async (lead) => {
    try {
      await apiPost(`/leads/${lead.id}/convert`)
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'Converted' } : l))
      toast.success(`Converted ${lead.name} to active customer account!`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (id) => {
    try {
      await apiDelete(`/leads/${id}`)
      setLeads(prev => prev.filter(l => l.id !== id))
      toast.success('Lead deleted.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading leads...</div>

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div>
          <h1 className="page-title">Lead Management</h1>
          <p className="page-subtitle">{leads.length} total leads · {leads.filter(l => l.status === 'Won').length} won · {leads.filter(l => l.status === 'New').length} new</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ lead: null, isNew: true })} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          <Plus size={16} /> New Lead
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 280, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input className="input-field" style={{ paddingLeft: 34, height: 38 }} placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['All', ...LEAD_SOURCES].map(src => (
            <button key={src} onClick={() => setFilter(src)} style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid',
              borderColor: filterSource === src ? '#6366f1' : 'var(--border-subtle)',
              background: filterSource === src ? 'rgba(99,102,241,0.12)' : 'transparent',
              color: filterSource === src ? '#4f46e5' : 'var(--text-secondary)',
              fontWeight: filterSource === src ? 700 : 500,
              fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
            }}>{src}</button>
          ))}
        </div>
      </div>

      {/* List View */}
      <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="data-table" style={{ minWidth: 850 }}>
          <thead>
            <tr>
              <th>Name</th><th>Phone</th><th>Service</th><th>Source</th><th>Status</th><th>Executive</th><th>Follow-up</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => {
              const SrcIcon = SOURCE_ICON[l.source] || Globe
              return (
                <tr key={l.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>{l.name.charAt(0)}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{l.name}</div>
                        <div style={{ color: '#475569', fontSize: 11 }}>{l.company}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{l.phone}</td>
                  <td><span style={{ fontSize: 12, color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '3px 8px', borderRadius: 6 }}>{l.service}</span></td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: SOURCE_COLOR[l.source] }}>
                      <SrcIcon size={12} /> {l.source}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: `${STATUS_COLOR[l.status]}20`, color: STATUS_COLOR[l.status] }}>
                      {l.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{l.exec}</td>
                  <td style={{ color: l.followUp ? '#f59e0b' : '#475569', fontSize: 13 }}>{l.followUp || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {l.status !== 'Converted' && (
                        <button
                          onClick={() => handleConvertLead(l)}
                          title="Convert Lead to Active Customer"
                          style={{
                            width: 32, height: 32, borderRadius: 8,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)',
                            cursor: 'pointer'
                          }}
                        >
                          <UserCheck size={15} style={{ color: '#10b981' }} />
                        </button>
                      )}

                      <button
                        onClick={() => navigate('/quotations')}
                        title="Generate Quotation for Lead"
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)',
                          cursor: 'pointer'
                        }}
                      >
                        <FilePlus size={15} style={{ color: '#6366f1' }} />
                      </button>

                      <button
                        onClick={() => setModal({ lead: l, isNew: false })}
                        title="Edit Lead"
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)',
                          cursor: 'pointer'
                        }}
                      >
                        <Pencil size={15} style={{ color: '#6366f1' }} />
                      </button>

                      <button
                        onClick={() => setConfirmDeleteLead(l)}
                        title="Delete Lead"
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={15} style={{ color: '#ef4444' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <LeadModal
          lead={modal.lead}
          isNew={modal.isNew}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteLead)}
        onClose={() => setConfirmDeleteLead(null)}
        title="Delete Lead"
        subtitle={confirmDeleteLead ? `Prospect: ${confirmDeleteLead.name}` : ''}
        message={
          confirmDeleteLead ? (
            <>Are you sure you want to delete lead <strong style={{ color: 'var(--text-primary)' }}>{confirmDeleteLead.name}</strong> for {confirmDeleteLead.service || 'service'}? This action cannot be undone.</>
          ) : null
        }
        confirmText="Delete Lead"
        onConfirm={async () => {
          if (!confirmDeleteLead) return
          await handleDelete(confirmDeleteLead.id)
          setConfirmDeleteLead(null)
        }}
      />
    </div>
  )
}

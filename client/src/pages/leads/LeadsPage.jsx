import PaginatedTable from '../../components/PaginatedTable'
import ModalBackdrop from '../../components/ModalBackdrop'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiDownload, apiGet, apiGetAll, apiPost, apiPut } from '../../utils/api'
import { useAuth } from '../../context/AuthContext'
import ThemeSelect from '../../components/ThemeSelect'
import ThemeDatePicker from '../../components/ThemeDatePicker'
import { Plus, Search, Phone, MessageCircle, X, User, Globe, Share2, UserCheck, Download, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { LEAD_GROUPS, leadMatchesGroup, getLeadDate } from './leadData'
import { localDateString } from '../../utils/date'

const ACTION_STATUSES = [
  'Connected',
  'Future Prospect',
  'Fake Enquiry',
  'Interested',
  'Not Interested',
  'Follow-Up Required'
]
const LEAD_STATUSES = ['New', ...ACTION_STATUSES]
const LEAD_SOURCES  = ['Website', 'Facebook', 'WhatsApp', 'Reference', 'Call', 'Justdial']
const SERVICES      = ['GPS Tracking', 'CCTV', 'Website Design', 'SMS Package', 'RCS Messaging', 'Voice Package', 'Digital Marketing']

const SOURCE_ICON = {
  Website: Globe, Facebook: Share2, WhatsApp: MessageCircle, Reference: User, Call: Phone, Justdial: Globe
}
const SOURCE_COLOR = {
  Website: '#6366f1', Facebook: '#3b82f6', WhatsApp: '#10b981', Reference: '#f59e0b', Call: '#8b5cf6', Justdial: '#f97316'
}
const STATUS_COLOR = {
  'New': '#60a5fa',
  'Connected': '#6366f1',
  'Future Prospect': '#8b5cf6',
  'Fake Enquiry': '#ef4444',
  'Interested': '#10b981',
  'Not Interested': '#f97316',
  'Follow-Up Required': '#f59e0b',
  'Contacted': '#c084fc',
  'Demo Given': '#f59e0b',
  'Quotation Sent': '#fb923c',
  'Negotiation': '#f97316',
  'Won': '#10b981',
  'Lost': '#ef4444',
  'Converted': '#10b981'
}

const EMPTY_FORM = {
  name: '', phone: '', email: '', company: '', source: 'Website',
  service: 'GPS Tracking', status: 'New', exec: '', followUp: '', notes: ''
}



function LeadModal({ lead, onClose, onSave, isNew, isAdmin, productOptions, systemUsers = [], currentUser }) {
  const [form, setForm] = useState(lead ? { ...lead } : { ...EMPTY_FORM, exec: currentUser?.role === 'sales_executive' ? currentUser.name : '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.phone) return toast.error('Name and phone are required')
    onSave(form, lead?.id)
    onClose()
  }

  return (
    <ModalBackdrop className="modal-backdrop" onClick={onClose}>
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
              <ThemeSelect className="input-field" value={form.source} disabled={lead?.source === 'Justdial' && !isAdmin} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
              </ThemeSelect>
            </div>
            <div className="form-group">
              <label className="form-label">Service Interest</label>
              <ThemeSelect className="input-field" value={form.service} disabled={lead?.source === 'Justdial' && !isAdmin} onChange={e => setForm(f => ({ ...f, service: e.target.value, justdialProduct: undefined }))}>
                {form.service && !SERVICES.includes(form.service) && <option value={form.service}>{form.service}</option>}
                {SERVICES.map(s => <option key={s}>{s}</option>)}
              </ThemeSelect>
            </div>
            {lead && isAdmin && (
              <div className="form-group">
                <label className="form-label">Lead Product Group</label>
                <ThemeSelect className="input-field" value={form.justdialProduct || 'Unclassified'} onChange={e => setForm(f => ({ ...f, justdialProduct: e.target.value }))}>
                  <option value="Unclassified">Unclassified (admin review)</option>
                  {productOptions.map(product => <option key={product} value={product}>{product}</option>)}
                </ThemeSelect>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Lead Status</label>
              {lead?.status === 'Converted' || lead?.convertedCustomerId ? (
                <div className="input-field" style={{ display: 'flex', alignItems: 'center' }}>Converted</div>
              ) : (
                <ThemeSelect className="input-field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {form.status && !LEAD_STATUSES.includes(form.status) && <option value={form.status}>{form.status}</option>}
                  {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </ThemeSelect>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Assigned Executive</label>
              <ThemeSelect className="input-field" value={form.exec || ''} disabled={currentUser?.role === 'sales_executive'} onChange={e => setForm(f => ({ ...f, exec: e.target.value }))}>
                <option value="">Select Executive</option>
                {form.exec && !systemUsers.some(u => u.name === form.exec) && (
                  <option value={form.exec}>{form.exec}</option>
                )}
                {systemUsers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
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
              SMS will be sent if the New Lead SMS URL is configured. Email requires SMTP configuration.
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
    </ModalBackdrop>
  )
}

export default function LeadsPage() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const isAdmin = ['super_admin', 'director'].includes(user?.role)
  const [productOptions, setProductOptions] = useState([])
  const [systemUsers, setSystemUsers] = useState([])
  const [leads, setLeads]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState(() => searchParams.get('search') || '')
  const [selectedGroup, setSelectedGroup] = useState('All')
  const [modal, setModal]         = useState(null) // null | { lead, isNew }
  const [confirmConvertLead, setConfirmConvertLead] = useState(null)
  const [converting, setConverting] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    apiGetAll('/leads')
      .then(data => setLeads(data))
      .catch(err => toast.error('Failed to load leads: ' + err.message))
      .finally(() => setLoading(false))
    apiGet('/system-users')
      .then(data => setSystemUsers(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Could not load system users for lead assignment.'))
  }, [])

  useEffect(() => {
    if (isAdmin) apiGet('/justdial/products').then(data => setProductOptions(data.assignable)).catch(() => {})
  }, [isAdmin])

  const filtered = leads.filter(l => {
    const term = search.trim().toLowerCase()
    const matchSearch = !term || [l.name, l.phone, l.company, l.service, l.justdialProduct].some(value => String(value || '').toLowerCase().includes(term))
    return matchSearch && leadMatchesGroup(l, selectedGroup)
  })

  const handleDownloadExcel = async () => {
    if (!filtered.length || exporting) return
    setExporting(true)
    try {
      const query = new URLSearchParams({ group: selectedGroup, search: search.trim() })
      const groupName = selectedGroup.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')
      await apiDownload(`/leads-export.xlsx?${query}`, `leads-${groupName}-${localDateString()}.xlsx`)
    } catch (error) {
      toast.error(`Could not download the Excel sheet: ${error.message}`)
    } finally {
      setExporting(false)
    }
  }

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

  const handleStatusChange = async (lead, nextStatus) => {
    if (!nextStatus || nextStatus === lead.status) return
    try {
      const updated = await apiPut(`/leads/${lead.id}`, { status: nextStatus })
      setLeads(prev => prev.map(l => l.id === lead.id ? updated : l))
      toast.success(`Status updated to "${nextStatus}"`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleConfirmConvert = async () => {
    if (!confirmConvertLead) return
    setConverting(true)
    try {
      await apiPost(`/leads/${confirmConvertLead.id}/convert`)
      setLeads(prev => prev.map(l => l.id === confirmConvertLead.id ? { ...l, status: 'Converted' } : l))
      toast.success(`Converted ${confirmConvertLead.name} to active customer account!`)
      setConfirmConvertLead(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setConverting(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading leads...</div>

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Lead Management</h1>
          <p className="page-subtitle">{leads.length} total leads · {leads.filter(l => l.status === 'Won').length} won · {leads.filter(l => l.status === 'New').length} new</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary" onClick={handleDownloadExcel} disabled={!filtered.length || exporting} style={{ whiteSpace: 'nowrap', opacity: filtered.length && !exporting ? 1 : 0.5 }} title={`Download ${filtered.length} visible leads as a formatted Excel workbook`}>
            <Download size={16} /> {exporting ? 'Preparing Excel…' : `Download Excel (${filtered.length})`}
          </button>
          <button className="btn-primary" onClick={() => setModal({ lead: null, isNew: true })} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            <Plus size={16} /> New Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 280, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input className="input-field" style={{ paddingLeft: 34, height: 38 }} placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {LEAD_GROUPS.map(group => (
            <button key={group} type="button" onClick={() => setSelectedGroup(group)} style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid',
              borderColor: selectedGroup === group ? '#6366f1' : 'var(--border-subtle)',
              background: selectedGroup === group ? 'rgba(99,102,241,0.12)' : 'transparent',
              color: selectedGroup === group ? '#4f46e5' : 'var(--text-secondary)',
              fontWeight: selectedGroup === group ? 700 : 500,
              fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
            }}>{group}</button>
          ))}
        </div>
      </div>

      {/* List View */}
      <div className="table-pagination-shell" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <PaginatedTable><table className="data-table" style={{ minWidth: 980 }}>
          <thead>
            <tr>
              <th>Name</th><th>Phone</th><th>Service</th><th>Source</th><th title="Original enquiry date for imported leads, or date added to CRM">Lead Date</th><th>Status</th><th>Executive</th><th>Follow-up</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => {
              const SrcIcon = SOURCE_ICON[l.source] || Globe
              const leadDate = getLeadDate(l)
              const statusColor = STATUS_COLOR[l.status] || '#6366f1'
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
                  <td><span style={{ fontSize: 12, color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '3px 8px', borderRadius: 6 }}>{l.service}</span>{l.justdialProduct && <div style={{ fontSize: 11, color: l.justdialProduct === 'Unclassified' ? '#b45309' : 'var(--text-secondary)', marginTop: 6 }}>{l.justdialProduct}</div>}</td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: SOURCE_COLOR[l.source] }}>
                      <SrcIcon size={12} /> {l.source}
                    </span>
                    {l.websiteFormSource && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{l.websiteFormSource}</div>}
                    {l.facebookPlatform && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{l.facebookPlatform === 'ig' ? 'Instagram' : 'Facebook'}</div>}
                  </td>
                  <td title={leadDate.title} style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{leadDate.date}</div>
                    {leadDate.time && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{leadDate.time}</div>}
                  </td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: `${statusColor}20`, color: statusColor, whiteSpace: 'nowrap' }}>
                      {l.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{l.exec || '—'}</td>
                  <td style={{ color: l.followUp ? '#f59e0b' : '#475569', fontSize: 13 }}>{l.followUp || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {isAdmin && (l.source !== 'Justdial' || user?.role === 'super_admin') && (
                        <button
                          type="button"
                          onClick={() => setModal({ lead: l, isNew: false })}
                          title="Edit lead and assign an executive"
                          aria-label={`Edit ${l.name} and assign an executive`}
                          style={{ width: 28, height: 28, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', color: '#6366f1', cursor: 'pointer', flexShrink: 0 }}
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {l.status !== 'Converted' && !l.convertedCustomerId && <ThemeSelect
                        value={l.status || 'New'}
                        onChange={e => handleStatusChange(l, e.target.value)}
                        style={{
                          height: '26px',
                          width: '92px',
                          minWidth: '92px',
                          maxWidth: '92px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          padding: '0 18px 0 7px',
                          background: `${statusColor}12`,
                          border: `1px solid ${statusColor}40`,
                          color: statusColor
                        }}
                      >
                        {!ACTION_STATUSES.includes(l.status) && (
                          <option value={l.status || 'New'}>{l.status || 'New'}</option>
                        )}
                        {ACTION_STATUSES.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </ThemeSelect>}
                      {l.status !== 'Converted' && !l.convertedCustomerId ? (
                        <button
                          onClick={() => setConfirmConvertLead(l)}
                          title="Convert Lead to Active Customer"
                          style={{
                            width: 28, height: 28, borderRadius: 7,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)',
                            cursor: 'pointer', transition: 'all 0.15s ease', flexShrink: 0
                          }}
                        >
                          <UserCheck size={14} style={{ color: '#10b981' }} />
                        </button>
                      ) : (
                        <span
                          title="Lead is already converted to an active customer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 11, fontWeight: 600, color: '#10b981',
                            background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)',
                            padding: '4px 7px', borderRadius: 7, whiteSpace: 'nowrap', flexShrink: 0
                          }}
                        >
                          <UserCheck size={12} /> Converted
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></PaginatedTable>
      </div>

      {modal && (
        <LeadModal
          isAdmin={isAdmin}
          productOptions={productOptions}
          systemUsers={systemUsers}
          currentUser={user}
          lead={modal.lead}
          isNew={modal.isNew}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {confirmConvertLead && (
        <ModalBackdrop className="modal-backdrop" onClick={() => !converting && setConfirmConvertLead(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <UserCheck size={22} style={{ color: '#10b981' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Convert to Active Customer
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Confirmation Required
                </p>
              </div>
            </div>

            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              Are you sure you want to convert <strong style={{ color: 'var(--text-primary)' }}>{confirmConvertLead.name}</strong> into an active customer account?

              <div style={{
                marginTop: 12,
                padding: '12px 14px',
                background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                borderRadius: 10,
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 13
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Phone:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{confirmConvertLead.phone || '—'}</strong>
                </div>
                {confirmConvertLead.company && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Company:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{confirmConvertLead.company}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Service:</span>
                  <span className="badge badge-purple" style={{ fontSize: 11 }}>{confirmConvertLead.service || 'General Service'}</span>
                </div>
                {confirmConvertLead.source && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Source:</span>
                    <strong style={{ color: SOURCE_COLOR[confirmConvertLead.source] || 'var(--text-primary)' }}>
                      {confirmConvertLead.source}
                    </strong>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmConvertLead(null)}
                disabled={converting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ background: '#10b981', borderColor: '#10b981' }}
                onClick={handleConfirmConvert}
                disabled={converting}
              >
                {converting ? 'Converting...' : 'Yes, Convert to Customer'}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </div>
  )
}

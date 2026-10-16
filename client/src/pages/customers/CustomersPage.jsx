import ModalBackdrop from '../../components/ModalBackdrop'
import { useState, useEffect } from 'react'
import ThemeDatePicker from '../../components/ThemeDatePicker'
import ThemeSelect from '../../components/ThemeSelect'
import { apiGet, apiGetAll, apiPost, apiPut } from '../../utils/api'
import { Plus, Search, X, Check, Eye, Pencil, MessageSquare, PhoneCall } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const SERVICES = ['GPS', 'CCTV', 'Website', 'SMS', 'RCS', 'Voice', 'Waba']

const getServicesArray = (srv) => {
  if (Array.isArray(srv)) return srv
  if (typeof srv === 'string') {
    try {
      const parsed = JSON.parse(srv)
      if (Array.isArray(parsed)) return parsed
    } catch {
      return srv.split(',').map(s => s.trim()).filter(Boolean)
    }
  }
  return []
}

const combineServices = (selected, others) => {
  const all = [...selected, ...others.split(',').map(service => service.trim()).filter(Boolean)]
  return all.filter((service, index) => all.findIndex(item => item.toLowerCase() === service.toLowerCase()) === index)
}

const EMPTY_FORM = {
  name: '', contact: '', phone: '', email: '', address: '',
  services: [], otherServices: '', vehicles: 0, cctv: 0, domain: '', hosting: '', websiteUrl: '', renewalDate: '', birthday: '', anniversary: '', status: 'Active', assignedTo: ''
}

const displayDate = value => {
  const date = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

export default function CustomersPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canSendGreetings = ['super_admin', 'director', 'sales_manager', 'sales_executive'].includes(user?.role)
  const [customers, setCustomers] = useState([])
  const [systemUsers, setSystemUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [serviceFilter, setServiceFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [greetingCustomer, setGreetingCustomer] = useState(null)
  const [greetingChannel, setGreetingChannel] = useState('sms')
  const [greetingOccasion, setGreetingOccasion] = useState('birthday')
  const [greetingPreview, setGreetingPreview] = useState(null)
  const [greetingError, setGreetingError] = useState('')
  const [greetingLoading, setGreetingLoading] = useState(false)
  const [greetingSending, setGreetingSending] = useState(false)
  const [greetingRequestId, setGreetingRequestId] = useState('')

  useEffect(() => {
    apiGetAll('/customers')
      .then(data => setCustomers(data))
      .catch(err => toast.error('Failed to load customers: ' + err.message))
      .finally(() => setLoading(false))
    apiGet('/system-users')
      .then(data => setSystemUsers(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Could not load system users for customer assignment.'))
  }, [])

  useEffect(() => {
    if (!greetingCustomer) return
    let active = true
    setGreetingLoading(true)
    setGreetingPreview(null)
    setGreetingError('')
    apiGet(`/customers/${greetingCustomer.id}/greetings/preview?occasion=${greetingOccasion}&channel=${greetingChannel}`)
      .then(preview => {
        if (!active) return
        setGreetingPreview(preview)
        setGreetingRequestId(crypto.randomUUID())
      })
      .catch(error => { if (active) setGreetingError(error.message) })
      .finally(() => { if (active) setGreetingLoading(false) })
    return () => { active = false }
  }, [greetingCustomer, greetingChannel, greetingOccasion])

  const openGreeting = (customer, channel) => {
    setGreetingCustomer(customer)
    setGreetingChannel(channel)
    setGreetingOccasion(customer.birthday ? 'birthday' : 'anniversary')
  }

  const sendGreeting = async () => {
    if (!greetingPreview || !greetingRequestId || greetingSending) return
    setGreetingSending(true)
    setGreetingError('')
    try {
      const result = await apiPost(`/customers/${greetingCustomer.id}/greetings/send`, {
        occasion: greetingOccasion,
        channel: greetingChannel,
        requestId: greetingRequestId,
        previewHash: greetingPreview.previewHash
      })
      toast.success(result.message)
      setGreetingCustomer(null)
    } catch (error) {
      setGreetingError(`${error.message} Close this popup and check the provider before sending again.`)
      setGreetingPreview(null)
    } finally {
      setGreetingSending(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingCustomer(null)
    setForm({ ...EMPTY_FORM })
    setModalOpen(true)
  }

  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer)
    setForm({
      name: customer.name || '',
      contact: customer.contact || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      services: getServicesArray(customer.services).filter(service => SERVICES.includes(service)),
      otherServices: getServicesArray(customer.services).filter(service => !SERVICES.includes(service)).join(', '),
      vehicles: customer.vehicles || 0,
      cctv: customer.cctv || 0,
      domain: customer.domain || '',
      hosting: customer.hosting || '',
      websiteUrl: customer.websiteUrl || '',
      renewalDate: customer.renewalDate ? String(customer.renewalDate).slice(0, 10) : '',
      birthday: customer.birthday ? String(customer.birthday).slice(0, 10) : '',
      anniversary: customer.anniversary ? String(customer.anniversary).slice(0, 10) : '',
      status: customer.status || 'Active',
      assignedTo: customer.assignedTo || ''
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name || !form.phone) return toast.error('Name and phone are required')
    try {
      const hasGPS = form.services.includes('GPS')
      const hasCCTV = form.services.includes('CCTV')
      const hasWebsite = form.services.includes('Website')
      const { otherServices, ...customerForm } = form
      const payload = {
        ...customerForm,
        services: JSON.stringify(combineServices(form.services, otherServices)),
        vehicles: hasGPS ? (Number(form.vehicles) || 0) : 0,
        cctv: hasCCTV ? (Number(form.cctv) || 0) : 0,
        domain: hasWebsite ? (form.domain || '') : '',
        hosting: hasWebsite ? (form.hosting || '') : ''
      }
      if (editingCustomer) {
        const updated = await apiPut(`/customers/${editingCustomer.id}`, payload)
        setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? { ...c, ...updated } : c))
        toast.success('Customer details updated successfully!')
      } else {
        const created = await apiPost('/customers', payload)
        setCustomers(prev => [...prev, created])
        toast.success('Customer profile created successfully!')
      }
      setModalOpen(false)
      setEditingCustomer(null)
      setForm({ ...EMPTY_FORM })
    } catch (err) {
      toast.error(err.message)
    }
  }

  const toggleService = (srv) => {
    setForm(prev => {
      const services = prev.services.includes(srv)
        ? prev.services.filter(s => s !== srv)
        : [...prev.services, srv]
      return { ...prev, services }
    })
  }

  const filtered = customers.filter(c => {
    const srvList = getServicesArray(c.services)
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.contact?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
    const matchSrv = serviceFilter === 'All' || srvList.includes(serviceFilter)
    return matchSearch && matchSrv
  })

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading customers...</div>

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div>
          <h1 className="page-title">Customer Management</h1>
          <p className="page-subtitle">Manage client profiles, GST details, service counts and renewal details.</p>
        </div>
        <button className="btn-primary" onClick={handleOpenCreate} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          <Plus size={16} /> New Customer
        </button>
      </div>

      {/* Stats row */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total Customers</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{customers.length}</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Active Subscribers</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', marginTop: 4 }}>{customers.filter(c => c.status === 'Active').length}</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Pending Renewals</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>{customers.filter(c => c.status === 'Pending Renewal').length}</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Overdue Accounts</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444', marginTop: 4 }}>{customers.filter(c => c.status === 'Overdue').length}</div>
        </div>
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 280, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input
            className="input-field"
            style={{ paddingLeft: 36, height: 38 }}
            placeholder="Search customers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['All', ...SERVICES].map(srv => (
            <button
              key={srv}
              onClick={() => setServiceFilter(srv)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                border: `1px solid ${serviceFilter === srv ? '#6366f1' : 'var(--border-subtle)'}`,
                background: serviceFilter === srv ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: serviceFilter === srv ? '#4f46e5' : 'var(--text-secondary)',
                fontWeight: serviceFilter === srv ? 700 : 500,
                whiteSpace: 'nowrap'
              }}
            >
              {srv}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="data-table" style={{ minWidth: 1050 }}>
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Phone</th>
              <th>Birthday</th>
              <th>Anniversary</th>
              <th>Services</th>
              <th>Assigned To</th>
              <th>Next Renewal</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white' }}>
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.contact}</div>
                    </div>
                  </div>
                </td>
                <td style={{ color: '#94a3b8', fontSize: 13 }}>{c.phone}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>{displayDate(c.birthday)}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>{displayDate(c.anniversary)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {getServicesArray(c.services).map(s => (
                      <span key={s} className="badge badge-purple" style={{ fontSize: 11 }}>{s}</span>
                    ))}
                  </div>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{c.assignedTo || '—'}</td>
                <td style={{ color: '#94a3b8', fontSize: 13 }}>{c.renewalDate || '—'}</td>
                <td>
                  <span className={`badge ${c.status === 'Active' ? 'badge-success' : c.status === 'Overdue' ? 'badge-danger' : 'badge-warning'}`}>
                    {c.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={() => navigate(`/customers/${c.id}`)}
                      title="View Profile"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer'
                      }}
                    >
                      <Eye size={15} style={{ color: '#6366f1' }} />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(c)}
                      title="Edit Customer"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', cursor: 'pointer'
                      }}
                    >
                      <Pencil size={15} style={{ color: '#f59e0b' }} />
                    </button>
                    {canSendGreetings && <button type="button" onClick={() => openGreeting(c, 'sms')} disabled={!c.birthday && !c.anniversary}
                      title={c.birthday || c.anniversary ? 'Send greeting SMS' : 'Add a birthday or anniversary first'}
                      className="btn-secondary" style={{ padding: '6px 8px', fontSize: 12, whiteSpace: 'nowrap', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                      <MessageSquare size={14} /> Send SMS
                    </button>}
                    {canSendGreetings && <button type="button" onClick={() => openGreeting(c, 'voice')} disabled={!c.birthday && !c.anniversary}
                      title={c.birthday || c.anniversary ? 'Send greeting voice call' : 'Add a birthday or anniversary first'}
                      className="btn-secondary" style={{ padding: '6px 8px', fontSize: 12, whiteSpace: 'nowrap', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                      <PhoneCall size={14} /> Send Voice
                    </button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <ModalBackdrop className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingCustomer ? 'Edit Customer Details' : 'Create Customer Profile'}
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-grid-2" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Company Name *</label>
                  <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Person</label>
                  <input className="input-field" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input className="input-field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input className="input-field" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Address</label>
                  <input className="input-field" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Subscribed Services</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {SERVICES.map(srv => {
                    const isSel = form.services.includes(srv)
                    return (
                      <button
                        type="button" key={srv}
                        onClick={() => toggleService(srv)}
                        style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6,
                          border: `1px solid ${isSel ? '#6366f1' : 'var(--border-color)'}`,
                          background: isSel ? 'rgba(99,102,241,0.15)' : 'transparent',
                          color: isSel ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {isSel && <Check size={14} />} {srv}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" htmlFor="customer-other-services">Others</label>
                <input
                  id="customer-other-services"
                  className="input-field"
                  value={form.otherServices}
                  onChange={e => setForm(f => ({ ...f, otherServices: e.target.value }))}
                  placeholder="Enter other services, separated by commas"
                />
              </div>

              {/* Conditional Service Fields */}
              {(form.services.includes('GPS') || form.services.includes('CCTV')) && (
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
                  {form.services.includes('GPS') && (
                    <div className="form-group">
                      <label className="form-label">Vehicle Count (GPS)</label>
                      <input
                        className="input-field"
                        type="number"
                        min="0"
                        value={form.vehicles}
                        onChange={e => setForm(f => ({ ...f, vehicles: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                  )}
                  {form.services.includes('CCTV') && (
                    <div className="form-group">
                      <label className="form-label">Camera Count (CCTV)</label>
                      <input
                        className="input-field"
                        type="number"
                        min="0"
                        value={form.cctv}
                        onChange={e => setForm(f => ({ ...f, cctv: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>
              )}

              {form.services.includes('Website') && (
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Domain Name</label>
                    <input
                      className="input-field"
                      value={form.domain}
                      onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                      placeholder="clientdomain.com"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hosting Details</label>
                    <input
                      className="input-field"
                      value={form.hosting}
                      onChange={e => setForm(f => ({ ...f, hosting: e.target.value }))}
                      placeholder="e.g. AWS, Hostinger"
                    />
                  </div>
                </div>
              )}

              {/* Customer dates, account status and assignment */}
              <div className="form-grid-2" style={{ marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">Contact Birthday</label>
                  <ThemeDatePicker value={form.birthday} minYear={1900} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Anniversary</label>
                  <ThemeDatePicker value={form.anniversary} minYear={1900} onChange={e => setForm(f => ({ ...f, anniversary: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Renewal Date</label>
                  <ThemeDatePicker value={form.renewalDate} onChange={e => setForm(f => ({ ...f, renewalDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Status</label>
                  <ThemeSelect
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  >
                    <option value="Active">Active</option>
                    <option value="Pending Renewal">Pending Renewal</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Inactive">Inactive</option>
                  </ThemeSelect>
                </div>
                <div className="form-group">
                  <label className="form-label">Assigned Executive</label>
                  <ThemeSelect
                    value={form.assignedTo || ''}
                    onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                  >
                    <option value="">Select Executive</option>
                    {form.assignedTo && !systemUsers.some(u => u.name === form.assignedTo) && (
                      <option value={form.assignedTo}>{form.assignedTo}</option>
                    )}
                    {systemUsers.map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </ThemeSelect>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">
                  {editingCustomer ? 'Save Changes' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdrop>
      )}

      {greetingCustomer && (
        <ModalBackdrop className="modal-backdrop" onClick={() => { if (!greetingSending) setGreetingCustomer(null) }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: 0 }}>Review greeting before sending</h2>
              <button type="button" disabled={greetingSending} onClick={() => setGreetingCustomer(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} aria-label="Close greeting preview"><X size={20} /></button>
            </div>
            <div className="form-grid-2" style={{ marginBottom: 18 }}>
              <div className="form-group">
                <label className="form-label">Occasion</label>
                <ThemeSelect value={greetingOccasion} disabled={greetingSending} onChange={e => setGreetingOccasion(e.target.value)}>
                  <option value="birthday" disabled={!greetingCustomer.birthday}>Birthday</option>
                  <option value="anniversary" disabled={!greetingCustomer.anniversary}>Anniversary</option>
                </ThemeSelect>
              </div>
              <div className="form-group">
                <label className="form-label">Channel</label>
                <ThemeSelect value={greetingChannel} disabled={greetingSending} onChange={e => setGreetingChannel(e.target.value)}>
                  <option value="sms">SMS</option>
                  <option value="voice">Voice Call</option>
                </ThemeSelect>
              </div>
            </div>
            {greetingLoading && <p style={{ color: 'var(--text-secondary)' }}>Loading preview...</p>}
            {greetingError && <p role="alert" style={{ color: '#ef4444', fontSize: 13 }}>{greetingError}</p>}
            {greetingPreview && (
              <div style={{ display: 'grid', gap: 12, fontSize: 13, color: 'var(--text-primary)' }}>
                <div><strong>Customer:</strong> {greetingPreview.customerName}{greetingPreview.contactName ? ` — ${greetingPreview.contactName}` : ''}</div>
                <div><strong>Recipient:</strong> {greetingPreview.phone}</div>
                <div><strong>Occasion date:</strong> {displayDate(greetingPreview.date)}</div>
                {!greetingPreview.isToday && <div style={{ color: '#b45309' }}>This occasion is not today. Check the date before sending.</div>}
                <div><strong>{greetingChannel === 'sms' ? 'SMS message' : 'Voice script or recording'}:</strong>
                  <div style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', padding: 12, borderRadius: 8, marginTop: 6 }}>
                    {greetingPreview.message || 'No preview text was provided in Settings. Check the provider template before sending.'}
                  </div>
                </div>
                {greetingPreview.templateId && <div><strong>Provider template ID:</strong> {greetingPreview.templateId}</div>}
                <div><strong>Provider URL (credentials hidden):</strong>
                  <div style={{ overflowWrap: 'anywhere', fontFamily: 'monospace', fontSize: 11, marginTop: 5 }}>{greetingPreview.url}</div>
                </div>
                {greetingPreview.lastSend && <div style={{ color: 'var(--text-secondary)' }}>Last attempt: {greetingPreview.lastSend.status} on {new Date(greetingPreview.lastSend.createdAt).toLocaleString('en-IN')}</div>}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button type="button" className="btn-secondary" disabled={greetingSending} onClick={() => setGreetingCustomer(null)}>Cancel</button>
              <button type="button" className="btn-primary" disabled={!greetingPreview || greetingLoading || greetingSending} onClick={sendGreeting}>
                {greetingSending ? 'Sending...' : `Confirm and send ${greetingChannel === 'sms' ? 'SMS' : 'voice call'}`}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

    </div>
  )
}

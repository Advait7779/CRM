import { useState, useEffect } from 'react'
import ThemeDatePicker from '../../components/ThemeDatePicker'
import { apiGetAll, apiPost, apiDelete } from '../../utils/api'
import { Plus, Search, X, Check, Eye, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'

const SERVICES = ['GPS', 'CCTV', 'Website', 'SMS', 'RCS', 'Voice']

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

const EMPTY_FORM = {
  name: '', contact: '', phone: '', email: '', gst: '', address: '',
  services: [], vehicles: 0, cctv: 0, domain: '', hosting: '', websiteUrl: '', renewalDate: '', status: 'Active'
}

export default function CustomersPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [serviceFilter, setServiceFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmDeleteCustomer, setConfirmDeleteCustomer] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  useEffect(() => {
    apiGetAll('/customers')
      .then(data => setCustomers(data))
      .catch(err => toast.error('Failed to load customers: ' + err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name || !form.phone) return toast.error('Name and phone are required')
    try {
      const payload = {
        ...form,
        services: JSON.stringify(form.services),
        vehicles: Number(form.vehicles) || 0,
        cctv: Number(form.cctv) || 0
      }
      const created = await apiPost('/customers', payload)
      setCustomers(prev => [...prev, created])
      toast.success('Customer profile created successfully!')
      setModalOpen(false)
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
        <button className="btn-primary" onClick={() => setModalOpen(true)} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
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
        <table className="data-table" style={{ minWidth: 850 }}>
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>GST Details</th>
              <th>Phone</th>
              <th>Services</th>
              <th>Vehicles</th>
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
                <td style={{ color: '#94a3b8', fontSize: 13 }}>{c.gst || '—'}</td>
                <td style={{ color: '#94a3b8', fontSize: 13 }}>{c.phone}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {getServicesArray(c.services).map(s => (
                      <span key={s} className="badge badge-purple" style={{ fontSize: 11 }}>{s}</span>
                    ))}
                  </div>
                </td>
                <td style={{ color: '#f1f5f9', fontWeight: 600 }}>{c.vehicles || '—'}</td>
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
                      title="Delete Customer"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer'
                      }}
                      onClick={() => setConfirmDeleteCustomer(c)}
                    >
                      <Trash2 size={15} style={{ color: '#ef4444' }} />
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
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Create Customer Profile</h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
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
                <div className="form-group">
                  <label className="form-label">GST Number</label>
                  <input className="input-field" value={form.gst} onChange={e => setForm(f => ({ ...f, gst: e.target.value.toUpperCase() }))} placeholder="e.g. 27AAAAA1111A1Z1" />
                </div>
                <div className="form-group">
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

              <div className="form-grid-3" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Vehicle Count (GPS)</label>
                  <input className="input-field" type="number" value={form.vehicles} onChange={e => setForm(f => ({ ...f, vehicles: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Camera Count (CCTV)</label>
                  <input className="input-field" type="number" value={form.cctv} onChange={e => setForm(f => ({ ...f, cctv: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Renewal Date</label>
                  <ThemeDatePicker value={form.renewalDate} onChange={e => setForm(f => ({ ...f, renewalDate: e.target.value }))} />
                </div>
              </div>

              <div className="form-grid-2" style={{ marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">Domain Name</label>
                  <input className="input-field" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="clientdomain.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Hosting Details</label>
                  <input className="input-field" value={form.hosting} onChange={e => setForm(f => ({ ...f, hosting: e.target.value }))} placeholder="e.g. AWS, Hostinger" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteCustomer)}
        onClose={() => setConfirmDeleteCustomer(null)}
        title="Delete Customer"
        subtitle={confirmDeleteCustomer ? `ID: ${confirmDeleteCustomer.id}` : ''}
        message={
          confirmDeleteCustomer ? (
            <>Are you sure you want to delete customer <strong style={{ color: 'var(--text-primary)' }}>{confirmDeleteCustomer.name}</strong>? This will remove the customer profile from the system.</>
          ) : null
        }
        confirmText="Delete Customer"
        onConfirm={async () => {
          try {
            await apiDelete(`/customers/${confirmDeleteCustomer.id}`)
            setCustomers(current => current.filter(item => item.id !== confirmDeleteCustomer.id))
            toast.success(`Customer ${confirmDeleteCustomer.name} deleted`)
            setConfirmDeleteCustomer(null)
          } catch (error) { toast.error(error.message) }
        }}
      />
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, MapPin, Upload, Download, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiDelete, apiDownload, apiGet, apiPut, apiUpload } from '../../utils/api'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'

function serviceList(value) {
  if (Array.isArray(value)) return value
  try { return JSON.parse(value || '[]') } catch { return [] }
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [uploading, setUploading] = useState(false)
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(null)

  const load = useCallback(async () => {
    try {
      const result = await apiGet(`/customers/${id}/overview`)
      setData(result)
      setForm(result.customer)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const saveProfile = async (event) => {
    event.preventDefault()
    try {
      const customer = await apiPut(`/customers/${id}`, {
        name: form.name,
        contact: form.contact,
        phone: form.phone,
        email: form.email,
        gst: form.gst,
        address: form.address,
        status: form.status
      })
      setData(prev => ({ ...prev, customer }))
      setEditing(false)
      toast.success('Customer profile updated')
    } catch (error) {
      toast.error(error.message)
    }
  }

  const uploadDocument = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const body = new FormData()
    body.append('document', file)
    setUploading(true)
    try {
      await apiUpload(`/customers/${id}/documents`, body)
      await load()
      toast.success('Document uploaded')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const deleteDocument = async (document) => {
    try {
      await apiDelete(`/documents/${document.id}`)
      setData(prev => ({
        ...prev,
        customer: { ...prev.customer, documents: prev.customer.documents.filter(item => item.id !== document.id) }
      }))
      toast.success('Document deleted')
    } catch (error) {
      toast.error(error.message)
    }
  }

  if (loading) return <div className="glass-card" style={{ padding: 30 }}>Loading customer...</div>
  if (!data) return <div className="glass-card" style={{ padding: 30 }}>Customer could not be loaded.</div>

  const { customer, invoices, tickets, renewals, installations, quotations } = data
  const tabs = ['overview', 'services', 'documents', 'invoices', 'tickets']

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate('/customers')} className="btn-secondary" style={{ marginBottom: 16 }}>
        <ArrowLeft size={16} /> Back to Customers
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">{customer.name}</h1>
          <p className="page-subtitle">{customer.contact || 'No contact person'} · GST: {customer.gst || 'Not provided'}</p>
        </div>
        <button className="btn-secondary" onClick={() => setEditing(value => !value)}>
          <Pencil size={15} /> {editing ? 'Cancel Editing' : 'Edit Profile'}
        </button>
      </div>

      {editing && (
        <form className="glass-card" onSubmit={saveProfile} style={{ padding: 22, marginBottom: 20 }}>
          <div className="form-grid-3">
            {[
              ['name', 'Company Name', 'text'],
              ['contact', 'Contact Person', 'text'],
              ['phone', 'Phone', 'text'],
              ['email', 'Email', 'email'],
              ['gst', 'GSTIN', 'text'],
              ['status', 'Status', 'text']
            ].map(([field, label, type]) => (
              <div className="form-group" key={field}>
                <label className="form-label">{label}</label>
                <input className="input-field" type={type} value={form[field] || ''} onChange={e => setForm(current => ({ ...current, [field]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Address</label>
            <textarea className="input-field" rows={2} value={form.address || ''} onChange={e => setForm(current => ({ ...current, address: e.target.value }))} />
          </div>
          <button className="btn-primary" type="submit" style={{ marginTop: 14 }}>Save Customer</button>
        </form>
      )}

      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-subtle)', marginBottom: 24, overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
            color: activeTab === tab ? '#6366f1' : 'var(--text-secondary)',
            borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
            textTransform: 'capitalize', fontWeight: 600
          }}>{tab}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="form-grid-2">
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 18 }}>Contact Profile</h3>
            <p><Phone size={15} /> {customer.phone}</p>
            <p style={{ marginTop: 12 }}><Mail size={15} /> {customer.email || 'No email'}</p>
            <p style={{ marginTop: 12 }}><MapPin size={15} /> {customer.address || 'No address'}</p>
          </div>
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 18 }}>Relationship Summary</h3>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div><strong>{invoices.length}</strong><div className="text-muted">Invoices</div></div>
              <div><strong>{tickets.length}</strong><div className="text-muted">Tickets</div></div>
              <div><strong>{installations.length}</strong><div className="text-muted">Installations</div></div>
              <div><strong>{quotations.length}</strong><div className="text-muted">Quotations</div></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'services' && (
        <div className="glass-card" style={{ padding: 24 }}>
          <h3>Active Services</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
            {serviceList(customer.services).map(service => <span className="badge badge-primary" key={service}>{service}</span>)}
            {serviceList(customer.services).length === 0 && <span className="text-muted">No services recorded.</span>}
          </div>
          <h3 style={{ marginTop: 28 }}>Renewals</h3>
          <table className="data-table" style={{ marginTop: 12 }}>
            <thead><tr><th>Type</th><th>Next Due</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {renewals.map(item => <tr key={item.id}><td>{item.type}</td><td>{item.nextDue}</td><td>{item.amount}</td><td>{item.status}</td></tr>)}
              {renewals.length === 0 && <tr><td colSpan="4">No renewal records.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {activeTab === 'documents' && (
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Customer Documents</h3>
            <label className="btn-primary" style={{ cursor: 'pointer' }}>
              <Upload size={15} /> {uploading ? 'Uploading...' : 'Upload'}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt" hidden disabled={uploading} onChange={uploadDocument} />
            </label>
          </div>
          <table className="data-table" style={{ marginTop: 16 }}>
            <thead><tr><th>File</th><th>Uploaded</th><th>Size</th><th>Actions</th></tr></thead>
            <tbody>
              {(customer.documents || []).map(document => (
                <tr key={document.id}>
                  <td>{document.originalName}</td>
                  <td>{new Date(document.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>{(document.size / 1024 / 1024).toFixed(2)} MB</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-secondary" onClick={() => apiDownload(`/documents/${document.id}/download`, document.originalName).catch(error => toast.error(error.message))}><Download size={14} /></button>
                    <button className="btn-secondary" onClick={() => setConfirmDeleteDoc(document)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {(customer.documents || []).length === 0 && <tr><td colSpan="4">No documents uploaded.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr><th>Invoice</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {invoices.map(item => <tr key={item.id}><td>{item.id}</td><td>{item.date}</td><td>{money(item.total)}</td><td>{item.status}</td></tr>)}
              {invoices.length === 0 && <tr><td colSpan="4">No invoices.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr><th>Subject</th><th>Service</th><th>Priority</th><th>Status</th></tr></thead>
            <tbody>
              {tickets.map(item => <tr key={item.id}><td>{item.subject}</td><td>{item.service}</td><td>{item.priority}</td><td>{item.status}</td></tr>)}
              {tickets.length === 0 && <tr><td colSpan="4">No service tickets.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteDoc)}
        onClose={() => setConfirmDeleteDoc(null)}
        title="Delete Document"
        subtitle={confirmDeleteDoc ? `File: ${confirmDeleteDoc.originalName}` : ''}
        message={
          confirmDeleteDoc ? (
            <>Are you sure you want to delete document <strong style={{ color: 'var(--text-primary)' }}>{confirmDeleteDoc.originalName}</strong>? This action cannot be undone.</>
          ) : null
        }
        confirmText="Delete Document"
        onConfirm={async () => {
          if (!confirmDeleteDoc) return
          await deleteDocument(confirmDeleteDoc)
          setConfirmDeleteDoc(null)
        }}
      />
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Download, FileUp, Check, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiDelete, apiDownload, apiGetAll, apiPut, apiUpload } from '../../utils/api'
import ThemeSelect from '../../components/ThemeSelect'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'

const statusClass = status => status === 'Approved' ? 'badge-success' : status === 'Rejected' || status === 'Cancelled' ? 'badge-danger' : 'badge-warning'

export default function HRManagementPage() {
  const [employees, setEmployees] = useState([])
  const [leaves, setLeaves] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [documents, setDocuments] = useState([])
  const [documentType, setDocumentType] = useState('Identity')
  const [file, setFile] = useState(null)
  const [tab, setTab] = useState('leaves')
  const [busy, setBusy] = useState(false)
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(null)

  const load = useCallback(async () => {
    try {
      const [employeeRows, leaveRows] = await Promise.all([apiGetAll('/employees'), apiGetAll('/leaves')])
      setEmployees(employeeRows)
      setLeaves(leaveRows)
      setSelectedEmployeeId(current => current || String(employeeRows[0]?.id || ''))
    } catch (error) { toast.error(error.message) }
  }, [])

  const loadDocuments = useCallback(async () => {
    if (!selectedEmployeeId) return setDocuments([])
    try { setDocuments(await apiGetAll(`/employees/${selectedEmployeeId}/documents`)) } catch (error) { toast.error(error.message) }
  }, [selectedEmployeeId])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadDocuments() }, [loadDocuments])

  const review = async (id, status) => {
    try {
      const updated = await apiPut(`/leaves/${id}/status`, { status })
      setLeaves(rows => rows.map(row => row.id === id ? { ...row, ...updated } : row))
      toast.success(`Leave ${status.toLowerCase()}`)
    } catch (error) { toast.error(error.message) }
  }

  const upload = async event => {
    event.preventDefault()
    if (!selectedEmployeeId || !file) return toast.error('Select an employee and file')
    const form = new FormData()
    form.append('type', documentType)
    form.append('document', file)
    setBusy(true)
    try {
      await apiUpload(`/employees/${selectedEmployeeId}/documents`, form)
      toast.success('Employee document uploaded')
      setFile(null)
      event.target.reset()
      await loadDocuments()
    } catch (error) { toast.error(error.message) } finally { setBusy(false) }
  }

  const removeDocument = async id => {
    try { await apiDelete(`/employee-documents/${id}`); toast.success('Document deleted'); await loadDocuments() } catch (error) { toast.error(error.message) }
  }

  return <div className="animate-fade-in">
    <div className="page-header"><div><h1 className="page-title">HRMS</h1><p className="page-subtitle">Review leave requests and securely manage employee documents.</p></div></div>
    <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border-subtle)', marginBottom: 20 }}>
      {[['leaves', `Leave Requests (${leaves.filter(row => row.status === 'Pending').length} pending)`], ['documents', 'Employee Documents']].map(([id, label]) => <button key={id} onClick={() => setTab(id)} style={{ padding: '11px 16px', background: 'none', border: 0, borderBottom: tab === id ? '2px solid #6366f1' : '2px solid transparent', color: tab === id ? '#6366f1' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}>{label}</button>)}
    </div>

    {tab === 'leaves' && <div className="glass-card" style={{ overflowX: 'auto' }}><table className="data-table" style={{ minWidth: 850 }}><thead><tr><th>Employee</th><th>Department</th><th>Dates</th><th>Type</th><th>Days</th><th>Reason</th><th>Status</th><th>Review</th></tr></thead><tbody>{leaves.map(row => <tr key={row.id}><td>{row.employee?.name || `Employee #${row.employeeId}`}</td><td>{row.employee?.dept || '—'}</td><td>{String(row.startDate).slice(0,10)} – {String(row.endDate).slice(0,10)}</td><td>{row.type}</td><td>{row.days}</td><td style={{ maxWidth: 240 }}>{row.reason}</td><td><span className={`badge ${statusClass(row.status)}`}>{row.status}</span></td><td>{row.status === 'Pending' ? <div style={{ display: 'flex', gap: 6 }}><button className="btn-secondary" title="Approve leave" onClick={() => review(row.id, 'Approved')}><Check size={15} color="#10b981" /></button><button className="btn-secondary" title="Reject leave" onClick={() => review(row.id, 'Rejected')}><X size={15} color="#ef4444" /></button></div> : `${row.reviewedBy || '—'}`}</td></tr>)}{!leaves.length && <tr><td colSpan="8">No leave requests.</td></tr>}</tbody></table></div>}

    {tab === 'documents' && <div>
      <form className="glass-card" style={{ padding: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 16 }} onSubmit={upload}>
        <div style={{ minWidth: 220 }}>
          <label className="form-label">Employee</label>
          <ThemeSelect value={selectedEmployeeId} onChange={event => setSelectedEmployeeId(event.target.value)} required>
            {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} · {employee.dept}</option>)}
          </ThemeSelect>
        </div>
        <div style={{ minWidth: 180 }}>
          <label className="form-label">Document type</label>
          <ThemeSelect value={documentType} onChange={event => setDocumentType(event.target.value)}>
            <option value="Identity">Identity</option>
            <option value="Address Proof">Address Proof</option>
            <option value="Qualification">Qualification</option>
            <option value="Employment">Employment</option>
            <option value="Other">Other</option>
          </ThemeSelect>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}><label className="form-label">File</label><input className="input-field" type="file" onChange={event => setFile(event.target.files?.[0] || null)} required /></div>
        <button className="btn-primary" disabled={busy}><FileUp size={15} /> Upload</button>
      </form>
      <div className="glass-card" style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>Type</th><th>File</th><th>Size</th><th>Uploaded by</th><th>Date</th><th>Actions</th></tr></thead><tbody>{documents.map(doc => <tr key={doc.id}><td>{doc.type}</td><td>{doc.originalName}</td><td>{(Number(doc.size) / 1024 / 1024).toFixed(2)} MB</td><td>{doc.uploadedBy || '—'}</td><td>{new Date(doc.createdAt).toLocaleDateString('en-IN')}</td><td><button className="btn-secondary" onClick={() => apiDownload(`/employee-documents/${doc.id}/download`, doc.originalName).catch(error => toast.error(error.message))}><Download size={14} /></button> <button className="btn-secondary" onClick={() => setConfirmDeleteDoc(doc)}><Trash2 size={14} /></button></td></tr>)}{!documents.length && <tr><td colSpan="6">No documents uploaded for this employee.</td></tr>}</tbody></table></div>
    </div>}

    <ConfirmDeleteModal
      isOpen={Boolean(confirmDeleteDoc)}
      onClose={() => setConfirmDeleteDoc(null)}
      title="Delete Document"
      subtitle={confirmDeleteDoc ? `File: ${confirmDeleteDoc.originalName}` : ''}
      message={
        confirmDeleteDoc ? (
          <>Are you sure you want to delete employee document <strong style={{ color: 'var(--text-primary)' }}>{confirmDeleteDoc.originalName}</strong>? This action cannot be undone.</>
        ) : null
      }
      confirmText="Delete Document"
      onConfirm={async () => {
        if (!confirmDeleteDoc) return
        await removeDocument(confirmDeleteDoc.id)
        setConfirmDeleteDoc(null)
      }}
    />
  </div>
}
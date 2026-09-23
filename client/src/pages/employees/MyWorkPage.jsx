import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, FileText, CalendarDays, Download, Trash2, Printer, LogIn, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiDelete, apiDownload, apiGet, apiPost, apiPut, apiUpload } from '../../utils/api'
import { localDateString } from '../../utils/date'
import ThemeSelect from '../../components/ThemeSelect'
import ThemeDatePicker from '../../components/ThemeDatePicker'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'

const today = localDateString()
const currentPeriod = today.slice(0, 7)
const leaveInitial = { type: 'Paid', startDate: '', endDate: '', reason: '' }

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const statusClass = status => status === 'Approved' || status === 'Paid' || status === 'Present' ? 'badge-success' : status === 'Rejected' || status === 'Absent' ? 'badge-danger' : 'badge-warning'

export default function MyWorkPage() {
  const [data, setData] = useState(null)
  const [payslips, setPayslips] = useState([])
  const [tab, setTab] = useState('attendance')
  const [leave, setLeave] = useState(leaveInitial)
  const [documentType, setDocumentType] = useState('Identity')
  const [documentFile, setDocumentFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [selectedPayslip, setSelectedPayslip] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)

  const load = useCallback(async () => {
    try {
      const [hr, payrollRows] = await Promise.all([apiGet(`/my/hr?period=${currentPeriod}`), apiGet(`/my/payslips?period=${currentPeriod}`)])
      setData(hr)
      setPayslips(payrollRows)
    } catch (error) { toast.error(error.message) }
  }, [])

  useEffect(() => { load() }, [load])

  const todayAttendance = useMemo(() => data?.attendance?.find(row => String(row.date).slice(0, 10) === today), [data])

  const attendanceAction = async action => {
    if (!data?.employee) return
    const now = new Date().toTimeString().slice(0, 8)
    const checkIn = action === 'in' ? now : todayAttendance?.checkIn
    const checkOut = action === 'out' ? now : null
    let hoursWorked = null
    if (checkIn && checkOut) hoursWorked = Math.max(0, (new Date(`${today}T${checkOut}`) - new Date(`${today}T${checkIn}`)) / 3600000)
    setBusy(true)
    try {
      await apiPut(`/attendance/${data.employee.id}`, { date: today, status: 'Present', checkIn, checkOut, hoursWorked })
      toast.success(action === 'in' ? 'Checked in successfully' : 'Checked out successfully')
      await load()
    } catch (error) { toast.error(error.message) } finally { setBusy(false) }
  }

  const requestLeave = async event => {
    event.preventDefault()
    setBusy(true)
    try {
      await apiPost('/leaves', leave)
      toast.success('Leave request submitted')
      setLeave(leaveInitial)
      await load()
    } catch (error) { toast.error(error.message) } finally { setBusy(false) }
  }

  const cancelLeave = async id => {
    try { await apiDelete(`/leaves/${id}`); toast.success('Leave request cancelled'); await load() } catch (error) { toast.error(error.message) }
  }

  const uploadDocument = async event => {
    event.preventDefault()
    if (!documentFile) return toast.error('Choose a document first')
    const form = new FormData()
    form.append('type', documentType)
    form.append('document', documentFile)
    setBusy(true)
    try {
      await apiUpload('/my/documents', form)
      toast.success('Document uploaded')
      setDocumentFile(null)
      event.target.reset()
      await load()
    } catch (error) { toast.error(error.message) } finally { setBusy(false) }
  }

  const deleteDocument = async id => {
    try { await apiDelete(`/employee-documents/${id}`); toast.success('Document deleted'); await load() } catch (error) { toast.error(error.message) }
  }

  if (!data) return <div style={{ padding: 50, color: 'var(--text-secondary)' }}>Loading your work records...</div>
  if (!data.employee) return (
    <div className="animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">My Work</h1><p className="page-subtitle">Employee self-service</p></div></div>
      <div className="glass-card" style={{ padding: 24, maxWidth: 640 }}>
        <h3 style={{ margin: '0 0 8px' }}>Employee profile not linked</h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>Ask an administrator to create or update your employee record using the same email address as your login. Attendance, leave, documents and payslips will become available after the accounts are linked.</p>
      </div>
    </div>
  )
  const payroll = data.payroll

  return (
    <div className="animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">My Work</h1><p className="page-subtitle">Attendance, leave, documents and payslips for {data.employee.name}.</p></div></div>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', borderBottom: '1px solid var(--border-subtle)', marginBottom: 22 }}>
        {[['attendance', 'Attendance'], ['leave', 'Leave'], ['documents', 'Documents'], ['payslips', 'Payslips']].map(([id, label]) => <button key={id} onClick={() => setTab(id)} style={{ padding: '11px 16px', whiteSpace: 'nowrap', border: 0, borderBottom: tab === id ? '2px solid #6366f1' : '2px solid transparent', background: 'none', color: tab === id ? '#6366f1' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}>{label}</button>)}
      </div>

      {tab === 'attendance' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
        <div className="glass-card" style={{ padding: 22 }}>
          <Clock size={28} color="#6366f1" />
          <h3 style={{ marginTop: 12 }}>Today · {today}</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '8px 0 18px' }}>Status: <span className={`badge ${statusClass(todayAttendance?.status)}`}>{todayAttendance?.status || 'Not checked in'}</span></p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" disabled={busy || Boolean(todayAttendance?.checkIn)} onClick={() => attendanceAction('in')}><LogIn size={16} /> Check In</button>
            <button className="btn-secondary" disabled={busy || !todayAttendance?.checkIn || Boolean(todayAttendance?.checkOut)} onClick={() => attendanceAction('out')}><LogOut size={16} /> Check Out</button>
          </div>
          <div style={{ marginTop: 18, color: 'var(--text-secondary)', fontSize: 13 }}>Check in: {todayAttendance?.checkIn || '—'} · Check out: {todayAttendance?.checkOut || '—'} · Hours: {todayAttendance?.hoursWorked ? Number(todayAttendance.hoursWorked).toFixed(1) : '—'}</div>
        </div>
        <div className="glass-card" style={{ padding: 22 }}><CalendarDays size={28} color="#10b981" /><h3 style={{ marginTop: 12 }}>This month</h3><p style={{ color: 'var(--text-secondary)' }}>{data.attendance.filter(row => ['Present', 'Late'].includes(row.status)).length} days attended · {data.attendance.filter(row => row.status === 'Late').length} late</p></div>
      </div>}

      {tab === 'leave' && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,360px) 1fr', gap: 18, alignItems: 'start' }}>
        <form className="glass-card" style={{ padding: 20 }} onSubmit={requestLeave}>
          <h3>Request Leave</h3>
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Type</label>
            <ThemeSelect value={leave.type} onChange={e => setLeave(v => ({ ...v, type: e.target.value }))}>
              <option value="Paid">Paid</option>
              <option value="Sick">Sick</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Other">Other</option>
            </ThemeSelect>
          </div>
          <div className="form-group" style={{ marginTop: 10 }}>
            <label className="form-label">Start date</label>
            <ThemeDatePicker value={leave.startDate} onChange={e => setLeave(v => ({ ...v, startDate: e.target.value }))} required />
          </div>
          <div className="form-group" style={{ marginTop: 10 }}>
            <label className="form-label">End date</label>
            <ThemeDatePicker min={leave.startDate} value={leave.endDate} onChange={e => setLeave(v => ({ ...v, endDate: e.target.value }))} required />
          </div>
          <div className="form-group" style={{ marginTop: 10 }}>
            <label className="form-label">Reason</label>
            <textarea className="input-field" rows="3" value={leave.reason} onChange={e => setLeave(v => ({ ...v, reason: e.target.value }))} required />
          </div>
          <button className="btn-primary" disabled={busy} style={{ marginTop: 14 }}>Submit Request</button>
        </form>
        <div className="glass-card" style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>Dates</th><th>Type</th><th>Days</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.leaves.map(row => <tr key={row.id}><td>{String(row.startDate).slice(0,10)} – {String(row.endDate).slice(0,10)}</td><td>{row.type}</td><td>{row.days}</td><td><span className={`badge ${statusClass(row.status)}`}>{row.status}</span></td><td>{row.status === 'Pending' && <button className="btn-secondary" onClick={() => setConfirmModal({
          title: 'Cancel Leave Request',
          subtitle: `${String(row.startDate).slice(0, 10)} – ${String(row.endDate).slice(0, 10)} (${row.days} days)`,
          message: 'Are you sure you want to cancel this pending leave request?',
          confirmText: 'Cancel Leave',
          action: () => cancelLeave(row.id)
        })}>Cancel</button>}</td></tr>)}{!data.leaves.length && <tr><td colSpan="5">No leave requests.</td></tr>}</tbody></table></div>
      </div>}

      {tab === 'documents' && <div>
        <form className="glass-card" style={{ padding: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 16 }} onSubmit={uploadDocument}>
          <div style={{ minWidth: 200 }}>
            <label className="form-label">Document type</label>
            <ThemeSelect value={documentType} onChange={e => setDocumentType(e.target.value)}>
              <option value="Identity">Identity</option>
              <option value="Address Proof">Address Proof</option>
              <option value="Qualification">Qualification</option>
              <option value="Employment">Employment</option>
              <option value="Other">Other</option>
            </ThemeSelect>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="form-label">File</label>
            <input className="input-field" type="file" onChange={e => setDocumentFile(e.target.files?.[0] || null)} required />
          </div>
          <button className="btn-primary" disabled={busy}>Upload</button>
        </form>
        <div className="glass-card" style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>Type</th><th>File</th><th>Uploaded</th><th>Actions</th></tr></thead><tbody>{data.documents.map(doc => <tr key={doc.id}><td>{doc.type}</td><td>{doc.originalName}</td><td>{new Date(doc.createdAt).toLocaleDateString('en-IN')}</td><td><button className="btn-secondary" onClick={() => apiDownload(`/employee-documents/${doc.id}/download`, doc.originalName).catch(error => toast.error(error.message))}><Download size={14} /></button> <button className="btn-secondary" onClick={() => setConfirmModal({
          title: 'Delete Document',
          subtitle: `File: ${doc.originalName}`,
          message: `Are you sure you want to delete document "${doc.originalName}"? This action cannot be undone.`,
          confirmText: 'Delete Document',
          action: () => deleteDocument(doc.id)
        })}><Trash2 size={14} /></button></td></tr>)}{!data.documents.length && <tr><td colSpan="4">No documents uploaded.</td></tr>}</tbody></table></div>
      </div>}

      {tab === 'payslips' && <div className="glass-card" style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>Period</th><th>Gross</th><th>Attendance Deduction</th><th>Other Deduction</th><th>Net</th><th>Status</th><th></th></tr></thead><tbody>{payslips.map(row => <tr key={row.id}><td>{row.period}</td><td>{money(row.gross)}</td><td>{money(row.attendanceDeduction)}</td><td>{money(row.deduction)}</td><td><strong>{money(row.net)}</strong></td><td><span className={`badge ${statusClass(row.status)}`}>{row.status}</span></td><td><button className="btn-secondary" onClick={() => setSelectedPayslip(row)}><FileText size={14} /> View</button></td></tr>)}{!payslips.length && payroll && <tr><td>{payroll.period}</td><td>{money(payroll.gross)}</td><td>{money(payroll.attendanceDeduction)}</td><td>{money(payroll.deduction)}</td><td>{money(payroll.net)}</td><td>{payroll.status}</td><td /></tr>}</tbody></table></div>}

      {selectedPayslip && <div className="modal-backdrop" onClick={() => setSelectedPayslip(null)}><div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}><h2>Salary Payslip · {selectedPayslip.period}</h2><p>{data.employee.name} · {data.employee.dept}</p><table style={{ width: '100%', margin: '20px 0' }}><tbody><tr><td>Basic salary</td><td style={{ textAlign: 'right' }}>{money(selectedPayslip.basic)}</td></tr><tr><td>Incentive</td><td style={{ textAlign: 'right' }}>{money(selectedPayslip.incentive)}</td></tr><tr><td>Attendance ({selectedPayslip.absentDays} absent days)</td><td style={{ textAlign: 'right' }}>-{money(selectedPayslip.attendanceDeduction)}</td></tr><tr><td>Other deductions</td><td style={{ textAlign: 'right' }}>-{money(selectedPayslip.deduction)}</td></tr><tr><td><strong>Net salary</strong></td><td style={{ textAlign: 'right' }}><strong>{money(selectedPayslip.net)}</strong></td></tr></tbody></table><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn-secondary" onClick={() => setSelectedPayslip(null)}>Close</button><button className="btn-primary" onClick={() => window.print()}><Printer size={15} /> Print</button></div></div></div>}

      <ConfirmDeleteModal
        isOpen={Boolean(confirmModal)}
        onClose={() => setConfirmModal(null)}
        title={confirmModal?.title || 'Delete Item'}
        subtitle={confirmModal?.subtitle}
        message={confirmModal?.message}
        confirmText={confirmModal?.confirmText || 'Delete'}
        onConfirm={async () => {
          if (!confirmModal?.action) return
          await confirmModal.action()
          setConfirmModal(null)
        }}
      />
    </div>
  )
}
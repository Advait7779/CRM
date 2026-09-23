import { useCallback, useEffect, useState } from 'react'
import { Plus, X, LogOut, CheckCircle2, FileText, Printer, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { localDateString } from '../../utils/date'
import ThemeSelect from '../../components/ThemeSelect'
import { apiGetAll, apiGet, apiPost, apiPut } from '../../utils/api'

const emptyForm = { name: '', dept: 'Sales', role: '', phone: '', email: '', basicSalary: 20000, incentive: 0, deduction: 0 }
const today = localDateString()
const currentPeriod = today.slice(0, 7)

export default function EmployeesPage() {
  const [activeTab, setActiveTab] = useState('list')
  const [employees, setEmployees] = useState([])
  const [attendance, setAttendance] = useState([])
  const [payroll, setPayroll] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [payslipRow, setPayslipRow] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    try {
      const [employeeRows, attendanceRows, payrollRows] = await Promise.all([
        apiGetAll('/employees'),
        apiGet(`/attendance?date=${today}`),
        apiGet(`/payroll?period=${currentPeriod}`)
      ])
      setEmployees(employeeRows)
      setAttendance(attendanceRows)
      setPayroll(payrollRows)
    } catch (error) { toast.error(`Failed to load employee records: ${error.message}`) }
  }, [])

  useEffect(() => { load() }, [load])

  const createEmployee = async event => {
    event.preventDefault()
    if (!form.name || !form.phone) return toast.error('Employee name and phone are required')
    try {
      await apiPost('/employees', { ...form, status: 'Present', payrollStatus: 'Pending' })
      await load()
      setModalOpen(false)
      setForm(emptyForm)
      toast.success('Employee created')
    } catch (error) { toast.error(error.message) }
  }

  const updateAttendance = async (employee, status, checkout = false) => {
    const existing = attendance.find(item => item.employeeId === employee.id)
    const nowTime = new Date().toTimeString().slice(0, 8)
    const checkIn = ['Present', 'Late'].includes(status) ? (existing?.checkIn || nowTime) : null
    const checkOut = checkout ? nowTime : existing?.checkOut || null
    let hoursWorked = existing?.hoursWorked || null
    if (checkIn && checkOut) {
      hoursWorked = Math.max(0, (new Date(`${today}T${checkOut}`) - new Date(`${today}T${checkIn}`)) / 3600000)
    }
    try {
      const updated = await apiPut(`/attendance/${employee.id}`, { date: today, status, checkIn, checkOut, hoursWorked })
      setAttendance(current => [...current.filter(item => item.employeeId !== employee.id), updated])
      setEmployees(current => current.map(item => item.id === employee.id ? { ...item, status } : item))
      toast.success(checkout ? 'Check-out recorded' : 'Attendance updated')
    } catch (error) { toast.error(error.message) }
  }

  const releasePayroll = async row => {
    try {
      const updated = await apiPut(`/payroll/${row.id}/pay`, {})
      setPayroll(current => current.map(item => item.id === updated.id ? updated : item))
      toast.success('Payroll marked as paid')
    } catch (error) { toast.error(error.message) }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div><h1 className="page-title">Employee Directory</h1><p className="page-subtitle">Manage staff, daily attendance, and monthly payroll.</p></div>
        <button className="btn-primary" onClick={() => setModalOpen(true)} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}><Plus size={16} /> Add Employee</button>
      </div>

      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-subtle)', marginBottom: 24, overflowX: 'auto' }}>
        {[['list', 'Staff Directory'], ['attendance', `Attendance · ${today}`], ['salary', `Payroll · ${currentPeriod}`]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', color: activeTab === id ? '#6366f1' : 'var(--text-secondary)', borderBottom: activeTab === id ? '2px solid #6366f1' : '2px solid transparent' }}>{label}</button>
        ))}
      </div>

      {activeTab === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {employees.map(employee => (
            <div key={employee.id} className="glass-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#6366f1', display: 'grid', placeItems: 'center', color: 'white', fontWeight: 800 }}>{employee.name.charAt(0)}</div>
                <div><h3>{employee.name}</h3><p style={{ color: '#6366f1', fontSize: 12 }}>{employee.dept} · {employee.role || 'Team member'}</p></div>
              </div>
              <div style={{ marginTop: 14, color: 'var(--text-secondary)', fontSize: 13 }}>{employee.phone}<br />{employee.email || 'No email'}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Employee</th>
                <th style={{ width: '18%' }}>Department</th>
                <th style={{ width: '15%' }}>Status</th>
                <th style={{ width: '15%' }}>Check In</th>
                <th style={{ width: '18%' }}>Check Out / Hours</th>
                <th style={{ width: '12%' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(employee => {
                const record = attendance.find(item => item.employeeId === employee.id)
                const status = record?.status || 'Absent'
                return (
                  <tr key={employee.id}>
                    <td>{employee.name}</td>
                    <td>{employee.dept}</td>
                    <td><span className={`badge ${status === 'Present' ? 'badge-success' : status === 'Late' ? 'badge-warning' : 'badge-danger'}`}>{status}</span></td>
                    <td>{record?.checkIn || '—'}</td>
                    <td>{record?.checkOut || '—'} {record?.hoursWorked ? `(${Number(record.hoursWorked).toFixed(1)}h)` : ''}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <ThemeSelect value={status} onChange={event => updateAttendance(employee, event.target.value)} style={{ minWidth: 110 }}><option>Present</option><option>Late</option><option>Absent</option><option>Leave</option></ThemeSelect>
                        {record?.checkIn && !record.checkOut && (
                          <button
                            title="Check Out Employee"
                            style={{
                              width: 32, height: 32, borderRadius: 8,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer'
                            }}
                            onClick={() => updateAttendance(employee, status, true)}
                          >
                            <LogOut size={15} style={{ color: '#ef4444' }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'salary' && (
        <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th style={{ width: '20%' }}>Employee</th>
                <th style={{ width: '14%' }}>Basic</th>
                <th style={{ width: '14%' }}>Incentive</th>
                <th style={{ width: '14%' }}>Attendance</th><th style={{ width: '14%' }}>Other Deduction</th>
                <th style={{ width: '14%' }}>Net</th>
                <th style={{ width: '12%' }}>Status</th>
                <th style={{ width: '12%' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {payroll.map(row => {
                const employee = employees.find(item => item.id === row.employeeId)
                if (!employee) return null
                const net = Number(row.net ?? (Number(row.basic) + Number(row.incentive) - Number(row.deduction)))
                return (
                  <tr key={row.id}>
                    <td>{employee.name}</td>
                    <td>₹{Number(row.basic).toLocaleString('en-IN')}</td>
                    <td style={{ color: '#10b981' }}>₹{Number(row.incentive).toLocaleString('en-IN')}</td>
                    <td style={{ color: '#ef4444' }}>-₹{Number(row.attendanceDeduction || 0).toLocaleString('en-IN')}<br /><small>{Number(row.absentDays || 0)} absent</small></td><td style={{ color: '#ef4444' }}>-₹{Number(row.deduction).toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 700 }}>₹{net.toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${row.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>{row.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          title="View Payslip"
                          style={{
                            width: 32, height: 32, borderRadius: 8,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer'
                          }}
                          onClick={() => setPayslipRow({ row, employee })}
                        >
                          <Eye size={15} style={{ color: '#6366f1' }} />
                        </button>
                        {row.status !== 'Paid' && (
                          <button
                            title="Release Salary Payment"
                            style={{
                              width: 32, height: 32, borderRadius: 8,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer'
                            }}
                            onClick={() => releasePayroll(row)}
                          >
                            <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={event => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><h2>Add Employee</h2><button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 0, color: 'var(--text-secondary)' }}><X /></button></div>
            <form onSubmit={createEmployee}>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Name *</label><input className="input-field" value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} required /></div>
                <div className="form-group"><label className="form-label">Phone *</label><input className="input-field" value={form.phone} onChange={e => setForm(current => ({ ...current, phone: e.target.value }))} required /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="input-field" type="email" value={form.email} onChange={e => setForm(current => ({ ...current, email: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Role</label><input className="input-field" value={form.role} onChange={e => setForm(current => ({ ...current, role: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Department</label><ThemeSelect value={form.dept} onChange={e => setForm(current => ({ ...current, dept: e.target.value }))}><option>Accountants</option><option>Sales</option><option>Support Team</option><option>Developers</option><option>Technicians</option></ThemeSelect></div>
                <div className="form-group"><label className="form-label">Basic Salary</label><input className="input-field" type="number" value={form.basicSalary} onChange={e => setForm(current => ({ ...current, basicSalary: Number(e.target.value) }))} /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}><button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary">Create Employee</button></div>
            </form>
          </div>
        </div>
      )}

      {payslipRow && (() => {
        const { row, employee } = payslipRow
        const net = Number(row.net ?? (Number(row.basic || 0) + Number(row.incentive || 0) - Number(row.deduction || 0)))
        return (
          <div className="modal-backdrop" onClick={() => setPayslipRow(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={22} style={{ color: '#6366f1' }} />
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Salary Payslip</h3>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Period: {row.period}</span>
                  </div>
                </div>
                <button onClick={() => setPayslipRow(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: 14, borderRadius: 10, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Employee Name</span><div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{employee.name}</div></div>
                <div><span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Department / Role</span><div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{employee.dept} ({employee.role || 'Staff'})</div></div>
                <div><span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Phone / Email</span><div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{employee.phone || 'N/A'}</div></div>
                <div><span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Payment Status</span><div><span className={`badge ${row.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>{row.status}</span></div></div>
              </div>

              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginBottom: 16 }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Basic Salary</td><td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>₹{Number(row.basic).toLocaleString('en-IN')}</td></tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Incentive / Allowances</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981' }}>+₹{Number(row.incentive).toLocaleString('en-IN')}</td></tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Attendance deduction ({Number(row.absentDays || 0)} absent days)</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>-₹{Number(row.attendanceDeduction || 0).toLocaleString('en-IN')}</td></tr><tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Other deductions</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>-₹{Number(row.deduction).toLocaleString('en-IN')}</td></tr>
                  <tr><td style={{ padding: '12px 0 4px 0', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Net Salary Paid</td><td style={{ textAlign: 'right', fontSize: 17, fontWeight: 800, color: '#6366f1' }}>₹{net.toLocaleString('en-IN')}</td></tr>
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn-secondary" onClick={() => setPayslipRow(null)}>Close</button>
                <button className="btn-primary" onClick={() => window.print()}><Printer size={15} /> Print Payslip</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { apiGetAll, apiGet, apiPost, apiPut } from '../../utils/api'
import ThemeSelect from '../../components/ThemeSelect'
import ThemeDatePicker from '../../components/ThemeDatePicker'
import { useAuth } from '../../context/AuthContext'
import { CheckCircle2, Clock, AlertCircle, XCircle, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'

const DEPARTMENTS = ['All Departments', 'Accountants', 'Sales', 'Support Team', 'Developers', 'Technicians']
const PRIORITIES   = ['High', 'Medium', 'Low']
const STATUSES     = ['Pending', 'Ongoing', 'Completed', 'Not Completed']

const STATUS_CONFIG = {
  'Pending':       { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)', icon: AlertCircle },
  'Ongoing':       { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)', icon: Clock },
  'Completed':     { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)', icon: CheckCircle2 },
  'Not Completed': { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)',icon: XCircle },
}

const PRIORITY_COLOR = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' }

const EMPTY_FORM = { title: '', desc: '', dept: 'Sales', assignedUserId: '', priority: 'Medium', status: 'Pending', due: '' }

export default function TasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks]       = useState([])
  const [assignees, setAssignees] = useState([])
  const [loading, setLoading]   = useState(true)
  const [deptFilter, setDept]   = useState('All Departments')
  const [statusFilter, setStatus] = useState('All')
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState({ ...EMPTY_FORM })
  const isAdmin = ['super_admin', 'director', 'sales_manager', 'installation_manager'].includes(user?.role)

  useEffect(() => {
    Promise.all([apiGetAll('/tasks'), ...(isAdmin ? [apiGet('/task-assignees')] : [Promise.resolve([])])])
      .then(([taskRows, assigneeRows]) => {
        setTasks(taskRows)
        setAssignees(assigneeRows)
      })
      .catch(err => toast.error('Failed to load tasks: ' + err.message))
      .finally(() => setLoading(false))
  }, [isAdmin])

  const filtered = tasks.filter(t => {
    const matchDept   = deptFilter === 'All Departments' || t.dept === deptFilter
    const matchStatus = statusFilter === 'All' || t.status === statusFilter
    return matchDept && matchStatus
  })

  const updateStatus = async (id, newStatus) => {
    try {
      const updated = await apiPut(`/tasks/${id}/status`, { status: newStatus })
      setTasks(ts => ts.map(t => t.id === id ? { ...t, ...updated, status: newStatus } : t))
      toast.success('Task status updated')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.title || !form.assignedUserId) return toast.error('Title and assignee are required')
    try {
      const created = await apiPost('/tasks', form)
      setTasks(ts => [...ts, created])
      toast.success('Task assigned')
      setModal(false)
      setForm({ ...EMPTY_FORM })
    } catch (err) {
      toast.error(err.message)
    }
  }

  const counts = { Pending: 0, Ongoing: 0, Completed: 0, 'Not Completed': 0 }
  tasks.forEach(t => counts[t.status]++)

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading tasks...</div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Task Management</h1>
          <p className="page-subtitle">Assign and track tasks across all departments</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setModal(true)}><Plus size={16} /> Assign Task</button>
        )}
      </div>

      {/* Status Summary */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const Icon = cfg.icon
          return (
            <div key={status} className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setStatus(status === statusFilter ? 'All' : status)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} style={{ color: cfg.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: cfg.color, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{counts[status]}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{status}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {DEPARTMENTS.map(d => (
          <button key={d} onClick={() => setDept(d)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
            border: `1px solid ${deptFilter === d ? '#6366f1' : 'var(--border-subtle)'}`,
            background: deptFilter === d ? 'rgba(99,102,241,0.12)' : 'transparent',
            color: deptFilter === d ? '#4f46e5' : 'var(--text-secondary)',
            fontWeight: deptFilter === d ? 700 : 500,
          }}>{d}</button>
        ))}
      </div>

      {/* Tasks Table */}
      <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 160 }}>
        <table className="data-table" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th>SR.No.</th><th>Task</th><th>Department</th><th>Assigned To</th><th>Priority</th><th>Due Date</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, idx) => {
              const cfg = STATUS_CONFIG[t.status]
              return (
                <tr key={t.id} style={{ position: 'relative', zIndex: filtered.length - idx }}>
                  <td style={{ color: '#475569', fontSize: 12 }}>{String(t.id).padStart(3, '0')}</td>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{(t.desc || '').substring(0, 60)}{t.desc?.length > 60 ? '...' : ''}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#4f46e5', fontWeight: 600 }}>{t.dept}</span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.assignedTo}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 600, color: PRIORITY_COLOR[t.priority] }}>● {t.priority}</span>
                  </td>
                  <td style={{ fontSize: 13, color: new Date(t.due) < new Date() && t.status !== 'Completed' ? '#ef4444' : '#94a3b8' }}>{t.due}</td>
                  <td style={{ position: 'relative' }}>
                    <ThemeSelect
                      value={t.status}
                      onChange={e => updateStatus(t.id, e.target.value)}
                      style={{
                        background: cfg.bg, 
                        color: cfg.color, 
                        border: `1px solid ${cfg.border}`,
                        borderRadius: '20px', 
                        padding: '0 8px 0 10px', 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        cursor: 'pointer', 
                        outline: 'none',
                        height: '24px',
                        width: '128px',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                    >
                      {STATUSES.map(s => <option key={s} value={s} style={{ background: '#111827', color: 'var(--text-primary)' }}>{s}</option>)}
                    </ThemeSelect>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Assign Task Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Assign New Task</h2>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Task Title *</label>
                  <input className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Prepare GST report" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="input-field" rows={3} value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="Task details and instructions..." style={{ resize: 'vertical' }} />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Department *</label>
                    <ThemeSelect className="input-field" value={form.dept} onChange={e => setForm(f => ({ ...f, dept: e.target.value }))}>
                      {DEPARTMENTS.filter(d => d !== 'All Departments').map(d => <option key={d}>{d}</option>)}
                    </ThemeSelect>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assign To *</label>
                    <ThemeSelect className="input-field" value={form.assignedUserId} onChange={e => setForm(f => ({ ...f, assignedUserId: Number(e.target.value) }))}>
                      <option value="">Select employee</option>
                      {assignees.map(assignee => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}
                    </ThemeSelect>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <ThemeSelect className="input-field" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                      {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                    </ThemeSelect>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Due Date</label>
                    <ThemeDatePicker value={form.due} onChange={e => setForm(f => ({ ...f, due: e.target.value }))} />
                  </div>
                </div>
                <div style={{ padding: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, fontSize: 13, color: '#10b981' }}>
                  ✓ Employee will receive task notification via WhatsApp, SMS &amp; Email
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary"><Plus size={16} /> Assign Task</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

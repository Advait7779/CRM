import { useEffect, useState } from 'react'
import ThemeSelect from '../../components/ThemeSelect'
import ThemeDatePicker from '../../components/ThemeDatePicker'
import { X, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiGetAll, apiGet, apiPost, apiPut, apiUpload } from '../../utils/api'

export default function InstallationsPage() {
  const [activeTab, setActiveTab] = useState('gps')
  const [gpsList, setGpsList] = useState([])
  const [cctvList, setCctvList] = useState([])
  const [webList, setWebList] = useState([])
  const [customers, setCustomers] = useState([])
  const [employees, setEmployees] = useState([])
  const [gpsModal, setGpsModal] = useState(false)
  const [cctvModal, setCctvModal] = useState(false)
  const [webModal, setWebModal] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [reportForm, setReportForm] = useState({
    imei: '', sim: '', cameras: 4, nvrSerial: '', photo: null, signature: null, note: ''
  })

  // GPS form state
  const [gpsForm, setGpsForm] = useState({
    vehicle: '', imei: '', sim: '', customerId: '', installer: 'Karan Malhotra', date: '', testing: false, approval: false
  })

  // CCTV form state
  const [cctvForm, setCctvForm] = useState({
    customerId: '', site: '', cameras: 4, dvr: 'Hikvision 8ch', tech: 'Vikas Rao', date: '', survey: false, signOff: false
  })

  // Web form state
  const [webForm, setWebForm] = useState({
    customerId: '', domain: '', hosting: 'Hostinger VPS', design: 'Pending', dev: 'Pending', goLive: ''
  })

  const loadInstallations = async () => {
    try {
      const [rows, customerRows, employeeRows] = await Promise.all([
        apiGetAll('/installations'),
        apiGetAll('/customers'),
        apiGet('/installation-staff')
      ])
      setGpsList(rows.filter(row => row.type === 'GPS'))
      setCctvList(rows.filter(row => row.type === 'CCTV'))
      setWebList(rows.filter(row => row.type === 'Website'))
      setCustomers(customerRows)
      setEmployees(employeeRows)
      if (customerRows[0]) {
        setGpsForm(current => ({ ...current, customerId: customerRows[0].id }))
        setCctvForm(current => ({ ...current, customerId: customerRows[0].id }))
        setWebForm(current => ({ ...current, customerId: customerRows[0].id }))
      }
    } catch (error) {
      toast.error(`Failed to load installations: ${error.message}`)
    }
  }

  useEffect(() => { loadInstallations() }, [])

  const handleAddGps = async (e) => {
    e.preventDefault()
    if (!gpsForm.vehicle || !gpsForm.imei || !gpsForm.sim) return toast.error('Please enter Vehicle, IMEI and SIM details')
    try {
      const created = await apiPost('/installations', { ...gpsForm, type: 'GPS', status: 'Pending' })
      setGpsList(prev => [created, ...prev])
      toast.success('GPS device allocation saved')
      setGpsModal(false)
      setGpsForm({ vehicle: '', imei: '', sim: '', customerId: customers[0]?.id || '', installer: employees[0]?.name || '', date: '', testing: false, approval: false })
    } catch (error) { toast.error(error.message) }
  }

  const handleAddCctv = async (e) => {
    e.preventDefault()
    if (!cctvForm.site) return toast.error('Please enter installation site address')
    try {
      const created = await apiPost('/installations', { ...cctvForm, type: 'CCTV', status: 'Pending' })
      setCctvList(prev => [created, ...prev])
      toast.success('CCTV installation saved')
      setCctvModal(false)
    } catch (error) { toast.error(error.message) }
  }

  const handleAddWeb = async (e) => {
    e.preventDefault()
    if (!webForm.domain) return toast.error('Please enter domain name')
    try {
      const created = await apiPost('/installations', { ...webForm, type: 'Website', status: 'In Progress' })
      setWebList(prev => [created, ...prev])
      toast.success('Web project saved')
      setWebModal(false)
    } catch (error) { toast.error(error.message) }
  }

  const handleReportSubmit = async (e) => {
    e.preventDefault()
    if (!selectedJob) return
    const { type, job } = selectedJob

    const payload = type === 'gps'
      ? { imei: reportForm.imei, sim: reportForm.sim }
      : { cameras: reportForm.cameras, dvr: reportForm.nvrSerial }
    if (type === 'gps' && (!payload.imei || !payload.sim)) return toast.error('IMEI and SIM Card Serial are required')
    if (type === 'cctv' && (!payload.cameras || !payload.dvr)) return toast.error('Camera count and NVR serial are required')
    try {
      const body = new FormData()
      Object.entries(payload).forEach(([key, value]) => body.append(key, value))
      body.append('reportNotes', reportForm.note || '')
      if (reportForm.photo) body.append('photo', reportForm.photo)
      if (reportForm.signature) body.append('signature', reportForm.signature)
      const updated = await apiUpload(`/installations/${job.id}/proof`, body)
      if (type === 'gps') setGpsList(prev => prev.map(item => item.id === job.id ? updated : item))
      else setCctvList(prev => prev.map(item => item.id === job.id ? updated : item))
      toast.success('Completion report saved')
      setReportModalOpen(false)
      setSelectedJob(null)
    } catch (error) { toast.error(error.message) }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div>
          <h1 className="page-title">Installation Management</h1>
          <p className="page-subtitle">Assign, allocate materials, and track status for GPS, CCTV, and Website jobs.</p>
        </div>
        <div style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          {activeTab === 'gps' && <button className="btn-primary" onClick={() => setGpsModal(true)}>+ Allocate GPS Device</button>}
          {activeTab === 'cctv' && <button className="btn-primary" onClick={() => setCctvModal(true)}>+ New CCTV Job</button>}
          {activeTab === 'website' && <button className="btn-primary" onClick={() => setWebModal(true)}>+ New Web Project</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 1, marginBottom: 24, overflowX: 'auto' }}>
        {[
          { id: 'gps', label: '🛰️ GPS Allocations' },
          { id: 'cctv', label: '📹 CCTV Sites' },
          { id: 'website', label: '🌐 Website Dev' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.2s', whiteSpace: 'nowrap',
              color: activeTab === t.id ? '#6366f1' : 'var(--text-secondary)',
              borderBottom: activeTab === t.id ? '2px solid #6366f1' : 'none',
              marginBottom: -1
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* GPS Content */}
      {activeTab === 'gps' && (
        <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th>Vehicle No</th>
                <th>IMEI Number</th>
                <th>SIM Card Details</th>
                <th>Client Customer</th>
                <th>Allocated Installer</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {gpsList.map(g => (
                <tr key={g.id}>
                  <td style={{ fontWeight: 600 }}>{g.vehicle}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{g.imei}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{g.sim}</td>
                  <td>{g.customer}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{g.installer}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{g.date || '—'}</td>
                  <td>
                    <span className={`badge ${g.status === 'Completed' ? 'badge-success' : g.status === 'In Progress' ? 'badge-info' : 'badge-warning'}`}>
                      {g.status}
                    </span>
                  </td>
                  <td>
                    {g.status !== 'Completed' && (
                      <button
                        title="Approve Testing"
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer'
                        }}
                        onClick={() => {
                          setSelectedJob({ job: g, type: 'gps' })
                          setReportForm({ imei: g.imei || '', sim: g.sim || '', cameras: 4, nvrSerial: '', photo: null, signature: null, note: '' })
                          setReportModalOpen(true)
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
      )}

      {/* CCTV Content */}
      {activeTab === 'cctv' && (
        <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Site Location</th>
                <th>Camera Count</th>
                <th>DVR/NVR Spec</th>
                <th>Lead Technician</th>
                <th>Installation Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {cctvList.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.customer}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{c.site}</td>
                  <td style={{ fontWeight: 600 }}>{c.cameras}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{c.dvr}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.tech}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{c.date || '—'}</td>
                  <td>
                    <span className={`badge ${c.status === 'Completed' ? 'badge-success' : c.status === 'In Progress' ? 'badge-info' : 'badge-warning'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    {c.status !== 'Completed' && (
                      <button
                        title="Sign-off CCTV Installation"
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer'
                        }}
                        onClick={() => {
                          setSelectedJob({ job: c, type: 'cctv' })
                          setReportForm({ imei: '', sim: '', cameras: c.cameras || 4, nvrSerial: c.dvr || '', photo: null, signature: null, note: '' })
                          setReportModalOpen(true)
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
      )}

      {/* Website Dev Content */}
      {activeTab === 'website' && (
        <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Domain Details</th>
                <th>Hosting Spec</th>
                <th>Design Approval</th>
                <th>Dev Phase</th>
                <th>Launch Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {webList.map(w => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 600 }}>{w.customer}</td>
                  <td style={{ color: '#6366f1', fontSize: 13 }}>{w.domain}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{w.hosting}</td>
                  <td>
                    <span className="badge badge-success">{w.design}</span>
                  </td>
                  <td>
                    <span className="badge badge-purple">{w.dev}</span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{w.goLive || '—'}</td>
                  <td>
                    <span className={`badge ${w.status === 'Completed' ? 'badge-success' : 'badge-info'}`}>
                      {w.status}
                    </span>
                  </td>
                  <td>
                    {w.status !== 'Completed' && (
                      <button
                        title="Mark Project Live"
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer'
                        }}
                        onClick={async () => {
                          try {
                            const updated = await apiPut(`/installations/${w.id}`, { status: 'Completed', dev: 'Done' })
                            setWebList(prev => prev.map(p => p.id === w.id ? updated : p))
                            toast.success('Website project marked live')
                          } catch (error) {
                            toast.error(error.message)
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
      )}

      {/* GPS Modal */}
      {gpsModal && (
        <div className="modal-backdrop" onClick={() => setGpsModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Allocate GPS Device</h2>
              <button onClick={() => setGpsModal(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddGps}>
              <div className="form-grid-2" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Vehicle Number *</label>
                  <input className="input-field" value={gpsForm.vehicle} onChange={e => setGpsForm(f => ({ ...f, vehicle: e.target.value.toUpperCase() }))} placeholder="MH-12-XX-XXXX" required />
                </div>
                <div className="form-group">
                  <label className="form-label">IMEI Code *</label>
                  <input className="input-field" value={gpsForm.imei} onChange={e => setGpsForm(f => ({ ...f, imei: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">SIM Number *</label>
                  <input className="input-field" value={gpsForm.sim} onChange={e => setGpsForm(f => ({ ...f, sim: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Client *</label>
                  <ThemeSelect className="input-field" value={gpsForm.customerId} onChange={e => setGpsForm(f => ({ ...f, customerId: Number(e.target.value) }))}>
                    {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </ThemeSelect>
                </div>
                <div className="form-group">
                  <label className="form-label">Installer Agent</label>
                  <ThemeSelect className="input-field" value={gpsForm.installer} onChange={e => setGpsForm(f => ({ ...f, installer: e.target.value }))}>
                    {employees.filter(employee => employee.dept === 'Technicians').map(employee => <option key={employee.id} value={employee.name}>{employee.name}</option>)}
                  </ThemeSelect>
                </div>
                <div className="form-group">
                  <label className="form-label">Installation Date</label>
                  <ThemeDatePicker value={gpsForm.date} onChange={e => setGpsForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" onClick={() => setGpsModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Allocate &amp; Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CCTV Modal */}
      {cctvModal && (
        <div className="modal-backdrop" onClick={() => setCctvModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Create CCTV Setup Task</h2>
              <button onClick={() => setCctvModal(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddCctv}>
              <div className="form-grid-2" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Client Customer</label>
                  <ThemeSelect className="input-field" value={cctvForm.customerId} onChange={e => setCctvForm(f => ({ ...f, customerId: Number(e.target.value) }))}>
                    {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </ThemeSelect>
                </div>
                <div className="form-group">
                  <label className="form-label">NVR spec / Channel Count</label>
                  <input className="input-field" value={cctvForm.dvr} onChange={e => setCctvForm(f => ({ ...f, dvr: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Camera Count</label>
                  <input className="input-field" type="number" value={cctvForm.cameras} onChange={e => setCctvForm(f => ({ ...f, cameras: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Assign Technician</label>
                  <ThemeSelect className="input-field" value={cctvForm.tech} onChange={e => setCctvForm(f => ({ ...f, tech: e.target.value }))}>
                    {employees.filter(employee => employee.dept === 'Technicians').map(employee => <option key={employee.id} value={employee.name}>{employee.name}</option>)}
                  </ThemeSelect>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Site Address *</label>
                  <input className="input-field" value={cctvForm.site} onChange={e => setCctvForm(f => ({ ...f, site: e.target.value }))} required />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" onClick={() => setCctvModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Web Project Modal */}
      {webModal && (
        <div className="modal-backdrop" onClick={() => setWebModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Create Website Project</h2>
              <button onClick={() => setWebModal(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddWeb}>
              <div className="form-grid-2" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Customer Client</label>
                  <ThemeSelect className="input-field" value={webForm.customerId} onChange={e => setWebForm(f => ({ ...f, customerId: Number(e.target.value) }))}>
                    {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </ThemeSelect>
                </div>
                <div className="form-group">
                  <label className="form-label">Requested Domain *</label>
                  <input className="input-field" value={webForm.domain} onChange={e => setWebForm(f => ({ ...f, domain: e.target.value }))} placeholder="clientdomain.com" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Hosting Environment</label>
                  <input className="input-field" value={webForm.hosting} onChange={e => setWebForm(f => ({ ...f, hosting: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Target Go-Live Date</label>
                  <ThemeDatePicker value={webForm.goLive} onChange={e => setWebForm(f => ({ ...f, goLive: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" onClick={() => setWebModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Initialize Project</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Job Completion & Proof of Work Modal */}
      {reportModalOpen && selectedJob && (
        <div className="modal-backdrop" onClick={() => setReportModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                🛠️ Job Completion &amp; Proof of Work
              </h2>
              <button onClick={() => setReportModalOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleReportSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Job Information</h4>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {selectedJob.type === 'gps' 
                      ? `Vehicle: ${selectedJob.job.vehicle} · Customer: ${selectedJob.job.customer}`
                      : `Site: ${selectedJob.job.site} · Customer: ${selectedJob.job.customer}`
                    }
                  </p>
                </div>

                {selectedJob.type === 'gps' ? (
                  <>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Asset IMEI Number *</label>
                        <input 
                          className="input-field" 
                          value={reportForm.imei} 
                          onChange={e => setReportForm(f => ({ ...f, imei: e.target.value }))} 
                          required 
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">SIM Card Serial Number *</label>
                        <input 
                          className="input-field" 
                          value={reportForm.sim} 
                          onChange={e => setReportForm(f => ({ ...f, sim: e.target.value }))} 
                          required 
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Upload Dashboard/Wiring Photo (Proof of Install)</label>
                      <input 
                        type="file" 
                        className="input-field" 
                        accept="image/jpeg,image/png,image/webp"
                        onChange={e => setReportForm(f => ({ ...f, photo: e.target.files[0] || null }))}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Cameras Installed *</label>
                        <input 
                          type="number"
                          className="input-field" 
                          value={reportForm.cameras} 
                          onChange={e => setReportForm(f => ({ ...f, cameras: Number(e.target.value) }))} 
                          required 
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">NVR/DVR Serial Number *</label>
                        <input 
                          className="input-field" 
                          value={reportForm.nvrSerial} 
                          onChange={e => setReportForm(f => ({ ...f, nvrSerial: e.target.value }))} 
                          required 
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Upload Site Camera Angle Photo (Proof of Angle)</label>
                      <input 
                        type="file" 
                        className="input-field" 
                        accept="image/jpeg,image/png,image/webp"
                        onChange={e => setReportForm(f => ({ ...f, photo: e.target.files[0] || null }))}
                      />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">Upload Customer Sign-off Signature</label>
                  <input 
                    type="file" 
                    className="input-field" 
                    accept="image/jpeg,image/png,image/webp"
                    onChange={e => setReportForm(f => ({ ...f, signature: e.target.files[0] || null }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Job Notes / Remarks</label>
                  <textarea 
                    className="input-field" 
                    style={{ minHeight: 60 }} 
                    value={reportForm.note || ''} 
                    onChange={e => setReportForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="e.g. Installation verified, wiring hidden behind fuse box."
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" onClick={() => setReportModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Submit Completion Report</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import PaginatedTable from '../../components/PaginatedTable'
import ModalBackdrop from '../../components/ModalBackdrop'
import { useEffect, useState } from 'react'
import ThemeDatePicker from '../../components/ThemeDatePicker'
import { X, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiDelete, apiDownload, apiGetAll, apiPost, apiUpload } from '../../utils/api'
import { useAuth } from '../../context/AuthContext'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'

function proofPhotoCount(value) {
  if (!value) return 0
  try {
    const files = JSON.parse(value)
    if (Array.isArray(files)) return files.length
  } catch {}
  return 1
}

function proofPhotoExtension(value, index) {
  try {
    const names = JSON.parse(value)
    const name = Array.isArray(names) ? names[index] : value
    return /\.(png|webp|jpe?g)$/i.exec(name)?.[1]?.toLowerCase() || 'jpg'
  } catch { return /\.(png|webp|jpe?g)$/i.exec(value)?.[1]?.toLowerCase() || 'jpg' }
}

function ProofPhotoPreview({ file, index }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!file) return undefined
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  return url ? <img src={url} alt={`Proof ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} /> : null
}

export default function InstallationsPage() {
  const { user } = useAuth()
  const isGpsInstaller = user?.role === 'gps_installer'
  const isCctvInstaller = user?.role === 'cctv_technician'
  const canManage = ['super_admin', 'director', 'installation_manager'].includes(user?.role)
  const canDelete = user?.role === 'super_admin'

  const [activeTab, setActiveTab] = useState(() => {
    if (user?.role === 'cctv_technician') return 'cctv'
    return 'gps'
  })
  const [gpsList, setGpsList] = useState([])
  const [cctvList, setCctvList] = useState([])
  const [gpsModal, setGpsModal] = useState(false)
  const [cctvModal, setCctvModal] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [proofJob, setProofJob] = useState(null)
  const [installationToDelete, setInstallationToDelete] = useState(null)
  const [deletingInstallation, setDeletingInstallation] = useState(false)
  const [submittingReport, setSubmittingReport] = useState(false)
  const [reportForm, setReportForm] = useState({
    cameras: 4, nvrSerial: '', photos: [null, null, null, null, null], note: ''
  })

  // GPS form state - direct input fields
  const [gpsForm, setGpsForm] = useState({
    vehicle: '', customer: '', phone: '', email: '', location: '', deviceType: '', installer: '', date: '', testing: false, approval: false
  })

  // CCTV form state - direct input fields
  const [cctvForm, setCctvForm] = useState({
    customer: '', site: '', cameras: 4, dvr: 'Hikvision 8ch', tech: '', date: '', survey: false, signOff: false
  })

  useEffect(() => {
    if (user?.role === 'cctv_technician') {
      setActiveTab('cctv')
    } else if (user?.role === 'gps_installer') {
      setActiveTab('gps')
    }
  }, [user?.role])

  const loadInstallations = async () => {
    try {
      const rows = await apiGetAll('/installations')
      setGpsList(rows.filter(row => row.type === 'GPS'))
      setCctvList(rows.filter(row => row.type === 'CCTV'))
    } catch (error) {
      toast.error(`Failed to load installations: ${error.message}`)
    }
  }

  useEffect(() => { loadInstallations() }, [])

  const handleAddGps = async (e) => {
    e.preventDefault()
    if (!gpsForm.vehicle?.trim()) return toast.error('Please enter Vehicle Number')
    if (!gpsForm.customer?.trim()) return toast.error('Please enter Customer name')
    try {
      const created = await apiPost('/installations', { ...gpsForm, type: 'GPS', status: 'Pending' })
      setGpsList(prev => [created, ...prev])
      toast.success('GPS device allocation saved')
      setGpsModal(false)
      setGpsForm({ vehicle: '', customer: '', phone: '', email: '', location: '', deviceType: '', installer: '', date: '', testing: false, approval: false })
    } catch (error) { toast.error(error.message) }
  }

  const handleAddCctv = async (e) => {
    e.preventDefault()
    if (!cctvForm.customer?.trim()) return toast.error('Please enter Customer name')
    if (!cctvForm.site?.trim()) return toast.error('Please enter installation site address')
    try {
      const created = await apiPost('/installations', { ...cctvForm, type: 'CCTV', status: 'Pending' })
      setCctvList(prev => [created, ...prev])
      toast.success('CCTV installation saved')
      setCctvModal(false)
      setCctvForm({ customer: '', site: '', cameras: 4, dvr: 'Hikvision 8ch', tech: '', date: '', survey: false, signOff: false })
    } catch (error) { toast.error(error.message) }
  }

  const handleDeleteInstallation = async () => {
    if (!canDelete || !installationToDelete || deletingInstallation) return
    const { id, type } = installationToDelete
    setDeletingInstallation(true)
    try {
      await apiDelete(`/installations/${id}`)
      if (type === 'GPS') setGpsList(current => current.filter(job => job.id !== id))
      else setCctvList(current => current.filter(job => job.id !== id))
      setInstallationToDelete(null)
      toast.success('Installation deleted')
    } catch (error) { toast.error(error.message) }
    finally { setDeletingInstallation(false) }
  }

  const handlePhotoChange = (index, file) => {
    setReportForm(f => {
      const next = [...(f.photos || [null, null, null, null, null])]
      next[index] = file || null
      return { ...f, photos: next }
    })
  }

  const handleRemovePhoto = (index) => {
    setReportForm(f => {
      const next = [...(f.photos || [null, null, null, null, null])]
      next[index] = null
      return { ...f, photos: next }
    })
  }

  const handleReportSubmit = async (e) => {
    e.preventDefault()
    if (!selectedJob) return
    const { type, job } = selectedJob

    const payload = type === 'gps'
      ? {}
      : { cameras: reportForm.cameras, dvr: reportForm.nvrSerial }
    if (type === 'cctv' && (!payload.cameras || !payload.dvr)) return toast.error('Camera count and NVR serial are required')
    try {
      setSubmittingReport(true)
      const body = new FormData()
      Object.entries(payload).forEach(([key, value]) => body.append(key, value))
      body.append('reportNotes', reportForm.note || '')

      const selectedPhotos = (reportForm.photos || []).filter(Boolean)
      if (selectedPhotos.length !== 5) {
        return toast.error('Please upload all five proof images')
      }
      selectedPhotos.forEach(file => {
        body.append('photos', file)
      })

      const updated = await apiUpload(`/installations/${job.id}/proof`, body)
      if (type === 'gps') setGpsList(prev => prev.map(item => item.id === job.id ? updated : item))
      else setCctvList(prev => prev.map(item => item.id === job.id ? updated : item))
      toast.success('Completion report saved')
      setReportModalOpen(false)
      setSelectedJob(null)
    } catch (error) { toast.error(error.message) }
    finally { setSubmittingReport(false) }
  }

  const displayGpsList = isGpsInstaller
    ? gpsList.filter(g => !user?.name || g.installer?.trim().toLowerCase() === user.name.trim().toLowerCase())
    : gpsList

  const displayCctvList = isCctvInstaller
    ? cctvList.filter(c => !user?.name || (c.tech?.trim().toLowerCase() === user.name.trim().toLowerCase() || c.installer?.trim().toLowerCase() === user.name.trim().toLowerCase()))
    : cctvList

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div>
          <h1 className="page-title">Installation Management</h1>
          <p className="page-subtitle">Assign, allocate materials, and track status for GPS and CCTV jobs.</p>
        </div>
        <div style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          {canManage && activeTab === 'gps' && <button className="btn-primary" onClick={() => setGpsModal(true)}>+ Allocate GPS Device</button>}
          {canManage && activeTab === 'cctv' && <button className="btn-primary" onClick={() => setCctvModal(true)}>+ New CCTV Job</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 1, marginBottom: 24, overflowX: 'auto' }}>
        {[
          ...(!isCctvInstaller ? [{ id: 'gps', label: '🛰️ GPS Allocations' }] : []),
          ...(!isGpsInstaller ? [{ id: 'cctv', label: '📹 CCTV Sites' }] : [])
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
        <div className="table-pagination-shell" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <PaginatedTable><table className="data-table" style={{ minWidth: 960 }}>
            <thead>
              <tr>
                <th>Vehicle Number</th>
                <th>Customer Name</th>
                <th>Contact Number</th>
                <th>Email ID</th>
                <th>Location</th>
                <th>Device Type</th>
                <th>Allocated Installer</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayGpsList.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                    {isGpsInstaller ? 'No GPS installation jobs assigned to you yet.' : 'No GPS allocations found.'}
                  </td>
                </tr>
              ) : displayGpsList.map(g => (
                <tr key={g.id}>
                  <td style={{ fontWeight: 600 }}>{g.vehicle || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{g.customer || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{g.phone || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{g.email || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{g.location || g.site || '—'}</td>
                  <td>
                    <span className="badge badge-purple" style={{ fontSize: 12 }}>
                      {g.deviceType || 'GPS Tracker'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{g.installer || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{g.date ? String(g.date).slice(0, 10) : '—'}</td>
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
                          setReportForm({ cameras: 4, nvrSerial: '', photos: [null, null, null, null, null], note: '' })
                          setReportModalOpen(true)
                        }}
                      >
                        <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                      </button>
                    )}
                    {g.status === 'Completed' && (
                      <button type="button" className="btn-secondary" onClick={() => setProofJob(g)}>
                        View proof ({proofPhotoCount(g.reportPhoto)})
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        title={`Delete installation for ${g.vehicle || g.customer}`}
                        aria-label={`Delete installation for ${g.vehicle || g.customer}`}
                        onClick={() => setInstallationToDelete(g)}
                        style={{ width: 32, height: 32, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer', marginLeft: 8 }}
                      >
                        <Trash2 size={15} style={{ color: '#ef4444' }} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></PaginatedTable>
        </div>
      )}

      {/* CCTV Content */}
      {activeTab === 'cctv' && (
        <div className="table-pagination-shell" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <PaginatedTable><table className="data-table" style={{ minWidth: 800 }}>
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
              {displayCctvList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                    {isCctvInstaller ? 'No CCTV installation jobs assigned to you yet.' : 'No CCTV sites found.'}
                  </td>
                </tr>
              ) : displayCctvList.map(c => (
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
                          setReportForm({ cameras: c.cameras || 4, nvrSerial: c.dvr || '', photos: [null, null, null, null, null], note: '' })
                          setReportModalOpen(true)
                        }}
                      >
                        <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                      </button>
                    )}
                    {c.status === 'Completed' && (
                      <button type="button" className="btn-secondary" onClick={() => setProofJob(c)}>
                        View proof ({proofPhotoCount(c.reportPhoto)})
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        title={`Delete CCTV installation for ${c.customer}`}
                        aria-label={`Delete CCTV installation for ${c.customer}`}
                        onClick={() => setInstallationToDelete(c)}
                        style={{ width: 32, height: 32, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer', marginLeft: 8 }}
                      >
                        <Trash2 size={15} style={{ color: '#ef4444' }} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></PaginatedTable>
        </div>
      )}

      {/* GPS Modal */}
      {canManage && gpsModal && (
        <ModalBackdrop className="modal-backdrop" onClick={() => setGpsModal(false)}>
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
                  <label className="form-label">Customer Name *</label>
                  <input className="input-field" value={gpsForm.customer} onChange={e => setGpsForm(f => ({ ...f, customer: e.target.value }))} placeholder="Enter customer name" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Contact Number</label>
                  <input className="input-field" value={gpsForm.phone} onChange={e => setGpsForm(f => ({ ...f, phone: e.target.value }))} placeholder="Enter contact phone number" />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Email ID</label>
                  <input className="input-field" type="email" value={gpsForm.email} onChange={e => setGpsForm(f => ({ ...f, email: e.target.value }))} placeholder="Enter customer email" />
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="input-field" value={gpsForm.location} onChange={e => setGpsForm(f => ({ ...f, location: e.target.value }))} placeholder="Enter installation location / address" />
                </div>
                <div className="form-group">
                  <label className="form-label">Device Type</label>
                  <input className="input-field" value={gpsForm.deviceType} onChange={e => setGpsForm(f => ({ ...f, deviceType: e.target.value }))} placeholder="e.g. GPS Tracker 4G / OBD / AIS140" />
                </div>
                <div className="form-group">
                  <label className="form-label">Installer Agent</label>
                  <input className="input-field" value={gpsForm.installer} onChange={e => setGpsForm(f => ({ ...f, installer: e.target.value }))} placeholder="Enter installer name" />
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
        </ModalBackdrop>
      )}

      {/* CCTV Modal */}
      {canManage && cctvModal && (
        <ModalBackdrop className="modal-backdrop" onClick={() => setCctvModal(false)}>
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
                  <label className="form-label">Client Customer *</label>
                  <input className="input-field" value={cctvForm.customer} onChange={e => setCctvForm(f => ({ ...f, customer: e.target.value }))} placeholder="Enter customer name" required />
                </div>
                <div className="form-group">
                  <label className="form-label">NVR spec / Channel Count</label>
                  <input className="input-field" value={cctvForm.dvr} onChange={e => setCctvForm(f => ({ ...f, dvr: e.target.value }))} placeholder="e.g. Hikvision 8ch" />
                </div>
                <div className="form-group">
                  <label className="form-label">Camera Count</label>
                  <input className="input-field" type="number" value={cctvForm.cameras} onChange={e => setCctvForm(f => ({ ...f, cameras: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Assign Technician</label>
                  <input className="input-field" value={cctvForm.tech} onChange={e => setCctvForm(f => ({ ...f, tech: e.target.value }))} placeholder="Enter technician / installer name" />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Site Address *</label>
                  <input className="input-field" value={cctvForm.site} onChange={e => setCctvForm(f => ({ ...f, site: e.target.value }))} placeholder="Enter site address" required />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" onClick={() => setCctvModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create Task</button>
              </div>
            </form>
          </div>
        </ModalBackdrop>
      )}

      {/* Job Completion & Proof of Work Modal */}
      {reportModalOpen && selectedJob && (
        <ModalBackdrop className="modal-backdrop" onClick={() => setReportModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
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

                {selectedJob.type === 'cctv' && (
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
                )}

                {/* 5 Proof Images Side by Side */}
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label className="form-label" style={{ marginBottom: 0, fontWeight: 600 }}>
                      📸 Proof Images (Upload 5 Images Side by Side)
                    </label>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {(reportForm.photos || []).filter(Boolean).length}/5 selected
                    </span>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: 10,
                    marginTop: 6
                  }}>
                    {[0, 1, 2, 3, 4].map(idx => {
                      const file = reportForm.photos?.[idx]
                      return (
                        <div
                          key={idx}
                          style={{
                            position: 'relative',
                            aspectRatio: '1 / 1',
                            borderRadius: 10,
                            border: file ? '2px solid #6366f1' : '1.5px dashed var(--border-subtle)',
                            backgroundColor: 'var(--bg-secondary)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            padding: 4
                          }}
                          onClick={() => {
                            const input = document.getElementById(`proof-file-input-${idx}`)
                            if (input) input.click()
                          }}
                        >
                          <input
                            id={`proof-file-input-${idx}`}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/jpg"
                            style={{ display: 'none' }}
                            onChange={e => {
                              const selected = e.target.files?.[0]
                              if (selected) handlePhotoChange(idx, selected)
                            }}
                          />

                          {file ? (
                            <>
                              <ProofPhotoPreview file={file} index={idx} />
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation()
                                  handleRemovePhoto(idx)
                                  const input = document.getElementById(`proof-file-input-${idx}`)
                                  if (input) input.value = ''
                                }}
                                title="Remove photo"
                                style={{
                                  position: 'absolute',
                                  top: 3,
                                  right: 3,
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  background: 'rgba(0, 0, 0, 0.75)',
                                  color: '#fff',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  zIndex: 2
                                }}
                              >
                                <X size={12} />
                              </button>
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 2,
                                  left: 2,
                                  right: 2,
                                  backgroundColor: 'rgba(0,0,0,0.65)',
                                  color: '#fff',
                                  fontSize: 10,
                                  textAlign: 'center',
                                  borderRadius: 4,
                                  padding: '1px 2px'
                                }}
                              >
                                Image {idx + 1}
                              </div>
                            </>
                          ) : (
                            <div style={{ textAlign: 'center', padding: 2 }}>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                  color: '#6366f1',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  margin: '0 auto 4px'
                                }}
                              >
                                <Plus size={14} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>
                                Image {idx + 1}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
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
                <button type="submit" className="btn-primary" disabled={submittingReport}>{submittingReport ? 'Submitting...' : 'Submit Completion Report'}</button>
              </div>
            </form>
          </div>
        </ModalBackdrop>
      )}
      {proofJob && (
        <ModalBackdrop className="modal-backdrop" onClick={() => setProofJob(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>Completion proof · {proofJob.customer}</h2>
              <button type="button" onClick={() => setProofJob(null)} style={{ background: 'none', border: 0, cursor: 'pointer' }} aria-label="Close proof"><X size={20} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{proofJob.reportNotes || 'No remarks were entered.'}</p>
            {proofPhotoCount(proofJob.reportPhoto) ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
                {Array.from({ length: proofPhotoCount(proofJob.reportPhoto) }, (_, index) => (
                  <button key={index} type="button" className="btn-secondary" onClick={async () => {
                    try { await apiDownload(`/installations/${proofJob.id}/proof/photo?index=${index}`, `installation-${proofJob.id}-proof-${index + 1}.${proofPhotoExtension(proofJob.reportPhoto, index)}`) }
                    catch (error) { toast.error(error.message) }
                  }}>Download image {index + 1}</button>
                ))}
              </div>
            ) : <p style={{ color: 'var(--text-secondary)' }}>No proof images were saved for this older record.</p>}
          </div>
        </ModalBackdrop>
      )}
      <ConfirmDeleteModal
        isOpen={Boolean(installationToDelete)}
        onClose={() => { if (!deletingInstallation) setInstallationToDelete(null) }}
        onConfirm={handleDeleteInstallation}
        loading={deletingInstallation}
        title="Delete Installation"
        subtitle={installationToDelete ? `${installationToDelete.type} · ${installationToDelete.vehicle || installationToDelete.site || installationToDelete.customer}` : ''}
        message="This permanently deletes the installation and its completion proof. The customer record will remain. This action cannot be undone."
        confirmText="Delete Installation"
      />
    </div>
  )
}

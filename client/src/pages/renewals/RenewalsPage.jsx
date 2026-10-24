import PaginatedTable from '../../components/PaginatedTable'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clock, FileUp, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalBackdrop from '../../components/ModalBackdrop'
import ThemeDatePicker from '../../components/ThemeDatePicker'
import { apiDelete, apiGetAll, apiPost, apiPut, apiUpload } from '../../utils/api'

const emptyForm = { customer: '', contactNo: '', imeiNo: '', simNumber: '', vehicleNumber: '', nextDue: '', renewalDate: '', followUpDate: '', remarks: '' }
const fields = [['customer', 'Customer name'], ['contactNo', 'Contact No'], ['imeiNo', 'IMEI No'], ['simNumber', 'SIM Number'], ['vehicleNumber', 'Vehicle Number'], ['nextDue', 'Expiry date'], ['renewalDate', 'Renewal date']]
const dateValue = value => value ? String(value).slice(0, 10) : ''
const dateText = value => value ? new Date(`${dateValue(value)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const todayStr = () => new Date().toISOString().slice(0, 10)
const getOffsetDate = days => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
const iconButton = (color, background) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: `1px solid ${color}44`, background, color, cursor: 'pointer' })

export default function RenewalsPage() {
  const fileInputRef = useRef(null)
  const [renewals, setRenewals] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirm, setConfirm] = useState(null)
  const [deleteAllScope, setDeleteAllScope] = useState('all')
  const [followUpModal, setFollowUpModal] = useState(null)

  const load = async () => {
    try { setRenewals(await apiGetAll('/gps-renewals')) }
    catch (error) { toast.error(error.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openForm = renewal => {
    setEditing(renewal || { id: null })
    setForm(renewal ? {
      customer: renewal.customer || '',
      contactNo: renewal.contactNo || '',
      imeiNo: renewal.imeiNo || '',
      simNumber: renewal.simNumber || '',
      vehicleNumber: renewal.vehicleNumber || '',
      nextDue: dateValue(renewal.nextDue),
      renewalDate: dateValue(renewal.renewalDate),
      followUpDate: dateValue(renewal.followUpDate),
      remarks: renewal.remarks || ''
    } : { ...emptyForm })
  }

  const openFollowUp = renewal => {
    setFollowUpModal({
      renewal,
      followUpDate: dateValue(renewal.followUpDate) || getOffsetDate(2),
      remarks: renewal.remarks || ''
    })
  }

  const save = async event => {
    event.preventDefault()
    setBusy(true)
    try {
      if (editing.id) {
        await apiPut(`/gps-renewals/${editing.id}`, form)
        toast.success('GPS renewal updated')
      } else {
        await apiPost('/gps-renewals', form)
        toast.success('GPS renewal added')
      }
      setEditing(null)
      await load()
    } catch (error) { toast.error(error.message) }
    finally { setBusy(false) }
  }

  const saveFollowUp = async () => {
    if (!followUpModal?.renewal) return
    setBusy(true)
    try {
      const renewal = followUpModal.renewal
      await apiPut(`/gps-renewals/${renewal.id}`, {
        customer: renewal.customer,
        contactNo: renewal.contactNo,
        imeiNo: renewal.imeiNo,
        simNumber: renewal.simNumber,
        vehicleNumber: renewal.vehicleNumber,
        nextDue: dateValue(renewal.nextDue),
        renewalDate: dateValue(renewal.renewalDate),
        followUpDate: followUpModal.followUpDate || null,
        remarks: followUpModal.remarks || ''
      })
      toast.success(followUpModal.followUpDate ? 'Follow-up scheduled' : 'Follow-up saved')
      setFollowUpModal(null)
      await load()
    } catch (error) { toast.error(error.message) }
    finally { setBusy(false) }
  }

  const clearFollowUp = async () => {
    if (!followUpModal?.renewal) return
    setBusy(true)
    try {
      const renewal = followUpModal.renewal
      await apiPut(`/gps-renewals/${renewal.id}`, {
        customer: renewal.customer,
        contactNo: renewal.contactNo,
        imeiNo: renewal.imeiNo,
        simNumber: renewal.simNumber,
        vehicleNumber: renewal.vehicleNumber,
        nextDue: dateValue(renewal.nextDue),
        renewalDate: dateValue(renewal.renewalDate),
        followUpDate: null,
        remarks: ''
      })
      toast.success('Follow-up cleared')
      setFollowUpModal(null)
      await load()
    } catch (error) { toast.error(error.message) }
    finally { setBusy(false) }
  }

  const runAction = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      const { renewal, action } = confirm
      if (action === 'delete') {
        await apiDelete(`/gps-renewals/${renewal.id}`)
        toast.success('GPS renewal deleted')
      } else if (action === 'deleteAll') {
        if (deleteAllScope === 'filtered' && search && filtered.length < renewals.length) {
          const ids = filtered.map(row => row.id)
          const result = await apiDelete('/gps-renewals', { ids })
          toast.success(result?.message || `Deleted ${ids.length} GPS renewal(s)`)
        } else {
          const result = await apiDelete('/gps-renewals')
          toast.success(result?.message || 'All GPS renewals deleted')
        }
      } else {
        await apiPost(`/gps-renewals/${renewal.id}/confirmation`, { confirmed: action === 'confirm' })
        toast.success(action === 'confirm' ? 'Renewal marked confirmed' : 'Confirmation removed')
      }
      setConfirm(null)
      await load()
    } catch (error) { toast.error(error.message) }
    finally { setBusy(false) }
  }

  const importFile = async event => {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''
    if (!selectedFile) return
    if (!selectedFile.name.toLowerCase().endsWith('.xlsx')) return toast.error('Select an .xlsx Excel file.')
    const data = new FormData()
    data.append('file', selectedFile)
    setImporting(true)
    try {
      const result = await apiUpload('/gps-renewals/import', data)
      const summary = `${result.imported} imported, ${result.updated || 0} SIM numbers updated, ${result.skipped} already in CRM`
      toast.success(summary, { duration: 6000 })
      if (result.warnings?.length) toast(`${result.warnings.length} Excel warning(s): ${result.warnings.map(warning => `row ${warning.rowNumber}`).join(', ')}. Check the identifiers in the source file.`, { icon: '⚠️', duration: 10000 })
      if (result.missingContactCount) toast(`${result.missingContactCount} renewals have no contact number in the source file.`, { icon: 'ℹ️', duration: 8000 })
      await load()
    } catch (error) { toast.error(error.message) }
    finally { setImporting(false) }
  }

  const filtered = renewals.filter(row => {
    if (statusFilter === 'followUp' && !row.followUpDate) return false
    if (statusFilter === 'confirmed' && !row.confirmedAt) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [...fields.map(([key]) => key), 'remarks'].some(key =>
      String(row[key] || '').toLowerCase().includes(q)
    )
  })

  const followUpCount = renewals.filter(r => r.followUpDate).length
  const confirmedCount = renewals.filter(r => r.confirmedAt).length
  const today = todayStr()

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading GPS renewals...</div>
  return <div className="animate-fade-in">
    <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div><h1 className="page-title">GPS Renewals</h1><p className="page-subtitle">Track GPS device expiry dates, follow-up schedules, and confirmed renewals.</p></div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input ref={fileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importFile} style={{ display: 'none' }} aria-label="Choose GPS renewals Excel file" />
        <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}><FileUp size={16} style={{ marginRight: 7 }} /> {importing ? 'Importing...' : 'Import Excel'}</button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setDeleteAllScope(search && filtered.length < renewals.length ? 'filtered' : 'all')
            setConfirm({ action: 'deleteAll' })
          }}
          disabled={!renewals.length || busy || importing}
          style={{
            borderColor: renewals.length ? 'rgba(239, 68, 68, 0.4)' : undefined,
            color: renewals.length ? '#ef4444' : 'var(--text-secondary)',
            background: renewals.length ? 'rgba(239, 68, 68, 0.05)' : undefined,
            opacity: renewals.length ? 1 : 0.5,
            cursor: renewals.length ? 'pointer' : 'not-allowed'
          }}
          title={renewals.length ? 'Delete all GPS renewals' : 'No GPS renewals to delete'}
        >
          <Trash2 size={16} style={{ marginRight: 6 }} /> Delete All
        </button>
        <button className="btn-primary" onClick={() => openForm(null)}><Plus size={16} style={{ marginRight: 6 }} /> Add GPS Renewal</button>
      </div>
    </div>

    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
      <div style={{ position: 'relative', width: 300, maxWidth: '100%' }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        <input className="input-field" style={{ paddingLeft: 36, height: 38 }} placeholder="Search renewals, remarks..." value={search} onChange={event => setSearch(event.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { id: 'all', label: `All (${renewals.length})` },
          { id: 'followUp', label: `📅 Follow-ups (${followUpCount})`, color: '#d97706' },
          { id: 'confirmed', label: `✓ Confirmed (${confirmedCount})`, color: '#059669' }
        ].map(tab => {
          const active = statusFilter === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                border: active ? `1.5px solid ${tab.color || 'var(--primary, #6366f1)'}` : '1px solid var(--border-color)',
                background: active ? (tab.color ? `${tab.color}18` : 'rgba(99,102,241,0.12)') : 'transparent',
                color: active ? (tab.color || 'var(--primary, #6366f1)') : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>

    <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <PaginatedTable><table className="data-table" style={{ minWidth: 1240 }}>
        <thead><tr>{fields.map(([, label]) => <th key={label}>{label}</th>)}<th>Action</th></tr></thead>
        <tbody>
          {filtered.map(row => <tr key={row.id} style={row.confirmedAt ? { background: 'rgba(16, 185, 129, 0.12)' } : undefined}>
            <td style={{ fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>{row.customer}</span>
                {row.confirmedAt && <span className="badge badge-success">Confirmed</span>}
              </div>
              {(row.followUpDate || row.remarks) && (
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontWeight: 400, fontSize: 12 }}>
                  {row.followUpDate && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: row.followUpDate <= today ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: row.followUpDate <= today ? '#ef4444' : '#d97706',
                        fontWeight: 600,
                        fontSize: 11,
                        border: `1px solid ${row.followUpDate <= today ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                      }}
                      title={row.followUpDate <= today ? 'Follow-up is due today or overdue' : 'Scheduled follow-up'}
                    >
                      <Clock size={11} /> {row.followUpDate === today ? 'Follow-up Today' : row.followUpDate < today ? `Overdue: ${dateText(row.followUpDate)}` : `Follow-up: ${dateText(row.followUpDate)}`}
                    </span>
                  )}
                  {row.remarks && (
                    <span
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: 11.5,
                        fontStyle: 'italic',
                        maxWidth: 240,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={row.remarks}
                    >
                      💬 {row.remarks}
                    </span>
                  )}
                </div>
              )}
            </td>
            <td>{row.contactNo || '—'}</td><td>{row.imeiNo || '—'}</td><td>{row.simNumber || '—'}</td><td>{row.vehicleNumber || '—'}</td><td>{dateText(row.nextDue)}</td><td>{dateText(row.renewalDate)}</td>
            <td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                title={row.confirmedAt ? 'Remove confirmation' : 'Mark renewal confirmed'}
                aria-label={row.confirmedAt ? 'Remove confirmation' : 'Mark renewal confirmed'}
                style={iconButton('#059669', 'rgba(16,185,129,.12)')}
                onClick={() => setConfirm({ action: row.confirmedAt ? 'unconfirm' : 'confirm', renewal: row })}
              >
                <CheckCircle2 size={16} fill={row.confirmedAt ? '#10b981' : 'none'} />
              </button>
              <button
                type="button"
                title={row.followUpDate ? `Follow-up set for ${dateText(row.followUpDate)}. Click to change.` : 'Schedule follow-up'}
                aria-label="Schedule follow-up"
                style={iconButton(row.followUpDate ? '#d97706' : '#f59e0b', row.followUpDate ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.10)')}
                onClick={() => openFollowUp(row)}
              >
                <Clock size={15} />
              </button>
              <button type="button" title="Edit renewal" aria-label="Edit renewal" style={iconButton('#6366f1', 'rgba(99,102,241,.12)')} onClick={() => openForm(row)}><Pencil size={15} /></button>
              <button type="button" title="Delete renewal" aria-label="Delete renewal" style={iconButton('#ef4444', 'rgba(239,68,68,.10)')} onClick={() => setConfirm({ action: 'delete', renewal: row })}><Trash2 size={15} /></button>
            </div></td>
          </tr>)}
          {!filtered.length && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>{search || statusFilter !== 'all' ? 'No matching GPS renewals.' : 'No GPS renewals yet. Add one or import an Excel file.'}</td></tr>}
        </tbody>
      </table></PaginatedTable>
    </div>

    {editing && <ModalBackdrop className="modal-backdrop" onClick={() => !busy && setEditing(null)}><div className="modal-box" onClick={event => event.stopPropagation()} style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}><h2 style={{ fontSize: 20, fontWeight: 700 }}>{editing.id ? 'Edit GPS Renewal' : 'Add GPS Renewal'}</h2><button type="button" onClick={() => setEditing(null)} style={{ border: 0, background: 'none', cursor: 'pointer' }}><X size={20} /></button></div>
      <form onSubmit={save}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
          {fields.map(([key, label]) => <div className="form-group" key={key}><label className="form-label" htmlFor={`renewal-${key}`}>{label}{!['contactNo', 'simNumber', 'renewalDate'].includes(key) ? ' *' : ''}</label>
            {key === 'nextDue' || key === 'renewalDate' ? <ThemeDatePicker value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} /> : <input id={`renewal-${key}`} className="input-field" type="text" value={form[key]} required={!['contactNo', 'simNumber'].includes(key)} maxLength={key === 'customer' ? 255 : key === 'contactNo' ? 40 : 80} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />}
          </div>)}
          <div className="form-group">
            <label className="form-label" htmlFor="renewal-followUpDate">Follow-up date</label>
            <ThemeDatePicker
              id="renewal-followUpDate"
              value={form.followUpDate}
              onChange={event => setForm(current => ({ ...current, followUpDate: event.target.value }))}
            />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" htmlFor="renewal-remarks">Remarks / Customer Note</label>
            <input
              id="renewal-remarks"
              className="input-field"
              type="text"
              placeholder="e.g. Asked to call in 2-3 days, will renew on Friday"
              maxLength={500}
              value={form.remarks}
              onChange={event => setForm(current => ({ ...current, remarks: event.target.value }))}
            />
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 12 }}>Renewal date can be left blank until the renewal is confirmed. Follow-up date tracks promises to renew later.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" className="btn-secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy || !form.nextDue}>{busy ? 'Saving...' : editing.id ? 'Save Changes' : 'Add Renewal'}</button>
        </div>
      </form>
    </div></ModalBackdrop>}

    {followUpModal && (
      <ModalBackdrop className="modal-backdrop" onClick={() => !busy && setFollowUpModal(null)}>
        <div className="modal-box" onClick={event => event.stopPropagation()} style={{ maxWidth: 480 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 19, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#d97706' }}>
              <Clock size={20} /> Schedule Follow-up
            </h2>
            <button type="button" onClick={() => setFollowUpModal(null)} style={{ border: 0, background: 'none', cursor: 'pointer' }}><X size={20} /></button>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
            <strong>{followUpModal.renewal.customer}</strong> · Vehicle: {followUpModal.renewal.vehicleNumber || '—'} · Expires {dateText(followUpModal.renewal.nextDue)}
          </p>

          <div style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Quick Select:</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: 'Tomorrow (+1d)', days: 1 },
                { label: 'In 2 Days', days: 2 },
                { label: 'In 3 Days', days: 3 },
                { label: 'In 1 Week', days: 7 }
              ].map(preset => {
                const presetDate = getOffsetDate(preset.days)
                const isSelected = followUpModal.followUpDate === presetDate
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setFollowUpModal(current => ({ ...current, followUpDate: presetDate }))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid #d97706' : '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(245, 158, 11, 0.18)' : 'var(--bg-secondary, rgba(255,255,255,0.05))',
                      color: isSelected ? '#d97706' : 'var(--text-primary)'
                    }}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label" htmlFor="followup-date">Follow-up Date</label>
            <ThemeDatePicker
              id="followup-date"
              value={followUpModal.followUpDate}
              onChange={event => setFollowUpModal(current => ({ ...current, followUpDate: event.target.value }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" htmlFor="followup-remarks">Remarks / Customer Note</label>
            <textarea
              id="followup-remarks"
              className="input-field"
              rows={3}
              placeholder="e.g. Asked to call in 2-3 days, salary credited on 1st"
              maxLength={500}
              value={followUpModal.remarks}
              onChange={event => setFollowUpModal(current => ({ ...current, remarks: event.target.value }))}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
            {followUpModal.renewal.followUpDate ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={clearFollowUp}
                disabled={busy}
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                Clear Follow-up
              </button>
            ) : <div />}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-secondary" onClick={() => setFollowUpModal(null)} disabled={busy}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                onClick={saveFollowUp}
                disabled={busy || !followUpModal.followUpDate}
                style={{ background: '#d97706', borderColor: '#d97706' }}
              >
                {busy ? 'Saving...' : 'Save Follow-up'}
              </button>
            </div>
          </div>
        </div>
      </ModalBackdrop>
    )}

    {confirm && <ModalBackdrop className="modal-backdrop" onClick={() => !busy && setConfirm(null)}><div className="modal-box" onClick={event => event.stopPropagation()} style={{ maxWidth: 460 }}>
      {confirm.action === 'deleteAll' ? (
        <>
          <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trash2 size={20} /> Delete GPS renewals?
          </h2>
          {search && filtered.length < renewals.length ? (
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 14 }}>
              <p style={{ marginBottom: 10 }}>A search filter is currently active. Choose what you want to delete:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: deleteAllScope === 'filtered' ? 'rgba(239,68,68,0.08)' : 'transparent' }}>
                  <input type="radio" name="deleteScope" checked={deleteAllScope === 'filtered'} onChange={() => setDeleteAllScope('filtered')} />
                  <span>Delete only <strong>{filtered.length}</strong> matching search results</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: deleteAllScope === 'all' ? 'rgba(239,68,68,0.08)' : 'transparent' }}>
                  <input type="radio" name="deleteScope" checked={deleteAllScope === 'all'} onChange={() => setDeleteAllScope('all')} />
                  <span>Delete all <strong>{renewals.length}</strong> GPS renewals</span>
                </label>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Are you sure you want to delete all <strong>{renewals.length}</strong> GPS renewal record{renewals.length === 1 ? '' : 's'}?
            </p>
          )}
          <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>
            ⚠️ This will permanently delete the records from the CRM. This action cannot be undone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <button type="button" className="btn-secondary" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
            <button
              type="button"
              className="btn-primary"
              onClick={runAction}
              disabled={busy}
              style={{ background: '#ef4444', borderColor: '#ef4444' }}
            >
              {busy ? 'Deleting...' : deleteAllScope === 'filtered' && search && filtered.length < renewals.length ? `Delete ${filtered.length} Renewals` : `Delete All (${renewals.length})`}
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 12 }}>{confirm.action === 'delete' ? 'Delete GPS renewal?' : confirm.action === 'confirm' ? 'Confirm renewal?' : 'Remove confirmation?'}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{confirm.renewal.customer} · {confirm.renewal.imeiNo || 'No IMEI'} · expires {dateText(confirm.renewal.nextDue)}</p>
          {confirm.action === 'confirm' && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>This marks the row green and fills today as the renewal date if no renewal date was entered.</p>}
          {confirm.action === 'delete' && <p style={{ color: '#dc2626', fontSize: 13 }}>This record will be permanently deleted.</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <button type="button" className="btn-secondary" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
            <button type="button" className="btn-primary" onClick={runAction} disabled={busy} style={confirm.action === 'delete' ? { background: '#ef4444', borderColor: '#ef4444' } : {}}>
              {busy ? 'Saving...' : confirm.action === 'delete' ? 'Delete' : confirm.action === 'confirm' ? 'Mark confirmed' : 'Remove confirmation'}
            </button>
          </div>
        </>
      )}
    </div></ModalBackdrop>}
  </div>
}

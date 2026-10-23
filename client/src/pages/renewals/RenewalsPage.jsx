import { useEffect, useState } from 'react'
import { CheckCircle2, Download, FileUp, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalBackdrop from '../../components/ModalBackdrop'
import ThemeDatePicker from '../../components/ThemeDatePicker'
import { apiDelete, apiDownload, apiGetAll, apiPost, apiPut, apiUpload } from '../../utils/api'

const emptyForm = { customer: '', contactNo: '', imeiNo: '', vehicleNumber: '', nextDue: '', renewalDate: '' }
const fields = [['customer', 'Customer name'], ['contactNo', 'Contact No'], ['imeiNo', 'IMEI No'], ['vehicleNumber', 'Vehicle Number'], ['nextDue', 'Expiry date'], ['renewalDate', 'Renewal date']]
const dateValue = value => value ? String(value).slice(0, 10) : ''
const dateText = value => value ? new Date(`${dateValue(value)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const iconButton = (color, background) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: `1px solid ${color}44`, background, color, cursor: 'pointer' })

export default function RenewalsPage() {
  const [renewals, setRenewals] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [importOpen, setImportOpen] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const load = async () => {
    try { setRenewals(await apiGetAll('/gps-renewals')) }
    catch (error) { toast.error(error.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openForm = renewal => {
    setEditing(renewal || { id: null })
    setForm(renewal ? Object.fromEntries(fields.map(([key]) => [key, key === 'nextDue' || key === 'renewalDate' ? dateValue(renewal[key]) : renewal[key] || ''])) : { ...emptyForm })
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

  const runAction = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      const { renewal, action } = confirm
      if (action === 'delete') {
        await apiDelete(`/gps-renewals/${renewal.id}`)
        toast.success('GPS renewal deleted')
      } else {
        await apiPost(`/gps-renewals/${renewal.id}/confirmation`, { confirmed: action === 'confirm' })
        toast.success(action === 'confirm' ? 'Renewal marked confirmed' : 'Confirmation removed')
      }
      setConfirm(null)
      await load()
    } catch (error) { toast.error(error.message) }
    finally { setBusy(false) }
  }

  const uploadFile = () => { const data = new FormData(); data.append('file', file); return data }
  const previewImport = async () => {
    if (!file) return toast.error('Select an .xlsx file')
    setBusy(true)
    try { setPreview(await apiUpload('/gps-renewals/import/preview', uploadFile())) }
    catch (error) { toast.error(error.message) }
    finally { setBusy(false) }
  }
  const importRows = async () => {
    setBusy(true)
    try {
      const result = await apiUpload('/gps-renewals/import', uploadFile())
      toast.success(`${result.imported} GPS renewals imported${result.skipped ? `; ${result.skipped} existing rows skipped` : ''}`)
      setImportOpen(false)
      setFile(null)
      setPreview(null)
      await load()
    } catch (error) { toast.error(error.message) }
    finally { setBusy(false) }
  }
  const filtered = renewals.filter(row => fields.some(([key]) => String(row[key] || '').toLowerCase().includes(search.toLowerCase())))

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading GPS renewals...</div>
  return <div className="animate-fade-in">
    <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div><h1 className="page-title">GPS Renewals</h1><p className="page-subtitle">Track GPS device expiry dates and confirmed renewals.</p></div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn-secondary" onClick={() => { setFile(null); setPreview(null); setImportOpen(true) }}><FileUp size={16} style={{ marginRight: 7 }} /> Import Excel</button>
        <button className="btn-primary" onClick={() => openForm(null)}><Plus size={16} style={{ marginRight: 6 }} /> Add GPS Renewal</button>
      </div>
    </div>
    <div style={{ position: 'relative', width: 300, maxWidth: '100%', marginBottom: 20 }}>
      <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
      <input className="input-field" style={{ paddingLeft: 36, height: 38 }} placeholder="Search GPS renewals..." value={search} onChange={event => setSearch(event.target.value)} />
    </div>
    <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table className="data-table" style={{ minWidth: 1060 }}>
        <thead><tr>{fields.map(([, label]) => <th key={label}>{label}</th>)}<th>Action</th></tr></thead>
        <tbody>
          {filtered.map(row => <tr key={row.id} style={row.confirmedAt ? { background: 'rgba(16, 185, 129, 0.12)' } : undefined}>
            <td style={{ fontWeight: 600 }}>{row.customer}{row.confirmedAt && <span className="badge badge-success" style={{ marginLeft: 8 }}>Confirmed</span>}</td>
            <td>{row.contactNo || '—'}</td><td>{row.imeiNo || '—'}</td><td>{row.vehicleNumber || '—'}</td><td>{dateText(row.nextDue)}</td><td>{dateText(row.renewalDate)}</td>
            <td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" title={row.confirmedAt ? 'Remove confirmation' : 'Mark renewal confirmed'} aria-label={row.confirmedAt ? 'Remove confirmation' : 'Mark renewal confirmed'} style={iconButton('#059669', 'rgba(16,185,129,.12)')} onClick={() => setConfirm({ action: row.confirmedAt ? 'unconfirm' : 'confirm', renewal: row })}><CheckCircle2 size={16} fill={row.confirmedAt ? '#10b981' : 'none'} /></button>
              <button type="button" title="Edit renewal" aria-label="Edit renewal" style={iconButton('#6366f1', 'rgba(99,102,241,.12)')} onClick={() => openForm(row)}><Pencil size={15} /></button>
              <button type="button" title="Delete renewal" aria-label="Delete renewal" style={iconButton('#ef4444', 'rgba(239,68,68,.10)')} onClick={() => setConfirm({ action: 'delete', renewal: row })}><Trash2 size={15} /></button>
            </div></td>
          </tr>)}
          {!filtered.length && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>{search ? 'No matching GPS renewals.' : 'No GPS renewals yet. Add one or import an Excel file.'}</td></tr>}
        </tbody>
      </table>
    </div>

    {editing && <ModalBackdrop className="modal-backdrop" onClick={() => !busy && setEditing(null)}><div className="modal-box" onClick={event => event.stopPropagation()} style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}><h2 style={{ fontSize: 20, fontWeight: 700 }}>{editing.id ? 'Edit GPS Renewal' : 'Add GPS Renewal'}</h2><button type="button" onClick={() => setEditing(null)} style={{ border: 0, background: 'none', cursor: 'pointer' }}><X size={20} /></button></div>
      <form onSubmit={save}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
        {fields.map(([key, label]) => <div className="form-group" key={key}><label className="form-label" htmlFor={`renewal-${key}`}>{label}{key !== 'renewalDate' ? ' *' : ''}</label>
          {key === 'nextDue' || key === 'renewalDate' ? <ThemeDatePicker value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} /> : <input id={`renewal-${key}`} className="input-field" type="text" value={form[key]} required maxLength={key === 'customer' ? 255 : key === 'contactNo' ? 40 : 80} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />}
        </div>)}
      </div><p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 12 }}>Renewal date can be left blank until the renewal is confirmed.</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}><button type="button" className="btn-secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</button><button type="submit" className="btn-primary" disabled={busy || !form.nextDue}>{busy ? 'Saving...' : editing.id ? 'Save Changes' : 'Add Renewal'}</button></div></form>
    </div></ModalBackdrop>}

    {importOpen && <ModalBackdrop className="modal-backdrop" onClick={() => !busy && setImportOpen(false)}><div className="modal-box" onClick={event => event.stopPropagation()} style={{ maxWidth: 780, maxHeight: '85vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><h2 style={{ fontSize: 20, fontWeight: 700 }}>Import GPS renewals</h2><button type="button" onClick={() => setImportOpen(false)} style={{ border: 0, background: 'none', cursor: 'pointer' }}><X size={20} /></button></div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Use an .xlsx file with these headers in the first row: {fields.map(([, label]) => label).join(', ')}. Keep Contact No and IMEI No formatted as text. Renewal date may be blank.</p>
      <button type="button" className="btn-secondary" onClick={() => apiDownload('/gps-renewals/template.xlsx', 'gps-renewals-template.xlsx').catch(error => toast.error(error.message))}><Download size={16} style={{ marginRight: 6 }} /> Download template</button>
      <div className="form-group" style={{ marginTop: 16 }}><label className="form-label" htmlFor="gps-renewal-file">Excel file</label><input id="gps-renewal-file" className="input-field" type="file" accept=".xlsx" onChange={event => { setFile(event.target.files?.[0] || null); setPreview(null) }} /></div>
      {preview && <div style={{ marginTop: 16 }}><p style={{ fontSize: 13, color: 'var(--text-primary)' }}><strong>{preview.importableCount}</strong> ready to import · <strong>{preview.duplicateRows.length}</strong> already in CRM · <strong>{preview.errors.length}</strong> invalid rows</p>
        {preview.errors.length > 0 && <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,.10)', color: '#dc2626', fontSize: 13, maxHeight: 130, overflowY: 'auto' }}>{preview.errors.map(error => <div key={error.rowNumber}>Row {error.rowNumber}: {error.message}</div>)}</div>}
        {preview.duplicateRows.length > 0 && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Existing rows skipped: {preview.duplicateRows.join(', ')}</p>}
        <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto', marginTop: 12 }}><table className="data-table" style={{ minWidth: 720 }}><thead><tr>{fields.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 10).map(row => <tr key={row.rowNumber}><td>{row.customer}</td><td>{row.contactNo}</td><td>{row.imeiNo}</td><td>{row.vehicleNumber}</td><td>{dateText(row.nextDue)}</td><td>{dateText(row.renewalDate)}</td></tr>)}</tbody></table></div>
        {preview.rows.length > 10 && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Showing the first 10 rows of {preview.rows.length}.</p>}
      </div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}><button type="button" className="btn-secondary" onClick={() => setImportOpen(false)} disabled={busy}>Cancel</button><button type="button" className="btn-secondary" onClick={previewImport} disabled={busy || !file}>{busy ? 'Checking...' : 'Preview file'}</button><button type="button" className="btn-primary" onClick={importRows} disabled={busy || !preview || preview.errors.length > 0 || preview.importableCount === 0}>{busy ? 'Importing...' : `Import ${preview?.importableCount || 0} renewals`}</button></div>
    </div></ModalBackdrop>}

    {confirm && <ModalBackdrop className="modal-backdrop" onClick={() => !busy && setConfirm(null)}><div className="modal-box" onClick={event => event.stopPropagation()} style={{ maxWidth: 440 }}>
      <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 12 }}>{confirm.action === 'delete' ? 'Delete GPS renewal?' : confirm.action === 'confirm' ? 'Confirm renewal?' : 'Remove confirmation?'}</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{confirm.renewal.customer} · {confirm.renewal.imeiNo || 'No IMEI'} · expires {dateText(confirm.renewal.nextDue)}</p>
      {confirm.action === 'confirm' && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>This marks the row green and fills today as the renewal date if no renewal date was entered.</p>}
      {confirm.action === 'delete' && <p style={{ color: '#dc2626', fontSize: 13 }}>This record will be permanently deleted.</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}><button type="button" className="btn-secondary" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button><button type="button" className="btn-primary" onClick={runAction} disabled={busy} style={confirm.action === 'delete' ? { background: '#ef4444', borderColor: '#ef4444' } : {}}>{busy ? 'Saving...' : confirm.action === 'delete' ? 'Delete' : confirm.action === 'confirm' ? 'Mark confirmed' : 'Remove confirmation'}</button></div>
    </div></ModalBackdrop>}
  </div>
}

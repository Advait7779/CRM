import { useEffect, useRef, useState } from 'react'
import { Download, RefreshCw, Search, TableProperties, ChevronLeft, ChevronRight, Pencil, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeSelect from '../../components/ThemeSelect'
import { apiDownload, apiGet, apiPost, apiPut } from '../../utils/api'
import { useAuth } from '../../context/AuthContext'
import { localDateString } from '../../utils/date'
import ModalBackdrop from '../../components/ModalBackdrop'
import { LeadModal } from './LeadsPage'

const ZONE = 'Asia/Kolkata'
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: ZONE
})
const formatDate = value => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? dateFormatter.format(date) : '—'
}
const text = value => String(value ?? '')
const ACTION_STATUSES = ['New', 'Connected', 'Future Prospect', 'Fake Enquiry', 'Interested',
  'Not Interested', 'Follow-Up Required', "Didn't Answered"]
const STATUS_COLOR = {
  New: '#60a5fa', Connected: '#6366f1', 'Future Prospect': '#8b5cf6',
  'Fake Enquiry': '#ef4444', Interested: '#10b981', 'Not Interested': '#f97316',
  'Follow-Up Required': '#f59e0b', "Didn't Answered": '#f97316', Converted: '#10b981'
}
const connectionErrorMessage = error => error?.message === 'API endpoint not found.'
  ? 'The Facebook Leads API is not deployed on the CRM server yet. Redeploy the server from the latest main branch.'
  : error?.message || 'Could not reach the CRM server.'
const tabStorageKey = userId => `facebook-sheet-tabs:${userId}`
const savedTabs = userId => {
  if (!userId) return null
  try {
    const saved = JSON.parse(localStorage.getItem(tabStorageKey(userId)) || 'null')
    return saved?.configured && Array.isArray(saved.tabs) ? saved : null
  } catch { return null }
}

export default function FacebookLeadsPage() {
  const { user } = useAuth()
  const isAdmin = ['super_admin', 'director'].includes(user?.role)
  const [connection, setConnection] = useState(() => savedTabs(user?.id))
  const [connectionError, setConnectionError] = useState('')
  const [selected, setSelected] = useState('crm')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [reload, setReload] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [editingLead, setEditingLead] = useState(null)
  const [openingLeadId, setOpeningLeadId] = useState(null)
  const [systemUsers, setSystemUsers] = useState([])
  const [productOptions, setProductOptions] = useState([])
  const [convertLead, setConvertLead] = useState(null)
  const [converting, setConverting] = useState(false)
  const [savingStatusKey, setSavingStatusKey] = useState(null)
  const refreshNextRequest = useRef(false)
  const editOptionsRequest = useRef(null)

  useEffect(() => { editOptionsRequest.current = null; setEditingLead(null) }, [user?.id])

  useEffect(() => {
    let active = true
    setConnection(savedTabs(user?.id))
    setConnectionError('')
    apiGet(`/facebook-sheet/tabs${refreshNextRequest.current ? '?refresh=1' : ''}`)
      .then(result => {
        if (!active) return
        setConnection(result)
        if (user?.id && result.configured && Array.isArray(result.tabs)) {
          try { localStorage.setItem(tabStorageKey(user.id), JSON.stringify(result)) } catch { /* Storage is optional. */ }
        }
      })
      .catch(err => { if (active) setConnectionError(connectionErrorMessage(err)) })
    return () => { active = false }
  }, [reload, user?.id])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search: search.trim() })
      if (refreshNextRequest.current && selected !== 'crm') query.set('refresh', '1')
      refreshNextRequest.current = false
      const path = selected === 'crm' ? `/facebook-sheet/crm?${query}` : `/facebook-sheet/tabs/${selected}?${query}`
      apiGet(path)
        .then(result => { if (active) setData(result) })
        .catch(err => { if (active) { setData(null); setError(connectionErrorMessage(err)) } })
        .finally(() => { if (active) setLoading(false) })
    }, search ? 250 : 0)
    return () => { active = false; clearTimeout(timer) }
  }, [selected, page, pageSize, search, reload])

  const chooseTab = value => { setSelected(String(value)); setPage(1); setSearch(''); setData(null) }
  const refresh = () => { refreshNextRequest.current = true; setReload(value => value + 1) }
  const activeName = selected === 'crm' ? 'All CRM Facebook leads' : connection?.tabs?.find(tab => String(tab.gid) === selected)?.title || data?.tab?.title || 'Sheet tab'
  const total = data?.total || 0
  const pages = Math.max(1, Math.ceil(total / pageSize))

  const syncTab = async () => {
    if (selected === 'crm' || syncing) return
    setSyncing(true)
    try {
      const result = await apiPost(`/facebook-sheet/tabs/${selected}/sync`, {})
      toast.success(`${result.imported} new leads imported · ${result.mapped} tab links added`)
      refresh()
    } catch (err) { toast.error(err.message) }
    finally { setSyncing(false) }
  }

  const exportRows = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const query = new URLSearchParams({ search: search.trim() })
      const path = selected === 'crm' ? `/leads-export.xlsx?group=Facebook%20Leads&${query}` : `/facebook-sheet/tabs/${selected}/export.xlsx?${query}`
      await apiDownload(path, `facebook-leads-${selected}-${localDateString()}.xlsx`)
    } catch (err) { toast.error(err.message) }
    finally { setExporting(false) }
  }

  const openLead = async id => {
    if (openingLeadId) return
    setOpeningLeadId(id)
    try {
      if (!editOptionsRequest.current) editOptionsRequest.current = Promise.all([
        apiGet('/system-users'),
        isAdmin ? apiGet('/justdial/products') : Promise.resolve(null)
      ])
      const [lead, [users, products]] = await Promise.all([apiGet(`/leads/${id}`), editOptionsRequest.current])
      setSystemUsers(Array.isArray(users) ? users : [])
      setProductOptions(products?.assignable || [])
      setEditingLead(lead)
    } catch (err) {
      editOptionsRequest.current = null
      toast.error(`Could not open Facebook lead: ${err.message}`)
    } finally { setOpeningLeadId(null) }
  }

  const saveLead = async (form, id) => {
    try {
      await apiPut(`/leads/${id}`, { ...form, source: 'Facebook' })
      toast.success('Facebook lead updated')
      setReload(value => value + 1)
    } catch (err) { toast.error(err.message) }
  }

  const confirmConversion = async () => {
    if (!convertLead || converting) return
    setConverting(true)
    try {
      await apiPost(`/leads/${convertLead.id}/convert`, {})
      toast.success(`${convertLead.name} converted to a customer`)
      setConvertLead(null)
      setReload(value => value + 1)
    } catch (err) { toast.error(err.message) }
    finally { setConverting(false) }
  }

  const changeStatus = async (lead, nextStatus, rowNumber = null) => {
    const current = lead.status
    if (!nextStatus || nextStatus === current || savingStatusKey) return
    const key = rowNumber === null ? `crm:${lead.id}` : `sheet:${selected}:${rowNumber}`
    setSavingStatusKey(key)
    try {
      if (rowNumber === null) await apiPut(`/leads/${lead.id}`, { status: nextStatus })
      else await apiPut(`/facebook-sheet/tabs/${selected}/rows/${rowNumber}/status`, { status: nextStatus })
      setData(previous => {
        if (!previous || (rowNumber === null ? Boolean(previous.tab) : String(previous.tab?.gid) !== selected)) return previous
        return { ...previous, rows: previous.rows.map(row =>
          rowNumber === null ? row.id === lead.id ? { ...row, status: nextStatus } : row
            : row.rowNumber === rowNumber ? { ...row, status: nextStatus,
              crm: row.crm ? { ...row.crm, status: nextStatus } : null } : row) }
      })
      toast.success(`Status updated to "${nextStatus}"`)
    } catch (err) { toast.error(err.message) }
    finally { setSavingStatusKey(null) }
  }

  const actionControls = (lead, rowNumber = null) => {
    const linked = rowNumber === null || Boolean(lead.crm)
    const crm = rowNumber === null ? lead : lead.crm
    const status = lead.status || 'New'
    const converted = crm?.status === 'Converted' || Boolean(crm?.convertedCustomerId)
    const color = STATUS_COLOR[status] || '#6366f1'
    const name = rowNumber === null ? lead.name : lead.lead?.name || `sheet row ${rowNumber}`
    return <div style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
      {isAdmin && <button type="button" onClick={() => linked && openLead(crm.id)} disabled={!linked || openingLeadId === crm?.id}
        title={linked ? 'Edit lead and assign an executive' : 'Sync this row into CRM to edit it'}
        aria-label={`Edit ${name} and assign an executive`}
        style={{ width: 28, height: 28, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', color: '#6366f1', cursor: linked ? 'pointer' : 'not-allowed', flexShrink: 0 }}>
        <Pencil size={14} />
      </button>}
      {!converted && <ThemeSelect value={status} disabled={savingStatusKey !== null}
        onChange={event => changeStatus(lead, event.target.value, rowNumber)}
        aria-label={`Status for ${name}`}
        style={{ height: '26px', width: '92px', minWidth: '92px', maxWidth: '92px', fontSize: '11px', fontWeight: 600,
          borderRadius: '6px', padding: '0 18px 0 7px', background: `${color}12`, border: `1px solid ${color}40`, color }}>
        {!ACTION_STATUSES.includes(status) && <option value={status}>{status}</option>}
        {ACTION_STATUSES.map(option => <option key={option} value={option}>{option}</option>)}
      </ThemeSelect>}
      {!converted ? <button type="button" onClick={() => linked && setConvertLead({ ...crm, name })} disabled={!linked}
        title={linked ? 'Convert Lead to Active Customer' : 'Sync this row into CRM to convert it'}
        aria-label={`Convert ${name} to customer`}
        style={{ width: 28, height: 28, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)',
          cursor: linked ? 'pointer' : 'not-allowed', transition: 'all 0.15s ease', flexShrink: 0 }}>
        <UserCheck size={14} style={{ color: '#10b981' }} />
      </button> : <span title="Lead is already converted to an active customer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#10b981',
          background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)',
          padding: '4px 7px', borderRadius: 7, whiteSpace: 'nowrap', flexShrink: 0 }}><UserCheck size={12} /> Converted</span>}
    </div>
  }

  return <div className="animate-fade-in">
    <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><TableProperties size={26} /> Facebook Leads</h1>
        <p className="page-subtitle">Choose a spreadsheet tab to view its rows, or review all Facebook leads in the CRM.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={refresh} disabled={loading}><RefreshCw size={16} /> Refresh</button>
        {isAdmin && selected !== 'crm' && data?.tab?.importable && <button type="button" className="btn-primary" onClick={syncTab} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync tab into CRM'}</button>}
        <button type="button" className="btn-secondary" onClick={exportRows} disabled={exporting || !total}>
          <Download size={16} /> {exporting ? 'Preparing…' : selected === 'crm' ? 'Export CRM leads' : 'Download tab rows'}
        </button>
      </div>
    </div>

    {connectionError && <div style={{ padding: 16, marginBottom: 18, borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: 'var(--text-primary)' }}>
      <strong>CRM server connection failed.</strong> {connectionError}
    </div>}
    {connection && !connection.configured && <div style={{ padding: 16, marginBottom: 18, borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', color: 'var(--text-primary)' }}>
      <strong>Spreadsheet connection needs setup.</strong> Configure the CRM server with the Facebook Apps Script URL and read secret, or a Google service account with Viewer access. Existing CRM Facebook leads remain available below.
      {connection.issues?.length > 0 && <div style={{ fontSize: 12, marginTop: 7 }}>{connection.issues.join(' · ')}</div>}
    </div>}

    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 16 }}>
      <div style={{ minWidth: 280, maxWidth: 420, flex: '1 1 300px' }}>
        <label className="form-label" htmlFor="facebook-tab">Spreadsheet tab</label>
        <ThemeSelect id="facebook-tab" className="input-field" value={selected} onChange={event => chooseTab(event.target.value)}>
          <option value="crm">All CRM Facebook leads</option>
          {!connection && <option value="loading" disabled>{connectionError ? 'Spreadsheet tabs unavailable' : 'Loading spreadsheet tabs…'}</option>}
          {connection?.tabs?.map(tab => <option key={tab.gid} value={tab.gid}>{tab.title}</option>)}
        </ThemeSelect>
      </div>
      <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: 360 }}>
        <label className="form-label" htmlFor="facebook-search">Search this view</label>
        <Search size={15} style={{ position: 'absolute', left: 12, bottom: 12, color: 'var(--text-secondary)' }} />
        <input id="facebook-search" className="input-field" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Name, phone, service..." style={{ paddingLeft: 35 }} />
      </div>
      <div>
        <label className="form-label" htmlFor="facebook-page-size">Rows</label>
        <ThemeSelect id="facebook-page-size" className="input-field" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}>
          {[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
        </ThemeSelect>
      </div>
    </div>

    {selected !== 'crm' && data?.tab && <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
      {data.tab.importable ? `${data.mappedCount} leads from this tab linked to CRM.` : `This tab cannot be synced to CRM. ${data.tab.reason || ''} Row statuses can still be marked here.`}
      {' '}Last fetched: {formatDate(data.fetchedAt)}
    </div>}
    {error && <div style={{ padding: 16, marginBottom: 16, borderRadius: 10, color: '#b91c1c', background: 'rgba(239,68,68,0.1)' }}>{error}</div>}

    <div className="table-pagination-shell facebook-sheet-table-scroll">
      <div className="table-pagination-surface" style={{ minWidth: selected === 'crm' ? 980 : undefined }}>
        <table className="data-table">
          {selected === 'crm' ? <>
            <thead><tr><th>Name</th><th>Phone</th><th>Service</th><th>Platform</th><th>Lead Date</th><th>Status</th><th>Executive</th><th>Origin</th><th>Action</th></tr></thead>
            <tbody>{(data?.rows || []).map(lead => <tr key={lead.id}>
              <td style={{ fontWeight: 600 }}>{lead.name}</td><td>{lead.phone}</td><td>{lead.service}</td>
              <td>{lead.facebookPlatform === 'ig' ? 'Instagram' : 'Facebook'}</td>
              <td>{formatDate(lead.facebookSubmittedAt || lead.createdAt)}</td><td>{lead.status}</td><td>{lead.exec || '—'}</td>
              <td>{lead.facebookLeadId ? 'Google Sheet' : 'CRM entry'}</td>
              <td>{actionControls(lead)}</td>
            </tr>)}</tbody>
          </> : <>
            <thead><tr><th>#</th><th>CRM</th>{(data?.headers || []).map((header, index) => <th key={index} title={text(header)}>{header}</th>)}<th>Action</th></tr></thead>
            <tbody>{(data?.rows || []).map(row => <tr key={row.rowNumber}>
              <td>{row.rowNumber}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{row.crm ? 'In CRM' : 'Sheet only'}</td>
              {(data?.headers || []).map((_, index) => <td key={index} title={text(row.values[index])}>{text(row.values[index]) || '—'}</td>)}
              <td>{actionControls(row, row.rowNumber)}</td>
            </tr>)}</tbody>
          </>}
        </table>
        {!loading && !error && !data?.rows?.length && <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-secondary)' }}>No rows in {activeName}.</div>}
        {loading && <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading {activeName}…</div>}
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '12px 4px', color: 'var(--text-secondary)', fontSize: 13 }}>
      <span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : '0 rows'}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" className="btn-secondary" aria-label="Previous page" onClick={() => setPage(value => value - 1)} disabled={page <= 1}><ChevronLeft size={16} /></button>
        <span>Page {page} of {pages}</span>
        <button type="button" className="btn-secondary" aria-label="Next page" onClick={() => setPage(value => value + 1)} disabled={page >= pages}><ChevronRight size={16} /></button>
      </div>
    </div>
    {editingLead && <LeadModal lead={editingLead} isNew={false} isAdmin={isAdmin} lockSource currentUser={user} systemUsers={systemUsers} productOptions={productOptions} onClose={() => setEditingLead(null)} onSave={saveLead} />}
    {convertLead && <ModalBackdrop className="modal-backdrop" onClick={() => !converting && setConvertLead(null)}>
      <div className="modal-box" onClick={event => event.stopPropagation()} style={{ maxWidth: 440 }}>
        <h2 style={{ marginBottom: 12 }}>Convert to Active Customer</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Convert <strong>{convertLead.name}</strong> into an active customer account?</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn-secondary" disabled={converting} onClick={() => setConvertLead(null)}>Cancel</button>
          <button type="button" className="btn-primary" disabled={converting} onClick={confirmConversion}>{converting ? 'Converting…' : 'Yes, Convert to Customer'}</button>
        </div>
      </div>
    </ModalBackdrop>}
  </div>
}

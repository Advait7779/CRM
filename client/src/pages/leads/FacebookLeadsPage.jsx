import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, RefreshCw, Search, TableProperties, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeSelect from '../../components/ThemeSelect'
import { apiDownload, apiGet, apiPost } from '../../utils/api'
import { useAuth } from '../../context/AuthContext'
import { localDateString } from '../../utils/date'

const ZONE = 'Asia/Kolkata'
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: ZONE
})
const formatDate = value => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? dateFormatter.format(date) : '—'
}
const text = value => String(value ?? '')

export default function FacebookLeadsPage() {
  const { user } = useAuth()
  const isAdmin = ['super_admin', 'director'].includes(user?.role)
  const [connection, setConnection] = useState({ configured: false, tabs: [], issues: [] })
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

  useEffect(() => {
    let active = true
    apiGet('/facebook-sheet/tabs')
      .then(result => { if (active) setConnection(result) })
      .catch(err => { if (active) setConnection({ configured: false, tabs: [], issues: [err.message] }) })
    return () => { active = false }
  }, [reload])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search: search.trim() })
      const path = selected === 'crm' ? `/facebook-sheet/crm?${query}` : `/facebook-sheet/tabs/${selected}?${query}`
      apiGet(path)
        .then(result => { if (active) setData(result) })
        .catch(err => { if (active) { setData(null); setError(err.message) } })
        .finally(() => { if (active) setLoading(false) })
    }, search ? 250 : 0)
    return () => { active = false; clearTimeout(timer) }
  }, [selected, page, pageSize, search, reload])

  const chooseTab = value => { setSelected(String(value)); setPage(1); setSearch(''); setData(null) }
  const refresh = () => { setReload(value => value + 1) }
  const activeName = selected === 'crm' ? 'All CRM Facebook leads' : connection.tabs.find(tab => String(tab.gid) === selected)?.title || data?.tab?.title || 'Sheet tab'
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

    {!connection.configured && <div style={{ padding: 16, marginBottom: 18, borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', color: 'var(--text-primary)' }}>
      <strong>Spreadsheet connection needs setup.</strong> The CRM server needs its read-only Google service account credentials and Viewer access to the workbook. Existing CRM Facebook leads remain available below.
      {connection.issues?.length > 0 && <div style={{ fontSize: 12, marginTop: 7 }}>{connection.issues.join(' · ')}</div>}
    </div>}

    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 16 }}>
      <div style={{ minWidth: 280, maxWidth: 420, flex: '1 1 300px' }}>
        <label className="form-label" htmlFor="facebook-tab">Spreadsheet tab</label>
        <ThemeSelect id="facebook-tab" className="input-field" value={selected} onChange={event => chooseTab(event.target.value)}>
          <option value="crm">All CRM Facebook leads</option>
          {connection.tabs.map(tab => <option key={tab.gid} value={tab.gid}>{tab.title}</option>)}
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
      {data.tab.importable ? `${data.mappedCount} leads from this tab linked to CRM.` : `Read-only tab. ${data.tab.reason || ''}`}
      {' '}Last fetched: {formatDate(data.fetchedAt)}
    </div>}
    {error && <div style={{ padding: 16, marginBottom: 16, borderRadius: 10, color: '#b91c1c', background: 'rgba(239,68,68,0.1)' }}>{error}</div>}

    <div className="table-pagination-shell" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div className="table-pagination-surface" style={{ minWidth: selected === 'crm' ? 980 : Math.max(980, (data?.headers?.length || 6) * 155) }}>
        <table className="data-table">
          {selected === 'crm' ? <>
            <thead><tr><th>Name</th><th>Phone</th><th>Service</th><th>Platform</th><th>Lead Date</th><th>Status</th><th>Executive</th><th>Origin</th><th>Action</th></tr></thead>
            <tbody>{(data?.rows || []).map(lead => <tr key={lead.id}>
              <td style={{ fontWeight: 600 }}>{lead.name}</td><td>{lead.phone}</td><td>{lead.service}</td>
              <td>{lead.facebookPlatform === 'ig' ? 'Instagram' : 'Facebook'}</td>
              <td>{formatDate(lead.facebookSubmittedAt || lead.createdAt)}</td><td>{lead.status}</td><td>{lead.exec || '—'}</td>
              <td>{lead.facebookLeadId ? 'Google Sheet' : 'CRM entry'}</td>
              <td><Link to={`/leads?search=${encodeURIComponent(lead.phone)}`}>Open in Leads</Link></td>
            </tr>)}</tbody>
          </> : <>
            <thead><tr><th>#</th><th>CRM</th>{(data?.headers || []).map((header, index) => <th key={index} title={text(header)} style={{ maxWidth: 240 }}>{header}</th>)}</tr></thead>
            <tbody>{(data?.rows || []).map(row => <tr key={row.rowNumber}>
              <td>{row.rowNumber}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{row.crm ? <Link to={`/leads?search=${encodeURIComponent(row.lead?.phone || '')}`}>{row.crm.status || 'In CRM'}</Link> : 'Sheet only'}</td>
              {(data?.headers || []).map((_, index) => <td key={index} title={text(row.values[index])} style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text(row.values[index]) || '—'}</td>)}
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
  </div>
}

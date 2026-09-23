import { useState, useEffect, useRef } from 'react'
import { apiGetAll, apiPost } from '../../utils/api'
import { localDateString } from '../../utils/date'
import ThemeSelect from '../../components/ThemeSelect'
import ThemeDatePicker from '../../components/ThemeDatePicker'
import { Plus, Search, X, Download, Send, PlusCircle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_COLOR = {
  'Pending Approval': 'badge-warning',
  'Approved': 'badge-success',
  'Converted': 'badge-info',
  'Rejected': 'badge-danger'
}
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const quotationItems = quotation => {
  try {
    const items = JSON.parse(quotation?.items || '[]')
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

export default function QuotationsPage() {
  const quotationPreviewRef = useRef(null)
  const [quotes, setQuotes] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [isTaxable, setIsTaxable] = useState(true)
  const [form, setForm] = useState({
    customerId: '',
    date: localDateString(),
    validUntil: '',
    items: [{ desc: '', qty: 1, rate: 0, gst: 18 }],
    status: 'Approved'
  })

  useEffect(() => {
    Promise.all([apiGetAll('/quotations'), apiGetAll('/customers')])
      .then(([quoteRows, customerRows]) => {
        setQuotes(quoteRows)
        setCustomers(customerRows)
        if (customerRows[0]) setForm(current => ({ ...current, customerId: customerRows[0].id }))
      })
      .catch(err => toast.error('Failed to load quotations: ' + err.message))
      .finally(() => setLoading(false))
  }, [])

  const [previewPdf, setPreviewPdf] = useState(null)

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { desc: '', qty: 1, rate: 0, gst: 18 }]
    }))
  }

  const removeItem = (idx) => {
    if (form.items.length === 1) return
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }))
  }

  const updateItem = (idx, field, value) => {
    setForm(prev => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: value }
      return { ...prev, items }
    })
  }

  const calculateTotals = () => {
    let subtotal = 0
    let gstAmount = 0
    form.items.forEach(it => {
      const lineTotal = (Number(it.qty) || 0) * (Number(it.rate) || 0)
      subtotal += lineTotal
      if (isTaxable) {
        gstAmount += lineTotal * ((Number(it.gst) || 0) / 100)
      }
    })
    const grandTotal = subtotal + gstAmount
    return { subtotal, gstAmount, grandTotal }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const { grandTotal } = calculateTotals()
    const totalAmount = grandTotal
    try {
      const created = await apiPost('/quotations', {
        customerId: Number(form.customerId),
        date: form.date,
        items: JSON.stringify(form.items),
        amount: totalAmount.toString(),
        status: form.status
      })
      setQuotes(prev => [created, ...prev])
      toast.success('Quotation generated successfully!')
      setModalOpen(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const { subtotal, gstAmount, grandTotal } = calculateTotals()

  const filtered = quotes.filter(q => {
    const matchSearch = q.customer.toLowerCase().includes(search.toLowerCase()) || q.id.includes(search)
    const matchStatus = filterStatus === 'All' || q.status === filterStatus
    return matchSearch && matchStatus
  })

  const printQuotation = () => {
    if (!quotationPreviewRef.current || !previewPdf) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return toast.error('Allow pop-ups to print quotations')

    printWindow.document.title = `Quotation ${previewPdf.id}`
    const style = printWindow.document.createElement('style')
    style.textContent = `
      body { font-family: Inter, Arial, sans-serif; padding: 40px; color: #1e293b; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    `
    printWindow.document.head.appendChild(style)
    printWindow.document.body.appendChild(printWindow.document.importNode(quotationPreviewRef.current, true))
    printWindow.requestAnimationFrame(() => printWindow.print())
  }

  const downloadQuotation = async () => {
    if (!quotationPreviewRef.current || !previewPdf) return
    try {
      const module = await import('html2pdf.js')
      const html2pdf = module.default || module
      const safeId = String(previewPdf.id).replace(/[^a-zA-Z0-9_-]/g, '_')
      await html2pdf().set({
        margin: 15,
        filename: `Quotation_${safeId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(quotationPreviewRef.current).save()
    } catch (error) {
      toast.error(`PDF generation failed: ${error.message}`)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading quotations...</div>

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div>
          <h1 className="page-title">Quotation Management</h1>
          <p className="page-subtitle">Generate GST-compliant quotes, send to customers, and track approval status.</p>
        </div>
        <button className="btn-primary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => {
          setForm({
            customerId: '',
            date: localDateString(),
            validUntil: '',
            items: [{ desc: '', qty: 1, rate: 0, gst: 18 }],
            status: 'Approved'
          })
          setIsTaxable(true)
          setModalOpen(true)
        }}>
          <Plus size={16} /> Generate Quotation
        </button>
      </div>

      {/* Filter Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 280, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input
            className="input-field"
            style={{ paddingLeft: 36, height: 38 }}
            placeholder="Search quotations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['All', 'Pending Approval', 'Approved', 'Converted', 'Rejected'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                border: `1px solid ${filterStatus === st ? '#6366f1' : 'var(--border-subtle)'}`,
                background: filterStatus === st ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: filterStatus === st ? '#4f46e5' : 'var(--text-secondary)',
                fontWeight: filterStatus === st ? 700 : 500,
                whiteSpace: 'nowrap'
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="data-table" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th>Quote No</th>
              <th>Customer</th>
              <th>Created Date</th>
              <th>Items Detail</th>
              <th>Grand Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(q => (
              <tr key={q.id}>
                <td style={{ fontWeight: 600 }}>{q.id}</td>
                <td>{q.customer}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{q.date}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{quotationItems(q).map(item => item.desc).join(', ') || 'No items'}</td>
                <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{q.amount}</td>
                <td>
                  <span className={`badge ${STATUS_COLOR[q.status]}`}>{q.status}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      title="Download PDF"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer'
                      }}
                      onClick={() => {
                        setPreviewPdf(q)
                        toast.success('Generated PDF preview!')
                      }}
                    >
                      <Download size={15} style={{ color: '#6366f1' }} />
                    </button>
                    <button
                      title="Share Quotation"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer'
                      }}
                      onClick={async () => {
                        try {
                          const result = await apiPost(`/quotations/${q.id}/send`, {})
                          const delivered = Object.values(result.channels || {}).filter(value => value === 'Delivered').length
                          toast.success(delivered ? 'Quotation sent' : 'Delivery recorded; configure notification providers')
                        } catch (error) {
                          toast.error(error.message)
                        }
                      }}
                    >
                      <Send size={15} style={{ color: '#10b981' }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PDF Preview Drawer/Modal */}
      {previewPdf && (
        <div className="modal-backdrop" onClick={() => setPreviewPdf(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 540, background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>PDF Quotation Preview ({previewPdf.id})</span>
              <button onClick={() => setPreviewPdf(null)} style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div ref={quotationPreviewRef} style={{ padding: 20, border: '1px solid #d1d5db', borderRadius: 8, fontFamily: 'serif', background: '#ffffff', color: '#1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800 }}>CRM-KGSOFTWARE</h3>
                  <p style={{ fontSize: 11, color: '#4b5563' }}>MIDC Sector, Mumbai</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700 }}>QUOTATION</h4>
                  <p style={{ fontSize: 11, color: '#4b5563' }}>No: {previewPdf.id}</p>
                  <p style={{ fontSize: 11, color: '#4b5563' }}>Date: {previewPdf.date}</p>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10, marginBottom: 20 }}>
                <p style={{ fontSize: 11, color: '#4b5563' }}>Prepared For:</p>
                <h5 style={{ fontSize: 13, fontWeight: 700 }}>{previewPdf.customer}</h5>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 20 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ textAlign: 'left', padding: '6px 0' }}>Item Description</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {quotationItems(previewPdf).map((item, index) => (
                    <tr key={`${item.desc}-${index}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '6px 0' }}>{item.desc}</td>
                      <td style={{ textAlign: 'right' }}>{item.qty}</td>
                      <td style={{ textAlign: 'right' }}>{money(Number(item.qty) * Number(item.rate))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                <div style={{ width: 180, fontSize: 11, textAlign: 'right' }}>
                  <p style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>Subtotal:</span>
                    <strong>{money(previewPdf.subtotal)}</strong>
                  </p>
                  <p style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, borderTop: '1px solid #d1d5db', paddingTop: 4 }}>
                    <span>GST:</span>
                    <span>{money(previewPdf.taxAmount)}</span>
                  </p>
                  <p style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, borderTop: '1px solid #d1d5db', paddingTop: 4 }}>
                    <span>Total:</span>
                    <span>{money(previewPdf.amount)}</span>
                  </p>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button 
                className="btn-secondary" 
                style={{ flex: 1, justifyContent: 'center', height: 44, fontSize: 14, fontWeight: 600 }} 
                onClick={printQuotation}
              >
                Print Quotation
              </button>
              
              <button 
                className="btn-primary" 
                style={{ flex: 1, justifyContent: 'center', height: 44, fontSize: 14, fontWeight: 600 }} 
                onClick={downloadQuotation}
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Quote Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Generate Quotation</h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-grid-2" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Client Customer *</label>
                  <ThemeSelect className="input-field" value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: Number(e.target.value) }))}>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </ThemeSelect>
                </div>
                <div className="form-group">
                  <label className="form-label">Quotation Date</label>
                  <ThemeDatePicker value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 20, marginBottom: 16, alignItems: 'center' }}>
                <span className="form-label" style={{ marginBottom: 0 }}>Quotation Type:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                  <input
                    type="radio"
                    name="taxable"
                    checked={isTaxable}
                    onChange={() => setIsTaxable(true)}
                    style={{ cursor: 'pointer', accentColor: '#6366f1' }}
                  />
                  Taxable
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                  <input
                    type="radio"
                    name="taxable"
                    checked={!isTaxable}
                    onChange={() => setIsTaxable(false)}
                    style={{ cursor: 'pointer', accentColor: '#6366f1' }}
                  />
                  Non-Taxable
                </label>
              </div>

              {/* Items Table */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label className="form-label">Quotation Line Items</label>
                  <button type="button" onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer' }}>
                    <PlusCircle size={14} /> Add Row
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 6, paddingLeft: 2 }}>
                  <span style={{ flex: 3, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item Description</span>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qty</span>
                  <span style={{ flex: 1.5, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rate (₹)</span>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tax (GST)</span>
                  <span style={{ width: 16 }}></span>
                </div>
                {form.items.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center' }}>
                    <input
                      className="input-field"
                      style={{ flex: 3 }}
                      placeholder="e.g. GPS tracker allocation"
                      value={it.desc}
                      onChange={e => updateItem(idx, 'desc', e.target.value)}
                      required
                    />
                    <input
                      className="input-field"
                      style={{ flex: 1 }}
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={it.qty}
                      onChange={e => {
                        const val = e.target.value
                        updateItem(idx, 'qty', val === '' ? '' : Math.max(1, Number(val) || 1))
                      }}
                      required
                    />
                    <input
                      className="input-field"
                      style={{ flex: 1.5 }}
                      type="number"
                      placeholder="Rate (₹)"
                      min="0"
                      value={it.rate}
                      onChange={e => {
                        const val = e.target.value
                        updateItem(idx, 'rate', val === '' ? '' : Math.max(0, Number(val) || 0))
                      }}
                      required
                    />
                    {isTaxable ? (
                      <ThemeSelect
                        className="input-field"
                        style={{ flex: 1 }}
                        value={it.gst}
                        onChange={e => updateItem(idx, 'gst', Number(e.target.value))}
                      >
                        <option value={18}>18%</option>
                        <option value={12}>12%</option>
                        <option value={5}>5%</option>
                        <option value={28}>28%</option>
                      </ThemeSelect>
                    ) : (
                      <input
                        className="input-field"
                        style={{ flex: 1, textAlign: 'center', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
                        value="0%"
                        disabled
                      />
                    )}
                    <button type="button" onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Totaling */}
              <div className="glass-card" style={{ padding: 16, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                  <span style={{ fontWeight: 600 }}>₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                {isTaxable && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>GST Amount:</span>
                    <span style={{ fontWeight: 600 }}>₹{gstAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 10, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  <span>Grand Total:</span>
                  <span style={{ color: '#10b981' }}>₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div style={{ padding: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, marginBottom: 16, fontSize: 12, color: '#6366f1' }}>
                ✓ Generated Quotation can be instantly delivered to customer's WhatsApp &amp; Email
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Generate &amp; Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, X, Receipt, Trash2, Printer, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeSelect from '../../components/ThemeSelect'
import ThemeDatePicker from '../../components/ThemeDatePicker'
import { apiGetAll, apiPost, apiDelete } from '../../utils/api'
import { localDateString } from '../../utils/date'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'

const emptyForm = { customerId: '', date: localDateString(), amount: 0, gst: 18 }
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export default function AccountsPage() {
  const [activeTab, setActiveTab] = useState('invoices')
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [previewInvoice, setPreviewInvoice] = useState(null)
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    try {
      const [invoiceRows, paymentRows, customerRows] = await Promise.all([
        apiGetAll('/invoices'),
        apiGetAll('/payments'),
        apiGetAll('/customers')
      ])
      setInvoices(invoiceRows)
      setPayments(paymentRows)
      setCustomers(customerRows)
      if (customerRows[0]) setForm(current => current.customerId ? current : ({ ...current, customerId: customerRows[0].id }))
    } catch (error) {
      toast.error(`Failed to load accounts: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const createInvoice = async event => {
    event.preventDefault()
    if (!form.customerId || !form.date || Number(form.amount) <= 0) return toast.error('Customer, date and amount are required')
    const amount = Number(form.amount)
    const gst = Number(form.gst)
    try {
      const created = await apiPost('/invoices', {
        id: `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`,
        customerId: Number(form.customerId),
        date: form.date,
        amount,
        gst,
        total: amount + amount * gst / 100,
        status: 'Unpaid'
      })
      setInvoices(current => [created, ...current])
      setModalOpen(false)
      setForm(current => ({ ...emptyForm, customerId: current.customerId }))
      toast.success('Invoice created')
    } catch (error) { toast.error(error.message) }
  }

  const [paymentModalInvoice, setPaymentModalInvoice] = useState(null)
  const [paymentAmountInput, setPaymentAmountInput] = useState('')
  const [paymentMethodInput, setPaymentMethodInput] = useState('UPI / GPay')

  const paidByInvoice = useMemo(() => payments.reduce((index, payment) => {
    index.set(payment.invoiceId, (index.get(payment.invoiceId) || 0) + Number(payment.amount || 0))
    return index
  }, new Map()), [payments])

  const recordPayment = invoice => {
    const existing = paidByInvoice.get(invoice.id) || 0
    const outstanding = Math.max(0, Number(invoice.total) - existing)
    setPaymentModalInvoice(invoice)
    setPaymentAmountInput(String(outstanding))
    setPaymentMethodInput('UPI / GPay')
  }

  const handleConfirmRecordPayment = async event => {
    event.preventDefault()
    if (!paymentModalInvoice) return
    const amount = Number(paymentAmountInput)
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Enter a valid payment amount')
    const existing = paidByInvoice.get(paymentModalInvoice.id) || 0
    const outstanding = Number(paymentModalInvoice.total) - existing
    try {
      const payment = await apiPost('/payments', {
        invoiceId: paymentModalInvoice.id,
        amount,
        method: paymentMethodInput,
        date: localDateString()
      })
      setPayments(current => [payment, ...current])
      setInvoices(current => current.map(item => item.id === paymentModalInvoice.id
        ? { ...item, status: amount >= outstanding ? 'Paid' : 'Partially Paid' }
        : item))
      setPaymentModalInvoice(null)
      toast.success('Payment recorded successfully')
    } catch (error) { toast.error(error.message) }
  }

  const outstandingInvoices = invoices.filter(invoice => invoice.status !== 'Paid')
  const receivedTotal = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const outstandingTotal = outstandingInvoices.reduce((sum, invoice) => {
    const paid = paidByInvoice.get(invoice.id) || 0
    return sum + Math.max(0, Number(invoice.total || 0) - paid)
  }, 0)

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div>
          <h1 className="page-title">Accounts & Billing</h1>
          <p className="page-subtitle">Create invoices, record receipts, and monitor outstanding balances.</p>
        </div>
        <button className="btn-primary" onClick={() => setModalOpen(true)} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}><Plus size={16} /> New Invoice</button>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="glass-card" style={{ padding: 18 }}><div className="text-muted">Total Invoiced</div><strong>{money(invoices.reduce((sum, item) => sum + Number(item.total || 0), 0))}</strong></div>
        <div className="glass-card" style={{ padding: 18 }}><div className="text-muted">Payments Received</div><strong style={{ color: '#10b981' }}>{money(receivedTotal)}</strong></div>
        <div className="glass-card" style={{ padding: 18 }}><div className="text-muted">Outstanding Balance</div><strong style={{ color: '#f59e0b' }}>{money(outstandingTotal)}</strong></div>
      </div>

      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-subtle)', marginBottom: 20, overflowX: 'auto' }}>
        {[['invoices', 'Invoices'], ['payments', 'Payment Receipts'], ['outstanding', 'Outstanding']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
            color: activeTab === id ? '#6366f1' : 'var(--text-secondary)',
            borderBottom: activeTab === id ? '2px solid #6366f1' : '2px solid transparent'
          }}>{label}</button>
        ))}
      </div>

      {loading ? <div className="glass-card" style={{ padding: 30 }}>Loading accounts...</div> : (
        <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {activeTab === 'invoices' && (
            <table className="data-table" style={{ minWidth: 800 }}>
              <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Subtotal</th><th>GST</th><th>Total</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {invoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td>{invoice.id}</td><td>{invoice.customer}</td><td>{invoice.date}</td><td>{money(invoice.amount)}</td><td>{invoice.gst}%</td><td>{money(invoice.total)}</td>
                    <td><span className={`badge ${invoice.status === 'Paid' ? 'badge-success' : invoice.status === 'Overdue' ? 'badge-danger' : 'badge-warning'}`}>{invoice.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          title="View / Preview Invoice PDF"
                          style={{
                            width: 32, height: 32, borderRadius: 8,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer'
                          }}
                          onClick={() => setPreviewInvoice(invoice)}
                        >
                          <Eye size={15} style={{ color: '#6366f1' }} />
                        </button>
                        {invoice.status !== 'Paid' && (
                          <button
                            title="Record Payment Receipt"
                            style={{
                              width: 32, height: 32, borderRadius: 8,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer'
                            }}
                            onClick={() => recordPayment(invoice)}
                          >
                            <Receipt size={15} style={{ color: '#10b981' }} />
                          </button>
                        )}
                        <button
                          title="Delete Invoice"
                          style={{
                            width: 32, height: 32, borderRadius: 8,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer'
                          }}
                          onClick={() => setConfirmDeleteInvoice(invoice)}
                        >
                          <Trash2 size={15} style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan="8">No invoices.</td></tr>}
              </tbody>
            </table>
          )}
          {activeTab === 'payments' && (
            <table className="data-table" style={{ minWidth: 800 }}>
              <thead><tr><th>Receipt</th><th>Invoice</th><th>Customer</th><th>Date</th><th>Method</th><th>Amount</th></tr></thead>
              <tbody>
                {payments.map(payment => <tr key={payment.id}><td>{payment.id}</td><td>{payment.invoiceId}</td><td>{payment.customer}</td><td>{payment.date}</td><td>{payment.method}</td><td>{money(payment.amount)}</td></tr>)}
                {payments.length === 0 && <tr><td colSpan="6">No payments recorded.</td></tr>}
              </tbody>
            </table>
          )}
          {activeTab === 'outstanding' && (
            <table className="data-table" style={{ minWidth: 800 }}>
              <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {outstandingInvoices.map(invoice => <tr key={invoice.id}><td>{invoice.id}</td><td>{invoice.customer}</td><td>{invoice.date}</td><td>{money(invoice.total)}</td><td>{invoice.status}</td><td><button className="btn-secondary" onClick={() => recordPayment(invoice)}>Record Receipt</button></td></tr>)}
                {outstandingInvoices.length === 0 && <tr><td colSpan="6">No outstanding invoices.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={event => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><h2>Create Invoice</h2><button onClick={() => setModalOpen(false)} style={{ border: 0, background: 'none', color: 'var(--text-secondary)' }}><X /></button></div>
            <form onSubmit={createInvoice}>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Customer</label><ThemeSelect value={form.customerId} onChange={e => setForm(current => ({ ...current, customerId: Number(e.target.value) }))}>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</ThemeSelect></div>
                <div className="form-group"><label className="form-label">Invoice Date</label><ThemeDatePicker value={form.date} onChange={e => setForm(current => ({ ...current, date: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Subtotal</label><input className="input-field" type="number" min="0" value={form.amount} onChange={e => setForm(current => ({ ...current, amount: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">GST %</label><input className="input-field" type="number" min="0" value={form.gst} onChange={e => setForm(current => ({ ...current, gst: e.target.value }))} /></div>
              </div>
              <div style={{ marginTop: 16, textAlign: 'right', fontWeight: 700 }}>Total: {money(Number(form.amount || 0) * (1 + Number(form.gst || 0) / 100))}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}><button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary">Create Invoice</button></div>
            </form>
          </div>
        </div>
      )}

      {previewInvoice && (
        <div className="modal-backdrop" onClick={() => setPreviewInvoice(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 580, background: '#ffffff', color: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/logo.png" alt="Logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>TAX INVOICE</h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{previewInvoice.id}</p>
                </div>
              </div>
              <button onClick={() => setPreviewInvoice(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Billed To</div>
                  <strong style={{ fontSize: 14, color: '#0f172a' }}>{previewInvoice.customer}</strong>
                  <div style={{ color: '#64748b', fontSize: 12 }}>Invoice Date: {previewInvoice.date}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Status</div>
                  <span className={`badge ${previewInvoice.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>
                    {previewInvoice.status}
                  </span>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px', color: '#475569', fontSize: 12 }}>Description</th>
                    <th style={{ padding: '8px 12px', color: '#475569', fontSize: 12, textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px' }}>Service & Product Subtotal</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{money(previewInvoice.amount)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px' }}>GST ({previewInvoice.gst}%)</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{money(Number(previewInvoice.total) - Number(previewInvoice.amount))}</td>
                  </tr>
                  <tr style={{ fontWeight: 700, fontSize: 14, background: '#f8fafc' }}>
                    <td style={{ padding: '12px 12px', color: '#0f172a' }}>Total Payable</td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', color: '#6366f1' }}>{money(previewInvoice.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
              <button className="btn-secondary" onClick={() => setPreviewInvoice(null)}>Close</button>
              <button className="btn-primary" onClick={() => toast.success(`Initiating print / PDF download for ${previewInvoice.id}`)}>
                <Printer size={15} /> Print / Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentModalInvoice && (() => {
        const existing = paidByInvoice.get(paymentModalInvoice.id) || 0
        const outstanding = Math.max(0, Number(paymentModalInvoice.total) - existing)
        return (
          <div className="modal-backdrop" onClick={() => setPaymentModalInvoice(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Record Payment Receipt</h2>
                <button onClick={() => setPaymentModalInvoice(null)} style={{ border: 0, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <form onSubmit={handleConfirmRecordPayment}>
                <div style={{ background: 'rgba(99,102,241,0.08)', padding: 14, borderRadius: 10, marginBottom: 16, border: '1px solid rgba(99,102,241,0.15)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Invoice: <strong>{paymentModalInvoice.id}</strong></div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Customer: <strong>{paymentModalInvoice.customer}</strong></div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', marginTop: 6 }}>Outstanding Due: {money(outstanding)}</div>
                </div>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Payment Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="1"
                    max={outstanding || 999999}
                    className="input-field"
                    value={paymentAmountInput}
                    onChange={e => setPaymentAmountInput(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label">Payment Method</label>
                  <ThemeSelect value={paymentMethodInput} onChange={e => setPaymentMethodInput(e.target.value)}>
                    <option>UPI / GPay</option>
                    <option>NEFT / Bank Transfer</option>
                    <option>Cash</option>
                    <option>Cheque</option>
                    <option>Credit / Debit Card</option>
                  </ThemeSelect>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="button" className="btn-secondary" onClick={() => setPaymentModalInvoice(null)}>Cancel</button>
                  <button type="submit" className="btn-primary">Confirm & Collect</button>
                </div>
              </form>
            </div>
          </div>
        )
      })()}

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteInvoice)}
        onClose={() => setConfirmDeleteInvoice(null)}
        title="Delete Invoice"
        subtitle={confirmDeleteInvoice?.id}
        message={
          confirmDeleteInvoice ? (
            <>Are you sure you want to delete invoice <strong style={{ color: 'var(--text-primary)' }}>{confirmDeleteInvoice.id}</strong> for {confirmDeleteInvoice.customer}?</>
          ) : null
        }
        confirmText="Delete Invoice"
        onConfirm={async () => {
          try {
            await apiDelete(`/invoices/${confirmDeleteInvoice.id}`)
            setInvoices(current => current.filter(item => item.id !== confirmDeleteInvoice.id))
            toast.success('Invoice deleted')
            setConfirmDeleteInvoice(null)
          } catch (err) { toast.error(err.message) }
        }}
      />
    </div>
  )
}

import { useState, useEffect } from 'react'
import { apiGetAll, apiPost } from '../../utils/api'
import ThemeSelect from '../../components/ThemeSelect'
import { Plus, Search, ArrowRight, ArrowLeft, Barcode } from 'lucide-react'
import toast from 'react-hot-toast'

const money = value => '\u20B9' + Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })


export default function InventoryPage() {
  const [stockList, setStockList] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('stock')
  const [search, setSearch] = useState('')
  const [modalInOpen, setModalInOpen] = useState(false)
  const [modalOutOpen, setModalOutOpen] = useState(false)
  const [modalNewItemOpen, setModalNewItemOpen] = useState(false)

  useEffect(() => {
    Promise.all([apiGetAll('/inventory'), apiGetAll('/customers')])
      .then(([items, customerRows]) => {
        setStockList(items)
        setCustomers(customerRows)
        setTransIn(current => ({ ...current, itemId: current.itemId || items[0]?.id || '' }))
        setTransOut(current => ({ ...current, itemId: current.itemId || items[0]?.id || '', customerId: current.customerId || customerRows[0]?.id || '' }))
      })
      .catch(err => toast.error('Failed to load inventory: ' + err.message))
      .finally(() => setLoading(false))
  }, [])

  // Transaction & Item form states
  const [transIn, setTransIn] = useState({ itemId: '', qty: 0, price: '', vendor: '' })
  const [transOut, setTransOut] = useState({ itemId: '', qty: 0, purpose: 'Installation', customerId: '' })
  const [newItemForm, setNewItemForm] = useState({ name: '', category: 'GPS Device', barcode: '', stock: 0, min: 10, price: 2500 })

  const handleCreateItemSubmit = async (e) => {
    e.preventDefault()
    if (!newItemForm.name || !newItemForm.barcode) return toast.error('Item name and barcode/SKU are required')
    const initialStock = Number(newItemForm.stock) || 0
    const minAlert = Number(newItemForm.min) || 0
    const status = initialStock === 0 ? 'Out of Stock' : initialStock <= minAlert ? 'Low Stock' : 'OK'
    try {
      const created = await apiPost('/inventory', {
        name: newItemForm.name,
        category: newItemForm.category,
        barcode: newItemForm.barcode,
        stock: initialStock,
        min: minAlert,
        price: Number(newItemForm.price) || 0,
        status
      })
      setStockList(current => [created, ...current])
      toast.success('Inventory item created successfully!')
      setModalNewItemOpen(false)
      setNewItemForm({ name: '', category: 'GPS Device', barcode: '', stock: 0, min: 10, price: 2500 })
    } catch (error) {
      toast.error(error.message)
    }
  }

  const printBarcode = item => {
    const popup = window.open('', '_blank', 'width=480,height=320')
    if (!popup) return toast.error('Allow pop-ups to print barcode labels')
    popup.document.title = `Barcode ${item.barcode}`
    popup.document.body.style.cssText = 'font-family:Arial;text-align:center;padding:40px'
    const name = popup.document.createElement('h2')
    name.textContent = item.name
    const barcode = popup.document.createElement('div')
    barcode.style.cssText = 'font-family:monospace;font-size:28px;letter-spacing:4px;border:2px solid #111;padding:20px'
    barcode.textContent = item.barcode
    const category = popup.document.createElement('p')
    category.textContent = item.category
    popup.document.body.append(name, barcode, category)
    popup.requestAnimationFrame(() => popup.print())
  }

  const handleStockIn = async (e) => {
    e.preventDefault()
    if (transIn.qty <= 0) return toast.error('Please enter a valid quantity')
    const item = stockList.find(s => s.id === Number(transIn.itemId))
    if (!item) return toast.error('Item not found')
    try {
      const result = await apiPost(`/inventory/${item.id}/adjust`, { direction: 'IN', quantity: Number(transIn.qty), purpose: 'Purchase', reference: transIn.vendor })
      setStockList(prev => prev.map(s => s.id === item.id ? result.item : s))
      toast.success('Successfully added items to stock!')
      setModalInOpen(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleStockOut = async (e) => {
    e.preventDefault()
    if (transOut.qty <= 0) return toast.error('Please enter a valid quantity')
    const item = stockList.find(s => s.id === Number(transOut.itemId))
    if (!item) return toast.error('Item not found')
    if (item.stock < transOut.qty) return toast.error('Insufficient stock in inventory!')
    try {
      const result = await apiPost(`/inventory/${item.id}/adjust`, { direction: 'OUT', quantity: Number(transOut.qty), purpose: transOut.purpose, customerId: transOut.customerId ? Number(transOut.customerId) : undefined })
      setStockList(prev => prev.map(s => s.id === item.id ? result.item : s))
      toast.success('Stock checked out for job allocation!')
      setModalOutOpen(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const filtered = stockList.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading inventory...</div>

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div>
          <h1 className="page-title">Inventory &amp; Stock</h1>
          <p className="page-subtitle">Track devices, cameras, DVR/NVR components, and SIM allocation logs.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'nowrap', overflowX: 'auto', maxWidth: '100%' }}>
          <button className="btn-secondary" style={{ whiteSpace: 'nowrap' }} onClick={() => setModalNewItemOpen(true)}><Plus size={16} /> New Item</button>
          <button className="btn-secondary" style={{ borderColor: '#ef4444', color: '#ef4444', whiteSpace: 'nowrap' }} onClick={() => setModalOutOpen(true)}>
            <ArrowLeft size={16} /> Stock Out (Issue)
          </button>
          <button className="btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => setModalInOpen(true)}>
            <ArrowRight size={16} /> Stock In (Purchase)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 1, marginBottom: 24, overflowX: 'auto' }}>
        {[
          { id: 'stock', label: '📦 Current Stock' },
          { id: 'low', label: '⚠️ Low / Out of Stock' }
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

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20, width: 300, minWidth: 220 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
        <input
          className="input-field"
          style={{ paddingLeft: 36, height: 38 }}
          placeholder="Search items, category or SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="data-table" style={{ minWidth: 850 }}>
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th>SKU / Barcode</th>
              <th>Current Stock</th>
              <th>Minimum Alert Level</th>
              <th>Unit Cost</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered
              .filter(s => activeTab === 'stock' || s.status !== 'OK')
              .map(s => (
                <tr key={s.id} style={{ background: s.status === 'Out of Stock' ? 'rgba(239, 68, 68, 0.04)' : s.status === 'Low Stock' ? 'rgba(245, 158, 11, 0.03)' : 'transparent' }}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>
                    <span className="badge badge-purple">{s.category}</span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'monospace' }}>
                    <Barcode size={13} style={{ display: 'inline', marginRight: 6 }} /> {s.barcode}
                  </td>
                  <td style={{ fontWeight: 700, fontSize: 15 }}>{s.stock} units</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{s.min} units</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{money(s.price)}</td>
                  <td>
                    <span className={`badge ${s.status === 'OK' ? 'badge-success' : s.status === 'Out of Stock' ? 'badge-danger' : 'badge-warning'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => printBarcode(s)}>
                      Print Barcode
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Stock In Modal */}
      {modalInOpen && (
        <div className="modal-backdrop" onClick={() => setModalInOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Stock In (Purchase)</h2>
              <button onClick={() => setModalInOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>
            <form onSubmit={handleStockIn}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Select Item Catalog *</label>
                  <ThemeSelect className="input-field" value={transIn.itemId} onChange={e => setTransIn(t => ({ ...t, itemId: Number(e.target.value) }))}>
                    {stockList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </ThemeSelect>
                </div>
                <div className="form-group">
                  <label className="form-label">Purchase Quantity *</label>
                  <input className="input-field" type="number" value={transIn.qty} onChange={e => setTransIn(t => ({ ...t, qty: Number(e.target.value) }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor name</label>
                  <input className="input-field" value={transIn.vendor} onChange={e => setTransIn(t => ({ ...t, vendor: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" onClick={() => setModalInOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Record Purchase</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Out Modal */}
      {modalOutOpen && (
        <div className="modal-backdrop" onClick={() => setModalOutOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Stock Out (Job Issue)</h2>
              <button onClick={() => setModalOutOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>
            <form onSubmit={handleStockOut}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Select Item Catalog *</label>
                  <ThemeSelect className="input-field" value={transOut.itemId} onChange={e => setTransOut(t => ({ ...t, itemId: Number(e.target.value) }))}>
                    {stockList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </ThemeSelect>
                </div>
                <div className="form-group">
                  <label className="form-label">Checkout Quantity *</label>
                  <input className="input-field" type="number" value={transOut.qty} onChange={e => setTransOut(t => ({ ...t, qty: Number(e.target.value) }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Issue Purpose</label>
                  <ThemeSelect className="input-field" value={transOut.purpose} onChange={e => setTransOut(t => ({ ...t, purpose: e.target.value }))}>
                    <option value="Installation">Customer Installation</option>
                    <option value="Replacement">Warranty replacement</option>
                    <option value="Testing">Internal testing</option>
                  </ThemeSelect>
                </div>
                <div className="form-group">
                  <label className="form-label">Customer (optional)</label>
                  <ThemeSelect className="input-field" value={transOut.customerId} onChange={e => setTransOut(current => ({ ...current, customerId: Number(e.target.value) }))}>
                    <option value="">Internal / no customer</option>
                    {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </ThemeSelect>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" onClick={() => setModalOutOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Record Checkout</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Inventory Item Modal */}
      {modalNewItemOpen && (
        <div className="modal-backdrop" onClick={() => setModalNewItemOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Add New Inventory Item</h2>
              <button onClick={() => setModalNewItemOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>
            <form onSubmit={handleCreateItemSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Item Name *</label>
                  <input
                    className="input-field"
                    value={newItemForm.name}
                    onChange={e => setNewItemForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. AIS-140 GPS Device (Certified)"
                    required
                  />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <ThemeSelect
                      className="input-field"
                      value={newItemForm.category}
                      onChange={e => setNewItemForm(f => ({ ...f, category: e.target.value }))}
                    >
                      <option value="GPS Device">GPS Device</option>
                      <option value="CCTV Camera">CCTV Camera</option>
                      <option value="Hard Disk">Hard Disk</option>
                      <option value="DVR/NVR">DVR/NVR</option>
                      <option value="SIM Cards">SIM Cards</option>
                      <option value="Accessories">Accessories</option>
                    </ThemeSelect>
                  </div>
                  <div className="form-group">
                    <label className="form-label">SKU / Barcode *</label>
                    <input
                      className="input-field"
                      value={newItemForm.barcode}
                      onChange={e => setNewItemForm(f => ({ ...f, barcode: e.target.value }))}
                      placeholder="e.g. 864235002931"
                      required
                    />
                  </div>
                </div>
                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Initial Stock</label>
                    <input
                      className="input-field"
                      type="number"
                      min="0"
                      value={newItemForm.stock}
                      onChange={e => setNewItemForm(f => ({ ...f, stock: Math.max(0, Number(e.target.value)) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Min Alert Level</label>
                    <input
                      className="input-field"
                      type="number"
                      min="0"
                      value={newItemForm.min}
                      onChange={e => setNewItemForm(f => ({ ...f, min: Math.max(0, Number(e.target.value)) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit Price (₹)</label>
                    <input
                      className="input-field"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newItemForm.price}
                      onChange={e => setNewItemForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="2500.00"
                    />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" onClick={() => setModalNewItemOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Add Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  Users, UserCheck, FileText, CreditCard, RefreshCw,
  HeadphonesIcon, TrendingUp, TrendingDown, AlertCircle,
  ArrowUpRight
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { apiGet } from '../../utils/api'

const SOURCE_COLORS = {
  Website: '#6366f1',
  Facebook: '#3b82f6',
  WhatsApp: '#10b981',
  Reference: '#f59e0b',
  Call: '#8b5cf6',
}

const statusColor = {
  'New': '#60a5fa', 'Contacted': '#c084fc', 'Demo Given': '#f59e0b',
  'Quotation Sent': '#fb923c', 'Won': '#10b981', 'Lost': '#ef4444', 'Negotiation': '#f97316',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: ₹{(p.value / 1000).toFixed(0)}K
        </p>
      ))}
    </div>
  )
}

function StatSkeleton() {
  return (
    <div className="stat-card" style={{ opacity: 0.4 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--border-color)', marginBottom: 16 }} />
      <div style={{ height: 28, width: '60%', background: 'var(--border-color)', borderRadius: 6, marginBottom: 8 }} />
      <div style={{ height: 14, width: '40%', background: 'var(--border-color)', borderRadius: 4 }} />
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/dashboard/stats')
      .then(data => setStats(data))
      .catch(() => {
        // Fallback to zeros on error — don't crash the dashboard
        setStats({ totalLeads: 0, totalCustomers: 0, openTickets: 0, pendingInvoices: 0, renewalsDueSoon: 0, pendingRevenue: 0, recentLeads: [], leadsBySource: [] })
      })
      .finally(() => setLoading(false))
  }, [])

  const statCards = stats ? [
    { label: 'Total Leads',      value: stats.totalLeads.toLocaleString(),   change: 'All time',  up: true,  icon: Users,          color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
    { label: 'Total Customers',  value: stats.totalCustomers.toLocaleString(), change: 'Active',  up: true,  icon: UserCheck,      color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { label: 'Pending Revenue',  value: `₹${(stats.pendingRevenue/1000).toFixed(0)}K`, change: 'Unpaid', up: false, icon: CreditCard, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Open Tickets',     value: stats.openTickets.toLocaleString(),   change: 'Active',   up: false, icon: HeadphonesIcon, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    { label: 'Renewals Due (7d)',  value: stats.renewalsDueSoon.toLocaleString(), change: 'Soon', up: false, icon: RefreshCw,      color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
    { label: 'Pending Invoices', value: stats.pendingInvoices.toLocaleString(), change: 'Unpaid', up: false, icon: FileText,       color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  ] : []

  // Build lead source pie from API data
  const leadSourceData = stats?.leadsBySource?.map(s => ({
    name: s.source,
    value: parseInt(s.count),
    color: SOURCE_COLORS[s.source] || '#6366f1'
  })) || []

  const revenueData = (stats?.revenueHistory || []).map(item => ({
    ...item,
    month: new Date(`${item.month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }))

  const recentLeads = stats?.recentLeads || []

  return (
    <div className="animate-fade-in">
      {/* Stats Grid */}
      <div className="stats-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          statCards.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={s.label} className="stat-card animate-fade-in" style={{ animationDelay: `${i * 0.06}s` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} style={{ color: s.color }} />
                  </div>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600,
                    color: s.up ? '#10b981' : '#ef4444',
                    background: s.up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    padding: '3px 8px', borderRadius: 20,
                  }}>
                    {s.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {s.change}
                  </span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.value}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{s.label}</div>
              </div>
            )
          })
        )}
      </div>

      {/* Charts Row */}
      <div className="dashboard-charts-grid">
        {/* Revenue Chart */}
        <div className="glass-card" style={{ padding: 24, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Revenue Overview</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Monthly recorded payment revenue</p>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 3, borderRadius: 2, background: '#6366f1', display: 'inline-block' }} /> Revenue
              </span>
            </div>
          </div>
          {loading ? (
            <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Loading revenue...</div>
          ) : revenueData.length === 0 ? (
            <div style={{ height: 220, display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              <div>
                <p style={{ marginBottom: 10 }}>No payment revenue has been recorded yet.</p>
                <button className="btn-secondary" onClick={() => navigate('/accounts')}>Create an invoice or record a receipt</button>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v/1000}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revenueGrad)" dot={{ fill: '#6366f1', r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Lead Sources Pie */}
        <div className="glass-card" style={{ padding: 24, border: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Lead Sources</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Distribution breakdown</p>
          {loading ? (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Loading...</div>
          ) : leadSourceData.length === 0 ? (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>No lead data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={leadSourceData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {leadSourceData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, 'Leads']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10 }} itemStyle={{ color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-secondary)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {leadSourceData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="dashboard-bottom-grid">
        {/* Renewal Alerts */}
        <div className="glass-card" style={{ padding: 24, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} style={{ color: '#f59e0b' }} /> Renewal Alerts
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Due within 7 days</p>
            </div>
            <button
              onClick={() => navigate('/renewals')}
              style={{ fontSize: 12, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              View All <ArrowUpRight size={13} />
            </button>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>Loading...</div>
          ) : (stats?.renewalsDueSoon || 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>✅ No renewals due in next 7 days</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ padding: '16px', background: 'rgba(245,158,11,0.1)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{stats?.renewalsDueSoon}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>renewals due within 7 days</div>
                <button
                  onClick={() => navigate('/renewals')}
                  style={{ marginTop: 12, padding: '6px 16px', borderRadius: 8, background: '#f59e0b', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                >
                  Manage Renewals →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recent Leads */}
        <div className="glass-card" style={{ padding: 24, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Recent Leads</h2>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Latest incoming leads</p>
            </div>
            <button
              onClick={() => navigate('/leads')}
              style={{ fontSize: 12, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              View All <ArrowUpRight size={13} />
            </button>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>Loading...</div>
          ) : recentLeads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>No leads yet. Add your first lead!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentLeads.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: '#6366f1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0,
                  }}>{l.name?.charAt(0) || '?'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{l.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.service} · {l.source}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                    background: `${statusColor[l.status] || '#6366f1'}20`, color: statusColor[l.status] || '#6366f1',
                  }}>{l.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

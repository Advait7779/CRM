import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  Users, Wrench, CheckSquare, RefreshCw, Package,
  TrendingUp, TrendingDown, AlertCircle, ArrowUpRight,
  Layers
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { apiGet } from '../../utils/api'

const SERVICE_PALETTE = {
  GPS: '#3b82f6',
  CCTV: '#10b981',
  Website: '#6366f1',
  SMS: '#f59e0b',
  RCS: '#ec4899',
  Voice: '#8b5cf6',
  Waba: '#22c55e'
}

const OperationsTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '12px 16px', fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          {p.name}: {p.value}
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

const getServicesList = (srv) => {
  if (Array.isArray(srv)) return srv
  if (typeof srv === 'string') {
    try {
      const parsed = JSON.parse(srv)
      if (Array.isArray(parsed)) return parsed
    } catch {
      return srv.split(',').map(s => s.trim()).filter(Boolean)
    }
  }
  return []
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/dashboard/stats')
      .then(data => setStats(data))
      .catch(() => {
        // Fallback to zeros on error
        setStats({
          totalCustomers: 0,
          activeInstallations: 0,
          pendingTasks: 0,
          renewalsDueSoon: 0,
          lowStockCount: 0,
          recentCustomers: [],
          servicesDistribution: [],
          operationsHistory: []
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const statCards = stats ? [
    {
      label: 'Total Customers',
      value: (stats.totalCustomers ?? 0).toLocaleString(),
      change: 'Active Clients',
      up: true,
      icon: Users,
      color: '#10b981',
      bg: 'rgba(16,185,129,0.12)',
      link: '/customers'
    },
    {
      label: 'Active Installations',
      value: (stats.activeInstallations ?? 0).toLocaleString(),
      change: (stats.activeInstallations ?? 0) > 0 ? 'In Progress' : 'Idle',
      up: (stats.activeInstallations ?? 0) > 0,
      icon: Wrench,
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.12)',
      link: '/installations'
    },
    {
      label: 'Pending Tasks',
      value: (stats.pendingTasks ?? 0).toLocaleString(),
      change: (stats.pendingTasks ?? 0) > 0 ? 'Action Needed' : 'Completed',
      up: (stats.pendingTasks ?? 0) === 0,
      icon: CheckSquare,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.12)',
      link: '/tasks'
    },
    {
      label: 'Renewals Due (7d)',
      value: (stats.renewalsDueSoon ?? 0).toLocaleString(),
      change: (stats.renewalsDueSoon ?? 0) > 0 ? 'Due Soon' : 'Up to Date',
      up: (stats.renewalsDueSoon ?? 0) === 0,
      icon: RefreshCw,
      color: '#8b5cf6',
      bg: 'rgba(139,92,246,0.12)',
      link: '/renewals'
    },
    {
      label: 'Stock Alerts',
      value: (stats.lowStockCount ?? 0).toLocaleString(),
      change: (stats.lowStockCount ?? 0) > 0 ? 'Low Stock' : 'Optimal',
      up: (stats.lowStockCount ?? 0) === 0,
      icon: Package,
      color: (stats.lowStockCount ?? 0) > 0 ? '#ef4444' : '#10b981',
      bg: (stats.lowStockCount ?? 0) > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
      link: '/inventory'
    }
  ] : []

  // Service distribution for pie/donut
  const serviceDistributionData = (stats?.servicesDistribution || []).map(s => ({
    name: s.service,
    value: s.count,
    color: s.color || SERVICE_PALETTE[s.service] || '#6366f1'
  }))

  const operationsData = stats?.operationsHistory || []
  const recentCustomers = stats?.recentCustomers || []

  return (
    <div className="animate-fade-in">
      {/* Top 5 Stat Cards */}
      <div className="stats-grid">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          statCards.map((s, i) => {
            const Icon = s.icon
            return (
              <div
                key={s.label}
                className="stat-card animate-fade-in"
                style={{
                  animationDelay: `${i * 0.05}s`,
                  cursor: s.link ? 'pointer' : 'default',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease'
                }}
                onClick={() => s.link && navigate(s.link)}
                title={`Open ${s.label}`}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} style={{ color: s.color }} />
                  </div>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600,
                    color: s.up ? '#10b981' : '#f59e0b',
                    background: s.up ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                    padding: '3px 8px', borderRadius: 20,
                  }}>
                    {s.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {s.change}
                  </span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {s.label}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Operations Charts Row */}
      <div className="dashboard-charts-grid">
        {/* Operations Activity Area Chart */}
        <div className="glass-card" style={{ padding: 24, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} style={{ color: '#6366f1' }} /> Operations Activity
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Monthly installations and tasks throughput</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 4, borderRadius: 2, background: '#6366f1', display: 'inline-block' }} /> Installations
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 4, borderRadius: 2, background: '#10b981', display: 'inline-block' }} /> Tasks Handled
              </span>
            </div>
          </div>
          {loading ? (
            <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Loading operations data...</div>
          ) : operationsData.length === 0 ? (
            <div style={{ height: 220, display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              <div>
                <p style={{ marginBottom: 10 }}>No operations activity recorded in this period.</p>
                <button className="btn-secondary" onClick={() => navigate('/installations')}>Schedule an Installation</button>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={operationsData}>
                <defs>
                  <linearGradient id="installGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="taskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<OperationsTooltip />} />
                <Area type="monotone" dataKey="installations" name="Installations" stroke="#6366f1" strokeWidth={2.5} fill="url(#installGrad)" dot={{ fill: '#6366f1', r: 4 }} />
                <Area type="monotone" dataKey="tasks" name="Tasks" stroke="#10b981" strokeWidth={2.5} fill="url(#taskGrad)" dot={{ fill: '#10b981', r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Subscribed Services Donut */}
        <div className="glass-card" style={{ padding: 24, border: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Subscribed Services</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Client service distribution breakdown</p>
          {loading ? (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Loading...</div>
          ) : serviceDistributionData.length === 0 ? (
            <div style={{ height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 13, gap: 10 }}>
              <span>No subscribed services assigned yet.</span>
              <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => navigate('/customers')}>Manage Customers</button>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={serviceDistributionData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {serviceDistributionData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => [v, 'Clients']}
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10 }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    labelStyle={{ color: 'var(--text-secondary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, maxHeight: 120, overflowY: 'auto' }}>
                {serviceDistributionData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{d.value}</span>
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
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>✅ All client subscriptions are up to date (no renewals due in next 7 days)</div>
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

        {/* Recent Customers */}
        <div className="glass-card" style={{ padding: 24, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Recent Customers</h2>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Latest active client accounts</p>
            </div>
            <button
              onClick={() => navigate('/customers')}
              style={{ fontSize: 12, color: '#10b981', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              View All <ArrowUpRight size={13} />
            </button>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>Loading...</div>
          ) : recentCustomers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>No customers yet. Add your first customer!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentCustomers.map(c => {
                const sList = getServicesList(c.services)
                return (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/customers/${c.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px',
                      background: 'var(--bg-secondary)', borderRadius: 10,
                      border: '1px solid var(--border-subtle)', cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: '#10b981',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0,
                    }}>{c.name?.charAt(0) || '?'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.phone || c.contact || 'No phone'}</span>
                        {sList.length > 0 && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {sList.slice(0, 3).map(s => (
                              <span key={s} className="badge badge-purple" style={{ fontSize: 10, padding: '1px 6px' }}>{s}</span>
                            ))}
                            {sList.length > 3 && (
                              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>+{sList.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                      background: 'rgba(16,185,129,0.15)', color: '#10b981', flexShrink: 0
                    }}>{c.status || 'Active'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

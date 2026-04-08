import React from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AdminLayout } from './AdminLayout';
import { apiClient } from '../../hooks/useApi';
import type { FinancialSummary } from '@dagmar/shared';

export default function FinancialsPage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = React.useState<FinancialSummary | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    apiClient.get<FinancialSummary>('/financials/summary')
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AdminLayout><div style={{ textAlign: 'center', padding: '4rem' }}>{t('common.loading')}</div></AdminLayout>;
  if (!data) return <AdminLayout><div>{t('common.error')}</div></AdminLayout>;

  const monthlyData = data.revenueByMonth.map(m => ({
    name: new Date(m.year, m.month - 1, 1).toLocaleDateString(i18n.language, { month: 'short', year: '2-digit' }),
    revenue: Math.round(m.revenue),
    bookings: m.bookings,
  }));

  const kpis = [
    { label: t('admin.revenue'), value: `${data.totalRevenue.toLocaleString('da-DK')} DKK` },
    { label: t('admin.bookings_count'), value: data.totalBookings.toString() },
    { label: t('admin.occupancy'), value: `${data.occupancyRate.toFixed(1)}%` },
    { label: t('admin.avg_stay'), value: `${data.averageStay.toFixed(1)} ${t('admin.nights')}` },
  ];

  return (
    <AdminLayout>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', marginBottom: '2rem' }}>
        {t('admin.financials')}
      </h1>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
        {kpis.map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.8125rem', color: '#888', fontWeight: 500, marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--color-primary)' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', marginBottom: '1.5rem' }}>
          {t('admin.monthly_revenue')}
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`${v.toLocaleString('da-DK')} DKK`, t('admin.revenue')]} />
            <Bar dataKey="revenue" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* By room table */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', marginBottom: '1.5rem' }}>
          {t('admin.by_room')}
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9375rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.08)' }}>
              {[t('admin.col_room'), t('admin.revenue'), t('admin.bookings_count'), t('admin.col_occupancy')].map(h => (
                <th key={h} style={{ padding: '0.625rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#666', fontSize: '0.8125rem', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.revenueByRoom.map(r => (
              <tr key={r.roomId} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <td style={{ padding: '0.75rem' }}>{r.roomName}</td>
                <td style={{ padding: '0.75rem', fontWeight: 500, color: 'var(--color-primary)' }}>{r.revenue.toLocaleString('da-DK')} DKK</td>
                <td style={{ padding: '0.75rem' }}>{r.bookings}</td>
                <td style={{ padding: '0.75rem' }}>{r.occupancyRate.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

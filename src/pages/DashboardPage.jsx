import { useEffect, useState } from 'react';
import { Package, ReceiptText, Users, WalletCards } from 'lucide-react';
import { api } from '../api/client.js';
import { DataTable } from '../components/DataTable.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { fmt } from '../utils/format.js';

export function DashboardPage() {
  const { t } = useI18n();
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.webDashboard
      .getData(period)
      .then((response) => active && setData(response?.kpi ? response : { kpi: {}, chart: [], recent_sales: [], top_goods: [] }))
      .catch((event) => {
        if (!active) return;
        setData({ kpi: {}, chart: [], recent_sales: [], top_goods: [] });
        setError(event.message || t('loadDataError'));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [period, t]);

  const kpi = data?.kpi || {};
  const net = (kpi.revenue || 0) - (kpi.returns || 0);
  const stats = [
    { icon: WalletCards, label: t('revenue'), value: fmt(net), change: kpi.returns ? `${t('returns')} ${fmt(kpi.returns)}` : '', color: 'var(--accent)' },
    { icon: ReceiptText, label: t('salesCount'), value: kpi.sales_count || 0, change: kpi.returns_count ? t('returnsCount', { count: kpi.returns_count }) : '', color: 'var(--accent-green)' },
    { icon: Package, label: t('goodsCount'), value: (kpi.goods_count || 0).toLocaleString('ru-RU'), change: '', color: 'var(--accent-blue)' },
    { icon: Users, label: t('clientsCount'), value: kpi.clients_count || 0, change: kpi.new_clients ? t('newClients', { count: kpi.new_clients }) : '', color: 'var(--accent-orange)' },
  ];
  const maxChart = Math.max(...(data?.chart || []).map((item) => item.total), 1);
  const days = t('weekdaysShort');

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('navDashboard')}</h1>
          <p className="page-subtitle">{t('dashboardSubtitle')}</p>
        </div>
        <div className="flex-row gap-2">
          <select className="filter-input" value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="today">{t('today')}</option>
            <option value="week">{t('week')}</option>
            <option value="month">{t('month')}</option>
            <option value="all">{t('allTime')}</option>
          </select>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div className="stat-card" key={stat.label}>
              <div className="stat-icon" style={{ background: `color-mix(in srgb, ${stat.color} 14%, transparent)`, color: stat.color }}><Icon size={22} /></div>
              <div className="stat-value">{loading ? '—' : stat.value}</div>
              <div className="stat-label">{stat.label}</div>
              {stat.change ? <div className="stat-change">{stat.change}</div> : null}
            </div>
          );
        })}
      </div>

      {error ? <div className="login-error mb-4">{error}</div> : null}

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div><div className="card-title">{t('revenueByDays')}</div><div className="card-subtitle">{t('salesDynamics')}</div></div></div>
          <div className="chart-area">
            {(data?.chart || []).map((row) => {
              const day = new Date(row.day);
              return (
                <div className="chart-bar-wrap" key={row.day}>
                  <div className="chart-bar" style={{ height: `${(row.total / maxChart) * 180}px` }} title={fmt(row.total)} />
                  <span className="chart-label">{days[day.getDay()]}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">{t('recentSales')}</div></div>
          <DataTable
            rows={data?.recent_sales || []}
            columns={[
              { key: 'doc_id', label: '№' },
              { key: 'client_name', label: t('client') },
              { key: 'total', label: t('amount'), render: (row) => <b>{fmt(row.total)}</b> },
              { key: 'pay', label: t('payment'), render: (row) => <span className={`badge ${row.debt > 0 ? 'badge-warning' : row.card > 0 ? 'badge-info' : 'badge-success'}`}>{row.debt > 0 ? t('debt') : row.card > 0 ? t('card') : t('cash')}</span> },
            ]}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><div className="card-title">{t('topGoods')}</div></div>
          <DataTable
            rows={data?.top_goods || []}
            columns={[
              { key: 'name', label: t('product') },
              { key: 'qty', label: t('qty'), render: (row) => Math.round(row.qty) },
              { key: 'total', label: t('revenue'), render: (row) => fmt(row.total) },
            ]}
          />
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">{t('quickActions')}</div></div>
          <div className="flex-col gap-2" style={{ paddingTop: 8 }}>
            {[
              ['newSale', true],
              ['newPurchase'],
              ['findInNkt'],
              ['issueEsf'],
              ['startAudit'],
            ].map(([key, primary]) => (
              <button className={primary ? 'btn btn-primary' : 'btn btn-ghost'} type="button" key={key}>{t(key)}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

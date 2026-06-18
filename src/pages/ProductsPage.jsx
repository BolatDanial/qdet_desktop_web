import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { DataTable } from '../components/DataTable.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

export function ProductsPage() {
  const toast = useToast();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [filters, setFilters] = useState({ search: params.get('q') || '', category: '', emptyField: '', inStock: false });
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    api.admin.getCategories({ is_parents: true }).then((data) => setCategories(data || [])).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      api.admin
        .getProducts({
          search: filters.search,
          category: filters.category,
          empty_field: filters.emptyField,
          in_stock: filters.inStock,
          limit,
          offset: (page - 1) * limit,
        })
        .then((data) => setItems(data || []))
        .catch((event) => toast.error(t('loadProductsError', { message: event.message })));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [filters, page, t, toast]);

  const patch = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><h1 className="page-title">{t('navProducts')}</h1><p className="page-subtitle">{t('productsSubtitle')}</p></div>
        <div className="flex-row gap-2">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigate('/nkt')}>{t('findInNkt')}</button>
          <button className="btn btn-primary" type="button" onClick={() => toast.info(t('createProductWip'))}>{t('addProduct')}</button>
        </div>
      </div>
      <div className="card">
        <div className="filters-bar">
          <input className="filter-input" value={filters.search} onChange={(event) => patch('search', event.target.value)} placeholder={t('searchProductPlaceholder')} style={{ flex: 1, minWidth: 200 }} />
          <select className="filter-input" value={filters.category} onChange={(event) => patch('category', event.target.value)}>
            <option value="">{t('allCategories')}</option>
            {categories.map((category) => <option key={category.cat_id} value={category.cat_id}>{category.cat_name}</option>)}
          </select>
          <select className="filter-input" value={filters.emptyField} onChange={(event) => patch('emptyField', event.target.value)}>
            <option value="">{t('allFields')}</option><option value="Photo">{t('noPhoto')}</option><option value="Article">{t('noArticle')}</option><option value="Category">{t('noCategory')}</option>
          </select>
          <label className="flex-row gap-2 text-sm"><input type="checkbox" checked={filters.inStock} onChange={(event) => patch('inStock', event.target.checked)} /> {t('inStockOnly')}</label>
        </div>
        <DataTable
          rows={items}
          columns={[
            { key: 'photo_path', label: t('photo'), render: (row) => row.photo_path?.includes('http') ? <img src={`${row.photo_path}_small.webp`} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} alt="" /> : <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg-hover)', display: 'grid', placeItems: 'center' }}>□</div> },
            { key: 'good_name', label: t('name'), render: (row) => <div><div className="font-bold">{row.good_name || '—'}</div><div className="text-xs color-muted">{row.good_article || ''}</div></div> },
            { key: 'good_barcode', label: t('barcode') },
            { key: 'cat_name', label: t('category'), render: (row) => row.cat_name ? <span className="badge badge-muted">{row.cat_name}</span> : '—' },
            { key: 'brand_name', label: t('brand'), render: (row) => row.brand_name || '—' },
            { key: 'filled', label: t('filled'), render: (row) => <span className={`badge ${row.filled ? 'badge-success' : 'badge-danger'}`}>{row.filled ? t('yes') : t('no')}</span> },
          ]}
          actions={(row) => <button className="btn btn-ghost btn-sm" type="button" onClick={() => toast.info(t('editProduct', { id: row.good_id }))}>{t('edit')}</button>}
        />
        <div className="flex-row mt-4 gap-2">
          <button className="btn btn-ghost btn-sm" type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>{t('back')}</button>
          <span className="text-sm color-muted">{t('pageNumber', { page })}</span>
          <button className="btn btn-ghost btn-sm" type="button" disabled={items.length < limit} onClick={() => setPage((value) => value + 1)}>{t('next')}</button>
        </div>
      </div>
    </div>
  );
}

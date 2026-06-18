import { useI18n } from '../i18n/I18nContext.jsx';

export function EmptyState({ title, text }) {
  const { t } = useI18n();
  return (
    <div className="empty-state">
      <h3>{title || t('noData')}</h3>
      <p>{text || t('noDataText')}</p>
    </div>
  );
}

export function DataTable({ columns, rows, actions, emptyText }) {
  if (!rows?.length) return <EmptyState text={emptyText} />;

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            {actions ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || row.good_id || row.doc_id || row.num || index}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>
              ))}
              {actions ? <td className="td-actions">{actions(row)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import React from "react";
import EmptyState from "./EmptyState";
import Skeleton from "./Skeleton";

function getCell(row, header, index) {
  if (Array.isArray(row)) return row[index];
  const key = String(header).toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
  return row?.[key] ?? row?.[String(header).toLowerCase()] ?? row?.[header] ?? "-";
}

export default React.memo(function Table({
  headers = [],
  data,
  rows,
  renderRow,
  emptyState,
  loading = false,
  skeletonRows = 5,
  selectable = false,
  selectedRows = [],
  getRowId = (_row, index) => index,
  onSelectRow,
  renderMobileCard,
  className = "",
  style = {}
}) {
  const tableData = data || rows || [];
  const colSpan = headers.length + (selectable ? 1 : 0);

  const skeleton = Array.from({ length: skeletonRows });

  return (
    <div className={`ui-table-wrap ${className}`} style={style}>
      <div className="ui-table-scroll">
        <table className="ui-table">
          <thead>
            <tr>
              {selectable && <th style={{ width: 44 }} />}
              {headers.map((header, index) => (
                <th key={`${header}-${index}`}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              skeleton.map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {selectable && <td><Skeleton height="18px" width="18px" /></td>}
                  {headers.map((header, colIndex) => (
                    <td key={`${header}-${colIndex}`}><Skeleton height="16px" width={colIndex === 0 ? "72%" : "52%"} /></td>
                  ))}
                </tr>
              ))
            ) : tableData.length === 0 ? (
              <tr>
                <td colSpan={colSpan} style={{ padding: "var(--space-7)" }}>
                  {emptyState || <EmptyState title="No records found" description="Records will appear here when available." />}
                </td>
              </tr>
            ) : (
              tableData.map((row, rowIndex) => {
                const rowId = getRowId(row, rowIndex);
                const selected = selectedRows.includes(rowId);
                return (
                  <tr key={rowId} style={{ background: selected ? "var(--color-bg-selected)" : undefined }}>
                    {selectable && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) => onSelectRow?.(rowId, event.target.checked, row)}
                          aria-label={`Select row ${rowIndex + 1}`}
                        />
                      </td>
                    )}
                    {renderRow ? renderRow(row, rowIndex) : headers.map((header, colIndex) => (
                      <td key={`${header}-${colIndex}`}>{getCell(row, header, colIndex)}</td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="ui-table-mobile">
        {loading ? (
          skeleton.map((_, index) => (
            <div className="ui-table-mobile-card" key={index}>
              <Skeleton height="18px" width="64%" style={{ marginBottom: "var(--space-3)" }} />
              <Skeleton height="14px" width="92%" style={{ marginBottom: "var(--space-2)" }} />
              <Skeleton height="14px" width="76%" />
            </div>
          ))
        ) : tableData.length === 0 ? (
          emptyState || <EmptyState title="No records found" description="Records will appear here when available." />
        ) : (
          tableData.map((row, rowIndex) => {
            const rowId = getRowId(row, rowIndex);
            if (renderMobileCard) return <React.Fragment key={rowId}>{renderMobileCard(row, rowIndex)}</React.Fragment>;
            return (
              <div className="ui-table-mobile-card" key={rowId}>
                {selectable && (
                  <label style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)", color: "var(--color-text-secondary)", fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(rowId)}
                      onChange={(event) => onSelectRow?.(rowId, event.target.checked, row)}
                    />
                    Select
                  </label>
                )}
                {headers.map((header, colIndex) => (
                  <div className="ui-table-mobile-row" key={`${header}-${colIndex}`}>
                    <span className="ui-table-mobile-label">{header}</span>
                    <span className="ui-table-mobile-value">{getCell(row, header, colIndex)}</span>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

import { Children, Fragment, cloneElement, isValidElement, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ThemeSelect from './ThemeSelect'

const PAGE_SIZES = [10, 15, 20, 25]

function rowsFrom(children) {
  return Children.toArray(children).flatMap(child =>
    isValidElement(child) && child.type === Fragment ? rowsFrom(child.props.children) : [child]
  ).filter(Boolean)
}

export default function PaginatedTable({ children }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const table = Children.only(children)
  const tableChildren = Children.toArray(table.props.children)
  const body = tableChildren.find(child => isValidElement(child) && child.type === 'tbody')
  const rows = body ? rowsFrom(body.props.children) : []
  const onlyCell = rows.length === 1 ? Children.toArray(rows[0]?.props?.children) : []
  const isEmptyMessage = onlyCell.length === 1 && isValidElement(onlyCell[0]) && onlyCell[0].type === 'td' && Boolean(onlyCell[0].props.colSpan)
  const rowCount = isEmptyMessage ? 0 : rows.length
  const rowIdentity = rows.map((row, index) => row?.key ?? index).join('|')
  const totalPages = Math.max(1, Math.ceil(rowCount / pageSize))
  const currentPage = Math.min(page, totalPages)

  useEffect(() => { setPage(1) }, [rowIdentity])

  const visibleRows = rowCount > pageSize
    ? rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : rows
  const pagedTable = body
    ? cloneElement(table, table.props, tableChildren.map(child =>
      child === body ? cloneElement(body, body.props, visibleRows) : child
    ))
    : table
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter(number => number === 1 || number === totalPages || Math.abs(number - currentPage) <= 1)

  return <>
    <div className="table-pagination-top">
      <span>Show:</span>
      <ThemeSelect value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }} style={{ width: 118 }}>
        {PAGE_SIZES.map(size => <option key={size} value={size}>{size} rows</option>)}
      </ThemeSelect>
    </div>
    {pagedTable}
    <div className="table-pagination-bottom">
      <span>{rowCount ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, rowCount)} of ${rowCount}` : '0 rows'}</span>
      <nav aria-label="Table pages" className="table-pagination-pages">
        <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button>
        {pageNumbers.map((number, index) => <Fragment key={number}>
          {index > 0 && number > pageNumbers[index - 1] + 1 && <span aria-hidden="true">…</span>}
          <button type="button" aria-label={`Page ${number}`} aria-current={number === currentPage ? 'page' : undefined} className={number === currentPage ? 'active' : ''} onClick={() => setPage(number)}>{number}</button>
        </Fragment>)}
        <button type="button" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button>
      </nav>
    </div>
  </>
}

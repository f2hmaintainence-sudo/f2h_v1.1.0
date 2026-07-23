'use client';

import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  const pages: (number | '...')[] = [];

  // First + ellipsis
  if (startPage > 1) {
    pages.push(1);
    if (startPage > 2) pages.push('...');
  }

  // Visible range
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  // Ellipsis + Last
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <nav className="skl-pagination" role="navigation" aria-label="Table pagination">
      {/* Previous */}
      <button
        className={`skl-page-btn${currentPage <= 1 ? ' disabled' : ''}`}
        onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        title="Previous"
      >
        ‹
      </button>

      {/* Page numbers */}
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="skl-page-btn disabled">…</span>
        ) : (
          <button
            key={p}
            className={`skl-page-btn${p === currentPage ? ' active' : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        )
      )}

      {/* Next */}
      <button
        className={`skl-page-btn${currentPage >= totalPages ? ' disabled' : ''}`}
        onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        title="Next"
      >
        ›
      </button>
    </nav>
  );
}

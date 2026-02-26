import React from 'react';
import { TableHead } from './ui/table';

/**
 * Sortable Table Header Component
 * @param {String} label - Column label to display
 * @param {String} sortKey - The key used for sorting
 * @param {Function} onSort - Callback when header is clicked
 * @param {Function} getSortIcon - Function to get current sort icon
 * @param {String} className - Additional CSS classes
 */
const SortableTableHead = ({ label, sortKey, onSort, getSortIcon, className = '' }) => {
  return (
    <TableHead 
      className={`cursor-pointer hover:bg-gray-100 select-none ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-2">
        <span>{label}</span>
        <span className="text-gray-400 text-xs">{getSortIcon(sortKey)}</span>
      </div>
    </TableHead>
  );
};

export default SortableTableHead;

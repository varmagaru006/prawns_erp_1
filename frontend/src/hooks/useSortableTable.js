import { useState, useMemo } from 'react';

/**
 * Custom hook for sortable tables
 * @param {Array} data - The data array to sort
 * @param {Object} config - Initial sort configuration
 * @returns {Object} - Sorted data, sort config, and sort handlers
 */
export const useSortableTable = (data, config = {}) => {
  const [sortConfig, setSortConfig] = useState({
    key: config.key || null,
    direction: config.direction || 'asc'
  });

  const sortedData = useMemo(() => {
    if (!data || !sortConfig.key) return data;

    const sorted = [...data].sort((a, b) => {
      const aValue = getNestedValue(a, sortConfig.key);
      const bValue = getNestedValue(b, sortConfig.key);

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle strings
      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();

      if (aString < bString) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aString > bString) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [data, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return '⇅'; // Both arrows (unsorted)
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  return { sortedData, sortConfig, requestSort, getSortIcon };
};

/**
 * Get nested object value by dot notation key
 * @param {Object} obj - The object
 * @param {String} key - The key (supports dot notation like 'user.name')
 */
const getNestedValue = (obj, key) => {
  return key.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export default useSortableTable;

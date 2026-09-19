'use client';

import React from 'react';
import { Search } from 'lucide-react';

interface ProductSearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  categories: string[];
  placeholder?: string;
}

export default function ProductSearchFilter({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
  placeholder = 'Filter product name, SKU, or category...',
}: ProductSearchFilterProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
      <div className="sm:col-span-7 relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
        <input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:border-indigo-600 dark:border-indigo-500 focus:outline-none transition-colors"
        />
      </div>

      <div className="sm:col-span-5">
        <select
          value={selectedCategory}
          onChange={e => onCategoryChange(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-indigo-600 dark:border-indigo-500 focus:outline-none transition-colors"
        >
          <option value="All">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FolderPlus, CheckCircle2, AlertCircle } from 'lucide-react';
import { Category } from '../../types';
import { api } from '../../lib/api';
import { useDialog } from '../../context/DialogContext';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingCategory?: Category | null;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingCategory,
}) => {
  const { showSuccess, showError } = useDialog();
  const isEdit = !!editingCategory;
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name);
      setDescription(editingCategory.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [editingCategory, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Category name is required.');
      return;
    }

    const catName = name.trim();

    try {
      setIsSubmitting(true);
      if (isEdit && editingCategory) {
        await api.updateCategory(editingCategory.id, {
          name: catName,
          description: description.trim(),
        });
      } else {
        await api.createCategory({
          name: catName,
          description: description.trim(),
        });
      }

      onSuccess();
      onClose();

      showSuccess({
        title: isEdit ? 'Category Updated' : 'Category Created',
        message: isEdit
          ? `Category "${catName}" has been successfully updated.`
          : `New category "${catName}" has been created.`,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save category');
      showError({
        title: isEdit ? 'Category Update Failed' : 'Category Creation Failed',
        message: err.message || 'Failed to save category.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-200">
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer transition-opacity"
        onClick={onClose}
        aria-hidden="true"
        title="Click background to close"
      />
      <div
        id="modal-category-form"
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700 z-10 transition-colors"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-tight">
                {isEdit ? 'Edit Category' : 'Create Category (Tally Stock Group)'}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Organize products into hierarchical inventory groups</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              id="input-category-name"
              type="text"
              placeholder="e.g. Bathroom Fittings"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description & Specifications
            </label>
            <textarea
              id="input-category-desc"
              rows={3}
              placeholder="e.g. Valves, bib cocks, showers, faucets, and mixers"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/80 rounded-lg transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-submit-category"
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white rounded-lg transition-all shadow-md shadow-indigo-500/30 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : isEdit ? 'Update Category' : 'Create Category'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

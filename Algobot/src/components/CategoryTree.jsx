import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Check, Layers, Search, X } from 'lucide-react';

function collectDescendantIds(children = []) {
  const ids = [];
  const visit = (nodes) => {
    nodes.forEach((n) => {
      ids.push(n.id);
      if (n.children && n.children.length > 0) visit(n.children);
    });
  };
  visit(children);
  return ids;
}

function CategoryNode({ category, selectedCategories, onToggle, level = 0, searchTerm = '' }) {
  const [isExpanded, setIsExpanded] = useState(level === 0 || searchTerm.length > 0);
  const hasChildren = category.children && category.children.length > 0;
  const isSelected = selectedCategories.includes(category.id);

  // Check if any/all descendants are selected (not only direct children)
  const descendantIds = hasChildren ? collectDescendantIds(category.children) : [];
  const allChildrenSelected = hasChildren && descendantIds.length > 0 && descendantIds.every(
    (id) => selectedCategories.includes(id)
  );
  const someChildrenSelected = hasChildren && descendantIds.some(
    (id) => selectedCategories.includes(id)
  );

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onToggle(category.id, category.children || []);
  };

  // If we are searching, expand nodes that have children matching the search
  if (searchTerm.length > 0 && hasChildren && !isExpanded) {
    setIsExpanded(true);
  }

  const handleExpandClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="select-none">
      <div
        className={`group flex items-center gap-3 py-2 px-3 my-1 mx-1 rounded-xl cursor-pointer transition-all ${isSelected
          ? 'bg-emerald-50 border border-emerald-100'
          : 'hover:bg-gray-50 border border-transparent'
          }`}
        style={{ marginLeft: `${level * 12}px` }}
        onClick={handleExpandClick}
      >
        {/* Expand/Collapse Control */}
        <div className={`p-1 rounded-lg transition-colors ${hasChildren ? 'hover:bg-black/5 text-gray-400' : 'opacity-0'
          }`}>
          {hasChildren && (
            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          )}
        </div>

        {/* Custom Checkbox */}
        <div
          onClick={handleCheckboxClick}
          className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shadow-sm ${isSelected || allChildrenSelected
            ? 'bg-emerald-500 border-emerald-500 shadow-emerald-200'
            : someChildrenSelected
              ? 'bg-white border-emerald-500'
              : 'bg-white border-gray-300 group-hover:border-emerald-400'
            }`}
        >
          {(isSelected || allChildrenSelected) && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
          {someChildrenSelected && !isSelected && !allChildrenSelected && (
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
          )}
        </div>

        {/* Icon & Name */}
        <div className="flex-1 flex items-center gap-2">
          {hasChildren ? (
            isExpanded ? <FolderOpen className="w-4 h-4 text-amber-500" /> : <Folder className="w-4 h-4 text-amber-500" />
          ) : (
            <Layers className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-gray-400'}`} />
          )}
          <span className={`text-sm font-medium ${isSelected ? 'text-emerald-900' : 'text-gray-700'
            }`}>
            {category.name}
          </span>
        </div>

        {/* Count Badge */}
        {category.product_count > 0 && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}>
            {category.product_count}
          </span>
        )}
      </div>

      {/* Children */}
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden border-l-2 border-gray-100 ml-5"
          >
            {category.children.map((child) => (
              <CategoryNode
                key={child.id}
                category={child}
                selectedCategories={selectedCategories}
                onToggle={onToggle}
                level={level + 1}
                searchTerm={searchTerm}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export default function CategoryTree({
  categories,
  selectedCategories,
  onChange,
  showSelectAll = true,
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filterCategories = (cats, term) => {
    if (!term) return cats;
    return cats.reduce((acc, cat) => {
      const matches = cat.name.toLowerCase().includes(term.toLowerCase());
      const childMatches = cat.children ? filterCategories(cat.children, term) : [];

      if (matches || childMatches.length > 0) {
        acc.push({
          ...cat,
          children: childMatches
        });
      }
      return acc;
    }, []);
  };

  const filteredCategories = useMemo(() =>
    filterCategories(categories, searchTerm),
    [categories, searchTerm]
  );
  const handleToggle = (categoryId, children) => {
    let newSelected = [...selectedCategories];
    const descendantIds = collectDescendantIds(children);

    if (newSelected.includes(categoryId)) {
      // Deselect: remove category and ALL descendants
      newSelected = newSelected.filter((id) => id !== categoryId && !descendantIds.includes(id));
    } else {
      // Select: add category
      newSelected.push(categoryId);
      // IMPORTANT: filtering in `Comparison.jsx` is by `product.category_id`,
      // so selecting a parent must also select all descendants.
      descendantIds.forEach((id) => {
        if (!newSelected.includes(id)) newSelected.push(id);
      });
    }

    onChange(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedCategories.length > 0) {
      onChange([]);
    } else {
      const allIds = [];
      const collectIds = (cats) => {
        cats.forEach(cat => {
          allIds.push(cat.id);
          if (cat.children) collectIds(cat.children);
        });
      };
      collectIds(categories);
      onChange(allIds);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-2xl p-3 min-w-[320px] max-w-[400px] max-h-[600px] flex flex-col overflow-hidden">
      {/* Search Header */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск категорий..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all dark:text-white"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full text-gray-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {showSelectAll && (
          <div
            className="flex items-center gap-3 py-2 px-3 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors border border-dashed border-gray-200 dark:border-slate-700"
            onClick={handleSelectAll}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectedCategories.length > 0
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-gray-300 dark:border-slate-600'
              }`}>
              {selectedCategories.length > 0 && <Check className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {selectedCategories.length === 0 ? 'Выбрать все' : 'Снять выделение'}
            </span>
          </div>
        )}
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-0.5 custom-scrollbar">
        {filteredCategories.map((category) => (
          <CategoryNode
            key={category.id}
            category={category}
            selectedCategories={selectedCategories}
            onToggle={handleToggle}
            searchTerm={searchTerm}
          />
        ))}

        {filteredCategories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-full mb-3">
              <Search className="w-8 h-8 opacity-20" />
            </div>
            <span className="text-sm font-medium">Ничего не найдено</span>
          </div>
        )}
      </div>
    </div>
  );
}

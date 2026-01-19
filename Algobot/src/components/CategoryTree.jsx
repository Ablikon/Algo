import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Check, Layers } from 'lucide-react';

function CategoryNode({ category, selectedCategories, onToggle, level = 0 }) {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  const hasChildren = category.children && category.children.length > 0;
  const isSelected = selectedCategories.includes(category.id);

  // Check if all children are selected
  const allChildrenSelected = hasChildren && category.children.every(
    child => selectedCategories.includes(child.id)
  );
  const someChildrenSelected = hasChildren && category.children.some(
    child => selectedCategories.includes(child.id)
  );

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onToggle(category.id, category.children || []);
  };

  const handleExpandClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="select-none">
      <div
        className={`group flex items-center gap-3 py-2 px-3 my-1 mx-1 rounded-xl cursor-pointer transition-all ${
          isSelected 
            ? 'bg-emerald-50 border border-emerald-100' 
            : 'hover:bg-gray-50 border border-transparent'
        }`}
        style={{ marginLeft: `${level * 12}px` }}
        onClick={handleExpandClick}
      >
        {/* Expand/Collapse Control */}
        <div className={`p-1 rounded-lg transition-colors ${
          hasChildren ? 'hover:bg-black/5 text-gray-400' : 'opacity-0'
        }`}>
          {hasChildren && (
            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          )}
        </div>

        {/* Custom Checkbox */}
        <div
          onClick={handleCheckboxClick}
          className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shadow-sm ${
            isSelected || allChildrenSelected
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
           <span className={`text-sm font-medium ${
             isSelected ? 'text-emerald-900' : 'text-gray-700'
           }`}>
            {category.name}
           </span>
        </div>

        {/* Count Badge */}
        {category.product_count > 0 && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
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
  const handleToggle = (categoryId, children) => {
    let newSelected = [...selectedCategories];

    if (newSelected.includes(categoryId)) {
      // Deselect: remove category and its children
      newSelected = newSelected.filter(id => id !== categoryId);
      if (children.length > 0) {
        const childIds = children.map(c => c.id);
        newSelected = newSelected.filter(id => !childIds.includes(id));
      }
    } else {
      // Select: add category
      newSelected.push(categoryId);
      // Optional: Auto-select children? The user said "Worker needs only Dairy".
      // If parent is selected, usually we show everything inside parent.
      // But filtering logic calculates "OR" or "AND"?
      // Comparison.jsx: `selectedCategories.includes(product.category_id)`
      // So if I select Parent but NOT Child, products in Child won't show unless Child logic is handled.
      // So YES, I must select all children too.
      if (children.length > 0) {
        children.forEach(child => {
          if (!newSelected.includes(child.id)) {
            newSelected.push(child.id);
          }
        });
      }
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-2 max-h-[500px] overflow-y-auto">
      {showSelectAll && (
        <div className="sticky top-0 bg-white z-10 pb-2 mb-2 border-b border-gray-100">
             <div
            className="flex items-center gap-3 py-2 px-3 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={handleSelectAll}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
               selectedCategories.length > 0
                ? 'bg-emerald-500 border-emerald-500'
                : 'border-gray-300'
            }`}>
              {selectedCategories.length > 0 && <Check className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="text-sm font-semibold text-gray-700">
              {selectedCategories.length === 0 ? 'Выбрать все' : 'Снять выделение'}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-0.5">
        {categories.map((category) => (
          <CategoryNode
            key={category.id}
            category={category}
            selectedCategories={selectedCategories}
            onToggle={handleToggle}
          />
        ))}

        {categories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Folder className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-sm">Категории не найдены</span>
          </div>
        )}
      </div>
    </div>
  );
}

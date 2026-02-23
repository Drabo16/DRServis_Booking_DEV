'use client';

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import { offerKeys, useOfferPreset } from '@/hooks/useOffers';
import {
  formatCurrency,
  OFFER_CATEGORY_ORDER,
  getCategoryGroup,
} from '@/types/offers';

interface PresetEditorProps {
  presetId: string;
  onBack: () => void;
}

interface TemplateItem {
  id: string;
  name: string;
  subcategory: string | null;
  default_price: number;
  unit: string;
  sort_order: number;
  category: { name: string } | null;
}

interface LocalItem {
  templateId: string;
  name: string;
  subcategory: string | null;
  category: string;
  unitPrice: number;
  unit: string;
  sortOrder: number;
  days: number;
  qty: number;
}

export default function PresetEditor({ presetId, onBack }: PresetEditorProps) {
  const queryClient = useQueryClient();
  const { data: preset, isLoading: loadingPreset } = useOfferPreset(presetId);

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [localDiscount, setLocalDiscount] = useState(0);
  const [localIsVatPayer, setLocalIsVatPayer] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Load templates on mount
  useEffect(() => {
    fetch('/api/offers/templates/items')
      .then(res => res.json())
      .then(data => {
        setTemplates(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Build local items when both templates and preset are loaded
  useEffect(() => {
    if (loading || loadingPreset || !templates.length) return;

    const items: LocalItem[] = [];
    const presetItems = preset?.items || [];

    for (const t of templates) {
      const catName = t.category?.name || 'Ostatní';
      const presetItem = presetItems.find(pi => pi.template_item_id === t.id);

      items.push({
        templateId: t.id,
        name: t.name,
        subcategory: t.subcategory,
        category: catName,
        unitPrice: presetItem?.unit_price ?? t.default_price,
        unit: t.unit,
        sortOrder: t.sort_order,
        days: presetItem?.days_hours ?? 1,
        qty: presetItem?.quantity ?? 0,
      });
    }

    items.sort((a, b) => {
      const catA = OFFER_CATEGORY_ORDER.indexOf(a.category as any);
      const catB = OFFER_CATEGORY_ORDER.indexOf(b.category as any);
      if (catA !== catB) return catA - catB;
      return a.sortOrder - b.sortOrder;
    });

    setLocalItems(items);
    setLocalDiscount(preset?.discount_percent ?? 0);
    setLocalIsVatPayer(preset?.is_vat_payer ?? true);
  }, [loading, loadingPreset, templates, preset]);

  // Handle item change
  const handleItemChange = useCallback((index: number, field: 'days' | 'qty' | 'unitPrice', value: number) => {
    setLocalItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
    setIsDirty(true);
  }, []);

  // Handle category-wide days change
  const handleCategoryDaysChange = useCallback((category: string, days: number) => {
    setLocalItems(prev => prev.map(item =>
      item.category === category ? { ...item, days } : item
    ));
    setIsDirty(true);
  }, []);

  // Handle discount change
  const handleDiscountChange = useCallback((value: number) => {
    setLocalDiscount(Math.max(0, Math.min(100, value)));
    setIsDirty(true);
  }, []);

  // Save preset
  const savePreset = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // Only save items with qty > 0
      const itemsToSave = localItems
        .filter(item => item.qty > 0)
        .map((item, index) => ({
          template_item_id: item.templateId,
          name: item.name,
          category: item.category,
          subcategory: item.subcategory,
          unit: item.unit,
          unit_price: item.unitPrice,
          days_hours: item.days,
          quantity: item.qty,
          sort_order: index,
        }));

      await fetch(`/api/offers/presets/${presetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discount_percent: localDiscount,
          is_vat_payer: localIsVatPayer,
          items: itemsToSave,
        }),
      });

      queryClient.invalidateQueries({ queryKey: offerKeys.presets.all });
      queryClient.invalidateQueries({ queryKey: offerKeys.presets.detail(presetId) });
      setIsDirty(false);
    } catch (e) {
      console.error('Save preset failed:', e);
    } finally {
      setIsSaving(false);
    }
  }, [presetId, localItems, localDiscount, localIsVatPayer, isSaving, queryClient]);

  // CTRL+S handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        savePreset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [savePreset]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number, field: 'days' | 'qty' | 'price') => {
    const totalItems = localItems.length;
    const fieldOrder = ['days', 'qty', 'price'];
    const currentFieldIdx = fieldOrder.indexOf(field);

    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      const nextIndex = index + 1;
      if (nextIndex < totalItems) {
        const key = `${nextIndex}-${field}`;
        inputRefs.current.get(key)?.focus();
        inputRefs.current.get(key)?.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = index - 1;
      if (prevIndex >= 0) {
        const key = `${prevIndex}-${field}`;
        inputRefs.current.get(key)?.focus();
        inputRefs.current.get(key)?.select();
      }
    } else if (e.key === 'ArrowRight' && currentFieldIdx < fieldOrder.length - 1) {
      e.preventDefault();
      const nextField = fieldOrder[currentFieldIdx + 1];
      const key = `${index}-${nextField}`;
      inputRefs.current.get(key)?.focus();
      inputRefs.current.get(key)?.select();
    } else if (e.key === 'ArrowLeft' && currentFieldIdx > 0) {
      e.preventDefault();
      const prevField = fieldOrder[currentFieldIdx - 1];
      const key = `${index}-${prevField}`;
      inputRefs.current.get(key)?.focus();
      inputRefs.current.get(key)?.select();
    }
  }, [localItems.length]);

  // Register input ref
  const registerRef = useCallback((index: number, field: 'days' | 'qty' | 'price', el: HTMLInputElement | null) => {
    const key = `${index}-${field}`;
    if (el) inputRefs.current.set(key, el);
    else inputRefs.current.delete(key);
  }, []);

  // Calculate totals
  const totals = useMemo(() => {
    return localItems.reduce(
      (acc, item) => {
        if (item.qty === 0) return acc;
        const total = item.days * item.qty * item.unitPrice;
        const group = getCategoryGroup(item.category);
        if (group === 'equipment') acc.equipment += total;
        else if (group === 'personnel') acc.personnel += total;
        else acc.transport += total;
        return acc;
      },
      { equipment: 0, personnel: 0, transport: 0 }
    );
  }, [localItems]);

  const discountAmount = useMemo(() => Math.round(totals.equipment * (localDiscount / 100)), [totals.equipment, localDiscount]);
  const totalAmount = useMemo(() => totals.equipment + totals.personnel + totals.transport - discountAmount, [totals, discountAmount]);

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, { item: LocalItem; index: number }[]> = {};
    localItems.forEach((item, index) => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push({ item, index });
    });
    return grouped;
  }, [localItems]);

  if (loading || loadingPreset) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="font-bold text-sm">{preset?.name}</div>
            {preset?.description && (
              <div className="text-xs text-slate-500">{preset.description}</div>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              {isDirty && (
                <span className="text-[10px] text-amber-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  Neuloženo
                </span>
              )}
              {isSaving && (
                <span className="text-[10px] text-blue-600 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Ukládám...
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={savePreset}
          disabled={!isDirty || isSaving}
          className="h-7 px-3 border rounded hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 text-xs"
          title="Uložit (Ctrl+S)"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>Uložit</span>
        </button>
      </div>

      {/* VAT payer checkbox */}
      <div className="flex items-center">
        <label className="flex items-center gap-2 cursor-pointer bg-slate-100 px-3 py-1.5 rounded border">
          <input
            type="checkbox"
            checked={localIsVatPayer}
            onChange={(e) => { setLocalIsVatPayer(e.target.checked); setIsDirty(true); }}
            className="w-4 h-4"
          />
          <span className="text-xs font-medium text-slate-700">Plátce DPH</span>
        </label>
      </div>

      {/* Table */}
      <div className="border rounded overflow-hidden text-xs">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="text-left py-1.5 px-2 font-medium">Položka</th>
              <th className="text-center py-1.5 px-1 font-medium w-14">Dny</th>
              <th className="text-center py-1.5 px-1 font-medium w-14">Ks/km</th>
              <th className="text-right py-1.5 px-2 font-medium w-20">Kč/j.</th>
              <th className="text-right py-1.5 px-2 font-medium w-24">Celkem</th>
            </tr>
          </thead>
          <tbody>
            {OFFER_CATEGORY_ORDER.map((category) => {
              const categoryItems = itemsByCategory[category];
              if (!categoryItems || categoryItems.length === 0) return null;

              const catTotal = categoryItems.reduce(
                (sum, { item }) => sum + item.days * item.qty * item.unitPrice,
                0
              );

              const isTransport = category === 'Doprava';

              return (
                <PresetCategoryBlock
                  key={category}
                  category={category}
                  items={categoryItems}
                  total={catTotal}
                  isTransport={isTransport}
                  onItemChange={handleItemChange}
                  onCategoryDaysChange={handleCategoryDaysChange}
                  onKeyDown={handleKeyDown}
                  registerRef={registerRef}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="bg-slate-50 border rounded p-3 text-xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <div className="text-slate-500 mb-0.5">Technika</div>
            <div className="font-semibold">{formatCurrency(totals.equipment)}</div>
          </div>
          <div>
            <div className="text-slate-500 mb-0.5">Personál</div>
            <div className="font-semibold">{formatCurrency(totals.personnel)}</div>
          </div>
          <div>
            <div className="text-slate-500 mb-0.5">Doprava</div>
            <div className="font-semibold">{formatCurrency(totals.transport)}</div>
          </div>
          <div>
            <div className="text-slate-500 mb-0.5 flex items-center gap-1">
              Sleva
              <input
                type="number"
                min={0}
                max={100}
                value={localDiscount}
                onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)}
                className="w-10 h-5 text-center text-xs border rounded px-1"
              />
              %
            </div>
            <div className="font-semibold text-green-600">
              {discountAmount > 0 ? `-${formatCurrency(discountAmount)}` : '-'}
            </div>
          </div>
        </div>
        <div className="border-t mt-3 pt-3 flex justify-between items-center">
          <span className="font-bold">CELKEM BEZ DPH</span>
          <span className="font-bold text-lg">{formatCurrency(totalAmount)}</span>
        </div>
        {localIsVatPayer && (
          <div className="border-t mt-2 pt-2 flex justify-between items-center">
            <span className="text-slate-600">CELKEM S DPH (21%)</span>
            <div className="text-right">
              <span className="text-slate-500 text-xs mr-2">DPH: {formatCurrency(Math.round(totalAmount * 0.21))}</span>
              <span className="font-bold text-lg">{formatCurrency(Math.round(totalAmount * 1.21))}</span>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-[10px] text-slate-400 text-center">
        Nastavte položky a množství pro šablonu. Položky s množstvím 0 nebudou uloženy.
        ↑↓←→ navigace | Ctrl+S uložit
      </div>
    </div>
  );
}

// Category block component
const PresetCategoryBlock = memo(function PresetCategoryBlock({
  category,
  items,
  total,
  isTransport,
  onItemChange,
  onCategoryDaysChange,
  onKeyDown,
  registerRef,
}: {
  category: string;
  items: { item: LocalItem; index: number }[];
  total: number;
  isTransport: boolean;
  onItemChange: (index: number, field: 'days' | 'qty' | 'unitPrice', value: number) => void;
  onCategoryDaysChange: (category: string, days: number) => void;
  onKeyDown: (e: React.KeyboardEvent, index: number, field: 'days' | 'qty' | 'price') => void;
  registerRef: (index: number, field: 'days' | 'qty' | 'price', el: HTMLInputElement | null) => void;
}) {
  const itemsWithQty = items.filter(({ item }) => item.qty > 0);
  const commonDays = itemsWithQty.length > 0
    ? itemsWithQty[0].item.days
    : items[0]?.item.days || 1;

  return (
    <>
      <tr className="bg-slate-700 text-white text-xs">
        <td className="py-1 px-2 font-medium">{category}</td>
        <td className="py-1 px-1 text-center">
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={commonDays}
            onChange={(e) => onCategoryDaysChange(category, parseFloat(e.target.value) || 1)}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.target.select()}
            className="w-10 h-5 text-center text-xs bg-slate-600 border border-slate-500 rounded text-white focus:bg-slate-500 focus:outline-none"
            title="Změnit dny pro celou sekci"
          />
        </td>
        <td colSpan={2} className="py-1 px-2"></td>
        <td className="py-1 px-2 text-right font-medium">{formatCurrency(total)}</td>
      </tr>
      {items.map(({ item, index }, idx) => (
        <PresetItemRow
          key={`${item.templateId}-${index}`}
          item={item}
          index={index}
          odd={idx % 2 === 1}
          isTransport={isTransport}
          onItemChange={onItemChange}
          onKeyDown={onKeyDown}
          registerRef={registerRef}
        />
      ))}
    </>
  );
});

// Item row component
const PresetItemRow = memo(function PresetItemRow({
  item,
  index,
  odd,
  isTransport,
  onItemChange,
  onKeyDown,
  registerRef,
}: {
  item: LocalItem;
  index: number;
  odd: boolean;
  isTransport: boolean;
  onItemChange: (index: number, field: 'days' | 'qty' | 'unitPrice', value: number) => void;
  onKeyDown: (e: React.KeyboardEvent, index: number, field: 'days' | 'qty' | 'price') => void;
  registerRef: (index: number, field: 'days' | 'qty' | 'price', el: HTMLInputElement | null) => void;
}) {
  const total = item.days * item.qty * item.unitPrice;
  const hasValue = item.qty > 0;

  return (
    <tr className={`${odd ? 'bg-slate-50' : 'bg-white'} ${!hasValue ? 'text-slate-400' : ''}`}>
      <td className="py-0.5 px-2">
        <div className="truncate max-w-[280px]" title={item.name}>
          <span className={hasValue ? 'font-medium' : ''}>{item.name}</span>
          {item.subcategory && (
            <span className="text-slate-400 ml-1">({item.subcategory})</span>
          )}
        </div>
      </td>
      <td className="py-0.5 px-0.5 text-center">
        <input
          ref={(el) => registerRef(index, 'days', el)}
          type="number"
          min={0.5}
          step={0.5}
          value={item.days}
          onChange={(e) => onItemChange(index, 'days', parseFloat(e.target.value) || 1)}
          onKeyDown={(e) => onKeyDown(e, index, 'days')}
          onFocus={(e) => e.target.select()}
          className="w-12 h-6 text-center text-xs border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </td>
      <td className="py-0.5 px-0.5 text-center">
        <input
          ref={(el) => registerRef(index, 'qty', el)}
          type="number"
          min={0}
          value={item.qty}
          onChange={(e) => onItemChange(index, 'qty', parseInt(e.target.value) || 0)}
          onKeyDown={(e) => onKeyDown(e, index, 'qty')}
          onFocus={(e) => e.target.select()}
          placeholder={isTransport ? 'km' : 'ks'}
          className={`w-12 h-6 text-center text-xs border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
            hasValue ? 'bg-blue-50 border-blue-300 font-medium' : ''
          }`}
        />
      </td>
      <td className="py-0.5 px-0.5 text-right">
        <input
          ref={(el) => registerRef(index, 'price', el)}
          type="number"
          min={0}
          step={100}
          value={item.unitPrice}
          onChange={(e) => onItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
          onKeyDown={(e) => onKeyDown(e, index, 'price')}
          onFocus={(e) => e.target.select()}
          className="w-16 h-6 text-right text-xs border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 pr-1"
        />
      </td>
      <td className="py-0.5 px-2 text-right font-medium">
        {hasValue ? formatCurrency(total) : '-'}
      </td>
    </tr>
  );
});

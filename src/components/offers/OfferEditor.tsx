'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, FileDown, Save, FolderKanban } from 'lucide-react';
import { offerKeys } from '@/hooks/useOffers';
import {
  formatOfferNumber,
  formatCurrency,
  OFFER_STATUS_LABELS,
  OFFER_STATUS_COLORS,
  OFFER_CATEGORY_ORDER,
  getCategoryGroup,
  type OfferStatus,
} from '@/types/offers';

interface OfferEditorProps {
  offerId: string;
  isAdmin: boolean;
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
  dbItemId: string | null;
}

interface OfferData {
  id: string;
  offer_number: number;
  year: number;
  title: string;
  status: OfferStatus;
  discount_percent: number;
  offer_set_id: string | null;
  set_label: string | null;
  items: Array<{
    id: string;
    template_item_id: string | null;
    days_hours: number;
    quantity: number;
    unit_price: number;
  }>;
}

interface OfferSet {
  id: string;
  name: string;
}

export default function OfferEditor({ offerId, isAdmin, onBack }: OfferEditorProps) {
  const queryClient = useQueryClient();

  // Data states
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [offerSets, setOfferSets] = useState<OfferSet[]>([]);
  const [loading, setLoading] = useState(true);

  // Local editable state - NEVER synced back from server during editing
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [localDiscount, setLocalDiscount] = useState(0);
  const [localStatus, setLocalStatus] = useState<OfferStatus>('draft');
  const [localSetId, setLocalSetId] = useState<string | null>(null);
  const [localSetLabel, setLocalSetLabel] = useState('');

  // Dirty tracking
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Refs for auto-save (to avoid stale closures)
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const localItemsRef = useRef<LocalItem[]>([]);
  const localDiscountRef = useRef(0);
  const localStatusRef = useRef<OfferStatus>('draft');
  const localSetIdRef = useRef<string | null>(null);
  const localSetLabelRef = useRef('');
  const isDirtyRef = useRef(false);
  const isSavingRef = useRef(false);

  // Input refs for navigation
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const AUTOSAVE_DELAY = 2000; // 2 seconds

  // Keep refs in sync
  useEffect(() => { localItemsRef.current = localItems; }, [localItems]);
  useEffect(() => { localDiscountRef.current = localDiscount; }, [localDiscount]);
  useEffect(() => { localStatusRef.current = localStatus; }, [localStatus]);
  useEffect(() => { localSetIdRef.current = localSetId; }, [localSetId]);
  useEffect(() => { localSetLabelRef.current = localSetLabel; }, [localSetLabel]);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { isSavingRef.current = isSaving; }, [isSaving]);

  // Load data once on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [offerRes, templatesRes, setsRes] = await Promise.all([
          fetch(`/api/offers/${offerId}`),
          fetch('/api/offers/templates/items'),
          fetch('/api/offers/sets'),
        ]);

        const offerData = await offerRes.json();
        const templatesData = await templatesRes.json();
        const setsData = await setsRes.json();

        setOffer(offerData);
        setTemplates(templatesData);
        setOfferSets(setsData || []);
        setLocalStatus(offerData.status);
        setLocalDiscount(offerData.discount_percent);
        setLocalSetId(offerData.offer_set_id || null);
        setLocalSetLabel(offerData.set_label || '');

        // Build local items from templates + offer
        buildLocalItems(templatesData, offerData);
        setLoading(false);
      } catch (e) {
        console.error('Load failed:', e);
        setLoading(false);
      }
    }
    loadData();
  }, [offerId]);

  // Build local items array
  const buildLocalItems = (templates: TemplateItem[], offer: OfferData) => {
    const items: LocalItem[] = [];

    for (const t of templates) {
      const catName = t.category?.name || 'Ostatní';
      const offerItem = offer.items?.find(i => i.template_item_id === t.id);

      items.push({
        templateId: t.id,
        name: t.name,
        subcategory: t.subcategory,
        category: catName,
        unitPrice: offerItem?.unit_price ?? t.default_price,
        unit: t.unit,
        sortOrder: t.sort_order,
        days: offerItem?.days_hours ?? 1,
        qty: offerItem?.quantity ?? 0,
        dbItemId: offerItem?.id ?? null,
      });
    }

    // Sort by category order then sort_order
    items.sort((a, b) => {
      const catA = OFFER_CATEGORY_ORDER.indexOf(a.category as any);
      const catB = OFFER_CATEGORY_ORDER.indexOf(b.category as any);
      if (catA !== catB) return catA - catB;
      return a.sortOrder - b.sortOrder;
    });

    setLocalItems(items);
  };

  // Save all changes to server - BATCH mode for speed
  const saveChanges = useCallback(async () => {
    if (!isDirtyRef.current || isSavingRef.current) return;

    setIsSaving(true);
    isSavingRef.current = true;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    const items = localItemsRef.current;
    const discount = localDiscountRef.current;
    const status = localStatusRef.current;
    const setId = localSetIdRef.current;
    const setLabel = localSetLabelRef.current;

    try {
      // Prepare batch operations
      const toDelete: string[] = [];
      const toUpdate: Array<{ id: string; days: number; qty: number; unitPrice: number }> = [];
      const toCreate: Array<{ templateId: string; days: number; qty: number; unitPrice: number }> = [];

      for (const item of items) {
        if (item.qty === 0 && item.dbItemId) {
          toDelete.push(item.dbItemId);
        } else if (item.qty > 0) {
          if (item.dbItemId) {
            toUpdate.push({ id: item.dbItemId, days: item.days, qty: item.qty, unitPrice: item.unitPrice });
          } else {
            toCreate.push({ templateId: item.templateId, days: item.days, qty: item.qty, unitPrice: item.unitPrice });
          }
        }
      }

      // Execute all operations in parallel
      const promises: Promise<any>[] = [];

      // 1. Update offer (status, discount, set)
      promises.push(
        fetch(`/api/offers/${offerId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status,
            discount_percent: discount,
            offer_set_id: setId,
            set_label: setLabel || null,
            recalculate: true,
          }),
        })
      );

      // 2. Delete items
      for (const id of toDelete) {
        promises.push(
          fetch(`/api/offers/${offerId}/items?item_id=${id}`, { method: 'DELETE' })
        );
      }

      // 3. Update items (batch - all at once)
      if (toUpdate.length > 0) {
        for (const u of toUpdate) {
          promises.push(
            fetch(`/api/offers/${offerId}/items`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                item_id: u.id,
                days_hours: u.days,
                quantity: u.qty,
                unit_price: u.unitPrice,
              }),
            })
          );
        }
      }

      // 4. Create items (batch)
      if (toCreate.length > 0) {
        promises.push(
          fetch(`/api/offers/${offerId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: toCreate.map(c => ({
                template_item_id: c.templateId,
                quantity: c.qty,
                days_hours: c.days,
                unit_price: c.unitPrice,
              })),
            }),
          }).then(async (res) => {
            const data = await res.json();
            // Update dbItemIds for created items
            if (data.items) {
              setLocalItems(prev => {
                const newItems = [...prev];
                for (const created of data.items) {
                  const idx = newItems.findIndex(i => i.templateId === created.template_item_id);
                  if (idx !== -1) {
                    newItems[idx] = { ...newItems[idx], dbItemId: created.id };
                  }
                }
                return newItems;
              });
            }
          })
        );
      }

      await Promise.all(promises);

      // Clear deleted items' dbItemId
      setLocalItems(prev => prev.map(item =>
        toDelete.includes(item.dbItemId || '') ? { ...item, dbItemId: null } : item
      ));

      // Invalidate React Query cache to sync lists
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: offerKeys.detail(offerId) });
      queryClient.invalidateQueries({ queryKey: ['offerSets'] });

      setIsDirty(false);
      isDirtyRef.current = false;
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  }, [offerId, queryClient]);

  // Schedule auto-save (uses refs to avoid stale closures)
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (isDirtyRef.current && !isSavingRef.current) {
        saveChanges();
      }
    }, AUTOSAVE_DELAY);
  }, [saveChanges]);

  // Mark dirty and schedule auto-save
  const markDirty = useCallback(() => {
    setIsDirty(true);
    isDirtyRef.current = true;
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // CTRL+S handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveChanges();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveChanges]);

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  // Handle item change (days, qty, or unitPrice)
  const handleItemChange = useCallback((index: number, field: 'days' | 'qty' | 'unitPrice', value: number) => {
    setLocalItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
    markDirty();
  }, [markDirty]);

  // Handle discount change
  const handleDiscountChange = useCallback((value: number) => {
    setLocalDiscount(Math.max(0, Math.min(100, value)));
    markDirty();
  }, [markDirty]);

  // Handle category-wide days change
  const handleCategoryDaysChange = useCallback((category: string, days: number) => {
    setLocalItems(prev => prev.map(item =>
      item.category === category ? { ...item, days } : item
    ));
    markDirty();
  }, [markDirty]);

  // Handle status change
  const handleStatusChange = useCallback((status: OfferStatus) => {
    setLocalStatus(status);
    markDirty();
  }, [markDirty]);

  // Handle set change
  const handleSetChange = useCallback((setId: string | null) => {
    setLocalSetId(setId);
    markDirty();
  }, [markDirty]);

  // Handle set label change
  const handleSetLabelChange = useCallback((label: string) => {
    setLocalSetLabel(label);
    markDirty();
  }, [markDirty]);

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
    if (el) {
      inputRefs.current.set(key, el);
    } else {
      inputRefs.current.delete(key);
    }
  }, []);

  // Download PDF
  const handleDownloadPdf = useCallback(async () => {
    // Save first if dirty
    if (isDirtyRef.current) await saveChanges();

    setIsDownloadingPdf(true);
    try {
      const response = await fetch(`/api/offers/${offerId}/pdf`);
      if (!response.ok) throw new Error('Failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nabidka-${offer?.offer_number}-${offer?.year}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('PDF download failed:', e);
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [offerId, offer, saveChanges]);

  // Calculate totals
  const totals = localItems.reduce(
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

  const discountAmount = Math.round(totals.equipment * (localDiscount / 100));
  const totalAmount = totals.equipment + totals.personnel + totals.transport - discountAmount;

  // Loading
  if (loading || !offer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  // Group items by category for display
  const itemsByCategory: Record<string, { item: LocalItem; index: number }[]> = {};
  localItems.forEach((item, index) => {
    if (!itemsByCategory[item.category]) itemsByCategory[item.category] = [];
    itemsByCategory[item.category].push({ item, index });
  });

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">
                {formatOfferNumber(offer.offer_number, offer.year)}
              </span>
              <span className="text-slate-400 text-sm">-</span>
              <span className="text-slate-600 text-sm">{offer.title}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge className={`text-xs ${OFFER_STATUS_COLORS[localStatus]}`}>
                {OFFER_STATUS_LABELS[localStatus]}
              </Badge>
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
        <div className="flex items-center gap-1.5">
          <select
            value={localStatus}
            onChange={(e) => handleStatusChange(e.target.value as OfferStatus)}
            className="h-7 text-xs border rounded px-2"
          >
            <option value="draft">Koncept</option>
            <option value="sent">Odesláno</option>
            <option value="accepted">Přijato</option>
            <option value="rejected">Odmítnuto</option>
            <option value="expired">Vypršelo</option>
          </select>
          <button
            onClick={saveChanges}
            disabled={!isDirty || isSaving}
            className="h-7 px-2 border rounded hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
            title="Uložit (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="h-7 px-2 border rounded hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
          >
            {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            <span className="text-xs">PDF</span>
          </button>
        </div>
      </div>

      {/* Project assignment */}
      <div className="flex items-center gap-3 p-2 bg-slate-50 border rounded text-xs">
        <FolderKanban className="w-4 h-4 text-slate-400" />
        <div className="flex items-center gap-2">
          <span className="text-slate-600">Projekt:</span>
          <select
            value={localSetId || ''}
            onChange={(e) => handleSetChange(e.target.value || null)}
            className="h-6 text-xs border rounded px-2 min-w-[140px]"
          >
            <option value="">-- bez projektu --</option>
            {offerSets.map((set) => (
              <option key={set.id} value={set.id}>{set.name}</option>
            ))}
          </select>
        </div>
        {localSetId && (
          <div className="flex items-center gap-2">
            <span className="text-slate-600">Štítek:</span>
            <input
              type="text"
              value={localSetLabel}
              onChange={(e) => handleSetLabelChange(e.target.value)}
              placeholder="např. Stage A"
              className="h-6 text-xs border rounded px-2 w-24"
            />
          </div>
        )}
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
                <CategoryBlock
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
      </div>

      {/* Instructions */}
      <div className="text-[10px] text-slate-400 text-center">
        ↑↓←→ navigace | Enter další řádek | Ctrl+S uložit | Auto-save 2s
      </div>
    </div>
  );
}

// Category block component
function CategoryBlock({
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
  // Get the most common days value in this category for the input
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
            min={1}
            value={commonDays}
            onChange={(e) => onCategoryDaysChange(category, parseInt(e.target.value) || 1)}
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
        <ItemRow
          key={item.templateId}
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
}

// Item row component
function ItemRow({
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
          min={1}
          value={item.days}
          onChange={(e) => onItemChange(index, 'days', parseInt(e.target.value) || 1)}
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
}

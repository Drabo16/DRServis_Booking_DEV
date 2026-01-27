'use client';

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, FileDown, Save, FolderKanban } from 'lucide-react';
import { offerKeys } from '@/hooks/useOffers';
import { useSaveStatus } from '@/contexts/SaveStatusContext';
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
    name: string;
    category: string;
    subcategory: string | null;
    unit: string;
    days_hours: number;
    quantity: number;
    unit_price: number;
    sort_order: number;
  }>;
}

interface OfferSet {
  id: string;
  name: string;
}

export default function OfferEditor({ offerId, isAdmin, onBack }: OfferEditorProps) {
  const queryClient = useQueryClient();
  const { startSaving, stopSaving } = useSaveStatus();

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
  const [localIsVatPayer, setLocalIsVatPayer] = useState(true);
  const [localTitle, setLocalTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Dirty tracking
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Custom item dialog
  const [showAddCustomItem, setShowAddCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemCategory, setCustomItemCategory] = useState('Ground support');
  const [customItemPrice, setCustomItemPrice] = useState(0);

  // Refs for auto-save (to avoid stale closures)
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const localItemsRef = useRef<LocalItem[]>([]);
  const localDiscountRef = useRef(0);
  const localStatusRef = useRef<OfferStatus>('draft');
  const localIsVatPayerRef = useRef(true);
  const localSetIdRef = useRef<string | null>(null);
  const localSetLabelRef = useRef('');
  const localTitleRef = useRef('');
  const isDirtyRef = useRef(false);
  const isSavingRef = useRef(false);

  // OPTIMIZATION: Track original server state to detect changes
  const originalItemsRef = useRef<Map<string, LocalItem>>(new Map());

  // Input refs for navigation
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const AUTOSAVE_DELAY = 4000; // 4 seconds - longer delay to batch more changes

  // Keep refs in sync - OPTIMIZED: consolidated into single useEffect
  useEffect(() => {
    localItemsRef.current = localItems;
    localDiscountRef.current = localDiscount;
    localStatusRef.current = localStatus;
    localIsVatPayerRef.current = localIsVatPayer;
    localSetIdRef.current = localSetId;
    localSetLabelRef.current = localSetLabel;
    localTitleRef.current = localTitle;
    isDirtyRef.current = isDirty;
    isSavingRef.current = isSaving;
  }, [localItems, localDiscount, localStatus, localIsVatPayer, localSetId, localSetLabel, localTitle, isDirty, isSaving]);

  // Load data once on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [offerRes, templatesRes, setsRes, itemsRes] = await Promise.all([
          fetch(`/api/offers/${offerId}`),
          fetch('/api/offers/templates/items'),
          fetch('/api/offers/sets'),
          fetch(`/api/offers/${offerId}/items`),
        ]);

        const offerData = await offerRes.json();
        const templatesData = await templatesRes.json();
        const setsData = await setsRes.json();
        const itemsData = await itemsRes.json();

        // Enhance offer data with full items
        offerData.items = itemsData;

        setOffer(offerData);
        setTemplates(templatesData);
        setOfferSets(setsData || []);
        setLocalStatus(offerData.status);
        setLocalDiscount(offerData.discount_percent);
        setLocalIsVatPayer(offerData.is_vat_payer ?? true);
        setLocalSetId(offerData.offer_set_id || null);
        setLocalSetLabel(offerData.set_label || '');
        setLocalTitle(offerData.title || '');

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

    // Add template-based items
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

    // Add custom items (items without template_item_id)
    const customOfferItems = offer.items?.filter(i => !i.template_item_id) || [];
    for (const offerItem of customOfferItems) {
      items.push({
        templateId: '', // No template for custom items
        name: offerItem.name,
        subcategory: offerItem.subcategory,
        category: offerItem.category,
        unitPrice: offerItem.unit_price,
        unit: offerItem.unit || 'ks',
        sortOrder: offerItem.sort_order || 999,
        days: offerItem.days_hours,
        qty: offerItem.quantity,
        dbItemId: offerItem.id,
      });
    }

    // Sort by category order then sort_order
    items.sort((a, b) => {
      const catA = OFFER_CATEGORY_ORDER.indexOf(a.category as any);
      const catB = OFFER_CATEGORY_ORDER.indexOf(b.category as any);
      if (catA !== catB) return catA - catB;
      return a.sortOrder - b.sortOrder;
    });

    // OPTIMIZATION: Store original server state for change detection
    originalItemsRef.current = new Map();
    items.forEach(item => {
      if (item.dbItemId) {
        originalItemsRef.current.set(item.dbItemId, { ...item });
      }
    });

    setLocalItems(items);
  };

  // Save all changes to server - BATCH mode for speed
  const saveChanges = useCallback(async () => {
    if (!isDirtyRef.current || isSavingRef.current) return;

    setIsSaving(true);
    startSaving('Ukládám nabídku...');
    isSavingRef.current = true;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    const items = localItemsRef.current;
    const discount = localDiscountRef.current;
    const status = localStatusRef.current;
    const isVatPayer = localIsVatPayerRef.current;
    const setId = localSetIdRef.current;
    const setLabel = localSetLabelRef.current;
    const title = localTitleRef.current;

    try {
      // OPTIMIZATION: Prepare batch operations - only save CHANGED items
      const toDelete: string[] = [];
      const toUpdate: Array<{ id: string; days: number; qty: number; unitPrice: number }> = [];
      const toCreate: Array<{ templateId: string; days: number; qty: number; unitPrice: number }> = [];

      for (const item of items) {
        if (item.qty === 0 && item.dbItemId) {
          // Item has qty=0 and exists in DB -> delete it
          toDelete.push(item.dbItemId);
        } else if (item.qty > 0) {
          if (item.dbItemId) {
            // Item exists in DB - check if it changed
            const original = originalItemsRef.current.get(item.dbItemId);
            const hasChanged = !original ||
              original.days !== item.days ||
              original.qty !== item.qty ||
              original.unitPrice !== item.unitPrice;

            // ONLY update if changed
            if (hasChanged) {
              toUpdate.push({ id: item.dbItemId, days: item.days, qty: item.qty, unitPrice: item.unitPrice });
            }
          } else if (item.templateId) {
            // New item - create it (only if it has a template)
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
            is_vat_payer: isVatPayer,
            offer_set_id: setId,
            set_label: setLabel || null,
            title: title || null,
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

      // 3. Update items (BATCH - single API call for all updates!)
      if (toUpdate.length > 0) {
        promises.push(
          fetch(`/api/offers/${offerId}/items`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: toUpdate.map(u => ({
                id: u.id,
                days_hours: u.days,
                quantity: u.qty,
                unit_price: u.unitPrice,
              })),
            }),
          })
        );
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

      // OPTIMIZATION: Update original items ref with current state after successful save
      originalItemsRef.current = new Map();
      localItemsRef.current.forEach(item => {
        if (item.dbItemId) {
          originalItemsRef.current.set(item.dbItemId, { ...item });
        }
      });

      // Invalidate React Query cache to sync lists
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: offerKeys.detail(offerId) });
      queryClient.invalidateQueries({ queryKey: ['offerSets'] });

      // Notify project editor if this offer belongs to a set (always, because totals may have changed)
      if (setId) {
        window.dispatchEvent(new CustomEvent('offerSetUpdated', { detail: { setId } }));
      }

      setIsDirty(false);
      isDirtyRef.current = false;
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setIsSaving(false);
      stopSaving();
      isSavingRef.current = false;
    }
  }, [offerId, queryClient, startSaving, stopSaving]);

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

  // Handle VAT payer change
  const handleVatPayerChange = useCallback((value: boolean) => {
    setLocalIsVatPayer(value);
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

  // Handle set change - CRITICAL: immediate save for project assignment
  const handleSetChange = useCallback(async (setId: string | null) => {
    const previousSetId = localSetIdRef.current;
    setLocalSetId(setId);

    // CRITICAL FIX: Save immediately when changing project assignment
    setIsSaving(true);
    startSaving('Přiřazuji k projektu...');

    try {
      const response = await fetch(`/api/offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_set_id: setId,
          recalculate: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ PATCH failed:', response.status, errorData);
        throw new Error(errorData.error || 'Failed to update project assignment');
      }

      const result = await response.json();
      console.log('✅ Project assignment saved:', result);

      // Invalidate caches immediately
      queryClient.invalidateQueries({ queryKey: ['offerSets'] });
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });

      // Notify both old and new project editors
      if (previousSetId) {
        window.dispatchEvent(new CustomEvent('offerSetUpdated', { detail: { setId: previousSetId } }));
      }
      if (setId) {
        window.dispatchEvent(new CustomEvent('offerSetUpdated', { detail: { setId } }));
      }
    } catch (e) {
      console.error('Failed to update offer set:', e);
      alert('Chyba při přiřazení k projektu: ' + (e instanceof Error ? e.message : 'Neznámá chyba'));
    } finally {
      setIsSaving(false);
      stopSaving();
    }
  }, [offerId, queryClient, startSaving, stopSaving]);

  // Handle set label change - debounced save after typing
  const handleSetLabelChange = useCallback((label: string) => {
    setLocalSetLabel(label);
    markDirty(); // This will trigger auto-save after 4s
  }, [markDirty]);

  // Handle title change
  const handleTitleChange = useCallback((title: string) => {
    setLocalTitle(title);
    markDirty();
  }, [markDirty]);

  // Handle add custom item - OPTIMIZED: optimistic update instead of full reload
  const handleAddCustomItem = useCallback(async () => {
    if (!customItemName.trim()) return;

    try {
      const res = await fetch(`/api/offers/${offerId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customItemName,
          category: customItemCategory,
          unit_price: customItemPrice,
          quantity: 1,
          days_hours: 1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newItem = data.item;

        // OPTIMIZED: Optimistic update - add new item to local state instead of full reload
        const newLocalItem: LocalItem = {
          templateId: '', // No template for custom items
          name: newItem.name,
          subcategory: newItem.subcategory,
          category: newItem.category,
          unitPrice: newItem.unit_price,
          unit: newItem.unit || 'ks',
          sortOrder: newItem.sort_order || 999,
          days: newItem.days_hours,
          qty: newItem.quantity,
          dbItemId: newItem.id,
        };

        setLocalItems(prev => {
          const newItems = [...prev, newLocalItem];
          // Sort by category order then sort_order
          newItems.sort((a, b) => {
            const catA = OFFER_CATEGORY_ORDER.indexOf(a.category as any);
            const catB = OFFER_CATEGORY_ORDER.indexOf(b.category as any);
            if (catA !== catB) return catA - catB;
            return a.sortOrder - b.sortOrder;
          });
          return newItems;
        });

        setShowAddCustomItem(false);
        setCustomItemName('');
        setCustomItemPrice(0);

        queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
        queryClient.invalidateQueries({ queryKey: offerKeys.detail(offerId) });
      }
    } catch (e) {
      console.error('Add custom item failed:', e);
    }
  }, [offerId, customItemName, customItemCategory, customItemPrice, queryClient]);

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

  // Calculate totals - OPTIMIZED: memoized to avoid recalculation on every render
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

  // Group items by category for display - OPTIMIZED: memoized to avoid recalculation
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, { item: LocalItem; index: number }[]> = {};
    localItems.forEach((item, index) => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push({ item, index });
    });
    return grouped;
  }, [localItems]);

  // Loading
  if (loading || !offer) {
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
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">
                {formatOfferNumber(offer.offer_number, offer.year)}
              </span>
              <span className="text-slate-400 text-sm">-</span>
              {isEditingTitle ? (
                <input
                  type="text"
                  value={localTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setIsEditingTitle(false);
                    if (e.key === 'Escape') {
                      setLocalTitle(offer.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  className="text-slate-600 text-sm border-b border-blue-500 bg-blue-50 px-1 outline-none min-w-[150px]"
                />
              ) : (
                <span
                  className="text-slate-600 text-sm cursor-pointer hover:bg-slate-100 px-1 rounded"
                  onClick={() => setIsEditingTitle(true)}
                  title="Klikněte pro úpravu názvu"
                >
                  {localTitle || offer.title}
                </span>
              )}
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

      {/* Project assignment + VAT payer */}
      <div className="flex items-center justify-between p-2 bg-slate-50 border rounded text-xs">
        <div className="flex items-center gap-3">
          <FolderKanban className="w-4 h-4 text-slate-400" />
          <div className="flex items-center gap-2">
            <span className="text-slate-600">Projekt:</span>
            <select
              value={localSetId || ''}
              onChange={(e) => handleSetChange(e.target.value || null)}
              disabled={isSaving}
              className="h-6 text-xs border rounded px-2 min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>

      {/* Add custom item button + VAT payer checkbox */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer bg-slate-100 px-3 py-1.5 rounded border">
          <input
            type="checkbox"
            checked={localIsVatPayer}
            onChange={(e) => handleVatPayerChange(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-xs font-medium text-slate-700">Plátce DPH</span>
        </label>
        <button
          onClick={() => setShowAddCustomItem(!showAddCustomItem)}
          className="h-7 px-3 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded flex items-center gap-1"
        >
          <span>+ Vlastní položka</span>
        </button>
      </div>

      {/* Custom item form */}
      {showAddCustomItem && (
        <div className="p-3 bg-amber-50 border rounded">
          <div className="text-xs text-slate-600 mb-2 font-medium">Přidat vlastní položku:</div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
              placeholder="Název položky (např. Ploty na akci)"
              className="flex-1 min-w-[200px] h-7 text-xs border rounded px-2"
            />
            <select
              value={customItemCategory}
              onChange={(e) => setCustomItemCategory(e.target.value)}
              className="h-7 text-xs border rounded px-2"
            >
              {OFFER_CATEGORY_ORDER.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <input
              type="number"
              value={customItemPrice}
              onChange={(e) => setCustomItemPrice(parseFloat(e.target.value) || 0)}
              placeholder="Cena"
              className="w-24 h-7 text-xs border rounded px-2 text-right"
            />
            <span className="text-xs text-slate-500">Kč</span>
            <button
              onClick={handleAddCustomItem}
              disabled={!customItemName.trim()}
              className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
            >
              Přidat
            </button>
            <button
              onClick={() => setShowAddCustomItem(false)}
              className="h-7 px-3 text-xs bg-slate-200 hover:bg-slate-300 rounded"
            >
              Zrušit
            </button>
          </div>
        </div>
      )}

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
        ↑↓←→ navigace | Enter další řádek | Ctrl+S uložit | Auto-save 2s
      </div>
    </div>
  );
}

// Category block component - OPTIMIZED: memoized to prevent unnecessary re-renders
const CategoryBlock = memo(function CategoryBlock({
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
});

// Item row component - OPTIMIZED: memoized to prevent unnecessary re-renders
const ItemRow = memo(function ItemRow({
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

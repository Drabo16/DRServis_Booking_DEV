'use client';

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, FileDown, FileSpreadsheet, Save, FolderKanban, BookTemplate, Tag, X, Check, UserPlus, Users, CalendarDays, Briefcase, StickyNote, ChevronDown, Search, Plus, Link2 } from 'lucide-react';
import { offerKeys } from '@/hooks/useOffers';
import type { OfferPresetWithCount, OfferPresetItem } from '@/types/offers';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  event_start_date: string | null;
  event_end_date: string | null;
  event_id: string | null;
  event: { id: string; title: string; start_time: string; end_time: string; location: string } | null;
  client_id: string | null;
  client: { id: string; name: string } | null;
  notes: string | null;
  updated_at: string;
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

interface ShareUser {
  id: string;
  full_name: string;
  email: string;
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
  const [localEventStartDate, setLocalEventStartDate] = useState<string | null>(null);
  const [localEventEndDate, setLocalEventEndDate] = useState<string | null>(null);
  const [localClientId, setLocalClientId] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState('');
  const [clientsList, setClientsList] = useState<Array<{ id: string; name: string; contact_person?: string | null }>>([]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Event linking state
  const [localEventId, setLocalEventId] = useState<string | null>(null);
  const [eventsList, setEventsList] = useState<Array<{ id: string; title: string; start_time: string; location: string | null }>>([]);
  const [eventSearch, setEventSearch] = useState('');
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false);

  // Client combobox state
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [showCreateClientForm, setShowCreateClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);

  // Material search state
  const [materialSearch, setMaterialSearch] = useState('');

  // Dirty tracking
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingXlsx, setIsDownloadingXlsx] = useState(false);
  const [isDownloadingOfferXlsx, setIsDownloadingOfferXlsx] = useState(false);

  // Custom item dialog
  const [showAddCustomItem, setShowAddCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemCategory, setCustomItemCategory] = useState('Ground support');
  const [customItemPrice, setCustomItemPrice] = useState(0);
  const [customSectionMode, setCustomSectionMode] = useState(false);
  const [customSectionName, setCustomSectionName] = useState('');

  // Load preset dialog
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [presetsList, setPresetsList] = useState<OfferPresetWithCount[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);

  // Save as preset dialog
  const [showSaveAsPreset, setShowSaveAsPreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);

  // Version history
  const [versions, setVersions] = useState<Array<{ id: string; version_number: number; name: string | null; created_at: string }>>([]);
  const [restoringVersion, setRestoringVersion] = useState(false);
  const [showVersionManager, setShowVersionManager] = useState(false);
  const [editingVersionName, setEditingVersionName] = useState<{ id: string; name: string } | null>(null);

  // Sharing
  const [sharedWith, setSharedWith] = useState<ShareUser[]>([]);
  const [usersWithAccess, setUsersWithAccess] = useState<ShareUser[]>([]);
  const [showShareDropdown, setShowShareDropdown] = useState(false);

  // Refs for auto-save (to avoid stale closures)
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const localItemsRef = useRef<LocalItem[]>([]);
  const localDiscountRef = useRef(0);
  const localStatusRef = useRef<OfferStatus>('draft');
  const localIsVatPayerRef = useRef(true);
  const localSetIdRef = useRef<string | null>(null);
  const localSetLabelRef = useRef('');
  const localTitleRef = useRef('');
  const localEventStartDateRef = useRef<string | null>(null);
  const localEventEndDateRef = useRef<string | null>(null);
  const localClientIdRef = useRef<string | null>(null);
  const localNotesRef = useRef('');
  const localEventIdRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);
  const isSavingRef = useRef(false);

  // OPTIMIZATION: Track original server state to detect changes
  const originalItemsRef = useRef<Map<string, LocalItem>>(new Map());

  // Input refs for navigation
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const AUTOSAVE_DELAY = 4000; // 4 seconds - longer delay to batch more changes
  const SESSION_GAP_MS = 4 * 60 * 60 * 1000; // 4 hours — new session = new version on first save
  const needsNewVersionRef = useRef(false);

  // Keep refs in sync - OPTIMIZED: consolidated into single useEffect
  useEffect(() => {
    localItemsRef.current = localItems;
    localDiscountRef.current = localDiscount;
    localStatusRef.current = localStatus;
    localIsVatPayerRef.current = localIsVatPayer;
    localSetIdRef.current = localSetId;
    localSetLabelRef.current = localSetLabel;
    localTitleRef.current = localTitle;
    localEventStartDateRef.current = localEventStartDate;
    localEventEndDateRef.current = localEventEndDate;
    localClientIdRef.current = localClientId;
    localNotesRef.current = localNotes;
    localEventIdRef.current = localEventId;
    isDirtyRef.current = isDirty;
    isSavingRef.current = isSaving;
  }, [localItems, localDiscount, localStatus, localIsVatPayer, localSetId, localSetLabel, localTitle, localEventStartDate, localEventEndDate, localClientId, localNotes, localEventId, isDirty, isSaving]);

  // Load data once on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [offerRes, templatesRes, setsRes, itemsRes, sharesRes, usersRes, clientsRes, eventsRes] = await Promise.all([
          fetch(`/api/offers/${offerId}`),
          fetch('/api/offers/templates/items'),
          fetch('/api/offers/sets'),
          fetch(`/api/offers/${offerId}/items`),
          fetch(`/api/offers/${offerId}/shares`),
          fetch('/api/offers/users-with-access'),
          fetch('/api/clients?scope=offers').catch(() => null),
          fetch('/api/events?daysBack=365&daysAhead=365').catch(() => null),
        ]);

        const offerData = await offerRes.json();
        const templatesData = await templatesRes.json();
        const setsData = await setsRes.json();
        const itemsData = await itemsRes.json();
        const sharesData = sharesRes.ok ? await sharesRes.json() : [];
        const usersData = usersRes.ok ? await usersRes.json() : [];
        const clientsData = clientsRes && clientsRes.ok ? await clientsRes.json() : [];
        const eventsData = eventsRes && eventsRes.ok ? await eventsRes.json() : [];

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
        setLocalEventStartDate(offerData.event_start_date || null);
        setLocalEventEndDate(offerData.event_end_date || null);
        setLocalClientId(offerData.client_id || null);
        setLocalNotes(offerData.notes || '');
        setLocalEventId(offerData.event_id || null);
        setClientsList(clientsData || []);
        // Events: flatten the response (API returns array of event objects with positions)
        const evList = (eventsData || []).map((e: { id: string; title: string; start_time: string; location: string | null }) => ({
          id: e.id, title: e.title, start_time: e.start_time, location: e.location,
        }));
        setEventsList(evList);
        // Load shares: each row has a `profiles` object nested
        const shared = sharesData.map((s: { profiles: ShareUser | null }) => s.profiles).filter(Boolean);
        setSharedWith(shared);
        setUsersWithAccess(usersData);

        // Build local items from templates + offer; get any duplicate IDs to clean up
        const duplicateIds = buildLocalItems(templatesData, offerData);

        // Auto-delete duplicate DB items silently (can happen from race conditions)
        if (duplicateIds.length > 0) {
          await Promise.all(
            duplicateIds.map(id =>
              fetch(`/api/offers/${offerId}/items?item_id=${id}`, { method: 'DELETE' }).catch(() => {})
            )
          );
          // Recalculate totals after cleanup
          await fetch(`/api/offers/${offerId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recalculate: true }),
          }).catch(() => {});
        }

        setLoading(false);
      } catch (e) {
        console.error('Load failed:', e);
        setLoading(false);
      }
    }
    loadData();
  }, [offerId]);

  // Build local items array — returns IDs of duplicate items to delete
  const buildLocalItems = (templates: TemplateItem[], offer: OfferData): string[] => {
    const items: LocalItem[] = [];
    const duplicateIds: string[] = [];

    // Add template-based items — detect & skip duplicates (keep first by sort_order)
    for (const t of templates) {
      const catName = t.category?.name || 'Ostatní';
      const matchingItems = (offer.items || []).filter(i => i.template_item_id === t.id);

      // If there are duplicates for this template, keep the one with the highest total_price
      // and schedule the rest for immediate deletion
      let offerItem = matchingItems[0] ?? undefined;
      if (matchingItems.length > 1) {
        // Keep the most recent (highest total_price as proxy, then first)
        offerItem = matchingItems.reduce((best, cur) =>
          cur.days_hours * cur.quantity * cur.unit_price > best.days_hours * best.quantity * best.unit_price ? cur : best
        );
        for (const dup of matchingItems) {
          if (dup.id !== offerItem.id) duplicateIds.push(dup.id);
        }
      }

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
      const catA = (OFFER_CATEGORY_ORDER as readonly string[]).indexOf(a.category);
      const catB = (OFFER_CATEGORY_ORDER as readonly string[]).indexOf(b.category);
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
    return duplicateIds;
  };

  // Load version history
  const loadVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/offers/${offerId}/versions`);
      if (res.ok) setVersions(await res.json());
    } catch (e) {
      console.error('Failed to load versions:', e);
    }
  }, [offerId]);

  // Save a version snapshot after explicit save
  const saveVersionSnapshot = useCallback(async () => {
    const items = localItemsRef.current
      .filter(item => item.qty > 0)
      .map(item => ({
        templateId: item.templateId,
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        unitPrice: item.unitPrice,
        unit: item.unit,
        days: item.days,
        qty: item.qty,
      }));
    try {
      await fetch(`/api/offers/${offerId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: localTitleRef.current,
          status: localStatusRef.current,
          discount_percent: localDiscountRef.current,
          is_vat_payer: localIsVatPayerRef.current,
          items,
        }),
      });
      loadVersions();
    } catch (e) {
      console.error('Failed to save version:', e);
    }
  }, [offerId, loadVersions]);

  // Restore a version
  const restoreVersion = useCallback(async (versionId: string) => {
    if (!confirm('Chcete obnovit tuto verzi? Neuložené změny budou ztraceny.')) return;
    setRestoringVersion(true);
    try {
      const res = await fetch(`/api/offers/${offerId}/versions/${versionId}`);
      if (!res.ok) throw new Error('Failed to fetch version');
      const version = await res.json();
      const restoredItems: Array<{ templateId: string; days: number; qty: number; unitPrice: number }> = version.items || [];

      setLocalItems(prev => prev.map(item => {
        const r = restoredItems.find(ri => ri.templateId === item.templateId);
        if (r) return { ...item, days: r.days, qty: r.qty, unitPrice: r.unitPrice };
        return { ...item, qty: 0 };
      }));
      setLocalDiscount(version.discount_percent || 0);
      setLocalIsVatPayer(version.is_vat_payer ?? true);
      setIsDirty(true);
      isDirtyRef.current = true;
    } catch (e) {
      console.error('Failed to restore version:', e);
      toast.error('Nepodařilo se obnovit verzi.');
    } finally {
      setRestoringVersion(false);
    }
  }, [offerId]);

  // Save all changes to server - BATCH mode for speed
  const saveChanges = useCallback(async (createVersion = false) => {
    // Nothing dirty — if explicit save requested, still create a version snapshot
    if (!isDirtyRef.current) {
      if (createVersion) saveVersionSnapshot();
      return;
    }
    if (isSavingRef.current) return;

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
    const eventStartDate = localEventStartDateRef.current;
    const eventEndDate = localEventEndDateRef.current;
    const clientId = localClientIdRef.current;
    const notes = localNotesRef.current;
    const eventId = localEventIdRef.current;

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
      const promises: Promise<Response | void>[] = [];

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
            event_start_date: eventStartDate || null,
            event_end_date: eventEndDate || null,
            client_id: clientId || null,
            notes: notes || null,
            event_id: eventId || null,
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

      // 4. Create items (batch) — collect created IDs to update refs after save
      // templateId → new dbItemId (from POST response / upsert)
      const createdItemIds = new Map<string, string>();
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
            if (data.items) {
              for (const created of data.items) {
                if (created.template_item_id) {
                  createdItemIds.set(created.template_item_id, created.id);
                }
              }
            }
          })
        );
      }

      await Promise.all(promises);

      // Update dbItemIds in React state for newly created items
      if (createdItemIds.size > 0) {
        setLocalItems(prev => {
          const newItems = [...prev];
          for (const [templateId, dbItemId] of createdItemIds) {
            const idx = newItems.findIndex(i => i.templateId === templateId);
            if (idx !== -1) newItems[idx] = { ...newItems[idx], dbItemId };
          }
          return newItems;
        });
      }

      // Clear deleted items' dbItemId
      setLocalItems(prev => prev.map(item =>
        toDelete.includes(item.dbItemId || '') ? { ...item, dbItemId: null } : item
      ));

      // Build originalItemsRef from the CAPTURED items snapshot (not stale localItemsRef.current).
      // This prevents treating unchanged items as changed on the next save cycle.
      originalItemsRef.current = new Map();
      for (const item of items) {
        if (toDelete.includes(item.dbItemId || '')) continue;
        const resolvedId = (item.templateId && createdItemIds.get(item.templateId)) || item.dbItemId;
        if (resolvedId) {
          originalItemsRef.current.set(resolvedId, { ...item, dbItemId: resolvedId });
        }
      }

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

      // Save version snapshot on explicit save OR on first save of a new session
      const shouldCreateVersion = createVersion || needsNewVersionRef.current;
      needsNewVersionRef.current = false;
      if (shouldCreateVersion) saveVersionSnapshot();
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setIsSaving(false);
      stopSaving();
      isSavingRef.current = false;
    }
  }, [offerId, queryClient, startSaving, stopSaving, saveVersionSnapshot]);

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

  // Load versions on mount
  useEffect(() => { loadVersions(); }, [loadVersions]);

  // Detect new session: if last save > SESSION_GAP_MS ago, first autosave creates a new version
  useEffect(() => {
    if (!offer?.updated_at) return;
    if (Date.now() - new Date(offer.updated_at).getTime() > SESSION_GAP_MS) {
      needsNewVersionRef.current = true;
    }
  }, [offer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ref for material search input
  const materialSearchRef = useRef<HTMLInputElement>(null);

  // CTRL+S handler - save without creating version (use button for new version)
  // CTRL+F handler - focus material search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveChanges();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        materialSearchRef.current?.focus();
        materialSearchRef.current?.select();
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
      toast.error('Chyba při přiřazení k projektu: ' + (e instanceof Error ? e.message : 'Neznámá chyba'));
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

  const handleEventStartDateChange = useCallback((date: string) => {
    setLocalEventStartDate(date || null);
    markDirty();
  }, [markDirty]);

  const handleEventEndDateChange = useCallback((date: string) => {
    setLocalEventEndDate(date || null);
    markDirty();
  }, [markDirty]);

  // Auto-fill event dates from linked event
  const handleAutoFillEventDates = useCallback(() => {
    if (!offer?.event) return;
    const startDate = offer.event.start_time?.split('T')[0];
    const endDate = offer.event.end_time?.split('T')[0] || startDate;
    if (startDate) {
      setLocalEventStartDate(startDate);
      setLocalEventEndDate(endDate);
      markDirty();
      toast.success('Termín akce byl vyplněn z propojené akce.');
    }
  }, [offer, markDirty]);

  const handleClientChange = useCallback((clientId: string | null) => {
    setLocalClientId(clientId);
    markDirty();
  }, [markDirty]);

  // Handle event linking
  const handleEventChange = useCallback((eventId: string | null) => {
    setLocalEventId(eventId);
    // If linking an event, also update the offer object so "Z akce" button works
    if (eventId) {
      const ev = eventsList.find(e => e.id === eventId);
      if (ev && offer) {
        setOffer({ ...offer, event_id: eventId, event: { id: ev.id, title: ev.title, start_time: ev.start_time, end_time: ev.start_time, location: ev.location || '' } });
      }
    } else if (offer) {
      setOffer({ ...offer, event_id: null, event: null });
    }
    markDirty();
  }, [markDirty, eventsList, offer]);

  // Filtered clients for combobox
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clientsList;
    const q = clientSearch.toLowerCase();
    return clientsList.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.contact_person && c.contact_person.toLowerCase().includes(q))
    );
  }, [clientsList, clientSearch]);

  const selectedClientName = useMemo(
    () => clientsList.find(c => c.id === localClientId)?.name,
    [clientsList, localClientId]
  );

  // Filtered events for combobox
  const filteredEvents = useMemo(() => {
    if (!eventSearch.trim()) return eventsList;
    const terms = eventSearch.toLowerCase().split(/\s+/);
    return eventsList.filter(e => {
      const searchable = [e.title, e.location, e.start_time ? new Date(e.start_time).toLocaleDateString('cs-CZ') : ''].filter(Boolean).join(' ').toLowerCase();
      return terms.every(t => searchable.includes(t));
    });
  }, [eventsList, eventSearch]);

  const selectedEventName = useMemo(() => {
    const ev = eventsList.find(e => e.id === localEventId);
    if (!ev) return null;
    const date = new Date(ev.start_time).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
    return `${ev.title} (${date})`;
  }, [eventsList, localEventId]);

  // Create a new client inline from the offer editor
  const handleCreateClient = useCallback(async () => {
    if (!newClientName.trim() || creatingClient) return;
    setCreatingClient(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const created = { id: data.client.id, name: data.client.name };
      setClientsList(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'cs')));
      handleClientChange(data.client.id);
      setNewClientName('');
      setShowCreateClientForm(false);
      toast.success('Klient byl vytvořen.');
    } catch {
      toast.error('Nepodařilo se vytvořit klienta.');
    } finally {
      setCreatingClient(false);
    }
  }, [newClientName, creatingClient, handleClientChange]);

  // Add share
  const handleAddShare = useCallback(async (user: ShareUser) => {
    setShowShareDropdown(false);
    try {
      const res = await fetch(`/api/offers/${offerId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      if (res.ok) {
        setSharedWith(prev => [...prev, user]);
      } else {
        toast.error('Nepodařilo se sdílet nabídku.');
      }
    } catch (e) {
      console.error('Failed to add share:', e);
      toast.error('Nepodařilo se sdílet nabídku.');
    }
  }, [offerId]);

  // Remove share
  const handleRemoveShare = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/offers/${offerId}/shares?user_id=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setSharedWith(prev => prev.filter(u => u.id !== userId));
      } else {
        toast.error('Nepodařilo se odebrat sdílení.');
      }
    } catch (e) {
      console.error('Failed to remove share:', e);
      toast.error('Nepodařilo se odebrat sdílení.');
    }
  }, [offerId]);

  // Handle version rename
  const handleRenameVersion = useCallback(async (versionId: string, name: string) => {
    try {
      await fetch(`/api/offers/${offerId}/versions/${versionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || null }),
      });
      setVersions(prev => prev.map(v => v.id === versionId ? { ...v, name: name.trim() || null } : v));
      setEditingVersionName(null);
    } catch (e) {
      console.error('Failed to rename version:', e);
      toast.error('Nepodařilo se přejmenovat verzi.');
    }
  }, [offerId]);

  // Handle add custom item - OPTIMIZED: optimistic update instead of full reload
  const handleAddCustomItem = useCallback(async () => {
    if (!customItemName.trim()) return;
    const effectiveCategory = customSectionMode && customSectionName.trim() ? customSectionName.trim() : customItemCategory;

    try {
      const res = await fetch(`/api/offers/${offerId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customItemName,
          category: effectiveCategory,
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
            const catA = (OFFER_CATEGORY_ORDER as readonly string[]).indexOf(a.category);
            const catB = (OFFER_CATEGORY_ORDER as readonly string[]).indexOf(b.category);
            if (catA !== catB) return catA - catB;
            return a.sortOrder - b.sortOrder;
          });
          return newItems;
        });

        setShowAddCustomItem(false);
        setCustomItemName('');
        setCustomItemPrice(0);
        setCustomSectionMode(false);
        setCustomSectionName('');

        queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
        queryClient.invalidateQueries({ queryKey: offerKeys.detail(offerId) });
      }
    } catch (e) {
      console.error('Add custom item failed:', e);
    }
  }, [offerId, customItemName, customItemCategory, customItemPrice, customSectionMode, customSectionName, queryClient]);

  // Open preset dialog
  const openPresetDialog = useCallback(async () => {
    setShowPresetDialog(true);
    setLoadingPresets(true);
    try {
      const res = await fetch('/api/offers/presets');
      if (res.ok) {
        const data = await res.json();
        setPresetsList(data);
      }
    } catch (e) {
      console.error('Failed to load presets:', e);
    } finally {
      setLoadingPresets(false);
    }
  }, []);

  // Load preset into current offer
  const loadPreset = useCallback(async (presetId: string) => {
    if (!confirm('Toto načte položky ze šablony do aktuální nabídky. Existující položky se přepíšou. Pokračovat?')) return;

    try {
      const res = await fetch(`/api/offers/presets/${presetId}`);
      if (!res.ok) return;
      const presetData = await res.json();
      const presetItems: OfferPresetItem[] = presetData.items || [];

      // Apply preset items to local items
      setLocalItems(prev => {
        const newItems = prev.map(item => {
          const presetItem = presetItems.find(pi => pi.template_item_id === item.templateId);
          if (presetItem) {
            return {
              ...item,
              qty: presetItem.quantity,
              days: presetItem.days_hours,
              unitPrice: presetItem.unit_price,
            };
          }
          // Reset items not in preset
          return { ...item, qty: 0 };
        });
        return newItems;
      });

      // Apply preset discount and VAT settings
      if (presetData.discount_percent !== undefined) {
        setLocalDiscount(presetData.discount_percent);
      }
      if (presetData.is_vat_payer !== undefined) {
        setLocalIsVatPayer(presetData.is_vat_payer);
      }

      markDirty();
      setShowPresetDialog(false);
    } catch (e) {
      console.error('Failed to load preset:', e);
    }
  }, [markDirty]);

  // Save current offer as a preset
  const saveAsPreset = useCallback(async () => {
    if (!presetName.trim() || savingPreset) return;
    setSavingPreset(true);

    try {
      // 1. Create the preset
      const createRes = await fetch('/api/offers/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: presetName, description: presetDescription || null }),
      });
      if (!createRes.ok) throw new Error('Failed to create preset');
      const { preset } = await createRes.json();

      // 2. Save items (only those with qty > 0)
      const itemsToSave = localItemsRef.current
        .filter(item => item.qty > 0)
        .map((item, index) => ({
          template_item_id: item.templateId || null,
          name: item.name,
          category: item.category,
          subcategory: item.subcategory,
          unit: item.unit,
          unit_price: item.unitPrice,
          days_hours: item.days,
          quantity: item.qty,
          sort_order: index,
        }));

      const patchRes = await fetch(`/api/offers/presets/${preset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discount_percent: localDiscountRef.current,
          is_vat_payer: localIsVatPayerRef.current,
          items: itemsToSave,
        }),
      });
      if (!patchRes.ok) throw new Error('Failed to save preset items');

      setShowSaveAsPreset(false);
      setPresetName('');
      setPresetDescription('');
      toast.success('Šablona byla úspěšně uložena.');
    } catch (e) {
      console.error('Failed to save as preset:', e);
      toast.error('Nepodařilo se uložit šablonu. Ujistěte se, že byla spuštěna migrace supabase-offer-presets.sql a fix-offer-preset-rls.sql v Supabase.');
    } finally {
      setSavingPreset(false);
    }
  }, [presetName, presetDescription, savingPreset]);

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

  // Download offer as XLSX
  const handleDownloadOfferXlsx = useCallback(async () => {
    if (isDirtyRef.current) await saveChanges();
    setIsDownloadingOfferXlsx(true);
    try {
      const response = await fetch(`/api/offers/${offerId}/offer-xlsx`);
      if (!response.ok) throw new Error('Failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nabidka-${offer?.offer_number}-${offer?.year}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Offer XLSX download failed:', e);
    } finally {
      setIsDownloadingOfferXlsx(false);
    }
  }, [offerId, offer, saveChanges]);

  // Download XLSX preparation sheet
  const handleDownloadXlsx = useCallback(async () => {
    if (isDirtyRef.current) await saveChanges();
    setIsDownloadingXlsx(true);
    try {
      const response = await fetch(`/api/offers/${offerId}/xlsx`);
      if (!response.ok) throw new Error('Failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `priprava-${offer?.offer_number}-${offer?.year}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('XLSX download failed:', e);
    } finally {
      setIsDownloadingXlsx(false);
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
    <div className="space-y-3 max-w-5xl">
      {/* Header - sticky, stretches into parent padding so it sits flush under top bar */}
      <div className="flex items-center justify-between pb-2 border-b sticky -top-4 md:-top-6 z-30 bg-white pt-4 md:pt-6 -mx-4 md:-mx-6 px-4 md:px-6">
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
            <option value="cancelled">Storno</option>
          </select>
          <button
            onClick={() => saveChanges(true)}
            disabled={!isDirty || isSaving}
            className="h-7 px-2 border rounded hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
            title="Uložit (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => saveChanges(true)}
            disabled={isSaving}
            className="h-7 px-2 text-xs border border-blue-300 text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1"
            title="Vytvořit novou verzi"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nová verze</span>
          </button>
          <select
            onChange={(e) => {
              if (e.target.value) {
                restoreVersion(e.target.value);
                e.target.value = '';
              }
            }}
            disabled={restoringVersion || versions.length === 0}
            className="h-7 text-xs border rounded px-1.5 text-slate-600 disabled:opacity-50"
            title={versions.length === 0 ? 'Uložte Ctrl+S pro vytvoření první verze' : 'Obnovit verzi'}
            defaultValue=""
          >
            <option value="" disabled>
              {restoringVersion ? 'Obnovuji...' : versions.length === 0 ? 'Žádné verze' : `${versions.length} verzí`}
            </option>
            {versions.map(v => (
              <option key={v.id} value={v.id}>
                {v.name ? `${v.name} – ` : ''}Verze {v.version_number} · {new Date(v.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })} {new Date(v.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowVersionManager(true)}
            disabled={versions.length === 0}
            className="h-7 px-2 border rounded hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
            title="Spravovat verze (přejmenovat)"
          >
            <Tag className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="h-7 px-2 border rounded hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
          >
            {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            <span className="text-xs">PDF</span>
          </button>
          <button
            onClick={handleDownloadXlsx}
            disabled={isDownloadingXlsx}
            className="h-7 px-2 border rounded hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
            title="Stáhnout přípravu pro sklad (XLSX)"
          >
            {isDownloadingXlsx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            <span className="text-xs">Příprava</span>
          </button>
          <button
            onClick={handleDownloadOfferXlsx}
            disabled={isDownloadingOfferXlsx}
            className="h-7 px-2 border rounded hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
            title="Stáhnout nabídku jako Excel (XLSX)"
          >
            {isDownloadingOfferXlsx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            <span className="text-xs">XLSX</span>
          </button>
        </div>
      </div>

      {/* Meta info card — all fields in one box */}
      <div className="bg-slate-50 border rounded text-xs divide-y divide-slate-200">

      {/* Project assignment + visibility */}
      <div className="flex items-center justify-between p-2 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <FolderKanban className="w-4 h-4 text-slate-400 shrink-0" />
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
        {/* Per-user sharing (admin only) */}
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-600">Sdílet s:</span>
            {sharedWith.map(u => (
              <span key={u.id} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                {u.full_name || u.email}
                <button onClick={() => handleRemoveShare(u.id)} className="hover:text-red-600 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {/* Add user dropdown */}
            {usersWithAccess.filter(u => !sharedWith.some(s => s.id === u.id)).length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowShareDropdown(v => !v)}
                  className="inline-flex items-center gap-1 h-5 px-2 text-xs border border-dashed border-slate-400 text-slate-500 hover:border-blue-400 hover:text-blue-600 rounded-full"
                >
                  <UserPlus className="w-3 h-3" />
                  Přidat
                </button>
                {showShareDropdown && (
                  <div className="absolute left-0 top-6 z-20 bg-white border rounded shadow-lg py-1 min-w-[160px]">
                    {usersWithAccess
                      .filter(u => !sharedWith.some(s => s.id === u.id))
                      .map(u => (
                        <button
                          key={u.id}
                          onClick={() => handleAddShare(u)}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50"
                        >
                          {u.full_name || u.email}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
            {sharedWith.length === 0 && (
              <span className="text-slate-400 italic text-xs">nikdo</span>
            )}
          </div>
        )}
      </div>

      {/* Event dates */}
      <div className="flex items-center gap-3 p-2 flex-wrap">
        <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="text-slate-600">Termín akce:</span>
        <div className="grid grid-cols-2 gap-2" style={{ minWidth: 280 }}>
          <div>
            <span className="text-[10px] text-slate-400 block mb-0.5">Od</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-8 text-xs",
                    !localEventStartDate && "text-slate-400"
                  )}
                >
                  <CalendarDays className="mr-2 h-3.5 w-3.5" />
                  {localEventStartDate
                    ? format(new Date(localEventStartDate + 'T00:00'), "d. M. yyyy", { locale: cs })
                    : "Nevybráno"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={localEventStartDate ? new Date(localEventStartDate + 'T00:00') : undefined}
                  onSelect={(date) => handleEventStartDateChange(date ? format(date, 'yyyy-MM-dd') : '')}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block mb-0.5">Do</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-8 text-xs",
                    !localEventEndDate && "text-slate-400"
                  )}
                >
                  <CalendarDays className="mr-2 h-3.5 w-3.5" />
                  {localEventEndDate
                    ? format(new Date(localEventEndDate + 'T00:00'), "d. M. yyyy", { locale: cs })
                    : "Nevybráno"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={localEventEndDate ? new Date(localEventEndDate + 'T00:00') : undefined}
                  onSelect={(date) => handleEventEndDateChange(date ? format(date, 'yyyy-MM-dd') : '')}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {offer?.event && (
          <button
            type="button"
            onClick={handleAutoFillEventDates}
            className="h-8 px-2 text-xs border border-blue-300 text-blue-600 hover:bg-blue-50 rounded"
            title="Vyplnit z propojené akce"
          >
            Z akce
          </button>
        )}
        {(localEventStartDate || localEventEndDate) && (
          <button
            type="button"
            onClick={() => { setLocalEventStartDate(null); setLocalEventEndDate(null); markDirty(); }}
            className="h-8 px-1.5 text-xs text-slate-400 hover:text-red-500"
            title="Vymazat termín"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Event linking */}
      <div className="flex items-center gap-3 p-2 flex-wrap">
        <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="text-slate-600 shrink-0">Akce:</span>
        <div className="relative flex-1 min-w-[180px]">
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={eventDropdownOpen ? eventSearch : (selectedEventName || '')}
              onChange={(e) => { setEventSearch(e.target.value); setEventDropdownOpen(true); }}
              onFocus={() => { setEventSearch(''); setEventDropdownOpen(true); }}
              onBlur={() => setTimeout(() => setEventDropdownOpen(false), 150)}
              placeholder="Vyhledat a propojit akci..."
              className="flex-1 h-6 text-xs border rounded px-2 min-w-[160px]"
            />
            <button
              type="button"
              onClick={() => setEventDropdownOpen(v => !v)}
              className="h-6 px-1 border rounded hover:bg-slate-100 text-slate-500"
              title="Zobrazit seznam"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            {localEventId && (
              <button
                type="button"
                onClick={() => { handleEventChange(null); setEventSearch(''); }}
                className="h-6 px-1 text-slate-400 hover:text-red-500"
                title="Odpojit akci"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {eventDropdownOpen && (
            <div className="absolute top-7 left-0 z-20 bg-white border rounded shadow-lg min-w-[280px] max-h-52 overflow-y-auto">
              <div className="py-1">
                <button
                  type="button"
                  onMouseDown={() => { handleEventChange(null); setEventDropdownOpen(false); setEventSearch(''); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-50 italic"
                >
                  — bez akce —
                </button>
                {filteredEvents.length === 0 ? (
                  <div className="px-3 py-2 text-slate-400 text-xs">Žádná akce nenalezena</div>
                ) : (
                  filteredEvents.map(ev => {
                    const date = new Date(ev.start_time).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onMouseDown={() => { handleEventChange(ev.id); setEventDropdownOpen(false); setEventSearch(''); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 ${ev.id === localEventId ? 'bg-blue-50 font-medium' : ''}`}
                      >
                        <span className="font-medium">{ev.title}</span>
                        <span className="text-slate-400 ml-2">{date}</span>
                        {ev.location && <span className="text-slate-400 ml-1">· {ev.location}</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Client selector with search */}
      <div className="flex items-center gap-3 p-2 flex-wrap">
        <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="text-slate-600 shrink-0">Klient:</span>
        <div className="relative flex-1 min-w-[180px]">
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={clientDropdownOpen ? clientSearch : (selectedClientName || '')}
              onChange={(e) => { setClientSearch(e.target.value); setClientDropdownOpen(true); }}
              onFocus={() => { setClientSearch(''); setClientDropdownOpen(true); }}
              onBlur={() => setTimeout(() => setClientDropdownOpen(false), 150)}
              placeholder="Vyhledat klienta..."
              className="flex-1 h-6 text-xs border rounded px-2 min-w-[160px]"
            />
            <button
              type="button"
              onClick={() => setClientDropdownOpen(v => !v)}
              className="h-6 px-1 border rounded hover:bg-slate-100 text-slate-500"
              title="Zobrazit seznam"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            {localClientId && (
              <button
                type="button"
                onClick={() => { handleClientChange(null); setClientSearch(''); }}
                className="h-6 px-1 text-slate-400 hover:text-red-500"
                title="Odebrat klienta"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {clientDropdownOpen && (
            <div className="absolute top-7 left-0 z-20 bg-white border rounded shadow-lg min-w-[220px] max-h-52 overflow-y-auto">
              <div className="py-1">
                <button
                  type="button"
                  onMouseDown={() => { handleClientChange(null); setClientDropdownOpen(false); setClientSearch(''); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-50 italic"
                >
                  — bez klienta —
                </button>
                {filteredClients.length === 0 ? (
                  <div className="px-3 py-2 text-slate-400 text-xs">Žádný klient nenalezen</div>
                ) : (
                  filteredClients.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => { handleClientChange(c.id); setClientDropdownOpen(false); setClientSearch(''); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 ${c.id === localClientId ? 'bg-blue-50 font-medium' : ''}`}
                    >
                      {c.name}
                      {c.contact_person && <span className="text-slate-400 ml-1">({c.contact_person})</span>}
                    </button>
                  ))
                )}
              </div>
              <div className="border-t py-1">
                <button
                  type="button"
                  onMouseDown={() => { setShowCreateClientForm(true); setClientDropdownOpen(false); setClientSearch(''); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50"
                >
                  + Nový klient
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline new client form */}
      {showCreateClientForm && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
          <span className="text-slate-600 shrink-0">Nový klient:</span>
          <input
            type="text"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            placeholder="Název klienta..."
            className="flex-1 h-6 border rounded px-2 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateClient();
              if (e.key === 'Escape') { setShowCreateClientForm(false); setNewClientName(''); }
            }}
          />
          <button
            type="button"
            onClick={handleCreateClient}
            disabled={!newClientName.trim() || creatingClient}
            className="h-6 px-2 bg-blue-600 text-white rounded text-xs disabled:opacity-50 flex items-center gap-1"
          >
            {creatingClient && <Loader2 className="w-3 h-3 animate-spin" />}
            Vytvořit
          </button>
          <button
            type="button"
            onClick={() => { setShowCreateClientForm(false); setNewClientName(''); }}
            className="h-6 px-2 bg-slate-200 hover:bg-slate-300 rounded text-xs"
          >
            Zrušit
          </button>
        </div>
      )}

      {/* Notes */}
      <div className="flex items-start gap-3 p-2">
        <StickyNote className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <span className="text-slate-600 block mb-1">Poznámka:</span>
          <textarea
            value={localNotes}
            onChange={(e) => { setLocalNotes(e.target.value); markDirty(); }}
            placeholder="Poznámky pro zákazníka (tisknou se na nabídku)..."
            rows={2}
            className="w-full text-xs border rounded px-2 py-1 resize-none focus:ring-1 focus:ring-blue-300 focus:outline-none"
          />
        </div>
      </div>

      </div>{/* end meta info card */}

      {/* Add custom item button + VAT payer checkbox + Load preset */}
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
        <div className="flex items-center gap-2">
          <button
            onClick={openPresetDialog}
            className="h-7 px-3 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded flex items-center gap-1"
          >
            <BookTemplate className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Načíst šablonu</span>
            <span className="sm:hidden">Šablona</span>
          </button>
          <button
            onClick={() => { setPresetName(localTitle || offer?.title || ''); setShowSaveAsPreset(true); }}
            className="h-7 px-3 text-xs border border-indigo-300 text-indigo-600 hover:bg-indigo-50 rounded flex items-center gap-1"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Uložit jako šablonu</span>
            <span className="sm:hidden">Uložit š.</span>
          </button>
          <button
            onClick={() => setShowAddCustomItem(!showAddCustomItem)}
            className="h-7 px-3 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded flex items-center gap-1"
          >
            <span>+ Vlastní položka</span>
          </button>
        </div>
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
            {customSectionMode ? (
              <input
                type="text"
                value={customSectionName}
                onChange={(e) => setCustomSectionName(e.target.value)}
                placeholder="Název vlastní sekce..."
                className="h-7 text-xs border rounded px-2 w-40"
                autoFocus
              />
            ) : (
              <select
                value={customItemCategory}
                onChange={(e) => setCustomItemCategory(e.target.value)}
                className="h-7 text-xs border rounded px-2"
              >
                {/* Standard categories */}
                {OFFER_CATEGORY_ORDER.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                {/* Existing custom categories */}
                {[...new Set(localItems.map(i => i.category).filter(c => !(OFFER_CATEGORY_ORDER as readonly string[]).includes(c)))].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => { setCustomSectionMode(!customSectionMode); if (!customSectionMode) setCustomSectionName(''); }}
              className={`h-7 px-2 text-xs border rounded ${customSectionMode ? 'bg-amber-200 border-amber-400' : 'hover:bg-slate-100'}`}
              title={customSectionMode ? 'Vybrat existující sekci' : 'Přidat do vlastní sekce'}
            >
              {customSectionMode ? 'Existující' : '+ Sekce'}
            </button>
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
              disabled={!customItemName.trim() || (customSectionMode && !customSectionName.trim())}
              className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
            >
              Přidat
            </button>
            <button
              onClick={() => { setShowAddCustomItem(false); setCustomSectionMode(false); setCustomSectionName(''); }}
              className="h-7 px-3 text-xs bg-slate-200 hover:bg-slate-300 rounded"
            >
              Zrušit
            </button>
          </div>
        </div>
      )}

      {/* Material search */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={materialSearch}
              ref={materialSearchRef}
              onChange={(e) => setMaterialSearch(e.target.value)}
              placeholder="Vyhledat materiál / položku... (Ctrl+F)"
              className="w-full h-8 text-xs border rounded pl-7 pr-8"
            />
            {materialSearch && (
              <button
                onClick={() => setMaterialSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {/* Search results dropdown with inline qty/days inputs */}
        {materialSearch.trim() && (
          <div className="mt-1 border rounded bg-white shadow-lg max-h-64 overflow-y-auto z-20 relative">
            {(() => {
              const terms = materialSearch.toLowerCase().split(/\s+/);
              const results = localItems
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => {
                  const searchable = [item.name, item.subcategory, item.category].filter(Boolean).join(' ').toLowerCase();
                  return terms.every(t => searchable.includes(t));
                });
              if (results.length === 0) return <div className="px-3 py-2 text-xs text-slate-400">Nic nenalezeno</div>;
              return results.map(({ item, index }) => (
                <div key={item.templateId || item.dbItemId || index} className={`flex items-center gap-2 px-3 py-1.5 border-b last:border-0 text-xs ${item.qty > 0 ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate">{item.name}</span>
                    {item.subcategory && <span className="text-slate-400 ml-1">({item.subcategory})</span>}
                    <span className="text-slate-400 ml-2 text-[10px]">{item.category}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <label className="text-[10px] text-slate-400">Dny:</label>
                    <input
                      type="number"
                      min={0}
                      value={item.days}
                      onChange={(e) => handleItemChange(index, 'days', parseFloat(e.target.value) || 0)}
                      className="w-12 h-6 text-xs border rounded px-1 text-center"
                    />
                    <label className="text-[10px] text-slate-400">Ks:</label>
                    <input
                      type="number"
                      min={0}
                      value={item.qty}
                      onChange={(e) => handleItemChange(index, 'qty', parseFloat(e.target.value) || 0)}
                      className="w-12 h-6 text-xs border rounded px-1 text-center"
                    />
                    <span className="text-slate-400 w-14 text-right">{formatCurrency(item.unitPrice)}</span>
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border rounded text-xs">
        <table className="w-full table-fixed">
          <colgroup>
            <col />
            <col className="w-14" />
            <col className="w-14" />
            <col className="w-20" />
            <col className="w-24" />
          </colgroup>
          <thead className="sticky top-[52px] z-20 shadow-sm">
            <tr className="bg-slate-100 text-slate-600">
              <th className="text-left py-1.5 px-2 font-medium">Položka</th>
              <th className="text-center py-1.5 px-1 font-medium">Dny</th>
              <th className="text-center py-1.5 px-1 font-medium">Ks/km</th>
              <th className="text-right py-1.5 px-2 font-medium">Kč/j.</th>
              <th className="text-right py-1.5 px-2 font-medium">Celkem</th>
            </tr>
          </thead>
          <tbody>
            {/* All categories: predefined + custom */}
            {[...OFFER_CATEGORY_ORDER, ...Object.keys(itemsByCategory).filter(c => !(OFFER_CATEGORY_ORDER as readonly string[]).includes(c))].map((category) => {
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
        ↑↓←→ navigace | Enter další řádek | Ctrl+S uložit | Ctrl+F hledat | Nová verze tlačítkem | Auto-save 4s
      </div>

      {/* Load Preset Dialog */}
      {showPresetDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPresetDialog(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-bold text-lg">Načíst šablonu</h3>
              <p className="text-sm text-slate-500 mt-1">Vyberte šablonu pro načtení položek do nabídky</p>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4">
              {loadingPresets ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                </div>
              ) : presetsList.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <BookTemplate className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p>Žádné šablony k dispozici</p>
                  <p className="text-xs mt-1">Vytvořte šablonu v záložce Šablony</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {presetsList.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => loadPreset(preset.id)}
                      className="w-full text-left p-3 border rounded-lg hover:bg-slate-50 hover:border-indigo-300 transition-colors"
                    >
                      <div className="font-medium">{preset.name}</div>
                      {preset.description && (
                        <div className="text-sm text-slate-500 mt-0.5">{preset.description}</div>
                      )}
                      <div className="text-xs text-slate-400 mt-1">{preset.items_count} položek</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <button
                onClick={() => setShowPresetDialog(false)}
                className="w-full h-8 text-sm border rounded hover:bg-slate-50"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version Manager Dialog */}
      {showVersionManager && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowVersionManager(false); setEditingVersionName(null); }}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Správa verzí</h3>
                <p className="text-sm text-slate-500 mt-0.5">Pojmenujte verze pro snadnější orientaci</p>
              </div>
              <button onClick={() => { setShowVersionManager(false); setEditingVersionName(null); }} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] divide-y">
              {versions.map(v => (
                <div key={v.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="text-xs text-slate-400 w-16 shrink-0">
                    Ver. {v.version_number}
                  </div>
                  {editingVersionName?.id === v.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editingVersionName.name}
                        onChange={(e) => setEditingVersionName({ id: v.id, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameVersion(v.id, editingVersionName.name);
                          if (e.key === 'Escape') setEditingVersionName(null);
                        }}
                        placeholder="Název verze..."
                        className="flex-1 h-7 text-xs border rounded px-2 focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <button onClick={() => handleRenameVersion(v.id, editingVersionName.name)} className="p-1 hover:bg-green-50 rounded text-green-600">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingVersionName(null)} className="p-1 hover:bg-slate-100 rounded text-slate-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="flex-1 text-left text-xs hover:bg-slate-50 rounded px-2 py-1 group"
                      onClick={() => setEditingVersionName({ id: v.id, name: v.name || '' })}
                    >
                      {v.name
                        ? <span className="font-medium text-slate-700">{v.name}</span>
                        : <span className="text-slate-400 italic">Klikněte pro pojmenování...</span>
                      }
                    </button>
                  )}
                  <div className="text-xs text-slate-400 shrink-0">
                    {new Date(v.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}
                    {' '}
                    {new Date(v.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t">
              <button onClick={() => { setShowVersionManager(false); setEditingVersionName(null); }} className="w-full h-8 text-sm border rounded hover:bg-slate-50">
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save as Preset Dialog */}
      {showSaveAsPreset && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSaveAsPreset(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-bold text-lg">Uložit jako šablonu</h3>
              <p className="text-sm text-slate-500 mt-1">Uloží aktuální položky nabídky jako novou vzorovou šablonu</p>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Název šablony *</label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="např. Malý festival, Konference 200 lidí..."
                  className="w-full h-9 mt-1 border rounded px-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && presetName.trim()) saveAsPreset(); }}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Popis</label>
                <input
                  type="text"
                  value={presetDescription}
                  onChange={(e) => setPresetDescription(e.target.value)}
                  placeholder="Krátký popis šablony..."
                  className="w-full h-9 mt-1 border rounded px-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="text-xs text-slate-500">
                Bude uloženo {localItems.filter(i => i.qty > 0).length} položek s aktuálními hodnotami.
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowSaveAsPreset(false)}
                className="h-8 px-4 text-sm border rounded hover:bg-slate-50"
              >
                Zrušit
              </button>
              <button
                onClick={saveAsPreset}
                disabled={!presetName.trim() || savingPreset}
                className="h-8 px-4 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
              >
                {savingPreset && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Uložit šablonu
              </button>
            </div>
          </div>
        </div>
      )}
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
          key={item.dbItemId || `${item.templateId}-${index}`}
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
    <tr className={`${odd ? 'bg-slate-50' : 'bg-white'} ${!hasValue ? 'text-slate-400' : ''} hover:bg-blue-100/60 [&:has(:focus)]:bg-blue-100/80`}>
      <td className="py-0.5 px-2 overflow-hidden">
        <div className="truncate" title={item.name}>
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
          onChange={(e) => {
            const raw = e.target.value.replace(',', '.');
            const val = parseFloat(raw);
            onItemChange(index, 'days', isNaN(val) || val <= 0 ? 1 : val);
          }}
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

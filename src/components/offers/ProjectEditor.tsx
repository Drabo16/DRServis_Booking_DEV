'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, FileDown, Save, Plus, Trash2, ChevronDown, ChevronRight, Share2, Layers } from 'lucide-react';
import { toast } from 'sonner';
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

interface ProjectEditorProps {
  projectId: string;
  isAdmin: boolean;
  onBack: () => void;
  onOfferSelect: (id: string) => void;
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

interface ProjectItem {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  unit_price: number;
  quantity: number;
  days_hours: number;
  total_price: number;
}

interface SubOffer {
  id: string;
  offer_number: number;
  year: number;
  title: string;
  set_label: string | null;
  total_amount: number;
  status: OfferStatus;
  subtotal_equipment: number;
  subtotal_personnel: number;
  subtotal_transport: number;
  discount_percent: number;
  discount_amount: number;
}

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  offer_number: number;
  year: number;
  status: OfferStatus;
  discount_percent: number;
  total_amount: number;
  total_equipment: number;
  total_personnel: number;
  total_transport: number;
  total_discount: number;
  notes: string | null;
  offers: SubOffer[];
}

export default function ProjectEditor({ projectId, isAdmin, onBack, onOfferSelect }: ProjectEditorProps) {
  const queryClient = useQueryClient();
  const { startSaving, stopSaving } = useSaveStatus();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [directItems, setDirectItems] = useState<ProjectItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [localDiscount, setLocalDiscount] = useState(0);
  const [localStatus, setLocalStatus] = useState<OfferStatus>('draft');
  const [localIsVatPayer, setLocalIsVatPayer] = useState(true);

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [expandedOffers, setExpandedOffers] = useState<Set<string>>(new Set());
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddCustomItem, setShowAddCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemCategory, setCustomItemCategory] = useState('Ground support');
  const [customItemPrice, setCustomItemPrice] = useState(0);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());

  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const AUTOSAVE_DELAY = 4000; // 4 seconds - longer delay to batch more changes

  // Load data
  const loadData = useCallback(async () => {
    console.log('🔄 Loading project data:', projectId);
    try {
      const [projectRes, itemsRes, templatesRes] = await Promise.all([
        fetch(`/api/offers/sets/${projectId}`, { cache: 'no-store' }),
        fetch(`/api/offers/sets/${projectId}/items`, { cache: 'no-store' }),
        fetch('/api/offers/templates/items', { cache: 'no-store' }),
      ]);

      const projectData = await projectRes.json();
      const itemsData = await itemsRes.json();
      const templatesData = await templatesRes.json();

      console.log('✅ Project loaded:', {
        name: projectData.name,
        offersCount: projectData.offers?.length || 0,
        offers: projectData.offers?.map((o: { offer_number: number; year: number }) => `${o.offer_number}/${o.year}`) || []
      });

      setProject(projectData);
      setDirectItems(itemsData || []);
      setTemplates(templatesData || []);
      setLocalStatus(projectData.status || 'draft');
      setLocalDiscount(projectData.discount_percent || 0);
      setLocalIsVatPayer(projectData.is_vat_payer ?? true);
      setLoading(false);
    } catch (e) {
      console.error('❌ Load failed:', e);
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();

    // Listen for offer set updates from other components
    const handleOfferSetUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      console.log('📨 ProjectEditor received event:', {
        eventSetId: customEvent.detail?.setId,
        myProjectId: projectId,
        willReload: customEvent.detail?.setId === projectId
      });

      if (customEvent.detail?.setId === projectId) {
        console.log('🔄 Reloading project data...');
        loadData();
      }
    };

    window.addEventListener('offerSetUpdated', handleOfferSetUpdate);
    return () => {
      window.removeEventListener('offerSetUpdated', handleOfferSetUpdate);
    };
  }, [loadData, projectId]);

  const saveChanges = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    startSaving('Ukládám projekt...');

    try {
      await fetch(`/api/offers/sets/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: localStatus,
          discount_percent: localDiscount,
          is_vat_payer: localIsVatPayer,
        }),
      });

      queryClient.invalidateQueries({ queryKey: ['offerSets'] });
      setIsDirty(false);
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setIsSaving(false);
      stopSaving();
    }
  }, [projectId, localStatus, localDiscount, localIsVatPayer, isSaving, queryClient, startSaving, stopSaving]);

  const markDirty = useCallback(() => {
    setIsDirty(true);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveChanges();
    }, AUTOSAVE_DELAY);
  }, [saveChanges]);

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

  const handleDownloadPdf = useCallback(async () => {
    if (isDirty) await saveChanges();
    setIsDownloadingPdf(true);
    try {
      const response = await fetch(`/api/offers/sets/${projectId}/pdf`);
      if (!response.ok) throw new Error('Failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nabidka-${project?.offer_number || 1}-${project?.year || new Date().getFullYear()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('PDF download failed:', e);
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [projectId, project, isDirty, saveChanges]);

  const handleAddItem = useCallback(async (templateId: string) => {
    console.log('📦 Adding item from template:', templateId);
    try {
      const res = await fetch(`/api/offers/sets/${projectId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_item_id: templateId, quantity: 1, days_hours: 1 }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Add item failed:', res.status, errorData);
        toast.error(`Chyba při přidání položky: ${errorData.error || 'Neznámá chyba'}`);
        return;
      }

      const data = await res.json();
      console.log('✅ Item added:', data);

      if (data.item) {
        setDirectItems(prev => [...prev, data.item]);
        setShowAddItem(false);
        queryClient.invalidateQueries({ queryKey: ['offerSets'] });
      } else {
        console.error('❌ No item in response:', data);
        toast.error('Chyba: položka nebyla vrácena ze serveru');
      }
    } catch (e) {
      console.error('❌ Add item exception:', e);
      toast.error('Chyba při přidání položky: ' + (e instanceof Error ? e.message : 'Neznámá chyba'));
    }
  }, [projectId, queryClient]);

  const handleAddMultipleItems = useCallback(async () => {
    if (selectedTemplateIds.size === 0) return;

    console.log('📦 Adding multiple items:', Array.from(selectedTemplateIds));
    try {
      // Prepare items array for batch insert
      const itemsToAdd = Array.from(selectedTemplateIds).map(templateId => {
        const template = templates.find(t => t.id === templateId);
        return {
          template_item_id: templateId,
          name: template?.name || '',
          category: template?.category?.name || 'Ostatní',
          subcategory: template?.subcategory || null,
          unit: template?.unit || 'ks',
          unit_price: template?.default_price || 0,
          quantity: 1,
          days_hours: 1,
          sort_order: template?.sort_order || 0,
        };
      });

      const res = await fetch(`/api/offers/sets/${projectId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToAdd }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Add multiple items failed:', res.status, errorData);
        toast.error(`Chyba při přidání položek: ${errorData.error || 'Neznámá chyba'}`);
        return;
      }

      const data = await res.json();
      console.log('✅ Items added:', data);

      if (data.items && Array.isArray(data.items)) {
        setDirectItems(prev => [...prev, ...data.items]);
        setShowAddItem(false);
        setSelectedTemplateIds(new Set());
        queryClient.invalidateQueries({ queryKey: ['offerSets'] });
      } else {
        console.error('❌ No items in response:', data);
        toast.error('Chyba: položky nebyly vráceny ze serveru');
      }
    } catch (e) {
      console.error('❌ Add multiple items exception:', e);
      toast.error('Chyba při přidání položek: ' + (e instanceof Error ? e.message : 'Neznámá chyba'));
    }
  }, [projectId, selectedTemplateIds, templates, queryClient]);

  const handleUpdateItem = useCallback(async (itemId: string, field: 'quantity' | 'days_hours' | 'unit_price', value: number) => {
    // Optimistic update
    setDirectItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newItem = { ...item, [field]: value };
      newItem.total_price = newItem.quantity * newItem.days_hours * newItem.unit_price;
      return newItem;
    }));

    try {
      await fetch(`/api/offers/sets/${projectId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, [field]: value }),
      });
      queryClient.invalidateQueries({ queryKey: ['offerSets'] });
    } catch (e) {
      console.error('Update item failed:', e);
    }
  }, [projectId, queryClient]);

  const handleAddCustomItem = useCallback(async () => {
    if (!customItemName.trim()) return;

    console.log('🎨 Adding custom item:', customItemName);
    try {
      const res = await fetch(`/api/offers/sets/${projectId}/items`, {
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

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Add custom item failed:', res.status, errorData);
        toast.error(`Chyba při přidání položky: ${errorData.error || 'Neznámá chyba'}`);
        return;
      }

      const data = await res.json();
      console.log('✅ Custom item added:', data);

      if (data.item) {
        setDirectItems(prev => [...prev, data.item]);
        setShowAddCustomItem(false);
        setCustomItemName('');
        setCustomItemPrice(0);
        queryClient.invalidateQueries({ queryKey: ['offerSets'] });
      }
    } catch (e) {
      console.error('❌ Add custom item exception:', e);
      toast.error('Chyba při přidání položky: ' + (e instanceof Error ? e.message : 'Neznámá chyba'));
    }
  }, [projectId, customItemName, customItemCategory, customItemPrice, queryClient]);

  const handleDeleteItem = useCallback(async (itemId: string) => {
    console.log('🗑️ Deleting item:', itemId);
    setDirectItems(prev => prev.filter(item => item.id !== itemId));
    try {
      const res = await fetch(`/api/offers/sets/${projectId}/items?item_id=${itemId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Delete item failed:', res.status, errorData);
      } else {
        console.log('✅ Item deleted');
      }
      queryClient.invalidateQueries({ queryKey: ['offerSets'] });
    } catch (e) {
      console.error('❌ Delete item exception:', e);
    }
  }, [projectId, queryClient]);

  const toggleOffer = useCallback((id: string) => {
    setExpandedOffers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Calculate totals - OPTIMIZED: memoized to avoid recalculation on every render
  const directItemsTotals = useMemo(() => {
    return directItems.reduce(
      (acc, item) => {
        const group = getCategoryGroup(item.category);
        // Use the database-calculated total_price (generated column)
        const total = item.total_price;
        if (group === 'equipment') acc.equipment += total;
        else if (group === 'personnel') acc.personnel += total;
        else acc.transport += total;
        return acc;
      },
      { equipment: 0, personnel: 0, transport: 0 }
    );
  }, [directItems]);

  const offersTotals = useMemo(() => {
    return (project?.offers || []).reduce(
      (acc, offer) => ({
        equipment: acc.equipment + (offer.subtotal_equipment || 0),
        personnel: acc.personnel + (offer.subtotal_personnel || 0),
        transport: acc.transport + (offer.subtotal_transport || 0),
        discount: acc.discount + (offer.discount_amount || 0),
      }),
      { equipment: 0, personnel: 0, transport: 0, discount: 0 }
    );
  }, [project?.offers]);

  const totalEquipment = useMemo(() => offersTotals.equipment + directItemsTotals.equipment, [offersTotals.equipment, directItemsTotals.equipment]);
  const totalPersonnel = useMemo(() => offersTotals.personnel + directItemsTotals.personnel, [offersTotals.personnel, directItemsTotals.personnel]);
  const totalTransport = useMemo(() => offersTotals.transport + directItemsTotals.transport, [offersTotals.transport, directItemsTotals.transport]);
  const projectDiscountAmount = useMemo(() => Math.round(totalEquipment * (localDiscount / 100)), [totalEquipment, localDiscount]);
  const totalDiscount = useMemo(() => offersTotals.discount + projectDiscountAmount, [offersTotals.discount, projectDiscountAmount]);
  const grandTotal = useMemo(() => totalEquipment + totalPersonnel + totalTransport - totalDiscount, [totalEquipment, totalPersonnel, totalTransport, totalDiscount]);

  // Group direct items by category - OPTIMIZED: memoized to avoid recalculation
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, ProjectItem[]> = {};
    directItems.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });
    return grouped;
  }, [directItems]);

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">
                {formatOfferNumber(project.offer_number || 1, project.year || new Date().getFullYear())}
              </span>
              <span className="text-slate-400 text-sm">-</span>
              <span className="text-slate-600 text-sm">{project.name}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge className={`text-xs ${OFFER_STATUS_COLORS[localStatus]}`}>
                {OFFER_STATUS_LABELS[localStatus]}
              </Badge>
              <span className="text-xs text-slate-500">
                {project.offers?.length || 0} podnabídek
              </span>
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
          <label className="flex items-center gap-1.5 cursor-pointer mr-2">
            <input
              type="checkbox"
              checked={localIsVatPayer}
              onChange={(e) => { setLocalIsVatPayer(e.target.checked); markDirty(); }}
              className="w-4 h-4"
            />
            <span className="text-xs text-slate-600">Plátce DPH</span>
          </label>
          <select
            value={localStatus}
            onChange={(e) => { setLocalStatus(e.target.value as OfferStatus); markDirty(); }}
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

      {/* Direct Items Section */}
      <div className="border-2 border-blue-300 rounded-lg shadow-sm">
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-t-md">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            <span className="font-semibold text-sm">Společné položky</span>
            <span className="text-blue-200 text-xs">(sdílené pro všechny stages)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="h-6 text-xs"
              onClick={() => { setShowAddCustomItem(!showAddCustomItem); setShowAddItem(false); }}
            >
              <Plus className="w-3 h-3 mr-1" />
              Vlastní
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-6 text-xs"
              onClick={() => {
                setShowAddItem(!showAddItem);
                setShowAddCustomItem(false);
                setSelectedTemplateIds(new Set()); // Clear selection when opening
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              Z ceníku
            </Button>
          </div>
        </div>

        {showAddCustomItem && (
          <div className="p-3 bg-amber-50 border-b">
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
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleAddCustomItem}
                disabled={!customItemName.trim()}
              >
                Přidat
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setShowAddCustomItem(false)}
              >
                Zrušit
              </Button>
            </div>
          </div>
        )}

        {showAddItem && (
          <div className="p-3 bg-slate-50 border-b">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-slate-600">Vyberte položky z ceníku:</div>
              {selectedTemplateIds.size > 0 && (
                <Button
                  size="sm"
                  className="h-6 text-xs"
                  onClick={handleAddMultipleItems}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Přidat vybrané ({selectedTemplateIds.size})
                </Button>
              )}
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {templates.map(t => (
                <label
                  key={t.id}
                  className="w-full flex items-center gap-2 p-2 hover:bg-slate-100 rounded text-xs cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTemplateIds.has(t.id)}
                    onChange={(e) => {
                      const newSet = new Set(selectedTemplateIds);
                      if (e.target.checked) {
                        newSet.add(t.id);
                      } else {
                        newSet.delete(t.id);
                      }
                      setSelectedTemplateIds(newSet);
                    }}
                    className="w-3.5 h-3.5"
                  />
                  <span className="flex-1">{t.name}</span>
                  <span className="text-slate-500">{formatCurrency(t.default_price)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {directItems.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-400">
            Žádné společné položky
          </div>
        ) : (
          <div className="text-xs">
            {OFFER_CATEGORY_ORDER.map(category => {
              const items = itemsByCategory[category];
              if (!items || items.length === 0) return null;
              const catTotal = items.reduce((sum, i) => sum + i.quantity * i.days_hours * i.unit_price, 0);

              return (
                <div key={category}>
                  <div className="bg-slate-700 text-white px-3 py-1.5 flex justify-between">
                    <span className="font-medium">{category}</span>
                    <span>{formatCurrency(catTotal)}</span>
                  </div>
                  {items.map((item, idx) => (
                    <div key={item.id} className={`flex items-center gap-2 px-3 py-1.5 ${idx % 2 ? 'bg-slate-50' : ''}`}>
                      <span className="flex-1 truncate" title={item.name}>{item.name}</span>
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={item.days_hours}
                        onChange={(e) => handleUpdateItem(item.id, 'days_hours', parseFloat(e.target.value) || 1)}
                        className="w-12 h-6 text-center border rounded"
                        title="Dny"
                      />
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-12 h-6 text-center border rounded"
                        title="Množství"
                      />
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={item.unit_price}
                        onChange={(e) => handleUpdateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-16 h-6 text-right border rounded pr-1"
                        title="Cena za jednotku"
                      />
                      <span className="w-20 text-right font-medium">{formatCurrency(item.quantity * item.days_hours * item.unit_price)}</span>
                      <button onClick={() => handleDeleteItem(item.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sub-offers / Stages */}
      <div className="border-2 border-amber-300 rounded-lg shadow-sm">
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-500 to-amber-400 text-white rounded-t-md">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span className="font-semibold text-sm">Stages / Podnabídky</span>
            <span className="text-amber-100 text-xs">({project.offers?.length || 0} stages)</span>
          </div>
        </div>
        {(!project.offers || project.offers.length === 0) ? (
          <div className="p-4 text-center text-sm text-slate-400">
            Žádné podnabídky - přiřaďte nabídky z editoru nabídky
          </div>
        ) : (
          <div className="divide-y divide-amber-100">
            {project.offers.map(offer => (
              <div key={offer.id} className="bg-amber-50/30">
                <div
                  className="flex items-center justify-between p-3 hover:bg-amber-50 cursor-pointer"
                  onClick={() => toggleOffer(offer.id)}
                >
                  <div className="flex items-center gap-2">
                    {expandedOffers.has(offer.id) ? (
                      <ChevronDown className="w-4 h-4 text-amber-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-amber-500" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-amber-900">
                        {offer.set_label || formatOfferNumber(offer.offer_number, offer.year)}
                      </div>
                      <div className="text-xs text-slate-500">{offer.title}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs ${OFFER_STATUS_COLORS[offer.status]}`}>
                      {OFFER_STATUS_LABELS[offer.status]}
                    </Badge>
                    <span className="font-semibold text-sm text-amber-800">{formatCurrency(offer.total_amount)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs border-amber-300 hover:bg-amber-100"
                      onClick={(e) => { e.stopPropagation(); onOfferSelect(offer.id); }}
                    >
                      Upravit
                    </Button>
                  </div>
                </div>
                {expandedOffers.has(offer.id) && (
                  <div className="px-8 pb-3 text-xs text-slate-600 grid grid-cols-4 gap-2 bg-amber-50/50">
                    <div>Technika: {formatCurrency(offer.subtotal_equipment)}</div>
                    <div>Personál: {formatCurrency(offer.subtotal_personnel)}</div>
                    <div>Doprava: {formatCurrency(offer.subtotal_transport)}</div>
                    {offer.discount_amount > 0 && (
                      <div className="text-green-600">Sleva: -{formatCurrency(offer.discount_amount)}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary - Like offer format */}
      <div className="border rounded overflow-hidden text-xs">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="text-left py-1.5 px-2 font-medium">Položka</th>
              <th className="text-right py-1.5 px-2 font-medium w-24">Technika</th>
              <th className="text-right py-1.5 px-2 font-medium w-24">Personál</th>
              <th className="text-right py-1.5 px-2 font-medium w-24">Doprava</th>
              <th className="text-right py-1.5 px-2 font-medium w-24">Celkem</th>
            </tr>
          </thead>
          <tbody>
            {/* Stages (sub-offers) */}
            {project.offers && project.offers.map((offer) => (
              <Fragment key={offer.id}>
                <tr className="bg-slate-700 text-white">
                  <td colSpan={4} className="py-1.5 px-2 font-medium">
                    {offer.set_label || formatOfferNumber(offer.offer_number, offer.year)}
                    {offer.title && <span className="text-slate-300 ml-2">- {offer.title}</span>}
                  </td>
                  <td className="py-1.5 px-2 text-right font-medium">{formatCurrency(offer.total_amount)}</td>
                </tr>
                <tr className="bg-white">
                  <td className="py-1 px-4 text-slate-600">Technika</td>
                  <td className="py-1 px-2 text-right">{formatCurrency(offer.subtotal_equipment)}</td>
                  <td className="py-1 px-2 text-right">-</td>
                  <td className="py-1 px-2 text-right">-</td>
                  <td className="py-1 px-2 text-right">{formatCurrency(offer.subtotal_equipment)}</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="py-1 px-4 text-slate-600">Personál</td>
                  <td className="py-1 px-2 text-right">-</td>
                  <td className="py-1 px-2 text-right">{formatCurrency(offer.subtotal_personnel)}</td>
                  <td className="py-1 px-2 text-right">-</td>
                  <td className="py-1 px-2 text-right">{formatCurrency(offer.subtotal_personnel)}</td>
                </tr>
                <tr className="bg-white">
                  <td className="py-1 px-4 text-slate-600">Doprava</td>
                  <td className="py-1 px-2 text-right">-</td>
                  <td className="py-1 px-2 text-right">-</td>
                  <td className="py-1 px-2 text-right">{formatCurrency(offer.subtotal_transport)}</td>
                  <td className="py-1 px-2 text-right">{formatCurrency(offer.subtotal_transport)}</td>
                </tr>
                {offer.discount_amount > 0 && (
                  <tr className="bg-green-50">
                    <td className="py-1 px-4 text-green-700">Sleva ({offer.discount_percent}%)</td>
                    <td colSpan={3}></td>
                    <td className="py-1 px-2 text-right text-green-700">-{formatCurrency(offer.discount_amount)}</td>
                  </tr>
                )}
              </Fragment>
            ))}

            {/* Direct items (Společné položky) */}
            {directItems.length > 0 && (
              <>
                <tr className="bg-blue-600 text-white">
                  <td colSpan={4} className="py-1.5 px-2 font-medium">Společné položky</td>
                  <td className="py-1.5 px-2 text-right font-medium">
                    {formatCurrency(directItemsTotals.equipment + directItemsTotals.personnel + directItemsTotals.transport)}
                  </td>
                </tr>
                {directItemsTotals.equipment > 0 && (
                  <tr className="bg-blue-50">
                    <td className="py-1 px-4 text-slate-600">Technika</td>
                    <td className="py-1 px-2 text-right">{formatCurrency(directItemsTotals.equipment)}</td>
                    <td className="py-1 px-2 text-right">-</td>
                    <td className="py-1 px-2 text-right">-</td>
                    <td className="py-1 px-2 text-right">{formatCurrency(directItemsTotals.equipment)}</td>
                  </tr>
                )}
                {directItemsTotals.personnel > 0 && (
                  <tr className="bg-white">
                    <td className="py-1 px-4 text-slate-600">Personál</td>
                    <td className="py-1 px-2 text-right">-</td>
                    <td className="py-1 px-2 text-right">{formatCurrency(directItemsTotals.personnel)}</td>
                    <td className="py-1 px-2 text-right">-</td>
                    <td className="py-1 px-2 text-right">{formatCurrency(directItemsTotals.personnel)}</td>
                  </tr>
                )}
                {directItemsTotals.transport > 0 && (
                  <tr className="bg-blue-50">
                    <td className="py-1 px-4 text-slate-600">Doprava</td>
                    <td className="py-1 px-2 text-right">-</td>
                    <td className="py-1 px-2 text-right">-</td>
                    <td className="py-1 px-2 text-right">{formatCurrency(directItemsTotals.transport)}</td>
                    <td className="py-1 px-2 text-right">{formatCurrency(directItemsTotals.transport)}</td>
                  </tr>
                )}
              </>
            )}

            {/* Subtotals */}
            <tr className="bg-slate-200 font-medium border-t-2 border-slate-400">
              <td className="py-1.5 px-2">Mezisoučet</td>
              <td className="py-1.5 px-2 text-right">{formatCurrency(totalEquipment)}</td>
              <td className="py-1.5 px-2 text-right">{formatCurrency(totalPersonnel)}</td>
              <td className="py-1.5 px-2 text-right">{formatCurrency(totalTransport)}</td>
              <td className="py-1.5 px-2 text-right">{formatCurrency(totalEquipment + totalPersonnel + totalTransport)}</td>
            </tr>

            {/* Discount */}
            <tr className="bg-white">
              <td className="py-1.5 px-2 flex items-center gap-1">
                Sleva na projekt
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={localDiscount}
                  onChange={(e) => { setLocalDiscount(parseFloat(e.target.value) || 0); markDirty(); }}
                  className="w-10 h-5 text-center text-xs border rounded px-1"
                />
                %
              </td>
              <td colSpan={3}></td>
              <td className="py-1.5 px-2 text-right font-medium text-green-600">
                {totalDiscount > 0 ? `-${formatCurrency(totalDiscount)}` : '-'}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="bg-slate-700 text-white font-bold">
              <td colSpan={4} className="py-2 px-2">CELKEM BEZ DPH</td>
              <td className="py-2 px-2 text-right text-lg">{formatCurrency(grandTotal)}</td>
            </tr>
            {localIsVatPayer && (
              <tr className="bg-slate-100">
                <td colSpan={3} className="py-2 px-2 text-slate-600">CELKEM S DPH (21%)</td>
                <td className="py-2 px-2 text-right text-slate-500">DPH: {formatCurrency(Math.round(grandTotal * 0.21))}</td>
                <td className="py-2 px-2 text-right font-bold text-lg">{formatCurrency(Math.round(grandTotal * 1.21))}</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {/* Instructions */}
      <div className="text-[10px] text-slate-400 text-center">
        Ctrl+S uložit | Auto-save 4s
      </div>
    </div>
  );
}

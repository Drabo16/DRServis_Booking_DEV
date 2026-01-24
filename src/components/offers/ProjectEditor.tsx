'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, FileDown, Save, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
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

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [expandedOffers, setExpandedOffers] = useState<Set<string>>(new Set());
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddCustomItem, setShowAddCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemCategory, setCustomItemCategory] = useState('Ground support');
  const [customItemPrice, setCustomItemPrice] = useState(0);

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
        offers: projectData.offers?.map((o: any) => `${o.offer_number}/${o.year}`) || []
      });

      setProject(projectData);
      setDirectItems(itemsData || []);
      setTemplates(templatesData || []);
      setLocalStatus(projectData.status || 'draft');
      setLocalDiscount(projectData.discount_percent || 0);
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

  const markDirty = useCallback(() => {
    setIsDirty(true);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveChanges();
    }, AUTOSAVE_DELAY);
  }, []);

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
  }, [projectId, localStatus, localDiscount, isSaving, queryClient, startSaving, stopSaving]);

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
    try {
      const res = await fetch(`/api/offers/sets/${projectId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_item_id: templateId, quantity: 1, days_hours: 1 }),
      });
      if (res.ok) {
        const { item } = await res.json();
        setDirectItems(prev => [...prev, item]);
        setShowAddItem(false);
        queryClient.invalidateQueries({ queryKey: ['offerSets'] });
      }
    } catch (e) {
      console.error('Add item failed:', e);
    }
  }, [projectId, queryClient]);

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
      if (res.ok) {
        const { item } = await res.json();
        setDirectItems(prev => [...prev, item]);
        setShowAddCustomItem(false);
        setCustomItemName('');
        setCustomItemPrice(0);
        queryClient.invalidateQueries({ queryKey: ['offerSets'] });
      }
    } catch (e) {
      console.error('Add custom item failed:', e);
    }
  }, [projectId, customItemName, customItemCategory, customItemPrice, queryClient]);

  const handleDeleteItem = useCallback(async (itemId: string) => {
    setDirectItems(prev => prev.filter(item => item.id !== itemId));
    try {
      await fetch(`/api/offers/sets/${projectId}/items?item_id=${itemId}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['offerSets'] });
    } catch (e) {
      console.error('Delete item failed:', e);
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
      <div className="border rounded">
        <div className="flex items-center justify-between p-3 bg-blue-600 text-white">
          <span className="font-medium text-sm">Společné položky</span>
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
              onClick={() => { setShowAddItem(!showAddItem); setShowAddCustomItem(false); }}
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
          <div className="p-3 bg-slate-50 border-b max-h-60 overflow-y-auto">
            <div className="text-xs text-slate-600 mb-2">Vyberte položku z ceníku:</div>
            <div className="space-y-1">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleAddItem(t.id)}
                  className="w-full text-left p-2 hover:bg-slate-100 rounded text-xs flex justify-between"
                >
                  <span>{t.name}</span>
                  <span className="text-slate-500">{formatCurrency(t.default_price)}</span>
                </button>
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
                        min={1}
                        value={item.days_hours}
                        onChange={(e) => handleUpdateItem(item.id, 'days_hours', parseInt(e.target.value) || 1)}
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

      {/* Sub-offers */}
      <div className="border rounded">
        <div className="p-3 bg-slate-100 font-medium text-sm">Podnabídky</div>
        {(!project.offers || project.offers.length === 0) ? (
          <div className="p-4 text-center text-sm text-slate-400">
            Žádné podnabídky - přiřaďte nabídky z editoru nabídky
          </div>
        ) : (
          <div className="divide-y">
            {project.offers.map(offer => (
              <div key={offer.id}>
                <div
                  className="flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer"
                  onClick={() => toggleOffer(offer.id)}
                >
                  <div className="flex items-center gap-2">
                    {expandedOffers.has(offer.id) ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <div>
                      <div className="text-sm font-medium">
                        {offer.set_label || formatOfferNumber(offer.offer_number, offer.year)}
                      </div>
                      <div className="text-xs text-slate-500">{offer.title}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs ${OFFER_STATUS_COLORS[offer.status]}`}>
                      {OFFER_STATUS_LABELS[offer.status]}
                    </Badge>
                    <span className="font-semibold text-sm">{formatCurrency(offer.total_amount)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={(e) => { e.stopPropagation(); onOfferSelect(offer.id); }}
                    >
                      Upravit
                    </Button>
                  </div>
                </div>
                {expandedOffers.has(offer.id) && (
                  <div className="px-8 pb-3 text-xs text-slate-600 grid grid-cols-4 gap-2">
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

      {/* Summary */}
      <div className="bg-slate-50 border rounded p-3 text-xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <div className="text-slate-500 mb-0.5">Technika</div>
            <div className="font-semibold">{formatCurrency(totalEquipment)}</div>
          </div>
          <div>
            <div className="text-slate-500 mb-0.5">Personál</div>
            <div className="font-semibold">{formatCurrency(totalPersonnel)}</div>
          </div>
          <div>
            <div className="text-slate-500 mb-0.5">Doprava</div>
            <div className="font-semibold">{formatCurrency(totalTransport)}</div>
          </div>
          <div>
            <div className="text-slate-500 mb-0.5 flex items-center gap-1">
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
            </div>
            <div className="font-semibold text-green-600">
              {totalDiscount > 0 ? `-${formatCurrency(totalDiscount)}` : '-'}
            </div>
          </div>
        </div>

        {/* Stage breakdown */}
        {project.offers && project.offers.length > 0 && (
          <div className="border-t mt-3 pt-3">
            <div className="text-slate-600 font-medium mb-2">Rozpis stages:</div>
            <div className="space-y-1">
              {project.offers.map(offer => (
                <div key={offer.id} className="flex justify-between items-center text-xs">
                  <span className="text-slate-700">
                    {offer.set_label || formatOfferNumber(offer.offer_number, offer.year)}
                  </span>
                  <span className="font-medium">{formatCurrency(offer.total_amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t mt-3 pt-3 flex justify-between items-center">
          <span className="font-bold">CELKEM BEZ DPH</span>
          <span className="font-bold text-lg">{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-[10px] text-slate-400 text-center">
        Ctrl+S uložit | Auto-save 4s
      </div>
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Loader2,
  FolderKanban,
  ChevronDown,
  ChevronRight,
  FileText,
  Trash2,
  FileDown,
  Edit,
} from 'lucide-react';
import {
  formatOfferNumber,
  formatCurrency,
  OFFER_STATUS_LABELS,
  OFFER_STATUS_COLORS,
  type OfferStatus,
} from '@/types/offers';

interface OfferSet {
  id: string;
  name: string;
  description: string | null;
  event_id: string | null;
  status: OfferStatus;
  total_amount: number;
  created_at: string;
  offers_count?: number;
  offers?: Array<{
    id: string;
    offer_number: number;
    year: number;
    title: string;
    set_label: string | null;
    total_amount: number;
    status: OfferStatus;
  }>;
}

interface OfferSetsManagerProps {
  onOfferSelect: (id: string) => void;
  onProjectSelect: (id: string) => void;
  isAdmin: boolean;
}

export default function OfferSetsManager({ onOfferSelect, onProjectSelect, isAdmin }: OfferSetsManagerProps) {
  const queryClient = useQueryClient();
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  // Fetch offer sets
  const { data: sets, isLoading } = useQuery({
    queryKey: ['offerSets'],
    queryFn: async () => {
      const res = await fetch('/api/offers/sets');
      if (!res.ok) throw new Error('Failed to fetch offer sets');
      return res.json() as Promise<OfferSet[]>;
    },
  });

  // Create offer set mutation
  const createSet = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await fetch('/api/offers/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create offer set');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerSets'] });
      setShowCreateDialog(false);
      setNewSetName('');
      setNewSetDescription('');
    },
  });

  // Delete offer set mutation
  const deleteSet = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/offers/sets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete offer set');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerSets'] });
    },
  });

  const toggleExpand = useCallback((id: string) => {
    setExpandedSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCreateSet = useCallback(() => {
    if (!newSetName.trim()) return;
    createSet.mutate({
      name: newSetName.trim(),
      description: newSetDescription.trim() || undefined,
    });
  }, [newSetName, newSetDescription, createSet]);

  const handleDeleteSet = useCallback((id: string, name: string) => {
    if (confirm(`Opravdu chcete smazat projekt "${name}"? Nabídky v projektu nebudou smazány.`)) {
      deleteSet.mutate(id);
    }
  }, [deleteSet]);

  const handleDownloadPdf = useCallback(async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingPdfId(id);
    try {
      const response = await fetch(`/api/offers/sets/${id}/pdf`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to download PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '-').substring(0, 50);
      link.download = `projekt-${safeName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF download failed:', error);
      alert(error instanceof Error ? error.message : 'Nepodařilo se stáhnout PDF');
    } finally {
      setDownloadingPdfId(null);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Projekty seskupují více nabídek pro jednu akci (např. více stagí)
        </p>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Nový projekt
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nový projekt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="setName">Název projektu *</Label>
                <Input
                  id="setName"
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="např. Festival XY 2026"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setDescription">Popis</Label>
                <Input
                  id="setDescription"
                  value={newSetDescription}
                  onChange={(e) => setNewSetDescription(e.target.value)}
                  placeholder="Volitelný popis projektu"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Zrušit
                </Button>
                <Button
                  onClick={handleCreateSet}
                  disabled={!newSetName.trim() || createSet.isPending}
                >
                  {createSet.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : null}
                  Vytvořit
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sets list */}
      {!sets || sets.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-slate-50">
          <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Zatím nemáte žádné projekty</p>
          <p className="text-sm text-slate-400 mt-1">
            Vytvořte projekt pro seskupení nabídek
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sets.map((set) => {
            const isExpanded = expandedSets.has(set.id);

            return (
              <div key={set.id} className="border rounded-lg overflow-hidden">
                {/* Set header */}
                <div
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                  onClick={() => toggleExpand(set.id)}
                >
                  <div className="flex items-center gap-3">
                    <button className="p-1 hover:bg-slate-200 rounded">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                    <FolderKanban className="w-5 h-5 text-slate-400" />
                    <div>
                      <div className="font-medium text-sm">{set.name}</div>
                      {set.description && (
                        <div className="text-xs text-slate-500">{set.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs ${OFFER_STATUS_COLORS[set.status]}`}>
                      {OFFER_STATUS_LABELS[set.status]}
                    </Badge>
                    <span className="text-sm text-slate-500">
                      {set.offers_count || set.offers?.length || 0} nabídek
                    </span>
                    <span className="font-semibold text-sm">
                      {formatCurrency(set.total_amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        onProjectSelect(set.id);
                      }}
                      title="Upravit nabídku"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                      onClick={(e) => handleDownloadPdf(set.id, set.name, e)}
                      disabled={downloadingPdfId === set.id}
                      title="Stáhnout PDF"
                    >
                      {downloadingPdfId === set.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileDown className="w-4 h-4" />
                      )}
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSet(set.id, set.name);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded offers */}
                {isExpanded && (
                  <div className="border-t">
                    {!set.offers || set.offers.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-400">
                        Tento projekt nemá žádné nabídky
                      </div>
                    ) : (
                      <div className="divide-y">
                        {set.offers.map((offer) => (
                          <div
                            key={offer.id}
                            className="flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer"
                            onClick={() => onOfferSelect(offer.id)}
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-slate-400" />
                              <div>
                                <div className="text-sm font-medium">
                                  {formatOfferNumber(offer.offer_number, offer.year)}
                                  {offer.set_label && (
                                    <span className="ml-2 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                      {offer.set_label}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500">{offer.title}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge className={`text-xs ${OFFER_STATUS_COLORS[offer.status]}`}>
                                {OFFER_STATUS_LABELS[offer.status]}
                              </Badge>
                              <span className="font-semibold text-sm">
                                {formatCurrency(offer.total_amount)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

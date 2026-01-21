'use client';

import { useState, useCallback, useMemo } from 'react';
import { useOffers, useDeleteOffer } from '@/hooks/useOffers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Search,
  FileText,
  Calendar,
  Trash2,
  Copy,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  formatOfferNumber,
  formatCurrency,
  OFFER_STATUS_LABELS,
  OFFER_STATUS_COLORS,
  type OfferStatus,
} from '@/types/offers';

interface OffersListProps {
  onOfferSelect: (id: string) => void;
  isAdmin: boolean;
}

export default function OffersList({ onOfferSelect, isAdmin }: OffersListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  const { data: offers = [], isLoading } = useOffers({
    status: statusFilter !== 'all' ? (statusFilter as OfferStatus) : undefined,
    year: yearFilter !== 'all' ? parseInt(yearFilter) : undefined,
    search: search || undefined,
  });

  const deleteOffer = useDeleteOffer();

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Opravdu chcete smazat tuto nabídku?')) return;
    try {
      await deleteOffer.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete offer:', error);
    }
  }, [deleteOffer]);

  // Get unique years from offers
  const years = useMemo(() => {
    const yearSet = new Set(offers.map(o => o.year));
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [offers]);

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 p-3 bg-slate-50 rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Hledat nabídku..."
            value={search}
            onChange={handleSearchChange}
            className="pl-8 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36 h-9">
            <SelectValue placeholder="Stav" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny stavy</SelectItem>
            <SelectItem value="draft">Koncept</SelectItem>
            <SelectItem value="sent">Odesláno</SelectItem>
            <SelectItem value="accepted">Přijato</SelectItem>
            <SelectItem value="rejected">Odmítnuto</SelectItem>
            <SelectItem value="expired">Vypršelo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-full sm:w-28 h-9">
            <SelectValue placeholder="Rok" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny roky</SelectItem>
            {years.map(year => (
              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Offers grid */}
      {offers.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>Žádné nabídky nenalezeny</p>
          <p className="text-sm mt-1">Vytvořte první nabídku tlačítkem &quot;Nová nabídka&quot;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {offers.map((offer) => (
            <Card
              key={offer.id}
              className="cursor-pointer transition-all hover:shadow-md hover:bg-slate-50"
              onClick={() => onOfferSelect(offer.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-slate-500">
                        #{formatOfferNumber(offer.offer_number, offer.year)}
                      </span>
                      <Badge className={OFFER_STATUS_COLORS[offer.status]}>
                        {OFFER_STATUS_LABELS[offer.status]}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-slate-900 mt-1 truncate">
                      {offer.title}
                    </h3>
                    {offer.event && (
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {offer.event.title}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-lg text-slate-900">
                      {formatCurrency(offer.total_amount)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(offer.created_at)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="text-xs text-slate-500">
                    {offer.items_count} položek
                    {offer.discount_percent > 0 && (
                      <span className="ml-2 text-green-600">
                        -{offer.discount_percent}% sleva
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Implement duplicate
                        }}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplikovat
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={(e) => handleDelete(offer.id, e)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Smazat
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

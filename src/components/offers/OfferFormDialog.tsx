'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCreateOffer } from '@/hooks/useOffers';
import { useEvents } from '@/hooks/useEvents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, X, ChevronDown } from 'lucide-react';

interface OfferFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (offer: { id: string }) => void;
}

interface ClientOption {
  id: string;
  name: string;
  contact_person?: string | null;
}

export default function OfferFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: OfferFormDialogProps) {
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Clients: load with scope=offers so all offers users can see them
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);

  const { data: events = [] } = useEvents();
  const createOffer = useCreateOffer();

  // Load clients when dialog opens
  useEffect(() => {
    if (!open) return;
    fetch('/api/clients?scope=offers')
      .then(r => r.ok ? r.json() : [])
      .then(data => setClients(Array.isArray(data) ? data : []))
      .catch(() => setClients([]));
  }, [open]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.contact_person && c.contact_person.toLowerCase().includes(q))
    );
  }, [clients, clientSearch]);

  const selectedClientName = clients.find(c => c.id === clientId)?.name;

  const handleCreateNewClient = async () => {
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
      const created: ClientOption = { id: data.client.id, name: data.client.name };
      setClients(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'cs')));
      setClientId(data.client.id);
      setNewClientName('');
      setShowCreateClient(false);
    } catch {
      // ignore
    } finally {
      setCreatingClient(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    try {
      const result = await createOffer.mutateAsync({
        title: title.trim(),
        event_id: eventId || undefined,
        client_id: clientId || undefined,
        notes: notes.trim() || undefined,
      });
      onSuccess(result.offer);
    } catch (error) {
      console.error('Failed to create offer:', error);
    }
  };

  // When event is selected, use its title as default
  const handleEventChange = (value: string) => {
    setEventId(value === 'none' ? '' : value);
    if (value && value !== 'none' && !title) {
      const event = events.find(e => e.id === value);
      if (event) {
        setTitle(event.title);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nová nabídka</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event">Akce (nepovinné)</Label>
            <Select value={eventId || 'none'} onValueChange={handleEventChange}>
              <SelectTrigger>
                <SelectValue placeholder="Vyberte akci..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bez akce</SelectItem>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Client selector with search + create */}
          <div className="space-y-2">
            <Label>Klient (nepovinné)</Label>
            <div className="relative">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={clientDropdownOpen ? clientSearch : (selectedClientName || '')}
                  onChange={(e) => { setClientSearch(e.target.value); setClientDropdownOpen(true); }}
                  onFocus={() => { setClientSearch(''); setClientDropdownOpen(true); }}
                  onBlur={() => setTimeout(() => setClientDropdownOpen(false), 150)}
                  placeholder="Vyhledat klienta..."
                  className="flex-1 h-9 border rounded px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setClientDropdownOpen(v => !v)}
                  className="h-9 px-2 border rounded hover:bg-slate-50 text-slate-500"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                {clientId && (
                  <button
                    type="button"
                    onClick={() => { setClientId(''); setClientSearch(''); }}
                    className="h-9 px-2 text-slate-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {clientDropdownOpen && (
                <div className="absolute z-20 top-10 left-0 right-0 bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                  <div className="py-1">
                    <button
                      type="button"
                      onMouseDown={() => { setClientId(''); setClientDropdownOpen(false); setClientSearch(''); }}
                      className="w-full text-left px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-50 italic"
                    >
                      — bez klienta —
                    </button>
                    {filteredClients.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-400">Žádný klient nenalezen</div>
                    ) : (
                      filteredClients.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={() => { setClientId(c.id); setClientDropdownOpen(false); setClientSearch(''); }}
                          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 ${c.id === clientId ? 'bg-blue-50 font-medium' : ''}`}
                        >
                          {c.name}
                          {c.contact_person && <span className="text-slate-400 ml-1 text-xs">({c.contact_person})</span>}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-t py-1">
                    <button
                      type="button"
                      onMouseDown={() => { setShowCreateClient(true); setClientDropdownOpen(false); setClientSearch(''); }}
                      className="w-full text-left px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
                    >
                      + Nový klient
                    </button>
                  </div>
                </div>
              )}
            </div>

            {showCreateClient && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded space-y-2">
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Název klienta *"
                  className="w-full h-8 border rounded px-3 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleCreateNewClient(); }
                    if (e.key === 'Escape') { setShowCreateClient(false); setNewClientName(''); }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateNewClient}
                    disabled={!newClientName.trim() || creatingClient}
                    className="flex-1 h-8 bg-blue-600 text-white rounded text-sm disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {creatingClient && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Vytvořit
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreateClient(false); setNewClientName(''); }}
                    className="h-8 px-3 bg-slate-200 hover:bg-slate-300 rounded text-sm"
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Název nabídky *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="např. Zeelandia, Festival XY..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Poznámky</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Interní poznámky k nabídce..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Zrušit
            </Button>
            <Button type="submit" disabled={!title.trim() || createOffer.isPending}>
              {createOffer.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Vytvořit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

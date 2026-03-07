'use client';

import { useState, useMemo } from 'react';
import { useClients, useClient, useCreateClient, useUpdateClient, useDeleteClient } from '@/hooks/useClients';
import { Search, Plus, Pencil, Trash2, Loader2, Building2, Phone, Mail, User, FileText, X } from 'lucide-react';
import type { Client } from '@/types/clients';
import { toast } from 'sonner';

interface ClientsPageProps {
  isAdmin: boolean;
}

export default function ClientsPage({ isAdmin }: ClientsPageProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formIco, setFormIco] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');

  const { data: clients, isLoading } = useClients(search || undefined);
  const { data: clientDetail } = useClient(selectedId);
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const deleteMutation = useDeleteClient();

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!search.trim()) return clients;
    const terms = search.toLowerCase().split(/\s+/);
    return clients.filter(c => {
      const searchable = [c.name, c.ico, c.contact_person, c.email, c.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return terms.every(term => searchable.includes(term));
    });
  }, [clients, search]);

  const openCreateForm = () => {
    setEditingClient(null);
    setFormName('');
    setFormIco('');
    setFormContact('');
    setFormEmail('');
    setFormPhone('');
    setShowForm(true);
  };

  const openEditForm = (client: Client) => {
    setEditingClient(client);
    setFormName(client.name);
    setFormIco(client.ico || '');
    setFormContact(client.contact_person || '');
    setFormEmail(client.email || '');
    setFormPhone(client.phone || '');
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error('Název klienta je povinný.');
      return;
    }

    const data = {
      name: formName.trim(),
      ico: formIco.trim() || undefined,
      contact_person: formContact.trim() || undefined,
      email: formEmail.trim() || undefined,
      phone: formPhone.trim() || undefined,
    };

    if (editingClient) {
      await updateMutation.mutateAsync({ id: editingClient.id, ...data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setShowForm(false);
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`Opravdu smazat klienta "${client.name}"? Tato akce je nevratná.`)) return;
    await deleteMutation.mutateAsync(client.id);
    if (selectedId === client.id) setSelectedId(null);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Client list */}
      <div className="lg:w-1/2 xl:w-2/5 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-900">Klienti</h1>
          <button
            onClick={openCreateForm}
            className="h-8 px-3 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Nový klient
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat klienty..."
            className="w-full h-9 pl-9 pr-3 text-sm border rounded-md"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            {search ? 'Žádní klienti nenalezeni.' : 'Zatím žádní klienti. Vytvořte prvního.'}
          </div>
        ) : (
          <div className="space-y-1 overflow-y-auto flex-1">
            {filteredClients.map(client => (
              <div
                key={client.id}
                onClick={() => setSelectedId(client.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedId === client.id
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-slate-900 truncate">{client.name}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      {client.ico && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {client.ico}
                        </span>
                      )}
                      {client.contact_person && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {client.contact_person}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditForm(client); }}
                      className="p-1 hover:bg-slate-200 rounded"
                      title="Upravit"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(client); }}
                      className="p-1 hover:bg-red-100 rounded"
                      title="Smazat"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Client detail / form */}
      <div className="lg:w-1/2 xl:w-3/5">
        {showForm ? (
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editingClient ? 'Upravit klienta' : 'Nový klient'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Název *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-9 px-3 text-sm border rounded-md"
                  placeholder="Název firmy / klienta"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">IČO</label>
                  <input
                    type="text"
                    value={formIco}
                    onChange={(e) => setFormIco(e.target.value)}
                    className="w-full h-9 px-3 text-sm border rounded-md"
                    placeholder="12345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kontaktní osoba</label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    className="w-full h-9 px-3 text-sm border rounded-md"
                    placeholder="Jméno a příjmení"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full h-9 px-3 text-sm border rounded-md"
                    placeholder="email@firma.cz"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full h-9 px-3 text-sm border rounded-md"
                    placeholder="+420 123 456 789"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="h-9 px-4 text-sm border rounded-md hover:bg-slate-50"
                >
                  Zrušit
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 flex items-center gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {editingClient ? 'Uložit' : 'Vytvořit'}
                </button>
              </div>
            </div>
          </div>
        ) : selectedId && clientDetail ? (
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{clientDetail.name}</h2>
              <button
                onClick={() => setSelectedId(null)}
                className="p-1 hover:bg-slate-100 rounded lg:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {clientDetail.ico && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="text-slate-500 text-xs">IČO</div>
                    <div className="font-medium">{clientDetail.ico}</div>
                  </div>
                </div>
              )}
              {clientDetail.contact_person && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="text-slate-500 text-xs">Kontaktní osoba</div>
                    <div className="font-medium">{clientDetail.contact_person}</div>
                  </div>
                </div>
              )}
              {clientDetail.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="text-slate-500 text-xs">Email</div>
                    <a href={`mailto:${clientDetail.email}`} className="font-medium text-blue-600 hover:underline">
                      {clientDetail.email}
                    </a>
                  </div>
                </div>
              )}
              {clientDetail.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="text-slate-500 text-xs">Telefon</div>
                    <a href={`tel:${clientDetail.phone}`} className="font-medium text-blue-600 hover:underline">
                      {clientDetail.phone}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Statistiky nabídek
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-slate-900">{clientDetail.offers_count}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Celkem nabídek</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{clientDetail.accepted_count}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Přijatých</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-700">{formatCurrency(clientDetail.total_revenue)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Obrat</div>
                </div>
              </div>
              {clientDetail.offers_count > 0 && clientDetail.accepted_count > 0 && (
                <div className="mt-2 text-xs text-slate-500 text-center">
                  Úspěšnost: {Math.round((clientDetail.accepted_count / clientDetail.offers_count) * 100)}%
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-dashed rounded-lg p-8 text-center text-slate-500 text-sm">
            Vyberte klienta ze seznamu nebo vytvořte nového.
          </div>
        )}
      </div>
    </div>
  );
}

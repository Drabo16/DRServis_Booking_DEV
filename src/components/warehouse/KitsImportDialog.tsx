'use client';

import { useState, useRef } from 'react';
import { useCreateWarehouseKit, useWarehouseItems } from '@/hooks/useWarehouse';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, FileSpreadsheet, Check, X, AlertCircle, Package } from 'lucide-react';

interface KitsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ParsedKit {
  name: string;
  items: { name: string; quantity: number }[];
  selected: boolean;
  status: 'pending' | 'importing' | 'success' | 'error';
  error?: string;
}

export default function KitsImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: KitsImportDialogProps) {
  const createKit = useCreateWarehouseKit();
  const { data: existingItems = [] } = useWarehouseItems();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedKits, setParsedKits] = useState<ParsedKit[]>([]);
  const [rawText, setRawText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Parse format: Kit name | item1 x qty, item2 x qty, ...
  const parseCSV = (text: string): ParsedKit[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const kits: ParsedKit[] = [];

    for (const line of lines) {
      // Skip header
      if (line.toLowerCase().includes('název') || line.toLowerCase().includes('name')) {
        continue;
      }

      // Try different separators for kit name vs items: | or tab
      let kitName = '';
      let itemsStr = '';

      if (line.includes('|')) {
        const parts = line.split('|');
        kitName = parts[0]?.trim();
        itemsStr = parts[1]?.trim() || '';
      } else if (line.includes('\t')) {
        const parts = line.split('\t');
        kitName = parts[0]?.trim();
        itemsStr = parts[1]?.trim() || '';
      } else {
        // Single column - just kit name
        kitName = line.trim();
      }

      if (!kitName) continue;

      // Parse items: "item1 x 2, item2 x 3" or "item1 2, item2 3"
      const items: { name: string; quantity: number }[] = [];
      if (itemsStr) {
        const itemParts = itemsStr.split(',').map(s => s.trim()).filter(Boolean);
        for (const itemPart of itemParts) {
          // Try "item x qty" or "item qty"
          let itemName = itemPart;
          let quantity = 1;

          const xMatch = itemPart.match(/^(.+?)\s*[xX]\s*(\d+)$/);
          if (xMatch) {
            itemName = xMatch[1].trim();
            quantity = parseInt(xMatch[2]) || 1;
          } else {
            const spaceMatch = itemPart.match(/^(.+?)\s+(\d+)$/);
            if (spaceMatch) {
              itemName = spaceMatch[1].trim();
              quantity = parseInt(spaceMatch[2]) || 1;
            }
          }

          items.push({ name: itemName, quantity });
        }
      }

      kits.push({
        name: kitName,
        items,
        selected: true,
        status: 'pending',
      });
    }

    return kits;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawText(text);
      const kits = parseCSV(text);
      setParsedKits(kits);
      setError(null);
    };
    reader.onerror = () => {
      setError('Nepodařilo se načíst soubor');
    };
    reader.readAsText(file);
  };

  const handleTextPaste = (text: string) => {
    setRawText(text);
    const kits = parseCSV(text);
    setParsedKits(kits);
    setError(null);
  };

  const toggleKit = (index: number) => {
    setParsedKits(prev => prev.map((kit, i) =>
      i === index ? { ...kit, selected: !kit.selected } : kit
    ));
  };

  const toggleAll = () => {
    const allSelected = parsedKits.every(kit => kit.selected);
    setParsedKits(prev => prev.map(kit => ({ ...kit, selected: !allSelected })));
  };

  // Find matching item ID from existing items
  const findItemId = (itemName: string): string | null => {
    const lowerName = itemName.toLowerCase();
    const match = existingItems.find(item =>
      item.name.toLowerCase() === lowerName ||
      item.name.toLowerCase().includes(lowerName) ||
      lowerName.includes(item.name.toLowerCase())
    );
    return match?.id || null;
  };

  const handleImport = async () => {
    const kitsToImport = parsedKits.filter(kit => kit.selected && kit.status === 'pending');
    if (kitsToImport.length === 0) {
      setError('Vyberte alespoň jeden set k importu');
      return;
    }

    setIsImporting(true);
    setImportProgress({ done: 0, total: kitsToImport.length });
    setError(null);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < parsedKits.length; i++) {
      const kit = parsedKits[i];
      if (!kit.selected || kit.status !== 'pending') continue;

      setParsedKits(prev => prev.map((p, idx) =>
        idx === i ? { ...p, status: 'importing' } : p
      ));

      try {
        // Map item names to IDs
        const kitItems: { item_id: string; quantity: number }[] = [];
        const unmatchedItems: string[] = [];

        for (const item of kit.items) {
          const itemId = findItemId(item.name);
          if (itemId) {
            kitItems.push({ item_id: itemId, quantity: item.quantity });
          } else {
            unmatchedItems.push(item.name);
          }
        }

        if (unmatchedItems.length > 0) {
          throw new Error(`Materiály nenalezeny: ${unmatchedItems.join(', ')}`);
        }

        await createKit.mutateAsync({
          name: kit.name,
          items: kitItems,
        });

        successCount++;
        setParsedKits(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'success' } : p
        ));
      } catch (err) {
        errorCount++;
        setParsedKits(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'error', error: err instanceof Error ? err.message : 'Chyba' } : p
        ));
      }

      setImportProgress({ done: successCount + errorCount, total: kitsToImport.length });
    }

    setIsImporting(false);

    if (successCount > 0) {
      onSuccess?.();
    }

    if (errorCount === 0 && successCount > 0) {
      setTimeout(() => {
        onOpenChange(false);
        resetForm();
      }, 1500);
    }
  };

  const resetForm = () => {
    setParsedKits([]);
    setRawText('');
    setError(null);
    setImportProgress({ done: 0, total: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const selectedCount = parsedKits.filter(kit => kit.selected && kit.status === 'pending').length;
  const successCount = parsedKits.filter(kit => kit.status === 'success').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import setů
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {parsedKits.length === 0 ? (
            <>
              <div className="space-y-2">
                <Label>Nahrát CSV soubor</Label>
                <div className="flex gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,.tsv"
                    onChange={handleFileUpload}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="text-center text-slate-400 text-sm">nebo</div>

              <div className="space-y-2">
                <Label>Vložit data</Label>
                <Textarea
                  value={rawText}
                  onChange={(e) => handleTextPaste(e.target.value)}
                  rows={8}
                  placeholder="Formát: Název setu | materiál x počet, materiál x počet

Příklad:
Podium komplet | Mikrofon SM58 x 2, Stojan mikrofon x 2, Kabel XLR x 4
Zvuková sada | Reproduktor x 2, Mixpult x 1"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-slate-500">
                  Každý řádek = jeden set. Oddělte název od položek pomocí | nebo tabulátorem.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Label>Načtené sety ({parsedKits.length})</Label>
                <div className="flex items-center gap-2">
                  {successCount > 0 && (
                    <Badge variant="secondary" className="text-green-600">
                      <Check className="w-3 h-3 mr-1" />
                      {successCount} importováno
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAll}
                    disabled={isImporting}
                  >
                    {parsedKits.every(kit => kit.selected) ? 'Odznačit vše' : 'Vybrat vše'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                    disabled={isImporting}
                  >
                    Znovu
                  </Button>
                </div>
              </div>

              <div className="flex-1 min-h-0 max-h-[400px] border rounded-md overflow-y-auto">
                <div className="divide-y">
                  {parsedKits.map((kit, index) => (
                    <div
                      key={index}
                      className={`p-3 ${kit.status === 'success' ? 'bg-green-50' : kit.status === 'error' ? 'bg-red-50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={kit.selected}
                          onCheckedChange={() => toggleKit(index)}
                          disabled={isImporting || kit.status === 'success'}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${kit.status === 'success' ? 'text-green-700' : ''}`}>
                              {kit.name}
                            </span>
                            {kit.status === 'importing' && (
                              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            )}
                            {kit.status === 'success' && (
                              <Check className="w-4 h-4 text-green-500" />
                            )}
                            {kit.status === 'error' && (
                              <X className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                          {kit.error && (
                            <p className="text-xs text-red-500 mt-1">{kit.error}</p>
                          )}
                          {kit.items.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {kit.items.map((item, itemIdx) => {
                                const found = findItemId(item.name);
                                return (
                                  <Badge
                                    key={itemIdx}
                                    variant={found ? 'secondary' : 'outline'}
                                    className={`text-xs ${!found ? 'border-red-300 text-red-600' : ''}`}
                                  >
                                    <Package className="w-3 h-3 mr-1" />
                                    {item.name} x{item.quantity}
                                    {!found && ' (?)'}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {isImporting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Importuji...</span>
                    <span>{importProgress.done} / {importProgress.total}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isImporting}>
            {successCount > 0 && successCount === parsedKits.length ? 'Zavřít' : 'Zrušit'}
          </Button>
          {parsedKits.length > 0 && selectedCount > 0 && (
            <Button onClick={handleImport} disabled={isImporting || selectedCount === 0}>
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importuji...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importovat ({selectedCount})
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

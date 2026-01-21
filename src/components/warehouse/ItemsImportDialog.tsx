'use client';

import { useState, useRef } from 'react';
import { useCreateWarehouseItem } from '@/hooks/useWarehouse';
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
import { Loader2, Upload, FileSpreadsheet, Check, X, AlertCircle } from 'lucide-react';

interface ItemsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ParsedItem {
  name: string;
  quantity: number;
  selected: boolean;
  status: 'pending' | 'importing' | 'success' | 'error';
  error?: string;
}

export default function ItemsImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ItemsImportDialogProps) {
  const createItem = useCreateWarehouseItem();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [rawText, setRawText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const parseCSV = (text: string): ParsedItem[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const items: ParsedItem[] = [];

    for (const line of lines) {
      // Skip header if present
      if (line.toLowerCase().includes('název') || line.toLowerCase().includes('name')) {
        continue;
      }

      // Try different separators: tab, semicolon, comma
      let parts: string[] = [];
      if (line.includes('\t')) {
        parts = line.split('\t');
      } else if (line.includes(';')) {
        parts = line.split(';');
      } else if (line.includes(',')) {
        parts = line.split(',');
      } else {
        // Single column - just name
        parts = [line.trim(), '1'];
      }

      const name = parts[0]?.trim();
      const quantityStr = parts[1]?.trim() || '1';
      const quantity = parseInt(quantityStr) || 1;

      if (name && name.length > 0) {
        items.push({
          name,
          quantity,
          selected: true,
          status: 'pending',
        });
      }
    }

    return items;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawText(text);
      const items = parseCSV(text);
      setParsedItems(items);
      setError(null);
    };
    reader.onerror = () => {
      setError('Nepodařilo se načíst soubor');
    };
    reader.readAsText(file);
  };

  const handleTextPaste = (text: string) => {
    setRawText(text);
    const items = parseCSV(text);
    setParsedItems(items);
    setError(null);
  };

  const toggleItem = (index: number) => {
    setParsedItems(prev => prev.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item
    ));
  };

  const toggleAll = () => {
    const allSelected = parsedItems.every(item => item.selected);
    setParsedItems(prev => prev.map(item => ({ ...item, selected: !allSelected })));
  };

  const handleImport = async () => {
    const itemsToImport = parsedItems.filter(item => item.selected && item.status === 'pending');
    if (itemsToImport.length === 0) {
      setError('Vyberte alespoň jednu položku k importu');
      return;
    }

    setIsImporting(true);
    setImportProgress({ done: 0, total: itemsToImport.length });
    setError(null);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < parsedItems.length; i++) {
      const item = parsedItems[i];
      if (!item.selected || item.status !== 'pending') continue;

      // Update status to importing
      setParsedItems(prev => prev.map((p, idx) =>
        idx === i ? { ...p, status: 'importing' } : p
      ));

      try {
        await createItem.mutateAsync({
          name: item.name,
          quantity_total: item.quantity,
          unit: 'ks',
          is_rent: false,
        });

        successCount++;
        setParsedItems(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'success' } : p
        ));
      } catch (err) {
        errorCount++;
        setParsedItems(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'error', error: err instanceof Error ? err.message : 'Chyba' } : p
        ));
      }

      setImportProgress({ done: successCount + errorCount, total: itemsToImport.length });
    }

    setIsImporting(false);

    if (successCount > 0) {
      onSuccess?.();
    }

    if (errorCount === 0 && successCount > 0) {
      // All successful - close dialog after short delay
      setTimeout(() => {
        onOpenChange(false);
        resetForm();
      }, 1500);
    }
  };

  const resetForm = () => {
    setParsedItems([]);
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

  const selectedCount = parsedItems.filter(item => item.selected && item.status === 'pending').length;
  const successCount = parsedItems.filter(item => item.status === 'success').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import materiálů
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {parsedItems.length === 0 ? (
            <>
              {/* File upload */}
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
                <p className="text-xs text-slate-500">
                  Podporované formáty: CSV, TXT, TSV (sloupec A = název, sloupec B = počet)
                </p>
              </div>

              <div className="text-center text-slate-400 text-sm">nebo</div>

              {/* Text paste */}
              <div className="space-y-2">
                <Label>Vložit data z Excelu</Label>
                <Textarea
                  value={rawText}
                  onChange={(e) => handleTextPaste(e.target.value)}
                  rows={8}
                  placeholder="Zkopírujte a vložte data z Excelu...

Příklad:
Mikrofon Shure SM58	10
Kabel XLR 10m	25
Reproduktor	4"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-slate-500">
                  Vložte řádky z Excelu (Ctrl+C → Ctrl+V). Každý řádek = jeden materiál.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Parsed items preview */}
              <div className="flex items-center justify-between">
                <Label>Načtené položky ({parsedItems.length})</Label>
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
                    {parsedItems.every(item => item.selected) ? 'Odznačit vše' : 'Vybrat vše'}
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
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="w-10 p-2"></th>
                      <th className="text-left p-2 font-medium">Název</th>
                      <th className="w-20 text-right p-2 font-medium">Počet</th>
                      <th className="w-24 text-center p-2 font-medium">Stav</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedItems.map((item, index) => (
                      <tr
                        key={index}
                        className={`${item.status === 'success' ? 'bg-green-50' : item.status === 'error' ? 'bg-red-50' : ''}`}
                      >
                        <td className="p-2 text-center">
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={() => toggleItem(index)}
                            disabled={isImporting || item.status === 'success'}
                          />
                        </td>
                        <td className="p-2">
                          <span className={item.status === 'success' ? 'text-green-700' : ''}>
                            {item.name}
                          </span>
                          {item.error && (
                            <p className="text-xs text-red-500 mt-1">{item.error}</p>
                          )}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {item.quantity} ks
                        </td>
                        <td className="p-2 text-center">
                          {item.status === 'pending' && (
                            <span className="text-slate-400">-</span>
                          )}
                          {item.status === 'importing' && (
                            <Loader2 className="w-4 h-4 animate-spin mx-auto text-blue-500" />
                          )}
                          {item.status === 'success' && (
                            <Check className="w-4 h-4 mx-auto text-green-500" />
                          )}
                          {item.status === 'error' && (
                            <X className="w-4 h-4 mx-auto text-red-500" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Progress */}
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
            {successCount > 0 && successCount === parsedItems.length ? 'Zavřít' : 'Zrušit'}
          </Button>
          {parsedItems.length > 0 && selectedCount > 0 && (
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

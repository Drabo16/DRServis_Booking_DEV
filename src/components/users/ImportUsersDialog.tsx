'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FileSpreadsheet, Upload, Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export default function ImportUsersDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('updateExisting', updateExisting.toString());

      const response = await fetch('/api/users/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setResult(data.results);

      // Refresh users list
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (error) {
      setResult({
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Neznámá chyba'],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setFile(null);
    setResult(null);
    setUpdateExisting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Import z XLSX
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import uživatelů z XLSX</DialogTitle>
          <DialogDescription>
            Nahrajte Excel soubor s uživateli. Podporované sloupce:
          </DialogDescription>
        </DialogHeader>

        {/* Column info */}
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <div className="grid grid-cols-2 gap-1 text-slate-600">
            <div><span className="font-medium">A:</span> Jméno</div>
            <div><span className="font-medium">B:</span> Příjmení</div>
            <div><span className="font-medium">C:</span> Je DRServis (ano/ne)</div>
            <div><span className="font-medium">E:</span> Firma</div>
            <div><span className="font-medium">F:</span> Pozice (více oddělené čárkou)</div>
            <div><span className="font-medium">G:</span> Telefon</div>
            <div><span className="font-medium">H:</span> Email *</div>
            <div><span className="font-medium">J:</span> Poznámka</div>
          </div>
          <p className="text-xs text-slate-500 mt-2">* Email je povinný</p>
        </div>

        <div className="space-y-4">
          {/* File input */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              file ? 'border-green-300 bg-green-50' : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setResult(null);
                  }}
                  className="ml-2 p-1 hover:bg-green-200 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="text-slate-600">Klikněte pro výběr souboru</p>
                <p className="text-xs text-slate-400 mt-1">.xlsx nebo .xls</p>
              </>
            )}
          </div>

          {/* Update existing option */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <Label>Aktualizovat existující</Label>
              <p className="text-xs text-slate-500">Pokud email již existuje, aktualizovat údaje</p>
            </div>
            <Switch
              checked={updateExisting}
              onCheckedChange={setUpdateExisting}
              disabled={loading}
            />
          </div>

          {/* Results */}
          {result && (
            <div className={`p-4 rounded-lg ${
              result.errors.length > 0 && result.imported === 0 && result.updated === 0
                ? 'bg-red-50 border border-red-200'
                : result.errors.length > 0
                ? 'bg-amber-50 border border-amber-200'
                : 'bg-green-50 border border-green-200'
            }`}>
              <div className="flex items-start gap-2">
                {result.errors.length > 0 && result.imported === 0 && result.updated === 0 ? (
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                ) : result.errors.length > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {result.imported > 0 && `${result.imported} importováno`}
                    {result.updated > 0 && `${result.imported > 0 ? ', ' : ''}${result.updated} aktualizováno`}
                    {result.skipped > 0 && `${result.imported > 0 || result.updated > 0 ? ', ' : ''}${result.skipped} přeskočeno`}
                    {result.imported === 0 && result.updated === 0 && result.skipped === 0 && 'Žádná data k importu'}
                  </p>
                  {result.errors.length > 0 && (
                    <div className="mt-2 text-sm">
                      <p className="font-medium text-slate-700">Chyby:</p>
                      <ul className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                        {result.errors.map((error, idx) => (
                          <li key={idx} className="text-slate-600">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleImport}
              disabled={!file || loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importuji...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importovat
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Zavřít
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

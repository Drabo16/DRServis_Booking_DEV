'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function EventDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Event detail error:', error);
  }, [error]);

  return (
    <div className="max-w-4xl mx-auto py-12">
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <CardTitle className="text-red-900">Chyba při načítání detailu akce</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-red-800">
            <p className="font-medium">Nepodařilo se načíst detail akce.</p>
            <p className="text-sm mt-2 text-red-700">
              Chyba: {error.message}
            </p>
          </div>

          <div className="pt-4 space-y-2">
            <button
              onClick={reset}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Zkusit znovu
            </button>
            <div className="text-sm text-red-700">
              Pokud problém přetrvává, zkontrolujte:
              <ul className="list-disc list-inside mt-2 ml-2">
                <li>Konzoli prohlížeče (F12) pro více detailů</li>
                <li>Server logy v terminálu</li>
                <li>Zda akce existuje v databázi</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

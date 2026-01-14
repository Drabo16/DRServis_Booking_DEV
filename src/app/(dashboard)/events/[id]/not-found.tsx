import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function EventNotFound() {
  return (
    <div className="max-w-4xl mx-auto py-12">
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
            <CardTitle className="text-yellow-900">Akce nenalezena</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-yellow-800">
            Požadovaná akce nebyla nalezena nebo k ní nemáte přístup.
          </p>

          <div className="pt-4">
            <Link
              href="/"
              className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
            >
              Zpět na seznam akcí
            </Link>
          </div>

          <div className="text-sm text-yellow-700 pt-4 border-t border-yellow-200">
            Možné příčiny:
            <ul className="list-disc list-inside mt-2 ml-2">
              <li>Akce byla smazána</li>
              <li>Nesprávné ID akce v URL</li>
              <li>Akce ještě nebyla synchronizována z Google Calendar</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

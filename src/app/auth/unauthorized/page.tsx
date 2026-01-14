import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <Card className="w-full max-w-md border-yellow-200 bg-yellow-50">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
            <CardTitle className="text-yellow-900">Přístup odepřen</CardTitle>
          </div>
          <CardDescription className="text-yellow-800">
            Váš účet není autorizován pro přístup do této aplikace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-yellow-800">
            <p className="font-medium">
              Přihlásili jste se úspěšně přes Google, ale váš email není zaregistrován v
              systému DR Servis Booking.
            </p>
            <p className="mt-3">Pro získání přístupu kontaktujte administrátora systému.</p>
          </div>

          <div className="pt-4 space-y-3">
            <Link href="/login">
              <Button variant="default" className="w-full">
                Zpět na přihlášení
              </Button>
            </Link>

            <div className="text-xs text-yellow-700 text-center pt-2">
              Administrátor vás musí přidat do systému dříve, než se budete moci přihlásit.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

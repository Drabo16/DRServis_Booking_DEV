import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone } from 'lucide-react';

export default async function TechniciansPage() {
  const supabase = await createClient();

  const { data: technicians } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_active', true)
    .order('full_name');

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Technici</h1>
        <p className="text-slate-600">Přehled všech aktivních techniků</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {technicians?.map((tech) => (
          <Card key={tech.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{tech.full_name}</CardTitle>
                  <Badge
                    variant={tech.role === 'admin' ? 'default' : 'secondary'}
                    className="mt-2"
                  >
                    {tech.role === 'admin' ? 'Admin' : 'Technik'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="w-4 h-4" />
                <span>{tech.email}</span>
              </div>

              {tech.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone className="w-4 h-4" />
                  <span>{tech.phone}</span>
                </div>
              )}

              {tech.specialization && tech.specialization.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-slate-500 mb-2">Specializace:</p>
                  <div className="flex flex-wrap gap-1">
                    {tech.specialization.map((spec: string) => (
                      <Badge key={spec} variant="outline" className="text-xs">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

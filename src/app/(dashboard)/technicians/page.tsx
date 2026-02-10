'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Phone, Users, Calendar, Loader2 } from 'lucide-react';
import TechnicianOverview from '@/components/technicians/TechnicianOverview';

export default function TechniciansPage() {
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch technicians for the list view
  const { data: technicians, isLoading } = useQuery({
    queryKey: ['technicians', 'list'],
    queryFn: async () => {
      const response = await fetch('/api/technicians');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return data.technicians || [];
    },
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Technici</h1>
        <p className="text-slate-600">Přehled techniků a jejich přiřazení na akce</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="overview" className="gap-2">
            <Calendar className="w-4 h-4" />
            Přiřazení a konflikty
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <Users className="w-4 h-4" />
            Seznam techniků
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <TechnicianOverview daysAhead={60} />
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {technicians?.map((tech: any) => (
                <Card key={tech.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{tech.full_name}</CardTitle>
                        <div className="flex gap-1 mt-2">
                          <Badge
                            variant={tech.role === 'admin' ? 'default' : 'secondary'}
                          >
                            {tech.role === 'admin' ? 'Admin' : tech.role === 'manager' ? 'Správce' : 'Technik'}
                          </Badge>
                          {tech.is_drservis === false && (
                            <Badge variant="outline">Externí</Badge>
                          )}
                        </div>
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

                    {tech.company && !tech.is_drservis && (
                      <div className="text-sm text-slate-600">
                        <span className="text-slate-500">Firma:</span> {tech.company}
                      </div>
                    )}

                    {tech.note && (
                      <div className="text-sm text-slate-500 italic">
                        {tech.note}
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

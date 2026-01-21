'use client';

// =====================================================
// PURCHASE RECOMMENDATIONS COMPONENT
// =====================================================
// Shows which Rent items should be purchased based on usage
// To remove: delete this file

import { ShoppingCart, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { RentPurchaseRecommendation } from '@/types/warehouse';

interface PurchaseRecommendationsProps {
  recommendations: RentPurchaseRecommendation[];
}

export default function PurchaseRecommendations({ recommendations }: PurchaseRecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Doporučení k nákupu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 text-center py-4">
            Žádné Rent materiály nebo nedostatek dat pro doporučení
          </p>
        </CardContent>
      </Card>
    );
  }

  const highPriority = recommendations.filter((r) => r.recommendation_level === 'high');
  const mediumPriority = recommendations.filter((r) => r.recommendation_level === 'medium');

  const getLevelBadge = (level: 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'high':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Vysoká priorita</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Střední priorita</Badge>;
      case 'low':
        return <Badge variant="secondary">Nízká priorita</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-red-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-slate-300';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          Doporučení k nákupu Rent materiálu
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        {(highPriority.length > 0 || mediumPriority.length > 0) && (
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">
                {highPriority.length > 0 && (
                  <>{highPriority.length} položek s vysokou prioritou k nákupu</>
                )}
                {highPriority.length > 0 && mediumPriority.length > 0 && ', '}
                {mediumPriority.length > 0 && (
                  <>{mediumPriority.length} se střední prioritou</>
                )}
              </p>
              <p className="text-amber-600 mt-1">
                Tyto Rent materiály jsou často využívány. Nákup může ušetřit náklady na pronájem.
              </p>
            </div>
          </div>
        )}

        {/* Recommendations list */}
        <div className="space-y-4">
          {recommendations.slice(0, 10).map((item) => (
            <div
              key={item.item_id}
              className={`p-4 rounded-lg border ${
                item.recommendation_level === 'high'
                  ? 'border-red-200 bg-red-50/50'
                  : item.recommendation_level === 'medium'
                  ? 'border-yellow-200 bg-yellow-50/50'
                  : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900">{item.item_name}</span>
                    {item.sku && (
                      <span className="text-xs text-slate-400">{item.sku}</span>
                    )}
                    {getLevelBadge(item.recommendation_level)}
                  </div>
                  {item.category_name && (
                    <p className="text-xs text-slate-500 mt-0.5">{item.category_name}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-slate-900">
                    {item.utilization_score}
                  </div>
                  <div className="text-xs text-slate-500">skóre využití</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <Progress
                  value={item.utilization_score}
                  className="h-2"
                />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                <div>
                  <span className="text-slate-500">Celkem rezervací:</span>
                  <span className="font-medium ml-1">{item.total_reservations}</span>
                </div>
                <div>
                  <span className="text-slate-500">Za 30 dní:</span>
                  <span className="font-medium ml-1">{item.reservations_last_30_days}</span>
                </div>
                <div>
                  <span className="text-slate-500">Za 90 dní:</span>
                  <span className="font-medium ml-1">{item.reservations_last_90_days}</span>
                </div>
                <div>
                  <span className="text-slate-500">Celkem dní:</span>
                  <span className="font-medium ml-1">{item.total_days_rented}</span>
                </div>
              </div>

              {/* Recommendation reason */}
              <div className="mt-3 flex items-center gap-2 text-sm">
                <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className={
                  item.recommendation_level === 'high'
                    ? 'text-red-700'
                    : item.recommendation_level === 'medium'
                    ? 'text-yellow-700'
                    : 'text-slate-600'
                }>
                  {item.recommendation_reason}
                </span>
              </div>
            </div>
          ))}
        </div>

        {recommendations.length > 10 && (
          <p className="text-xs text-slate-500 text-center">
            Zobrazeno prvních 10 položek z {recommendations.length}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

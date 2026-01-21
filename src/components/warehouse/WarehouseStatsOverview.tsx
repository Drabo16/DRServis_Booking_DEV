'use client';

import { useWarehouseStats } from '@/hooks/useWarehouse';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Layers, Calendar, TrendingUp, BarChart3 } from 'lucide-react';
import PurchaseRecommendations from './PurchaseRecommendations';

export default function WarehouseStatsOverview() {
  const { data: stats, isLoading } = useWarehouseStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-slate-500">
        Nelze načíst statistiky
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_items}</p>
                <p className="text-xs text-slate-500">Materiálů</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Layers className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_kits}</p>
                <p className="text-xs text-slate-500">Setů</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active_reservations}</p>
                <p className="text-xs text-slate-500">Aktivních rezervací</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_reservations}</p>
                <p className="text-xs text-slate-500">Celkem rezervací</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ownership breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4" />
            Rozdělení materiálu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500" />
              <span className="text-sm">Náš: {stats.items_by_ownership.ours}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-500" />
              <span className="text-sm">Rent: {stats.items_by_ownership.rent}</span>
            </div>
          </div>
          {/* Simple bar */}
          <div className="mt-3 h-4 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-blue-500"
              style={{
                width: `${
                  stats.total_items > 0
                    ? (stats.items_by_ownership.ours / stats.total_items) * 100
                    : 50
                }%`,
              }}
            />
            <div
              className="h-full bg-orange-500"
              style={{
                width: `${
                  stats.total_items > 0
                    ? (stats.items_by_ownership.rent / stats.total_items) * 100
                    : 50
                }%`,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Rent utilization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Vytíženost Rent materiálu (Top 10)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.rent_utilization.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              Žádné Rent materiály nebo rezervace
            </p>
          ) : (
            <div className="space-y-3">
              {stats.rent_utilization.map((item, index) => {
                const maxCount = stats.rent_utilization[0]?.reservation_count || 1;
                const percentage = (item.reservation_count / maxCount) * 100;

                return (
                  <div key={item.item_id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{item.item_name}</span>
                      <Badge variant="secondary" className="ml-2">
                        {item.reservation_count} rezervací
                      </Badge>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Přehled</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Kategorií</p>
              <p className="text-xl font-bold">{stats.total_categories}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Průměrné rez./materiál</p>
              <p className="text-xl font-bold">
                {stats.total_items > 0
                  ? (stats.total_reservations / stats.total_items).toFixed(1)
                  : '0'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Recommendations for Rent items */}
      <PurchaseRecommendations recommendations={stats.purchase_recommendations || []} />
    </div>
  );
}

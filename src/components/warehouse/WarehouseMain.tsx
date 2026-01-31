'use client';

import { useState, lazy, Suspense, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Package, Layers, BarChart3, Calendar, Settings, Upload, CalendarCheck, AlertTriangle } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import ItemsList from './ItemsList';
import ItemDetailPanel from './ItemDetailPanel';
import ItemFormDialog from './ItemFormDialog';
import ItemsImportDialog from './ItemsImportDialog';

const KitsList = lazy(() => import('./KitsList'));
const CategoriesManager = lazy(() => import('./CategoriesManager'));
const WarehouseStatsOverview = lazy(() => import('./WarehouseStatsOverview'));
const ReservationsView = lazy(() => import('./ReservationsView'));
const AvailabilityChecker = lazy(() => import('./AvailabilityChecker'));
const ConflictManager = lazy(() => import('./ConflictManager'));

// Shared loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <Loader2 className="w-6 h-6 animate-spin" />
  </div>
);

interface WarehouseMainProps {
  isAdmin: boolean;
  userId: string;
}

export default function WarehouseMain({ isAdmin, userId }: WarehouseMainProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams.get('item');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(itemId);
  const [activeTab, setActiveTab] = useState('items');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Mobile detection with debounce
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();

    let timeoutId: NodeJS.Timeout;
    const debouncedCheck = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(checkMobile, 100);
    };

    window.addEventListener('resize', debouncedCheck);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedCheck);
    };
  }, []);

  // Sync itemId from URL
  useEffect(() => {
    setSelectedItemId(itemId);
    if (itemId && isMobile) {
      setMobileSheetOpen(true);
    }
  }, [itemId, isMobile]);

  const handleOpenItem = useCallback((id: string) => {
    setSelectedItemId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('item', id);
    router.push(`/warehouse?${params.toString()}`, { scroll: false });
    if (isMobile) {
      setMobileSheetOpen(true);
    }
  }, [searchParams, router, isMobile]);

  const handleCloseItem = useCallback(() => {
    setSelectedItemId(null);
    setMobileSheetOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('item');
    router.push(`/warehouse?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const openCreateDialog = useCallback(() => setShowCreateDialog(true), []);
  const closeCreateDialog = useCallback(() => setShowCreateDialog(false), []);
  const openImportDialog = useCallback(() => setShowImportDialog(true), []);

  const handleMobileSheetChange = useCallback((open: boolean) => {
    if (!open) handleCloseItem();
  }, [handleCloseItem]);

  // Memoize which tabs hide the right panel
  const hideRightPanel = useMemo(() =>
    activeTab === 'stats' || activeTab === 'categories' || activeTab === 'reservations' || activeTab === 'kits' || activeTab === 'availability' || activeTab === 'conflicts',
    [activeTab]
  );

  // Memoize grid class for tabs
  const tabsGridClass = useMemo(() =>
    `grid h-10 max-w-3xl ${isAdmin ? 'grid-cols-7' : 'grid-cols-6'}`,
    [isAdmin]
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className={hideRightPanel ? 'w-full' : 'w-full lg:w-1/2 lg:flex-shrink-0'}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-2 min-h-[40px]">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
            Sklad
          </h1>
          {isAdmin && activeTab === 'items' && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={openImportDialog}>
                <Upload className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Import</span>
              </Button>
              <Button size="sm" onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Nový materiál</span>
                <span className="sm:hidden">Nový</span>
              </Button>
            </div>
          )}
        </div>

        <Tabs defaultValue="items" onValueChange={setActiveTab}>
          <TabsList className={tabsGridClass}>
            <TabsTrigger value="items" className="text-xs sm:text-sm">
              <Package className="w-4 h-4 mr-1 hidden sm:block" />
              Materiály
            </TabsTrigger>
            <TabsTrigger value="kits" className="text-xs sm:text-sm">
              <Layers className="w-4 h-4 mr-1 hidden sm:block" />
              Sety
            </TabsTrigger>
            <TabsTrigger value="reservations" className="text-xs sm:text-sm">
              <Calendar className="w-4 h-4 mr-1 hidden sm:block" />
              Rezervace
            </TabsTrigger>
            <TabsTrigger value="availability" className="text-xs sm:text-sm">
              <CalendarCheck className="w-4 h-4 mr-1 hidden sm:block" />
              Dostupnost
            </TabsTrigger>
            <TabsTrigger value="stats" className="text-xs sm:text-sm">
              <BarChart3 className="w-4 h-4 mr-1 hidden sm:block" />
              Statistiky
            </TabsTrigger>
            <TabsTrigger value="conflicts" className="text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 mr-1 hidden sm:block" />
              Konflikty
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="categories" className="text-xs sm:text-sm">
                <Settings className="w-4 h-4 mr-1 hidden sm:block" />
                Kategorie
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="items" className="mt-4">
            <ItemsList onItemClick={handleOpenItem} isAdmin={isAdmin} selectedItemId={selectedItemId} />
          </TabsContent>

          <TabsContent value="kits" className="mt-4">
            <Suspense fallback={<LoadingFallback />}>
              <KitsList isAdmin={isAdmin} />
            </Suspense>
          </TabsContent>

          <TabsContent value="reservations" className="mt-4">
            <Suspense fallback={<LoadingFallback />}>
              <ReservationsView isAdmin={isAdmin} />
            </Suspense>
          </TabsContent>

          <TabsContent value="availability" className="mt-4">
            <Suspense fallback={<LoadingFallback />}>
              <AvailabilityChecker />
            </Suspense>
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            <Suspense fallback={<LoadingFallback />}>
              <WarehouseStatsOverview />
            </Suspense>
          </TabsContent>

          <TabsContent value="conflicts" className="mt-4">
            <Suspense fallback={<LoadingFallback />}>
              <ConflictManager isAdmin={isAdmin} />
            </Suspense>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="categories" className="mt-4">
              <Suspense fallback={<LoadingFallback />}>
                <CategoriesManager />
              </Suspense>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Right panel - item detail - DESKTOP only */}
      {!hideRightPanel && (
        <div className="hidden lg:block w-1/2 border-l border-slate-200 pl-6 overflow-y-auto sticky top-0 h-screen">
          {selectedItemId ? (
            <ItemDetailPanel
              itemId={selectedItemId}
              onClose={handleCloseItem}
              isAdmin={isAdmin}
            />
          ) : (
            <div className="flex items-center justify-center h-96 text-slate-400">
              <p>Vyberte materiál pro zobrazení detailu</p>
            </div>
          )}
        </div>
      )}

      {/* Mobile sheet for item detail */}
      {isMobile && (
        <Sheet open={mobileSheetOpen && !hideRightPanel} onOpenChange={handleMobileSheetChange}>
          <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
            {selectedItemId && (
              <ItemDetailPanel
                itemId={selectedItemId}
                onClose={handleCloseItem}
                isAdmin={isAdmin}
              />
            )}
          </SheetContent>
        </Sheet>
      )}

      {/* Create item dialog */}
      {showCreateDialog && (
        <ItemFormDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={closeCreateDialog}
        />
      )}

      {/* Import dialog */}
      {showImportDialog && (
        <ItemsImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}

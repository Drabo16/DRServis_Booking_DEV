'use client';

import { useState, lazy, Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, FileText, Settings, FolderKanban } from 'lucide-react';
import OffersList from './OffersList';
import OfferFormDialog from './OfferFormDialog';

const OfferEditor = lazy(() => import('./OfferEditor'));
const TemplatesManager = lazy(() => import('./TemplatesManager'));
const OfferSetsManager = lazy(() => import('./OfferSetsManager'));
const ProjectEditor = lazy(() => import('./ProjectEditor'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <Loader2 className="w-6 h-6 animate-spin" />
  </div>
);

interface OffersMainProps {
  isAdmin: boolean;
}

export default function OffersMain({ isAdmin }: OffersMainProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const offerId = searchParams.get('offer');
  const projectId = searchParams.get('project');

  const [activeTab, setActiveTab] = useState(projectId ? 'project-editor' : offerId ? 'editor' : 'list');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const openCreateDialog = useCallback(() => setShowCreateDialog(true), []);
  const closeCreateDialog = useCallback(() => setShowCreateDialog(false), []);

  const handleOfferSelect = useCallback((id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('offer', id);
    router.push(`/offers?${params.toString()}`, { scroll: false });
    setActiveTab('editor');
  }, [searchParams, router]);

  const handleOfferCreated = useCallback((offer: { id: string }) => {
    closeCreateDialog();
    handleOfferSelect(offer.id);
  }, [closeCreateDialog, handleOfferSelect]);

  const handleBackToList = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('offer');
    params.delete('project');
    router.push(`/offers?${params.toString()}`, { scroll: false });
    setActiveTab('list');
  }, [searchParams, router]);

  const handleProjectSelect = useCallback((id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('project', id);
    params.delete('offer');
    router.push(`/offers?${params.toString()}`, { scroll: false });
    setActiveTab('project-editor');
  }, [searchParams, router]);

  const handleBackToProjects = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('project');
    params.delete('offer');
    router.push(`/offers?${params.toString()}`, { scroll: false });
    setActiveTab('projects');
  }, [searchParams, router]);

  // Determine grid columns based on visible tabs
  const tabCount = useMemo(() => {
    let count = 2; // Nabídky + Projekty
    if (offerId) count++; // Editor
    if (projectId) count++; // Project Editor
    if (isAdmin) count++; // Ceník
    return Math.min(count, 5);
  }, [offerId, projectId, isAdmin]);

  const tabsGridClass = useMemo(() => {
    const colsMap: Record<number, string> = {
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
      5: 'grid-cols-5',
    };
    return `grid h-10 max-w-xl ${colsMap[tabCount] || 'grid-cols-4'}`;
  }, [tabCount]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 min-h-[40px]">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">
          Nabídky
        </h1>
        {(activeTab === 'list' || activeTab === 'projects') && (
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Nová nabídka</span>
            <span className="sm:hidden">Nová</span>
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={tabsGridClass}>
          <TabsTrigger value="list" className="text-xs sm:text-sm">
            <FileText className="w-4 h-4 mr-1 hidden sm:block" />
            Nabídky
          </TabsTrigger>
          <TabsTrigger value="projects" className="text-xs sm:text-sm">
            <FolderKanban className="w-4 h-4 mr-1 hidden sm:block" />
            Projekty
          </TabsTrigger>
          {offerId && (
            <TabsTrigger value="editor" className="text-xs sm:text-sm">
              <FileText className="w-4 h-4 mr-1 hidden sm:block" />
              Editor
            </TabsTrigger>
          )}
          {projectId && (
            <TabsTrigger value="project-editor" className="text-xs sm:text-sm">
              <FolderKanban className="w-4 h-4 mr-1 hidden sm:block" />
              Nabídka
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="templates" className="text-xs sm:text-sm">
              <Settings className="w-4 h-4 mr-1 hidden sm:block" />
              Ceník
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <OffersList
            onOfferSelect={handleOfferSelect}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <Suspense fallback={<LoadingFallback />}>
            <OfferSetsManager
              onOfferSelect={handleOfferSelect}
              onProjectSelect={handleProjectSelect}
              isAdmin={isAdmin}
            />
          </Suspense>
        </TabsContent>

        {projectId && (
          <TabsContent value="project-editor" className="mt-4">
            <Suspense fallback={<LoadingFallback />}>
              <ProjectEditor
                projectId={projectId}
                isAdmin={isAdmin}
                onBack={handleBackToProjects}
                onOfferSelect={handleOfferSelect}
              />
            </Suspense>
          </TabsContent>
        )}

        {offerId && (
          <TabsContent value="editor" className="mt-4">
            <Suspense fallback={<LoadingFallback />}>
              <OfferEditor
                offerId={offerId}
                isAdmin={isAdmin}
                onBack={handleBackToList}
              />
            </Suspense>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="templates" className="mt-4">
            <Suspense fallback={<LoadingFallback />}>
              <TemplatesManager />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>

      {/* Create offer dialog */}
      {showCreateDialog && (
        <OfferFormDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={handleOfferCreated}
        />
      )}
    </div>
  );
}

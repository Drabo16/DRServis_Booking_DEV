'use client';

import { useState, lazy, Suspense, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, FileText, Settings, FolderKanban, Edit, BookTemplate } from 'lucide-react';
import OffersList from './OffersList';
import OfferFormDialog from './OfferFormDialog';

const OfferEditor = lazy(() => import('./OfferEditor'));
const TemplatesManager = lazy(() => import('./TemplatesManager'));
const OfferSetsManager = lazy(() => import('./OfferSetsManager'));
const ProjectEditor = lazy(() => import('./ProjectEditor'));
const PresetsManager = lazy(() => import('./PresetsManager'));
const PresetEditor = lazy(() => import('./PresetEditor'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <Loader2 className="w-6 h-6 animate-spin" />
  </div>
);

interface OffersMainProps {
  isAdmin: boolean;
}

// Store last used offer ID for Editor tab persistence
const LAST_OFFER_KEY = 'offers_last_offer_id';

export default function OffersMain({ isAdmin }: OffersMainProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const offerId = searchParams.get('offer');
  const projectId = searchParams.get('project');

  // Track last used offer for Editor tab
  const [lastOfferId, setLastOfferId] = useState<string | null>(null);

  // Load last offer from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(LAST_OFFER_KEY);
    if (stored) setLastOfferId(stored);
  }, []);

  // Save current offer to localStorage when it changes
  useEffect(() => {
    if (offerId) {
      localStorage.setItem(LAST_OFFER_KEY, offerId);
      setLastOfferId(offerId);
    }
  }, [offerId]);

  // Preset editing state (local, not URL-based)
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

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

  // Handle Editor tab click - open last used offer if no current offer
  const handleEditorTabClick = useCallback(() => {
    if (!offerId && lastOfferId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('offer', lastOfferId);
      params.delete('project');
      router.push(`/offers?${params.toString()}`, { scroll: false });
    }
    setActiveTab('editor');
  }, [offerId, lastOfferId, searchParams, router]);

  // Handle preset selection - opens preset editor
  const handlePresetSelect = useCallback((id: string) => {
    setEditingPresetId(id);
    setActiveTab('preset-editor');
  }, []);

  const handleBackToPresets = useCallback(() => {
    setEditingPresetId(null);
    setActiveTab('presets');
  }, []);

  // Current offer ID to display (either URL param or last used)
  const currentOfferId = offerId || lastOfferId;

  // Determine grid columns based on visible tabs
  const tabCount = useMemo(() => {
    let count = 2; // Nabídky + Projekty
    if (currentOfferId) count++; // Editor
    if (projectId) count++; // Project Editor
    if (isAdmin) count += 2; // Ceník + Šablony
    if (editingPresetId) count++; // Preset Editor
    return Math.min(count, 7);
  }, [currentOfferId, projectId, isAdmin, editingPresetId]);

  const tabsGridClass = useMemo(() => {
    const colsMap: Record<number, string> = {
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
      5: 'grid-cols-5',
      6: 'grid-cols-6',
      7: 'grid-cols-7',
    };
    return `grid h-10 max-w-3xl ${colsMap[tabCount] || 'grid-cols-5'}`;
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
          {currentOfferId && (
            <TabsTrigger
              value="editor"
              className="text-xs sm:text-sm"
              onClick={handleEditorTabClick}
            >
              <Edit className="w-4 h-4 mr-1 hidden sm:block" />
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
          {isAdmin && (
            <TabsTrigger value="presets" className="text-xs sm:text-sm">
              <BookTemplate className="w-4 h-4 mr-1 hidden sm:block" />
              Šablony
            </TabsTrigger>
          )}
          {editingPresetId && (
            <TabsTrigger value="preset-editor" className="text-xs sm:text-sm">
              <Edit className="w-4 h-4 mr-1 hidden sm:block" />
              Šablona
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <OffersList
            onOfferSelect={handleOfferSelect}
            isAdmin={isAdmin}
            canDuplicate={true}
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

        {currentOfferId && (
          <TabsContent value="editor" className="mt-4">
            <Suspense fallback={<LoadingFallback />}>
              <OfferEditor
                offerId={currentOfferId}
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

        {isAdmin && (
          <TabsContent value="presets" className="mt-4">
            <Suspense fallback={<LoadingFallback />}>
              <PresetsManager onPresetSelect={handlePresetSelect} />
            </Suspense>
          </TabsContent>
        )}

        {editingPresetId && (
          <TabsContent value="preset-editor" className="mt-4">
            <Suspense fallback={<LoadingFallback />}>
              <PresetEditor
                presetId={editingPresetId}
                onBack={handleBackToPresets}
              />
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

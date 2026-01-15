'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileIcon, Loader2, ExternalLink, File, FileText, FileImage, FileVideo, FileAudio, Folder } from 'lucide-react';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
  iconLink?: string;
  createdTime?: string;
  size?: string;
}

interface DriveFilesListProps {
  eventId: string;
  driveFolderId: string | null;
  compact?: boolean;
}

const getFileIcon = (mimeType: string) => {
  // Media files - specific icons
  if (mimeType.startsWith('image/')) return { icon: FileImage, color: 'text-purple-600' };
  if (mimeType.startsWith('video/')) return { icon: FileVideo, color: 'text-red-600' };
  if (mimeType.startsWith('audio/')) return { icon: FileAudio, color: 'text-orange-600' };

  // Documents - FileText icon with distinct colors
  if (mimeType.includes('pdf')) return { icon: FileText, color: 'text-red-700' };
  if (mimeType.includes('document')) return { icon: FileText, color: 'text-blue-600' };
  if (mimeType.includes('spreadsheet')) return { icon: FileText, color: 'text-green-600' };
  if (mimeType.includes('presentation')) return { icon: FileText, color: 'text-yellow-600' };

  // Actual folders from Drive - Folder icon
  if (mimeType === 'application/vnd.google-apps.folder') return { icon: Folder, color: 'text-yellow-500' };

  // Default for other files
  return { icon: FileText, color: 'text-slate-500' };
};

const formatFileSize = (bytes?: string) => {
  if (!bytes) return '';
  const size = parseInt(bytes);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export default function DriveFilesList({ eventId, driveFolderId, compact = false }: DriveFilesListProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!driveFolderId) {
      setLoading(false);
      return;
    }

    const fetchFiles = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/events/${eventId}/files`);
        if (!response.ok) throw new Error('Failed to fetch files');

        const data = await response.json();
        setFiles(data.files || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching Drive files:', err);
        setError('Nepodařilo se načíst soubory');
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [eventId, driveFolderId]);

  if (!driveFolderId) {
    return null;
  }

  // Compact mode for inline display
  if (compact) {
    if (loading) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          <span className="text-sm text-slate-500">Načítání souborů...</span>
        </div>
      );
    }

    if (error || files.length === 0) {
      return null;
    }

    return (
      <div className="space-y-1.5">
        {files.map((file) => {
          const { icon: Icon, color } = getFileIcon(file.mimeType);
          return (
            <a
              key={file.id}
              href={file.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 hover:underline group"
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
              <span className="truncate">{file.name}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60 group-hover:opacity-100" />
            </a>
          );
        })}
      </div>
    );
  }

  // Full card mode
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Soubory na Drive</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Soubory na Drive</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (files.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Soubory na Drive</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            Ve složce zatím nejsou žádné soubory
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Soubory na Drive ({files.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.map((file) => {
            const { icon: Icon, color } = getFileIcon(file.mimeType);
            return (
              <a
                key={file.id}
                href={file.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors group"
              >
                {file.thumbnailLink ? (
                  <img
                    src={file.thumbnailLink}
                    alt={file.name}
                    className="w-12 h-12 object-cover rounded flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center flex-shrink-0">
                    <Icon className={`w-6 h-6 ${color}`} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 flex-shrink-0" />
              </a>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

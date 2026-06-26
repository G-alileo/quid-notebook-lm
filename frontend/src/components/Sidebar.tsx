import React from 'react';
import type { DocumentResponse } from '../api/client';
import { 
  FileText, 
  Globe, 
  FileCode, 
  Music, 
  LogOut, 
  FolderPlus, 
  MessageSquare, 
  Mic,
  BookOpen,
  X
} from 'lucide-react';

const YoutubeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17z" />
    <polygon points="10 15 15 12 10 9" />
  </svg>
);

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  sources: DocumentResponse[];
  onSelectPDF: (doc: DocumentResponse) => void;
  onLogout: () => void;
  username: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onPageChange,
  sources,
  onSelectPDF,
  onLogout,
  username,
  isOpen,
  onClose,
}) => {
  const getSourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <FileText className="w-4 h-4 text-rose-400" />;
      case 'website':
        return <Globe className="w-4 h-4 text-emerald-400" />;
      case 'youtube':
      case 'youtube video':
        return <YoutubeIcon className="w-4 h-4 text-red-400" />;
      case 'text':
        return <FileCode className="w-4 h-4 text-amber-400" />;
      case 'audio':
        return <Music className="w-4 h-4 text-sky-400" />;
      default:
        return <BookOpen className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col h-screen select-none shrink-0 transition-transform duration-300 lg:static lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      {/* Brand Header */}
      <div className="p-6 border-b border-zinc-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600/10 border border-violet-500/30 rounded-xl flex items-center justify-center text-violet-400 font-bold text-lg">
            Q
          </div>
          <div>
            <span className="font-bold text-white tracking-wide block text-sm">Quid Notebook</span>
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Workspace</span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden text-zinc-500 hover:text-white p-1 hover:bg-zinc-800 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="p-4 space-y-1">
        <button
          type="button"
          onClick={() => onPageChange('Add Sources')}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
            currentPage === 'Add Sources'
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/10'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
          }`}
        >
          <FolderPlus className="w-4 h-4" />
          Add Sources
        </button>

        <button
          type="button"
          onClick={() => onPageChange('Chat')}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
            currentPage === 'Chat'
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/10'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Chat Assistant
        </button>

        <button
          type="button"
          onClick={() => onPageChange('Studio')}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
            currentPage === 'Studio'
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/10'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
          }`}
        >
          <Mic className="w-4 h-4" />
          Podcast Studio
        </button>
      </nav>

      {/* Divider */}
      <div className="px-6 py-2">
        <div className="h-px bg-zinc-800"></div>
      </div>

      {/* Sources List Section */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <span className="px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-3">
          Your Documents ({sources.length})
        </span>

        {sources.length === 0 ? (
          <div className="px-4 py-8 text-center bg-zinc-950/20 border border-dashed border-zinc-800/60 rounded-2xl">
            <p className="text-zinc-600 text-xs">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sources.map((source) => (
              <div
                key={source.id}
                onClick={() => source.type === 'PDF' && onSelectPDF(source)}
                className={`flex items-start gap-3 p-3 rounded-xl border border-transparent transition-all group ${
                  source.type === 'PDF' 
                    ? 'hover:bg-zinc-850/80 hover:border-zinc-800 cursor-pointer' 
                    : 'bg-zinc-950/20 opacity-85 hover:opacity-100'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {getSourceIcon(source.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-zinc-300 font-medium text-xs break-all group-hover:text-white transition-colors">
                    {source.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
                    <span>{source.type}</span>
                    <span>•</span>
                    <span>{source.size || `${source.chunks} chunks`}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Section / Log Out */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-300 font-bold text-xs uppercase shrink-0">
            {username.substring(0, 2)}
          </div>
          <div className="min-w-0">
            <span className="block text-zinc-200 text-xs font-semibold truncate">{username}</span>
            <span className="block text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Author</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="text-zinc-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/5 transition-all cursor-pointer"
          title="Log Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};

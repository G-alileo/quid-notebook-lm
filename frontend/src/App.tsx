import { useState, useEffect } from 'react';
import { api } from './api/client';
import type { DocumentResponse } from './api/client';
import { AuthPage } from './components/AuthPage';
import { Sidebar } from './components/Sidebar';
import { UploadInterface } from './components/UploadInterface';
import { ChatInterface } from './components/ChatInterface';
import { StudioInterface } from './components/StudioInterface';
import { 
  X, 
  BarChart3, 
  Database, 
  FileText, 
  Mic, 
  MessageSquare,
  Menu
} from 'lucide-react';

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<{ username: string; email: string; full_name?: string } | null>(null);
  const [currentPage, setCurrentPage] = useState<string>('Add Sources');
  const [sources, setSources] = useState<DocumentResponse[]>([]);
  const [viewingPDF, setViewingPDF] = useState<DocumentResponse | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [targetPage, setTargetPage] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const isValid = await api.verify();
      if (isValid) {
        setAuthenticated(true);
        fetchProfileAndData();
      } else {
        setAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const fetchProfileAndData = async () => {
    try {
      const profile = await api.getProfile();
      setUser(profile);
      setAuthenticated(true);
      loadSources();
    } catch {
      handleLogout();
    }
  };

  const loadSources = async () => {
    try {
      const list = await api.listDocuments();
      setSources(list);
    } catch (e) {
      console.error('Failed to load documents', e);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setAuthenticated(false);
    setUser(null);
    setSources([]);
    setViewingPDF(null);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  };

  const handleSelectPDF = async (doc: DocumentResponse) => {
    try {
      // Clean up previous blob URL if exists
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      const blob = await api.getPdfBlob(doc.id);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setTargetPage(null);
      setViewingPDF(doc);
    } catch (e) {
      alert('Could not download PDF. Verify the server connection.');
    }
  };

  const onSelectPDFPage = async (fileName: string, pageNumber: number) => {
    const doc = sources.find((s) => s.name === fileName);
    if (!doc) {
      console.warn(`Source document not found for filename: ${fileName}`);
      return;
    }
    try {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      const blob = await api.getPdfBlob(doc.id);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setTargetPage(pageNumber);
      setViewingPDF(doc);
    } catch (e) {
      alert('Could not download PDF for citation page jump.');
    }
  };

  const closePDFViewer = () => {
    setViewingPDF(null);
    setTargetPage(null);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  };

  // Render the current workspace center panel
  const renderCenterPanel = () => {
    if (viewingPDF && pdfUrl) {
      return (
        <div className="flex flex-col h-screen select-none bg-zinc-950 p-4 md:p-6 relative">
          <div className="flex items-center justify-between mb-4 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl relative z-10 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg flex items-center justify-center shrink-0">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <span className="block text-zinc-200 font-semibold text-xs truncate max-w-xs md:max-w-lg">{viewingPDF.name}</span>
                <span className="block text-zinc-550 text-[10px] uppercase font-bold tracking-wider">PDF Viewer overlay</span>
              </div>
            </div>
            <button
              onClick={closePDFViewer}
              className="text-zinc-400 hover:text-white p-2 hover:bg-zinc-800 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>
          <div className="flex-1 bg-zinc-900 border border-zinc-800/80 rounded-2xl p-2 md:p-4 overflow-hidden relative">
            <iframe
              src={targetPage ? `${pdfUrl}#page=${targetPage}&toolbar=0` : `${pdfUrl}#toolbar=0`}
              className="w-full h-full border-none rounded-xl"
              title={viewingPDF.name}
            />
          </div>
        </div>
      );
    }

    const openMenu = () => setSidebarOpen(true);

    switch (currentPage) {
      case 'Add Sources':
        return <UploadInterface onUploadSuccess={loadSources} onOpenMenu={openMenu} />;
      case 'Chat':
        return <ChatInterface onSelectPDFPage={onSelectPDFPage} onOpenMenu={openMenu} />;
      case 'Studio':
        return <StudioInterface sources={sources} onOpenMenu={openMenu} />;
      default:
        return <UploadInterface onUploadSuccess={loadSources} onOpenMenu={openMenu} />;
    }
  };

  // Render the dynamic Right Analytics Panel
  const renderRightPanel = () => {
    const totalSources = sources.length;
    const totalChunks = sources.reduce((acc, src) => acc + src.chunks, 0);
    const avgChunks = totalSources > 0 ? (totalChunks / totalSources).toFixed(1) : '0.0';

    return (
      <aside className="hidden xl:flex w-80 bg-zinc-900 border-l border-zinc-800 flex-col h-screen select-none shrink-0 p-6 space-y-6 overflow-y-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <span className="block text-white text-xs font-bold uppercase tracking-wider">Analytics</span>
            <span className="block text-zinc-500 text-[10px] font-semibold mt-0.5 uppercase tracking-wide">Real-time insights</span>
          </div>
        </div>

        <div className="h-px bg-zinc-800"></div>

        {currentPage === 'Add Sources' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-950/40 p-4 border border-zinc-850 rounded-2xl">
                <span className="block text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Sources</span>
                <span className="block text-2xl font-bold text-white mt-1">{totalSources}</span>
              </div>
              <div className="bg-zinc-950/40 p-4 border border-zinc-850 rounded-2xl">
                <span className="block text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Chunks</span>
                <span className="block text-2xl font-bold text-white mt-1">{totalChunks}</span>
              </div>
            </div>

            <div className="bg-zinc-950/20 p-4 border border-zinc-850 rounded-2xl space-y-3.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Key Metrics</span>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-450 font-medium">Avg Chunks/Doc</span>
                <span className="text-zinc-200 font-bold">{avgChunks}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-450 font-medium">Embedding Engine</span>
                <span className="text-zinc-200 font-bold bg-violet-600/15 border border-violet-500/20 px-2 py-0.5 rounded text-[10px] text-violet-400 font-semibold uppercase">BGE Large</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-450 font-medium">Database Layer</span>
                <span className="text-zinc-200 font-bold flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-zinc-500" />
                  Milvus Lite
                </span>
              </div>
            </div>

            {totalSources > 0 && (
              <div className="bg-zinc-950/20 p-4 border border-zinc-850 rounded-2xl">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-3.5">Types Breakdown</span>
                <div className="space-y-2.5">
                  {['PDF', 'Website', 'YouTube Video', 'Text', 'Audio'].map((type) => {
                    const count = sources.filter((s) => s.type.toLowerCase() === type.toLowerCase()).length;
                    if (count === 0) return null;
                    const pct = ((count / totalSources) * 100).toFixed(0);
                    return (
                      <div key={type} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 font-medium">{type}</span>
                        <span className="text-zinc-300 font-bold bg-zinc-850 border border-zinc-800 px-2 py-0.5 rounded text-[10px]">
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {currentPage === 'Chat' && (
          <div className="space-y-5">
            <div className="bg-zinc-950/40 p-4 border border-zinc-850 rounded-2xl flex items-center gap-4">
              <div className="w-10 h-10 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-xl flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-zinc-550 text-[10px] uppercase font-bold tracking-wider">Memory Module</span>
                <span className="block text-zinc-200 font-bold text-xs mt-0.5">Zep Memory Active</span>
              </div>
            </div>

            <div className="bg-zinc-950/20 p-4 border border-zinc-850 rounded-2xl space-y-4">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Context Retrieval</span>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-450 font-medium">Similarity Strategy</span>
                  <span className="text-zinc-300 font-bold">Cosine</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-450 font-medium">Top-K Search</span>
                  <span className="text-zinc-300 font-bold bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded text-[10px]">k=50</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-450 font-medium">LLM Provider</span>
                  <span className="text-zinc-200 font-bold bg-violet-600/15 border border-violet-500/20 px-2 py-0.5 rounded text-[10px] text-violet-400 font-semibold uppercase">DeepSeek-V3</span>
                </div>
              </div>
            </div>

            <div className="bg-zinc-950/20 p-4 border border-zinc-850 rounded-2xl space-y-3">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Grounded Guardrails</span>
              <p className="text-zinc-500 text-[11px] leading-relaxed font-normal m-0">
                Generation parameters enforce strict context constraints, filtering response queries unless they are supported by citation matches in Milvus.
              </p>
            </div>
          </div>
        )}

        {currentPage === 'Studio' && (
          <div className="space-y-5">
            <div className="bg-zinc-950/40 p-4 border border-zinc-850 rounded-2xl flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-zinc-550 text-[10px] uppercase font-bold tracking-wider">TTS Engine</span>
                <span className="block text-zinc-200 font-bold text-xs mt-0.5">Kokoro v0.19</span>
              </div>
            </div>

            <div className="bg-zinc-950/20 p-4 border border-zinc-850 rounded-2xl space-y-3">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Studio Settings</span>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-450 font-medium">Sample Rate</span>
                  <span className="text-zinc-300 font-bold">24 kHz</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-450 font-medium">Format Output</span>
                  <span className="text-zinc-300 font-bold">WAV (Stereo)</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-450 font-medium">Speakers</span>
                  <span className="text-zinc-300 font-semibold">Host / Expert</span>
                </div>
              </div>
            </div>

            <div className="bg-zinc-950/20 p-4 border border-zinc-850 rounded-2xl space-y-3">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Synthesizer Load</span>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-450 font-medium">Device Profile</span>
                <span className="text-zinc-200 font-bold bg-emerald-600/15 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] text-emerald-400 font-semibold uppercase">CUDA GPU</span>
              </div>
            </div>
          </div>
        )}
      </aside>
    );
  };

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
          <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider animate-pulse">Verifying workspace credentials...</span>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <AuthPage onSuccess={fetchProfileAndData} />;
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden font-sans relative">
      {/* Sidebar Backdrop Overlay on Mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        currentPage={currentPage}
        onPageChange={(page) => {
          setCurrentPage(page);
          setViewingPDF(null);
          setSidebarOpen(false); // Auto-close drawer on selection
        }}
        sources={sources}
        onSelectPDF={(doc) => {
          handleSelectPDF(doc);
          setSidebarOpen(false); // Auto-close drawer on selection
        }}
        onLogout={handleLogout}
        username={user?.username || 'User'}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 h-screen overflow-y-auto bg-zinc-950">
        {renderCenterPanel()}
      </main>

      {renderRightPanel()}
    </div>
  );
}

export default App;

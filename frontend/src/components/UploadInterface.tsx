import React, { useState } from 'react';
import { api } from '../api/client';
import { 
  Upload, 
  Globe, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  RefreshCw
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

interface UploadInterfaceProps {
  onUploadSuccess: () => void;
}

type TabType = 'file' | 'url' | 'youtube' | 'text';

export const UploadInterface: React.FC<UploadInterfaceProps> = ({ onUploadSuccess }) => {
  const [activeTab, setActiveTab] = useState<TabType>('file');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Inputs
  const [url, setUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [textName, setTextName] = useState('');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const resetStatus = () => {
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    resetStatus();
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    resetStatus();

    try {
      const doc = await api.uploadFile(file);
      setSuccessMsg(`Successfully processed and indexed document: ${doc.name}`);
      setFile(null);
      // Reset input element
      const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      onUploadSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'File upload failed. Ensure the server is running and keys are valid.');
    } finally {
      setLoading(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    resetStatus();

    try {
      const doc = await api.addUrl(url);
      setSuccessMsg(`Successfully scraped and indexed website content: ${doc.name}`);
      setUrl('');
      onUploadSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Web scraping failed. Ensure FIRECRAWL_API_KEY is configured.');
    } finally {
      setLoading(false);
    }
  };

  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    setLoading(true);
    resetStatus();

    try {
      const doc = await api.addYoutube(youtubeUrl);
      setSuccessMsg(`Successfully transcribed and indexed YouTube video: ${doc.name}`);
      setYoutubeUrl('');
      onUploadSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'YouTube transcription failed. Ensure ASSEMBLYAI_API_KEY is configured.');
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textName.trim() || !textContent.trim()) return;
    setLoading(true);
    resetStatus();

    try {
      const doc = await api.addText(textName, textContent);
      setSuccessMsg(`Successfully embedded and indexed text: ${doc.name}`);
      setTextName('');
      setTextContent('');
      onUploadSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Text processing failed.');
    } finally {
      setLoading(false);
    }
  };

  const renderActiveForm = () => {
    switch (activeTab) {
      case 'file':
        return (
          <form onSubmit={handleFileUpload} className="space-y-6">
            <div className="border border-dashed border-zinc-800 rounded-2xl p-8 bg-zinc-950/40 hover:bg-zinc-950/60 transition-all flex flex-col items-center justify-center relative cursor-pointer group">
              <input
                type="file"
                id="file-upload-input"
                accept=".pdf,audio/*"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
                required
              />
              <div className="w-12 h-12 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <span className="text-zinc-200 font-semibold text-sm">
                {file ? file.name : 'Select or drop PDF or Audio files'}
              </span>
              <span className="text-zinc-500 text-xs mt-1.5 font-medium">
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Supports academic PDFs, raw notes, mp3, wav'}
              </span>
            </div>
            {file && (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-650 text-white rounded-xl py-3 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/15"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Ingest & Generating Vector Embeddings...</span>
                  </>
                ) : (
                  <>
                    <span>Process File</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </form>
        );

      case 'url':
        return (
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Website URL
              </label>
              <input
                type="url"
                required
                placeholder="https://example.com/article"
                className="w-full bg-zinc-950/40 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-2.5 px-4 text-white placeholder-zinc-500 text-sm outline-none transition-all"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/40 text-white rounded-xl py-3 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/15"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Scraping with Firecrawl & Embedding...</span>
                </>
              ) : (
                <>
                  <span>Scrape & Ingest URL</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        );

      case 'youtube':
        return (
          <form onSubmit={handleYoutubeSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                YouTube Video Link
              </label>
              <input
                type="url"
                required
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-zinc-950/40 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-2.5 px-4 text-white placeholder-zinc-500 text-sm outline-none transition-all"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !youtubeUrl.trim()}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/40 text-white rounded-xl py-3 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/15"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Downloading Audio & Generating Transcript (AssemblyAI)...</span>
                </>
              ) : (
                <>
                  <span>Transcribe & Ingest Video</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        );

      case 'text':
        return (
          <form onSubmit={handleTextSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Document Title
              </label>
              <input
                type="text"
                required
                placeholder="My Custom Notes"
                className="w-full bg-zinc-950/40 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-2.5 px-4 text-white placeholder-zinc-500 text-sm outline-none transition-all"
                value={textName}
                onChange={(e) => setTextName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Content
              </label>
              <textarea
                required
                rows={6}
                placeholder="Paste your notes or text document here..."
                className="w-full bg-zinc-950/40 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-2.5 px-4 text-white placeholder-zinc-500 text-sm outline-none transition-all resize-none"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !textName.trim() || !textContent.trim()}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/40 text-white rounded-xl py-3 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/15"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Splitting text chunks & indexing...</span>
                </>
              ) : (
                <>
                  <span>Add Document</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        );
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 select-none">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight m-0">Add Sources</h1>
        <p className="text-zinc-400 mt-2 text-sm">
          Load files, websites, video audio, or raw notes to build your notebook's grounding knowledge database.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 gap-1 bg-zinc-900/60 p-1.5 rounded-2xl max-w-lg">
        <button
          type="button"
          onClick={() => { setActiveTab('file'); resetStatus(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'file' ? 'bg-zinc-850 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          File Upload
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('url'); resetStatus(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'url' ? 'bg-zinc-850 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Web Page
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('youtube'); resetStatus(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'youtube' ? 'bg-zinc-850 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <YoutubeIcon className="w-3.5 h-3.5" />
          YouTube
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('text'); resetStatus(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'text' ? 'bg-zinc-850 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Raw Text
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-sm flex items-start gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm flex items-start gap-3 animate-headshake">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main card panel */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-3xl p-8 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
            <span className="text-zinc-350 text-xs font-semibold uppercase tracking-wider animate-pulse">Running Ingestion Pipeline</span>
          </div>
        )}
        {renderActiveForm()}
      </div>
    </div>
  );
};

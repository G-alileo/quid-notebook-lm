import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api/client';
import type { DocumentResponse, PodcastScriptResponse } from '../api/client';
import { 
  Sparkles, 
  Mic, 
  Settings, 
  Download, 
  PlayCircle,
  HelpCircle,
  RefreshCw,
  Clock,
  MessageSquare
} from 'lucide-react';

interface StudioInterfaceProps {
  sources: DocumentResponse[];
}

export const StudioInterface: React.FC<StudioInterfaceProps> = ({ sources }) => {
  const [selectedSource, setSelectedSource] = useState('');
  const [style, setStyle] = useState('Deep Dive');
  const [length, setLength] = useState('Medium (3-5 mins)');
  const [loadingScript, setLoadingScript] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [scriptData, setScriptData] = useState<PodcastScriptResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [segmentTimes, setSegmentTimes] = useState<{ startTime: number; endTime: number }[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (activeIndex !== null) {
      const element = document.getElementById(`dialogue-line-${activeIndex}`);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [activeIndex]);

  const handleLoadedMetadata = () => {
    if (!audioRef.current || !scriptData || !scriptData.script.length) return;
    const duration = audioRef.current.duration;
    const n = scriptData.script.length;
    const pauseDuration = 0.2;
    const totalPauses = (n - 1) * pauseDuration;
    const speakingDuration = Math.max(0, duration - totalPauses);

    const segmentTexts = scriptData.script.map((line) => {
      const speaker = Object.keys(line)[0];
      return line[speaker] || '';
    });
    const charCounts = segmentTexts.map((text) => text.length);
    const totalChars = charCounts.reduce((sum, c) => sum + c, 0) || 1;

    let currentStart = 0;
    const times = charCounts.map((chars, i) => {
      const segSpeaking = speakingDuration * (chars / totalChars);
      const segDuration = segSpeaking + (i < n - 1 ? pauseDuration : 0);
      const startTime = currentStart;
      const endTime = currentStart + segDuration;
      currentStart = endTime;
      return { startTime, endTime };
    });
    setSegmentTimes(times);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current || segmentTimes.length === 0) return;
    const currentTime = audioRef.current.currentTime;
    const idx = segmentTimes.findIndex(
      (time) => currentTime >= time.startTime && currentTime <= time.endTime
    );
    if (idx !== -1 && idx !== activeIndex) {
      setActiveIndex(idx);
    }
  };

  const handleLineClick = (idx: number) => {
    if (audioRef.current && segmentTimes[idx]) {
      audioRef.current.currentTime = segmentTimes[idx].startTime;
      audioRef.current.play().catch(() => {});
      setActiveIndex(idx);
    }
  };

  const handleGenerateScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSource) return;
    setLoadingScript(true);
    setErrorMsg('');
    setScriptData(null);
    setAudioUrl(null);
    setSegmentTimes([]);
    setActiveIndex(null);

    try {
      const res = await api.generateScript(selectedSource, style, length);
      setScriptData(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Script generation failed.');
    } finally {
      setLoadingScript(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!scriptData) return;
    setLoadingAudio(true);
    setErrorMsg('');
    setAudioUrl(null);
    setSegmentTimes([]);
    setActiveIndex(null);

    try {
      const res = await api.generateAudio(scriptData);
      setFilename(res.filename);
      
      // Fetch audio file as a Blob with authorization header and create local object URL
      const blob = await api.getAudioBlob(res.filename);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (err: any) {
      setErrorMsg(err.message || 'Audio synthesis failed. Note that Kokoro TTS requires a GPU host or pre-installed model components.');
    } finally {
      setLoadingAudio(false);
    }
  };

  const getSpeakerStyle = (speaker: string) => {
    const cleanSpeaker = speaker.toLowerCase();
    if (cleanSpeaker.includes('host') || cleanSpeaker.includes('expert 1') || cleanSpeaker.includes('narrator')) {
      return 'bg-violet-500/10 border-violet-500/20 text-violet-400';
    }
    return 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-400';
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 select-none">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight m-0">Podcast Studio</h1>
        <p className="text-zinc-400 mt-2 text-sm">
          Convert your static documents and reports into a fully voiced, multi-speaker audio conversation podcast script.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm flex items-start gap-3">
          <HelpCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Select document & options row */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden">
        <form onSubmit={handleGenerateScript} className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Select Source Document
            </label>
            <select
              required
              className="w-full bg-zinc-950/40 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-2.5 px-4 text-white text-sm outline-none transition-all cursor-pointer"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
            >
              <option value="" disabled>Choose a source...</option>
              {sources.map((src) => (
                <option key={src.id} value={src.name} className="bg-zinc-900">
                  {src.name} ({src.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Format Style
            </label>
            <select
              className="w-full bg-zinc-950/40 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-2.5 px-4 text-white text-sm outline-none transition-all cursor-pointer"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            >
              <option value="Deep Dive" className="bg-zinc-900">Deep Dive</option>
              <option value="Summary" className="bg-zinc-900">Summary</option>
              <option value="Debate" className="bg-zinc-900">Debate</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Duration Length
            </label>
            <select
              className="w-full bg-zinc-950/40 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-2.5 px-4 text-white text-sm outline-none transition-all cursor-pointer"
              value={length}
              onChange={(e) => setLength(e.target.value)}
            >
              <option value="Short (1-2 mins)" className="bg-zinc-900">Short</option>
              <option value="Medium (3-5 mins)" className="bg-zinc-900">Medium</option>
              <option value="Long (5-10 mins)" className="bg-zinc-900">Long</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={loadingScript || !selectedSource}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/40 text-white rounded-xl py-3 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/15"
            >
              {loadingScript ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Scripting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Script</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Script & Voice Dashboard */}
      {scriptData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          
          {/* Script Details Card */}
          <div className="md:col-span-1 bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 space-y-6">
            <h3 className="text-sm font-bold text-white tracking-wider uppercase flex items-center gap-2">
              <Settings className="w-4 h-4 text-violet-400" />
              Podcast Details
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center bg-zinc-950/30 p-3 rounded-xl border border-zinc-850">
                <span className="text-zinc-500 text-xs font-semibold">Total Dialog Lines</span>
                <span className="text-white text-xs font-bold bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700">{scriptData.total_lines}</span>
              </div>

              <div className="flex justify-between items-center bg-zinc-950/30 p-3 rounded-xl border border-zinc-850">
                <span className="text-zinc-500 text-xs font-semibold">Estimated Length</span>
                <span className="text-white text-xs font-bold flex items-center gap-1.5 text-violet-400 bg-violet-500/5 px-2.5 py-1 rounded-lg border border-violet-500/10">
                  <Clock className="w-3.5 h-3.5" />
                  {scriptData.estimated_duration}
                </span>
              </div>
            </div>

            {/* Synthesize Audio Button */}
            {!audioUrl ? (
              <button
                type="button"
                onClick={handleGenerateAudio}
                disabled={loadingAudio}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 text-white rounded-xl py-3.5 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/15"
              >
                {loadingAudio ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Synthesizing Voice (Kokoro)...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Synthesize Audio</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-4 bg-zinc-950/30 p-4 rounded-2xl border border-zinc-850 text-center">
                <span className="text-emerald-400 text-xs font-bold flex items-center justify-center gap-1">
                  <PlayCircle className="w-4 h-4" />
                  Audio Synthesized Successfully
                </span>

                <audio
                  ref={audioRef}
                  controls
                  className="w-full bg-zinc-950 rounded-lg outline-none"
                  src={audioUrl}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                ></audio>

                <a
                  href={audioUrl}
                  download={filename}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white py-2 px-4 rounded-xl text-xs font-semibold border border-zinc-700 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download WAV Podcast
                </a>
              </div>
            )}
          </div>

          {/* Script Dialogue Timeline */}
          <div className="md:col-span-2 bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 flex flex-col h-[500px]">
            <h3 className="text-sm font-bold text-white tracking-wider uppercase flex items-center gap-2 mb-4 shrink-0">
              <MessageSquare className="w-4 h-4 text-violet-400" />
              Dialogue Script Preview
            </h3>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {scriptData.script.map((line, idx) => {
                const speaker = Object.keys(line)[0];
                const text = line[speaker];
                const isActive = idx === activeIndex;
                const isClickable = segmentTimes.length > 0;
                return (
                  <div
                    key={idx}
                    id={`dialogue-line-${idx}`}
                    onClick={() => isClickable && handleLineClick(idx)}
                    className={`flex gap-4 items-start p-4 rounded-2xl border transition-all duration-300 ${
                      isActive
                        ? 'border-violet-500 bg-violet-650/15 shadow-md shadow-violet-600/5'
                        : `bg-zinc-950/15 border-zinc-850 ${
                            isClickable
                              ? 'cursor-pointer hover:bg-zinc-800/40 hover:border-zinc-800'
                              : ''
                          }`
                    }`}
                  >
                    <div className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border shrink-0 mt-0.5 ${getSpeakerStyle(speaker)}`}>
                      {speaker}
                    </div>
                    <div className="text-zinc-200 text-xs leading-relaxed font-normal">
                      {text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

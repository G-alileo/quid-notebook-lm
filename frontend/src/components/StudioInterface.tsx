import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api/client';
import type { DocumentResponse, PodcastScriptResponse } from '../api/client';
import { 
  Sparkles, 
  Mic, 
  Settings, 
  Download, 
  HelpCircle,
  RefreshCw,
  Clock,
  MessageSquare,
  Menu,
  BookOpen,
  Compass,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ChevronRight,
  Info
} from 'lucide-react';

interface StudioInterfaceProps {
  sources: DocumentResponse[];
  onOpenMenu?: () => void;
}

export const StudioInterface: React.FC<StudioInterfaceProps> = ({ sources, onOpenMenu }) => {
  const [selectedSource, setSelectedSource] = useState('');
  const [style, setStyle] = useState('Deep Dive');
  const [length, setLength] = useState('Medium (3-5 mins)');
  const [loadingScript, setLoadingScript] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [scriptData, setScriptData] = useState<PodcastScriptResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Custom Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

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
    const dur = audioRef.current.duration;
    setDuration(dur);
    
    const n = scriptData.script.length;
    const pauseDuration = 0.2;
    const totalPauses = (n - 1) * pauseDuration;
    const speakingDuration = Math.max(0, dur - totalPauses);

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
    if (!audioRef.current) return;
    const curr = audioRef.current.currentTime;
    setCurrentTime(curr);

    if (segmentTimes.length === 0) return;
    const idx = segmentTimes.findIndex(
      (time) => curr >= time.startTime && curr <= time.endTime
    );
    if (idx !== -1 && idx !== activeIndex) {
      setActiveIndex(idx);
    }
  };

  const handleLineClick = (idx: number) => {
    if (audioRef.current && segmentTimes[idx]) {
      audioRef.current.currentTime = segmentTimes[idx].startTime;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
      setActiveIndex(idx);
    }
  };

  // Custom Audio Controls
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const val = parseFloat(e.target.value);
    audioRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const val = parseFloat(e.target.value);
    audioRef.current.volume = val;
    setVolume(val);
    if (val > 0 && isMuted) {
      audioRef.current.muted = false;
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const muted = !isMuted;
    audioRef.current.muted = muted;
    setIsMuted(muted);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
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
    setIsPlaying(false);

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
    setIsPlaying(false);

    try {
      const res = await api.generateAudio(scriptData);
      setFilename(res.filename);
      
      const blob = await api.getAudioBlob(res.filename);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (err: any) {
      setErrorMsg(err.message || 'Audio synthesis failed. Note that Kokoro TTS requires a GPU host or pre-installed model components.');
    } finally {
      setLoadingAudio(false);
    }
  };

  const getSpeakerColor = (speaker: string) => {
    const cleanSpeaker = speaker.toLowerCase();
    if (cleanSpeaker.includes('host') || cleanSpeaker.includes('expert 1') || cleanSpeaker.includes('narrator')) {
      return {
        bg: 'bg-violet-650/10 border-violet-500/20 text-violet-400',
        avatarBg: 'bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/25',
        bubbleBorder: 'border-violet-500/30 bg-violet-950/5',
        activeBorder: 'border-violet-500 bg-violet-650/15 shadow-violet-600/10 shadow-md',
      };
    }
    return {
      bg: 'bg-fuchsia-650/10 border-fuchsia-500/20 text-fuchsia-400',
      avatarBg: 'bg-gradient-to-br from-fuchsia-500 to-pink-600 shadow-fuchsia-500/25',
      bubbleBorder: 'border-fuchsia-500/30 bg-fuchsia-950/5',
      activeBorder: 'border-fuchsia-500 bg-fuchsia-650/15 shadow-fuchsia-600/10 shadow-md',
    };
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 select-none">
      
      {/* Header */}
      <div className="flex items-center gap-4 bg-zinc-900/40 border border-zinc-800/80 p-5 rounded-2xl">
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            className="lg:hidden text-zinc-400 hover:text-white p-2 hover:bg-zinc-800 rounded-xl transition-all cursor-pointer shrink-0"
          >
            <Menu className="w-6 h-6" />
          </button>
        )}
        <div className="w-12 h-12 bg-violet-500/10 border border-violet-500/25 text-violet-400 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/5">
          <Mic className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight m-0 flex items-center gap-2">
            Podcast Studio Console
          </h1>
          <p className="text-zinc-400 mt-1 text-xs md:text-sm max-w-2xl leading-relaxed">
            Convert static sources into highly-engaging conversational scripts and voices. Adjust formatting options and download your fully synthesis audio.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm flex items-start gap-3 shadow-lg shadow-red-500/5 animate-headshake">
          <HelpCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Control Console */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        <form onSubmit={handleGenerateScript} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          
          {/* Source selector */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-violet-400" />
              Select Source Document
            </label>
            <select
              required
              className="w-full h-11 bg-zinc-950/60 border border-zinc-850 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl px-4 text-white text-sm outline-none transition-all cursor-pointer shadow-inner"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
            >
              <option value="" disabled className="bg-zinc-950">Choose a source to transcribe...</option>
              {sources.map((src) => (
                <option key={src.id} value={src.name} className="bg-zinc-900">
                  {src.name} ({src.type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Custom Segmented Style Tabs */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-violet-400" />
              Format Style
            </label>
            <div className="flex h-11 bg-zinc-950/60 p-1 border border-zinc-850 rounded-xl items-center">
              {['Deep Dive', 'Summary', 'Debate'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={`flex-1 h-full flex items-center justify-center text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    style === s 
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-600/10'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Segmented Length Tabs */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-400" />
              Duration Length
            </label>
            <div className="flex h-11 bg-zinc-950/60 p-1 border border-zinc-850 rounded-xl items-center">
              {[
                { label: 'Short', value: 'Short (1-2 mins)' },
                { label: 'Medium', value: 'Medium (3-5 mins)' },
                { label: 'Long', value: 'Long (5-10 mins)' }
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setLength(item.value)}
                  className={`flex-1 h-full flex items-center justify-center text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    length === item.value
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-600/10'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-transparent select-none pointer-events-none">
              &nbsp;
            </label>
            <button
              type="submit"
              disabled={loadingScript || !selectedSource}
              className="w-full h-11 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/40 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20 hover:shadow-violet-600/35"
            >
              {loadingScript ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Scripting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Podcast</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>

      {/* Main Studio Area */}
      {!scriptData && !loadingScript ? (
        
        /* Empty State */
        <div className="bg-zinc-900/35 border border-zinc-850 p-12 rounded-3xl text-center space-y-6 max-w-3xl mx-auto relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-violet-500/5 rounded-full blur-[80px]"></div>
          <div className="w-16 h-16 bg-zinc-950 border border-zinc-850 rounded-2xl flex items-center justify-center text-zinc-450 mx-auto shadow-inner">
            <Mic className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-white text-lg font-bold">No podcast generated yet</h2>
            <p className="text-zinc-400 text-xs md:text-sm max-w-md mx-auto leading-relaxed">
              Select a source document above and choose your style preferences to draft a multi-speaker audio conversation script.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto pt-4">
            <div className="p-3.5 bg-zinc-950/20 border border-zinc-850/60 rounded-2xl">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-violet-400">Step 1</span>
              <span className="block text-[11px] text-zinc-300 mt-1 font-medium">Select Source</span>
            </div>
            <div className="p-3.5 bg-zinc-950/20 border border-zinc-850/60 rounded-2xl">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-violet-400">Step 2</span>
              <span className="block text-[11px] text-zinc-300 mt-1 font-medium">Format Style</span>
            </div>
            <div className="p-3.5 bg-zinc-950/20 border border-zinc-850/60 rounded-2xl">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-violet-400">Step 3</span>
              <span className="block text-[11px] text-zinc-300 mt-1 font-medium">Voices Synthesis</span>
            </div>
          </div>
        </div>

      ) : loadingScript ? (

        /* Loading script skeleton */
        <div className="p-8 bg-zinc-900/30 border border-zinc-850 rounded-3xl flex flex-col items-center justify-center space-y-4 min-h-[300px]">
          <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
          <p className="text-zinc-400 text-xs font-semibold tracking-wide uppercase">Drafting Dialogue Conversation...</p>
        </div>

      ) : (

        /* Script Data Loaded Workspace */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Panel: Audio Player & Metadata controls */}
          <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 space-y-6 shadow-xl sticky top-6">
            
            <h3 className="text-xs font-bold text-white tracking-wider uppercase flex items-center gap-2">
              <Settings className="w-4 h-4 text-violet-400" />
              Podcast Details
            </h3>

            {/* Performance Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-950/50 p-4 border border-zinc-850 rounded-2xl text-center">
                <span className="block text-zinc-500 text-[9px] uppercase font-bold tracking-wider">Dialogue Lines</span>
                <span className="block text-xl font-bold text-white mt-1">{scriptData.total_lines}</span>
              </div>

              <div className="bg-zinc-950/50 p-4 border border-zinc-850 rounded-2xl text-center">
                <span className="block text-zinc-500 text-[9px] uppercase font-bold tracking-wider">Estimated Length</span>
                <span className="block text-xl font-bold text-violet-400 mt-1 flex items-center justify-center gap-1">
                  <Clock className="w-4.5 h-4.5" />
                  {scriptData.estimated_duration.replace('mins', 'min')}
                </span>
              </div>
            </div>

            {/* Audio Section */}
            <div className="space-y-4">
              
              {/* Synthesize triggering */}
              {!audioUrl ? (
                <button
                  type="button"
                  onClick={handleGenerateAudio}
                  disabled={loadingAudio}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 text-white rounded-xl py-3.5 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/35"
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
                
                /* Custom Premium Audio Player UI */
                <div className="bg-zinc-950/55 p-4 rounded-2xl border border-zinc-850 space-y-4 shadow-inner">
                  
                  {/* Hidden Native Audio Element */}
                  <audio
                    ref={audioRef}
                    className="hidden"
                    src={audioUrl}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => setIsPlaying(false)}
                  />

                  {/* Header Title with animated wave visualizer */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                      Audio Synthesized
                    </span>
                    
                    {/* Bouncing Audio Bars */}
                    <div className="flex items-end gap-[3px] h-4">
                      {[...Array(6)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-[2.5px] bg-violet-400 rounded-full transition-all duration-300 ${
                            isPlaying ? 'animate-wave-bar' : 'h-1'
                          }`}
                          style={{
                            height: isPlaying ? '100%' : '3px',
                            animationDelay: `${i * 0.15}s`,
                            animationDuration: `${0.7 + (i % 3) * 0.25}s`
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Custom progress slider */}
                  <div className="space-y-1">
                    <input
                      type="range"
                      min={0}
                      max={duration || 1}
                      step={0.05}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1 bg-zinc-850 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-500 font-semibold">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Play & Vol controls */}
                  <div className="flex items-center justify-between gap-4">
                    
                    {/* Volume Button */}
                    <div className="flex items-center gap-2 group">
                      <button
                        type="button"
                        onClick={toggleMute}
                        className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-16 h-1 bg-zinc-850 rounded-lg appearance-none cursor-pointer accent-violet-500"
                      />
                    </div>

                    {/* Play/Pause Button */}
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="w-10 h-10 bg-violet-650 hover:bg-violet-600 text-white rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-violet-600/20 active:scale-95"
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>

                  </div>

                  {/* Download trigger */}
                  <a
                    href={audioUrl}
                    download={filename}
                    className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-zinc-850 hover:bg-zinc-800 border border-zinc-805 text-zinc-200 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-450" />
                    Download WAV Audio
                  </a>

                </div>
              )}

              {/* Source Document Reference */}
              <div className="bg-zinc-950/30 p-4 border border-zinc-850 rounded-2xl space-y-2">
                <span className="block text-zinc-500 text-[9px] uppercase font-bold tracking-wider">Source Reference</span>
                <span className="block text-zinc-200 text-xs font-semibold truncate leading-tight">{scriptData.source_document}</span>
              </div>

              {/* Synthesis Note Info */}
              {loadingAudio && (
                <div className="p-3.5 bg-violet-500/5 border border-violet-500/10 text-violet-400 rounded-xl text-[11px] leading-relaxed flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Synthesizing voice dialog tracks. This may take up to a minute as we stitch multiple audio snippets together.</span>
                </div>
              )}

            </div>
          </div>

          {/* Right Panel: Scrollable timeline of dialogue scripts */}
          <div className="lg:col-span-8 bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 flex flex-col h-[600px] shadow-2xl">
            
            <h3 className="text-xs font-bold text-white tracking-wider uppercase flex items-center gap-2 mb-4 shrink-0">
              <MessageSquare className="w-4 h-4 text-violet-400" />
              Dialogue Script Timeline
            </h3>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {scriptData.script.map((line, idx) => {
                const speaker = Object.keys(line)[0];
                const text = line[speaker];
                const isActive = idx === activeIndex;
                const isClickable = segmentTimes.length > 0;
                const colors = getSpeakerColor(speaker);
                
                // Initials for avatar
                const initials = speaker.substring(0, 2).toUpperCase();

                return (
                  <div
                    key={idx}
                    id={`dialogue-line-${idx}`}
                    onClick={() => isClickable && handleLineClick(idx)}
                    className={`flex gap-4 items-start p-4 rounded-2xl border transition-all duration-300 group ${
                      isActive 
                        ? colors.activeBorder 
                        : `bg-zinc-950/20 ${colors.bubbleBorder} ${
                            isClickable 
                              ? 'cursor-pointer hover:bg-zinc-850/40 hover:border-zinc-800' 
                              : ''
                          }`
                    }`}
                  >
                    {/* Circle Avatar badge */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-md ${colors.avatarBg}`}>
                      {initials}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      
                      {/* Name of speaker */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-400">
                          {speaker}
                        </span>
                        
                        {/* Status wave or jump info */}
                        {isActive ? (
                          <span className="text-[9px] font-bold text-violet-450 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="inline-block w-1.5 h-1.5 bg-violet-500 rounded-full animate-ping"></span>
                            Speaking
                          </span>
                        ) : (
                          isClickable && (
                            <span className="text-[9px] font-bold text-zinc-500 group-hover:text-violet-450 opacity-0 group-hover:opacity-100 transition-all uppercase tracking-widest flex items-center gap-1">
                              Jump to time
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          )
                        )
                        }
                      </div>

                      {/* Content line */}
                      <div className={`text-zinc-200 text-xs md:text-sm leading-relaxed ${isActive ? 'font-medium text-white' : 'font-normal'}`}>
                        {text}
                      </div>

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

import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api/client';
import type { ChatSource } from '../api/client';
import { MessageSquare, Send, Sparkles, BookOpen, Trash2, Menu } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
}

interface ChatInterfaceProps {
  onSelectPDFPage?: (fileName: string, pageNumber: number) => void;
  onOpenMenu?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onSelectPDFPage, onOpenMenu }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load chat history from localStorage on mount if desired
    const saved = localStorage.getItem('quid_chat_history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const saveHistory = (newMessages: ChatMessage[]) => {
    setMessages(newMessages);
    localStorage.setItem('quid_chat_history', JSON.stringify(newMessages));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    setLoading(true);

    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: userText,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Create assistant message placeholder
    const assistantMsgId = Math.random().toString(36).substring(7);
    let assistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      sources: []
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      await api.queryChatStream(userText, (data) => {
        if (data.sources_used) {
          assistantMessage.sources = data.sources_used;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...assistantMessage } : m))
          );
        }
        if (data.token) {
          assistantMessage.content += data.token;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...assistantMessage } : m))
          );
        }
      });

      // Save complete history to storage
      setMessages((prev) => {
        const history = [...prev];
        localStorage.setItem('quid_chat_history', JSON.stringify(history));
        return history;
      });

    } catch (err: any) {
      assistantMessage.content = `Error: ${err.message || 'Failed to process request.'}`;
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...assistantMessage } : m))
      );
      setMessages((prev) => {
        const history = [...prev];
        localStorage.setItem('quid_chat_history', JSON.stringify(history));
        return history;
      });
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    saveHistory([]);
    localStorage.removeItem('quid_chat_history');
  };

  // Render citation tooltips
  const renderMessageContent = (content: string, sources?: ChatSource[]) => {
    if (!sources || sources.length === 0) {
      return <p className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed m-0">{content}</p>;
    }

    const citationRegex = /(\[\d+\])/g;
    const parts = content.split(citationRegex);

    return (
      <p className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed m-0">
        {parts.map((part, index) => {
          const isCitation = citationRegex.test(part);
          if (isCitation) {
            const refNumber = part; // e.g. "[1]"
            const matchedSource = sources.find(
              (src) => src.reference === refNumber || src.reference.includes(refNumber.replace(/[\[\]]/g, ''))
            );

            if (matchedSource) {
              const isPdf = matchedSource.source_type.toLowerCase() === 'pdf';
              return (
                <span
                  key={index}
                  className="relative inline-block group mx-0.5 animate-fade-in"
                >
                  <span
                    onClick={() => {
                      if (onSelectPDFPage && isPdf && matchedSource.page_number) {
                        onSelectPDFPage(matchedSource.source_file, matchedSource.page_number);
                      }
                    }}
                    className={`text-violet-400 font-bold bg-violet-500/10 border border-violet-500/20 rounded-md px-1.5 py-0.5 text-xs select-none hover:bg-violet-500/25 transition-colors ${
                      isPdf && matchedSource.page_number ? 'cursor-pointer hover:border-violet-400/55' : 'cursor-help'
                    }`}
                  >
                    {refNumber}
                  </span>
                  
                  {/* Tooltip Overlay */}
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-zinc-950/95 border border-zinc-800 p-3.5 rounded-xl shadow-2xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 z-50 flex flex-col gap-1.5 text-xs text-zinc-300 font-normal">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        Reference Details
                      </span>
                      <span className="text-[10px] bg-violet-600/20 text-violet-400 font-semibold px-2 py-0.5 rounded-full border border-violet-500/20 uppercase tracking-wider">
                        Match: {(matchedSource.relevance_score * 100).toFixed(0)}%
                      </span>
                    </span>
                    <span className="text-zinc-400 font-medium break-all mt-1">
                      File: {matchedSource.source_file}
                    </span>
                    <span className="flex items-center justify-between text-[10px] text-zinc-550 uppercase tracking-wider font-bold mt-1">
                      <span>Type: {matchedSource.source_type}</span>
                      {matchedSource.page_number && <span>Page: {matchedSource.page_number}</span>}
                    </span>
                    {isPdf && matchedSource.page_number && (
                      <span className="text-[10px] text-violet-400 text-center font-semibold bg-violet-500/5 border border-violet-500/10 py-1.5 rounded-lg mt-2 cursor-pointer hover:bg-violet-500/15">
                        Click citation to focus page
                      </span>
                    )}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-zinc-950"></span>
                  </span>
                </span>
              );
            }
          }
          return part;
        })}
      </p>
    );
  };

  return (
    <div className="flex flex-col h-screen select-none bg-zinc-950 overflow-hidden relative">
      {/* Decorative gradient overlay */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-violet-600/5 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Header bar */}
      <header className="p-4 md:p-6 border-b border-zinc-900 bg-zinc-950/40 flex items-center justify-between shrink-0 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          {onOpenMenu && (
            <button
              type="button"
              onClick={onOpenMenu}
              className="lg:hidden text-zinc-400 hover:text-white p-2 hover:bg-zinc-900 rounded-xl transition-all cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="w-9 h-9 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-xl flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold text-white tracking-tight m-0 truncate">Notebook Assistant</h1>
            <p className="text-zinc-500 text-[10px] md:text-xs mt-0.5 font-medium truncate">Grounded RAG answering with verifiable citations</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            className="text-zinc-500 hover:text-red-400 p-2 rounded-lg hover:bg-zinc-900 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        )}
      </header>

      {/* Scrollable messages container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 relative z-10">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center mt-20 p-8 border border-dashed border-zinc-850 bg-zinc-900/10 rounded-3xl select-none">
            <div className="w-14 h-14 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight m-0">Ask your Documents</h2>
            <p className="text-zinc-500 text-sm mt-3 leading-relaxed max-w-md mx-auto">
              Submit a question to extract key ideas and insights. Every response includes clickable source citations linking to original pages and snippets.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 shadow-lg">
                    AI
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl p-4.5 border transition-all ${
                    msg.role === 'user'
                      ? 'bg-violet-650/90 border-violet-500/30 text-white shadow-xl shadow-violet-600/5'
                      : 'bg-zinc-900/80 border-zinc-800/80 text-zinc-100 shadow-md'
                  }`}
                >
                  {renderMessageContent(msg.content, msg.sources)}

                  {/* Sources display at bottom of assistant responses */}
                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-3.5 border-t border-zinc-800/60">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                        Retrieved Sources ({msg.sources.length})
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((src, i) => (
                          <div
                            key={i}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-950 border border-zinc-850 rounded-lg text-[10px] text-zinc-400 font-semibold max-w-xs"
                          >
                            <span className="w-1.5 h-1.5 bg-violet-500 rounded-full shrink-0"></span>
                            <span className="truncate" title={src.source_file}>
                              {src.source_file.split('/').pop()}
                            </span>
                            {src.page_number && (
                              <span className="text-zinc-650 bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">
                                P. {src.page_number}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-4 justify-start">
                <div className="w-8 h-8 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                  AI
                </div>
                <div className="bg-zinc-900/80 border border-zinc-850 rounded-2xl p-4 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2.5 h-2.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2.5 h-2.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form Footer */}
      <footer className="p-4 md:p-6 border-t border-zinc-900 bg-zinc-950/40 shrink-0 relative z-10">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex gap-3 relative">
          <input
            type="text"
            required
            disabled={loading}
            placeholder="Ask anything about your documents..."
            className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-3.5 px-5 text-white placeholder-zinc-500 text-sm outline-none transition-all pr-14"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg transition-all flex items-center justify-center cursor-pointer shadow-md shadow-violet-650/10"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
};

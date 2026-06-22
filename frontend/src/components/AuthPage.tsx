import React, { useState } from 'react';
import { api } from '../api/client';
import { LogIn, UserPlus, Lock, Mail, User, ShieldAlert } from 'lucide-react';

interface AuthPageProps {
  onSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await api.login(username, password);
      } else {
        await api.register(username, email, password, fullName || undefined);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 relative overflow-hidden select-none">
      {/* Decorative gradient glowing spheres */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>

      <div className="w-full max-w-md bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-8 shadow-2xl relative z-10 transition-all duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-violet-500/10 border border-violet-500/30 rounded-xl mb-4 text-violet-400">
            <LogIn className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white m-0">Quid Notebook</h1>
          <p className="text-zinc-400 mt-2 text-sm">Transform static documents into interactive AI environments</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-zinc-800 mb-6 bg-zinc-950/40 p-1 rounded-lg">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
              isLogin ? 'bg-zinc-850 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            onClick={() => {
              setIsLogin(true);
              setError('');
            }}
          >
            <LogIn className="w-4 h-4" />
            Login
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
              !isLogin ? 'bg-zinc-850 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            onClick={() => {
              setIsLogin(false);
              setError('');
            }}
          >
            <UserPlus className="w-4 h-4" />
            Register
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-start gap-3 animate-headshake">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-zinc-500 text-sm outline-none transition-all"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          {!isLogin && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-zinc-500 text-sm outline-none transition-all"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-zinc-500 text-sm outline-none transition-all"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-zinc-500 text-sm outline-none transition-all"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white rounded-xl py-3 font-semibold text-sm transition-all duration-200 shadow-lg shadow-violet-600/20 hover:shadow-violet-600/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/35 border-t-white rounded-full animate-spin"></span>
            ) : (
              <span>{isLogin ? 'Login to Dashboard' : 'Create Account'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

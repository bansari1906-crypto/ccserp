import React, { useState } from 'react';
import { ChitraLogo } from './common/ChitraLogo';
import { authApi } from '../api/client';
import { User } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both User ID and Password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(username.trim(), password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid User ID or Password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center items-center p-4 selection:bg-[#16a34a] selection:text-white font-body">
      <div className="w-full max-w-md bg-white border border-[#cbd5e1] shadow-2xl rounded-2xl p-8 transition-all">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-7 text-center">
          <ChitraLogo variant="horizontal" size="lg" showTagline={true} />
          <h1 className="text-2xl font-black text-[#0f172a] mt-4 tracking-tight uppercase">
            CCS CONNECT
          </h1>
          <p className="text-xs text-[#64748b] mt-1 font-medium">
            Sign in with your authorized credentials to access your portal
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-5 p-3.5 bg-[#fef2f2] border border-[#fca5a5] text-[#b91c1c] text-xs font-semibold rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form: User ID & Password ONLY */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#334155] uppercase tracking-wider mb-1.5">
              User ID
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#94a3b8]">
                person
              </span>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter User ID"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-[#cbd5e1] rounded-lg focus:ring-2 focus:ring-[#16a34a] focus:border-[#16a34a] outline-none transition text-[#0f172a] font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#334155] uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#94a3b8]">
                lock
              </span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Password"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-[#cbd5e1] rounded-lg focus:ring-2 focus:ring-[#16a34a] focus:border-[#16a34a] outline-none transition text-[#0f172a]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#16a34a] hover:bg-[#15803d] text-white font-extrabold py-3 px-4 text-sm rounded-lg transition duration-150 shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            {loading ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                <span>AUTHENTICATING...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">login</span>
                <span>LOGIN</span>
              </>
            )}
          </button>
        </form>

        {/* APK Download Link */}
        <div className="mt-6 pt-4 border-t border-[#e2e8f0] text-center">
          <a
            href="https://docs-organizational-beverages-improve.trycloudflare.com/downloads/CCS-Connect.apk"
            download="CCS-Connect.apk"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#16a34a] hover:text-[#15803d] hover:underline transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">android</span>
            <span>Download CCS Connect Android App</span>
          </a>
        </div>

        <p className="text-center text-[10px] text-[#94a3b8] mt-3">
          CCS Connect • Secured by Django Authentication & PostgreSQL
        </p>
      </div>
    </div>
  );
};

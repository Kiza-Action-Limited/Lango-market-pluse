import React, { useState } from 'react';
import { FaEnvelope, FaEye, FaEyeSlash, FaLock, FaShieldAlt } from 'react-icons/fa';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import marketPulseLogo from '../assets/Marketpulse-logo.png';

const ADMIN_LOGIN_EMAIL = String(import.meta.env.VITE_ADMIN_LOGIN_EMAIL || 'admin@langomarket.com').toLowerCase();

const AdminLogin = () => {
  const { login, logout, isAuthenticated, isAdmin, isSeller, loading } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!identifier.trim() || !password) return;
    const normalizedIdentifier = identifier.trim().toLowerCase();

    if (normalizedIdentifier !== ADMIN_LOGIN_EMAIL) {
      toast.error('Only authorized admin credentials are allowed on this portal.');
      return;
    }

    setSubmitting(true);
    const result = await login(identifier.trim(), password);

    if (result.success) {
      const role = String(result?.user?.role || '').toLowerCase();
      if (role !== 'admin') {
        logout();
        toast.error('Only admin accounts can sign in here.');
        setSubmitting(false);
        return;
      }
      navigate('/admin/dashboard', { replace: true });
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to={isSeller ? '/seller' : '/'} replace />;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-200 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
        <img src={marketPulseLogo} alt="Market Pulse" className="mx-auto h-16 w-auto" />
        <div className="mt-5 text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            <FaShieldAlt />
            Admin Portal
          </p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Admin Sign In</h1>
          <p className="mt-1 text-sm text-slate-500">Use your administrator credentials to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="relative">
            <FaEnvelope className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Admin email or phone"
              className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            />
          </div>

          <div className="relative">
            <FaLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'Signing in...' : 'Sign In to Admin'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;

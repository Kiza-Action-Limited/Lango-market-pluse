import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaArrowLeft, FaEnvelope, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import { authService } from '../services/authService';
import { validateEmail, validatePassword } from '../utils/validators';
import { mockAdminUsers } from '../data/mockData';

const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const hasToken = useMemo(() => token.trim().length > 0, [token]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const matchesMockEmail = (value) =>
    mockAdminUsers.some((user) => String(user?.email || '').toLowerCase() === String(value || '').toLowerCase());

  const handleSendReset = async (e) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      toast.error('Enter a valid email address');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    setLoading(true);
    try {
      let accountExists = false;

      try {
        const accountMatch = await authService.checkEmailAccount(cleanEmail);
        accountExists = !!accountMatch?.exists;
      } catch (checkError) {
        accountExists = matchesMockEmail(cleanEmail);
      }

      if (!accountExists) {
        toast.error('No account found with this email address');
        return;
      }

      await authService.forgotPassword(cleanEmail);
      setDone(true);
      toast.success('OTP code is send to your email. Please check your inbox.');
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to send OTP verification email';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!validatePassword(password)) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
      toast.success('Password reset successful. You can login now.');
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to reset password';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-linear-to-br from-[#F9FAFB] to-[#E5E7EB] py-8 px-4">
      <div className="w-full max-w-md bg-white border border-[#F97316]/15 rounded-2xl shadow-md p-6">
        <div className="mb-4">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#F97316]">
            <FaArrowLeft size={12} />
            Back to login
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-[#111827]">
          {hasToken ? 'Reset Password' : 'Forgot Password'}
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          {hasToken
            ? 'Enter your new password to restore access to your account.'
            : 'Enter your email and we will send a password reset link.'}
        </p>

        {!hasToken && !done && (
          <form onSubmit={handleSendReset} className="mt-5 space-y-4">
            <div className="relative">
              <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email address"
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-[#F97316] text-white font-semibold hover:bg-[#EA580C] disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        {hasToken && !done && (
          <form onSubmit={handleResetPassword} className="mt-5 space-y-4">
            <div className="relative">
              <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="New password"
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#F97316]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
              </button>
            </div>
            <div className="relative">
              <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm new password"
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#F97316]"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-[#F97316] text-white font-semibold hover:bg-[#EA580C] disabled:opacity-60"
            >
              {loading ? 'Updating...' : 'Reset password'}
            </button>
          </form>
        )}

        {done && (
          <div className="mt-5 rounded-lg border border-[#16A34A]/20 bg-[#16A34A]/5 p-4">
            <p className="text-sm text-[#166534] font-medium">
              {hasToken
                ? 'Your password has been updated successfully.'
                : 'If your email exists, a reset link has been sent.'}
            </p>
            <Link to="/login" className="inline-block mt-3 text-sm font-semibold text-[#F97316] hover:underline">
              Go to login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;

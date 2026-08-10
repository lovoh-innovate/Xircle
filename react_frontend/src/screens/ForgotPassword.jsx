// pages/ForgotPassword.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForgotPasswordMutation, useResetPasswordMutation } from '../slices/userApiSlice';
import { toast } from 'react-hot-toast';
import { FaEnvelope, FaLock, FaArrowLeft, FaCheckCircle } from 'react-icons/fa';

const ForgotPassword = () => {
  const [step, setStep] = useState('request'); // 'request' | 'reset' | 'success'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const [forgotPassword, { isLoading: isForgotLoading }] = useForgotPasswordMutation();
  const [resetPassword, { isLoading: isResetLoading }] = useResetPasswordMutation();

  // Handle step transitions
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address.');
      return;
    }
    try {
      setIsLoading(true);
      await forgotPassword({ email }).unwrap();
      toast.success('OTP sent to your email!');
      setStep('reset');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp || !newPassword || !confirmPassword) {
      toast.error('Please fill in all fields.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    try {
      setIsLoading(true);
      await resetPassword({ email, otp, newPassword }).unwrap();
      toast.success('Password reset successfully! You can now login.');
      setStep('success');
      // Optionally redirect after a few seconds
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render steps ────────────────────────────────────────────────

  const renderForm = () => {
    if (step === 'success') {
      return (
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <FaCheckCircle className="w-8 h-8 text-green-500 dark:text-green-400" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Password Reset Successful!</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Your password has been reset. You will be redirected to login.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-block text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
          >
            Go to Login →
          </Link>
        </div>
      );
    }

    if (step === 'reset') {
      return (
        <form onSubmit={handleResetPassword} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              OTP Code
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaLock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="block w-full pl-10 pr-3 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors duration-200 text-gray-900 dark:text-white"
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaLock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors duration-200 text-gray-900 dark:text-white"
                placeholder="Enter new password"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaLock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors duration-200 text-gray-900 dark:text-white"
                placeholder="Confirm new password"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep('request')}
              className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium transition-colors duration-200 flex items-center gap-1"
            >
              <FaArrowLeft size={12} /> Back
            </button>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              {showPassword ? 'Hide' : 'Show'} passwords
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading || isResetLoading}
            className="w-full flex items-center justify-center px-4 py-3 bg-teal-600 dark:bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-700 dark:hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading || isResetLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Resetting...</span>
              </div>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      );
    }

    // Step: request
    return (
      <form onSubmit={handleRequestOTP} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaEnvelope className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full pl-10 pr-3 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors duration-200 text-gray-900 dark:text-white"
              placeholder="you@example.com"
              required
            />
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            We'll send a 6-digit OTP to your email to reset your password.
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading || isForgotLoading}
          className="w-full flex items-center justify-center px-4 py-3 bg-teal-600 dark:bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-700 dark:hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading || isForgotLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Sending OTP...</span>
            </div>
          ) : (
            'Send OTP'
          )}
        </button>
      </form>
    );
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-[#0b0b10]">
      {/* Left Side - Brand Image (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Overlay – adapts to dark/light */}
          <div className="absolute inset-0 bg-gradient-to-br from-teal-700/90 dark:from-[#0b0b10]/95 to-teal-500/80 dark:to-[#0d9488]/60"></div>

          {/* Subtle decorative blobs */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-10 w-64 h-64 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-10 w-80 h-80 bg-teal-300 rounded-full blur-3xl"></div>
          </div>

          {/* Content Overlay */}
          <div className="relative z-10 flex flex-col justify-between h-full p-12 text-white">
            {/* Top - Logo */}
            <div>
              <img src="/xircle-logo.png" alt="Xircle" className="h-12 w-auto" />
            </div>

            {/* Center - Glass Card */}
            <div className="max-w-lg mx-auto w-full">
              <div className="bg-white/10 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/10">
                <h2 className="text-3xl font-bold mb-4 leading-tight">
                  {step === 'success'
                    ? "You're All Set!"
                    : step === 'reset'
                    ? 'Create a New Password'
                    : 'Forgot Your Password?'}
                </h2>
                <p className="text-white/80 text-base mb-4">
                  {step === 'success'
                    ? 'Your password has been updated successfully.'
                    : step === 'reset'
                    ? 'Enter the OTP and your new password to reset.'
                    : "Enter your email address and we'll send you a code to reset your password."}
                </p>
                {step === 'request' && (
                  <div className="flex flex-col gap-2 text-sm text-white/70">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                      <span>We'll send a 6-digit OTP</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                      <span>OTP expires in 10 minutes</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom - Parent Company */}
            <div className="text-white/60 text-sm">
              <p>© 2026 Xircle. All rights reserved.</p>
              <p className="mt-1">
                A product of{' '}
                <a
                  href="https://lovohcreate.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:underline font-medium"
                >
                  LovohCreate
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <img src="/xircle-logo.png" alt="Xircle" className="h-12 w-auto mx-auto" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              {step === 'request'
                ? 'Reset Password'
                : step === 'reset'
                ? 'Enter OTP & New Password'
                : 'Success!'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {step === 'request'
                ? 'We\'ll send you a verification code'
                : step === 'reset'
                ? 'Check your email for the OTP'
                : 'Your password has been reset'}
            </p>
          </div>

          {renderForm()}

          {/* Back to Login */}
          {step !== 'success' && (
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium transition-colors duration-200 inline-flex items-center gap-1"
              >
                <FaArrowLeft size={14} /> Back to Login
              </Link>
            </div>
          )}

          <div className="mt-8 lg:hidden text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              A product of{' '}
              <a
                href="https://lovohcreate.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-600 dark:text-teal-400 hover:underline font-medium"
              >
                LovohCreate
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
// pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Capacitor } from '@capacitor/core';
import {
  useLoginMutation,
  useGoogleAuthMutation,
  useVerifyEmailMutation,
  useResendOTPMutation,
} from '../slices/userApiSlice';
import { setCredentials } from '../slices/authSlice';
import { toast } from 'react-hot-toast';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaArrowLeft, FaGoogle } from 'react-icons/fa';
import { GoogleLogin } from '@react-oauth/google';
import { useGoogleAuth } from '../components/GoogleAuthHandler';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // OTP verification state
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [otp, setOtp] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { userInfo } = useSelector((state) => state.auth);

  const [login, { isLoading: isLoginLoading }] = useLoginMutation();
  const [googleAuth, { isLoading: isGoogleLoading }] = useGoogleAuthMutation();
  const [verifyEmail, { isLoading: isVerifyLoading }] = useVerifyEmailMutation();
  const [resendOTP, { isLoading: isResendLoading }] = useResendOTPMutation();

  // Use the Google Auth handler
  const { openGoogleAuth } = useGoogleAuth();

  // Redirect to my-workspaces after login
  const from = location.state?.from?.pathname || '/my-workspaces';

  useEffect(() => {
    if (userInfo) {
      navigate(from, { replace: true });
    }
  }, [userInfo, navigate, from]);

  // ── Handle Google Login ──
  const handleGoogleLogin = async () => {
    if (Capacitor.isNativePlatform()) {
      // ── Capacitor Native - Open in Browser with Deep Link ──
      try {
        setIsLoading(true);
        await openGoogleAuth('login');
        // The auth flow will complete in the deep link handler
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
        console.error('Google login error:', error);
        toast.error('Failed to open Google login. Please try again.');
      }
    } else {
      // ── Web Browser - Use GoogleLogin component ──
      toast.info('Please use the Google login button below');
    }
  };

  // ── Google login handlers for Web ──
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setIsLoading(true);
      const res = await googleAuth({
        token: credentialResponse.credential,
        mode: 'login',
      }).unwrap();
      dispatch(setCredentials({ ...res }));
      toast.success('Google login successful!');
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err?.data?.message || 'Google login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    toast.error('Google login failed. Please try again.');
  };

  // ── Login submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      setIsLoading(true);
      const res = await login({ email, password }).unwrap();
      dispatch(setCredentials({ ...res }));
      toast.success('Login successful!');
      navigate(from, { replace: true });
    } catch (err) {
      const errorMsg = err?.data?.message || 'Login failed. Please try again.';
      if (errorMsg.toLowerCase().includes('verify your email')) {
        setPendingEmail(email);
        setShowOTPVerification(true);
        toast.info('Please verify your email with the OTP sent.');
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── OTP Verification ──
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP.');
      return;
    }
    try {
      setIsLoading(true);
      const result = await verifyEmail({ email: pendingEmail, otp }).unwrap();
      dispatch(setCredentials({ ...result }));
      toast.success('Email verified! You are now logged in.');
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err?.data?.message || 'Verification failed. Please check your OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Resend OTP ──
  const handleResendOTP = async () => {
    try {
      await resendOTP({ email: pendingEmail }).unwrap();
      toast.success('New OTP sent to your email.');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to resend OTP.');
    }
  };

  // ── Go back to login ──
  const handleBackToLogin = () => {
    setShowOTPVerification(false);
    setOtp('');
    setPendingEmail('');
  };

  const isNative = Capacitor.isNativePlatform();

  // ── Render OTP form ──
  const renderOTPForm = () => (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Verify Your Email</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          We sent a 6-digit OTP to <strong className="text-gray-800 dark:text-gray-200">{pendingEmail}</strong>
        </p>
      </div>

      <form onSubmit={handleVerifyOTP} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            OTP Code
          </label>
          <div className="relative">
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="block w-full px-4 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 transition-colors duration-200"
              placeholder="Enter 6-digit OTP"
              maxLength={6}
              required
            />
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            The OTP expires in 10 minutes. Check your spam folder if you don't see it.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBackToLogin}
            className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium flex items-center gap-1 transition-colors"
          >
            <FaArrowLeft size={12} /> Back to login
          </button>
          <button
            type="button"
            onClick={handleResendOTP}
            disabled={isResendLoading}
            className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium transition-colors disabled:opacity-50"
          >
            {isResendLoading ? 'Sending...' : 'Resend OTP'}
          </button>
        </div>

        <button
          type="submit"
          disabled={isLoading || isVerifyLoading}
          className="w-full flex items-center justify-center px-4 py-3 bg-teal-600 dark:bg-teal-500 text-white font-semibold rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading || isVerifyLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Verifying...</span>
            </div>
          ) : (
            'Verify Email'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Didn't receive the email?{' '}
          <button
            onClick={handleResendOTP}
            disabled={isResendLoading}
            className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium transition-colors disabled:opacity-50"
          >
            {isResendLoading ? 'Sending...' : 'Resend OTP'}
          </button>
        </p>
      </div>
    </div>
  );

  // ── Main render ──
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
          <div className="absolute inset-0 bg-gradient-to-br from-teal-700/90 dark:from-[#0b0b10]/95 to-teal-500/80 dark:to-[#0d9488]/60"></div>
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-20 left-10 w-64 h-64 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-10 w-80 h-80 bg-teal-300 rounded-full blur-3xl"></div>
          </div>

          <div className="relative z-10 flex flex-col justify-between h-full p-12 text-white">
            <div>
              <img src="/logo.jpeg" alt="Xircle" className="h-12 w-auto rounded-lg" />
            </div>
            <div className="max-w-lg mx-auto w-full">
              <div className="bg-white/10 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/10">
                <h2 className="text-4xl font-bold mb-4 leading-tight">
                  {showOTPVerification ? 'Verify Your Email' : 'Welcome Back to Your Creative Hub'}
                </h2>
                <p className="text-white/80 text-lg mb-6">
                  {showOTPVerification
                    ? 'Enter the OTP sent to your email to activate your account.'
                    : 'Connect, collaborate, and create amazing projects with your team.'}
                </p>
                {!showOTPVerification && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 text-white/90">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                      <span>Real-time collaboration</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/90">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                      <span>Project management tools</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/90">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                      <span>Team communication</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
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

      {/* Right Side - Login / OTP Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        {showOTPVerification ? (
          renderOTPForm()
        ) : (
          <div className="w-full max-w-md">
            <div className="lg:hidden text-center mb-8">
              <img src="/logo.jpeg" alt="Xircle" className="h-12 w-auto mx-auto rounded-lg" />
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Welcome Back</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Sign in to continue to your workspace</p>
            </div>

            <div className="mb-6">
              {isNative ? (
                // ── Capacitor Native - Custom Google Button ──
                <button
                  onClick={handleGoogleLogin}
                  disabled={isLoading || isGoogleLoading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white dark:bg-[#1a1a24] text-gray-800 dark:text-gray-200 font-medium rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#2a2a35] focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading || isGoogleLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    <>
                      <FaGoogle className="text-xl text-red-500" />
                      <span>Sign in with Google</span>
                    </>
                  )}
                </button>
              ) : (
                // ── Web Browser - GoogleLogin Component ──
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    theme="filled_black"
                    size="large"
                    width="100%"
                    text="signin_with"
                    shape="rectangular"
                    logo_alignment="center"
                  />
                </div>
              )}
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-700/60"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-[#0b0b10] text-gray-500 dark:text-gray-500">
                  or sign in with email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
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
                    className="block w-full pl-10 pr-3 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium transition-colors duration-200"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaLock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 transition-colors duration-200"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <FaEyeSlash className="h-5 w-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                    ) : (
                      <FaEye className="h-5 w-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || isLoginLoading}
                className="w-full flex items-center justify-center px-4 py-3 bg-teal-600 dark:bg-teal-500 text-white font-semibold rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading || isLoginLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors duration-200"
              >
                Create one now
              </Link>
            </p>

            <div className="mt-8 lg:hidden text-center">
              <p className="text-xs text-gray-500 dark:text-gray-500">
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
        )}
      </div>
    </div>
  );
};

export default Login;
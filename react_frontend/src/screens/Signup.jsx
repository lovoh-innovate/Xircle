// pages/Signup.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  useRegisterMutation,
  useVerifyEmailMutation,
  useGoogleAuthMutation,
  useResendOTPMutation,
} from '../slices/userApiSlice';
import { setCredentials } from '../slices/authSlice';
import { toast } from 'react-toastify';
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaCheckCircle,
  FaArrowLeft,
} from 'react-icons/fa';
import { GoogleLogin } from '@react-oauth/google';

const Signup = () => {
  const [step, setStep] = useState('register');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false,
  });
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [register] = useRegisterMutation();
  const [verifyEmail] = useVerifyEmailMutation();
  const [googleAuth] = useGoogleAuthMutation();
  const [resendOTP] = useResendOTPMutation();

  // ── Handle Registration ──
  const handleRegister = async (e) => {
    e.preventDefault();
    const { name, email, phone, password, confirmPassword, acceptedTerms } = formData;

    if (!name || !email || !phone || !password || !confirmPassword) {
      toast.error('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (!acceptedTerms) {
      toast.error('You must accept the Terms and Conditions.');
      return;
    }

    try {
      setIsLoading(true);
      const result = await register({ name, email, phone, password, acceptedTerms }).unwrap();
      toast.success('OTP sent to your email! Please verify.');
      setStep('verify');
    } catch (err) {
      const msg = err?.data?.message || 'Registration failed. Please try again.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Handle OTP Verification ──
  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP.');
      return;
    }
    try {
      setIsLoading(true);
      const result = await verifyEmail({ email: formData.email, otp }).unwrap();
      dispatch(setCredentials({ ...result }));
      toast.success('Email verified! Welcome to Xircle.');
      setStep('success');
      setTimeout(() => navigate('/my-workspaces'), 3000);
    } catch (err) {
      const msg = err?.data?.message || 'Verification failed. Please check your OTP.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Handle Resend OTP ──
  const handleResendOTP = async () => {
    try {
      await resendOTP({ email: formData.email }).unwrap();
      toast.success('New OTP sent to your email.');
    } catch (err) {
      const msg = err?.data?.message || 'Failed to resend OTP. Please try again.';
      toast.error(msg);
    }
  };

  // ── Handle Google Signup ──
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setIsLoading(true);
      const res = await googleAuth({
        token: credentialResponse.credential,
        mode: 'signup',
      }).unwrap();
      dispatch(setCredentials({ ...res }));
      toast.success('Google signup successful!');
      navigate('/my-workspaces');
    } catch (err) {
      const msg = err?.data?.message || 'Google signup failed. Please try again.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    toast.error('Google signup failed. Please try again.');
  };

  // ── Handle form field changes ──
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // ── Render Form Steps ──
  const renderForm = () => {
    if (step === 'success') {
      return (
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center">
              <FaCheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Account Created!</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Your email has been verified. You will be redirected to your workspaces.
          </p>
          <Link
            to="/my-workspaces"
            className="mt-4 inline-block text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] font-medium transition-colors"
          >
            Go to My Workspaces →
          </Link>
        </div>
      );
    }

    if (step === 'verify') {
      return (
        <form onSubmit={handleVerify} className="space-y-5">
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
                className="block w-full pl-10 pr-3 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 transition-colors duration-200"
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                required
              />
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
              We sent the OTP to <strong className="text-gray-800 dark:text-gray-300">{formData.email}</strong>. It expires in 10 minutes.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep('register')}
              className="text-sm text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] font-medium transition-colors duration-200 flex items-center gap-1"
            >
              <FaArrowLeft size={12} /> Back
            </button>
            <button
              type="button"
              onClick={handleResendOTP}
              className="text-sm text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] font-medium transition-colors"
            >
              Resend OTP
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 bg-teal-600 dark:bg-[#0d9488] text-white font-semibold rounded-xl hover:bg-teal-700 dark:hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Verifying...</span>
              </div>
            ) : (
              'Verify Email'
            )}
          </button>
        </form>
      );
    }

    // Step: register
    return (
      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Full Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaUser className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              className="block w-full pl-10 pr-3 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 transition-colors duration-200"
              placeholder="John Doe"
              required
            />
          </div>
        </div>

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
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className="block w-full pl-10 pr-3 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 transition-colors duration-200"
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Phone Number
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaPhone className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              className="block w-full pl-10 pr-3 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 transition-colors duration-200"
              placeholder="+1 234 567 890"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaLock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              className="block w-full pl-10 pr-10 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 transition-colors duration-200"
              placeholder="Min 6 characters"
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

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaLock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={handleChange}
              className="block w-full pl-10 pr-10 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 transition-colors duration-200"
              placeholder="Re-enter password"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showConfirmPassword ? (
                <FaEyeSlash className="h-5 w-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
              ) : (
                <FaEye className="h-5 w-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <input
            id="acceptedTerms"
            name="acceptedTerms"
            type="checkbox"
            checked={formData.acceptedTerms}
            onChange={handleChange}
            className="mt-1 w-4 h-4 text-teal-600 dark:text-[#0d9488] border-gray-300 dark:border-gray-700/60 bg-white dark:bg-[#0b0b10] rounded focus:ring-teal-500 dark:focus:ring-[#0d9488]"
            required
          />
          <label htmlFor="acceptedTerms" className="text-sm text-gray-600 dark:text-gray-400">
            I agree to the{' '}
            <Link to="/terms" className="text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] font-medium transition-colors">
              Terms and Conditions
            </Link>
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center px-4 py-3 bg-teal-600 dark:bg-[#0d9488] text-white font-semibold rounded-xl hover:bg-teal-700 dark:hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Creating account...</span>
            </div>
          ) : (
            'Create Account'
          )}
        </button>
      </form>
    );
  };

  // ── Render Page ──
  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-[#0b0b10] overflow-hidden">
      {/* Left Side - Fixed Full Height */}
      <div className="hidden lg:flex lg:w-1/2 h-full relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Overlay – adapts to theme */}
          <div className="absolute inset-0 bg-gradient-to-br from-teal-700/90 dark:from-[#0b0b10]/95 to-teal-500/80 dark:to-[#0d9488]/60"></div>
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-20 left-10 w-64 h-64 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-10 w-80 h-80 bg-teal-300 rounded-full blur-3xl"></div>
          </div>
          <div className="relative z-10 flex flex-col justify-between h-full p-12 text-white">
            <div>
              <img src="/xircle-logo.png" alt="Xircle" className="h-12 w-auto" />
            </div>
            <div className="max-w-lg mx-auto w-full">
              <div className="bg-white/10 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/10">
                <h2 className="text-3xl font-bold mb-4 leading-tight">
                  {step === 'success'
                    ? 'Welcome Aboard!'
                    : step === 'verify'
                    ? 'Verify Your Email'
                    : 'Join the Xircle Community'}
                </h2>
                <p className="text-white/80 text-base mb-4">
                  {step === 'success'
                    ? 'Your account is ready. You’ll be redirected to your workspaces.'
                    : step === 'verify'
                    ? 'Enter the OTP sent to your email to activate your account.'
                    : 'Start collaborating with your team in minutes.'}
                </p>
                {step === 'register' && (
                  <div className="flex flex-col gap-2 text-sm text-white/70">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                      <span>Free to get started</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                      <span>All-in-one workspace</span>
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

      {/* Right Side - Scrollable Form */}
      <div className="flex-1 h-full overflow-y-auto p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-md mx-auto">
          <div className="lg:hidden text-center mb-8">
            <img src="/xircle-logo.png" alt="Xircle" className="h-12 w-auto mx-auto" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {step === 'register'
                ? 'Create Account'
                : step === 'verify'
                ? 'Verify OTP'
                : 'Success!'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {step === 'register'
                ? 'Fill in your details to get started'
                : step === 'verify'
                ? 'Check your email for the OTP'
                : 'Your account is verified'}
            </p>
          </div>

          {step === 'register' && (
            <>
              <div className="mb-6">
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    theme="filled_black"
                    size="large"
                    width="100%"
                    text="signup_with"
                    shape="rectangular"
                    logo_alignment="center"
                  />
                </div>
              </div>
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-700/60"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white dark:bg-[#0b0b10] text-gray-500 dark:text-gray-500">
                    or sign up with email
                  </span>
                </div>
              </div>
            </>
          )}

          {renderForm()}

          {step !== 'success' && (
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="text-sm text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] font-medium transition-colors duration-200 inline-flex items-center gap-1"
              >
                <FaArrowLeft size={14} /> Back to Login
              </Link>
            </div>
          )}

          <div className="mt-8 lg:hidden text-center">
            <p className="text-xs text-gray-500 dark:text-gray-500">
              A product of{' '}
              <a
                href="https://lovohcreate.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-600 dark:text-[#0d9488] hover:underline font-medium"
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

export default Signup;
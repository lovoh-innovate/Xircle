// screens/Welcome.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaSignInAlt, FaUserPlus, FaArrowRight, FaCheckCircle, FaDownload } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { useGetAppVersionQuery } from '../slices/appApiSlice';
import { toast } from 'react-toastify';

const Welcome = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const token = userInfo?.token || null;

  // ─── Detect if running inside Capacitor ──────────────────────────────
  const isCapacitor = !!window.Capacitor?.isNativePlatform?.();

  // ─── Fetch latest app version (only for web) ─────────────────────────
  const { data: versionData, isLoading: versionLoading } = useGetAppVersionQuery(
    {
      platform: 'android',
      currentVersion: null,
      token: token || undefined,
    },
    { skip: isCapacitor }
  );

  const [downloading, setDownloading] = useState(false);

  // Redirect authenticated users
  useEffect(() => {
    if (userInfo) {
      navigate('/my-workspaces', { replace: true });
    }
  }, [userInfo, navigate]);

  // ─── Download handler ──────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!versionData?.data?._id) {
      toast.error('No app version available for download.');
      return;
    }

    setDownloading(true);
    try {
      const versionId = versionData.data._id;
      const downloadUrl = `/api/app/download/${versionId}?token=${token || ''}`;
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `xircle-v${versionData.data.version}.apk`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast.success('Download started!');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download APK. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const features = [
    'Organize projects into clear workspaces',
    'Assign, track, and close tasks fast',
    'Stay in sync with your whole team',
  ];

  // ─── Very small, subtle icon pattern ──────────────────────────────────
  const iconPattern = `
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <defs>
        <g id="check">
          <path d="M20 40 L35 55 L55 25" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
        <g id="chat">
          <path d="M15 45 C15 25, 45 25, 45 45 C45 60, 30 60, 20 60 L10 70 L15 55 C10 50, 15 45, 15 45Z" stroke="white" stroke-width="1.5" fill="none"/>
        </g>
        <g id="folder">
          <path d="M10 50 L25 35 L45 35 L55 50 L55 70 L10 70 Z" stroke="white" stroke-width="1.5" fill="none"/>
          <path d="M25 35 L25 45" stroke="white" stroke-width="1.5"/>
        </g>
        <g id="clipboard">
          <rect x="20" y="35" width="30" height="40" rx="3" stroke="white" stroke-width="1.5" fill="none"/>
          <line x1="25" y1="25" x2="45" y2="25" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="28" y1="35" x2="42" y2="35" stroke="white" stroke-width="1" stroke-linecap="round"/>
          <line x1="28" y1="42" x2="42" y2="42" stroke="white" stroke-width="1" stroke-linecap="round"/>
          <line x1="28" y1="49" x2="42" y2="49" stroke="white" stroke-width="1" stroke-linecap="round"/>
        </g>
        <g id="users">
          <circle cx="30" cy="25" r="6" stroke="white" stroke-width="1.5" fill="none"/>
          <path d="M15 45 Q15 35, 30 35 Q45 35, 45 45" stroke="white" stroke-width="1.5" fill="none"/>
          <circle cx="60" cy="25" r="6" stroke="white" stroke-width="1.5" fill="none"/>
          <path d="M45 45 Q45 35, 60 35 Q75 35, 75 45" stroke="white" stroke-width="1.5" fill="none"/>
        </g>
      </defs>
      <!-- Scaled down to 20% → each icon ~10-12px, very low opacity -->
      <g transform="translate(10,10) scale(0.2)" opacity="0.08"><use href="#check"/></g>
      <g transform="translate(55,15) scale(0.2)" opacity="0.08"><use href="#chat"/></g>
      <g transform="translate(85,10) scale(0.2)" opacity="0.08"><use href="#folder"/></g>
      <g transform="translate(20,55) scale(0.2)" opacity="0.08"><use href="#clipboard"/></g>
      <g transform="translate(75,60) scale(0.2)" opacity="0.08"><use href="#users"/></g>
      <g transform="translate(45,85) scale(0.2)" opacity="0.08"><use href="#check"/></g>
      <g transform="translate(100,85) scale(0.2)" opacity="0.08"><use href="#chat"/></g>
      <g transform="translate(10,95) scale(0.2)" opacity="0.08"><use href="#folder"/></g>
      <g transform="translate(95,25) scale(0.2)" opacity="0.08"><use href="#users"/></g>
      <g transform="translate(35,40) scale(0.2)" opacity="0.08"><use href="#clipboard"/></g>
      <g transform="translate(70,35) scale(0.2)" opacity="0.08"><use href="#check"/></g>
      <g transform="translate(15,75) scale(0.2)" opacity="0.08"><use href="#chat"/></g>
    </svg>
  `;

  const encodedPattern = encodeURIComponent(iconPattern);
  const patternStyle = {
    backgroundImage: `url("data:image/svg+xml,${encodedPattern}")`,
    backgroundSize: '120px 120px',
    backgroundRepeat: 'repeat',
  };

  return (
    <div className="min-h-screen w-full bg-white dark:bg-[#0a0a0f] transition-colors duration-300">
      {/* ─── MOBILE LAYOUT (< lg) ────────────────────────────────────── */}
      <div className="lg:hidden relative min-h-screen flex flex-col overflow-hidden">
        <div className="relative flex-[1.1] min-h-[58vh] flex flex-col items-center justify-center px-6 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/hero.jfif')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-teal-900/60 via-teal-800/70 to-teal-950/90" />
          <motion.div
            animate={{ scale: [1, 1.15, 1], rotate: [0, 8, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-24 -right-24 w-72 h-72 bg-teal-400/20 rounded-full blur-3xl pointer-events-none"
          />
          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [0, -6, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute -bottom-20 -left-20 w-64 h-64 bg-teal-300/10 rounded-full blur-3xl pointer-events-none"
          />
          <motion.img
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            src="/logo.jpeg"
            alt="Xircle logo"
            className="relative z-10 w-20 h-20 rounded-2xl object-cover shadow-xl shadow-black/20 border border-white/20"
          />
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="relative z-10 mt-5 text-3xl font-extrabold text-white tracking-tight"
          >
            Xircle
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="relative z-10 mt-2 text-teal-100/90 text-sm text-center max-w-[240px]"
          >
            Projects and tasks, all in one circle
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          className="relative z-10 -mt-8 flex-1 bg-white dark:bg-[#14141a] rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.08)] px-7 pt-9 pb-10 flex flex-col"
          style={patternStyle}
        >
          <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white tracking-tight">
            Welcome
          </h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-[15px] leading-relaxed">
            Manage your work, your way. <br />
            Where every project finds its flow.
          </p>

          {!isCapacitor && (
            <div className="mt-4">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleDownload}
                disabled={downloading || versionLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-2xl font-medium text-sm shadow-md transition-colors duration-200 disabled:opacity-50"
              >
                <FaDownload />
                {downloading ? 'Starting...' : versionLoading ? 'Checking...' : `Download APK v${versionData?.data?.version || ''}`}
              </motion.button>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                Get the Android app
              </p>
            </div>
          )}

          <div className="mt-6 space-y-4">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-2xl font-semibold text-[15px] shadow-md shadow-teal-600/20 transition-colors duration-200"
            >
              <FaSignInAlt />
              <span>Log In</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/signup')}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-transparent border-2 border-teal-200 dark:border-teal-700/50 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-2xl font-semibold text-[15px] transition-colors duration-200"
            >
              <FaUserPlus />
              <span>Sign Up</span>
            </motion.button>
          </div>

          <p className="mt-auto pt-8 text-center text-xs text-gray-400 dark:text-gray-500">
            By continuing you agree to Xircle's Terms & Privacy Policy
          </p>
        </motion.div>
      </div>

      {/* ─── DESKTOP LAYOUT (>= lg) ────────────────────────────────── */}
      <div className="hidden lg:flex min-h-screen">
        <div className="relative w-[46%] xl:w-[42%] flex flex-col justify-between overflow-hidden px-14 py-14">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/hero.jfif')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-teal-900/65 via-teal-800/75 to-teal-950/90" />
          <motion.div
            animate={{ scale: [1, 1.12, 1], rotate: [0, 6, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-32 -right-32 w-[420px] h-[420px] bg-teal-400/20 rounded-full blur-3xl pointer-events-none"
          />
          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [0, -8, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            className="absolute -bottom-40 -left-24 w-[380px] h-[380px] bg-teal-300/10 rounded-full blur-3xl pointer-events-none"
          />
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative z-10 flex items-center gap-3"
          >
            <img
              src="/logo.jpeg"
              alt="Xircle logo"
              className="w-11 h-11 rounded-xl object-cover shadow-lg border border-white/20"
            />
            <span className="text-white text-xl font-bold tracking-tight">Xircle</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="relative z-10 max-w-md"
          >
            <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Bring your projects <br /> full circle.
            </h1>
            <p className="mt-5 text-teal-100/80 text-lg leading-relaxed">
              Plan, assign, and track every task with your team — all in one clean, connected workspace.
            </p>

            <ul className="mt-8 space-y-3">
              {features.map((f, i) => (
                <motion.li
                  key={f}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.1, duration: 0.5 }}
                  className="flex items-center gap-3 text-teal-50/90 text-[15px]"
                >
                  <FaCheckCircle className="text-teal-300 shrink-0" />
                  <span>{f}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="relative z-10 text-teal-100/50 text-sm"
          >
            © {new Date().getFullYear()} Xircle. All rights reserved.
          </motion.p>
        </div>

        <div
          className="flex-1 flex items-center justify-center px-10 bg-white dark:bg-[#0a0a0f]"
          style={patternStyle}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="w-full max-w-md"
          >
            <h2 className="text-3xl font-extrabold text-gray-800 dark:text-white tracking-tight">
              Welcome back
            </h2>
            <p className="mt-3 text-gray-500 dark:text-gray-400 text-[15px] leading-relaxed">
              Sign in to pick up where you left off, or create an account to get your workspace started.
            </p>

            {!isCapacitor && (
              <div className="mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDownload}
                  disabled={downloading || versionLoading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl font-medium text-sm shadow-md transition-colors duration-200 disabled:opacity-50"
                >
                  <FaDownload />
                  {downloading ? 'Starting...' : versionLoading ? 'Checking...' : `Download APK v${versionData?.data?.version || ''}`}
                </motion.button>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-center">
                  Get the Android app
                </p>
              </div>
            )}

            <div className="mt-6 space-y-4">
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 18px 30px -12px rgba(13,148,136,0.35)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-2xl font-semibold text-[15px] shadow-md transition-colors duration-200 group"
              >
                <FaSignInAlt />
                <span>Log In</span>
                <FaArrowRight className="text-sm group-hover:translate-x-1 transition-transform" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/signup')}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white dark:bg-[#1a1a22] border-2 border-teal-200 dark:border-teal-700/50 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-2xl font-semibold text-[15px] transition-colors duration-200"
              >
                <FaUserPlus />
                <span>Create an account</span>
              </motion.button>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs text-gray-400 dark:text-gray-500">Xircle</span>
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>

            <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
              By continuing you agree to Xircle's Terms & Privacy Policy
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
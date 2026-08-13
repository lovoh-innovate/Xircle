// screens/Welcome.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  FaSignInAlt,
  FaUserPlus,
  FaArrowRight,
  FaCheckCircle,
  FaDownload,
  FaTimes,
  FaShareAlt,
  FaCheck,
  FaExclamationTriangle,
  FaSpinner,
} from 'react-icons/fa';
import { motion } from 'framer-motion';
import { useGetAppVersionQuery, getAppDownloadUrl } from '../slices/appApiSlice';
import { toast } from 'react-hot-toast';

const Welcome = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const token = userInfo?.token || null;

  const isCapacitor = !!window.Capacitor?.isNativePlatform?.();

  // ─── Fetch with a 60‑second cache lifetime ──────────────────────
  // This gives you a fast initial render (cached data) but still checks
  // the server if the user returns after 60 seconds.
  const {
    data: versionData,
    isLoading: versionLoading,
    error: versionError,
    refetch,
  } = useGetAppVersionQuery(
    {
      platform: 'android',
      currentVersion: null,
      token: token || undefined,
    },
    {
      skip: isCapacitor,
      refetchOnMountOrArgChange: 60, // seconds – set to 0 for always fresh
    }
  );

  const [downloading, setDownloading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasDownloaded = useRef(false);

  // Redirect authenticated users
  useEffect(() => {
    if (userInfo) {
      navigate('/my-workspaces', { replace: true });
    }
  }, [userInfo, navigate]);

  // ─── Modal handlers ──────────────────────────────────────────────
  const openDownloadModal = () => {
    if (!versionData?.data?._id) {
      toast.error('No app version available for download.');
      return;
    }
    setShowModal(true);
    hasDownloaded.current = false;
  };

  const handleConfirmDownload = () => {
    if (!versionData?.data?._id) {
      setShowModal(false);
      return;
    }
    if (hasDownloaded.current) return;
    hasDownloaded.current = true;
    setDownloading(true);

    const downloadUrl = getAppDownloadUrl(versionData.data._id, token);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `xircle-v${versionData.data.version}.apk`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Download started!');
    setTimeout(() => {
      setShowModal(false);
      setDownloading(false);
    }, 1000);
  };

  const handleShare = async () => {
    if (!versionData?.data?._id) return;
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/app/download/${versionData.data._id}`;
    const shareData = {
      title: 'Xircle App',
      text: `Download Xircle v${versionData.data.version} - ${versionData.data.releaseNotes || 'Latest update'}`,
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Share failed:', error);
        try {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        } catch {}
      }
    }
  };

  const features = [
    'Organize projects into clear workspaces',
    'Assign, track, and close tasks fast',
    'Stay in sync with your whole team',
  ];

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // ─── Pattern style ────────────────────────────────────────────────
  const iconPattern = `
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <defs>
        <g id="check"><path d="M20 40 L35 55 L55 25" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
        <g id="chat"><path d="M15 45 C15 25, 45 25, 45 45 C45 60, 30 60, 20 60 L10 70 L15 55 C10 50, 15 45, 15 45Z" stroke="white" stroke-width="1.5" fill="none"/></g>
        <g id="folder"><path d="M10 50 L25 35 L45 35 L55 50 L55 70 L10 70 Z" stroke="white" stroke-width="1.5" fill="none"/><path d="M25 35 L25 45" stroke="white" stroke-width="1.5"/></g>
        <g id="clipboard"><rect x="20" y="35" width="30" height="40" rx="3" stroke="white" stroke-width="1.5" fill="none"/><line x1="25" y1="25" x2="45" y2="25" stroke="white" stroke-width="1.5" stroke-linecap="round"/><line x1="28" y1="35" x2="42" y2="35" stroke="white" stroke-width="1" stroke-linecap="round"/><line x1="28" y1="42" x2="42" y2="42" stroke="white" stroke-width="1" stroke-linecap="round"/><line x1="28" y1="49" x2="42" y2="49" stroke="white" stroke-width="1" stroke-linecap="round"/></g>
        <g id="users"><circle cx="30" cy="25" r="6" stroke="white" stroke-width="1.5" fill="none"/><path d="M15 45 Q15 35, 30 35 Q45 35, 45 45" stroke="white" stroke-width="1.5" fill="none"/><circle cx="60" cy="25" r="6" stroke="white" stroke-width="1.5" fill="none"/><path d="M45 45 Q45 35, 60 35 Q75 35, 75 45" stroke="white" stroke-width="1.5" fill="none"/></g>
      </defs>
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

  // ─── Render loading or error state (shared) ─────────────────────
  const renderDownloadButton = () => {
    if (isCapacitor) return null;

    if (versionError) {
      return (
        <div className="mt-4">
          <button
            onClick={() => refetch()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-medium text-sm shadow-md transition-colors"
          >
            <FaExclamationTriangle />
            Retry (API error)
          </button>
          <p className="text-xs text-red-400 mt-1 text-center">
            Failed to fetch version. Click to retry.
          </p>
        </div>
      );
    }

    return (
      <div className="mt-4">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={openDownloadModal}
          disabled={versionLoading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-2xl font-medium text-sm shadow-md transition-colors duration-200 disabled:opacity-60"
        >
          {versionLoading ? (
            <>
              <FaSpinner className="animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <FaDownload />
              {versionData?.data?.version
                ? `Download APK v${versionData.data.version}`
                : 'Download APK'}
            </>
          )}
        </motion.button>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
          {versionLoading ? 'Fetching latest version...' : 'Get the Android app'}
        </p>
      </div>
    );
  };

  // ─── JSX ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full bg-white dark:bg-[#0a0a0f] transition-colors duration-300">
      {/* MOBILE */}
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

          {renderDownloadButton()}

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

      {/* DESKTOP */}
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

            {renderDownloadButton()}

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

      {/* DOWNLOAD MODAL */}
      {showModal && versionData?.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-700/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                  Download APK
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Version {versionData.data.version}
                </p>
              </div>
              <button
                onClick={() => {
                  if (!downloading) setShowModal(false);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg transition"
              >
                <FaTimes className="text-lg" />
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-[#1a1a24] rounded-xl p-4 mb-4 space-y-2">
              {versionData.data.releaseNotes && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {versionData.data.releaseNotes}
                </p>
              )}
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Size: {formatFileSize(versionData.data.fileSize)}</span>
                <span>Platform: Android</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (!downloading) setShowModal(false);
                }}
                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDownload}
                disabled={downloading}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {downloading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <FaDownload className="text-sm" />
                    Download
                  </>
                )}
              </button>
            </div>

            <button
              onClick={handleShare}
              className="w-full mt-3 flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition py-2"
            >
              {copied ? (
                <>
                  <FaCheck className="text-green-500" />
                  <span>Link copied!</span>
                </>
              ) : (
                <>
                  <FaShareAlt className="text-xs" />
                  <span>Share download link</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Welcome;
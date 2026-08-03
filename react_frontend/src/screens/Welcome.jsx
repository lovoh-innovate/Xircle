// screens/Welcome.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Download,
  Smartphone,
  XCircle,
  Loader2,
  AlertCircle,
  ChevronDown,
  Zap,
  Share2,
  Check,
  Shield,
  Crown,
  TrendingUp,
  MoveRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useGetAppVersionQuery, getAppDownloadUrl } from '../slices/appApiSlice';
import { toast } from 'react-toastify';

const Welcome = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const token = userInfo?.token || null;

  const [showModal, setShowModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  // ─── Fetch latest app version (only for web) ─────────────────────────
  const { data, isLoading, error, refetch } = useGetAppVersionQuery(
    {
      platform: 'android',
      currentVersion: null,
      token: token || undefined,
    },
    { skip: !!window.Capacitor?.isNativePlatform?.() }
  );

  const version = data?.data;

  // Redirect authenticated users
  useEffect(() => {
    if (userInfo) {
      navigate('/my-workspaces', { replace: true });
    }
  }, [userInfo, navigate]);

  const openDownloadModal = () => {
    if (!version?._id) {
      toast.error('No app version available for download.');
      return;
    }
    setShowModal(true);
  };

  const handleConfirmDownload = () => {
    if (!version?._id) {
      setShowModal(false);
      return;
    }
    setIsDownloading(true);
    const downloadUrl = getAppDownloadUrl(version._id, token);
    window.open(downloadUrl, '_blank');
    toast.success('Download started!');
    setTimeout(() => {
      setShowModal(false);
      setIsDownloading(false);
    }, 1000);
  };

  const handleShare = async () => {
    if (!version?._id) return;
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/app/download/${version._id}`;
    const shareData = {
      title: 'Xircle App',
      text: `Download Xircle v${version.version} - ${version.releaseNotes || 'Latest update'}`,
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

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // ─── Loading ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-teal-500/30 border-t-teal-500 animate-spin mx-auto" />
            <Smartphone className="w-10 h-10 text-teal-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-6 text-gray-400 font-light tracking-wider">LOADING</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5 border border-red-500/20">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h3 className="text-lg font-light text-white mb-2">Connection Error</h3>
          <p className="text-gray-400 text-sm mb-6 font-light">Unable to load app information</p>
          <button
            onClick={() => refetch()}
            className="px-8 py-3 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full hover:bg-teal-500/20 transition text-sm font-light tracking-wider"
          >
            RETRY
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Geometric Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-10 left-10 w-64 h-64 border border-teal-500/5 rounded-full animate-pulse" />
          <div className="absolute bottom-10 right-10 w-96 h-96 border border-teal-500/5 rounded-full animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-teal-500/5 rotate-45 animate-pulse delay-700" />
          <div className="absolute top-1/4 right-1/4 w-32 h-32 border border-teal-400/10 rotate-12" />
          <div className="absolute bottom-1/3 left-1/3 w-48 h-48 border border-teal-400/10 -rotate-12" />
        </div>
      </div>

      {/* Minimal Header */}
      <header className="relative z-20 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5 sticky top-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-light text-white tracking-wider">XIRCLE</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 relative z-10">
        {/* Hero */}
        {version && (
          <div className="mb-12">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-5xl sm:text-6xl font-light text-white tracking-tight">
                    {version.version}
                  </span>
                  {version.isRequired && (
                    <span className="px-3 py-1 border border-red-500/30 text-red-400 text-xs rounded-full font-light tracking-wider">
                      REQUIRED
                    </span>
                  )}
                </div>

                {version.releaseNotes && (
                  <p className="text-gray-400 text-sm font-light max-w-xl leading-relaxed">
                    {version.releaseNotes}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-6 mt-4 text-xs text-gray-500 font-light">
                  <span>{formatFileSize(version.fileSize)}</span>
                  <span>•</span>
                  <span>{formatDate(version.createdAt)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Verified
                  </span>
                </div>
              </div>

              <div className="flex gap-3 flex-shrink-0">
                <button
                  onClick={openDownloadModal}
                  className="group px-8 py-3.5 bg-teal-500 text-white rounded-full hover:bg-teal-600 transition flex items-center gap-2 text-sm font-light tracking-wider"
                >
                  Download
                  <MoveRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                </button>
                <button
                  onClick={handleShare}
                  className="px-4 py-3.5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 rounded-full transition"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feature Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          {[
            { label: 'Fast', icon: Zap },
            { label: 'Secure', icon: Shield },
            { label: 'Auto', icon: TrendingUp },
            { label: 'Free', icon: Crown },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="border border-white/5 rounded-2xl p-4 text-center hover:border-white/10 transition"
              >
                <Icon className="w-5 h-5 text-teal-400 mx-auto mb-2" />
                <p className="text-[10px] text-gray-500 font-light tracking-wider">{item.label}</p>
              </div>
            );
          })}
        </div>

        {/* Login / Signup Buttons */}
        <div className="space-y-4 max-w-sm mx-auto">
          <button
            onClick={() => navigate('/login')}
            className="w-full py-4 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-2xl font-semibold text-[15px] shadow-md shadow-teal-600/20 transition-colors duration-200"
          >
            Log In
          </button>
          <button
            onClick={() => navigate('/signup')}
            className="w-full py-4 bg-transparent border-2 border-teal-200 dark:border-teal-700/50 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-2xl font-semibold text-[15px] transition-colors duration-200"
          >
            Create an account
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-gray-500 font-light">
          By continuing you agree to Xircle's Terms & Privacy Policy
        </p>
      </div>

      {/* ─── Download Modal ──────────────────────────────────────────── */}
      {showModal && version && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-[#12121a] border border-white/5 rounded-3xl max-w-md w-full p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-light text-white">Download</h3>
                <p className="text-sm text-gray-500 font-light">v{version.version}</p>
              </div>
              <button
                onClick={() => {
                  if (!isDownloading) {
                    setShowModal(false);
                  }
                }}
                className="text-gray-500 hover:text-gray-300 transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="border border-white/5 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-500 font-light">Size</span>
                <span className="text-white font-light">{formatFileSize(version.fileSize)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 font-light">Platform</span>
                <span className="text-white font-light">Android</span>
              </div>
              {version.releaseNotes && (
                <div className="mt-3 pt-3 border-t border-white/5 text-sm text-gray-400 font-light">
                  {version.releaseNotes}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (!isDownloading) {
                    setShowModal(false);
                  }
                }}
                disabled={isDownloading}
                className="flex-1 px-4 py-3 border border-white/5 text-gray-400 rounded-full hover:bg-white/5 transition font-light text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDownload}
                disabled={isDownloading}
                className="flex-1 px-4 py-3 bg-teal-500 text-white rounded-full hover:bg-teal-600 transition flex items-center justify-center gap-2 font-light text-sm"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Confirm
                  </>
                )}
              </button>
            </div>

            <button
              onClick={handleShare}
              className="w-full mt-4 flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition font-light py-2"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              {copied ? 'Link copied' : 'Share download link'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Welcome;
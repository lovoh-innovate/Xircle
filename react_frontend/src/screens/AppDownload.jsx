// screens/AppDownload.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGetAppVersionByIdQuery } from '../slices/appApiSlice';
import { useSelector } from 'react-redux';
import {
  Download,
  Share2,
  Check,
  AlertCircle,
  Loader2,
  Smartphone,
  Shield,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getAppDownloadUrl } from '../slices/appApiSlice';

const AppDownload = () => {
  const { versionId } = useParams();
  const navigate = useNavigate();
  const { token } = useSelector((state) => state.auth);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasAutoDownloaded = useRef(false);

  const { data, isLoading, error } = useGetAppVersionByIdQuery(versionId);
  const version = data?.data;

  // ─── Auto-download once ──────────────────────────────────────────
  useEffect(() => {
    if (version && !hasAutoDownloaded.current) {
      hasAutoDownloaded.current = true;
      const timer = setTimeout(() => {
        handleDownload();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [version]);

  // ─── Format helpers ──────────────────────────────────────────────
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ─── Download handler (no new tab) ──────────────────────────────
  const handleDownload = () => {
    if (!version?._id) {
      toast.error('Version not found.');
      return;
    }
    if (downloading) return;
    setDownloading(true);

    const downloadUrl = getAppDownloadUrl(version._id, token);

    // Create a hidden anchor and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `xircle-v${version.version}.apk`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Download started!');
    setTimeout(() => setDownloading(false), 2000);
  };

  // ─── Share handler ──────────────────────────────────────────────
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

  // ─── Loading state ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto">
            <div className="w-20 h-20 rounded-full border-4 border-teal-500/30 border-t-teal-500 animate-spin" />
            <Smartphone className="w-8 h-8 text-teal-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-6 text-gray-400 font-light tracking-wider text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────
  if (error || !version) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5 border border-red-500/20">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h3 className="text-lg font-light text-white mb-2">Version Not Found</h3>
          <p className="text-gray-400 text-sm mb-6 font-light">
            The app version you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full hover:bg-teal-500/20 transition text-sm font-light tracking-wider flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // ─── Success state ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 py-8">
      {/* Geometric background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 border border-teal-500/5 rounded-full animate-pulse" />
        <div className="absolute bottom-10 right-10 w-96 h-96 border border-teal-500/5 rounded-full animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-teal-500/5 rotate-45 animate-pulse delay-700" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-[#14141a] border border-white/10 rounded-3xl p-6 shadow-2xl shadow-teal-500/5">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Xircle</h1>
              <p className="text-xs text-gray-400 font-light">App Download</p>
            </div>
          </div>

          {/* Version info */}
          <div className="bg-[#1a1a24] border border-white/5 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl font-bold text-white">v{version.version}</span>
              {version.isRequired && (
                <span className="text-xs text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full font-light">
                  Required
                </span>
              )}
            </div>

            {version.releaseNotes && (
              <p className="text-sm text-gray-300 font-light leading-relaxed mb-3">
                {version.releaseNotes}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 font-light">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatDate(version.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" />
                <span>Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <Download className="w-3.5 h-3.5" />
                <span>{formatFileSize(version.fileSize)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android</span>
              </div>
            </div>
          </div>

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-2xl font-medium transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-teal-500/20 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download APK
              </>
            )}
          </button>

          {/* Auto-download notice */}
          {!downloading && (
            <p className="text-xs text-center text-gray-500 mt-3 font-light">
              Your download will start automatically in a few seconds.
            </p>
          )}

          {/* Share and back actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
            <button
              onClick={() => navigate('/')}
              className="text-xs text-gray-400 hover:text-white transition flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Home
            </button>
            <button
              onClick={handleShare}
              className="text-xs text-gray-400 hover:text-white transition flex items-center gap-1"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-500 mt-6 font-light tracking-wider">
          Xircle • {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default AppDownload;
// src/workspaceScreens/MyWorkspaceClockin.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import {
  useGetClockInSettingsQuery,
  useSetClockInSettingsMutation,
  useClockInMutation,
  useClockOutMutation,
  useGetUserClockInHistoryQuery,
  useGetWorkspaceClockInsQuery,
  useGetClockInLeaderboardQuery,
  useTriggerMonthlyLeaderboardMutation,
} from '../slices/clockInApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
import {
  FaClock,
  FaCog,
  FaUsers,
  FaChartBar,
  FaHistory,
  FaSpinner,
  FaCheck,
  FaTimes,
  FaChevronDown,
  FaArrowLeft,
  FaCalendarAlt,
  FaExclamationTriangle,
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

// ─── Format "HH:MM" (24h) into friendly 12-hour time ──────────────
const formatTime = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

// ─── Custom Dropdown ──────────────────────────────────────────────────────
const CustomDropdown = ({ options, value, onChange, placeholder, label, brandColor }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600 transition"
      >
        <span className={selected ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
          {selected ? selected.label : placeholder || 'Select...'}
        </span>
        <FaChevronDown className={`text-gray-500 dark:text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#1e1e26] border border-gray-300 dark:border-gray-700/60 rounded-xl overflow-hidden max-h-60 overflow-y-auto shadow-lg">
          {options.map(o => (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 transition text-left text-gray-700 dark:text-gray-300 ${o.value === value ? 'bg-teal-50 dark:bg-[#0d9488]/10' : ''}`}
            >
              <span>{o.label}</span>
              {o.value === value && <FaCheck className="ml-auto text-xs" style={{ color: brandColor }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Confirm Modal ──────────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, onConfirm, onCancel, title, message, confirmLabel = 'Confirm', confirmColor = 'bg-red-600 hover:bg-red-700' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-sm w-full p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
            Cancel
          </button>
          <button onClick={onConfirm} className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition ${confirmColor}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Bottom Sheet ──────────────────────────────────────────────────────
const BottomSheet = ({ isOpen, onClose, children }) => {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else if (visible) {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: animating ? 0 : '100%', opacity: animating ? 1 : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full md:max-w-md md:rounded-2xl rounded-t-2xl bg-white dark:bg-[#1a1a1a] shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
};

// ─── Settings Modal Content (updated for clockInStart/End) ──────────
const SettingsContent = ({ workspaceId, workspace, onClose, onSuccess }) => {
  const { data: settingsData, isLoading: settingsLoading, refetch: refetchSettings } = useGetClockInSettingsQuery(workspaceId);
  const [setSettings, { isLoading: isSaving }] = useSetClockInSettingsMutation();

  const [clockInStart, setClockInStart] = useState('');
  const [clockInEnd, setClockInEnd] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [clockInEnabled, setClockInEnabled] = useState(false);

  useEffect(() => {
    if (settingsData?.settings) {
      // Fallback to clockInTime if clockInStart is not set (backward compatibility)
      const start = settingsData.settings.clockInStart || settingsData.settings.clockInTime || '';
      const end = settingsData.settings.clockInEnd || '';
      setClockInStart(start);
      setClockInEnd(end);
      setClosingTime(settingsData.settings.closingTime || '');
      setClockInEnabled(settingsData.settings.clockInEnabled || false);
    }
  }, [settingsData]);

  const brandColor = workspace?.color || '#0d9488';

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await setSettings({
        workspaceId,
        clockInStart: clockInStart || null,
        clockInEnd: clockInEnd || null,
        closingTime: closingTime || null,
        clockInEnabled,
      }).unwrap();
      toast.success('Clock-in settings updated!');
      await refetchSettings();
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update settings.');
    }
  };

  if (settingsLoading) {
    return (
      <div className="p-6 flex justify-center">
        <FaSpinner className="animate-spin text-teal-500 text-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <FaCog className="text-teal-500" /> Clock-in Settings
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
          <FaTimes />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clock‑in Start</label>
            <input
              type="time"
              value={clockInStart}
              onChange={(e) => setClockInStart(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
              step="60"
            />
            <p className="text-xs text-gray-400 mt-1">Clocking in before this time = Early</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clock‑in End</label>
            <input
              type="time"
              value={clockInEnd}
              onChange={(e) => setClockInEnd(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
              step="60"
            />
            <p className="text-xs text-gray-400 mt-1">Clocking in after this time = Late</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Closing Time (for clock‑out penalty)</label>
          <input
            type="time"
            value={closingTime}
            onChange={(e) => setClosingTime(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
            step="60"
          />
          <p className="text-xs text-gray-400 mt-1">Optional: members clocking out after this time will be flagged as late</p>
        </div>

        <div className="flex items-center gap-3 py-2">
          <button
            type="button"
            onClick={() => setClockInEnabled(!clockInEnabled)}
            className={`relative w-12 h-7 rounded-full transition-colors ${clockInEnabled ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-700'}`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${clockInEnabled ? 'translate-x-5' : ''}`}
            />
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {clockInEnabled ? 'Clock‑in enabled' : 'Clock‑in disabled'}
          </span>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition text-gray-700 dark:text-gray-300">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 py-3 bg-teal-600 dark:bg-teal-500 text-white rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition"
            style={{ backgroundColor: brandColor }}
          >
            {isSaving ? <FaSpinner className="animate-spin mx-auto" /> : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Leaderboard Table (mobile‑optimized) ──────────────────────────
const LeaderboardTable = ({ data, period }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500">
        <FaChartBar className="text-4xl mx-auto mb-2 opacity-30" />
        <p className="text-sm">No data for this period</p>
      </div>
    );
  }

  const getMedal = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[280px] text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="text-left py-1.5 px-1 sm:py-2 sm:px-2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">Rank</th>
            <th className="text-left py-1.5 px-1 sm:py-2 sm:px-2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">Member</th>
            <th className="text-center py-1.5 px-1 sm:py-2 sm:px-2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">Early</th>
            <th className="text-center py-1.5 px-1 sm:py-2 sm:px-2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider hidden sm:table-cell">Avg Early</th>
            <th className="text-center py-1.5 px-1 sm:py-2 sm:px-2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">Score</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={item.user._id} className="border-b border-gray-100 dark:border-gray-800/30 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition">
              <td className="py-1.5 px-1 sm:py-2 sm:px-2 font-medium text-gray-700 dark:text-gray-300 text-center text-xs sm:text-sm">
                {getMedal(index)}
              </td>
              <td className="py-1.5 px-1 sm:py-2 sm:px-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {item.user.profile ? (
                    <img src={item.user.profile} alt={item.user.name} className="w-5 h-5 sm:w-7 sm:h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[8px] sm:text-xs font-bold text-gray-600 dark:text-gray-300">
                      {item.user.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <span className="text-gray-800 dark:text-gray-200 text-[10px] sm:text-sm truncate max-w-[60px] sm:max-w-[120px]">
                    {item.user.name}
                  </span>
                </div>
              </td>
              <td className="text-center py-1.5 px-1 sm:py-2 sm:px-2 text-gray-600 dark:text-gray-400 text-[10px] sm:text-sm">{item.earlyCount}</td>
              <td className="text-center py-1.5 px-1 sm:py-2 sm:px-2 text-gray-600 dark:text-gray-400 text-[10px] sm:text-sm hidden sm:table-cell">{item.avgEarlyMinutes} min</td>
              <td className="text-center py-1.5 px-1 sm:py-2 sm:px-2 font-semibold text-teal-600 dark:text-teal-400 text-[10px] sm:text-sm">{Math.round(item.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────
const MyWorkspaceClockin = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('month');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // ─── Workspace data ──────────────────────────────────────────────────
  const { data: workspaceData, isLoading: workspaceLoading } = useGetWorkspaceQuery(workspaceId);
  const workspace = workspaceData?.workspace;

  // ─── Check if user is owner or admin ──────────────────────────────
  const userId = userInfo?._id;
  const isOwner = workspace?.owner?._id === userId || workspace?.owner === userId;
  const isAdmin = workspace?.members?.some(
    (m) => (m.user?._id === userId || m.user === userId) && m.role === 'Admin' && m.status === 'active'
  );
  const canManage = isOwner || isAdmin;

  if (!canManage) {
    navigate(`/my-workspace/${workspaceId}`);
    return null;
  }

  const brandColor = workspace?.color || '#0d9488';

  // ─── Queries ────────────────────────────────────────────────────────
  const { data: settingsData } = useGetClockInSettingsQuery(workspaceId);

  // Scheduled times – fallback to clockInTime for backward compatibility
  const clockInStart = settingsData?.settings?.clockInStart || settingsData?.settings?.clockInTime || null;
  const clockInEnd = settingsData?.settings?.clockInEnd || null;
  const closingTime = settingsData?.settings?.closingTime || null;
  const hasScheduledTime = clockInStart !== null;

  // Today's clock-ins
  const today = new Date().toISOString().split('T')[0];
  const { data: todayData, isLoading: todayLoading, refetch: refetchToday } = useGetWorkspaceClockInsQuery(
    { workspaceId, date: today, limit: 100 },
    { skip: activeTab !== 'today' }
  );

  // History (paginated)
  const [historyPage, setHistoryPage] = useState(1);
  const { data: historyData, isLoading: historyLoading } = useGetWorkspaceClockInsQuery(
    { workspaceId, page: historyPage, limit: 20 },
    { skip: activeTab !== 'history' }
  );

  // Leaderboard
  const { data: leaderboardData, isLoading: leaderboardLoading } = useGetClockInLeaderboardQuery(
    { workspaceId, period: leaderboardPeriod },
    { skip: activeTab !== 'leaderboard' }
  );

  // ─── Current user's clock-in status ──────────────────────────────
  const { data: userHistoryData, refetch: refetchUserHistory } = useGetUserClockInHistoryQuery(
    { workspaceId, page: 1, limit: 1 },
    { skip: !workspaceId }
  );
  const userTodayClockIn = userHistoryData?.history?.[0] || null;
  const isClockedIn = userTodayClockIn && !userTodayClockIn.clockOutTime;

  // ─── Mutations ──────────────────────────────────────────────────────
  const [clockInMutation, { isLoading: isClockInLoading }] = useClockInMutation();
  const [clockOutMutation, { isLoading: isClockOutLoading }] = useClockOutMutation();
  const [triggerMonthly] = useTriggerMonthlyLeaderboardMutation();

  // ─── Handlers ──────────────────────────────────────────────────────
  const handleClockIn = async () => {
    try {
      await clockInMutation(workspaceId).unwrap();
      toast.success('Clocked in successfully!');
      refetchUserHistory();
      refetchToday();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to clock in.');
    }
  };

  const handleClockOut = async () => {
    try {
      await clockOutMutation(workspaceId).unwrap();
      toast.success('Clocked out successfully!');
      refetchUserHistory();
      refetchToday();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to clock out.');
    }
  };

  const handleSendMonthlyReport = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Send Monthly Report',
      message: 'This will email the leaderboard to the top 5 members and workspace owner. Continue?',
      onConfirm: async () => {
        try {
          await triggerMonthly(workspaceId).unwrap();
          toast.success('Monthly report sent!');
          setConfirmModal({ isOpen: false });
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to send report');
          setConfirmModal({ isOpen: false });
        }
      },
    });
  };

  // ─── Render helpers ──────────────────────────────────────────────
  const renderStatusBadge = (clockIn) => {
    if (clockIn.isEarly) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 sm:px-2 py-0.5 rounded-full">
          <FaCheck className="text-[10px]" /> Early
        </span>
      );
    }
    if (clockIn.isLate) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 sm:px-2 py-0.5 rounded-full">
          <FaTimes className="text-[10px]" /> Late
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-1.5 sm:px-2 py-0.5 rounded-full">
        <FaCheck className="text-[10px]" /> On time
      </span>
    );
  };

  const renderClockInList = (clockIns) => {
    if (!clockIns || clockIns.length === 0) {
      return (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <FaClock className="text-4xl mx-auto mb-2 opacity-30" />
          <p className="text-sm">No clock-ins found</p>
        </div>
      );
    }

    return clockIns.map((item) => {
      const user = item.user || {};
      const time = new Date(item.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return (
        <div key={item._id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-100 dark:border-gray-800/30 last:border-0 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition">
          <div className="relative flex-shrink-0">
            {user.profile ? (
              <img src={user.profile} alt={user.name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-xs sm:text-sm">
                {user.name?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200 truncate">{user.name || 'Unknown'}</p>
            <div className="flex items-center gap-1 sm:gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{time}</span>
              {item.clockOutTime && (
                <>
                  <span>·</span>
                  <span>Out: {new Date(item.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex-shrink-0">
            {renderStatusBadge(item)}
          </div>
        </div>
      );
    });
  };

  // ─── Loading state ──────────────────────────────────────────────────
  if (workspaceLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0b0b10] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <MyWorkspaceSidebar workspace={workspace} />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FaSpinner className="animate-spin text-teal-500 text-3xl mx-auto" />
            <p className="mt-3 text-gray-500 dark:text-gray-400 text-sm">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const isClockInEnabled = settingsData?.settings?.clockInEnabled || false;

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <MyWorkspaceSidebar workspace={workspace} />
        </div>

        <div className="flex-1 flex flex-col h-screen md:h-auto md:min-h-screen overflow-hidden">
          {/* ─── Header ────────────────────────────────────────────────── */}
          <header className="bg-white/95 dark:bg-[#0f0f12]/95 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0 sticky top-0 z-10">
            <div className="flex items-center justify-between px-3 sm:px-6 h-12 sm:h-14">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  onClick={() => navigate(`/my-workspace/${workspaceId}`)}
                  className="p-1 lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
                >
                  <FaArrowLeft className="text-sm" />
                </button>
                <h1 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 truncate flex items-center gap-1.5 sm:gap-2">
                  <FaClock className="text-teal-500 text-sm sm:text-base" />
                  <span className="hidden xs:inline">Clock-in</span>
                </h1>
                {isClockInEnabled ? (
                  <span className="text-[10px] sm:text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 sm:px-2 py-0.5 rounded-full border border-green-200 dark:border-green-700/40 whitespace-nowrap">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] sm:text-xs bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 px-1.5 sm:px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700/40 whitespace-nowrap">
                    Disabled
                  </span>
                )}
                {userTodayClockIn && isClockedIn && (
                  <span className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 sm:px-2 py-0.5 rounded-full border border-green-200 dark:border-green-700/40 whitespace-nowrap hidden xs:inline">
                    In: {new Date(userTodayClockIn.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                {isClockedIn ? (
                  <button
                    onClick={handleClockOut}
                    disabled={isClockOutLoading}
                    className="px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-sm bg-red-600 dark:bg-red-500 text-white rounded-xl hover:bg-red-700 dark:hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-1 sm:gap-2 whitespace-nowrap"
                  >
                    {isClockOutLoading ? <FaSpinner className="animate-spin text-xs sm:text-sm" /> : <FaTimes className="text-xs sm:text-sm" />}
                    <span>Clock Out</span>
                  </button>
                ) : (
                  <button
                    onClick={handleClockIn}
                    disabled={isClockInLoading}
                    className="px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-sm bg-teal-600 dark:bg-teal-500 text-white rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 transition disabled:opacity-50 flex items-center gap-1 sm:gap-2 whitespace-nowrap"
                    style={{ backgroundColor: brandColor }}
                  >
                    {isClockInLoading ? <FaSpinner className="animate-spin text-xs sm:text-sm" /> : <FaCheck className="text-xs sm:text-sm" />}
                    <span>Clock In</span>
                  </button>
                )}
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="p-1.5 sm:p-2 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"
                  title="Settings"
                >
                  <FaCog className="text-base sm:text-lg" />
                </button>
              </div>
            </div>

            {/* ─── Scheduled window banner — always visible, all screen sizes ─── */}
            {isClockInEnabled && (
              <div
                className="px-3 sm:px-6 py-2 border-t border-gray-200/60 dark:border-gray-800/30 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm"
                style={{ backgroundColor: `${brandColor}0d` }}
              >
                {hasScheduledTime ? (
                  <span className="flex items-center gap-1.5 font-medium" style={{ color: brandColor }}>
                    <FaClock className="text-[11px] sm:text-xs" />
                    Clock in between{' '}
                    <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                      {formatTime(clockInStart)}{clockInEnd ? ` – ${formatTime(clockInEnd)}` : ''}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    <FaExclamationTriangle className="text-yellow-500 text-[11px] sm:text-xs" />
                    No clock-in schedule set yet —{' '}
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="underline font-medium hover:opacity-80 transition"
                      style={{ color: brandColor }}
                    >
                      set it now
                    </button>
                  </span>
                )}
                {closingTime && (
                  <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    <FaTimes className="text-[11px] sm:text-xs" />
                    Closes at <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{formatTime(closingTime)}</span>
                  </span>
                )}
              </div>
            )}

            {/* ─── Tabs ────────────────────────────────────────────────── */}
            <div className="flex gap-2 sm:gap-4 px-3 sm:px-6 border-t border-gray-200/60 dark:border-gray-800/30">
              <button
                onClick={() => setActiveTab('today')}
                className={`pb-2 text-[11px] sm:text-sm font-medium transition flex items-center gap-1 sm:gap-2 ${
                  activeTab === 'today'
                    ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <FaUsers className="text-[10px] sm:text-xs" /> Today
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`pb-2 text-[11px] sm:text-sm font-medium transition flex items-center gap-1 sm:gap-2 ${
                  activeTab === 'history'
                    ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <FaHistory className="text-[10px] sm:text-xs" /> History
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`pb-2 text-[11px] sm:text-sm font-medium transition flex items-center gap-1 sm:gap-2 ${
                  activeTab === 'leaderboard'
                    ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <FaChartBar className="text-[10px] sm:text-xs" /> Leaderboard
              </button>
            </div>
          </header>

          {/* ─── Content ───────────────────────────────────────────────── */}
          <main className="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f12]">
            {activeTab === 'today' && (
              <div className="divide-y divide-gray-100 dark:divide-gray-800/30">
                {todayLoading ? (
                  <div className="flex justify-center py-8">
                    <FaSpinner className="animate-spin text-teal-500 text-2xl" />
                  </div>
                ) : (
                  renderClockInList(todayData?.clockIns || [])
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                {historyLoading ? (
                  <div className="flex justify-center py-8">
                    <FaSpinner className="animate-spin text-teal-500 text-2xl" />
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800/30">
                      {renderClockInList(historyData?.clockIns || [])}
                    </div>
                    {historyData?.pagination && historyData.pagination.pages > 1 && (
                      <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-100 dark:border-gray-800/30">
                        <button
                          onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                          disabled={historyPage <= 1}
                          className="px-3 py-1 text-xs sm:text-sm border border-gray-200 dark:border-gray-700/60 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          Previous
                        </button>
                        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          Page {historyPage} of {historyData.pagination.pages}
                        </span>
                        <button
                          onClick={() => setHistoryPage(p => Math.min(historyData.pagination.pages, p + 1))}
                          disabled={historyPage >= historyData.pagination.pages}
                          className="px-3 py-1 text-xs sm:text-sm border border-gray-200 dark:border-gray-700/60 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'leaderboard' && (
              <div className="p-3 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-4">
                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <CustomDropdown
                      options={[
                        { value: 'week', label: 'This Week' },
                        { value: 'month', label: 'This Month' },
                        { value: 'all', label: 'All Time' },
                      ]}
                      value={leaderboardPeriod}
                      onChange={setLeaderboardPeriod}
                      brandColor={brandColor}
                    />
                  </div>
                  <button
                    onClick={handleSendMonthlyReport}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-sm bg-teal-600 dark:bg-teal-500 text-white rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 transition flex items-center gap-1 sm:gap-2 whitespace-nowrap"
                    style={{ backgroundColor: brandColor }}
                  >
                    <FaCalendarAlt className="text-[11px] sm:text-sm" />
                    <span className="hidden xs:inline">Send Monthly Report</span>
                    <span className="xs:hidden">Report</span>
                  </button>
                </div>

                {leaderboardLoading ? (
                  <div className="flex justify-center py-8">
                    <FaSpinner className="animate-spin text-teal-500 text-2xl" />
                  </div>
                ) : (
                  <LeaderboardTable
                    data={leaderboardData?.leaderboard || []}
                    period={leaderboardPeriod}
                  />
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ─── Bottom Bar (mobile) ────────────────────────────────────── */}
      <MyWorkspaceBottombar workspace={workspace} />

      {/* ─── Settings Modal ───────────────────────────────────────────── */}
      <BottomSheet isOpen={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <SettingsContent
          workspaceId={workspaceId}
          workspace={workspace}
          onClose={() => setSettingsOpen(false)}
          onSuccess={() => {
            refetchToday();
            refetchUserHistory();
          }}
        />
      </BottomSheet>

      {/* ─── Confirm Modal ───────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onConfirm={confirmModal.onConfirm || (() => {})}
        onCancel={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel="Send"
        confirmColor="bg-teal-600 hover:bg-teal-700"
      />
    </>
  );
};

export default MyWorkspaceClockin;
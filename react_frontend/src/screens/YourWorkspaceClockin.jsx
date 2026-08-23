// src/workspaceScreens/YourWorkspaceClockin.jsx
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
  useGetAttendanceSummaryQuery,
} from '../slices/clockinApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
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
  FaUserCheck,
  FaUserTimes,
  FaLock,
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

// ─── Check if current time is past closingTime ──────────────────────
const isPastClosing = (closingTime) => {
  if (!closingTime) return false;
  const now = new Date();
  const [hours, minutes] = closingTime.split(':').map(Number);
  const closingDate = new Date(now);
  closingDate.setHours(hours, minutes, 0, 0);
  return now > closingDate;
};

// ─── Check if current time is before clockOutEarliest ──────────────
const isBeforeEarliest = (clockOutEarliest) => {
  if (!clockOutEarliest) return false;
  const now = new Date();
  const [hours, minutes] = clockOutEarliest.split(':').map(Number);
  const earliestDate = new Date(now);
  earliestDate.setHours(hours, minutes, 0, 0);
  return now < earliestDate;
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

// ─── Reason Modal (for early clock‑out) ──────────────────────────────
const ReasonModal = ({ isOpen, onConfirm, onCancel, title, message, confirmLabel = 'Confirm', confirmColor = 'bg-teal-600 hover:bg-teal-700' }) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!isOpen) setReason('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason.');
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-sm w-full p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{message}</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter your reason..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700/60 rounded-lg bg-white dark:bg-[#0b0b10] text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500 outline-none resize-none h-20"
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onCancel} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
            Cancel
          </button>
          <button onClick={handleConfirm} className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition ${confirmColor}`}>
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

// ─── Settings Modal Content ──────────────────────────────────────────
const SettingsContent = ({ workspaceId, workspace, onClose, onSuccess }) => {
  const { data: settingsData, isLoading: settingsLoading, refetch: refetchSettings } = useGetClockInSettingsQuery(workspaceId);
  const [setSettings, { isLoading: isSaving }] = useSetClockInSettingsMutation();

  const [clockInStart, setClockInStart] = useState('');
  const [clockInEnd, setClockInEnd] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [clockOutEarliest, setClockOutEarliest] = useState('');
  const [clockInEnabled, setClockInEnabled] = useState(false);

  useEffect(() => {
    if (settingsData?.settings) {
      setClockInStart(settingsData.settings.clockInStart || '');
      setClockInEnd(settingsData.settings.clockInEnd || '');
      setClosingTime(settingsData.settings.closingTime || '');
      setClockOutEarliest(settingsData.settings.clockOutEarliest || '');
      setClockInEnabled(settingsData.settings.clockInEnabled || false);
    }
  }, [settingsData]);

  const brandColor = workspace?.color || '#0d9488';

  // Validate that start < end
  const validateTimes = () => {
    if (clockInStart && clockInEnd && clockInStart >= clockInEnd) {
      toast.error('Clock‑in start must be before clock‑in end.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateTimes()) return;
    try {
      await setSettings({
        workspaceId,
        clockInStart: clockInStart || null,
        clockInEnd: clockInEnd || null,
        closingTime: closingTime || null,
        clockOutEarliest: clockOutEarliest || null,
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
            <p className="text-xs text-gray-400 mt-1">Clocking in before this time = Not allowed</p>
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
            <p className="text-xs text-gray-400 mt-1">Clocking in after this time = Late (anything up to and including this time is on-time)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Closing Time (auto clock‑out)</label>
            <input
              type="time"
              value={closingTime}
              onChange={(e) => setClosingTime(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
              step="60"
            />
            <p className="text-xs text-gray-400 mt-1">Clock‑in will not be allowed after this time</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Earliest Clock‑out</label>
            <input
              type="time"
              value={clockOutEarliest}
              onChange={(e) => setClockOutEarliest(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
              step="60"
            />
            <p className="text-xs text-gray-400 mt-1">Clock‑out before this time requires a reason</p>
          </div>
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

// ─── Status Badge ──────────────────────────────────────────────────────
// FIX: "auto clocked out" now reads clockIn.autoClockedOut (a dedicated field) instead of
// clockIn.status — the scheduler used to overwrite `status`, which wiped out whether the
// person was actually on-time or late that day and broke the leaderboard.
const StatusBadge = ({ clockIn }) => {
  if (!clockIn) return null;

  const isAuto = clockIn.autoClockedOut || clockIn.status === 'auto-clocked-out';

  if (clockIn.isEarly && !clockIn.isLate) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 sm:px-2 py-0.5 rounded-full">
        <FaCheck className="text-[10px]" /> On Time{isAuto ? ' · Auto Out' : ''}
      </span>
    );
  }
  if (clockIn.isLate) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 sm:px-2 py-0.5 rounded-full">
        <FaTimes className="text-[10px]" /> Late{isAuto ? ' · Auto Out' : ''}
      </span>
    );
  }
  // Fallback if neither flag is set but status might be 'on-time' or legacy 'early'
  if (clockIn.status === 'on-time' || clockIn.status === 'early') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 sm:px-2 py-0.5 rounded-full">
        <FaCheck className="text-[10px]" /> On Time
      </span>
    );
  }
  if (isAuto) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-1.5 sm:px-2 py-0.5 rounded-full">
        <FaClock className="text-[10px]" /> Auto Out
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/30 px-1.5 sm:px-2 py-0.5 rounded-full">
      {clockIn.status || 'Unknown'}
    </span>
  );
};

// ─── Leaderboard Table ──────────────────────────────────────────────
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
            <th className="text-center py-1.5 px-1 sm:py-2 sm:px-2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">On Time</th>
            <th className="text-center py-1.5 px-1 sm:py-2 sm:px-2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider hidden sm:table-cell">Avg Late</th>
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
              <td className="text-center py-1.5 px-1 sm:py-2 sm:px-2 text-gray-600 dark:text-gray-400 text-[10px] sm:text-sm hidden sm:table-cell">{item.avgLateMinutes} min</td>
              <td className="text-center py-1.5 px-1 sm:py-2 sm:px-2 font-semibold text-teal-600 dark:text-teal-400 text-[10px] sm:text-sm">{Math.round(item.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Attendance Summary View ──────────────────────────────────────────
const AttendanceSummaryView = ({ workspaceId, brandColor }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const { data, isLoading, refetch } = useGetAttendanceSummaryQuery({
    workspaceId,
    date: selectedDate,
  });

  useEffect(() => {
    refetch();
  }, [selectedDate, refetch]);

  const summary = data || { clockedIn: [], notClockedIn: [] };

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <FaCalendarAlt className="text-teal-500" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-700/60 rounded-lg bg-white dark:bg-[#0b0b10] text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500 outline-none"
          />
        </div>
        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Total members: {summary.totalMembers || 0}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <FaSpinner className="animate-spin text-teal-500 text-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Clocked In */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FaUserCheck className="text-green-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Clocked In ({summary.clockedIn?.length || 0})
              </h3>
            </div>
            {summary.clockedIn?.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">No one has clocked in yet today.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800/30 border border-gray-100 dark:border-gray-800/30 rounded-xl overflow-hidden">
                {summary.clockedIn.map((user) => (
                  <div key={user._id} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                        {user.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{user.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {user.clockInTime ? new Date(user.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </div>
                    </div>
                    <StatusBadge clockIn={user} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Not Clocked In */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FaUserTimes className="text-red-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Not Clocked In ({summary.notClockedIn?.length || 0})
              </h3>
            </div>
            {summary.notClockedIn?.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">Everyone has clocked in today!</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800/30 border border-gray-100 dark:border-gray-800/30 rounded-xl overflow-hidden">
                {summary.notClockedIn.map((user) => (
                  <div key={user._id} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                      {user.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{user.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────
const YourWorkspaceClockin = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState('summary');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('month');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [reasonModal, setReasonModal] = useState({ isOpen: false, onConfirm: null });

  // ─── Workspace data ──────────────────────────────────────────────────
  const { data: workspaceData, isLoading: workspaceLoading } = useGetWorkspaceQuery(workspaceId);
  const workspace = workspaceData?.workspace;

  const userId = userInfo?._id;
  const isMember = workspace?.members?.some(
    (m) => (m.user?._id === userId || m.user === userId) && m.status === 'active'
  );
  const isAdmin = workspace?.members?.some(
    (m) => (m.user?._id === userId || m.user === userId) && m.role === 'Admin' && m.status === 'active'
  );

  if (!isMember && !workspaceLoading) {
    navigate(`/workspace/${workspaceId}`);
    return null;
  }

  const brandColor = workspace?.color || '#0d9488';

  // ─── Queries ────────────────────────────────────────────────────────
  const { data: settingsData } = useGetClockInSettingsQuery(workspaceId);
  const clockInStart = settingsData?.settings?.clockInStart || settingsData?.settings?.clockInTime || null;
  const clockInEnd = settingsData?.settings?.clockInEnd || null;
  const closingTime = settingsData?.settings?.closingTime || null;
  const clockOutEarliest = settingsData?.settings?.clockOutEarliest || null;
  const hasScheduledTime = clockInStart !== null;

  const pastClosing = isPastClosing(closingTime);
  const beforeEarliest = isBeforeEarliest(clockOutEarliest);

  // Current user's today clock-in status
  const { data: userHistoryData, isLoading: userHistoryLoading, refetch: refetchUserHistory } = useGetUserClockInHistoryQuery(
    { workspaceId, page: 1, limit: 1 },
    { skip: !workspaceId }
  );
  const userTodayClockIn = userHistoryData?.history?.[0] || null;
  const isClockedIn = userTodayClockIn && !userTodayClockIn.clockOutTime;

  // History (paginated)
  const [historyPage, setHistoryPage] = useState(1);
  const { data: historyData, isLoading: historyLoading } = useGetUserClockInHistoryQuery(
    { workspaceId, page: historyPage, limit: 20 },
    { skip: activeTab !== 'history' }
  );

  // Leaderboard
  const { data: leaderboardData, isLoading: leaderboardLoading } = useGetClockInLeaderboardQuery(
    { workspaceId, period: leaderboardPeriod },
    { skip: activeTab !== 'leaderboard' }
  );

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
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to clock in.');
    }
  };

  const handleClockOut = async (providedReason = null) => {
    try {
      await clockOutMutation({ workspaceId, reason: providedReason || undefined }).unwrap();
      toast.success('Clocked out successfully!');
      refetchUserHistory();
      setReasonModal({ isOpen: false, onConfirm: null });
    } catch (err) {
      // If the error is about missing reason, open the modal
      if (err?.data?.message?.includes('reason') || err?.data?.message?.includes('provide a reason')) {
        if (!reasonModal.isOpen) {
          setReasonModal({
            isOpen: true,
            onConfirm: async (reason) => {
              await handleClockOut(reason);
            },
          });
        }
      } else {
        toast.error(err?.data?.message || 'Failed to clock out.');
      }
    }
  };

  // Wrap clock-out to check earliest time preemptively
  const onClockOutClick = () => {
    if (beforeEarliest) {
      setReasonModal({
        isOpen: true,
        onConfirm: async (reason) => {
          await handleClockOut(reason);
        },
      });
    } else {
      handleClockOut(null);
    }
  };

  const handleSendMonthlyReport = async () => {
    if (!isAdmin) return;
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
  const renderHistoryList = (history) => {
    if (!history || history.length === 0) {
      return (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <FaHistory className="text-4xl mx-auto mb-2 opacity-30" />
          <p className="text-sm">No clock-in history found</p>
        </div>
      );
    }

    return history.map((item) => {
      const time = new Date(item.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const date = new Date(item.clockInTime).toLocaleDateString([], { month: 'short', day: 'numeric' });
      return (
        <div key={item._id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800/30 last:border-0 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-sm flex-shrink-0">
            <FaClock className="text-teal-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">
              {date}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>In: {time}</span>
              {item.clockOutTime && (
                <>
                  <span>·</span>
                  <span>Out: {new Date(item.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              )}
              {item.autoClockedOut && (
                <span className="text-purple-500 text-[10px]">(auto)</span>
              )}
            </div>
            {item.clockOutReason && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 italic">📝 {item.clockOutReason}</p>
            )}
          </div>
          <div className="flex-shrink-0">
            <StatusBadge clockIn={item} />
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
          <YourWorkspaceSidebar workspace={workspace} />
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
  const canClockIn = isClockInEnabled && !isClockedIn && !pastClosing;

  // ─── Determine tabs based on role ─────────────────────────────────
  const tabs = isAdmin
    ? [
        { id: 'summary', label: 'Attendance', icon: FaUsers },
        { id: 'history', label: 'History', icon: FaHistory },
        { id: 'leaderboard', label: 'Leaderboard', icon: FaChartBar },
      ]
    : [
        { id: 'history', label: 'My History', icon: FaHistory },
        { id: 'leaderboard', label: 'Leaderboard', icon: FaChartBar },
      ];

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <YourWorkspaceSidebar workspace={workspace} />
        </div>

        <div className="flex-1 flex flex-col h-screen md:h-auto md:min-h-screen overflow-hidden">
          {/* ─── Header ────────────────────────────────────────────────── */}
          <header className="bg-white/95 dark:bg-[#0f0f12]/95 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0 sticky top-0 z-10">
            <div className="flex items-center justify-between px-3 sm:px-6 h-12 sm:h-14">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  onClick={() => navigate(`/workspace/${workspaceId}`)}
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
                {isClockInEnabled && userTodayClockIn && isClockedIn && (
                  <span className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 sm:px-2 py-0.5 rounded-full border border-green-200 dark:border-green-700/40 whitespace-nowrap hidden xs:inline">
                    In: {new Date(userTodayClockIn.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                {isAdmin && (
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className="p-1.5 sm:p-2 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"
                    title="Settings"
                  >
                    <FaCog className="text-base sm:text-lg" />
                  </button>
                )}
                {isClockInEnabled && (
                  isClockedIn ? (
                    <button
                      onClick={onClockOutClick}
                      disabled={isClockOutLoading}
                      className="px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-sm bg-red-600 dark:bg-red-500 text-white rounded-xl hover:bg-red-700 dark:hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-1 sm:gap-2 whitespace-nowrap"
                    >
                      {isClockOutLoading ? <FaSpinner className="animate-spin text-xs sm:text-sm" /> : <FaTimes className="text-xs sm:text-sm" />}
                      <span>Clock Out</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleClockIn}
                      disabled={!canClockIn || isClockInLoading}
                      className={`px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-sm text-white rounded-xl transition disabled:opacity-50 flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                        canClockIn ? 'bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 dark:hover:bg-teal-600' : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                      }`}
                      style={canClockIn ? { backgroundColor: brandColor } : {}}
                      title={!canClockIn && pastClosing ? 'Clock-in is closed for today' : ''}
                    >
                      {isClockInLoading ? <FaSpinner className="animate-spin text-xs sm:text-sm" /> : <FaCheck className="text-xs sm:text-sm" />}
                      <span>Clock In</span>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* ─── Scheduled window banner ─────────────────────────────── */}
            {isClockInEnabled && (
              <div
                className={`px-3 sm:px-6 py-2 border-t border-gray-200/60 dark:border-gray-800/30 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm ${
                  pastClosing ? 'bg-red-50 dark:bg-red-900/20' : 'bg-teal-50/30 dark:bg-teal-900/10'
                }`}
                style={!pastClosing ? { backgroundColor: `${brandColor}0d` } : {}}
              >
                {pastClosing ? (
                  <span className="flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
                    <FaLock className="text-[11px] sm:text-xs" />
                    Clock‑in is closed for today
                  </span>
                ) : hasScheduledTime ? (
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
                    No clock-in schedule set yet
                  </span>
                )}
                {closingTime && (
                  <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    <FaTimes className="text-[11px] sm:text-xs" />
                    Closes at <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{formatTime(closingTime)}</span>
                  </span>
                )}
                {clockOutEarliest && (
                  <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    <FaClock className="text-[11px] sm:text-xs" />
                    Earliest out: <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{formatTime(clockOutEarliest)}</span>
                  </span>
                )}
              </div>
            )}

            {/* ─── Tabs ────────────────────────────────────────────────── */}
            <div className="flex gap-2 sm:gap-4 px-3 sm:px-6 border-t border-gray-200/60 dark:border-gray-800/30">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`pb-2 text-[11px] sm:text-sm font-medium transition flex items-center gap-1 sm:gap-2 ${
                      activeTab === tab.id
                        ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    <Icon className="text-[10px] sm:text-xs" /> {tab.label}
                  </button>
                );
              })}
            </div>
          </header>

          {/* ─── Content ───────────────────────────────────────────────── */}
          <main className="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f12]">
            {isAdmin && activeTab === 'summary' && (
              <AttendanceSummaryView workspaceId={workspaceId} brandColor={brandColor} />
            )}

            {activeTab === 'history' && (
              <div>
                {historyLoading || userHistoryLoading ? (
                  <div className="flex justify-center py-8">
                    <FaSpinner className="animate-spin text-teal-500 text-2xl" />
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800/30">
                      {renderHistoryList(historyData?.history || [])}
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
                  {isAdmin && (
                    <button
                      onClick={handleSendMonthlyReport}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-sm bg-teal-600 dark:bg-teal-500 text-white rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 transition flex items-center gap-1 sm:gap-2 whitespace-nowrap"
                      style={{ backgroundColor: brandColor }}
                    >
                      <FaCalendarAlt className="text-[11px] sm:text-sm" />
                      <span className="hidden xs:inline">Send Monthly Report</span>
                      <span className="xs:hidden">Report</span>
                    </button>
                  )}
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
      <YourWorkspaceBottombar workspace={workspace} />

      {/* ─── Settings Modal (admin only) ───────────────────────────── */}
      {isAdmin && (
        <BottomSheet isOpen={settingsOpen} onClose={() => setSettingsOpen(false)}>
          <SettingsContent
            workspaceId={workspaceId}
            workspace={workspace}
            onClose={() => setSettingsOpen(false)}
            onSuccess={() => {
              refetchUserHistory();
            }}
          />
        </BottomSheet>
      )}

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

      {/* ─── Reason Modal ───────────────────────────────────────────── */}
      <ReasonModal
        isOpen={reasonModal.isOpen}
        onConfirm={reasonModal.onConfirm || (() => {})}
        onCancel={() => setReasonModal({ isOpen: false, onConfirm: null })}
        title="Early Clock‑out Reason"
        message="You are clocking out before the earliest allowed time. Please provide a reason."
        confirmLabel="Confirm Clock‑out"
        confirmColor="bg-red-600 hover:bg-red-700"
      />
    </>
  );
};

export default YourWorkspaceClockin;
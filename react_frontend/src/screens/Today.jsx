// src/screens/Today.jsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  FaSun,
  FaTasks,
  FaFolderOpen,
  FaComments,
  FaUsers,
  FaExclamationCircle,
  FaRegClock,
  FaCheckDouble,
  FaHashtag,
  FaUserPlus,
  FaSpinner,
  FaArrowRight,
  FaMagic,
  FaTimes,
  FaCircle,
  FaPaperPlane,
  FaLightbulb,
  FaCheckCircle,
  FaChevronDown,
  FaChartBar,
} from 'react-icons/fa';
import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';
import { useGetTodayQuery } from '../slices/todayApiSlice';
import { useAskXircleMutation } from '../slices/aiApiSlice';

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const getFirstName = (name) => {
  if (!name) return null;
  return String(name).trim().split(/\s+/)[0] || null;
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const formatDue = (date) => {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatRelative = (date) => {
  if (!date) return '';
  const diffMs = Date.now() - new Date(date).getTime();
  const m = Math.round(diffMs / 60000);
  const h = Math.round(diffMs / 3600000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  const days = Math.round(diffMs / 86400000);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const todayLabel = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

// ─────────────────────────────────────────────────────────────────
// ACCENT SYSTEM
// ─────────────────────────────────────────────────────────────────

const accentMap = {
  teal: {
    text: 'text-teal-600 dark:text-[#0d9488]',
    bg: 'bg-teal-50/60 dark:bg-[#0d9488]/8',
    border: 'border-teal-200/50 dark:border-[#0d9488]/20',
    dot: 'bg-teal-500',
    hex: '#0d9488',
  },
  red: {
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50/60 dark:bg-red-950/15',
    border: 'border-red-200/50 dark:border-red-900/30',
    dot: 'bg-red-500',
    hex: '#ef4444',
  },
  amber: {
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50/60 dark:bg-amber-950/15',
    border: 'border-amber-200/50 dark:border-amber-900/30',
    dot: 'bg-amber-500',
    hex: '#f59e0b',
  },
  indigo: {
    text: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50/60 dark:bg-indigo-950/15',
    border: 'border-indigo-200/50 dark:border-indigo-900/30',
    dot: 'bg-indigo-500',
    hex: '#6366f1',
  },
  purple: {
    text: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50/60 dark:bg-purple-950/15',
    border: 'border-purple-200/50 dark:border-purple-900/30',
    dot: 'bg-purple-500',
    hex: '#a855f7',
  },
};

// ─────────────────────────────────────────────────────────────────
// WORKSPACE CHIP
// ─────────────────────────────────────────────────────────────────

const WorkspaceChip = ({ workspace }) => {
  if (!workspace?.name) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800/60 max-w-[140px]">
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: workspace.color || '#0d9488' }}
      />
      <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 truncate">
        {workspace.name}
      </span>
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────
// SECTION CARD
// ─────────────────────────────────────────────────────────────────

const SectionCard = ({ icon: Icon, title, subtitle, count, accent = 'teal', action, children }) => {
  const a = accentMap[accent] || accentMap.teal;
  return (
    <section className="bg-white dark:bg-[#14141a] border border-gray-200/60 dark:border-gray-800/60 rounded-2xl overflow-hidden">
      <header className={`px-4 lg:px-5 py-3 flex items-center justify-between gap-3 border-b ${a.bg} ${a.border}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${a.bg} border ${a.border}`}>
            <Icon className={`text-sm ${a.text}`} />
          </span>
          <div className="min-w-0">
            <h2 className={`text-sm font-semibold truncate ${a.text}`}>{title}</h2>
            {subtitle && (
              <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate">{subtitle}</p>
            )}
          </div>
          {count > 0 && (
            <span className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/60 dark:bg-black/30 ${a.text}`}>
              {count}
            </span>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
};

const SubGroupLabel = ({ label, accent = 'gray' }) => {
  const a = accentMap[accent] || { text: 'text-gray-500 dark:text-gray-400', dot: 'bg-gray-400' };
  return (
    <div className="px-4 lg:px-5 pt-3 pb-1.5 flex items-center gap-2">
      <span className={`w-1 h-1 rounded-full ${a.dot}`} />
      <span className={`text-[10px] font-semibold uppercase tracking-widest ${a.text}`}>
        {label}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// ROWS
// ─────────────────────────────────────────────────────────────────

const TaskRow = ({ task, onOpen, isOverdue = false }) => (
  <button
    onClick={onOpen}
    className="relative w-full text-left pl-4 lg:pl-5 pr-3 lg:pr-4 py-3 hover:bg-gray-50 dark:hover:bg-[#0d9488]/5 transition flex items-start gap-3 border-b border-gray-100 dark:border-gray-800/30 last:border-0 group"
  >
    {isOverdue && (
      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-red-500" />
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-800 dark:text-gray-100 break-words leading-snug">
        {task.title}
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px] text-gray-500 dark:text-gray-500">
        {task.project?.workspace && <WorkspaceChip workspace={task.project.workspace} />}
        {task.projectName && (
          <span className="flex items-center gap-1 min-w-0">
            <FaFolderOpen className="text-[9px] flex-shrink-0" />
            <span className="truncate">{task.projectName}</span>
          </span>
        )}
        {task.folderName && (
          <span className="flex items-center gap-1 min-w-0">
            <FaFolderOpen className="text-[9px] flex-shrink-0" />
            <span className="truncate">{task.folderName}</span>
          </span>
        )}
        {task.dueDate && (
          <span
            className={`flex items-center gap-1 font-medium ${
              isOverdue ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-500'
            }`}
          >
            <FaRegClock className="text-[9px]" />
            {formatDue(task.dueDate)}
          </span>
        )}
        {task.subtaskCount > 0 && (
          <span>
            {task.subtaskDone}/{task.subtaskCount}
          </span>
        )}
      </div>
    </div>
    <FaArrowRight className="text-[10px] text-gray-300 dark:text-gray-600 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
  </button>
);

const ChatRow = ({ chat, onOpen }) => {
  const displayName = chat.name || 'Direct message';
  return (
    <button
      onClick={onOpen}
      className="w-full text-left px-4 lg:px-5 py-3 hover:bg-gray-50 dark:hover:bg-[#0d9488]/5 transition flex items-center gap-3 border-b border-gray-100 dark:border-gray-800/30 last:border-0 group"
    >
      <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
        <FaHashtag className="text-indigo-600 dark:text-indigo-400 text-[11px]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
          {displayName}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-500">
          {chat.unreadCount} unread
          {chat.mentionCount > 0 && (
            <span className="ml-2 text-indigo-500 dark:text-indigo-400 font-medium">
              · {chat.mentionCount} mention{chat.mentionCount > 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>
      {chat.mentionCount > 0 && (
        <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
      )}
      <FaArrowRight className="text-[10px] text-gray-300 dark:text-gray-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
};

const ConfirmRow = ({ item, onOpen }) => (
  <button
    onClick={onOpen}
    className="w-full text-left px-4 lg:px-5 py-3 hover:bg-gray-50 dark:hover:bg-[#0d9488]/5 transition flex items-start gap-3 border-b border-gray-100 dark:border-gray-800/30 last:border-0 group"
  >
    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
      <FaCheckDouble className="text-amber-600 dark:text-amber-400 text-xs" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-800 dark:text-gray-100 break-words leading-snug">
        {item.title || item.taskTitle}
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-gray-500 dark:text-gray-500">
        {item.project?.workspace && <WorkspaceChip workspace={item.project.workspace} />}
        {item.projectName && <span className="truncate">{item.projectName}</span>}
        <span className="text-amber-600 dark:text-amber-400 font-medium">
          {item.completedBy
            ? `${getFirstName(item.completedBy)} marked it done`
            : `${item.pendingSubtasks?.length || 0} subtask(s) to review`}
        </span>
      </div>
    </div>
    <FaArrowRight className="text-[10px] text-gray-300 dark:text-gray-600 flex-shrink-0 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
  </button>
);

// ─────────────────────────────────────────────────────────────────
// STAT TILES
// ─────────────────────────────────────────────────────────────────

const StatTile = ({ icon: Icon, label, value, accent }) => {
  const a = accentMap[accent];
  return (
    <div className="flex flex-col items-center text-center gap-1 py-1">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${a.bg} border ${a.border}`}>
        <Icon className={`text-sm ${a.text}`} />
      </span>
      <p
        className={`text-lg font-bold tabular-nums leading-none ${
          value > 0 ? a.text : 'text-gray-300 dark:text-gray-700'
        }`}
      >
        {value}
      </p>
      <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold leading-tight">
        {label}
      </p>
    </div>
  );
};

const StatTileDesktop = ({ icon: Icon, label, value, accent }) => {
  const a = accentMap[accent];
  return (
    <div className="bg-white dark:bg-[#14141a] border border-gray-200/60 dark:border-gray-800/60 rounded-2xl p-4 flex items-center gap-3.5 hover:border-gray-300 dark:hover:border-gray-700/60 transition">
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${a.bg} border ${a.border}`}>
        <Icon className={`text-base ${a.text}`} />
      </span>
      <div className="min-w-0">
        <p
          className={`text-2xl font-bold tabular-nums leading-none ${
            value > 0 ? a.text : 'text-gray-300 dark:text-gray-700'
          }`}
        >
          {value}
        </p>
        <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold mt-1">
          {label}
        </p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// CHART — matches the workspace chart style (AreaChart + gradient)
// ─────────────────────────────────────────────────────────────────

const ChartCard = ({ stats, brandColor = '#0d9488' }) => {
  const data = stats.filter((s) => s.value > 0);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-8 flex flex-col items-center justify-center text-center">
        <FaChartBar className="text-3xl text-gray-300 dark:text-gray-700 mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-500">Nothing to chart yet.</p>
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
          Your attention breakdown will show here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-4 sm:p-5 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 dark:bg-[#0d9488]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-widest">
            Attention Breakdown
          </p>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
            <span>{data.reduce((s, d) => s + d.value, 0)} items</span>
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              Where your day is loaded
            </span>
          </h2>
        </div>
      </div>

      <div className="h-40 lg:h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="todayChartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={brandColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={brandColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 9, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              tickCount={5}
              width={28}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                fontSize: '11px',
                backgroundColor: '#1e1e2a',
                color: '#f0f0f0',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}
              labelStyle={{ color: '#9ca3af', fontSize: '11px' }}
              formatter={(value) => [value, 'items']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={brandColor}
              strokeWidth={2}
              fill="url(#todayChartGradient)"
              dot={{ r: 3, fill: brandColor }}
              activeDot={{ r: 5, stroke: '#fff', strokeWidth: 1 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// ASK XIRCLE
// ─────────────────────────────────────────────────────────────────

const AskXircle = () => {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [answer, setAnswer] = useState(null);
  const inputRef = useRef(null);

  const [ask, { isLoading }] = useAskXircleMutation();

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const runAsk = async (q) => {
    const trimmed = q.trim();
    if (!trimmed || isLoading) return;
    const userTurn = { role: 'user', content: trimmed };
    const nextHistory = [...history, userTurn];
    try {
      const res = await ask({ question: trimmed, history: history.slice(-6) }).unwrap();
      setHistory([...nextHistory, { role: 'assistant', content: res.answer }]);
      setAnswer({ text: res.answer, followUps: res.followUps || [] });
    } catch (err) {
      toast.error(err?.data?.message || 'Could not answer that right now.');
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const q = question.trim();
    if (!q) return;
    setQuestion('');
    await runAsk(q);
  };

  const dismiss = () => {
    setAnswer(null);
    setOpen(false);
    setHistory([]);
  };

  return (
    <div className="mb-5">
      <AnimatePresence initial={false}>
        {!open && (
          <motion.button
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(true)}
            className="w-full bg-gradient-to-r from-teal-50/60 to-transparent dark:from-[#0d9488]/10 dark:to-transparent border border-teal-200/60 dark:border-[#0d9488]/25 hover:border-teal-500/60 dark:hover:border-[#0d9488]/50 rounded-2xl px-4 lg:px-5 py-3.5 flex items-center gap-3 text-left transition group"
          >
            <span className="w-9 h-9 rounded-full bg-white dark:bg-[#14141a] flex items-center justify-center flex-shrink-0 shadow-sm">
              <FaMagic className="text-teal-600 dark:text-[#0d9488] text-sm" />
            </span>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Ask Xircle anything about your work…
              </span>
              <span className="hidden lg:block text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">
                What's overdue · What did I finish this week · Summarize my projects
              </span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="bg-white dark:bg-[#14141a] border border-teal-200/60 dark:border-[#0d9488]/25 rounded-2xl overflow-hidden"
          >
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 px-3 lg:px-4 py-2.5 border-b border-gray-100 dark:border-gray-800/40"
            >
              <FaMagic className="text-teal-600 dark:text-[#0d9488] text-sm flex-shrink-0 ml-1" />
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What's overdue? What did I finish this week?…"
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-gray-800 dark:text-white placeholder-gray-400 outline-none py-1.5"
              />
              {isLoading ? (
                <FaSpinner className="animate-spin text-teal-500 text-sm flex-shrink-0" />
              ) : (
                <button
                  type="submit"
                  disabled={!question.trim()}
                  className="p-1.5 text-teal-600 dark:text-[#0d9488] hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition disabled:opacity-40 disabled:hover:bg-transparent"
                  aria-label="Ask"
                >
                  <FaPaperPlane className="text-sm" />
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition"
                aria-label="Close"
              >
                <FaTimes className="text-xs" />
              </button>
            </form>

            <AnimatePresence>
              {answer && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 lg:px-5 py-3 border-b border-gray-100 dark:border-gray-800/40">
                    <div className="flex items-start gap-2.5">
                      <FaLightbulb className="text-amber-500 text-sm flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                        {answer.text}
                      </p>
                    </div>
                  </div>
                  {answer.followUps.length > 0 && (
                    <div className="px-4 lg:px-5 py-3 flex flex-wrap gap-1.5 bg-gray-50/60 dark:bg-[#0f0f12]/40">
                      {answer.followUps.map((fu, i) => (
                        <button
                          key={i}
                          onClick={() => runAsk(fu)}
                          disabled={isLoading}
                          className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700/60 text-gray-600 dark:text-gray-300 hover:border-teal-500 hover:text-teal-600 dark:hover:text-[#0d9488] transition disabled:opacity-50"
                        >
                          {fu}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// CHART TOGGLE — shared wrapper used on both mobile & desktop
// ─────────────────────────────────────────────────────────────────

const ChartToggle = ({ stats, brandColor, isOpen, onToggle }) => (
  <>
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 lg:px-5 py-2.5 bg-white dark:bg-[#14141a] border border-gray-200/60 dark:border-gray-800/60 rounded-2xl text-left transition"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <FaChartBar className="text-teal-600 dark:text-[#0d9488] text-xs" />
        {isOpen ? 'Hide chart' : 'Show chart'}
      </span>
      <FaChevronDown
        className={`text-xs text-gray-400 transition-transform duration-200 ${
          isOpen ? 'rotate-180' : ''
        }`}
      />
    </button>
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="pt-3">
            <ChartCard stats={stats} brandColor={brandColor} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </>
);

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────

const Today = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [showChart, setShowChart] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useGetTodayQuery(undefined, {
      pollingInterval: 60000,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    });

  const openPersonalTask = () => navigate('/personal-tasks');
  const openProjectTask = (task) => {
    const wsId = task.project?.workspace?._id || task.project?.workspace;
    const projId = task.project?._id || task.projectId;
    if (wsId && projId) navigate(`/workspace/${wsId}/project/${projId}`);
    else navigate('/personal-tasks');
  };
  const openChat = (chat) => {
    if (chat.workspace) navigate(`/workspace/${chat.workspace}/chat/${chat.chatId}`);
    else navigate(`/channels/${chat.chatId}`);
  };
  const openConfirm = (item) => {
    const wsId = item.project?.workspace?._id || item.project?.workspace;
    const projId = item.project?._id || item.projectId;
    if (wsId && projId) navigate(`/workspace/${wsId}/project/${projId}`);
  };
  const openJoinRequests = (pulse) =>
    navigate(`/workspace/${pulse.workspaceId}/members`);

  const firstName = getFirstName(userInfo?.name);
  const attention = data?.totalAttention || 0;

  const sections = data?.sections || {};
  const myWork = sections.myWork || { overdue: [], dueToday: [] };
  const teamWork = sections.teamWork || { overdue: [], dueToday: [] };
  const awaiting = sections.awaitingMe || { taskConfirmations: [], subtaskReviews: [] };
  const convos = sections.conversations || { unreadChats: [] };
  const pulse = sections.teamPulse || { pendingJoinRequests: [], recentProjects: [] };

  const normProjectTask = (t) => ({
    ...t,
    projectName: t.projectName || t.project?.name,
    isOverdue: t.isOverdue,
  });

  const hasWorkColumn =
    myWork.overdue.length > 0 ||
    myWork.dueToday.length > 0 ||
    teamWork.overdue.length > 0 ||
    teamWork.dueToday.length > 0 ||
    awaiting.taskConfirmations.length > 0 ||
    awaiting.subtaskReviews.length > 0;

  const hasAwarenessColumn =
    convos.unreadChats.length > 0 ||
    pulse.pendingJoinRequests.length > 0 ||
    pulse.recentProjects.length > 0;

  const hasAnything = hasWorkColumn || hasAwarenessColumn;

  const overdueTotal = myWork.overdue.length + teamWork.overdue.length;
  const dueTodayTotal = myWork.dueToday.length + teamWork.dueToday.length;
  const awaitingTotal = awaiting.taskConfirmations.length + awaiting.subtaskReviews.length;
  const mentionTotal = convos.counts?.mentions || 0;

  const statsData = [
    { key: 'overdue', label: 'Overdue', value: overdueTotal, accent: 'red', icon: FaExclamationCircle, hex: accentMap.red.hex },
    { key: 'dueToday', label: 'Due today', value: dueTodayTotal, accent: 'teal', icon: FaRegClock, hex: accentMap.teal.hex },
    { key: 'awaiting', label: 'Awaiting', value: awaitingTotal, accent: 'amber', icon: FaCheckDouble, hex: accentMap.amber.hex },
    { key: 'mentions', label: 'Mentions', value: mentionTotal, accent: 'indigo', icon: FaComments, hex: accentMap.indigo.hex },
  ];

  // ── Loading ──
  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <FaSpinner className="animate-spin text-teal-500 text-3xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <FaExclamationCircle className="text-red-500 text-3xl mx-auto mb-3" />
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              {error?.data?.message || 'Could not load your Today.'}
            </p>
            <button
              onClick={refetch}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-xl transition"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
      <div className="hidden md:block md:w-72 md:flex-shrink-0">
        <GeneralSidebar />
      </div>

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* ═══ FIXED TOP BAR ═══ */}
        <header className="sticky top-0 z-30 bg-white/85 dark:bg-[#0f0f12]/85 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-[#0d9488]/15 border border-teal-200/60 dark:border-[#0d9488]/25 flex items-center justify-center flex-shrink-0">
                <FaSun className="text-teal-600 dark:text-[#0d9488] text-sm" />
              </span>
              <div className="min-w-0">
                <h1 className="text-sm lg:text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
                  Today
                </h1>
                <p className="text-[10px] lg:text-[11px] text-gray-500 dark:text-gray-500 leading-tight truncate">
                  {todayLabel()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-shrink-0">
              {isFetching && !isLoading && (
                <FaSpinner className="animate-spin text-gray-400 text-xs" />
              )}
              {userInfo?.profile ? (
                <img
                  src={userInfo.profile}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700/60"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold">
                  {(firstName || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ═══ MAIN ═══ */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 lg:pt-6 pb-24 md:pb-12">

          {/* Greeting */}
          <div className="mb-4 lg:mb-5">
            <h2 className="text-xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              {getGreeting()}
              {firstName && (
                <>
                  , <span className="text-teal-600 dark:text-[#0d9488]">{firstName}</span>
                </>
              )}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {hasAnything ? (
                <>
                  <span className="font-semibold text-gray-700 dark:text-gray-200">{attention}</span>{' '}
                  {attention === 1 ? 'thing needs' : 'things need'} your attention
                </>
              ) : (
                <>You're all caught up. Nothing needs you right now.</>
              )}
            </p>
          </div>

          {/* ═══ STATS ═══ */}
          {/* Mobile — single card with 4 tiles inside */}
          <div className="md:hidden mb-4 bg-white dark:bg-[#14141a] border border-gray-200/60 dark:border-gray-800/60 rounded-2xl px-2 py-3">
            <div className="grid grid-cols-4 gap-1">
              {statsData.map((s) => (
                <StatTile key={s.key} {...s} />
              ))}
            </div>
          </div>

          {/* Desktop — 4 separate cards */}
          <div className="hidden md:grid md:grid-cols-4 md:gap-4 mb-5">
            {statsData.map((s) => (
              <StatTileDesktop key={s.key} {...s} />
            ))}
          </div>

          {/* ═══ CHART — optional on both mobile and desktop ═══ */}
          <div className="mb-5">
            <ChartToggle
              stats={statsData}
              brandColor={accentMap.teal.hex}
              isOpen={showChart}
              onToggle={() => setShowChart((v) => !v)}
            />
          </div>

          {/* Ask Xircle */}
          <AskXircle />

          {/* ═══ CONTENT GRID ═══ */}
          <div
            className={`grid gap-4 lg:gap-5 ${
              hasWorkColumn && hasAwarenessColumn ? 'lg:grid-cols-5' : 'lg:grid-cols-1'
            }`}
          >
            {hasWorkColumn && (
              <div
                className={`space-y-4 lg:space-y-5 ${
                  hasWorkColumn && hasAwarenessColumn ? 'lg:col-span-3' : ''
                }`}
              >
                {(myWork.overdue.length > 0 || myWork.dueToday.length > 0) && (
                  <SectionCard
                    icon={FaTasks}
                    title="My Work"
                    subtitle="Your personal tasks"
                    accent="teal"
                    count={myWork.overdue.length + myWork.dueToday.length}
                    action={
                      <Link
                        to="/personal-tasks"
                        className="text-[10px] font-medium uppercase tracking-wider text-teal-600 dark:text-[#0d9488] hover:underline"
                      >
                        Open
                      </Link>
                    }
                  >
                    {myWork.overdue.length > 0 && (
                      <>
                        <SubGroupLabel label="Overdue" accent="red" />
                        {myWork.overdue.map((t) => (
                          <TaskRow key={t.id} task={t} onOpen={openPersonalTask} isOverdue />
                        ))}
                      </>
                    )}
                    {myWork.dueToday.length > 0 && (
                      <>
                        <SubGroupLabel label="Due Today" accent="teal" />
                        {myWork.dueToday.map((t) => (
                          <TaskRow key={t.id} task={t} onOpen={openPersonalTask} />
                        ))}
                      </>
                    )}
                  </SectionCard>
                )}

                {(teamWork.overdue.length > 0 || teamWork.dueToday.length > 0) && (
                  <SectionCard
                    icon={FaFolderOpen}
                    title="Team Work"
                    subtitle="Assigned to you across your workspaces"
                    accent="teal"
                    count={teamWork.overdue.length + teamWork.dueToday.length}
                  >
                    {teamWork.overdue.length > 0 && (
                      <>
                        <SubGroupLabel label="Overdue" accent="red" />
                        {teamWork.overdue.map((t) => {
                          const n = normProjectTask(t);
                          return (
                            <TaskRow
                              key={n.id}
                              task={n}
                              onOpen={() => openProjectTask(n)}
                              isOverdue
                            />
                          );
                        })}
                      </>
                    )}
                    {teamWork.dueToday.length > 0 && (
                      <>
                        <SubGroupLabel label="Due Today" accent="teal" />
                        {teamWork.dueToday.map((t) => {
                          const n = normProjectTask(t);
                          return (
                            <TaskRow
                              key={n.id}
                              task={n}
                              onOpen={() => openProjectTask(n)}
                            />
                          );
                        })}
                      </>
                    )}
                  </SectionCard>
                )}

                {(awaiting.taskConfirmations.length > 0 || awaiting.subtaskReviews.length > 0) && (
                  <SectionCard
                    icon={FaCheckDouble}
                    title="Awaiting You"
                    subtitle="Blocked on your review"
                    accent="amber"
                    count={awaiting.taskConfirmations.length + awaiting.subtaskReviews.length}
                  >
                    {awaiting.taskConfirmations.map((item) => (
                      <ConfirmRow key={item.id} item={item} onOpen={() => openConfirm(item)} />
                    ))}
                    {awaiting.subtaskReviews.map((item) => (
                      <ConfirmRow
                        key={item.taskId}
                        item={item}
                        onOpen={() => openConfirm(item)}
                      />
                    ))}
                  </SectionCard>
                )}
              </div>
            )}

            {hasAwarenessColumn && (
              <div
                className={`space-y-4 lg:space-y-5 ${
                  hasWorkColumn && hasAwarenessColumn ? 'lg:col-span-2' : ''
                }`}
              >
                {convos.unreadChats.length > 0 && (
                  <SectionCard
                    icon={FaComments}
                    title="Conversations"
                    subtitle="Unread messages and mentions"
                    accent="indigo"
                    count={convos.unreadChats.length}
                  >
                    {convos.unreadChats.map((c) => (
                      <ChatRow key={c.chatId} chat={c} onOpen={() => openChat(c)} />
                    ))}
                  </SectionCard>
                )}

                {(pulse.pendingJoinRequests.length > 0 || pulse.recentProjects.length > 0) && (
                  <SectionCard
                    icon={FaUsers}
                    title="Team Pulse"
                    subtitle="Recent activity in your workspaces"
                    accent="purple"
                    count={
                      pulse.pendingJoinRequests.reduce((s, w) => s + w.count, 0) +
                      pulse.recentProjects.length
                    }
                  >
                    {pulse.pendingJoinRequests.map((p) => (
                      <button
                        key={p.workspaceId}
                        onClick={() => openJoinRequests(p)}
                        className="w-full text-left px-4 lg:px-5 py-3 hover:bg-gray-50 dark:hover:bg-[#0d9488]/5 transition flex items-center gap-3 border-b border-gray-100 dark:border-gray-800/30 last:border-0 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                          <FaUserPlus className="text-purple-600 dark:text-purple-400 text-xs" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 dark:text-gray-100 truncate">
                            {p.count} join request{p.count > 1 ? 's' : ''}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate">
                            {p.workspaceName}
                          </p>
                        </div>
                        <FaArrowRight className="text-[10px] text-gray-300 dark:text-gray-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                    {pulse.recentProjects.map((p) => (
                      <div
                        key={p._id}
                        className="px-4 lg:px-5 py-3 border-b border-gray-100 dark:border-gray-800/30 last:border-0"
                      >
                        <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                          new project · {formatRelative(p.createdAt)}
                        </p>
                      </div>
                    ))}
                  </SectionCard>
                )}
              </div>
            )}
          </div>

          {/* Empty state */}
          {!hasAnything && (
            <div className="flex flex-col items-center justify-center py-16 lg:py-24 text-gray-400 dark:text-gray-500">
              <FaCheckCircle className="text-4xl lg:text-5xl mb-3 text-teal-500/60" />
              <p className="text-sm lg:text-base font-medium text-gray-500 dark:text-gray-400">
                Nothing needs you right now
              </p>
              <p className="text-xs lg:text-sm mt-1">
                Come back when something shows up.
              </p>
            </div>
          )}
        </main>

        <GeneralBottombar />
      </div>
    </div>
  );
};

export default Today;
// src/screens/Today.jsx
import React, { useState, useRef, useEffect } from 'react';
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
// ACCENT MAP — muted, only used for text/icon/border accents
// ─────────────────────────────────────────────────────────────────
const accentMap = {
  teal: { text: 'text-teal-600 dark:text-teal-400', hex: '#0d9488' },
  red: { text: 'text-red-600 dark:text-red-400', hex: '#ef4444' },
  amber: { text: 'text-amber-600 dark:text-amber-500', hex: '#f59e0b' },
  gray: { text: 'text-gray-500 dark:text-gray-400', hex: '#6b7280' },
};

// ─────────────────────────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }

    .skeleton { position: relative; overflow: hidden; background-color: rgb(229 231 235); }
    .dark .skeleton { background-color: rgba(255, 255, 255, 0.07); }
    .skeleton::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
      animation: skeletonShimmer 1.5s ease-in-out infinite;
    }
    .dark .skeleton::after {
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.07), transparent);
    }
    @keyframes skeletonShimmer { 100% { transform: translateX(100%); } }
    @media (prefers-reduced-motion: reduce) { .skeleton::after { animation: none; } }
  `}</style>
);

// ─────────────────────────────────────────────────────────────────
// SKELETONS
// ─────────────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }) => (
  <div className={`skeleton rounded ${className}`} />
);

const SectionCardSkeleton = ({ rows = 3, accentWidth = 'w-24' }) => (
  <section className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
    <header className="px-4 lg:px-5 py-3 flex items-center gap-2.5 border-b border-gray-100 dark:border-gray-800">
      <Skeleton className="w-5 h-5 flex-shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className={`h-3.5 ${accentWidth}`} />
        <Skeleton className="h-2.5 w-32" />
      </div>
    </header>
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 lg:px-5 py-3 flex items-start gap-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-3.5 w-4/5" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-2.5 w-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

const StatTileSkeleton = () => (
  <div className="flex flex-col items-center text-center gap-1.5 py-1">
    <Skeleton className="w-4 h-4" />
    <Skeleton className="h-5 w-6" />
    <Skeleton className="h-2 w-12" />
  </div>
);

const StatTileDesktopSkeleton = () => (
  <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800 rounded-lg p-4 flex items-center gap-3">
    <Skeleton className="w-8 h-8 flex-shrink-0" />
    <div className="min-w-0 space-y-1.5">
      <Skeleton className="h-6 w-8" />
      <Skeleton className="h-2.5 w-14" />
    </div>
  </div>
);

const AskXircleSkeleton = () => (
  <div className="mb-5">
    <div className="w-full bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 flex items-center gap-3">
      <Skeleton className="w-4 h-4 flex-shrink-0" />
      <Skeleton className="h-3.5 flex-1 max-w-xs" />
    </div>
  </div>
);

const ChartToggleSkeleton = () => (
  <div className="w-full bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
    <Skeleton className="h-3.5 w-24" />
    <Skeleton className="h-3 w-3" />
  </div>
);

const TodaySkeleton = () => (
  <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
    <div className="hidden md:block md:w-72 md:flex-shrink-0"><GeneralSidebar /></div>
    <div className="flex-1 flex flex-col min-h-screen min-w-0">
      <header className="sticky top-0 z-30 bg-white dark:bg-[#0f0f12] border-b border-gray-200 dark:border-gray-800">
        <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Skeleton className="w-8 h-8 flex-shrink-0" />
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-2.5 w-32" />
            </div>
          </div>
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
        </div>
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-12">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-8 lg:h-9 w-56 lg:w-72" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="md:hidden mb-5 bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-3">
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: 4 }).map((_, i) => <StatTileSkeleton key={i} />)}
          </div>
        </div>
        <div className="hidden md:grid md:grid-cols-4 md:gap-4 mb-5">
          {Array.from({ length: 4 }).map((_, i) => <StatTileDesktopSkeleton key={i} />)}
        </div>
        <div className="mb-5"><ChartToggleSkeleton /></div>
        <AskXircleSkeleton />
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-3">
            <SectionCardSkeleton rows={3} accentWidth="w-24" />
            <SectionCardSkeleton rows={2} accentWidth="w-24" />
          </div>
          <div className="space-y-5 lg:col-span-2">
            <SectionCardSkeleton rows={2} accentWidth="w-28" />
          </div>
        </div>
      </main>
      <GeneralBottombar />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────
const WorkspaceChip = ({ workspace }) => {
  if (!workspace?.name) return null;
  return (
    <span className="inline-flex items-center gap-1.5 max-w-[140px]">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: workspace.color || '#0d9488' }} />
      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">
        {workspace.name}
      </span>
    </span>
  );
};

const SectionCard = ({ icon: Icon, title, subtitle, count, action, children }) => (
  <section className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
    <header className="px-4 lg:px-5 py-3 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{title}</h2>
          {subtitle && <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate">{subtitle}</p>}
        </div>
        {count > 0 && (
          <span className="ml-1 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {count}
          </span>
        )}
      </div>
      {action}
    </header>
    <div>{children}</div>
  </section>
);

const SubGroupLabel = ({ label, accent = 'gray' }) => {
  const a = accentMap[accent] || accentMap.gray;
  return (
    <div className="px-4 lg:px-5 pt-3 pb-1 flex items-center gap-2">
      <span className={`w-1 h-1 rounded-full ${a.text.replace('text-', 'bg-').split(' ')[0]}`} />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-500">
        {label}
      </span>
    </div>
  );
};

const TaskRow = ({ task, onOpen, isOverdue = false }) => (
  <button
    onClick={onOpen}
    className="relative w-full text-left px-4 lg:px-5 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition flex items-start gap-3 border-b border-gray-100 dark:border-gray-800 last:border-0 group"
  >
    {isOverdue && <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-red-500" />}
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-800 dark:text-gray-200 break-words leading-snug group-hover:text-gray-900 dark:group-hover:text-white transition">
        {task.title}
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-gray-500 dark:text-gray-500">
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
          <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
            <FaRegClock className="text-[9px]" />
            {formatDue(task.dueDate)}
          </span>
        )}
        {task.subtaskCount > 0 && <span>{task.subtaskDone}/{task.subtaskCount}</span>}
      </div>
    </div>
    <FaArrowRight className="text-[9px] text-gray-300 dark:text-gray-600 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
  </button>
);

const ChatRow = ({ chat, onOpen }) => {
  const displayName = chat.name || 'Direct message';
  return (
    <button
      onClick={onOpen}
      className="w-full text-left px-4 lg:px-5 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 last:border-0 group"
    >
      <FaHashtag className="text-sm text-gray-400 dark:text-gray-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 dark:text-gray-200 truncate group-hover:text-gray-900 dark:group-hover:text-white transition">
          {displayName}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-500">
          {chat.unreadCount} unread
          {chat.mentionCount > 0 && (
            <span className="ml-1.5 text-gray-700 dark:text-gray-300 font-medium">
              · {chat.mentionCount} mention{chat.mentionCount > 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>
      {chat.mentionCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
      <FaArrowRight className="text-[9px] text-gray-300 dark:text-gray-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
};

const ConfirmRow = ({ item, onOpen }) => (
  <button
    onClick={onOpen}
    className="w-full text-left px-4 lg:px-5 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition flex items-start gap-3 border-b border-gray-100 dark:border-gray-800 last:border-0 group"
  >
    <FaCheckDouble className="text-sm text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-800 dark:text-gray-200 break-words leading-snug group-hover:text-gray-900 dark:group-hover:text-white transition">
        {item.title || item.taskTitle}
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-gray-500 dark:text-gray-500">
        {item.project?.workspace && <WorkspaceChip workspace={item.project.workspace} />}
        {item.projectName && <span className="truncate">{item.projectName}</span>}
        <span className="text-gray-600 dark:text-gray-400">
          {item.completedBy ? `${getFirstName(item.completedBy)} marked it done` : `${item.pendingSubtasks?.length || 0} subtask(s) to review`}
        </span>
      </div>
    </div>
    <FaArrowRight className="text-[9px] text-gray-300 dark:text-gray-600 flex-shrink-0 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
  </button>
);

// Mobile stat tile — NO colored backgrounds, only numbers
const StatTile = ({ icon: Icon, label, value, accent }) => {
  const a = accentMap[accent] || accentMap.gray;
  return (
    <div className="flex flex-col items-center text-center gap-1 py-1">
      <Icon className={`text-xs ${value > 0 ? a.text : 'text-gray-300 dark:text-gray-700'}`} />
      <p className={`text-base font-bold tabular-nums leading-none ${value > 0 ? a.text : 'text-gray-300 dark:text-gray-700'}`}>
        {value}
      </p>
      <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-medium leading-tight">
        {label}
      </p>
    </div>
  );
};

// Desktop stat tile — NO colored backgrounds
const StatTileDesktop = ({ icon: Icon, label, value, accent }) => {
  const a = accentMap[accent] || accentMap.gray;
  return (
    <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800 rounded-lg p-4 flex items-center gap-3">
      <Icon className={`text-lg flex-shrink-0 ${value > 0 ? a.text : 'text-gray-300 dark:text-gray-700'}`} />
      <div className="min-w-0">
        <p className={`text-xl font-bold tabular-nums leading-none ${value > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-gray-700'}`}>
          {value}
        </p>
        <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-medium mt-1">
          {label}
        </p>
      </div>
    </div>
  );
};

// Chart — very muted
const ChartCard = ({ stats, brandColor = '#0d9488' }) => {
  const data = stats.filter((s) => s.value > 0);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-[#14141a] rounded-lg border border-gray-200 dark:border-gray-800 p-8 flex flex-col items-center justify-center text-center">
        <FaChartBar className="text-2xl text-gray-300 dark:text-gray-700 mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-500">Nothing to chart yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#14141a] rounded-lg border border-gray-200 dark:border-gray-800 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-widest">
          Attention breakdown
        </p>
        <span className="text-xs text-gray-500 dark:text-gray-500">
          {data.reduce((s, d) => s + d.value, 0)} items
        </span>
      </div>
      <div className="h-40 lg:h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id="todayChartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={brandColor} stopOpacity={0.15} />
                <stop offset="95%" stopColor={brandColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickCount={5} width={24} />
            <Tooltip
              contentStyle={{
                borderRadius: '6px',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                fontSize: '11px',
                backgroundColor: '#1e1e2a',
                color: '#f0f0f0',
              }}
              labelStyle={{ color: '#9ca3af', fontSize: '11px' }}
              formatter={(value) => [value, 'items']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={brandColor}
              strokeWidth={1.5}
              fill="url(#todayChartGradient)"
              dot={{ r: 2, fill: brandColor }}
              activeDot={{ r: 4, stroke: '#fff', strokeWidth: 1 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Ask Xircle — plain gray, no teal tint
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(true)}
            className="w-full bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 rounded-lg px-4 py-3 flex items-center gap-3 text-left transition group"
          >
            <FaMagic className="text-sm text-gray-400 dark:text-gray-500 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors flex-shrink-0" />
            <span className="flex-1 text-sm text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
              Ask Xircle anything…
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white dark:bg-[#14141a] border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 lg:px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
              <FaMagic className="text-sm text-teal-600 dark:text-teal-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What's overdue? What did I finish this week?"
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-gray-800 dark:text-white placeholder-gray-400 outline-none py-1"
              />
              {isLoading ? (
                <FaSpinner className="animate-spin text-teal-500 text-sm flex-shrink-0" />
              ) : (
                <button type="submit" disabled={!question.trim()} className="p-1 text-teal-600 dark:text-teal-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition disabled:opacity-40" aria-label="Ask">
                  <FaPaperPlane className="text-xs" />
                </button>
              )}
              <button type="button" onClick={dismiss} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition" aria-label="Close">
                <FaTimes className="text-xs" />
              </button>
            </form>

            <AnimatePresence>
              {answer && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="px-4 lg:px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-start gap-2.5">
                      <FaLightbulb className="text-amber-500 text-xs flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {answer.text}
                      </p>
                    </div>
                  </div>
                  {answer.followUps.length > 0 && (
                    <div className="px-4 lg:px-5 py-2.5 flex flex-wrap gap-1.5 bg-gray-50 dark:bg-[#0f0f12]">
                      {answer.followUps.map((fu, i) => (
                        <button key={i} onClick={() => runAsk(fu)} disabled={isLoading} className="text-[11px] px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 transition disabled:opacity-50">
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

const ChartToggle = ({ stats, brandColor, isOpen, onToggle }) => (
  <>
    <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-4 lg:px-5 py-2.5 bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800 rounded-lg text-left transition hover:border-gray-300 dark:hover:border-gray-700">
      <span className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400">
        <FaChartBar className="text-xs" />
        {isOpen ? 'Hide chart' : 'Show chart'}
      </span>
      <FaChevronDown className={`text-xs text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <div className="pt-3"><ChartCard stats={stats} brandColor={brandColor} /></div>
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

  const { data, isLoading, isError, error, refetch, isFetching } = useGetTodayQuery(undefined, {
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
  const openJoinRequests = (pulse) => navigate(`/workspace/${pulse.workspaceId}/members`);

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
    myWork.overdue.length > 0 || myWork.dueToday.length > 0 ||
    teamWork.overdue.length > 0 || teamWork.dueToday.length > 0 ||
    awaiting.taskConfirmations.length > 0 || awaiting.subtaskReviews.length > 0;

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
    { key: 'overdue', label: 'Overdue', value: overdueTotal, accent: 'red', icon: FaExclamationCircle },
    { key: 'dueToday', label: 'Due today', value: dueTodayTotal, accent: 'teal', icon: FaRegClock },
    { key: 'awaiting', label: 'Awaiting', value: awaitingTotal, accent: 'amber', icon: FaCheckDouble },
    { key: 'mentions', label: 'Mentions', value: mentionTotal, accent: 'gray', icon: FaComments },
  ];

  if (isLoading && !data) {
    return (
      <>
        <GlobalStyles />
        <TodaySkeleton />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <GlobalStyles />
        <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
          <div className="hidden md:block md:w-72 md:flex-shrink-0"><GeneralSidebar /></div>
          <div className="flex-1 flex flex-col min-h-screen min-w-0">
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-sm">
                <FaExclamationCircle className="text-red-500 text-2xl mx-auto mb-3" />
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  {error?.data?.message || 'Could not load your Today.'}
                </p>
                <button onClick={refetch} className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition">
                  Try again
                </button>
              </div>
            </div>
            <GeneralBottombar />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <GlobalStyles />
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>

        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          {/* HEADER */}
          <header className="sticky top-0 z-30 bg-white dark:bg-[#0f0f12] border-b border-gray-200 dark:border-gray-800">
            <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <FaSun className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-sm lg:text-base font-semibold text-gray-900 dark:text-white leading-tight truncate">
                    Today
                  </h1>
                  <p className="text-[10px] lg:text-[11px] text-gray-500 dark:text-gray-500 leading-tight truncate">
                    {todayLabel()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 flex-shrink-0">
                {isFetching && !isLoading && <FaSpinner className="animate-spin text-gray-400 text-xs" />}
                {userInfo?.profile ? (
                  <img src={userInfo.profile} alt="" className="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-gray-700" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-600 dark:bg-gray-700 flex items-center justify-center text-white text-[11px] font-semibold">
                    {(firstName || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* MAIN */}
          <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 pt-6 lg:pt-8 pb-24 md:pb-12">
            {/* Greeting */}
            <div className="mb-6">
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {getGreeting()}{firstName && <>, <span className="text-teal-600 dark:text-teal-400">{firstName}</span></>}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                {hasAnything ? (
                  <><span className="font-semibold text-gray-800 dark:text-gray-200">{attention}</span> {attention === 1 ? 'thing needs' : 'things need'} your attention</>
                ) : (
                  <>You're all caught up.</>
                )}
              </p>
            </div>

            {/* Stats — mobile */}
            <div className="md:hidden mb-5 bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-3">
              <div className="grid grid-cols-4 gap-1">
                {statsData.map((s) => <StatTile key={s.key} {...s} />)}
              </div>
            </div>

            {/* Stats — desktop */}
            <div className="hidden md:grid md:grid-cols-4 md:gap-3 mb-5">
              {statsData.map((s) => <StatTileDesktop key={s.key} {...s} />)}
            </div>

            {/* Chart */}
            <div className="mb-5">
              <ChartToggle stats={statsData} brandColor={accentMap.teal.hex} isOpen={showChart} onToggle={() => setShowChart((v) => !v)} />
            </div>

            {/* Ask Xircle */}
            <AskXircle />

            {/* Content */}
            <div className={`grid gap-5 ${hasWorkColumn && hasAwarenessColumn ? 'lg:grid-cols-5' : 'lg:grid-cols-1'}`}>
              {hasWorkColumn && (
                <div className={`space-y-5 ${hasWorkColumn && hasAwarenessColumn ? 'lg:col-span-3' : ''}`}>
                  {(myWork.overdue.length > 0 || myWork.dueToday.length > 0) && (
                    <SectionCard
                      icon={FaTasks}
                      title="My Work"
                      subtitle="Personal tasks"
                      count={myWork.overdue.length + myWork.dueToday.length}
                      action={<Link to="/personal-tasks" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-white transition">Open</Link>}
                    >
                      {myWork.overdue.length > 0 && (
                        <><SubGroupLabel label="Overdue" accent="red" />{myWork.overdue.map((t) => <TaskRow key={t.id} task={t} onOpen={openPersonalTask} isOverdue />)}</>
                      )}
                      {myWork.dueToday.length > 0 && (
                        <><SubGroupLabel label="Due Today" accent="teal" />{myWork.dueToday.map((t) => <TaskRow key={t.id} task={t} onOpen={openPersonalTask} />)}</>
                      )}
                    </SectionCard>
                  )}

                  {(teamWork.overdue.length > 0 || teamWork.dueToday.length > 0) && (
                    <SectionCard
                      icon={FaFolderOpen}
                      title="Team Work"
                      subtitle="Assigned across workspaces"
                      count={teamWork.overdue.length + teamWork.dueToday.length}
                    >
                      {teamWork.overdue.length > 0 && (
                        <><SubGroupLabel label="Overdue" accent="red" />{teamWork.overdue.map((t) => { const n = normProjectTask(t); return <TaskRow key={n.id} task={n} onOpen={() => openProjectTask(n)} isOverdue />; })}</>
                      )}
                      {teamWork.dueToday.length > 0 && (
                        <><SubGroupLabel label="Due Today" accent="teal" />{teamWork.dueToday.map((t) => { const n = normProjectTask(t); return <TaskRow key={n.id} task={n} onOpen={() => openProjectTask(n)} />; })}</>
                      )}
                    </SectionCard>
                  )}

                  {(awaiting.taskConfirmations.length > 0 || awaiting.subtaskReviews.length > 0) && (
                    <SectionCard
                      icon={FaCheckDouble}
                      title="Awaiting You"
                      subtitle="Blocked on your review"
                      count={awaiting.taskConfirmations.length + awaiting.subtaskReviews.length}
                    >
                      {awaiting.taskConfirmations.map((item) => <ConfirmRow key={item.id} item={item} onOpen={() => openConfirm(item)} />)}
                      {awaiting.subtaskReviews.map((item) => <ConfirmRow key={item.taskId} item={item} onOpen={() => openConfirm(item)} />)}
                    </SectionCard>
                  )}
                </div>
              )}

              {hasAwarenessColumn && (
                <div className={`space-y-5 ${hasWorkColumn && hasAwarenessColumn ? 'lg:col-span-2' : ''}`}>
                  {convos.unreadChats.length > 0 && (
                    <SectionCard
                      icon={FaComments}
                      title="Conversations"
                      subtitle="Unread messages"
                      count={convos.unreadChats.length}
                    >
                      {convos.unreadChats.map((c) => <ChatRow key={c.chatId} chat={c} onOpen={() => openChat(c)} />)}
                    </SectionCard>
                  )}

                  {(pulse.pendingJoinRequests.length > 0 || pulse.recentProjects.length > 0) && (
                    <SectionCard
                      icon={FaUsers}
                      title="Team Pulse"
                      subtitle="Recent activity"
                      count={pulse.pendingJoinRequests.reduce((s, w) => s + w.count, 0) + pulse.recentProjects.length}
                    >
                      {pulse.pendingJoinRequests.map((p) => (
                        <button key={p.workspaceId} onClick={() => openJoinRequests(p)} className="w-full text-left px-4 lg:px-5 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 last:border-0 group">
                          <FaUserPlus className="text-sm text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 dark:text-gray-200 truncate group-hover:text-gray-900 dark:group-hover:text-white transition">
                              {p.count} join request{p.count > 1 ? 's' : ''}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate">{p.workspaceName}</p>
                          </div>
                          <FaArrowRight className="text-[9px] text-gray-300 dark:text-gray-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                      {pulse.recentProjects.map((p) => (
                        <div key={p._id} className="px-4 lg:px-5 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                          <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{p.name}</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-500">new project · {formatRelative(p.createdAt)}</p>
                        </div>
                      ))}
                    </SectionCard>
                  )}
                </div>
              )}
            </div>

            {!hasAnything && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                <FaCheckCircle className="text-4xl mb-3 text-gray-300 dark:text-gray-700" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nothing needs you right now</p>
                <p className="text-xs mt-1">Come back when something shows up.</p>
              </div>
            )}
          </main>

          <GeneralBottombar />
        </div>
      </div>
    </>
  );
};

export default Today;
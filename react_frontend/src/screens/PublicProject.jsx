// src/pages/PublicProject.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  useGetPublicProjectByTokenQuery,
  useGetPublicProjectTasksQuery,
} from '../slices/projectApiSlice';
import {
  useMarkTaskCompletedMutation,
  useAddCommentMutation,
} from '../slices/taskApiSlice';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format, isPast } from 'date-fns';
import {
  FaRocket, FaBolt, FaLightbulb, FaCube, FaStar, FaFire, FaFeather,
  FaCrown, FaGem, FaCompass, FaLayerGroup,
  FaUser, FaGlobe, FaUserShield, FaEye, FaCheckCircle, FaSpinner,
  FaTimes, FaArrowLeft, FaTasks, FaClock, FaExclamationTriangle,
  FaCheck, FaComment, FaUserPlus, FaSearch,
  FaRegCommentDots, FaRegClock,
} from 'react-icons/fa';

// ─── Color utilities ──────────────────────────────────────────────────
const NAMED_TO_HEX = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  orange: '#f97316', purple: '#a855f7', pink: '#ec4899', teal: '#14b8a6',
  indigo: '#6366f1', gray: '#6b7280', grey: '#6b7280', slate: '#64748b',
  emerald: '#10b981', rose: '#f43f5e', amber: '#f59e0b', cyan: '#06b6d4',
  violet: '#8b5cf6',
};

const toHex = (color) => {
  if (!color) return '#0d9488';
  const c = String(color).trim().toLowerCase();
  if (c.startsWith('#')) return c;
  return NAMED_TO_HEX[c] || '#0d9488';
};

const shadeHex = (hex, percent) => {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 3 && h.length !== 6) return hex;
  const full = h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return hex;
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

// ─── Project icon ─────────────────────────────────────────────────────
const PROJECT_ICONS = [
  FaRocket, FaBolt, FaLightbulb, FaCube, FaStar,
  FaFire, FaFeather, FaCrown, FaGem, FaCompass, FaLayerGroup,
];

const hashString = (str) => {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const pickProjectIcon = (project) => {
  const seed = project?._id || project?.name || '';
  if (!seed) return PROJECT_ICONS[0];
  return PROJECT_ICONS[hashString(seed) % PROJECT_ICONS.length];
};

const getInitials = (name) => {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const second = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] || '');
  return (first + second).toUpperCase();
};

// ─── Member avatar ────────────────────────────────────────────────────
const MemberAvatar = ({ user, size = 'sm', ring = false, fallbackColor = '#0d9488' }) => {
  const sizes = {
    xs: 'w-5 h-5 text-[8px]',
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-xs',
  };
  const cls = sizes[size] || sizes.sm;
  const hasPhoto = !!user?.profile;
  const initials = getInitials(user?.name);
  return (
    <span
      title={user?.name || 'Member'}
      className={`${cls} rounded-full overflow-hidden inline-flex items-center justify-center font-semibold text-white shrink-0 ${ring ? 'ring-2 ring-white dark:ring-[#111115]' : ''}`}
      style={{ backgroundColor: hasPhoto ? '#e5e7eb' : fallbackColor }}
    >
      {hasPhoto ? (
        <img src={user.profile} alt={user.name || 'Member'} className="w-full h-full object-cover" />
      ) : initials ? (
        initials
      ) : (
        <FaUser className="opacity-90" style={{ fontSize: '55%' }} />
      )}
    </span>
  );
};

// ─── Status metadata ──────────────────────────────────────────────────
const TASK_STATUS_META = {
  pending:              { label: 'Pending',         color: 'text-gray-500 dark:text-gray-400',   bg: 'bg-gray-100 dark:bg-white/[0.06]' },
  'in-progress':        { label: 'In Progress',     color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-500/10' },
  ready_for_completion: { label: 'Ready',           color: 'text-teal-600 dark:text-teal-400',   bg: 'bg-teal-50 dark:bg-teal-500/10' },
  completed:            { label: 'Awaiting review', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  confirmed_completed:  { label: 'Completed',       color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10' },
  cancelled:            { label: 'Cancelled',       color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-500/10' },
};

const PROJECT_STATUS_META = {
  planning:      { label: 'Planning',    dot: 'bg-blue-500' },
  'in-progress': { label: 'In Progress', dot: 'bg-yellow-500' },
  'on-hold':     { label: 'On Hold',     dot: 'bg-orange-500' },
  completed:     { label: 'Completed',   dot: 'bg-green-500' },
  cancelled:     { label: 'Cancelled',   dot: 'bg-red-500' },
};

const PRIORITY_META = {
  low:    { label: 'Low',    color: 'text-gray-500 dark:text-gray-500',       dot: 'bg-gray-400' },
  medium: { label: 'Medium', color: 'text-blue-600 dark:text-blue-400',       dot: 'bg-blue-500' },
  high:   { label: 'High',   color: 'text-orange-600 dark:text-orange-400',   dot: 'bg-orange-500' },
  urgent: { label: 'Urgent', color: 'text-red-600 dark:text-red-400',         dot: 'bg-red-500' },
};

// ═════════════════════════════════════════════════════════════════════
//  Complete Task Modal
// ═════════════════════════════════════════════════════════════════════
const CompleteTaskModal = ({ isOpen, onClose, task, onComplete, busy }) => {
  const [notes, setNotes] = useState('');
  const [links, setLinks] = useState('');
  const [files, setFiles] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setNotes('');
      setLinks('');
      setFiles([]);
    }
  }, [isOpen, task?._id]);

  if (!isOpen || !task) return null;

  const handleFileChange = (e) => setFiles(Array.from(e.target.files || []));

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsedLinks = links.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean);
    onComplete({ notes: notes.trim(), links: parsedLinks, files });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="bg-white dark:bg-[#111115] rounded-t-2xl sm:rounded-xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-white/[0.06] flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.05]">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Mark complete
            </h2>
            <p className="text-[11px] text-gray-500 truncate mt-0.5">{task.title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-md transition shrink-0 disabled:opacity-40"
          >
            <FaTimes className="text-xs" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-500 mb-1.5 uppercase tracking-wide">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="What did you do?"
              className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-teal-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-500 mb-1.5 uppercase tracking-wide">
              Links
            </label>
            <textarea
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              rows={2}
              placeholder="One URL per line"
              className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-teal-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-500 mb-1.5 uppercase tracking-wide">
              Attachments
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 dark:file:bg-white/[0.06] file:text-gray-700 dark:file:text-gray-300 hover:file:bg-gray-200 dark:hover:file:bg-white/[0.1] cursor-pointer"
            />
            {files.length > 0 && (
              <p className="text-[11px] text-gray-500 mt-1.5">
                {files.length} file{files.length === 1 ? '' : 's'} selected
              </p>
            )}
          </div>
        </form>

        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/[0.05]">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2 border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {busy ? <FaSpinner className="animate-spin text-xs" /> : <FaCheck className="text-xs" />}
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Comment Modal
// ═════════════════════════════════════════════════════════════════════
const CommentModal = ({ isOpen, onClose, task, onSubmit, busy }) => {
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (isOpen) setComment('');
  }, [isOpen, task?._id]);

  if (!isOpen || !task) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!comment.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }
    onSubmit(comment.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="bg-white dark:bg-[#111115] rounded-t-2xl sm:rounded-xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-white/[0.06]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.05]">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Add comment</h2>
            <p className="text-[11px] text-gray-500 truncate mt-0.5">{task.title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-md transition shrink-0 disabled:opacity-40"
          >
            <FaTimes className="text-xs" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Share an update, ask a question, or leave feedback…"
            className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-teal-500 resize-none"
          />
        </form>

        <div className="flex gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/[0.05]">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2 border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || !comment.trim()}
            className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {busy ? <FaSpinner className="animate-spin text-xs" /> : <FaComment className="text-xs" />}
            {busy ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Task Card
// ═════════════════════════════════════════════════════════════════════
const TaskCard = ({ task, brandHex, canActOnIt, canCommentOnIt, onComplete, onComment }) => {
  const statusMeta = TASK_STATUS_META[task.status] || TASK_STATUS_META.pending;
  const priorityMeta = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const isDone = task.status === 'confirmed_completed';
  const isCancelled = task.status === 'cancelled';
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !isDone && !isCancelled;
  const progress = task.progress || 0;

  const subtaskTotal = task.subTasks?.length || 0;
  const subtaskDone = (task.subTasks || []).filter(
    (s) => s.status === 'confirmed' || s.status === 'done'
  ).length;

  return (
    <article className="bg-white dark:bg-[#111115] rounded-lg border border-gray-200/80 dark:border-white/[0.06] p-3.5 hover:border-gray-300 dark:hover:border-white/[0.1] transition">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusMeta.bg} ${statusMeta.color}`}>
              {statusMeta.label}
            </span>
            {task.assignedToMe && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400">
                You
              </span>
            )}
            {isOverdue && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400">
                Overdue
              </span>
            )}
          </div>
          <h3 className={`text-[13px] font-medium leading-snug break-words ${isDone || isCancelled ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
            {task.title}
          </h3>
        </div>

        <span className={`flex items-center gap-1.5 text-[10px] font-medium shrink-0 ${priorityMeta.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${priorityMeta.dot}`} />
          {priorityMeta.label}
        </span>
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 dark:text-gray-500 line-clamp-2 mb-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {progress > 0 && !isDone && !isCancelled && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-1 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: brandHex }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-500 tabular-nums">{progress}%</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px] text-gray-500 dark:text-gray-500">
        {task.dueDate && (
          <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
            <FaRegClock className="text-[9px]" />
            {format(new Date(task.dueDate), 'MMM d')}
          </span>
        )}
        {subtaskTotal > 0 && (
          <span className="flex items-center gap-1">
            <FaTasks className="text-[9px]" />
            {subtaskDone}/{subtaskTotal}
          </span>
        )}
        {task.assignees?.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="flex -space-x-1.5">
              {task.assignees.slice(0, 3).map((a, i) => (
                <MemberAvatar key={a._id || i} user={a} size="xs" ring fallbackColor={brandHex} />
              ))}
            </span>
            {task.assignees.length > 3 && (
              <span className="text-[10px] text-gray-400">+{task.assignees.length - 3}</span>
            )}
          </span>
        )}
      </div>

      {(canActOnIt || canCommentOnIt) && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.05] flex items-center gap-2 flex-wrap">
          {canActOnIt && (
            <button
              type="button"
              onClick={() => onComplete(task)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md transition"
            >
              <FaCheck className="text-[10px]" />
              Mark complete
            </button>
          )}
          {canCommentOnIt && (
            <button
              type="button"
              onClick={() => onComment(task)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.04] rounded-md transition"
            >
              <FaComment className="text-[10px]" />
              Comment
            </button>
          )}
        </div>
      )}
    </article>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Access Banner — one-line visitor status
// ═════════════════════════════════════════════════════════════════════
const AccessBanner = ({ mode, collaborator, isLoggedIn, isFullMember, workspaceId, projectId }) => {
  const navigate = useNavigate();

  let Icon = FaGlobe;
  let text = '';
  let toneCls = 'text-gray-500 dark:text-gray-500';
  let action = null;

  if (isFullMember) {
    Icon = FaCheckCircle;
    toneCls = 'text-teal-600 dark:text-teal-400';
    text = 'Workspace member · full access';
    action = (
      <button
        onClick={() => navigate(`/workspace/${workspaceId}/project/${projectId}`)}
        className="text-[11px] font-medium text-teal-600 dark:text-teal-400 hover:underline shrink-0"
      >
        Open →
      </button>
    );
  } else if (!isLoggedIn && mode === 'collaborator') {
    Icon = FaUserPlus;
    toneCls = 'text-amber-600 dark:text-amber-400';
    text = collaborator?.role === 'editor'
      ? 'Invited as editor · sign in to contribute'
      : 'Invited to collaborate · sign in';
  } else if (!isLoggedIn && mode === 'public') {
    Icon = FaGlobe;
    text = 'Shared project · read-only';
  } else if (isLoggedIn && collaborator?.linkedToMe) {
    const isEditor = collaborator.role === 'editor';
    Icon = FaUserShield;
    toneCls = isEditor ? 'text-teal-600 dark:text-teal-400' : 'text-blue-600 dark:text-blue-400';
    text = isEditor ? 'Editor · complete assigned tasks' : 'Viewer · read-only';
  } else if (isLoggedIn && !isFullMember) {
    Icon = FaEye;
    text = 'Read-only · not linked as collaborator';
  } else {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-50 dark:bg-white/[0.02] border border-gray-200/80 dark:border-white/[0.05]">
      <Icon className={`text-[11px] shrink-0 ${toneCls}`} />
      <p className={`flex-1 min-w-0 text-[11px] truncate ${toneCls}`}>{text}</p>
      {action}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Signup Sticky Bar
// ═════════════════════════════════════════════════════════════════════
const SignupStickyBar = ({ token, brandHex, mode }) => {
  const navigate = useNavigate();
  const isInvite = mode === 'collaborator';

  const handleSignup = () => {
    try { sessionStorage.setItem('pendingInviteToken', token); } catch { /* noop */ }
    navigate(`/signup?redirect=${encodeURIComponent(`/collaborate/${token}`)}`);
  };
  const handleLogin = () => {
    try { sessionStorage.setItem('pendingInviteToken', token); } catch { /* noop */ }
    navigate(`/login?redirect=${encodeURIComponent(`/collaborate/${token}`)}`);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 dark:border-white/[0.06] bg-white/95 dark:bg-[#0b0b10]/95 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 truncate">
            {isInvite ? 'Sign in to contribute' : 'Sign in to Xircle'}
          </p>
          <p className="text-[11px] text-gray-500 truncate">
            {isInvite ? 'Act on tasks assigned to you.' : 'Get full access to your projects.'}
          </p>
        </div>
        <button
          onClick={handleLogin}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.05] rounded-md transition"
        >
          Sign in
        </button>
        <button
          onClick={handleSignup}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-white rounded-md transition hover:opacity-90"
          style={{ backgroundColor: brandHex }}
        >
          Sign up
        </button>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Loading / Error
// ═════════════════════════════════════════════════════════════════════
const LoadingSkeleton = () => (
  <div className="min-h-dvh bg-gray-50 dark:bg-[#0b0b10] flex items-center justify-center">
    <div className="text-center">
      <FaSpinner className="animate-spin text-2xl text-teal-500 mx-auto" />
      <p className="mt-3 text-xs text-gray-500">Loading project…</p>
    </div>
  </div>
);

const ErrorState = ({ status, message }) => {
  const navigate = useNavigate();
  const isRevoked = status === 410;
  const isNotFound = status === 404 || status === 400;

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-[#0b0b10] flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white dark:bg-[#111115] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6 text-center">
        <div className={`w-11 h-11 rounded-full mx-auto flex items-center justify-center mb-3 ${
          isRevoked ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-red-50 dark:bg-red-500/10'
        }`}>
          <FaExclamationTriangle className={`text-lg ${isRevoked ? 'text-amber-500' : 'text-red-500'}`} />
        </div>
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
          {isRevoked ? 'Access revoked' : isNotFound ? 'Link not found' : 'Something went wrong'}
        </h1>
        <p className="text-[13px] text-gray-500 dark:text-gray-500 mb-5 leading-relaxed">
          {isRevoked
            ? 'This invite has been revoked by the project owner. Ask them for a new link.'
            : isNotFound
              ? 'This link is invalid or has expired.'
              : message || 'Please try again in a moment.'}
        </p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-[13px] font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md transition"
        >
          <FaArrowLeft className="text-[10px]" />
          Go home
        </button>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  MAIN
// ═════════════════════════════════════════════════════════════════════
const PublicProject = () => {
  const { token } = useParams();
  const { userInfo } = useSelector((state) => state.auth);

  const {
    data: projectRes,
    isLoading: projectLoading,
    error: projectError,
    refetch: refetchProject,
  } = useGetPublicProjectByTokenQuery(token, { skip: !token });

  const {
    data: tasksRes,
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useGetPublicProjectTasksQuery(token, { skip: !token || !projectRes?.project });

  const [markTaskCompleted, { isLoading: isCompleting }] = useMarkTaskCompletedMutation();
  const [addComment, { isLoading: isCommenting }] = useAddCommentMutation();

  const mode = projectRes?.mode || 'public';
  const permissions = projectRes?.permissions || {};
  const collaborator = projectRes?.collaborator || null;
  const project = projectRes?.project || null;
  const tasks = tasksRes?.tasks || [];
  const isFullMember = !!projectRes?.isFullMember;
  const isLoggedIn = !!userInfo?._id;

  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [completeTarget, setCompleteTarget] = useState(null);
  const [commentTarget, setCommentTarget] = useState(null);

  useEffect(() => {
    if (token) {
      try { sessionStorage.setItem('pendingInviteToken', token); } catch { /* noop */ }
    }
  }, [token]);

  useEffect(() => {
    if (collaborator?.linkedToMe && token) {
      try { sessionStorage.removeItem('pendingInviteToken'); } catch { /* noop */ }
    }
  }, [collaborator?.linkedToMe, token]);

  useEffect(() => {
    setFilter('all');
    setSearchQuery('');
  }, [token]);

  const brandHex = toHex(project?.color || '#0d9488');
  const Icon = pickProjectIcon(project);

  const myAssignedCount = useMemo(
    () => tasks.filter((t) => t.assignedToMe).length,
    [tasks]
  );

  const teamList = useMemo(() => {
    const list = [];
    project?.projectManagers?.forEach((pm) => pm && list.push(pm));
    project?.teamMembers
      ?.filter((tm) => tm.status === 'active')
      .forEach((tm) => tm.user && list.push(tm.user));
    const seen = new Set();
    return list.filter((u) => {
      const id = u?._id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [project]);

  const filteredTasks = useMemo(() => {
    let arr = [...tasks];

    if (filter === 'mine') {
      arr = arr.filter((t) => t.assignedToMe);
    } else if (filter === 'open') {
      arr = arr.filter((t) => !['confirmed_completed', 'cancelled'].includes(t.status));
    } else if (filter === 'completed') {
      arr = arr.filter((t) => t.status === 'confirmed_completed');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      arr = arr.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }

    arr.sort((a, b) => {
      if (a.assignedToMe !== b.assignedToMe) return a.assignedToMe ? -1 : 1;
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return arr;
  }, [tasks, filter, searchQuery]);

  const projectStats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'confirmed_completed').length;
    const open = total - done;
    const progress = total > 0 ? Math.round((done / total) * 100) : project?.progress || 0;
    return { total, done, open, progress };
  }, [tasks, project]);

  const canActOnTask = (task) => {
    if (!permissions.canActOnAssignedTasks) return false;
    if (!task.assignedToMe) return false;
    if (['confirmed_completed', 'completed', 'cancelled'].includes(task.status)) return false;
    return true;
  };

  const canCommentOnTask = (task) => {
    if (!permissions.canComment) return false;
    if (!task.assignedToMe) return false;
    return true;
  };

  const handleCompleteSubmit = async ({ notes, links, files }) => {
    if (!completeTarget) return;
    try {
      let payload;
      if (files && files.length > 0) {
        payload = new FormData();
        if (notes) payload.append('notes', notes);
        if (links && links.length) payload.append('links', JSON.stringify(links));
        files.forEach((f) => payload.append('completionAttachments', f));
      } else {
        payload = { notes, links };
      }

      await markTaskCompleted({ taskId: completeTarget._id, data: payload }).unwrap();

      toast.success('Task marked complete — awaiting review');
      setCompleteTarget(null);
      refetchTasks();
      refetchProject();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to mark task complete');
    }
  };

  const handleCommentSubmit = async (comment) => {
    if (!commentTarget) return;
    try {
      await addComment({
        taskId: commentTarget._id,
        comment,
        mentions: [],
        attachments: [],
      }).unwrap();
      toast.success('Comment posted');
      setCommentTarget(null);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to post comment');
    }
  };

  if (projectLoading) return <LoadingSkeleton />;

  if (projectError) {
    const status = projectError?.status || 0;
    return <ErrorState status={status} message={projectError?.data?.message} />;
  }

  if (!project) return <ErrorState status={404} />;

  const showSignupBar = !isLoggedIn && !isFullMember;
  const hasEditRights = !!permissions.canActOnAssignedTasks;
  const statusMeta = PROJECT_STATUS_META[project.status] || PROJECT_STATUS_META.planning;

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#0b0b10]/90 backdrop-blur-xl border-b border-gray-200 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: brandHex }}
            >
              <Icon className="text-[11px]" />
            </div>
            <h1 className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">
              {project.name}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isLoggedIn && userInfo?.profile ? (
              <MemberAvatar user={userInfo} size="sm" fallbackColor={brandHex} />
            ) : (
              <Link
                to={`/login?redirect=${encodeURIComponent(`/collaborate/${token}`)}`}
                className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main
        className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-5 space-y-3"
        style={{ paddingBottom: showSignupBar ? 'calc(6rem + env(safe-area-inset-bottom, 0px))' : '3rem' }}
      >
        {/* Access banner */}
        <AccessBanner
          mode={mode}
          collaborator={collaborator}
          isLoggedIn={isLoggedIn}
          isFullMember={isFullMember}
          workspaceId={project.workspaceId || project.workspace}
          projectId={project._id}
        />

        {/* Hero card — slim */}
        <section className="bg-white dark:bg-[#111115] rounded-lg border border-gray-200/80 dark:border-white/[0.06] overflow-hidden">
          {project.coverImage && (
            <div className="relative h-28 sm:h-36">
              <img src={project.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>
          )}

          <div className="px-3.5 sm:px-5 py-3 sm:py-4">
            {/* Status line */}
            <div className="flex items-center gap-2 mb-1.5 text-[11px] text-gray-500 dark:text-gray-500">
              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
              <span>{statusMeta.label}</span>
              {project.endDate && (
                <>
                  <span className="text-gray-300 dark:text-gray-700">·</span>
                  <span>Due {format(new Date(project.endDate), 'MMM d, yyyy')}</span>
                </>
              )}
            </div>

            {/* Title */}
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-50 break-words leading-snug">
              {project.name}
            </h2>

            {/* Description */}
            {project.description && (
              <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1.5 break-words leading-relaxed line-clamp-2">
                {project.description}
              </p>
            )}

            {/* Tags */}
            {project.tags?.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {project.tags.slice(0, 4).map((tag, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-white/[0.05]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Progress + stats — one compact block */}
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.05] space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${projectStats.progress}%`, backgroundColor: brandHex }}
                  />
                </div>
                <span className="text-[11px] font-mono tabular-nums text-gray-600 dark:text-gray-400 shrink-0">
                  {projectStats.progress}%
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500 dark:text-gray-500">
                <span>{projectStats.total} tasks</span>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span>{projectStats.open} open</span>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span>{projectStats.done} done</span>
              </div>
            </div>

            {/* Team — avatars only */}
            {teamList.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.05] flex items-center gap-2.5">
                <div className="flex -space-x-1.5">
                  {teamList.slice(0, 6).map((u, i) => (
                    <MemberAvatar key={u._id || i} user={u} size="xs" ring fallbackColor={brandHex} />
                  ))}
                </div>
                <span className="text-[11px] text-gray-500 dark:text-gray-500">
                  {teamList.length} {teamList.length === 1 ? 'member' : 'members'}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Tasks */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                Tasks
              </h3>
              <span className="text-[11px] text-gray-400 dark:text-gray-600 tabular-nums">
                {tasks.length}
              </span>
              {hasEditRights && myAssignedCount > 0 && (
                <span className="text-[11px] text-teal-600 dark:text-teal-400 truncate">
                  · {myAssignedCount} assigned to you
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-white dark:bg-[#111115] border border-gray-200 dark:border-white/[0.06] rounded-md px-2.5 py-1.5 focus-within:border-gray-300 dark:focus-within:border-white/[0.12] transition w-32 sm:w-56 shrink-0">
              <FaSearch className="text-gray-400 text-[10px] shrink-0" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-0 bg-transparent outline-none text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                >
                  <FaTimes className="text-[9px]" />
                </button>
              )}
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-0.5 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-none">
            {[
              { id: 'all', label: 'All', count: tasks.length },
              ...(hasEditRights && myAssignedCount > 0
                ? [{ id: 'mine', label: 'Mine', count: myAssignedCount }]
                : []),
              { id: 'open', label: 'Open', count: projectStats.open },
              { id: 'completed', label: 'Completed', count: projectStats.done },
            ].map((chip) => {
              const active = filter === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => setFilter(chip.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border transition ${
                    active
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent'
                      : 'text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {chip.label}
                  <span className={`text-[10px] tabular-nums ${active ? 'opacity-70' : 'opacity-60'}`}>
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Task list */}
          {tasksLoading ? (
            <div className="flex items-center justify-center py-10">
              <FaSpinner className="animate-spin text-xl text-teal-500" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="bg-white dark:bg-[#111115] rounded-lg border border-dashed border-gray-200 dark:border-white/[0.06] p-6 text-center">
              <FaTasks className="text-2xl text-gray-300 dark:text-gray-700 mx-auto mb-2" />
              <p className="text-[13px] text-gray-500 dark:text-gray-500">
                {searchQuery
                  ? `No tasks match "${searchQuery}"`
                  : filter === 'mine'
                    ? 'No tasks assigned to you'
                    : filter === 'open'
                      ? 'No open tasks'
                      : filter === 'completed'
                        ? 'No completed tasks yet'
                        : 'No tasks yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task._id}
                  task={task}
                  brandHex={brandHex}
                  canActOnIt={canActOnTask(task)}
                  canCommentOnIt={canCommentOnTask(task)}
                  onComplete={setCompleteTarget}
                  onComment={setCommentTarget}
                />
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <div className="pt-4 pb-1 text-center">
          <p className="text-[10px] text-gray-400 dark:text-gray-600">
            Powered by <span className="font-medium text-gray-500">Xircle</span>
          </p>
        </div>
      </main>

      <CompleteTaskModal
        isOpen={!!completeTarget}
        onClose={() => !isCompleting && setCompleteTarget(null)}
        task={completeTarget}
        onComplete={handleCompleteSubmit}
        busy={isCompleting}
      />

      <CommentModal
        isOpen={!!commentTarget}
        onClose={() => !isCommenting && setCommentTarget(null)}
        task={commentTarget}
        onSubmit={handleCommentSubmit}
        busy={isCommenting}
      />

      {showSignupBar && <SignupStickyBar token={token} brandHex={brandHex} mode={mode} />}
    </div>
  );
};

export default PublicProject;
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
  // project icon pool
  FaRocket, FaBolt, FaLightbulb, FaCube, FaStar, FaFire, FaFeather,
  FaCrown, FaGem, FaCompass, FaLayerGroup,
  // UI
  FaUser, FaLock, FaGlobe, FaUserShield, FaEye, FaCheckCircle, FaSpinner,
  FaTimes, FaArrowLeft, FaTasks, FaClock, FaExclamationTriangle,
  FaCheck, FaComment, FaSignInAlt, FaUserPlus, FaCalendarAlt, FaSearch,
  FaExternalLinkAlt, FaChevronDown, FaRegCommentDots, FaRegClock,
} from 'react-icons/fa';

// ─── Color utilities (mirrors the internal app) ───────────────────────
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
    xs: 'w-6 h-6 text-[9px]',
    sm: 'w-8 h-8 text-[11px]',
    md: 'w-10 h-10 text-xs',
  };
  const cls = sizes[size] || sizes.sm;
  const hasPhoto = !!user?.profile;
  const initials = getInitials(user?.name);
  return (
    <span
      title={user?.name || 'Member'}
      className={`${cls} rounded-full overflow-hidden inline-flex items-center justify-center font-semibold text-white shrink-0 ${ring ? 'ring-2 ring-white dark:ring-[#0b0b10]' : ''}`}
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
  pending:              { label: 'Pending',           color: 'text-gray-600 dark:text-gray-400',   bg: 'bg-gray-100 dark:bg-gray-800/60' },
  'in-progress':        { label: 'In Progress',       color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-100 dark:bg-blue-900/30' },
  ready_for_completion: { label: 'Ready',             color: 'text-teal-600 dark:text-teal-400',   bg: 'bg-teal-100 dark:bg-teal-900/30' },
  completed:            { label: 'Awaiting review',   color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  confirmed_completed:  { label: 'Completed',         color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
  cancelled:            { label: 'Cancelled',         color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-100 dark:bg-red-900/30' },
};

const PROJECT_STATUS_META = {
  planning:     { label: 'Planning',    color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-100 dark:bg-blue-900/30' },
  'in-progress':{ label: 'In Progress', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  'on-hold':    { label: 'On Hold',     color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  completed:    { label: 'Completed',   color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-100 dark:bg-green-900/30' },
  cancelled:    { label: 'Cancelled',   color: 'text-red-600 dark:text-red-400',       bg: 'bg-red-100 dark:bg-red-900/30' },
};

const PRIORITY_META = {
  low:    { label: 'Low',    color: 'text-gray-500 dark:text-gray-400',   dot: 'bg-gray-400' },
  medium: { label: 'Medium', color: 'text-blue-500 dark:text-blue-400',   dot: 'bg-blue-500' },
  high:   { label: 'High',   color: 'text-orange-500 dark:text-orange-400', dot: 'bg-orange-500' },
  urgent: { label: 'Urgent', color: 'text-red-500 dark:text-red-400',     dot: 'bg-red-500' },
};

// ═════════════════════════════════════════════════════════════════════
//  Complete Task Modal (only for editors on their own tasks)
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

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsedLinks = links
      .split(/[\n,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    onComplete({ notes: notes.trim(), links: parsedLinks, files });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="bg-white dark:bg-[#14141a] rounded-t-3xl sm:rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-800/60 flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800/60">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <FaCheckCircle className="text-teal-500 text-sm" />
              Mark complete
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate mt-0.5">{task.title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition shrink-0 disabled:opacity-40"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Completion notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="What did you do? Anything the team should know?"
              className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-teal-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Links (optional)
            </label>
            <textarea
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              rows={2}
              placeholder="One URL per line, or comma separated"
              className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-teal-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Attachments (optional)
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="block w-full text-xs text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-teal-50 dark:file:bg-teal-900/20 file:text-teal-700 dark:file:text-teal-400 hover:file:bg-teal-100 dark:hover:file:bg-teal-900/30 file:cursor-pointer cursor-pointer bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl"
            />
            {files.length > 0 && (
              <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-1.5">
                {files.length} file{files.length === 1 ? '' : 's'} selected
              </p>
            )}
          </div>
        </form>

        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-800/60">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition disabled:opacity-50"
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
      <div className="bg-white dark:bg-[#14141a] rounded-t-3xl sm:rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-800/60">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800/60">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <FaRegCommentDots className="text-teal-500 text-sm" />
              Add comment
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate mt-0.5">{task.title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition shrink-0 disabled:opacity-40"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Share an update, ask a question, or leave feedback…"
            className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-teal-500 resize-none"
          />
        </form>

        <div className="flex gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-800/60">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || !comment.trim()}
            className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {busy ? <FaSpinner className="animate-spin text-xs" /> : <FaComment className="text-xs" />}
            {busy ? 'Posting…' : 'Post comment'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Task Card
// ═════════════════════════════════════════════════════════════════════
const TaskCard = ({
  task,
  brandHex,
  canActOnIt,     // true when caller is editor AND assigned AND task not done
  canCommentOnIt, // true when caller is editor AND assigned
  onComplete,
  onComment,
}) => {
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
    <article className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/70 dark:border-gray-800/50 p-4 transition hover:border-gray-300 dark:hover:border-gray-700/60">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${statusMeta.bg} ${statusMeta.color}`}>
              {statusMeta.label}
            </span>
            {task.assignedToMe && (
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
                Assigned to you
              </span>
            )}
            {isOverdue && (
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                Overdue
              </span>
            )}
          </div>
          <h3 className={`text-sm font-semibold leading-snug break-words ${isDone || isCancelled ? 'text-gray-500 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
            {task.title}
          </h3>
        </div>

        <span className={`flex items-center gap-1.5 text-[10px] font-medium shrink-0 ${priorityMeta.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${priorityMeta.dot}`} />
          {priorityMeta.label}
        </span>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Progress bar (only if > 0 and not done) */}
      {progress > 0 && !isDone && !isCancelled && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800/70 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: brandHex }}
            />
          </div>
          <span className="text-[10px] font-mono font-semibold text-gray-500 dark:text-gray-500 tabular-nums">
            {progress}%
          </span>
        </div>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-gray-500 dark:text-gray-500">
        {task.dueDate && (
          <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
            <FaRegClock className="text-[9px]" />
            {format(new Date(task.dueDate), 'MMM d, yyyy')}
          </span>
        )}
        {subtaskTotal > 0 && (
          <span className="flex items-center gap-1">
            <FaTasks className="text-[9px]" />
            {subtaskDone}/{subtaskTotal} subtasks
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
              <span className="text-[10px]">+{task.assignees.length - 3}</span>
            )}
          </span>
        )}
      </div>

      {/* Actions */}
      {(canActOnIt || canCommentOnIt) && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/40 flex items-center gap-2 flex-wrap">
          {canActOnIt && (
            <button
              type="button"
              onClick={() => onComplete(task)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition"
            >
              <FaCheck className="text-[10px]" />
              Mark complete
            </button>
          )}
          {canCommentOnIt && (
            <button
              type="button"
              onClick={() => onComment(task)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800/60 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition"
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
//  Access Banner (top) — explains what kind of visitor you are
// ═════════════════════════════════════════════════════════════════════
const AccessBanner = ({ mode, permissions, collaborator, isLoggedIn, isFullMember, brandHex, workspaceId, projectId }) => {
  const navigate = useNavigate();

  // Full workspace member — offer to jump into the app
  if (isFullMember) {
    return (
      <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200/70 dark:border-teal-800/40 rounded-2xl p-4 flex items-start gap-3">
        <FaCheckCircle className="text-teal-500 text-base mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-teal-800 dark:text-teal-300">
            You're a member of this workspace
          </p>
          <p className="text-xs text-teal-700/80 dark:text-teal-400/80 mt-0.5">
            You have full access — open the project inside Xircle to edit, assign, and manage.
          </p>
        </div>
        <button
          onClick={() => navigate(`/workspace/${workspaceId}/project/${projectId}`)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition hover:opacity-90"
          style={{ backgroundColor: brandHex }}
        >
          <FaExternalLinkAlt className="text-[10px]" />
          Open
        </button>
      </div>
    );
  }

  // Anonymous + collaborator invite
  if (!isLoggedIn && mode === 'collaborator') {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/40 rounded-2xl p-4 flex items-start gap-3">
        <FaUserPlus className="text-amber-500 text-base mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            You've been invited to collaborate
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
            {collaborator?.role === 'editor'
              ? "Sign in or create an account to complete tasks assigned to you."
              : 'Sign in or create an account to participate.'}
          </p>
        </div>
      </div>
    );
  }

  // Anonymous + public share link
  if (!isLoggedIn && mode === 'public') {
    return (
      <div className="bg-gray-50 dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/40 rounded-2xl p-4 flex items-start gap-3">
        <FaGlobe className="text-gray-400 text-base mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            You're viewing a shared project
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
            Read-only access. Sign in to participate if you've been invited.
          </p>
        </div>
      </div>
    );
  }

  // Logged in but not linked as collaborator / not full member
  if (isLoggedIn && !isFullMember && !collaborator?.linkedToMe) {
    return (
      <div className="bg-gray-50 dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/40 rounded-2xl p-4 flex items-start gap-3">
        <FaEye className="text-gray-400 text-base mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Read-only view
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
            You're signed in, but not linked to this project as a collaborator.
          </p>
        </div>
      </div>
    );
  }

  // Logged in + linked collaborator
  if (isLoggedIn && collaborator?.linkedToMe) {
    const isEditor = collaborator.role === 'editor';
    return (
      <div className={`rounded-2xl p-4 flex items-start gap-3 border ${
        isEditor
          ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200/70 dark:border-teal-800/40'
          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200/70 dark:border-blue-800/40'
      }`}>
        <FaUserShield className={`text-base mt-0.5 shrink-0 ${isEditor ? 'text-teal-500' : 'text-blue-500'}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${isEditor ? 'text-teal-800 dark:text-teal-300' : 'text-blue-800 dark:text-blue-300'}`}>
            You're collaborating as {isEditor ? 'an Editor' : 'a Viewer'}
          </p>
          <p className={`text-xs mt-0.5 ${isEditor ? 'text-teal-700/80 dark:text-teal-400/80' : 'text-blue-700/80 dark:text-blue-400/80'}`}>
            {isEditor
              ? 'You can complete and comment on tasks assigned to you. Everything else is read-only.'
              : 'You have read-only access to this project.'}
          </p>
        </div>
      </div>
    );
  }

  return null;
};

// ═════════════════════════════════════════════════════════════════════
//  Signup Sticky Bar (anonymous guests only)
// ═════════════════════════════════════════════════════════════════════
const SignupStickyBar = ({ token, brandHex, mode }) => {
  const navigate = useNavigate();
  const isInvite = mode === 'collaborator';

  const handleSignup = () => {
    try { sessionStorage.setItem('pendingInviteToken', token); } catch { /* noop */ }
    // The signup route in this app is `/signup` (see Login.jsx "Create one now")
    navigate(`/signup?redirect=${encodeURIComponent(`/collaborate/${token}`)}`);
  };
  const handleLogin = () => {
    try { sessionStorage.setItem('pendingInviteToken', token); } catch { /* noop */ }
    navigate(`/login?redirect=${encodeURIComponent(`/collaborate/${token}`)}`);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 dark:border-gray-800/60 bg-white/95 dark:bg-[#0b0b10]/95 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
            {isInvite ? 'Sign in to contribute' : 'Sign in to Xircle'}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate">
            {isInvite
              ? 'Act on tasks assigned to you after signing in.'
              : 'Get full access to your projects and tasks.'}
          </p>
        </div>
        <button
          onClick={handleLogin}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800/60 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition"
        >
          Sign in
        </button>
        <button
          onClick={handleSignup}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition hover:opacity-90 flex items-center gap-1.5"
          style={{ backgroundColor: brandHex }}
        >
          <FaUserPlus className="text-[10px]" />
          Sign up
        </button>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Loading skeleton
// ═════════════════════════════════════════════════════════════════════
const LoadingSkeleton = () => (
  <div className="min-h-dvh bg-gray-50 dark:bg-[#0b0b10] flex items-center justify-center">
    <div className="text-center">
      <FaSpinner className="animate-spin text-3xl text-teal-500 mx-auto" />
      <p className="mt-3 text-sm text-gray-500 dark:text-gray-500">Loading project…</p>
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════════════
//  Error state
// ═════════════════════════════════════════════════════════════════════
const ErrorState = ({ status, message }) => {
  const navigate = useNavigate();
  const isRevoked = status === 410;
  const isNotFound = status === 404 || status === 400;

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-[#0b0b10] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/60 p-8 text-center">
        <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4 ${
          isRevoked ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30'
        }`}>
          <FaExclamationTriangle className={`text-2xl ${isRevoked ? 'text-amber-500' : 'text-red-500'}`} />
        </div>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
          {isRevoked ? 'Access revoked' : isNotFound ? 'Link not found' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
          {isRevoked
            ? 'This invite has been revoked by the project owner. Ask them for a new link.'
            : isNotFound
              ? "This link is invalid or has expired. Double-check the URL or ask for a fresh one."
              : message || 'Please try again in a moment.'}
        </p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition"
        >
          <FaArrowLeft className="text-xs" />
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
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  // ── Queries ──────────────────────────────────────────────────────
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

  // ── Derived state ────────────────────────────────────────────────
  const mode = projectRes?.mode || 'public';
  const permissions = projectRes?.permissions || {};
  const collaborator = projectRes?.collaborator || null;
  const project = projectRes?.project || null;
  const tasks = tasksRes?.tasks || [];
  const isFullMember = !!projectRes?.isFullMember;
  const isLoggedIn = !!userInfo?._id;

  // ── Local UI state ───────────────────────────────────────────────
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [completeTarget, setCompleteTarget] = useState(null);
  const [commentTarget, setCommentTarget] = useState(null);

  // Persist token so the user can come back after signup
  useEffect(() => {
    if (token) {
      try { sessionStorage.setItem('pendingInviteToken', token); } catch { /* noop */ }
    }
  }, [token]);

  // Clean up the pending token once the invite has been successfully linked
  useEffect(() => {
    if (collaborator?.linkedToMe && token) {
      try { sessionStorage.removeItem('pendingInviteToken'); } catch { /* noop */ }
    }
  }, [collaborator?.linkedToMe, token]);

  // Reset the toolbar when the underlying project changes
  useEffect(() => {
    setFilter('all');
    setSearchQuery('');
  }, [token]);

  // ── Computed helpers ────────────────────────────────────────────
  const brandHex = toHex(project?.color || '#0d9488');
  const Icon = pickProjectIcon(project);

  const myAssignedCount = useMemo(
    () => tasks.filter((t) => t.assignedToMe).length,
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    let arr = [...tasks];

    if (filter === 'mine') {
      arr = arr.filter((t) => t.assignedToMe);
    } else if (filter === 'open') {
      arr = arr.filter(
        (t) => !['confirmed_completed', 'cancelled'].includes(t.status)
      );
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

  // ── Permissions per task ────────────────────────────────────────
  const canActOnTask = (task) => {
    if (!permissions.canActOnAssignedTasks) return false;
    if (!task.assignedToMe) return false;
    if (task.status === 'confirmed_completed') return false;
    if (task.status === 'completed') return false;
    if (task.status === 'cancelled') return false;
    return true;
  };

  const canCommentOnTask = (task) => {
    if (!permissions.canComment) return false;
    if (!task.assignedToMe) return false;
    return true;
  };

  // ── Actions ─────────────────────────────────────────────────────
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

      await markTaskCompleted({
        taskId: completeTarget._id,
        data: payload,
      }).unwrap();

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

  // ── Early states ────────────────────────────────────────────────
  if (projectLoading) return <LoadingSkeleton />;

  if (projectError) {
    const status = projectError?.status || 0;
    return <ErrorState status={status} message={projectError?.data?.message} />;
  }

  if (!project) return <ErrorState status={404} />;

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════
  const showSignupBar = !isLoggedIn && !isFullMember;
  const hasEditRights = !!permissions.canActOnAssignedTasks;

  const statusMeta = PROJECT_STATUS_META[project.status] || PROJECT_STATUS_META.planning;

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#0b0b10]/90 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800/60">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: `linear-gradient(135deg, ${brandHex} 0%, ${shadeHex(brandHex, -22)} 100%)` }}
            >
              <Icon className="text-sm" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold">
                Shared project
              </p>
              <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                {project.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isLoggedIn && userInfo?.profile ? (
              <MemberAvatar user={userInfo} size="sm" fallbackColor={brandHex} />
            ) : (
              <Link
                to={`/login?redirect=${encodeURIComponent(`/collaborate/${token}`)}`}
                className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main
        className="flex-1 w-full max-w-5xl mx-auto px-4 py-5 space-y-5"
        style={{ paddingBottom: showSignupBar ? 'calc(7rem + env(safe-area-inset-bottom, 0px))' : '4rem' }}
      >
        {/* Access banner */}
        <AccessBanner
          mode={mode}
          permissions={permissions}
          collaborator={collaborator}
          isLoggedIn={isLoggedIn}
          isFullMember={isFullMember}
          brandHex={brandHex}
          workspaceId={project.workspaceId || project.workspace}
          projectId={project._id}
        />

        {/* Hero card */}
        <section className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/70 dark:border-gray-800/50 overflow-hidden">
          {/* Banner */}
          <div
            className="relative h-32 sm:h-40 flex items-end overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${brandHex} 0%, ${shadeHex(brandHex, -22)} 100%)` }}
          >
            <div
              className="absolute inset-0 opacity-[0.14] pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
                backgroundSize: '14px 14px',
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 30% 15%, rgba(255,255,255,0.28), transparent 60%)' }}
            />

            {project.coverImage && (
              <>
                <img
                  src={project.coverImage}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              </>
            )}

            <div className="relative p-4 sm:p-5 w-full">
              <span className={`inline-block text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full ${statusMeta.bg} ${statusMeta.color} backdrop-blur-md`}>
                {statusMeta.label}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 break-words">
                {project.name}
              </h2>
              {project.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 break-words leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500 dark:text-gray-500">
              {project.startDate && (
                <span className="flex items-center gap-1.5">
                  <FaCalendarAlt className="text-[10px]" />
                  Started {format(new Date(project.startDate), 'MMM d, yyyy')}
                </span>
              )}
              {project.endDate && (
                <span className="flex items-center gap-1.5">
                  <FaClock className="text-[10px]" />
                  Due {format(new Date(project.endDate), 'MMM d, yyyy')}
                </span>
              )}
              {project.tags?.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {project.tags.slice(0, 4).map((tag, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Progress */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Overall progress
                </span>
                <span className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                  {projectStats.progress}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800/70 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${projectStats.progress}%`, backgroundColor: brandHex }}
                />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="rounded-xl bg-gray-50 dark:bg-[#0b0b10] border border-gray-200/70 dark:border-gray-800/40 p-3 text-center">
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                  {projectStats.total}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                  Total tasks
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-[#0b0b10] border border-gray-200/70 dark:border-gray-800/40 p-3 text-center">
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  {projectStats.open}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                  Open
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-[#0b0b10] border border-gray-200/70 dark:border-gray-800/40 p-3 text-center">
                <p className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">
                  {projectStats.done}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                  Completed
                </p>
              </div>
            </div>

            {/* Team */}
            {(project.projectManagers?.length > 0 || project.teamMembers?.length > 0) && (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800/40">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-2">
                  Team
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {project.projectManagers?.slice(0, 5).map((pm, i) => (
                    <span key={pm._id || i} className="inline-flex items-center gap-1.5 pl-0.5 pr-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800/60 text-xs text-gray-700 dark:text-gray-300">
                      <MemberAvatar user={pm} size="xs" fallbackColor={brandHex} />
                      <span className="truncate max-w-[100px]">{pm.name || 'Manager'}</span>
                    </span>
                  ))}
                  {project.teamMembers?.filter((tm) => tm.status === 'active').slice(0, 5).map((tm, i) => (
                    <span key={tm.user?._id || i} className="inline-flex items-center gap-1.5 pl-0.5 pr-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800/60 text-xs text-gray-700 dark:text-gray-300">
                      <MemberAvatar user={tm.user} size="xs" fallbackColor={brandHex} />
                      <span className="truncate max-w-[100px]">{tm.user?.name || 'Member'}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Tasks section */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <FaTasks className="text-teal-500 text-sm" />
                Tasks
                <span className="text-xs font-normal text-gray-500 dark:text-gray-500">
                  ({tasks.length})
                </span>
              </h3>
              {hasEditRights && myAssignedCount > 0 && (
                <p className="text-[11px] text-teal-600 dark:text-teal-400 mt-0.5">
                  {myAssignedCount} assigned to you
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-xl px-3 py-1.5 focus-within:border-teal-500/50 transition w-full sm:w-64">
              <FaSearch className="text-gray-400 text-xs shrink-0" />
              <input
                type="text"
                placeholder="Search tasks…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-0 bg-transparent outline-none text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                >
                  <FaTimes className="text-[10px]" />
                </button>
              )}
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {[
              { id: 'all', label: 'All', count: tasks.length },
              ...(hasEditRights && myAssignedCount > 0
                ? [{ id: 'mine', label: 'Assigned to me', count: myAssignedCount }]
                : []),
              { id: 'open', label: 'Open', count: projectStats.open },
              { id: 'completed', label: 'Completed', count: projectStats.done },
            ].map((chip) => {
              const active = filter === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => setFilter(chip.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                    active
                      ? 'text-white border-transparent'
                      : 'text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800/40'
                  }`}
                  style={active ? { backgroundColor: brandHex } : undefined}
                >
                  {chip.label}
                  <span className={`text-[10px] tabular-nums ${active ? 'opacity-80' : 'opacity-60'}`}>
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Task list */}
          {tasksLoading ? (
            <div className="flex items-center justify-center py-12">
              <FaSpinner className="animate-spin text-2xl text-teal-500" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-dashed border-gray-300 dark:border-gray-800/60 p-8 text-center">
              <FaTasks className="text-3xl text-gray-300 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
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
            <div className="space-y-2.5">
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

        {/* Footer note */}
        <div className="pt-6 pb-2 text-center">
          <p className="text-[11px] text-gray-400 dark:text-gray-600">
            Powered by <span className="font-semibold text-gray-500 dark:text-gray-500">Xircle</span>
          </p>
        </div>
      </main>

      {/* Modals */}
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

      {/* Sticky signup CTA */}
      {showSignupBar && <SignupStickyBar token={token} brandHex={brandHex} mode={mode} />}
    </div>
  );
};

export default PublicProject;
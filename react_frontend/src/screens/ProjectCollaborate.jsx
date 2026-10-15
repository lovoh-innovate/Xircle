// src/pages/ProjectCollaborate.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { format, isPast, formatDistanceToNow } from 'date-fns';
import {
  FaRocket, FaBolt, FaLightbulb, FaCube, FaStar, FaFire, FaFeather,
  FaCrown, FaGem, FaCompass, FaLayerGroup,
  FaUser, FaCheckCircle, FaSpinner, FaTimes, FaArrowLeft, FaTasks,
  FaExclamationTriangle, FaCheck, FaComment, FaSignInAlt,
  FaUserPlus, FaSearch, FaExternalLinkAlt, FaRegCommentDots,
  FaRegClock, FaUserShield, FaEye, FaClipboardCheck, FaChevronRight,
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

const PRIORITY_META = {
  low:    { label: 'Low',    color: 'text-gray-500 dark:text-gray-500',     dot: 'bg-gray-400' },
  medium: { label: 'Medium', color: 'text-blue-600 dark:text-blue-400',     dot: 'bg-blue-500' },
  high:   { label: 'High',   color: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  urgent: { label: 'Urgent', color: 'text-red-600 dark:text-red-400',       dot: 'bg-red-500' },
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
//  My Task Card (with action controls)
// ═════════════════════════════════════════════════════════════════════
const MyTaskCard = ({ task, brandHex, canAct, canComment, onComplete, onComment }) => {
  const statusMeta = TASK_STATUS_META[task.status] || TASK_STATUS_META.pending;
  const priorityMeta = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const isDone = task.status === 'confirmed_completed';
  const isCancelled = task.status === 'cancelled';
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !isDone && !isCancelled;

  const dueLabel = task.dueDate
    ? isOverdue
      ? `Overdue by ${formatDistanceToNow(new Date(task.dueDate))}`
      : `Due ${format(new Date(task.dueDate), 'MMM d')}`
    : null;

  return (
    <article
      className="relative bg-white dark:bg-[#111115] rounded-lg border transition overflow-hidden"
      style={{
        borderColor: canAct ? `${brandHex}55` : 'rgba(148, 163, 184, 0.18)',
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ backgroundColor: brandHex }} />

      <div className="pl-4 pr-3.5 py-3.5">
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusMeta.bg} ${statusMeta.color}`}>
            {statusMeta.label}
          </span>
          {canAct && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${brandHex}1a`, color: brandHex }}
            >
              Action needed
            </span>
          )}
          {isOverdue && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
              Overdue
            </span>
          )}
        </div>

        <h3 className={`text-[13px] font-medium leading-snug break-words ${isDone || isCancelled ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
          {task.title}
        </h3>

        {task.description && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 mt-2.5 text-[11px] text-gray-500 dark:text-gray-500">
          {dueLabel && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
              <FaRegClock className="text-[9px]" />
              {dueLabel}
            </span>
          )}
          <span className={`flex items-center gap-1.5 ${priorityMeta.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${priorityMeta.dot}`} />
            {priorityMeta.label}
          </span>
          {task.subTasks?.length > 0 && (
            <span className="flex items-center gap-1">
              <FaTasks className="text-[9px]" />
              {task.subTasks.filter((s) => s.status === 'confirmed' || s.status === 'done').length}/{task.subTasks.length}
            </span>
          )}
        </div>

        {(canAct || canComment) && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.05] flex items-center gap-2 flex-wrap">
            {canAct && (
              <button
                type="button"
                onClick={() => onComplete(task)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-md transition hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: brandHex }}
              >
                <FaCheck className="text-[10px]" />
                Mark complete
              </button>
            )}
            {canComment && (
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
      </div>
    </article>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Regular Task Card (read-only)
// ═════════════════════════════════════════════════════════════════════
const TaskCard = ({ task, brandHex }) => {
  const statusMeta = TASK_STATUS_META[task.status] || TASK_STATUS_META.pending;
  const priorityMeta = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const isDone = task.status === 'confirmed_completed';
  const isCancelled = task.status === 'cancelled';
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !isDone && !isCancelled;

  return (
    <article className="bg-white dark:bg-[#111115] rounded-lg border border-gray-200/80 dark:border-white/[0.06] p-3.5">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusMeta.bg} ${statusMeta.color}`}>
              {statusMeta.label}
            </span>
            {isOverdue && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
                Overdue
              </span>
            )}
          </div>
          <h4 className={`text-[13px] font-medium leading-snug break-words ${isDone || isCancelled ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
            {task.title}
          </h4>
        </div>
        <span className={`flex items-center gap-1.5 text-[10px] font-medium shrink-0 ${priorityMeta.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${priorityMeta.dot}`} />
          {priorityMeta.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-gray-500 dark:text-gray-500">
        {task.dueDate && (
          <span className={isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
            {format(new Date(task.dueDate), 'MMM d, yyyy')}
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
    </article>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Welcome Hero — compact invitee landing
// ═════════════════════════════════════════════════════════════════════
const WelcomeHero = ({ project, collaborator, isLoggedIn, brandHex, Icon, onSignIn, onSignUp }) => {
  const isInviteLink = !!collaborator;
  const role = collaborator?.role;
  const linkedToMe = collaborator?.linkedToMe;
  const name = collaborator?.name || collaborator?.email || 'there';

  const statusLine = (() => {
    if (!isInviteLink) return null;
    if (linkedToMe) {
      return role === 'editor'
        ? 'Connected as Editor — you can act on tasks assigned to you.'
        : 'Connected as Viewer — read-only access.';
    }
    if (isLoggedIn) return "Signed in, but not linked — this invite was sent to a different email.";
    return 'Sign in or create an account with the invited email to participate.';
  })();

  return (
    <section className="bg-white dark:bg-[#111115] rounded-lg border border-gray-200/80 dark:border-white/[0.06] overflow-hidden">
      {/* Real cover image only — no fake banner */}
      {project.coverImage && (
        <div className="relative h-24 sm:h-32">
          <img src={project.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}
      {/* Slim brand accent when no cover */}
      {!project.coverImage && (
        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(90deg, ${brandHex} 0%, ${shadeHex(brandHex, -22)} 100%)` }}
        />
      )}

      <div className="px-4 sm:px-5 py-3.5 sm:py-4">
        {/* Header row — icon + name */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: brandHex }}
          >
            <Icon className="text-[11px]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-medium">
              {isInviteLink ? 'Invited to' : 'Shared project'}
            </p>
            <h1 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
              {project.name}
            </h1>
          </div>
        </div>

        {isInviteLink ? (
          <>
            <p className="text-[13px] text-gray-700 dark:text-gray-300 mt-3 leading-relaxed">
              Hi {name} — {statusLine}
            </p>

            {/* Compact access/status strip */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-500">
              <span className="flex items-center gap-1.5">
                {role === 'editor' ? (
                  <FaUserShield className="text-teal-500 text-[10px]" />
                ) : (
                  <FaEye className="text-blue-500 text-[10px]" />
                )}
                <span className="capitalize">{role || 'Viewer'}</span>
              </span>
              <span className="text-gray-300 dark:text-gray-700">·</span>
              <span className="flex items-center gap-1.5">
                {linkedToMe ? (
                  <>
                    <FaCheckCircle className="text-green-500 text-[10px]" />
                    Linked to your account
                  </>
                ) : isLoggedIn ? (
                  <>
                    <FaExclamationTriangle className="text-amber-500 text-[10px]" />
                    Not yet linked
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle className="text-amber-500 text-[10px]" />
                    Sign-in required
                  </>
                )}
              </span>
            </div>

            {!isLoggedIn && (
              <div className="mt-3.5 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={onSignUp}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-medium text-white rounded-md transition hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: brandHex }}
                >
                  <FaUserPlus className="text-[10px]" />
                  Create account
                </button>
                <button
                  onClick={onSignIn}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.04] rounded-md transition"
                >
                  <FaSignInAlt className="text-[10px]" />
                  Sign in
                </button>
              </div>
            )}
          </>
        ) : (
          project.description && (
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-3 leading-relaxed line-clamp-3">
              {project.description}
            </p>
          )
        )}
      </div>
    </section>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Loading / Error
// ═════════════════════════════════════════════════════════════════════
const LoadingSkeleton = () => (
  <div className="min-h-dvh bg-gray-50 dark:bg-[#0b0b10] flex items-center justify-center">
    <div className="text-center">
      <FaSpinner className="animate-spin text-2xl text-teal-500 mx-auto" />
      <p className="mt-3 text-xs text-gray-500">Loading invite…</p>
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
          {isRevoked ? 'Access revoked' : isNotFound ? 'Invite not found' : 'Something went wrong'}
        </h1>
        <p className="text-[13px] text-gray-500 dark:text-gray-500 mb-5 leading-relaxed">
          {isRevoked
            ? 'This invite has been revoked. Ask the project owner for a fresh one.'
            : isNotFound
              ? 'This invite link is invalid or has expired.'
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
const ProjectCollaborate = () => {
  const { token } = useParams();
  const navigate = useNavigate();
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

  const permissions = projectRes?.permissions || {};
  const collaborator = projectRes?.collaborator || null;
  const project = projectRes?.project || null;
  const tasks = tasksRes?.tasks || [];
  const isFullMember = !!projectRes?.isFullMember;
  const isLoggedIn = !!userInfo?._id;
  const linkedToMe = !!collaborator?.linkedToMe;
  const isEditor = collaborator?.role === 'editor';
  const canAct = linkedToMe && isEditor && permissions.canActOnAssignedTasks;

  const [searchQuery, setSearchQuery] = useState('');
  const [completeTarget, setCompleteTarget] = useState(null);
  const [commentTarget, setCommentTarget] = useState(null);
  const [showAllTasks, setShowAllTasks] = useState(false);

  useEffect(() => {
    if (token) {
      try { sessionStorage.setItem('pendingInviteToken', token); } catch { /* noop */ }
    }
  }, [token]);

  useEffect(() => {
    if (linkedToMe && token) {
      try { sessionStorage.removeItem('pendingInviteToken'); } catch { /* noop */ }
    }
  }, [linkedToMe, token]);

  useEffect(() => {
    setSearchQuery('');
    setShowAllTasks(false);
  }, [token]);

  const brandHex = toHex(project?.color || '#0d9488');
  const Icon = pickProjectIcon(project);

  const myTasks = useMemo(
    () => tasks.filter((t) => t.assignedToMe),
    [tasks]
  );

  const myOpenTasks = useMemo(
    () => myTasks.filter((t) => !['confirmed_completed', 'cancelled'].includes(t.status)),
    [myTasks]
  );

  const otherTasks = useMemo(
    () => tasks.filter((t) => !t.assignedToMe),
    [tasks]
  );

  const filteredOtherTasks = useMemo(() => {
    let arr = [...otherTasks];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      arr = arr.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }
    arr.sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    return arr;
  }, [otherTasks, searchQuery]);

  const projectStats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'confirmed_completed').length;
    const open = total - done;
    const progress = total > 0 ? Math.round((done / total) * 100) : project?.progress || 0;
    return { total, done, open, progress };
  }, [tasks, project]);

  const handleSignIn = () => {
    navigate(`/login?redirect=${encodeURIComponent(`/collaborate/${token}`)}`);
  };

  const handleSignUp = () => {
    navigate(`/signup?redirect=${encodeURIComponent(`/collaborate/${token}`)}`);
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

  if (projectLoading) return <LoadingSkeleton />;

  if (projectError) {
    const status = projectError?.status || 0;
    return <ErrorState status={status} message={projectError?.data?.message} />;
  }

  if (!project) return <ErrorState status={404} />;

  const showMyTasksSection = linkedToMe && myTasks.length > 0;
  const showAllOtherTasks = showAllTasks || filteredOtherTasks.length <= 5;
  const visibleOtherTasks = showAllOtherTasks
    ? filteredOtherTasks
    : filteredOtherTasks.slice(0, 5);

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col">
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#0b0b10]/90 backdrop-blur-xl border-b border-gray-200 dark:border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
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
              <button
                onClick={handleSignIn}
                className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-5 space-y-4 pb-16">

        <WelcomeHero
          project={project}
          collaborator={collaborator}
          isLoggedIn={isLoggedIn}
          brandHex={brandHex}
          Icon={Icon}
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
        />

        {isFullMember && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-50 dark:bg-white/[0.02] border border-gray-200/80 dark:border-white/[0.05]">
            <FaCheckCircle className="text-teal-500 text-[11px] shrink-0" />
            <p className="flex-1 min-w-0 text-[11px] text-teal-600 dark:text-teal-400 truncate">
              Workspace member · full access
            </p>
            <button
              onClick={() => navigate(`/workspace/${project.workspaceId || project.workspace}/project/${project._id}`)}
              className="text-[11px] font-medium text-teal-600 dark:text-teal-400 hover:underline shrink-0 inline-flex items-center gap-1"
            >
              Open
              <FaExternalLinkAlt className="text-[9px]" />
            </button>
          </div>
        )}

        {showMyTasksSection && (
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <h2 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <FaClipboardCheck className="text-teal-500 text-[11px]" />
                Your tasks
              </h2>
              <span className="text-[11px] text-gray-400 dark:text-gray-600 tabular-nums">
                {myOpenTasks.length} open{myTasks.length !== myOpenTasks.length ? ` / ${myTasks.length}` : ''}
              </span>
            </div>

            <div className="space-y-2">
              {myOpenTasks.map((task) => (
                <MyTaskCard
                  key={task._id}
                  task={task}
                  brandHex={brandHex}
                  canAct={canAct}
                  canComment={linkedToMe && isEditor && permissions.canComment}
                  onComplete={setCompleteTarget}
                  onComment={setCommentTarget}
                />
              ))}

              {myTasks.filter((t) => !myOpenTasks.includes(t)).length > 0 && (
                <>
                  <p className="text-[10px] font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider pt-2">
                    Completed
                  </p>
                  {myTasks
                    .filter((t) => !myOpenTasks.includes(t))
                    .map((task) => (
                      <TaskCard key={task._id} task={task} brandHex={brandHex} />
                    ))}
                </>
              )}
            </div>
          </section>
        )}

        {linkedToMe && myTasks.length === 0 && isEditor && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-blue-50/60 dark:bg-blue-500/[0.06] border border-blue-200/60 dark:border-blue-500/15">
            <FaClipboardCheck className="text-blue-500 text-[11px] mt-0.5 shrink-0" />
            <p className="flex-1 min-w-0 text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
              No tasks assigned to you yet. Anything the project manager assigns will show up here with completion controls.
            </p>
          </div>
        )}

        <section>
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <FaTasks className="text-teal-500 text-[11px]" />
                {linkedToMe ? 'Other tasks' : 'Project tasks'}
              </h2>
              <span className="text-[11px] text-gray-400 dark:text-gray-600 tabular-nums">
                {linkedToMe ? otherTasks.length : tasks.length}
              </span>
            </div>

            {otherTasks.length > 5 && (
              <div className="flex items-center gap-1.5 bg-white dark:bg-[#111115] border border-gray-200 dark:border-white/[0.06] rounded-md px-2.5 py-1.5 focus-within:border-gray-300 dark:focus-within:border-white/[0.12] transition w-32 sm:w-52 shrink-0">
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
            )}
          </div>

          {!linkedToMe ? (
            tasksLoading ? (
              <div className="flex items-center justify-center py-10">
                <FaSpinner className="animate-spin text-xl text-teal-500" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="bg-white dark:bg-[#111115] rounded-lg border border-dashed border-gray-200 dark:border-white/[0.06] p-6 text-center">
                <FaTasks className="text-2xl text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                <p className="text-[13px] text-gray-500 dark:text-gray-500">No tasks yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <TaskCard key={task._id} task={task} brandHex={brandHex} />
                ))}
              </div>
            )
          ) : (
            <>
              {filteredOtherTasks.length === 0 ? (
                <div className="bg-white dark:bg-[#111115] rounded-lg border border-dashed border-gray-200 dark:border-white/[0.06] p-6 text-center">
                  <FaTasks className="text-2xl text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-500 dark:text-gray-500">
                    {searchQuery
                      ? `No tasks match "${searchQuery}"`
                      : 'No other tasks on this project yet'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {visibleOtherTasks.map((task) => (
                      <TaskCard key={task._id} task={task} brandHex={brandHex} />
                    ))}
                  </div>
                  {!showAllOtherTasks && (
                    <button
                      onClick={() => setShowAllTasks(true)}
                      className="w-full mt-2.5 py-2 text-[13px] font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 bg-white dark:bg-[#111115] border border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.12] rounded-md transition inline-flex items-center justify-center gap-1.5"
                    >
                      Show all {filteredOtherTasks.length}
                      <FaChevronRight className="text-[9px]" />
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </section>

        {/* Project progress — compact */}
        <section className="bg-white dark:bg-[#111115] rounded-lg border border-gray-200/80 dark:border-white/[0.06] px-4 py-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wide">
              Progress
            </span>
            <span className="text-[11px] font-mono tabular-nums text-gray-700 dark:text-gray-300">
              {projectStats.progress}%
            </span>
          </div>
          <div className="h-1 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${projectStats.progress}%`, backgroundColor: brandHex }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500 dark:text-gray-500 mt-2.5">
            <span>{projectStats.total} tasks</span>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <span>{projectStats.open} open</span>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <span>{projectStats.done} done</span>
          </div>
        </section>

        <div className="pt-4 pb-2 text-center">
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
    </div>
  );
};

export default ProjectCollaborate;
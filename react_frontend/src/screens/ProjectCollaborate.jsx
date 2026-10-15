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
  // project icons
  FaRocket, FaBolt, FaLightbulb, FaCube, FaStar, FaFire, FaFeather,
  FaCrown, FaGem, FaCompass, FaLayerGroup,
  // UI
  FaUser, FaCheckCircle, FaSpinner, FaTimes, FaArrowLeft, FaTasks,
  FaClock, FaExclamationTriangle, FaCheck, FaComment, FaSignInAlt,
  FaUserPlus, FaCalendarAlt, FaSearch, FaExternalLinkAlt,
  FaRegCommentDots, FaRegClock, FaUserShield, FaEye, FaEnvelope,
  FaLock, FaShieldAlt, FaClipboardCheck, FaChevronRight,
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
  pending:              { label: 'Pending',         color: 'text-gray-600 dark:text-gray-400',     bg: 'bg-gray-100 dark:bg-gray-800/60' },
  'in-progress':        { label: 'In Progress',     color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-100 dark:bg-blue-900/30' },
  ready_for_completion: { label: 'Ready',           color: 'text-teal-600 dark:text-teal-400',     bg: 'bg-teal-100 dark:bg-teal-900/30' },
  completed:            { label: 'Awaiting review', color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-900/30' },
  confirmed_completed:  { label: 'Completed',       color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-100 dark:bg-green-900/30' },
  cancelled:            { label: 'Cancelled',       color: 'text-red-600 dark:text-red-400',       bg: 'bg-red-100 dark:bg-red-900/30' },
};

const PRIORITY_META = {
  low:    { label: 'Low',    color: 'text-gray-500 dark:text-gray-400',     dot: 'bg-gray-400' },
  medium: { label: 'Medium', color: 'text-blue-500 dark:text-blue-400',     dot: 'bg-blue-500' },
  high:   { label: 'High',   color: 'text-orange-500 dark:text-orange-400', dot: 'bg-orange-500' },
  urgent: { label: 'Urgent', color: 'text-red-500 dark:text-red-400',       dot: 'bg-red-500' },
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

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files || []));
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
//  Highlighted "My Task" Card
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
      className="relative bg-white dark:bg-[#14141a] rounded-2xl border-2 transition overflow-hidden"
      style={{
        borderColor: canAct ? brandHex : 'rgba(148, 163, 184, 0.2)',
        boxShadow: canAct ? `0 8px 32px -12px ${brandHex}66` : undefined,
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: brandHex }} />

      <div className="pl-5 pr-4 py-4">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${statusMeta.bg} ${statusMeta.color}`}>
            {statusMeta.label}
          </span>
          {canAct && (
            <span
              className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${brandHex}20`, color: brandHex }}
            >
              Your action needed
            </span>
          )}
          {isOverdue && (
            <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
              Overdue
            </span>
          )}
        </div>

        <h3 className={`text-base font-bold leading-snug break-words ${isDone || isCancelled ? 'text-gray-500 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
          {task.title}
        </h3>

        {task.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 line-clamp-3 leading-relaxed">
            {task.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-[11px] text-gray-500 dark:text-gray-500">
          {dueLabel && (
            <span className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
              <FaRegClock className="text-[10px]" />
              {dueLabel}
            </span>
          )}
          <span className={`flex items-center gap-1.5 ${priorityMeta.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${priorityMeta.dot}`} />
            {priorityMeta.label} priority
          </span>
          {task.subTasks?.length > 0 && (
            <span className="flex items-center gap-1.5">
              <FaTasks className="text-[10px]" />
              {task.subTasks.filter((s) => s.status === 'confirmed' || s.status === 'done').length}/{task.subTasks.length} subtasks
            </span>
          )}
        </div>

        {(canAct || canComment) && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {canAct && (
              <button
                type="button"
                onClick={() => onComplete(task)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: brandHex }}
              >
                <FaCheck className="text-xs" />
                Mark complete
              </button>
            )}
            {canComment && (
              <button
                type="button"
                onClick={() => onComment(task)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800/60 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition"
              >
                <FaComment className="text-xs" />
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
//  Regular Task Card (read-only list)
// ═════════════════════════════════════════════════════════════════════
const TaskCard = ({ task, brandHex }) => {
  const statusMeta = TASK_STATUS_META[task.status] || TASK_STATUS_META.pending;
  const priorityMeta = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const isDone = task.status === 'confirmed_completed';
  const isCancelled = task.status === 'cancelled';
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !isDone && !isCancelled;

  return (
    <article className="bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/70 dark:border-gray-800/50 p-3.5">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${statusMeta.bg} ${statusMeta.color}`}>
              {statusMeta.label}
            </span>
            {isOverdue && (
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                Overdue
              </span>
            )}
          </div>
          <h4 className={`text-sm font-semibold leading-snug break-words ${isDone || isCancelled ? 'text-gray-500 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
            {task.title}
          </h4>
        </div>
        <span className={`flex items-center gap-1.5 text-[10px] font-medium shrink-0 ${priorityMeta.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${priorityMeta.dot}`} />
          {priorityMeta.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-500">
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
              <span className="text-[10px]">+{task.assignees.length - 3}</span>
            )}
          </span>
        )}
      </div>
    </article>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Welcome Hero (big landing block for invitees)
// ═════════════════════════════════════════════════════════════════════
const WelcomeHero = ({ project, collaborator, isLoggedIn, brandHex, Icon, onSignIn, onSignUp }) => {
  const isInviteLink = !!collaborator;
  const role = collaborator?.role;
  const linkedToMe = collaborator?.linkedToMe;
  const name = collaborator?.name || collaborator?.email || 'there';

  return (
    <section className="relative overflow-hidden rounded-3xl border border-gray-200/70 dark:border-gray-800/50 bg-white dark:bg-[#14141a]">
      <div
        className="relative h-28 sm:h-36 flex items-end overflow-hidden"
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
            <img src={project.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </>
        )}
        <div className="relative p-5 w-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0">
              <Icon className="text-lg" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-white/80 font-semibold">
                {isInviteLink ? "You've been invited to" : 'Shared project'}
              </p>
              <h1 className="text-lg sm:text-xl font-bold text-white truncate">
                {project.name}
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {isInviteLink ? (
          <>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 break-words">
              Hi {name},
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
              {linkedToMe
                ? role === 'editor'
                  ? "You're connected as an Editor. You can complete and comment on the tasks assigned to you."
                  : "You're connected as a Viewer. You have read-only access to this project."
                : isLoggedIn
                  ? "You're signed in, but this invite isn't linked to your account yet. Make sure you're using the email this invite was sent to."
                  : "You can preview the project now, but you'll need a Xircle account to act on tasks assigned to you."}
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800/50 bg-gray-50/60 dark:bg-[#0b0b10] p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  {role === 'editor' ? (
                    <FaUserShield className="text-teal-500 text-xs" />
                  ) : (
                    <FaEye className="text-blue-500 text-xs" />
                  )}
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                    Your access
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 capitalize">
                  {role || 'Viewer'}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">
                  {role === 'editor'
                    ? 'Act on tasks assigned to you'
                    : 'Read-only view of the project'}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800/50 bg-gray-50/60 dark:bg-[#0b0b10] p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  {linkedToMe ? (
                    <FaCheckCircle className="text-green-500 text-xs" />
                  ) : (
                    <FaExclamationTriangle className="text-amber-500 text-xs" />
                  )}
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                    Status
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {linkedToMe ? 'Linked to your account' : isLoggedIn ? 'Not yet linked' : 'Sign-in required'}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">
                  {linkedToMe
                    ? 'Everything is set — dive in below'
                    : isLoggedIn
                      ? 'Email must match the invite'
                      : 'Create an account with the invited email'}
                </p>
              </div>
            </div>

            {!isLoggedIn && (
              <div className="mt-5 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={onSignUp}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white rounded-xl transition hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: brandHex }}
                >
                  <FaUserPlus className="text-xs" />
                  Create your account
                </button>
                <button
                  onClick={onSignIn}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800/60 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition"
                >
                  <FaSignInAlt className="text-xs" />
                  I already have an account
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {project.description || 'No description provided.'}
            </p>
          </>
        )}
      </div>
    </section>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Loading skeleton
// ═════════════════════════════════════════════════════════════════════
const LoadingSkeleton = () => (
  <div className="min-h-dvh bg-gray-50 dark:bg-[#0b0b10] flex items-center justify-center">
    <div className="text-center">
      <FaSpinner className="animate-spin text-3xl text-teal-500 mx-auto" />
      <p className="mt-3 text-sm text-gray-500 dark:text-gray-500">Loading invite…</p>
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
          {isRevoked ? 'Access revoked' : isNotFound ? 'Invite not found' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
          {isRevoked
            ? 'This invite has been revoked. Ask the project owner for a fresh one.'
            : isNotFound
              ? "This invite link is invalid or has expired. Double-check the URL or ask for a new invite."
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

  // Clean up the pending token once we've successfully linked
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

  // ── Auth routing — matches the routes used by Login.jsx / Signup.jsx ──
  const handleSignIn = () => {
    navigate(`/login?redirect=${encodeURIComponent(`/collaborate/${token}`)}`);
  };

  const handleSignUp = () => {
    // The signup route in this app is `/signup` (see Login.jsx "Create one now")
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
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#0b0b10]/90 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800/60">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: `linear-gradient(135deg, ${brandHex} 0%, ${shadeHex(brandHex, -22)} 100%)` }}
            >
              <Icon className="text-sm" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold">
                Collaboration invite
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
              <button
                onClick={handleSignIn}
                className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-5 space-y-6 pb-16">

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
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200/70 dark:border-teal-800/40 rounded-2xl p-4 flex items-start gap-3">
            <FaCheckCircle className="text-teal-500 text-base mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-teal-800 dark:text-teal-300">
                You have full access to this project
              </p>
              <p className="text-xs text-teal-700/80 dark:text-teal-400/80 mt-0.5">
                As a workspace member you can edit, assign, and manage everything.
              </p>
            </div>
            <button
              onClick={() => navigate(`/workspace/${project.workspaceId || project.workspace}/project/${project._id}`)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition hover:opacity-90"
              style={{ backgroundColor: brandHex }}
            >
              <FaExternalLinkAlt className="text-[10px]" />
              Open in app
            </button>
          </div>
        )}

        {showMyTasksSection && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <FaClipboardCheck className="text-teal-500 text-base" />
                  Your tasks
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-500">
                    ({myOpenTasks.length} open{myTasks.length !== myOpenTasks.length ? ` of ${myTasks.length}` : ''})
                  </span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                  {isEditor
                    ? 'Mark complete and add comments on the tasks assigned to you.'
                    : 'Tasks assigned to you on this project.'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
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
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-wider pt-2">
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
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200/70 dark:border-blue-800/40 rounded-2xl p-4 flex items-start gap-3">
            <FaClipboardCheck className="text-blue-500 text-base mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                No tasks assigned to you yet
              </p>
              <p className="text-xs text-blue-700/80 dark:text-blue-400/80 mt-0.5">
                When the project manager assigns work to you, it'll show up here with completion controls.
              </p>
            </div>
          </div>
        )}

        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <FaTasks className="text-teal-500 text-sm" />
                {linkedToMe ? 'Other tasks' : 'Project tasks'}
                <span className="text-xs font-normal text-gray-500 dark:text-gray-500">
                  ({linkedToMe ? otherTasks.length : tasks.length})
                </span>
              </h2>
              {linkedToMe && otherTasks.length > 0 && (
                <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">
                  Read-only view of what the rest of the team is working on
                </p>
              )}
            </div>

            {otherTasks.length > 5 && (
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
            )}
          </div>

          {!linkedToMe ? (
            tasksLoading ? (
              <div className="flex items-center justify-center py-12">
                <FaSpinner className="animate-spin text-2xl text-teal-500" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-dashed border-gray-300 dark:border-gray-800/60 p-8 text-center">
                <FaTasks className="text-3xl text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-500">No tasks yet</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {tasks.map((task) => (
                  <TaskCard key={task._id} task={task} brandHex={brandHex} />
                ))}
              </div>
            )
          ) : (
            <>
              {filteredOtherTasks.length === 0 ? (
                <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-dashed border-gray-300 dark:border-gray-800/60 p-6 text-center">
                  <FaTasks className="text-2xl text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    {searchQuery
                      ? `No tasks match "${searchQuery}"`
                      : 'No other tasks on this project yet'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5">
                    {visibleOtherTasks.map((task) => (
                      <TaskCard key={task._id} task={task} brandHex={brandHex} />
                    ))}
                  </div>
                  {!showAllOtherTasks && (
                    <button
                      onClick={() => setShowAllTasks(true)}
                      className="w-full mt-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 hover:border-teal-500/50 rounded-xl transition inline-flex items-center justify-center gap-2"
                    >
                      Show all {filteredOtherTasks.length} tasks
                      <FaChevronRight className="text-[10px]" />
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </section>

        <section className="pt-4">
          <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/70 dark:border-gray-800/50 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Project progress
              </span>
              <span className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200 tabular-nums">
                {projectStats.progress}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800/70 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${projectStats.progress}%`, backgroundColor: brandHex }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="text-center">
                <p className="text-xl font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                  {projectStats.total}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                  Total
                </p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  {projectStats.open}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                  Open
                </p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-green-600 dark:text-green-400 tabular-nums">
                  {projectStats.done}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                  Completed
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="pt-6 pb-2 text-center">
          <p className="text-[11px] text-gray-400 dark:text-gray-600">
            Powered by <span className="font-semibold text-gray-500 dark:text-gray-500">Xircle</span>
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
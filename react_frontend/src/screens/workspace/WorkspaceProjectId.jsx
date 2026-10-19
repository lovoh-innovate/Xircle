// src/screens/workspace/WorkspaceProjectId.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  FaArrowLeft, FaSearch, FaPlus, FaEllipsisV, FaFolder, FaFolderOpen,
  FaEdit, FaUserLock, FaTrashAlt, FaTasks, FaTimes, FaGripVertical,
  FaRedo, FaClock, FaUsers, FaArchive, FaUndo, FaTrashRestore,
  FaExclamationTriangle, FaCheck, FaAngleDown, FaUser, FaFlag, FaFire,
  FaCopy, FaCamera, FaLink, FaPaperclip, FaChevronRight,
  FaMagic, FaRobot, FaFileAlt, FaHeartbeat, FaLightbulb, FaDownload,
  FaExclamationCircle, FaCheckCircle, FaSpinner,
  FaList, FaThLarge, FaCheckDouble, FaHandPointer, FaMousePointer,
  FaCalendarAlt, FaAngleLeft, FaAngleRight, FaStickyNote, FaFeather,
  FaEye, FaUserShield, FaUserPlus, FaSignInAlt,
} from 'react-icons/fa';
import { jsPDF } from 'jspdf';
import { useGetWorkspaceQuery } from '../../slices/workspaceApiSlice';
import {
  useGetProjectQuery,
  useArchiveProjectMutation,
  useUnarchiveProjectMutation,
  useDeleteProjectMutation,
  useRestoreProjectMutation,
  usePermanentlyDeleteProjectMutation,
} from '../../slices/projectApiSlice';
import {
  useGetProjectTasksQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useReorderTasksMutation,
  useGetProjectFoldersQuery,
  useCreateFolderMutation,
  useUpdateFolderMutation,
  useDeleteFolderMutation,
  useAddFolderReadOnlyMutation,
  useRemoveFolderReadOnlyMutation,
} from '../../slices/taskApiSlice';
import {
  usePlanWithAIMutation,
  useExecuteAIPlanMutation,
  useReviewProjectMutation,
  useSummarizeProjectMutation,
  useGenerateProjectDocsMutation,
  useEditProjectWithAIMutation,
  useApplyProjectEditsMutation,
} from '../../slices/aiApiSlice';
import { useGetNotesQuery, useCreateNoteMutation } from '../../slices/personalNoteApiSlice';
import { useGetWorkspaceNotesQuery } from '../../slices/workspaceNoteApiSlice';
import WorkspaceSidebar from '../../components/WorkspaceSidebar';
import WorkspaceBottombar from '../../components/WorkspaceBottombar';
import { useMediaPicker } from '../../hooks/useMediaPicker';

// ─── Base path (keep in sync with WorkspaceSidebar / WorkspaceBottombar / WorkspaceId / WorkspaceProjects) ──
const WORKSPACE_BASE_PATH = '/workspace';

// ─── format helpers ─────────────────────────────────────────────
const fmtDate = (d) => (!d ? 'N/A' : new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
const fmtDateTime = (d) => (!d ? 'No due' : new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
const fmtShortDate = (d) => (!d ? '' : new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric' }));
const getFirstName = (name) => (!name ? 'someone' : String(name).trim().split(/\s+/)[0] || 'someone');

// ─── touch / gesture hook ───────────────────────────────────────
const useIsTouchDevice = () => {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => { setIsTouch(window.matchMedia('(pointer: coarse)').matches); }, []);
  return isTouch;
};

// ─── badges ─────────────────────────────────────────────────────
const STATUS_MAP = {
  pending: { label: 'Pending', c: 'bg-gray-100 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700' },
  'in-progress': { label: 'In Progress', c: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700/50' },
  ready_for_completion: { label: 'Ready', c: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-700/50' },
  completed: { label: 'Completed', c: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 border-green-200 dark:border-green-700/50' },
  confirmed_completed: { label: 'Confirmed', c: 'bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-200 border-green-300 dark:border-green-600/50' },
  cancelled: { label: 'Cancelled', c: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 border-red-200 dark:border-red-700/50' },
};
const PRIORITY_MAP = {
  low: { label: 'Low', c: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/40' },
  medium: { label: 'Medium', c: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700/40' },
  high: { label: 'High', c: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40' },
  urgent: { label: 'Urgent', c: 'text-red-700 dark:text-red-500 bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700/50' },
};
const STATUS_DOT = {
  pending: '#9ca3af',
  'in-progress': '#eab308',
  ready_for_completion: '#3b82f6',
  completed: '#22c55e',
  confirmed_completed: '#16a34a',
  cancelled: '#ef4444',
};
const StatusPill = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${s.c}`}>{s.label}</span>;
};
const PriorityPill = ({ priority }) => {
  const p = PRIORITY_MAP[priority] || PRIORITY_MAP.medium;
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${p.c}`}>{p.label}</span>;
};

const priorityOptions = [
  { value: 'low', label: 'Low', icon: <FaFlag className="text-blue-400" /> },
  { value: 'medium', label: 'Medium', icon: <FaFlag className="text-yellow-400" /> },
  { value: 'high', label: 'High', icon: <FaFire className="text-red-400" /> },
  { value: 'urgent', label: 'Urgent', icon: <FaFire className="text-red-500" /> },
];

// ─── Global Styles ─────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .skeleton { position: relative; overflow: hidden; background-color: rgb(229 231 235); }
    .dark .skeleton { background-color: rgba(255, 255, 255, 0.07); }
    .skeleton::after {
      content: ''; position: absolute; inset: 0; transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
      animation: skeletonShimmer 1.5s ease-in-out infinite;
    }
    .dark .skeleton::after {
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
    }
    @keyframes skeletonShimmer { 100% { transform: translateX(100%); } }
    @media (prefers-reduced-motion: reduce) { .skeleton::after { animation: none; } }
  `}</style>
);

// ─── Skeleton Primitives ────────────────────────────────────────
const Skeleton = ({ className = '' }) => (<div className={`skeleton rounded-lg ${className}`} />);

const TaskCardSkeleton = () => (
  <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/40 p-3 sm:p-4">
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Skeleton className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex-shrink-0" />
        <Skeleton className="h-3.5 w-32 max-w-[60%]" />
      </div>
      <div className="flex items-center gap-1 shrink-0"><Skeleton className="w-5 h-5 rounded-md" /><Skeleton className="h-5 w-16 rounded-full" /></div>
    </div>
    <div className="mt-2 flex items-center gap-2"><Skeleton className="h-5 w-14 rounded-full" /><Skeleton className="h-2.5 w-12" /></div>
    <div className="mt-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="flex -space-x-1.5"><Skeleton className="w-5 h-5 rounded-full" /><Skeleton className="w-5 h-5 rounded-full" /><Skeleton className="w-5 h-5 rounded-full" /></div>
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-2.5 w-16" />
    </div>
    <div className="mt-2 flex items-center gap-2"><Skeleton className="flex-1 h-1.5 rounded-full" /><Skeleton className="h-2.5 w-8" /></div>
  </div>
);

const FolderChipSkeleton = ({ width = 'w-16' }) => (
  <Skeleton className={`h-6 ${width} rounded-full flex-shrink-0`} />
);

const ProjectSkeleton = ({ brandColor = '#0d9488', hideWorkspaceChrome = false }) => (
  <div className={`h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col overflow-hidden ${hideWorkspaceChrome ? '' : 'lg:flex-row'}`}>
    {!hideWorkspaceChrome && (
      <div className="hidden lg:block lg:w-64 lg:h-full shrink-0 border-r border-gray-100 dark:border-gray-800/60 p-4 space-y-4">
        <Skeleton className="h-9 w-36 rounded-xl" />
        <div className="space-y-2 pt-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <Skeleton className="h-3.5 flex-1 max-w-[110px]" />
            </div>
          ))}
        </div>
      </div>
    )}
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 shrink-0">
        <div className="flex items-center justify-between px-3 md:px-4 h-14 lg:h-16">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Skeleton className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex-shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40 max-w-[60%]" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <Skeleton className="w-8 h-8 rounded-xl" /><Skeleton className="w-8 h-8 rounded-xl" />
            <Skeleton className="w-8 h-8 rounded-xl" /><Skeleton className="w-8 h-8 rounded-xl" />
          </div>
        </div>
      </header>
      <div className="border-b border-gray-200/60 dark:border-gray-800/30 px-3 py-2 bg-gray-50 dark:bg-[#14141a]/60 shrink-0">
        <div className="flex items-center justify-between mb-1"><Skeleton className="h-2.5 w-14" /><Skeleton className="h-3 w-10" /></div>
        <div className="flex flex-nowrap overflow-x-auto gap-1.5 pb-1 scrollbar-hide">
          <FolderChipSkeleton width="w-12" /><FolderChipSkeleton width="w-20" />
          <FolderChipSkeleton width="w-16" /><FolderChipSkeleton width="w-24" /><FolderChipSkeleton width="w-14" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-24 md:pb-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {Array.from({ length: 6 }).map((_, i) => (<TaskCardSkeleton key={i} />))}
        </div>
      </div>
    </div>
  </div>
);

// ─── Full-page error / access-denied screen ────────────────────
const ErrorScreen = ({
  title = 'Something went wrong',
  message = 'Please try again in a moment.',
  icon: Icon = FaExclamationTriangle,
  tone = 'error',
  onBack,
  onRetry,
  onSignup,
  backLabel = 'Back to projects',
  signupLabel = 'Sign up to Xircle',
}) => {
  const toneRing =
    tone === 'error'
      ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'
      : tone === 'warn'
      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
      : 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400';

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10] p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl text-center">
        <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 ${toneRing}`}>
          <Icon className="text-2xl" />
        </div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">{title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 break-words leading-relaxed">{message}</p>
        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            {onRetry && (
              <button onClick={onRetry} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
                Try again
              </button>
            )}
            {onBack && (
              <button onClick={onBack} className="flex-1 py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl text-sm font-medium hover:opacity-90 transition">
                {backLabel}
              </button>
            )}
          </div>
          {onSignup && (
            <button onClick={onSignup} className="w-full py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl text-sm font-medium hover:opacity-90 transition">
              {signupLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Custom Dropdown
// ═══════════════════════════════════════════════════════════════
const Dropdown = ({ label, options, value, onChange, placeholder, brandColor }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 'auto', bottom: 'auto', left: -9999, width: 0, maxHeight: 260 });
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  const MAX_H = 260, MIN_H = 80, GAP = 6, EDGE = 8;

  const compute = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;

    let top = 'auto', bottom = 'auto', maxHeight = MAX_H;
    if (below >= MAX_H || below >= above) {
      top = r.bottom + GAP;
      maxHeight = Math.max(MIN_H, Math.min(MAX_H, below));
    } else {
      bottom = vh - r.top + GAP;
      maxHeight = Math.max(MIN_H, Math.min(MAX_H, above));
    }
    let left = r.left;
    const width = r.width;
    if (left + width > vw - EDGE) left = vw - width - EDGE;
    if (left < EDGE) left = EDGE;
    setPos({ top, bottom, left, width, maxHeight });
  }, []);

  useEffect(() => {
    if (!open) return;
    compute();
    const h = () => compute();
    window.addEventListener('resize', h);
    window.addEventListener('scroll', h, true);
    return () => { window.removeEventListener('resize', h); window.removeEventListener('scroll', h, true); };
  }, [open, compute]);

  useEffect(() => {
    if (!open) return;
    const down = (e) => {
      const inW = wrapperRef.current && wrapperRef.current.contains(e.target);
      const inP = popupRef.current && popupRef.current.contains(e.target);
      if (!inW && !inP) setOpen(false);
    };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);

  const sel = options.find((o) => o.value === value);

  return (
    <div ref={wrapperRef} className="relative">
      {label && <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-300"
      >
        {sel?.icon && <span className="text-xs shrink-0">{sel.icon}</span>}
        <span className={`truncate flex-1 text-left ${sel ? '' : 'text-gray-400 dark:text-gray-500'}`}>{sel ? sel.label : placeholder}</span>
        <FaAngleDown className={`text-[10px] text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div
          ref={popupRef}
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          className="fixed z-[120] bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 overflow-y-auto"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${
                o.value === value
                  ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'
              }`}
            >
              {o.icon && <span className="text-xs shrink-0">{o.icon}</span>}
              <span className="truncate flex-1">{o.label}</span>
              {o.value === value && <FaCheck className="text-[9px] shrink-0" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Custom Multi-Dropdown
// ═══════════════════════════════════════════════════════════════
const MultiDropdown = ({ label, options, values = [], onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 'auto', bottom: 'auto', left: -9999, width: 0, maxHeight: 300 });
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  const MAX_H = 300, MIN_H = 80, GAP = 6, EDGE = 8;

  const compute = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;

    let top = 'auto', bottom = 'auto', maxHeight = MAX_H;
    if (below >= MAX_H || below >= above) {
      top = r.bottom + GAP;
      maxHeight = Math.max(MIN_H, Math.min(MAX_H, below));
    } else {
      bottom = vh - r.top + GAP;
      maxHeight = Math.max(MIN_H, Math.min(MAX_H, above));
    }
    let left = r.left;
    const width = r.width;
    if (left + width > vw - EDGE) left = vw - width - EDGE;
    if (left < EDGE) left = EDGE;
    setPos({ top, bottom, left, width, maxHeight });
  }, []);

  useEffect(() => {
    if (!open) return;
    compute();
    const h = () => compute();
    window.addEventListener('resize', h);
    window.addEventListener('scroll', h, true);
    return () => { window.removeEventListener('resize', h); window.removeEventListener('scroll', h, true); };
  }, [open, compute]);

  useEffect(() => {
    if (!open) return;
    const down = (e) => {
      const inW = wrapperRef.current && wrapperRef.current.contains(e.target);
      const inP = popupRef.current && popupRef.current.contains(e.target);
      if (!inW && !inP) setOpen(false);
    };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);

  const sel = options.filter((o) => values.includes(o.value));
  const text = sel.length === 0 ? placeholder : sel.length === 1 ? sel[0].label : `${sel.length} selected`;
  const toggle = (v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <div ref={wrapperRef} className="relative">
      {label && <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-300"
      >
        <span className={`truncate flex-1 text-left ${sel.length === 0 ? 'text-gray-400 dark:text-gray-500' : ''}`}>{text}</span>
        <FaAngleDown className={`text-[10px] text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div
          ref={popupRef}
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          className="fixed z-[120] bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 overflow-y-auto"
        >
          {options.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">No members available</div>}
          {options.map((o) => {
            const checked = values.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${
                  checked
                    ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                }`}
              >
                <span className={`w-3.5 h-3.5 flex items-center justify-center border rounded shrink-0 ${checked ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-400 dark:border-gray-600'}`}>
                  {checked && <FaCheck className="text-[8px]" />}
                </span>
                {o.icon}
                <span className="truncate flex-1">{o.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Custom DateTime Picker
// ═══════════════════════════════════════════════════════════════
const QUICK_DUE_SHORTCUTS = [
  ['1h', 'in an hour'], ['12h', 'in 12 hours'], ['today', 'today'],
  ['2d', 'in 2 days'], ['1w', 'in a week'], ['2w', 'in 2 weeks'], ['1m', 'in a month'],
];

const CustomDateTimePicker = ({
  value, onChange, placeholder = 'Select date & time', disabled = false, showShortcuts = false,
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 'auto', bottom: 'auto', left: -9999, maxHeight: 480 });

  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  const POPUP_W = 290;
  const MAX_H = 480, MIN_H = 240, GAP = 6, EDGE = 8;

  const initialDate = value ? new Date(value) : null;
  const [selected, setSelected] = useState(initialDate);
  const [viewDate, setViewDate] = useState(initialDate || new Date());
  const [hour, setHour] = useState(initialDate ? initialDate.getHours() : 12);
  const [minute, setMinute] = useState(initialDate ? initialDate.getMinutes() : 0);

  const compute = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;

    let top = 'auto', bottom = 'auto', maxHeight = MAX_H;
    if (below >= MAX_H || below >= above) {
      top = r.bottom + GAP;
      maxHeight = Math.max(MIN_H, Math.min(MAX_H, below));
    } else {
      bottom = vh - r.top + GAP;
      maxHeight = Math.max(MIN_H, Math.min(MAX_H, above));
    }
    let left = r.left;
    if (left + POPUP_W > vw - EDGE) left = vw - POPUP_W - EDGE;
    if (left < EDGE) left = EDGE;
    setPos({ top, bottom, left, maxHeight });
  }, []);

  useEffect(() => {
    if (!open) return;
    compute();
    const h = () => compute();
    window.addEventListener('resize', h);
    window.addEventListener('scroll', h, true);
    return () => { window.removeEventListener('resize', h); window.removeEventListener('scroll', h, true); };
  }, [open, compute]);

  useEffect(() => {
    if (!open) return;
    const down = (e) => {
      const inW = wrapperRef.current && wrapperRef.current.contains(e.target);
      const inP = popupRef.current && popupRef.current.contains(e.target);
      if (!inW && !inP) setOpen(false);
    };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      setSelected(d); setViewDate(d);
      setHour(d.getHours()); setMinute(d.getMinutes());
    } else { setSelected(null); }
  }, [value]);

  const pad = (n) => String(n).padStart(2, '0');
  const monthName = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isSameDay = (a, b) =>
    a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const isToday = (d) => {
    const t = new Date();
    return d && t.getFullYear() === viewDate.getFullYear() && t.getMonth() === viewDate.getMonth() && t.getDate() === d;
  };

  const commit = (d, h, m) => {
    if (!d) return;
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
    onChange(`${dd.getFullYear()}-${pad(dd.getMonth() + 1)}-${pad(dd.getDate())}T${pad(dd.getHours())}:${pad(dd.getMinutes())}`);
  };

  const pickDay = (d) => { const nd = new Date(viewDate.getFullYear(), viewDate.getMonth(), d); setSelected(nd); commit(nd, hour, minute); };
  const pickHour = (h) => { const v = Math.max(0, Math.min(23, h || 0)); setHour(v); if (selected) commit(selected, v, minute); };
  const pickMinute = (m) => { const v = Math.max(0, Math.min(59, m || 0)); setMinute(v); if (selected) commit(selected, hour, v); };
  const handleToday = () => { const t = new Date(); setSelected(t); setViewDate(t); setHour(t.getHours()); setMinute(t.getMinutes()); commit(t, t.getHours(), t.getMinutes()); };
  const handleClear = () => { setSelected(null); onChange(''); };

  const applyQuick = (preset) => {
    const now = new Date();
    let t = new Date(now);
    if (preset === '1h') t.setHours(now.getHours() + 1);
    else if (preset === '12h') t.setHours(now.getHours() + 12);
    else if (preset === 'today') t.setHours(23, 59, 59);
    else if (preset === '2d') t.setDate(now.getDate() + 2);
    else if (preset === '1w') t.setDate(now.getDate() + 7);
    else if (preset === '2w') t.setDate(now.getDate() + 14);
    else if (preset === '1m') t.setMonth(now.getMonth() + 1);
    setSelected(t); setViewDate(t);
    setHour(t.getHours()); setMinute(t.getMinutes());
    commit(t, t.getHours(), t.getMinutes());
  };

  const display = selected
    ? `${selected.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${pad(hour)}:${pad(minute)}`
    : '';

  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-left text-gray-700 dark:text-gray-300 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        <span className={`truncate ${display ? '' : 'text-gray-400 dark:text-gray-500'}`}>{display || placeholder}</span>
        <FaCalendarAlt className="text-gray-400 text-xs shrink-0" />
      </button>

      {open && !disabled && createPortal(
        <div
          ref={popupRef}
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: POPUP_W, maxHeight: pos.maxHeight }}
          className="fixed z-[120] bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-gray-800/60 rounded-2xl shadow-2xl p-3 overflow-y-auto"
        >
          {showShortcuts && (
            <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-800/60">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500 mb-1.5">Quick</div>
              <div className="flex flex-wrap gap-1">
                {QUICK_DUE_SHORTCUTS.map(([k, l]) => (
                  <button key={k} type="button" onClick={() => applyQuick(k)} className="px-2 py-1 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 transition">{l}</button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-[#0d9488] hover:bg-teal-500/10 rounded-lg transition"><FaAngleLeft className="text-xs" /></button>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{monthName}</span>
            <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-[#0d9488] hover:bg-teal-500/10 rounded-lg transition"><FaAngleRight className="text-xs" /></button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {weekdays.map((w) => (<div key={w} className="text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 py-1">{w}</div>))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const cellDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
              const isSel = isSameDay(selected, cellDate);
              const isTod = isToday(d);
              return (
                <button key={i} type="button" onClick={() => pickDay(d)}
                  className={`aspect-square text-xs rounded-lg transition flex items-center justify-center ${
                    isSel ? 'bg-teal-600 dark:bg-[#0d9488] text-white font-semibold shadow-sm'
                    : isTod ? 'text-teal-600 dark:text-[#0d9488] font-semibold hover:bg-teal-500/10'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60'
                  }`}>{d}</button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800/60">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wide flex-1">Time</span>
              <div className="flex items-center gap-1">
                <input type="number" min={0} max={23} value={pad(hour)} onChange={(e) => pickHour(parseInt(e.target.value, 10))} className="w-12 px-1.5 py-1 text-center text-sm bg-gray-50 dark:bg-[#0b0b10] border border-gray-200 dark:border-gray-800/60 rounded-lg text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 dark:focus:border-[#0d9488]" />
                <span className="text-gray-400 text-sm">:</span>
                <input type="number" min={0} max={59} value={pad(minute)} onChange={(e) => pickMinute(parseInt(e.target.value, 10))} className="w-12 px-1.5 py-1 text-center text-sm bg-gray-50 dark:bg-[#0b0b10] border border-gray-200 dark:border-gray-800/60 rounded-lg text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 dark:focus:border-[#0d9488]" />
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-800/60 flex items-center gap-1">
            <button type="button" onClick={handleToday} className="flex-1 text-xs py-1.5 text-teal-600 dark:text-[#0d9488] font-medium rounded-lg hover:bg-teal-500/10 transition">Today</button>
            <button type="button" onClick={handleClear} className="flex-1 text-xs py-1.5 text-gray-500 dark:text-gray-400 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/60 transition">Clear</button>
            <button type="button" onClick={() => setOpen(false)} className="flex-1 text-xs py-1.5 text-white font-medium rounded-lg transition hover:opacity-90 bg-teal-600 dark:bg-[#0d9488]">Done</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ─── Bottom Sheet ───────────────────────────────────────────────
const BottomSheet = ({ isOpen, onClose, children }) => {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else if (visible) {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen, visible]);
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: animating ? 1 : 0.9, opacity: animating ? 1 : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
};

// ─── generic confirm dialog ─────────────────────────────────────
const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, danger }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          {danger && <FaExclamationTriangle className="text-red-500 text-xl" />}
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30">Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`flex-1 py-2 text-white rounded-xl text-sm font-medium ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 dark:bg-[#0d9488] hover:opacity-90'}`}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

// ─── type-to-confirm delete ─────────────────────────────────────
const DeleteTaskDialog = ({ isOpen, onClose, onConfirm, taskName }) => {
  const [val, setVal] = useState('');
  const phrase = `I want to delete ${taskName}`;
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <FaExclamationTriangle className="text-red-500 text-xl" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Delete Task</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Type the following to confirm:</p>
        <div className="bg-gray-100 dark:bg-[#0b0b10] p-3 rounded-xl border border-gray-300 dark:border-gray-700/60 mb-3">
          <code className="text-sm text-gray-800 dark:text-gray-200 font-mono">{phrase}</code>
        </div>
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Type the phrase above" className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none mb-4" />
        <div className="flex gap-3">
          <button onClick={() => { onClose(); setVal(''); }} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400">Cancel</button>
          <button onClick={() => { if (val === phrase) { onConfirm(); onClose(); setVal(''); } else toast.error('Type the exact phrase.'); }} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium">Delete</button>
        </div>
      </div>
    </div>
  );
};

// ─── Task Action Modal ──────────────────────────────────────────
const TaskActionModal = ({
  isOpen, onClose, task, viewer, isTrash, isArchivedForMe,
  onEdit, onCopy, onMove, onDelete, onArchive, onRestore,
  onPermanentDelete, onSelect, onMarkComplete, onMarkInProgress,
  brandColor,
}) => {
  if (!isOpen || !task) return null;

  const canManage = !!viewer?.canManage;
  const canAct = !!viewer?.canAct;
  const taskAccess = task.access || {};
  const taskCanManage = taskAccess.canManage ?? canManage;
  const taskCanComplete = taskAccess.canComplete ?? (canAct && task.assignedToMe);
  const isCompleted = task.status === 'completed' || task.status === 'confirmed_completed';

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-6 space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white break-words">{task.title}</h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <StatusPill status={task.status} />
            <PriorityPill priority={task.priority} />
            {task.assignedToMe && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
                <FaUser className="text-[8px]" /> Assigned to you
              </span>
            )}
            {isTrash && <span className="inline-flex items-center gap-1 text-xs text-red-500"><FaTrashAlt className="text-[10px]" /> In Trash</span>}
            {isArchivedForMe && <span className="inline-flex items-center gap-1 text-xs text-gray-500"><FaArchive className="text-[10px]" /> Archived</span>}
          </div>
        </div>

        {isTrash ? (
          <div className="grid grid-cols-2 gap-2">
            {canManage && (
              <>
                <button onClick={() => { onRestore(task._id); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition"><FaUndo /> Restore</button>
                <button onClick={() => { onPermanentDelete(task); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition"><FaTrashAlt /> Delete Forever</button>
                <button onClick={() => { onSelect(task._id); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition col-span-2"><FaMousePointer className="text-xs" /> Select</button>
              </>
            )}
            {!canManage && (<p className="col-span-2 text-center text-sm text-gray-500 dark:text-gray-400 py-3">You don't have permission to act on this task.</p>)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {taskCanManage && (<button onClick={() => { onEdit(task); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-3 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/30 transition"><FaEdit /> Edit</button>)}
            {!isArchivedForMe && !isCompleted && taskCanComplete && onMarkComplete && (<button onClick={() => { onMarkComplete(task._id); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition"><FaCheck /> Complete</button>)}
            {!isArchivedForMe && isCompleted && taskCanManage && onMarkInProgress && (<button onClick={() => { onMarkInProgress(task._id); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition"><FaUndo /> Reopen</button>)}
            {taskCanManage && !isArchivedForMe && (<button onClick={() => { onCopy(task); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-[#333] transition"><FaCopy /> Copy</button>)}
            {taskCanManage && !isArchivedForMe && (<button onClick={() => { onMove(task); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition"><FaFolderOpen /> Move</button>)}
            {taskCanManage && (<button onClick={() => { onSelect(task._id); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition"><FaMousePointer className="text-xs" /> Select</button>)}
            {isArchivedForMe ? (
              <button onClick={() => { onRestore(task._id); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition"><FaUndo /> Restore</button>
            ) : (
              <button onClick={() => { onArchive(task._id); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"><FaArchive /> Archive</button>
            )}
            {taskCanManage && (<button onClick={() => { onDelete(task); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition"><FaTrashAlt /> Delete</button>)}
          </div>
        )}

        <button onClick={onClose} className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition">Cancel</button>
      </div>
    </BottomSheet>
  );
};

// ─── Bulk Toolbar ───────────────────────────────────────────────
const BulkToolbar = ({ selectedCount, onCancel, onComplete, onDelete }) => (
  <motion.div
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.2 }}
    className="bg-gray-100 dark:bg-[#1a1a24] px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-800/60"
  >
    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <span className="font-semibold">{selectedCount}</span> selected
    </div>
    <div className="flex flex-wrap items-center gap-1.5">
      <button onClick={onComplete} className="px-2.5 sm:px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition flex items-center gap-1"><FaCheckDouble className="text-[10px]" /> Done</button>
      <button onClick={onDelete} className="px-2.5 sm:px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition flex items-center gap-1"><FaTrashAlt className="text-[10px]" /> Delete</button>
      <button onClick={onCancel} className="px-2.5 sm:px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition">Cancel</button>
    </div>
  </motion.div>
);

// ─── View Toggle ────────────────────────────────────────────────
const ViewToggle = ({ view, onChange }) => (
  <div className="inline-flex rounded-lg bg-gray-100 dark:bg-[#1e1e26] p-0.5 border border-gray-200 dark:border-gray-700/60">
    <button onClick={() => onChange('grid')} className={`px-2 py-1 rounded-md text-xs transition flex items-center gap-1 ${view === 'grid' ? 'bg-white dark:bg-[#14141a] text-teal-600 dark:text-[#0d9488] shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`} title="Grid view"><FaThLarge className="text-[10px]" /></button>
    <button onClick={() => onChange('list')} className={`px-2 py-1 rounded-md text-xs transition flex items-center gap-1 ${view === 'list' ? 'bg-white dark:bg-[#14141a] text-teal-600 dark:text-[#0d9488] shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`} title="List view"><FaList className="text-[10px]" /></button>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// Task Card
// ═══════════════════════════════════════════════════════════════
const TaskCard = React.memo(({
  task, view = 'grid', brandColor, onClick, onOpenModal,
  draggable, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, dragOver,
  onCopy, onMove, isSelected = false, onLongPress, isTouch, selectionMode, onTap,
  allowSelection = true,
}) => {
  const progress = task.progress || 0;
  const subCount = task.subTasks?.length || 0;
  const confirmed = (task.subTasks || []).filter((s) => s.status === 'confirmed').length;
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due && due < new Date() && !['completed', 'confirmed_completed', 'cancelled'].includes(task.status);
  const assignees = task.assignees || [];
  const hasRecurrence = task.recurrenceType && task.recurrenceType !== 'none';
  const isCompleted = task.status === 'completed' || task.status === 'confirmed_completed';
  const linkedNotesCount = (task.linkedNotes || []).length;
  const assignedToMe = !!task.assignedToMe;

  const lastTap = useRef(0);
  const longPressTimer = useRef(null);

  const handleTouchStart = (e) => {
    if (!allowSelection) return;
    if (e.target.closest('.task-menu-btn') || e.target.closest('.task-grip')) return;
    longPressTimer.current = setTimeout(() => { if (onLongPress) onLongPress(task._id); }, 500);
  };
  const handleTouchEnd = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } };
  const handleTouchMove = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } };

  const handleClick = (e) => {
    if (e.target.closest('.task-menu-btn') || e.target.closest('.task-grip')) return;
    if (selectionMode && allowSelection) { onTap?.(task._id); return; }
    if (isTouch) {
      const now = Date.now();
      const diff = now - lastTap.current;
      if (diff < 300 && diff > 0) { onOpenModal(task); lastTap.current = 0; return; }
      lastTap.current = now;
      setTimeout(() => { if (lastTap.current === now) { onClick(task); lastTap.current = 0; } }, 300);
    } else {
      onClick(task);
    }
  };

  const handleContextMenu = (e) => { e.preventDefault(); if (selectionMode) return; onOpenModal(task); };

  const gripProps = draggable
    ? { onDragStart: (ev) => { ev.dataTransfer.setData('text/plain', task._id); onDragStart?.(ev, task); } }
    : {};

  if (view === 'list') {
    return (
      <div
        draggable={draggable}
        {...gripProps}
        onDragEnd={onDragEnd}
        onDragOver={(e) => { e.preventDefault(); onDragOver?.(e, task); }}
        onDrop={(e) => { e.preventDefault(); onDrop?.(e, task); }}
        onDragLeave={onDragLeave}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className={`border-b border-gray-100 dark:border-gray-800 px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer transition ${
          dragOver ? 'bg-teal-50/60 dark:bg-[#0d9488]/10' : 'hover:bg-gray-50 dark:hover:bg-[#1e1e1e]'
        } ${isSelected ? 'bg-teal-50/70 dark:bg-teal-900/30' : ''}`}
      >
        <div className="flex items-start gap-2 sm:gap-3 w-full">
          {draggable && (<div className="task-grip flex-shrink-0 text-gray-400 p-1 -ml-1 mt-0.5 touch-none cursor-grab"><FaGripVertical className="text-sm" /></div>)}
          <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5" title={task.status}>
            <span className="w-2.5 h-2.5 rounded-full ring-2 ring-offset-1 ring-offset-white dark:ring-offset-[#0f0f12]" style={{ backgroundColor: STATUS_DOT[task.status] || '#9ca3af', '--tw-ring-color': `${STATUS_DOT[task.status] || '#9ca3af'}33` }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1 sm:gap-2">
              <span className={`text-sm font-medium break-words flex-1 min-w-0 ${isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-white'}`}>{task.title}</span>
              {assignedToMe && <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 shrink-0">You</span>}
              {hasRecurrence && <FaRedo className="text-[10px] text-teal-500 flex-shrink-0 mt-1" />}
              {linkedNotesCount > 0 && (<span className="inline-flex items-center gap-0.5 text-[10px] text-teal-600 dark:text-[#0d9488] flex-shrink-0 mt-0.5" title={`${linkedNotesCount} linked note(s)`}><FaStickyNote className="text-[10px]" /> {linkedNotesCount}</span>)}
              {overdue && <FaExclamationCircle className="text-xs text-red-500 flex-shrink-0 mt-0.5" />}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
              <StatusPill status={task.status} />
              <PriorityPill priority={task.priority} />
              {subCount > 0 && <span>{confirmed}/{subCount} done</span>}
              {task.folder?.name && (<span className="flex items-center gap-1"><FaFolder className="text-[9px]" style={{ color: task.folder.color || undefined }} /> {task.folder.name}</span>)}
              {due && <span className={overdue ? 'text-red-500' : ''}>{fmtShortDate(task.dueDate)}</span>}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              {assignees.length === 0 ? (<span className="text-[11px] text-gray-400 dark:text-gray-500">Unassigned</span>) : (
                <>
                  <div className="flex -space-x-1.5 shrink-0">
                    {assignees.slice(0, 4).map((a, i) => (
                      <div key={a._id || i} className="w-5 h-5 rounded-full border border-white dark:border-[#14141a] flex items-center justify-center text-white text-[9px] font-semibold overflow-hidden" style={{ backgroundColor: brandColor }}>
                        {a.profile ? <img src={a.profile} className="w-full h-full object-cover" alt="" /> : (a.name || '?').charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {assignees.length > 4 && (<div className="w-5 h-5 rounded-full border border-white dark:border-[#14141a] flex items-center justify-center bg-gray-500 text-white text-[8px]">+{assignees.length - 4}</div>)}
                  </div>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{assignees.length === 1 ? assignees[0].name : `${assignees.length} assignees`}</span>
                </>
              )}
              <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-800/60 rounded-full overflow-hidden ml-2 min-w-[40px] max-w-[120px]"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: brandColor }} /></div>
              <span className="text-[10px] font-mono text-gray-400">{progress}%</span>
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); onOpenModal(task); }} className="task-menu-btn md:hidden p-1.5 text-gray-400 hover:text-teal-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition" aria-label="More actions"><FaAngleDown className="text-sm" /></button>
            <button onClick={(e) => { e.stopPropagation(); onOpenModal(task); }} className="task-menu-btn hidden md:flex p-1.5 text-gray-400 hover:text-teal-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition" aria-label="More actions"><FaEllipsisV className="text-sm" /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable={draggable}
      {...gripProps}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(e, task); }}
      onDrop={(e) => { e.preventDefault(); onDrop?.(e, task); }}
      onDragLeave={onDragLeave}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      className={`group bg-white dark:bg-[#14141a] rounded-2xl border p-2.5 sm:p-4 cursor-pointer transition-all ${
        dragOver ? 'border-teal-500 dark:border-[#0d9488] bg-teal-50/50 dark:bg-[#0d9488]/5' : 'border-gray-200/60 dark:border-gray-800/40 hover:border-teal-500/60 dark:hover:border-[#0d9488]/50'
      } ${isSelected ? 'ring-2 ring-teal-500/50 dark:ring-[#0d9488]/50 bg-teal-50/70 dark:bg-teal-900/30' : ''}`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-start gap-1.5 sm:gap-2 min-w-0 flex-1">
          {draggable && <FaGripVertical className="task-grip text-gray-300 dark:text-gray-700 text-xs shrink-0 mt-1.5 touch-none cursor-grab hidden sm:block" />}
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold text-[11px] sm:text-sm shrink-0" style={{ backgroundColor: brandColor }}>{task.title.charAt(0).toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <h4 className={`text-xs sm:text-sm font-medium break-words min-w-0 ${isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
              {task.title}
              {hasRecurrence && <FaRedo className="inline text-[9px] sm:text-[10px] text-teal-600 dark:text-[#0d9488] ml-1 -mt-0.5" />}
              {linkedNotesCount > 0 && (<span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] text-teal-600 dark:text-[#0d9488] ml-1" title={`${linkedNotesCount} linked note(s)`}><FaStickyNote className="text-[9px] sm:text-[10px]" /> {linkedNotesCount}</span>)}
            </h4>
            {assignedToMe && (<span className="inline-flex items-center gap-1 mt-1 text-[8px] sm:text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400"><FaUser className="text-[7px]" /> You</span>)}
          </div>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onOpenModal(task); }} className="task-menu-btn md:hidden p-1 text-gray-400 hover:text-teal-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition" aria-label="More actions"><FaAngleDown className="text-xs" /></button>
          <button onClick={(e) => { e.stopPropagation(); onOpenModal(task); }} className="task-menu-btn hidden md:flex p-1.5 text-gray-400 hover:text-teal-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition" aria-label="More actions"><FaEllipsisV className="text-sm" /></button>
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-1 flex-wrap"><StatusPill status={task.status} /></div>

      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        <PriorityPill priority={task.priority} />
        {subCount > 0 && <span className="text-[9px] sm:text-[10px] text-gray-500">• {confirmed}/{subCount} done</span>}
        {overdue && <span className="text-[9px] sm:text-[10px] text-red-500 flex items-center gap-1"><FaClock className="text-[8px]" /> Overdue</span>}
        {task.folder?.name && (<span className="text-[9px] sm:text-[10px] text-gray-500 flex items-center gap-1 truncate max-w-[80px]"><FaFolder className="text-[8px] shrink-0" /> {task.folder.name}</span>)}
      </div>

      <div className="mt-2 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {assignees.length === 0 ? (<span className="text-[10px] sm:text-xs text-gray-500 truncate">Unassigned</span>) : (
            <>
              <div className="flex -space-x-1.5 shrink-0">
                {assignees.slice(0, 2).map((a, i) => (
                  <div key={a._id || i} className="w-5 h-5 rounded-full border border-white dark:border-[#14141a] flex items-center justify-center text-white text-[9px] font-semibold overflow-hidden" style={{ backgroundColor: brandColor }}>
                    {a.profile ? <img src={a.profile} className="w-full h-full object-cover" alt="" /> : (a.name || '?').charAt(0).toUpperCase()}
                  </div>
                ))}
                {assignees.length > 2 && (<div className="w-5 h-5 rounded-full border border-white dark:border-[#14141a] flex items-center justify-center bg-gray-500 text-white text-[8px]">+{assignees.length - 2}</div>)}
              </div>
              <span className="text-[10px] sm:text-xs text-gray-500 truncate">{assignees.length === 1 ? assignees[0].name : `${assignees.length} assignees`}</span>
            </>
          )}
        </div>
        <span className="text-[10px] sm:text-xs text-gray-500 shrink-0">{fmtShortDate(task.dueDate) || 'No due'}</span>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800/60 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: brandColor }} /></div>
        <span className="text-[10px] sm:text-xs font-mono text-gray-400">{progress}%</span>
      </div>
    </div>
  );
});

// ─── Notes Picker Modal ─────────────────────────────────────────
const NotesPickerModal = ({ isOpen, onClose, workspaceId, alreadySelected, onConfirm }) => {
  const [stage, setStage] = useState('source');
  const [draft, setDraft] = useState([]);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickContent, setQuickContent] = useState('');
  const [createNote, { isLoading: creatingQuickNote }] = useCreateNoteMutation();

  const { data: pData, isLoading: pLoading } = useGetNotesQuery(undefined, { skip: !isOpen || stage !== 'personal' });
  const { data: wData, isLoading: wLoading } = useGetWorkspaceNotesQuery(workspaceId, { skip: !isOpen || stage !== 'workspace' || !workspaceId });

  const personalNotes = pData?.notes || [];
  const workspaceNotes = wData?.notes || [];

  useEffect(() => {
    if (isOpen) {
      setDraft(Array.isArray(alreadySelected) ? alreadySelected : []);
      setStage('source');
      setQuickTitle('');
      setQuickContent('');
    }
  }, [isOpen]);

  const isPicked = (noteId, source) => draft.some((d) => String(d.noteId) === String(noteId) && d.source === source);
  const toggleNote = (note, source) => {
    if (isPicked(note._id, source)) setDraft((prev) => prev.filter((d) => !(String(d.noteId) === String(note._id) && d.source === source)));
    else setDraft((prev) => [...prev, { noteId: note._id, source, title: note.title }]);
  };

  const handleSaveQuickNote = async () => {
    if (!quickTitle.trim()) { toast.error('Give your note a title'); return; }
    try {
      const res = await createNote({ title: quickTitle.trim(), content: quickContent.trim() || 'Write your note here...' }).unwrap();
      const newNote = res.note;
      const newEntry = { noteId: newNote._id, source: 'personal', title: newNote.title };
      const next = [...draft.filter((d) => !(String(d.noteId) === String(newNote._id) && d.source === 'personal')), newEntry];
      setDraft(next);
      onConfirm(next);
      toast.success('Quick note created');
      onClose();
    } catch (err) { toast.error(err?.data?.message || 'Failed to create note'); }
  };

  if (!isOpen) return null;

  const renderNotesList = (notes, source, loading) => (
    <div className="space-y-2">
      {loading && (<div className="flex items-center justify-center py-10"><FaSpinner className="animate-spin text-teal-500 text-xl" /></div>)}
      {!loading && notes.length === 0 && (
        <div className="text-center py-10">
          <FaStickyNote className="text-3xl text-gray-300 dark:text-gray-700 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-500">{source === 'personal' ? 'No personal notes yet' : 'No workspace notes yet'}</p>
        </div>
      )}
      {!loading && notes.map((n) => {
        const checked = isPicked(n._id, source);
        return (
          <button key={n._id} type="button" onClick={() => toggleNote(n, source)}
            className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl border transition ${checked ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-300 dark:border-[#0d9488]/50' : 'bg-white dark:bg-[#0f0f12] border-gray-200 dark:border-gray-800/60 hover:border-gray-300 dark:hover:border-gray-700'}`}>
            <span className={`w-4 h-4 mt-0.5 flex items-center justify-center border rounded shrink-0 ${checked ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-400 dark:border-gray-600'}`}>
              {checked && <FaCheck className="text-[8px]" />}
            </span>
            <span className="min-w-0 flex-1">
              <p className={`text-sm font-medium truncate ${checked ? 'text-teal-700 dark:text-[#14b8a6]' : 'text-gray-800 dark:text-gray-200'}`}>{n.title || 'Untitled'}</p>
              {n.content && (<p className="text-[11px] text-gray-500 dark:text-gray-500 truncate mt-0.5">{n.content.replace(/\s+/g, ' ').trim().slice(0, 80)}{n.content.length > 80 ? '…' : ''}</p>)}
            </span>
          </button>
        );
      })}
    </div>
  );

  const headerTitle = stage === 'source' ? 'Add from notes' : stage === 'workspace' ? 'Workspace notes' : stage === 'personal' ? 'Personal notes' : 'Quick note';

  return (
    <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg flex flex-col max-h-[88vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="flex items-center gap-2 min-w-0">
            {stage !== 'source' && (<button onClick={() => setStage('source')} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/40 rounded-lg transition" title="Back"><FaArrowLeft className="text-xs" /></button>)}
            <FaStickyNote className="text-teal-600 dark:text-[#0d9488] text-sm shrink-0" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{headerTitle}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes className="text-sm" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {stage === 'source' && (
            <div className="space-y-2">
              <button type="button" onClick={() => setStage('workspace')} className="w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border border-gray-200 dark:border-gray-800/60 hover:border-teal-400 dark:hover:border-[#0d9488]/50 hover:bg-teal-50/40 dark:hover:bg-[#0d9488]/5 transition text-left">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-[#0d9488]/15 flex items-center justify-center shrink-0"><FaUsers className="text-teal-600 dark:text-[#0d9488]" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Workspace notes</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">Team-shared notes from this workspace</p>
                </div>
                <FaChevronRight className="text-xs text-gray-400 self-center shrink-0" />
              </button>
              <button type="button" onClick={() => setStage('personal')} className="w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border border-gray-200 dark:border-gray-800/60 hover:border-teal-400 dark:hover:border-[#0d9488]/50 hover:bg-teal-50/40 dark:hover:bg-[#0d9488]/5 transition text-left">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-[#0d9488]/15 flex items-center justify-center shrink-0"><FaUser className="text-teal-600 dark:text-[#0d9488]" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Personal notes</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">Your private notes — only you can see them</p>
                </div>
                <FaChevronRight className="text-xs text-gray-400 self-center shrink-0" />
              </button>
              <button type="button" onClick={() => setStage('quicknote')} className="w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border border-dashed border-teal-400/60 dark:border-[#0d9488]/50 hover:border-teal-500 dark:hover:border-[#0d9488] hover:bg-teal-50/40 dark:hover:bg-[#0d9488]/5 transition text-left">
                <div className="w-10 h-10 rounded-xl bg-teal-600 dark:bg-[#0d9488] flex items-center justify-center shrink-0"><FaFeather className="text-white text-sm" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Quick note</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">Jot something down now — saves as a personal note</p>
                </div>
                <FaChevronRight className="text-xs text-gray-400 self-center shrink-0" />
              </button>
            </div>
          )}

          {stage === 'workspace' && renderNotesList(workspaceNotes, 'workspace', wLoading)}
          {stage === 'personal' && renderNotesList(personalNotes, 'personal', pLoading)}

          {stage === 'quicknote' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title *</label>
                <input value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} placeholder="e.g. Site inspection notes" autoFocus className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 dark:focus:border-[#0d9488]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Content</label>
                <textarea value={quickContent} onChange={(e) => setQuickContent(e.target.value)} rows={6} placeholder="Write whatever you need…" className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 dark:focus:border-[#0d9488] resize-none" />
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-500">Saved as a personal note and immediately linked to this task.</p>
            </div>
          )}
        </div>

        {stage === 'quicknote' ? (
          <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
            <button type="button" onClick={() => setStage('source')} className="px-4 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Back</button>
            <button type="button" onClick={handleSaveQuickNote} disabled={creatingQuickNote || !quickTitle.trim()} className="flex-1 px-4 py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
              {creatingQuickNote ? <><FaSpinner className="animate-spin text-xs" /> Creating…</> : <><FaCheck className="text-xs" /> Save & link</>}
            </button>
          </div>
        ) : stage !== 'source' ? (
          <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
            <span className="text-xs text-gray-500 dark:text-gray-500 mr-auto">{draft.length} selected</span>
            <button type="button" onClick={() => setStage('source')} className="px-4 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Back</button>
            <button type="button" onClick={() => { onConfirm(draft); onClose(); }} className="px-4 py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl text-sm font-medium hover:opacity-90 transition">Add {draft.length > 0 ? `(${draft.length})` : ''}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ─── Recurrence Field ────────────────────────────────────────────
const RecurrenceField = ({ recurrenceType, setRecurrenceType, recurrenceDays, setRecurrenceDays, recurrenceEndDate, setRecurrenceEndDate, brandColor }) => {
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <div className="bg-gray-50 dark:bg-[#0b0b10] border border-gray-200 dark:border-gray-800/60 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5"><FaRedo className="text-[10px] text-teal-600 dark:text-[#0d9488]" /> Repeat task</label>
        <button
          type="button" role="switch" aria-checked={recurrenceType !== 'none'}
          onClick={() => { if (recurrenceType === 'none') setRecurrenceType('daily'); else { setRecurrenceType('none'); setRecurrenceDays([]); setRecurrenceEndDate(''); } }}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${recurrenceType !== 'none' ? '' : 'bg-gray-300 dark:bg-gray-700'}`}
          style={recurrenceType !== 'none' ? { backgroundColor: brandColor } : undefined}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${recurrenceType !== 'none' ? 'translate-x-[1.15rem]' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {recurrenceType !== 'none' && (
        <>
          <div className="flex gap-2">
            {['daily', 'weekly'].map((opt) => {
              const active = recurrenceType === opt;
              return (
                <button key={opt} type="button" onClick={() => { setRecurrenceType(opt); if (opt !== 'weekly') setRecurrenceDays([]); }}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${active ? 'text-white border-transparent shadow-sm' : 'bg-white dark:bg-[#14141a] text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700/60 hover:border-gray-400 dark:hover:border-gray-600'}`}
                  style={active ? { backgroundColor: brandColor } : undefined}
                >{opt === 'daily' ? 'Daily' : 'Weekly'}</button>
              );
            })}
          </div>

          {recurrenceType === 'weekly' && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-500 mb-1.5">On these days</p>
              <div className="flex flex-wrap gap-1.5">
                {weekDays.map((d, i) => {
                  const on = recurrenceDays.includes(i);
                  return (
                    <button key={i} type="button" onClick={() => setRecurrenceDays(on ? recurrenceDays.filter((x) => x !== i) : [...recurrenceDays, i].sort())}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${on ? 'text-white border-transparent shadow-sm' : 'bg-white dark:bg-[#14141a] text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700/60 hover:border-gray-400 dark:hover:border-gray-600'}`}
                      style={on ? { backgroundColor: brandColor } : undefined}
                    >{d}</button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ends on <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label>
            <CustomDateTimePicker value={recurrenceEndDate} onChange={setRecurrenceEndDate} placeholder="Pick end date" />
          </div>
        </>
      )}
    </div>
  );
};

// ─── Notes Field ────────────────────────────────────────────────
const NotesField = ({ linkedNotes, onRemove, onOpenPicker }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaStickyNote className="inline mr-1 text-teal-600 dark:text-[#0d9488]" /> Notes</label>
    <div className="space-y-2">
      {linkedNotes.map((n) => (
        <div key={`${n.source}:${n.noteId}`} className="flex items-center gap-2 bg-teal-50/60 dark:bg-[#0d9488]/10 border border-teal-200/60 dark:border-[#0d9488]/30 rounded-xl px-3 py-2">
          {n.source === 'workspace' ? <FaUsers className="text-teal-600 dark:text-[#0d9488] text-xs shrink-0" /> : <FaUser className="text-teal-600 dark:text-[#0d9488] text-xs shrink-0" />}
          <span className="text-sm truncate flex-1 text-gray-800 dark:text-gray-200">{n.title || 'Untitled'}</span>
          <button type="button" onClick={() => onRemove(n.noteId, n.source)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded p-1 transition" title="Remove"><FaTimes className="text-[10px]" /></button>
        </div>
      ))}
      <button type="button" onClick={onOpenPicker} className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-[#0d9488] rounded-lg text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/30 transition">
        <FaPlus className="text-[10px]" /> Add from notes
      </button>
    </div>
  </div>
);

// ─── Folder Field ───────────────────────────────────────────────
const FolderField = ({ projectId, folderId, setFolderId, folders, onFolderCreated }) => {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [createFolder, { isLoading }] = useCreateFolderMutation();

  const folderOpts = [
    { value: '', label: 'No Folder', icon: <FaFolderOpen className="text-gray-400" /> },
    ...folders.map((f) => ({ value: f._id, label: f.name, icon: <FaFolder className="text-gray-400" /> })),
  ];

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Folder name required'); return; }
    try {
      const res = await createFolder({ projectId, name: name.trim() }).unwrap();
      const newId = res?.folder?._id || res?._id;
      if (newId) setFolderId(newId);
      setName(''); setCreating(false);
      onFolderCreated?.();
      toast.success('Folder created');
    } catch (err) { toast.error(err?.data?.message || 'Failed to create folder'); }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Folder</label>
      {creating ? (
        <div className="flex items-center gap-1">
          <input value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } if (e.key === 'Escape') { setCreating(false); setName(''); } }}
            placeholder="New folder name" autoFocus
            className="flex-1 min-w-0 px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-teal-500 dark:border-[#0d9488] rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
          <button type="button" onClick={handleCreate} disabled={isLoading} className="p-2 rounded-xl bg-teal-600 dark:bg-[#0d9488] text-white disabled:opacity-50 hover:opacity-90 transition" title="Save folder">
            {isLoading ? <FaSpinner className="animate-spin text-xs" /> : <FaCheck className="text-xs" />}
          </button>
          <button type="button" onClick={() => { setCreating(false); setName(''); }} className="p-2 rounded-xl border border-gray-300 dark:border-gray-700/60 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/40 transition" title="Cancel">
            <FaTimes className="text-xs" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0"><Dropdown options={folderOpts} value={folderId} onChange={setFolderId} placeholder="Select folder" /></div>
          <button type="button" onClick={() => setCreating(true)} className="shrink-0 p-2 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-[#0d9488] hover:bg-teal-100 dark:hover:bg-teal-900/30 transition" title="Create new folder"><FaPlus className="text-xs" /></button>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Create Task Modal
// ═══════════════════════════════════════════════════════════════
const CreateTaskModal = ({ isOpen, onClose, projectId, workspaceId, brandColor, assignableMembers, folders, onSubmit, onFolderCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [linkedNotes, setLinkedNotes] = useState([]);
  const [notesPickerOpen, setNotesPickerOpen] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [folderId, setFolderId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recurrenceType, setRecurrenceType] = useState('none');
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [allowAssigneeEditSubtasks, setAllowAssigneeEditSubtasks] = useState(false);
  const [links, setLinks] = useState([]);
  const { files, pickMedia, setFiles } = useMediaPicker();
  const [loading, setLoading] = useState(false);

  const assigneeOpts = assignableMembers.map((m) => {
    const u = m.user || m;
    return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full object-cover" alt="" /> : <FaUser className="text-gray-400" /> };
  });

  const reset = () => {
    setTitle(''); setDescription(''); setAssigneeIds([]); setPriority('medium'); setStartDate(''); setDueDate('');
    setRecurrenceType('none'); setRecurrenceDays([]); setRecurrenceEndDate('');
    setAllowAssigneeEditSubtasks(false); setLinks([]); setFiles([]); setFolderId(''); setLinkedNotes([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title required'); return; }
    setLoading(true);
    try {
      await onSubmit({
        projectId, title: title.trim(), description, assigneeIds, priority,
        allowAssigneeEditSubtasks, startDate, dueDate, folderId, recurrenceType, recurrenceDays, recurrenceEndDate,
        links: links.map((l) => l.trim()).filter(Boolean),
        attachments: files,
        linkedNotes: linkedNotes.map(({ noteId, source }) => ({ noteId, source })),
      });
      reset(); onClose();
    } catch (err) { toast.error(err?.data?.message || 'Failed to create task'); }
    finally { setLoading(false); }
  };

  const addLink = () => setLinks((prev) => [...prev, '']);
  const updateLink = (i, v) => setLinks((prev) => { const n = [...prev]; n[i] = v; return n; });
  const removeLink = (i) => setLinks((prev) => prev.filter((_, idx) => idx !== i));
  const removeLinkedNote = (noteId, source) => setLinkedNotes((prev) => prev.filter((d) => !(String(d.noteId) === String(noteId) && d.source === source)));

  if (!isOpen) return null;
  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl">
          <div className="flex justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaTasks className="inline mr-1 text-teal-600 dark:text-[#0d9488]" /> New Task</h2>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg"><FaTimes /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none resize-none" />
            </div>
            <NotesField linkedNotes={linkedNotes} onRemove={removeLinkedNote} onOpenPicker={() => setNotesPickerOpen(true)} />
            <div className="grid grid-cols-2 gap-3">
              <MultiDropdown label="Assignees" options={assigneeOpts} values={assigneeIds} onChange={setAssigneeIds} placeholder="Select members..." />
              <FolderField projectId={projectId} folderId={folderId} setFolderId={setFolderId} folders={folders} onFolderCreated={onFolderCreated} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Dropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} />
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start</label>
                <CustomDateTimePicker value={startDate} onChange={setStartDate} placeholder="Pick start" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Due</label>
              <CustomDateTimePicker value={dueDate} onChange={setDueDate} placeholder="Pick due" showShortcuts />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <input type="checkbox" checked={allowAssigneeEditSubtasks} onChange={(e) => setAllowAssigneeEditSubtasks(e.target.checked)} className="accent-teal-600" /> Allow assignee to edit sub‑tasks
            </label>
            <RecurrenceField recurrenceType={recurrenceType} setRecurrenceType={setRecurrenceType} recurrenceDays={recurrenceDays} setRecurrenceDays={setRecurrenceDays} recurrenceEndDate={recurrenceEndDate} setRecurrenceEndDate={setRecurrenceEndDate} brandColor={brandColor} />
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaLink className="inline mr-1" />Links</label>
              <div className="space-y-2">
                {links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="text" value={link} onChange={(e) => updateLink(i, e.target.value)} placeholder="https://..." className="flex-1 px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
                    <button type="button" onClick={() => removeLink(i)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="Remove link"><FaTrashAlt className="text-xs" /></button>
                  </div>
                ))}
                <button type="button" onClick={addLink} className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-[#0d9488] rounded-lg text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/30 transition"><FaPlus className="text-[10px]" /> Add link</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaPaperclip className="inline mr-1" />Attachments</label>
              <button type="button" onClick={() => pickMedia({ multiple: true })} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#2a2a2a] hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300"><FaCamera className="text-xs" /> Choose Files</button>
              {files.length > 0 && files.map((f, i) => (
                <div key={i} className="flex justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5 mt-1">
                  <span className="text-sm truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                  <button type="button" onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-red-500"><FaTrashAlt className="text-xs" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium" style={{ backgroundColor: brandColor }}>{loading ? 'Creating...' : 'Create Task'}</button>
            </div>
          </form>
        </div>
      </div>
      <NotesPickerModal isOpen={notesPickerOpen} onClose={() => setNotesPickerOpen(false)} workspaceId={workspaceId} alreadySelected={linkedNotes} onConfirm={setLinkedNotes} />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════
// Edit Task Modal
// ═══════════════════════════════════════════════════════════════
const EditTaskModal = ({ isOpen, onClose, task, projectId, workspaceId, brandColor, assignableMembers, folders, onSubmit, onFolderCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [linkedNotes, setLinkedNotes] = useState([]);
  const [notesPickerOpen, setNotesPickerOpen] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [folderId, setFolderId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('pending');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recurrenceType, setRecurrenceType] = useState('none');
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [allowAssigneeEditSubtasks, setAllowAssigneeEditSubtasks] = useState(false);
  const [links, setLinks] = useState([]);
  const { files, pickMedia, setFiles } = useMediaPicker();
  const [loading, setLoading] = useState(false);

  const toLocalInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  useEffect(() => {
    if (!isOpen || !task) return;
    setTitle(task.title || '');
    setDescription(task.description || '');
    setAssigneeIds((task.assignees || []).map((a) => a._id || a).filter(Boolean).map(String));
    setPriority(task.priority || 'medium');
    setStatus(task.status || 'pending');
    setStartDate(toLocalInput(task.startDate));
    setDueDate(toLocalInput(task.dueDate));
    setAllowAssigneeEditSubtasks(!!task.allowAssigneeEditSubtasks);
    setLinks(Array.isArray(task.links) ? [...task.links] : []);
    setFolderId(task.folder?._id || task.folder || '');
    setRecurrenceType(task.recurrenceType || 'none');
    setRecurrenceDays(Array.isArray(task.recurrenceDays) ? [...task.recurrenceDays] : []);
    setRecurrenceEndDate(toLocalInput(task.recurrenceEndDate));
    setLinkedNotes((task.linkedNotes || []).map((ln) => ({ noteId: ln.note?._id || ln.note, source: ln.source, title: ln.note?.title || 'Untitled' })));
    setFiles([]);
  }, [isOpen, task]);

  const assigneeOpts = assignableMembers.map((m) => {
    const u = m.user || m;
    return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full object-cover" alt="" /> : <FaUser className="text-gray-400" /> };
  });
  const statusOpts = [
    { value: 'pending', label: 'Pending' }, { value: 'in-progress', label: 'In Progress' },
    { value: 'ready_for_completion', label: 'Ready for completion' },
    { value: 'completed', label: 'Completed' }, { value: 'confirmed_completed', label: 'Confirmed completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title required'); return; }
    setLoading(true);
    try {
      await onSubmit(task._id, {
        title: title.trim(), description, detailedDescription: task.detailedDescription || '',
        assigneeIds, priority, status,
        startDate: startDate || '', dueDate: dueDate || '',
        allowAssigneeEditSubtasks, folderId: folderId || null,
        recurrenceType, recurrenceDays: recurrenceType === 'weekly' ? recurrenceDays : [],
        recurrenceEndDate: recurrenceEndDate || '',
        links: links.map((l) => l.trim()).filter(Boolean),
        attachments: files,
        linkedNotes: linkedNotes.map(({ noteId, source }) => ({ noteId, source })),
      });
      onClose();
    } catch (err) { toast.error(err?.data?.message || 'Failed to update task'); }
    finally { setLoading(false); }
  };

  const addLink = () => setLinks((prev) => [...prev, '']);
  const updateLink = (i, v) => setLinks((prev) => { const n = [...prev]; n[i] = v; return n; });
  const removeLink = (i) => setLinks((prev) => prev.filter((_, idx) => idx !== i));
  const removeLinkedNote = (noteId, source) => setLinkedNotes((prev) => prev.filter((d) => !(String(d.noteId) === String(noteId) && d.source === source)));

  if (!isOpen || !task) return null;
  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl">
          <div className="flex justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaEdit className="inline mr-1 text-teal-600 dark:text-[#0d9488]" /> Edit Task</h2>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg"><FaTimes /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none resize-none" />
            </div>
            <NotesField linkedNotes={linkedNotes} onRemove={removeLinkedNote} onOpenPicker={() => setNotesPickerOpen(true)} />
            <div className="grid grid-cols-2 gap-3">
              <MultiDropdown label="Assignees" options={assigneeOpts} values={assigneeIds} onChange={setAssigneeIds} placeholder="Select members..." />
              <FolderField projectId={projectId} folderId={folderId} setFolderId={setFolderId} folders={folders} onFolderCreated={onFolderCreated} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Dropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} />
              <Dropdown label="Status" options={statusOpts} value={status} onChange={setStatus} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start</label>
                <CustomDateTimePicker value={startDate} onChange={setStartDate} placeholder="Pick start" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Due</label>
                <CustomDateTimePicker value={dueDate} onChange={setDueDate} placeholder="Pick due" showShortcuts />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <input type="checkbox" checked={allowAssigneeEditSubtasks} onChange={(e) => setAllowAssigneeEditSubtasks(e.target.checked)} className="accent-teal-600" /> Allow assignee to edit sub‑tasks
            </label>
            <RecurrenceField recurrenceType={recurrenceType} setRecurrenceType={setRecurrenceType} recurrenceDays={recurrenceDays} setRecurrenceDays={setRecurrenceDays} recurrenceEndDate={recurrenceEndDate} setRecurrenceEndDate={setRecurrenceEndDate} brandColor={brandColor} />
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaLink className="inline mr-1" />Links</label>
              <div className="space-y-2">
                {links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="text" value={link} onChange={(e) => updateLink(i, e.target.value)} placeholder="https://..." className="flex-1 px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
                    <button type="button" onClick={() => removeLink(i)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="Remove link"><FaTrashAlt className="text-xs" /></button>
                  </div>
                ))}
                <button type="button" onClick={addLink} className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-[#0d9488] rounded-lg text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/30 transition"><FaPlus className="text-[10px]" /> Add link</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaPaperclip className="inline mr-1" />Attachments</label>
              <button type="button" onClick={() => pickMedia({ multiple: true })} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#2a2a2a] hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300"><FaCamera className="text-xs" /> Choose Files</button>
              {files.length > 0 && files.map((f, i) => (
                <div key={i} className="flex justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5 mt-1">
                  <span className="text-sm truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                  <button type="button" onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-red-500"><FaTrashAlt className="text-xs" /></button>
                </div>
              ))}
              {(task.attachments || []).length > 0 && (<p className="text-[10px] text-gray-400 mt-1">{task.attachments.length} existing attachment(s) — selecting new files replaces them.</p>)}
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium" style={{ backgroundColor: brandColor }}>{loading ? 'Saving...' : 'Save changes'}</button>
            </div>
          </form>
        </div>
      </div>
      <NotesPickerModal isOpen={notesPickerOpen} onClose={() => setNotesPickerOpen(false)} workspaceId={workspaceId} alreadySelected={linkedNotes} onConfirm={setLinkedNotes} />
    </>
  );
};

// ─── Folder Form / Read-only / Move-Copy modals ────────────────
const FolderFormModal = ({ isOpen, onClose, onSuccess, folder, brandColor, projectId }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [createFolder] = useCreateFolderMutation();
  const [updateFolder] = useUpdateFolderMutation();
  useEffect(() => { setName(folder?.name || ''); }, [folder, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Folder name required'); return; }
    setLoading(true);
    try {
      if (folder) await updateFolder({ folderId: folder._id, name: name.trim() }).unwrap();
      else await createFolder({ projectId, name: name.trim() }).unwrap();
      toast.success(folder ? 'Folder updated' : 'Folder created');
      onSuccess(); onClose();
    } catch (err) { toast.error(err?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">{folder ? 'Edit Folder' : 'New Folder'}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400"><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" required />
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium" style={{ backgroundColor: brandColor }}>{loading ? 'Saving...' : folder ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const FolderReadOnlyModal = ({ isOpen, onClose, folder, project, brandColor, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [addReadOnly] = useAddFolderReadOnlyMutation();
  const [removeReadOnly] = useRemoveFolderReadOnlyMutation();
  const [selected, setSelected] = useState([]);
  useEffect(() => setSelected([]), [folder]);

  const activeTeam = (project?.teamMembers || []).filter((m) => m.status === 'active');
  const current = (folder?.readOnlyUsers || []).map((id) => id.toString());
  const available = activeTeam.filter((m) => { const uid = m.user?._id || m._id; return uid && !current.includes(uid.toString()); });

  const add = async () => {
    if (!selected.length) return toast.error('Select at least one user');
    setLoading(true);
    try { await addReadOnly({ folderId: folder._id, users: selected }).unwrap(); toast.success('Added'); onSuccess(); onClose(); }
    catch (err) { toast.error(err?.data?.message || 'Failed'); } finally { setLoading(false); }
  };
  const remove = async (uid) => {
    setLoading(true);
    try { await removeReadOnly({ folderId: folder._id, users: [uid] }).unwrap(); toast.success('Removed'); onSuccess(); }
    catch (err) { toast.error(err?.data?.message || 'Failed'); } finally { setLoading(false); }
  };
  if (!isOpen || !folder) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2"><FaUserLock className="text-teal-600 dark:text-[#0d9488]" /> Read‑Only — {folder.name}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400"><FaTimes /></button>
        </div>
        <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Current</h4>
        {current.length === 0 ? <p className="text-sm text-gray-500 mb-4">No users have read-only access.</p> : (
          <div className="space-y-2 mb-4">
            {current.map((uid) => {
              const m = activeTeam.find((mm) => (mm.user?._id || mm._id)?.toString() === uid);
              const u = m?.user || m;
              return (
                <div key={uid} className="flex items-center justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-xl px-3 py-2">
                  <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{u?.name || 'Unknown'}</span>
                  <button onClick={() => remove(uid)} disabled={loading} className="text-red-500"><FaTimes className="text-xs" /></button>
                </div>
              );
            })}
          </div>
        )}
        {available.length > 0 && (
          <>
            <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Add users</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {available.map((m) => {
                const u = m.user || m;
                const uid = (u._id || m._id).toString();
                const checked = selected.includes(uid);
                return (
                  <label key={uid} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-[#1a1a24] rounded-xl cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={(e) => setSelected(e.target.checked ? [...selected, uid] : selected.filter((x) => x !== uid))} className="accent-teal-600" />
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{u?.name || 'Unknown'}</span>
                  </label>
                );
              })}
            </div>
            <button onClick={add} disabled={loading || !selected.length} className="w-full mt-3 py-2 text-white rounded-xl text-sm font-medium disabled:opacity-50" style={{ backgroundColor: brandColor }}>{loading ? 'Adding...' : `Add ${selected.length} user(s)`}</button>
          </>
        )}
        <button onClick={onClose} className="w-full mt-3 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400">Close</button>
      </div>
    </div>
  );
};

const FolderSelectModal = ({ isOpen, onClose, folders, onSelect, title }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#14141a] w-full max-w-md rounded-t-3xl p-4 pb-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-center text-sm font-medium text-gray-500 pb-3 border-b border-gray-200 dark:border-gray-800/60 mb-2">{title}</div>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          <button onClick={() => { onSelect(null); onClose(); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30"><FaFolder className="text-gray-400" /><span className="text-sm font-medium">Uncategorized</span></button>
          {folders.map((f) => (
            <button key={f._id} onClick={() => { onSelect(f._id); onClose(); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30"><FaFolder className="text-gray-400" /><span className="text-sm font-medium">{f.name}</span></button>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-3 py-3 text-sm font-medium text-gray-500">Cancel</button>
      </div>
    </div>
  );
};

// ─── Search overlay ─────────────────────────────────────────────
const SearchOverlay = ({ isOpen, onClose, tasks, brandColor, onSelect }) => {
  const [q, setQ] = useState('');
  if (!isOpen) return null;
  const filtered = tasks.filter((t) => t.title?.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-[60] bg-white dark:bg-[#0b0b10]/95 backdrop-blur-xl flex flex-col">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200/60 dark:border-gray-800/60">
        <button onClick={onClose} className="p-1 text-gray-500"><FaArrowLeft /></button>
        <div className="flex-1 bg-gray-100 dark:bg-[#1e1e26] rounded-2xl px-4 py-2 flex items-center gap-3 border border-gray-200 dark:border-gray-800/40">
          <FaSearch className="text-gray-400 text-xs" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks..." autoFocus className="bg-transparent w-full outline-none text-sm text-gray-800 dark:text-gray-200" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {!q ? <div className="text-center text-gray-400 mt-10">Search tasks</div> : filtered.length === 0 ? <div className="text-center text-gray-400 mt-10">No results</div> : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <div key={t._id} onClick={() => { onSelect(t._id); onClose(); }} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/40 cursor-pointer">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold" style={{ backgroundColor: brandColor }}>{t.title.charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{t.title}</p>
                  <div className="flex items-center gap-1.5"><StatusPill status={t.status} /><PriorityPill priority={t.priority} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// PDF generator
// ══════════════════════════════════════════════════════════════
const downloadDocsPDF = (doc) => {
  if (!doc) return;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const PAGE_W = pdf.internal.pageSize.getWidth();
  const PAGE_H = pdf.internal.pageSize.getHeight();
  const MARGIN_X = 60;
  const MARGIN_TOP = 72;
  const MARGIN_BOTTOM = 72;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  const BODY_SIZE = 12, BODY_LINE_H = 18, TITLE_SIZE = 26, SUB_SIZE = 13, H1_SIZE = 16;
  const TABLE_SIZE = 10, TABLE_LINE_H = 13, FOOTER_SIZE = 10;
  const ACCENT = [13, 148, 136], TEXT_DARK = [17, 17, 17], TEXT_MUTED = [110, 110, 110];

  let y = MARGIN_TOP, pageNum = 0, onCover = true;

  const setFont = (style = 'normal', size = BODY_SIZE, color = TEXT_DARK) => {
    pdf.setFont('times', style); pdf.setFontSize(size); pdf.setTextColor(...color);
  };

  const justifyLine = (line, xPos, yPos, width) => {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 2) { pdf.text(line, xPos, yPos); return; }
    const spaceW = pdf.getTextWidth(' ');
    const wordsW = words.reduce((s, w) => s + pdf.getTextWidth(w), 0);
    const natural = wordsW + spaceW * (words.length - 1);
    const extra = Math.max(0, width - natural);
    const add = extra / (words.length - 1);
    let cx = xPos;
    for (let i = 0; i < words.length; i++) {
      pdf.text(words[i], cx, yPos);
      cx += pdf.getTextWidth(words[i]);
      if (i < words.length - 1) cx += spaceW + add;
    }
  };

  const drawFooter = () => {
    if (onCover) return;
    setFont('normal', FOOTER_SIZE, TEXT_MUTED);
    pdf.text(String(pageNum), PAGE_W / 2, PAGE_H - 38, { align: 'center' });
    pdf.setDrawColor(...ACCENT); pdf.setLineWidth(0.8);
    pdf.line(PAGE_W / 2 - 8, PAGE_H - 50, PAGE_W / 2 + 8, PAGE_H - 50);
  };

  const newPage = () => { drawFooter(); pdf.addPage(); pageNum += 1; onCover = false; y = MARGIN_TOP; };
  const ensure = (h) => { if (y + h > PAGE_H - MARGIN_BOTTOM) newPage(); };

  const writeParagraph = (text, opts = {}) => {
    const { size = BODY_SIZE, style = 'normal', color = TEXT_DARK, align = 'left', lineH = size * 1.5, gap = 10, indent = 0 } = opts;
    setFont(style, size, color);
    const usableW = CONTENT_W - indent;
    const lines = pdf.splitTextToSize(String(text ?? ''), usableW);
    if (!lines.length) { y += gap; return; }
    for (let i = 0; i < lines.length; i++) {
      ensure(lineH);
      const line = lines[i];
      const isLast = i === lines.length - 1;
      const trimmed = line.trim();
      if (align === 'justify' && !isLast && trimmed.includes(' ')) justifyLine(line, MARGIN_X + indent, y, usableW);
      else if (align === 'center') pdf.text(line, MARGIN_X + CONTENT_W / 2, y, { align: 'center' });
      else if (align === 'right') pdf.text(line, MARGIN_X + CONTENT_W, y, { align: 'right' });
      else pdf.text(line, MARGIN_X + indent, y);
      y += lineH;
    }
    y += gap;
  };

  const writeHeading = (text, level = 1) => {
    const size = level === 1 ? H1_SIZE : 14;
    const lineH = size * 1.35;
    setFont('bold', size, TEXT_DARK);
    const lines = pdf.splitTextToSize(String(text ?? ''), CONTENT_W);
    lines.forEach((ln) => { ensure(lineH + 10); pdf.text(ln, MARGIN_X, y); y += lineH; });
    y += 2;
    pdf.setDrawColor(...ACCENT); pdf.setLineWidth(level === 1 ? 1.2 : 0.8);
    pdf.line(MARGIN_X, y, MARGIN_X + (level === 1 ? 70 : 42), y);
    y += level === 1 ? 14 : 10;
  };

  const writeBullets = (items) => {
    items.forEach((item) => {
      setFont('normal', BODY_SIZE, TEXT_DARK);
      const usableW = CONTENT_W - 22;
      const lines = pdf.splitTextToSize(String(item ?? ''), usableW);
      ensure(BODY_LINE_H);
      pdf.text('•', MARGIN_X + 4, y);
      lines.forEach((ln, i) => {
        ensure(BODY_LINE_H);
        const isLast = i === lines.length - 1;
        if (!isLast && ln.trim().includes(' ')) justifyLine(ln, MARGIN_X + 22, y, usableW);
        else pdf.text(ln, MARGIN_X + 22, y);
        y += BODY_LINE_H;
      });
      y += 4;
    });
    y += 6;
  };

  const writeTable = (headers, rows) => {
    if (!headers?.length || !rows?.length) return;
    const cols = headers.length;
    const colW = CONTENT_W / cols;
    const padX = 8, padY = 7;
    const headerH = TABLE_SIZE + padY * 2 + 2;

    const drawHeader = () => {
      pdf.setFillColor(238, 243, 245);
      pdf.rect(MARGIN_X, y, CONTENT_W, headerH, 'F');
      setFont('bold', TABLE_SIZE, TEXT_DARK);
      headers.forEach((h, i) => {
        const lines = pdf.splitTextToSize(String(h ?? ''), colW - padX * 2);
        pdf.text(lines, MARGIN_X + i * colW + padX, y + padY + TABLE_SIZE);
      });
      y += headerH;
    };

    ensure(headerH + 4);
    drawHeader();

    rows.forEach((row, rowIdx) => {
      const cells = [...row];
      while (cells.length < cols) cells.push('');
      const cellLines = cells.map((c) => pdf.splitTextToSize(String(c ?? '').replace(/\s*\n\s*/g, ' '), colW - padX * 2));
      const maxLines = Math.max(1, ...cellLines.map((l) => l.length));
      const rowH = maxLines * TABLE_LINE_H + padY * 2;
      if (y + rowH > PAGE_H - MARGIN_BOTTOM) { newPage(); drawHeader(); }
      if (rowIdx % 2 === 1) { pdf.setFillColor(249, 250, 251); pdf.rect(MARGIN_X, y, CONTENT_W, rowH, 'F'); }
      setFont('normal', TABLE_SIZE, TEXT_DARK);
      cellLines.forEach((lines, i) => {
        let cy = y + padY + TABLE_SIZE;
        lines.forEach((ln) => { pdf.text(ln, MARGIN_X + i * colW + padX, cy); cy += TABLE_LINE_H; });
      });
      pdf.setDrawColor(225, 228, 232); pdf.setLineWidth(0.5);
      pdf.line(MARGIN_X, y + rowH, MARGIN_X + CONTENT_W, y + rowH);
      y += rowH;
    });
    y += 12;
  };

  pdf.setFillColor(238, 243, 245); pdf.rect(0, 0, PAGE_W, 8, 'F');
  pdf.setFillColor(...ACCENT); pdf.rect(0, 0, 170, 8, 'F');
  setFont('normal', 11, TEXT_MUTED);
  pdf.text('PROJECT DOCUMENTATION', MARGIN_X, 148);

  const title = doc.meta?.title || 'Untitled Project';
  setFont('bold', TITLE_SIZE, TEXT_DARK);
  let ty = 210;
  const titleLines = pdf.splitTextToSize(title, CONTENT_W);
  titleLines.forEach((ln) => { pdf.text(ln, MARGIN_X, ty); ty += TITLE_SIZE * 1.25; });
  if (doc.meta?.subtitle) {
    ty += 12;
    setFont('italic', SUB_SIZE, TEXT_MUTED);
    const subLines = pdf.splitTextToSize(doc.meta.subtitle, CONTENT_W);
    subLines.forEach((ln) => { pdf.text(ln, MARGIN_X, ty); ty += SUB_SIZE * 1.5; });
  }
  ty += 18;
  pdf.setDrawColor(...ACCENT); pdf.setLineWidth(3);
  pdf.line(MARGIN_X, ty, MARGIN_X + 90, ty);

  const metaY = PAGE_H - 200;
  setFont('normal', 10, TEXT_MUTED); pdf.text('PROJECT', MARGIN_X, metaY);
  setFont('bold', 13, TEXT_DARK); pdf.text(doc.meta?.projectName || '—', MARGIN_X, metaY + 20);
  setFont('normal', 10, TEXT_MUTED); pdf.text('VERSION', MARGIN_X, metaY + 52);
  setFont('bold', 13, TEXT_DARK); pdf.text(doc.meta?.version || '1.0', MARGIN_X, metaY + 72);
  setFont('normal', 10, TEXT_MUTED); pdf.text('GENERATED', MARGIN_X, metaY + 104);
  setFont('bold', 13, TEXT_DARK);
  pdf.text(new Date(doc.meta?.generatedAt || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), MARGIN_X, metaY + 124);
  if (doc.meta?.generatedBy) {
    setFont('normal', 10, TEXT_MUTED); pdf.text('BY', MARGIN_X, metaY + 156);
    setFont('bold', 13, TEXT_DARK); pdf.text(doc.meta.generatedBy, MARGIN_X, metaY + 176);
  }

  newPage();
  (doc.sections || []).forEach((section, sIdx) => {
    if (sIdx > 0) y += 8;
    ensure(34);
    writeHeading(section.heading, 1);
    (section.paragraphs || []).forEach((p) => writeParagraph(p, { size: BODY_SIZE, style: 'normal', align: 'justify', lineH: BODY_LINE_H, gap: 10 }));
    if (section.bullets?.length) writeBullets(section.bullets);
    if (section.table?.headers?.length && section.table?.rows?.length) writeTable(section.table.headers, section.table.rows);
  });
  drawFooter();

  const safeName = (doc.meta?.projectName || 'project').replace(/[^\w\-]+/g, '_');
  pdf.save(`${safeName}_docs.pdf`);
};

// ══════════════════════════════════════════════════════════════
// AI modals
// ══════════════════════════════════════════════════════════════
const AIMenu = ({ isOpen, onClose, canManage, brandColor, onPlan, onSummary, onReview, onDocs, onEdit }) => {
  if (!isOpen) return null;
  const Item = ({ icon, label, sub, onClick, disabled }) => (
    <button onClick={() => { if (!disabled) { onClick(); onClose(); } }} disabled={disabled}
      className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800/40'}`}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: brandColor }}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">{sub}</p>
      </div>
    </button>
  );
  return (
    <div className="fixed inset-0 z-[65] flex items-end md:items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-0 md:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-2xl md:rounded-2xl w-full md:max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2"><FaMagic className="text-teal-600 dark:text-[#0d9488]" /> AI Assistant</h3>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
          </div>
          <div className="space-y-1">
            <Item icon={<FaRobot className="text-sm" />} label="Plan a new project" sub="Describe it in plain English — get a full plan" onClick={onPlan} disabled={!canManage} />
            <Item icon={<FaEdit className="text-sm" />} label="Edit this project with AI" sub="Add, remove, or reassign tasks — describe the change" onClick={onEdit} disabled={!canManage} />
            <Item icon={<FaLightbulb className="text-sm" />} label="Summarize this project" sub="Headline, highlights, risks, next steps" onClick={onSummary} />
            <Item icon={<FaHeartbeat className="text-sm" />} label="Review this project" sub="Audit workload, deadlines, and blockers" onClick={onReview} disabled={!canManage} />
            <Item icon={<FaFileAlt className="text-sm" />} label="Generate documentation" sub="Formal project doc, downloadable as PDF" onClick={onDocs} />
          </div>
        </div>
      </div>
    </div>
  );
};

const EXAMPLE_PROMPTS = [
  'Build a marketing website in 3 weeks with design, dev and QA phases.',
  'Launch a new mobile app feature. Need a designer, backend dev and tester.',
  'Plan a 2-day team offsite with logistics and activities.',
  'Create a content calendar for our social media for the next month.',
];

const AIPlanModal = ({ isOpen, onClose, workspaceId, workspaceMembers, brandColor, onExecuted }) => {
  const [stage, setStage] = useState('prompt');
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [busy, setBusy] = useState(false);
  const [planWithAI] = usePlanWithAIMutation();
  const [executeAIPlan] = useExecuteAIPlanMutation();

  const reset = () => { setStage('prompt'); setPrompt(''); setPlan(null); setExpandedTask(null); };
  useEffect(() => { if (!isOpen) reset(); }, [isOpen]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error('Describe your project first');
    setBusy(true);
    try { const res = await planWithAI({ workspaceId, prompt: prompt.trim() }).unwrap(); setPlan(res.plan); setStage('edit'); }
    catch (err) { toast.error(err?.data?.message || 'Failed to generate plan'); }
    finally { setBusy(false); }
  };

  const handleExecute = async () => {
    if (!plan) return;
    if (!plan.project.name?.trim()) return toast.error('Project name required');
    if (!plan.tasks?.length) return toast.error('Add at least one task');
    setBusy(true);
    try {
      const cleanPlan = {
        project: { name: plan.project.name.trim(), description: plan.project.description || '', detailedDescription: plan.project.detailedDescription || '', priority: plan.project.priority, projectType: plan.project.projectType, tags: plan.project.tags || [], teamMemberIds: plan.project.teamMemberIds || [] },
        tasks: plan.tasks.map((t) => ({ title: t.title.trim(), description: t.description || '', priority: t.priority, assigneeIds: t.assigneeIds || [], dueDateOffsetDays: Number.isFinite(t.dueDateOffsetDays) ? t.dueDateOffsetDays : null, subtasks: (t.subtasks || []).map((s) => ({ title: s.title.trim(), description: s.description || '', dueDateOffsetDays: Number.isFinite(s.dueDateOffsetDays) ? s.dueDateOffsetDays : null })) })),
      };
      const res = await executeAIPlan({ workspaceId, plan: cleanPlan }).unwrap();
      toast.success(`Created ${res.taskCount} tasks`);
      onExecuted?.(res.project); onClose();
    } catch (err) { toast.error(err?.data?.message || 'Failed to create project'); }
    finally { setBusy(false); }
  };

  const updateProject = (patch) => setPlan((p) => ({ ...p, project: { ...p.project, ...patch } }));
  const updateTask = (i, patch) => setPlan((p) => { const tasks = [...p.tasks]; tasks[i] = { ...tasks[i], ...patch }; return { ...p, tasks }; });
  const removeTask = (i) => setPlan((p) => ({ ...p, tasks: p.tasks.filter((_, k) => k !== i) }));
  const addTask = () => setPlan((p) => ({ ...p, tasks: [...p.tasks, { title: 'New task', description: '', priority: 'medium', assigneeIds: [], dueDateOffsetDays: 7, subtasks: [] }] }));
  const toggleAssignee = (i, uid) => { const t = plan.tasks[i]; const has = t.assigneeIds.includes(uid); updateTask(i, { assigneeIds: has ? t.assigneeIds.filter((x) => x !== uid) : [...t.assigneeIds, uid] }); };
  const toggleTeamMember = (uid) => { const has = (plan.project.teamMemberIds || []).includes(uid); updateProject({ teamMemberIds: has ? plan.project.teamMemberIds.filter((x) => x !== uid) : [...(plan.project.teamMemberIds || []), uid] }); };
  const addSubtask = (i) => { const t = plan.tasks[i]; updateTask(i, { subtasks: [...(t.subtasks || []), { title: 'New subtask', description: '', dueDateOffsetDays: 3 }] }); };
  const updateSubtask = (i, si, patch) => { const t = plan.tasks[i]; const subs = [...(t.subtasks || [])]; subs[si] = { ...subs[si], ...patch }; updateTask(i, { subtasks: subs }); };
  const removeSubtask = (i, si) => { const t = plan.tasks[i]; updateTask(i, { subtasks: (t.subtasks || []).filter((_, k) => k !== si) }); };

  if (!isOpen) return null;
  const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
  const PROJECT_TYPES = ['general', 'client', 'internal', 'marketing', 'product'];
  const totalSubtasks = plan?.tasks?.reduce((n, t) => n + (t.subtasks || []).length, 0) || 0;

  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-4xl shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[92vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2"><FaMagic className="text-teal-600 dark:text-[#0d9488]" />{stage === 'prompt' ? 'Plan with AI' : 'Review AI Plan'}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{stage === 'prompt' ? 'Describe your project — the AI will draft the plan' : `Edit anything · ${plan?.tasks?.length || 0} tasks · ${totalSubtasks} subtasks`}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {stage === 'prompt' && (
            <div className="space-y-4">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} placeholder="e.g. Plan a 3-week launch for our new mobile app..." className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-2xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 dark:focus:border-[#0d9488] resize-none" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-2">Try an example</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_PROMPTS.map((ex, i) => (
                    <button key={i} type="button" onClick={() => setPrompt(ex)} className="text-[10px] px-2.5 py-1 rounded-full bg-gray-100 dark:bg-[#1a1a24] hover:bg-[#0d9488]/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800/40 hover:border-[#0d9488]/40 transition text-left max-w-full truncate">{ex.length > 45 ? `${ex.slice(0, 45)}…` : ex}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {stage === 'edit' && plan && (
            <div className="space-y-5">
              {plan.warnings?.length > 0 && (<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3 flex gap-2"><FaExclamationTriangle className="text-amber-600 dark:text-amber-400 text-sm mt-0.5 shrink-0" /><div className="text-xs text-amber-800 dark:text-amber-300 space-y-0.5">{plan.warnings.map((w, i) => <div key={i}>{w}</div>)}</div></div>)}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Project</h3>
                <div className="space-y-2">
                  <input value={plan.project.name} onChange={(e) => updateProject({ name: e.target.value })} placeholder="Project name" className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-100 outline-none focus:border-teal-500 dark:focus:border-[#0d9488]" />
                  <input value={plan.project.description || ''} onChange={(e) => updateProject({ description: e.target.value })} placeholder="Short description" className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 dark:focus:border-[#0d9488]" />
                  <textarea value={plan.project.detailedDescription || ''} onChange={(e) => updateProject({ detailedDescription: e.target.value })} rows={3} placeholder="Detailed description" className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 dark:focus:border-[#0d9488] resize-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={plan.project.priority} onChange={(e) => updateProject({ priority: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none">{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                    <select value={plan.project.projectType} onChange={(e) => updateProject({ projectType: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none">{PROJECT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                  </div>
                  {workspaceMembers?.length > 0 && (
                    <div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-500 mb-1.5">Team members</div>
                      <div className="flex flex-wrap gap-1.5">
                        {workspaceMembers.map((u) => {
                          const selected = (plan.project.teamMemberIds || []).includes(u._id);
                          return (
                            <button key={u._id} type="button" onClick={() => toggleTeamMember(u._id)} className={`flex items-center gap-1.5 text-[11px] pl-0.5 pr-2.5 py-0.5 rounded-full border transition ${selected ? 'bg-teal-50 dark:bg-[#0d9488]/15 border-teal-500/50 dark:border-[#0d9488]/50 text-teal-700 dark:text-[#14b8a6]' : 'bg-gray-50 dark:bg-[#1a1a24] border-gray-200 dark:border-gray-800/40 text-gray-600 dark:text-gray-400 hover:border-gray-300'}`}>
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold overflow-hidden shrink-0" style={{ backgroundColor: brandColor }}>{u.profile ? <img src={u.profile} alt="" className="w-full h-full object-cover" /> : (u.name || '?').charAt(0).toUpperCase()}</span>
                              {u.name || 'Unknown'}
                              {selected && <FaCheck className="text-[8px]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">Tasks ({plan.tasks.length})</h3>
                  <button onClick={addTask} className="text-xs text-teal-600 dark:text-[#0d9488] font-medium flex items-center gap-1 hover:underline"><FaPlus className="text-[10px]" /> Add task</button>
                </div>
                <div className="space-y-2">
                  {plan.tasks.map((t, idx) => {
                    const expanded = expandedTask === idx;
                    return (
                      <div key={idx} className="bg-gray-50 dark:bg-[#1a1a24] rounded-xl border border-gray-200/60 dark:border-gray-800/40 overflow-hidden">
                        <div className="flex items-start gap-2 p-3">
                          <div className="flex-1 min-w-0 space-y-2">
                            <input value={t.title} onChange={(e) => updateTask(idx, { title: e.target.value })} className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-100 outline-none focus:border-teal-500 dark:focus:border-[#0d9488]" />
                            <div className="flex flex-wrap gap-1.5">
                              <select value={t.priority} onChange={(e) => updateTask(idx, { priority: e.target.value })} className="px-2 py-1 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-md text-[11px] text-gray-700 dark:text-gray-300 outline-none">{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                              <input type="number" min={0} value={t.dueDateOffsetDays ?? ''} onChange={(e) => updateTask(idx, { dueDateOffsetDays: e.target.value === '' ? null : parseInt(e.target.value, 10) })} placeholder="due in N days" className="w-32 px-2 py-1 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-md text-[11px] text-gray-700 dark:text-gray-300 outline-none" />
                              <span className="px-2 py-1 text-[11px] text-gray-500 dark:text-gray-500">{(t.subtasks || []).length} subtask{(t.subtasks || []).length !== 1 ? 's' : ''}</span>
                            </div>
                            {workspaceMembers?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {workspaceMembers.map((u) => {
                                  const sel = (t.assigneeIds || []).includes(u._id);
                                  return (
                                    <button key={u._id} type="button" onClick={() => toggleAssignee(idx, u._id)} title={u.name} className={`flex items-center gap-1 text-[10px] pl-0.5 pr-1.5 py-0.5 rounded-full border transition ${sel ? 'bg-teal-50 dark:bg-[#0d9488]/15 border-teal-500/50 text-teal-700 dark:text-[#14b8a6]' : 'bg-white dark:bg-[#0f0f12] border-gray-200 dark:border-gray-800/40 text-gray-500 dark:text-gray-500 hover:border-gray-300'}`}>
                                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold overflow-hidden" style={{ backgroundColor: brandColor }}>{u.profile ? <img src={u.profile} alt="" className="w-full h-full object-cover" /> : (u.name || '?').charAt(0).toUpperCase()}</span>
                                      {(u.name || '').split(' ')[0] || 'Unknown'}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            <button onClick={() => setExpandedTask(expanded ? null : idx)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded"><FaAngleDown className={`text-xs transition-transform ${expanded ? 'rotate-180' : ''}`} /></button>
                            <button onClick={() => removeTask(idx)} className="p-1 text-gray-400 hover:text-red-500 rounded"><FaTrashAlt className="text-xs" /></button>
                          </div>
                        </div>
                        {expanded && (
                          <div className="px-3 pb-3 space-y-3 border-t border-gray-200/60 dark:border-gray-800/40 pt-3">
                            <textarea value={t.description || ''} onChange={(e) => updateTask(idx, { description: e.target.value })} rows={2} placeholder="Task description" className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none resize-none" />
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-500">Subtasks ({(t.subtasks || []).length})</span>
                              <button onClick={() => addSubtask(idx)} className="text-[11px] text-teal-600 dark:text-[#0d9488] font-medium flex items-center gap-1 hover:underline"><FaPlus className="text-[9px]" /> Add</button>
                            </div>
                            <div className="space-y-1.5">
                              {(t.subtasks || []).map((s, sidx) => (
                                <div key={sidx} className="flex items-start gap-2">
                                  <input value={s.title} onChange={(e) => updateSubtask(idx, sidx, { title: e.target.value })} className="flex-1 px-2.5 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none" />
                                  <input type="number" min={0} value={s.dueDateOffsetDays ?? ''} onChange={(e) => updateSubtask(idx, sidx, { dueDateOffsetDays: e.target.value === '' ? null : parseInt(e.target.value, 10) })} placeholder="N" className="w-14 px-2 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none" />
                                  <button onClick={() => removeSubtask(idx, sidx)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><FaTrashAlt className="text-[11px]" /></button>
                                </div>
                              ))}
                              {(t.subtasks || []).length === 0 && <p className="text-[11px] text-gray-400 dark:text-gray-600 italic">No subtasks</p>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </div>
        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
          {stage === 'prompt' ? (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={handleGenerate} disabled={busy || !prompt.trim()} className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50" style={{ backgroundColor: brandColor }}>{busy ? <><FaSpinner className="animate-spin text-xs" /> Generating…</> : <><FaMagic className="text-xs" /> Generate plan</>}</button>
            </>
          ) : (
            <>
              <button onClick={() => setStage('prompt')} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Back</button>
              <button onClick={handleExecute} disabled={busy} className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50" style={{ backgroundColor: brandColor }}>{busy ? <><FaSpinner className="animate-spin text-xs" /> Creating…</> : <><FaCheck className="text-xs" /> Create project</>}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const AIReviewModal = ({ isOpen, onClose, projectId, brandColor }) => {
  const [focus, setFocus] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reviewProject] = useReviewProjectMutation();
  useEffect(() => { if (!isOpen) { setResult(null); setFocus(''); } }, [isOpen]);
  const run = async () => {
    setBusy(true);
    try { const res = await reviewProject({ projectId, focus: focus.trim() || undefined }).unwrap(); setResult(res.review); }
    catch (err) { toast.error(err?.data?.message || 'Review failed'); }
    finally { setBusy(false); }
  };
  if (!isOpen) return null;
  const scoreColor = !result ? brandColor : result.healthScore >= 75 ? '#16a34a' : result.healthScore >= 50 ? '#eab308' : '#dc2626';
  const sevColor = { low: 'text-blue-600 dark:text-blue-400', medium: 'text-yellow-600 dark:text-yellow-400', high: 'text-orange-600 dark:text-orange-400', critical: 'text-red-600 dark:text-red-400' };
  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2"><FaHeartbeat className="text-teal-600 dark:text-[#0d9488]" /> Project Review</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {!result && (
            <div className="space-y-3">
              <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Optional focus — e.g. 'deadlines' or 'team balance'" className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 dark:focus:border-[#0d9488]" />
              <p className="text-[11px] text-gray-500 dark:text-gray-500">The AI audits workload, priorities, deadlines, and gaps.</p>
            </div>
          )}
          {result && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-2xl text-white shrink-0" style={{ backgroundColor: scoreColor }}>{result.healthScore}</div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-500 uppercase font-semibold tracking-wide">Health Score</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 break-words">{result.overallAssessment}</p>
                </div>
              </div>
              {result.strengths?.length > 0 && (<div><h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Strengths</h4><div className="space-y-1.5">{result.strengths.map((s, i) => (<div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"><FaCheckCircle className="text-green-500 text-xs mt-1 shrink-0" /><span className="break-words">{s}</span></div>))}</div></div>)}
              {result.issues?.length > 0 && (<div><h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Issues ({result.issues.length})</h4><div className="space-y-2">{result.issues.map((it, i) => (<div key={i} className="bg-gray-50 dark:bg-[#1a1a24] rounded-xl p-3 border border-gray-200/60 dark:border-gray-800/40"><div className="flex items-start gap-2"><FaExclamationCircle className={`text-xs mt-1 shrink-0 ${sevColor[it.severity] || 'text-gray-400'}`} /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">{it.title}<span className={`ml-2 text-[10px] uppercase font-semibold ${sevColor[it.severity] || ''}`}>{it.severity}</span></p><p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">{it.detail}</p></div></div></div>))}</div></div>)}
              {result.recommendations?.length > 0 && (<div><h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Recommendations</h4><div className="space-y-2">{result.recommendations.map((r, i) => (<div key={i} className="bg-teal-50/60 dark:bg-[#0d9488]/10 rounded-xl p-3 border border-teal-200/60 dark:border-[#0d9488]/20"><div className="flex items-start gap-2"><FaLightbulb className="text-teal-600 dark:text-[#0d9488] text-xs mt-1 shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">{r.title}<span className="ml-2 text-[10px] uppercase font-semibold text-teal-700 dark:text-[#0d9488]">{r.impact}</span></p><p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">{r.detail}</p></div></div></div>))}</div></div>)}
            </div>
          )}
        </div>
        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
          {!result ? (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={run} disabled={busy} className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50" style={{ backgroundColor: brandColor }}>{busy ? <><FaSpinner className="animate-spin text-xs" /> Analyzing…</> : <><FaHeartbeat className="text-xs" /> Run review</>}</button>
            </>
          ) : (
            <>
              <button onClick={() => setResult(null)} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Run again</button>
              <button onClick={onClose} className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 transition" style={{ backgroundColor: brandColor }}>Done</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const AISummaryModal = ({ isOpen, onClose, projectId, brandColor }) => {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [summarizeProject] = useSummarizeProjectMutation();
  useEffect(() => { if (!isOpen) setResult(null); }, [isOpen]);
  useEffect(() => {
    if (isOpen && !result && !busy) {
      setBusy(true);
      summarizeProject({ projectId }).unwrap().then((r) => setResult(r.summary)).catch((e) => toast.error(e?.data?.message || 'Summarize failed')).finally(() => setBusy(false));
    }
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2"><FaLightbulb className="text-teal-600 dark:text-[#0d9488]" /> Project Summary</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {busy && !result && (<div className="flex flex-col items-center justify-center py-16"><FaSpinner className="animate-spin text-2xl text-teal-600 dark:text-[#0d9488] mb-3" /><p className="text-sm text-gray-500 dark:text-gray-500">Thinking…</p></div>)}
          {result && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 break-words">{result.headline}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 break-words leading-relaxed whitespace-pre-wrap">{result.summary}</p>
              </div>
              {result.currentState && (<div className="bg-gray-50 dark:bg-[#1a1a24] rounded-xl p-3 border border-gray-200/60 dark:border-gray-800/40"><p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-1">Current state</p><p className="text-sm text-gray-700 dark:text-gray-300 break-words">{result.currentState}</p></div>)}
              {result.highlights?.length > 0 && (<div><h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Highlights</h4><div className="space-y-1.5">{result.highlights.map((h, i) => (<div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"><FaCheckCircle className="text-green-500 text-xs mt-1 shrink-0" /><span className="break-words">{h}</span></div>))}</div></div>)}
              {result.risks?.length > 0 && (<div><h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Risks</h4><div className="space-y-1.5">{result.risks.map((r, i) => (<div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"><FaExclamationTriangle className="text-amber-500 text-xs mt-1 shrink-0" /><span className="break-words">{r}</span></div>))}</div></div>)}
              {result.nextSteps?.length > 0 && (<div><h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Next steps</h4><div className="space-y-1.5">{result.nextSteps.map((s, i) => (<div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"><span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: brandColor }}>{i + 1}</span><span className="break-words">{s}</span></div>))}</div></div>)}
            </div>
          )}
        </div>
        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
          <button onClick={onClose} className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 transition" style={{ backgroundColor: brandColor }}>Done</button>
        </div>
      </div>
    </div>
  );
};

const AIDocsModal = ({ isOpen, onClose, projectId, brandColor }) => {
  const [doc, setDoc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [generate] = useGenerateProjectDocsMutation();
  useEffect(() => { if (!isOpen) setDoc(null); }, [isOpen]);
  useEffect(() => {
    if (isOpen && !doc && !busy) {
      setBusy(true);
      generate({ projectId }).unwrap().then((r) => setDoc(r.doc)).catch((e) => toast.error(e?.data?.message || 'Doc generation failed')).finally(() => setBusy(false));
    }
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-3xl shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2"><FaFileAlt className="text-teal-600 dark:text-[#0d9488]" /> Project Documentation</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {busy && !doc && (<div className="flex flex-col items-center justify-center py-16"><FaSpinner className="animate-spin text-2xl text-teal-600 dark:text-[#0d9488] mb-3" /><p className="text-sm text-gray-500 dark:text-gray-500">Writing documentation…</p></div>)}
          {doc && (
            <article className="space-y-6">
              <header>
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 break-words">{doc.meta?.title}</h1>
                {doc.meta?.subtitle && <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 break-words">{doc.meta.subtitle}</p>}
                <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-2">Version {doc.meta?.version || '1.0'} · Generated {new Date(doc.meta?.generatedAt || Date.now()).toLocaleString()}</p>
              </header>
              {(doc.sections || []).map((s, i) => (
                <section key={i} className="space-y-2">
                  <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200/60 dark:border-gray-800/40 pb-1">{s.heading}</h2>
                  {(s.paragraphs || []).map((p, j) => (<p key={j} className="text-sm text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap leading-relaxed">{p}</p>))}
                  {(s.bullets || []).length > 0 && (<ul className="list-disc pl-5 space-y-1">{s.bullets.map((b, j) => <li key={j} className="text-sm text-gray-700 dark:text-gray-300 break-words">{b}</li>)}</ul>)}
                  {s.table?.headers?.length > 0 && s.table?.rows?.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-gray-200/60 dark:border-gray-800/40">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-[#1a1a24]"><tr>{s.table.headers.map((h, j) => (<th key={j} className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{h}</th>))}</tr></thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/30">{s.table.rows.map((row, j) => (<tr key={j}>{row.map((c, k) => <td key={k} className="px-3 py-2 text-gray-700 dark:text-gray-300 align-top">{c}</td>)}</tr>))}</tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </article>
          )}
        </div>
        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Close</button>
          <button onClick={() => doc && downloadDocsPDF(doc)} disabled={!doc || busy} className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50" style={{ backgroundColor: brandColor }}><FaDownload className="text-xs" /> Download PDF</button>
        </div>
      </div>
    </div>
  );
};

const AIProjectEditModal = ({ isOpen, onClose, projectId, brandColor, onApplied }) => {
  const [stage, setStage] = useState('prompt');
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editProjectWithAI] = useEditProjectWithAIMutation();
  const [applyProjectEdits] = useApplyProjectEditsMutation();

  useEffect(() => { if (!isOpen) { setStage('prompt'); setPrompt(''); setPreview(null); setBusy(false); } }, [isOpen]);

  const diff = useMemo(() => {
    if (!preview) return null;
    const currentById = new Map((preview.current?.tasks || []).map((t) => [t._id, t]));
    const added = [], updated = [], deleted = [];
    (preview.proposed?.tasks || []).forEach((t) => {
      if (t._deleted === true) { const c = currentById.get(t._id); if (c) deleted.push(c); return; }
      if (t._id && currentById.has(t._id)) updated.push({ before: currentById.get(t._id), after: t });
      else if (!t._id) added.push(t);
    });
    return { added, updated, deleted };
  }, [preview]);

  const handlePreview = async () => {
    if (!prompt.trim()) return toast.error('Describe what you want to change');
    setBusy(true);
    try { const res = await editProjectWithAI({ projectId, prompt: prompt.trim() }).unwrap(); setPreview(res); setStage('preview'); }
    catch (err) { toast.error(err?.data?.message || 'Failed to preview changes'); }
    finally { setBusy(false); }
  };

  const handleApply = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await applyProjectEdits({ projectId, proposed: { project: preview.proposed.project, tasks: preview.proposed.tasks } }).unwrap();
      toast.success(`Applied · +${res.created || 0} added · ~${res.updated || 0} updated · −${res.deleted || 0} removed`);
      onApplied?.(); onClose();
    } catch (err) { toast.error(err?.data?.message || 'Failed to apply changes'); }
    finally { setBusy(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-3xl shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[92vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2"><FaMagic className="text-teal-600 dark:text-[#0d9488]" />{stage === 'prompt' ? 'Edit project with AI' : 'Review changes'}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{stage === 'prompt' ? 'Add, remove, reassign, re-date — describe it in plain English' : 'Nothing is saved yet — review before applying'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {stage === 'prompt' && (
            <div className="space-y-3">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} placeholder={`e.g. Add a "Design QA" task assigned to Sarah due next Friday...`} className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-2xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 dark:focus:border-[#0d9488] resize-none" />
              <p className="text-[11px] text-gray-500 dark:text-gray-500 leading-relaxed">Supported: add tasks · delete tasks · reassign work · change priorities · shift deadlines · add team members · expand or trim checklists · rewrite descriptions.</p>
            </div>
          )}
          {stage === 'preview' && preview && (
            <div className="space-y-4">
              {preview.summary && (<div className="bg-teal-50/60 dark:bg-[#0d9488]/10 border border-teal-200/60 dark:border-[#0d9488]/20 rounded-xl p-3"><p className="text-[10px] font-semibold text-teal-700 dark:text-[#0d9488] uppercase tracking-wide mb-1">Summary</p><p className="text-sm text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap">{preview.summary}</p></div>)}
              {preview.warnings?.length > 0 && (<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3 flex gap-2"><FaExclamationTriangle className="text-amber-600 dark:text-amber-400 text-sm mt-0.5 shrink-0" /><div className="text-xs text-amber-800 dark:text-amber-300 space-y-0.5">{preview.warnings.map((w, i) => <div key={i}>{w}</div>)}</div></div>)}
              {diff && (<div className="grid grid-cols-3 gap-2"><div className="bg-green-50 dark:bg-green-900/20 border border-green-200/60 dark:border-green-700/40 rounded-xl p-3 text-center"><p className="text-lg font-bold text-green-600 dark:text-green-400">+{diff.added.length}</p><p className="text-[10px] text-green-700 dark:text-green-300 uppercase font-semibold tracking-wide">Added</p></div><div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-700/40 rounded-xl p-3 text-center"><p className="text-lg font-bold text-blue-600 dark:text-blue-400">~{diff.updated.length}</p><p className="text-[10px] text-blue-700 dark:text-blue-300 uppercase font-semibold tracking-wide">Updated</p></div><div className="bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-700/40 rounded-xl p-3 text-center"><p className="text-lg font-bold text-red-600 dark:text-red-400">−{diff.deleted.length}</p><p className="text-[10px] text-red-700 dark:text-red-300 uppercase font-semibold tracking-wide">Removed</p></div></div>)}
              {diff?.added.length > 0 && (<section><h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">New tasks</h4><div className="space-y-1.5">{diff.added.map((t, i) => (<div key={i} className="flex items-start gap-2 bg-green-50/60 dark:bg-green-900/10 border border-green-200/40 dark:border-green-700/30 rounded-xl px-3 py-2"><FaPlus className="text-green-600 dark:text-green-400 text-[10px] mt-1.5 shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{t.title}</p>{t.assignees?.length > 0 && (<p className="text-[11px] text-gray-500 dark:text-gray-500 truncate">→ {t.assignees.map((a) => a.name).join(', ')}</p>)}</div><PriorityPill priority={t.priority} /></div>))}</div></section>)}
              {diff?.deleted.length > 0 && (<section><h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Removed tasks</h4><div className="space-y-1.5">{diff.deleted.map((t, i) => (<div key={i} className="flex items-start gap-2 bg-red-50/60 dark:bg-red-900/10 border border-red-200/40 dark:border-red-700/30 rounded-xl px-3 py-2"><FaTrashAlt className="text-red-500 text-[10px] mt-1.5 shrink-0" /><p className="text-sm text-gray-700 dark:text-gray-400 line-through truncate flex-1">{t.title}</p></div>))}</div></section>)}
              {diff?.updated.length > 0 && (<section><h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Updated tasks</h4><div className="space-y-1.5">{diff.updated.map((u, i) => (<div key={i} className="flex items-start gap-2 bg-blue-50/60 dark:bg-blue-900/10 border border-blue-200/40 dark:border-blue-700/30 rounded-xl px-3 py-2"><FaEdit className="text-blue-500 text-[10px] mt-1.5 shrink-0" /><p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1">{u.after.title}</p><PriorityPill priority={u.after.priority} /></div>))}</div></section>)}
              {preview.changes?.length > 0 && (<section><h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">All changes ({preview.changes.length})</h4><div className="space-y-1 max-h-56 overflow-y-auto pr-1">{preview.changes.map((c, i) => (<div key={i} className="flex items-start gap-2 text-xs bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-2"><span className="font-semibold text-gray-700 dark:text-gray-300 shrink-0">{c.field}:</span><span className="text-gray-500 dark:text-gray-500 truncate flex-1 min-w-0">{c.from || '—'}</span><span className="text-gray-400 shrink-0">→</span><span className="text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0">{c.to || '—'}</span></div>))}</div></section>)}
              {diff && diff.added.length === 0 && diff.updated.length === 0 && diff.deleted.length === 0 && (<p className="text-sm text-gray-500 dark:text-gray-500 text-center py-6">No task-level changes detected. The AI may have only updated project fields.</p>)}
            </div>
          )}
        </div>
        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
          {stage === 'prompt' ? (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={handlePreview} disabled={busy || !prompt.trim()} className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50" style={{ backgroundColor: brandColor }}>{busy ? <><FaSpinner className="animate-spin text-xs" /> Thinking…</> : <><FaMagic className="text-xs" /> Preview changes</>}</button>
            </>
          ) : (
            <>
              <button onClick={() => setStage('prompt')} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Back</button>
              <button onClick={handleApply} disabled={busy} className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50" style={{ backgroundColor: brandColor }}>{busy ? <><FaSpinner className="animate-spin text-xs" /> Applying…</> : <><FaCheck className="text-xs" /> Apply changes</>}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// Public viewer banner
// ══════════════════════════════════════════════════════════════
const PublicViewerBanner = ({ onSignup, onLogin }) => (
  <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-[#0d9488]/10 dark:to-[#0d9488]/5 border-b border-teal-200/60 dark:border-[#0d9488]/30 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
    <div className="flex items-center gap-2 min-w-0">
      <FaEye className="text-teal-600 dark:text-[#0d9488] shrink-0 text-sm" />
      <p className="text-[11px] sm:text-xs text-teal-800 dark:text-teal-300 truncate">
        <span className="font-semibold">Public view</span> · You're seeing this project as a guest. Sign up to interact.
      </p>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      <button onClick={onLogin} className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-teal-500/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100/60 dark:hover:bg-[#0d9488]/20 transition">Sign in</button>
      <button onClick={onSignup} className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-teal-600 dark:bg-[#0d9488] text-white hover:opacity-90 transition">Sign up</button>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════
// MAIN SCREEN — one route, one URL, server-driven visibility
// ══════════════════════════════════════════════════════════════
const WorkspaceProjectId = () => {
  // Single URL for everyone. The server decides what they can see.
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();

  // ─── Unified project read ───────────────────────────────────
  const { data: pData, isLoading: pLoad, error: pErr, refetch: refetchProject } =
    useGetProjectQuery(projectId, { skip: !projectId });

  const viewer = pData?.viewer;
  const project = pData?.project;
  const mode = pData?.mode || 'workspace';
  const isPublicMode = mode === 'public';
  const isFullMember = !!pData?.isFullMember;

  // Server-driven permissions
  const canManage = !!viewer?.canManage;
  const canAct = !!viewer?.canAct;
  const canEdit = !!viewer?.canEdit;
  const canComment = !!viewer?.canComment;
  const requiresSignup = !!viewer?.requiresSignup;

  // Workspace fetch — members only, skip for public viewers.
  const shouldFetchWorkspace = !!workspaceId && !isPublicMode;
  const { data: wData, isLoading: wLoad, error: wErr } = useGetWorkspaceQuery(workspaceId, {
    skip: !shouldFetchWorkspace,
  });

  // Tasks + folders. Same URLs — server filters by role.
  const { data: foldersData, isLoading: foldersLoading, refetch: refetchFolders } =
    useGetProjectFoldersQuery(projectId, { skip: !projectId });

  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const { data: tData, isLoading: tLoad, error: tErr, refetch: refetchTasks } = useGetProjectTasksQuery(
    { projectId, folderId: selectedFolderId || undefined },
    { skip: !projectId }
  );

  const [archiveProject] = useArchiveProjectMutation();
  const [unarchiveProject] = useUnarchiveProjectMutation();
  const [deleteProject] = useDeleteProjectMutation();
  const [restoreProject] = useRestoreProjectMutation();
  const [permanentlyDeleteProject] = usePermanentlyDeleteProjectMutation();
  const [createTask] = useCreateTaskMutation();
  const [updateTask] = useUpdateTaskMutation();
  const [deleteTask] = useDeleteTaskMutation();
  const [reorderTasks] = useReorderTasksMutation();
  const [deleteFolder] = useDeleteFolderMutation();

  const [localTasks, setLocalTasks] = useState([]);
  const [localFolders, setLocalFolders] = useState([]);
  useEffect(() => setLocalTasks(tData?.tasks || []), [tData]);
  useEffect(() => setLocalFolders(foldersData?.folders || []), [foldersData]);
  const tasks = localTasks;
  const folders = localFolders;

  const isTouch = useIsTouchDevice();

  const [searchOpen, setSearchOpen] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [showReadOnly, setShowReadOnly] = useState(false);
  const [readOnlyFolder, setReadOnlyFolder] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false });
  const [deleteTaskDialog, setDeleteTaskDialog] = useState({ isOpen: false });
  const [moveCopy, setMoveCopy] = useState({ isOpen: false, task: null, mode: 'move' });
  const [folderMenuOpen, setFolderMenuOpen] = useState(null);
  const longPress = useRef(null);

  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('projectTasksView') || 'grid'; } catch { return 'grid'; }
  });
  useEffect(() => { try { localStorage.setItem('projectTasksView', viewMode); } catch {} }, [viewMode]);

  const [actionModal, setActionModal] = useState({ isOpen: false, task: null });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiPlanOpen, setAiPlanOpen] = useState(false);
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [aiDocsOpen, setAiDocsOpen] = useState(false);
  const [aiEditOpen, setAiEditOpen] = useState(false);

  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);

  const workspace = wData?.workspace;
  const brandColor = workspace?.color || project?.color || '#0d9488';
  const isTrash = project?.isTrash || false;
  const isArchivedForMe = project?.isArchivedForMe || false;

  const assignableMembers = useMemo(() => {
    if (!project) return [];
    const mgrs = project.projectManagers || [];
    const active = (project.teamMembers || []).filter((m) => m.status === 'active');
    const all = [...active, ...mgrs.map((pm) => ({ user: pm }))];
    const seen = new Set();
    return all.filter((item) => {
      const id = item.user?._id || item._id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [project]);

  const workspaceMembers = useMemo(() => {
    if (!workspace) return [];
    return (workspace.members || []).filter((m) => m.status === 'active').map((m) => m.user || m).filter(Boolean);
  }, [workspace]);

  const canReorderTasks = canManage && !isTrash && !isArchivedForMe;
  const allowBulkActions = canManage && !isTrash && !isArchivedForMe;
  const allowSelection = allowBulkActions;

  const refreshAll = useCallback(() => { refetchTasks(); refetchProject(); refetchFolders(); }, [refetchTasks, refetchProject, refetchFolders]);

  const toggleSelection = (taskId) => {
    if (!allowSelection) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      if (next.size === 0) setSelectionMode(false);
      else setSelectionMode(true);
      return next;
    });
  };
  const startSelection = (taskId) => {
    if (!allowSelection) return;
    setSelectedIds(new Set([taskId])); setSelectionMode(true);
  };
  const clearSelection = () => { setSelectedIds(new Set()); setSelectionMode(false); };
  const handleLongPress = (taskId) => {
    if (!allowSelection) return;
    if (selectionMode) toggleSelection(taskId);
    else startSelection(taskId);
  };

  const bulkAction = async (fn, successMsg) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkLoading(true);
    let ok = 0, fail = 0;
    for (const id of ids) {
      try { await fn(id); ok++; } catch (e) { fail++; console.error(e); }
    }
    setBulkLoading(false);
    clearSelection();
    if (fail === 0) toast.success(`${successMsg} (${ok})`);
    else toast.error(`Partial: ${ok} done, ${fail} failed.`);
    refetchTasks(); refetchProject();
  };

  const bulkComplete = () => bulkAction((id) => updateTask({ taskId: id, data: { status: 'completed' } }).unwrap(), 'Completed');
  const bulkDelete = () => {
    if (!window.confirm(`Delete ${selectedIds.size} task(s)?`)) return;
    bulkAction((id) => deleteTask(id).unwrap(), 'Deleted');
  };

  const handleOpenTaskModal = (task) => setActionModal({ isOpen: true, task });
  const handleEditFromModal = (task) => { setEditingTask(task); };

  const handleEditTaskSubmit = useCallback(async (taskId, data) => {
    const assigneeIds = data.assigneeIds || [];
    const tempPatch = {
      ...data,
      assignees: assigneeIds.map((id) => {
        const found = assignableMembers.find((m) => (m.user?._id || m._id) === id);
        const u = found?.user || found;
        return u ? { _id: u._id, name: u.name, profile: u.profile } : { _id: id, name: 'Loading...' };
      }),
      folder: data.folderId
        ? (() => { const f = folders.find((x) => x._id === data.folderId); return f ? { _id: f._id, name: f.name } : null; })()
        : null,
    };
    delete tempPatch.attachments;

    const prevTasks = localTasks;
    setLocalTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, ...tempPatch } : t)));

    const fd = new FormData();
    fd.append('title', data.title);
    fd.append('description', data.description || '');
    fd.append('priority', data.priority);
    if (data.status) fd.append('status', data.status);
    fd.append('allowAssigneeEditSubtasks', data.allowAssigneeEditSubtasks ? 'true' : 'false');
    fd.append('startDate', data.startDate || '');
    fd.append('dueDate', data.dueDate || '');
    fd.append('folderId', data.folderId || '');
    fd.append('recurrenceType', data.recurrenceType || 'none');
    if (data.recurrenceType === 'weekly') fd.append('recurrenceDays', JSON.stringify(data.recurrenceDays || []));
    if (data.recurrenceEndDate) fd.append('recurrenceEndDate', data.recurrenceEndDate);
    (data.links || []).forEach((l) => fd.append('links', l));
    fd.append('assigneeIds', JSON.stringify(assigneeIds));
    if (assigneeIds[0]) fd.append('assigneeId', assigneeIds[0]);
    fd.append('linkedNotes', JSON.stringify(data.linkedNotes || []));
    if (data.attachments && data.attachments.length > 0) {
      data.attachments.forEach((f) => fd.append('attachments', f));
    }

    try {
      const result = await updateTask({ taskId, data: fd }).unwrap();
      if (result?.task) setLocalTasks((prev) => prev.map((t) => (t._id === taskId ? result.task : t)));
      toast.success('Task updated');
      refreshAll();
    } catch (err) {
      setLocalTasks(prevTasks);
      throw err;
    }
  }, [updateTask, refreshAll, assignableMembers, folders, localTasks]);

  const handleCopyFromModal = (task) => { if (!canManage) return; setMoveCopy({ isOpen: true, task, mode: 'copy' }); };
  const handleMoveFromModal = (task) => { if (!canManage) return; setMoveCopy({ isOpen: true, task, mode: 'move' }); };
  const handleArchiveTask = async (taskId) => {
    const prev = [...localTasks];
    setLocalTasks(p => p.map(t => t._id === taskId ? { ...t, isArchived: true } : t));
    try { await updateTask({ taskId, data: { isArchived: true } }).unwrap(); toast.success('Archived'); refetchTasks(); }
    catch (e) { setLocalTasks(prev); toast.error(e?.data?.message || 'Failed'); }
  };
  const handleRestoreTask = async (taskId) => {
    const prev = [...localTasks];
    setLocalTasks(p => p.map(t => t._id === taskId ? { ...t, isArchived: false, isTrash: false } : t));
    try { await updateTask({ taskId, data: { isArchived: false, isTrash: false } }).unwrap(); toast.success('Restored'); refetchTasks(); }
    catch (e) { setLocalTasks(prev); toast.error(e?.data?.message || 'Failed'); }
  };
  const bulkActionOne = async (taskId, patch, msg) => {
    const prev = [...localTasks];
    setLocalTasks(p => p.map(t => t._id === taskId ? { ...t, ...patch } : t));
    try { await updateTask({ taskId, data: patch }).unwrap(); toast.success(msg); refetchTasks(); refetchProject(); }
    catch (e) { setLocalTasks(prev); toast.error(e?.data?.message || 'Failed'); }
  };
  const handleMarkComplete = (taskId) => bulkActionOne(taskId, { status: 'completed' }, 'Completed');
  const handleMarkInProgress = (taskId) => bulkActionOne(taskId, { status: 'in-progress' }, 'Reopened');

  const handleCreateTask = useCallback(async (formData) => {
    const assigneeIds = formData.assigneeIds || [];
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      _id: tempId, title: formData.title, description: formData.description || '',
      priority: formData.priority || 'medium', status: assigneeIds.length > 0 ? 'ready_for_completion' : 'pending',
      progress: 0, assignees: assigneeIds.map((id) => ({ _id: id, name: 'Loading...' })),
      folder: formData.folderId ? { _id: formData.folderId, name: folders.find((f) => f._id === formData.folderId)?.name || 'Folder' } : null,
      dueDate: formData.dueDate || null, subTasks: [], recurrenceType: formData.recurrenceType || 'none',
      linkedNotes: formData.linkedNotes || [],
    };
    setLocalTasks((prev) => [optimistic, ...prev]);

    const fd = new FormData();
    fd.append('projectId', projectId);
    fd.append('title', formData.title);
    fd.append('description', formData.description);
    if (assigneeIds.length > 0) { fd.append('assigneeIds', JSON.stringify(assigneeIds)); fd.append('assigneeId', assigneeIds[0]); }
    fd.append('priority', formData.priority);
    fd.append('allowAssigneeEditSubtasks', formData.allowAssigneeEditSubtasks);
    if (formData.startDate) fd.append('startDate', formData.startDate);
    if (formData.dueDate) fd.append('dueDate', formData.dueDate);
    if (formData.folderId) fd.append('folderId', formData.folderId);
    fd.append('recurrenceType', formData.recurrenceType);
    if (formData.recurrenceType === 'weekly') fd.append('recurrenceDays', JSON.stringify(formData.recurrenceDays));
    if (formData.recurrenceEndDate) fd.append('recurrenceEndDate', formData.recurrenceEndDate);
    formData.links.forEach((l) => fd.append('links', l));
    formData.attachments.forEach((f) => fd.append('attachments', f));
    if (formData.linkedNotes && formData.linkedNotes.length > 0) {
      fd.append('linkedNotes', JSON.stringify(formData.linkedNotes));
    }

    try {
      const result = await createTask(fd).unwrap();
      setLocalTasks((prev) => prev.map((t) => (t._id === tempId ? result.task : t)));
      refetchTasks(); refetchProject();
    } catch (err) {
      setLocalTasks((prev) => prev.filter((t) => t._id !== tempId));
      throw err;
    }
  }, [createTask, refetchTasks, refetchProject, folders, projectId]);

  const handleDeleteFolder = useCallback((folder) => {
    setConfirmDialog({
      isOpen: true, title: 'Delete Folder', danger: true,
      message: `Delete folder "${folder.name}"? Tasks will be unlinked but not deleted.`,
      onConfirm: async () => {
        const prevFolders = folders;
        setLocalFolders((prev) => prev.filter((f) => f._id !== folder._id));
        if (selectedFolderId === folder._id) setSelectedFolderId(null);
        try { await deleteFolder(folder._id).unwrap(); toast.success('Folder deleted'); refetchFolders(); refetchTasks(); }
        catch (err) { setLocalFolders(prevFolders); toast.error(err?.data?.message || 'Failed'); }
      },
    });
  }, [folders, deleteFolder, refetchFolders, refetchTasks, selectedFolderId]);

  const handleArchive = async () => { try { await archiveProject(projectId).unwrap(); toast.success('Archived for you'); refetchProject(); } catch (e) { toast.error(e?.data?.message || 'Failed'); } setMenuOpen(false); };
  const handleUnarchive = async () => { try { await unarchiveProject(projectId).unwrap(); toast.success('Unarchived'); refetchProject(); } catch (e) { toast.error(e?.data?.message || 'Failed'); } setMenuOpen(false); };

  const handleTrash = () => {
    setConfirmDialog({
      isOpen: true, title: 'Move to Trash',
      message: `Move "${project?.name}" to trash? You can restore it within 30 days.`,
      onConfirm: async () => {
        try {
          await deleteProject(projectId).unwrap();
          toast.success('Moved to trash');
          navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/projects`);
        } catch (e) { toast.error(e?.data?.message || 'Failed'); }
      },
    });
    setMenuOpen(false);
  };
  const handleRestore = () => {
    setConfirmDialog({
      isOpen: true, title: 'Restore Project',
      message: `Restore "${project?.name}" from trash?`,
      onConfirm: async () => { try { await restoreProject(projectId).unwrap(); toast.success('Restored'); refetchProject(); } catch (e) { toast.error(e?.data?.message || 'Failed'); } },
    });
    setMenuOpen(false);
  };
  const handlePermanentDelete = () => {
    setConfirmDialog({
      isOpen: true, title: 'Permanently Delete', danger: true,
      message: `Permanently delete "${project?.name}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await permanentlyDeleteProject(projectId).unwrap();
          toast.success('Deleted');
          navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/projects`);
        } catch (e) { toast.error(e?.data?.message || 'Failed'); }
      },
    });
    setMenuOpen(false);
  };

  const handleDeleteTask = (task) => {
    setDeleteTaskDialog({
      isOpen: true, taskName: task.title,
      onConfirm: async () => { try { await deleteTask(task._id).unwrap(); toast.success('Deleted'); refetchTasks(); refetchProject(); } catch (e) { toast.error(e?.data?.message || 'Failed'); } },
    });
  };

  const handleMoveCopyConfirm = async (folderId) => {
    const task = moveCopy.task;
    if (!task) return;
    try {
      if (moveCopy.mode === 'move') {
        await updateTask({ taskId: task._id, data: { folderId: folderId || null } }).unwrap();
        toast.success(`Moved to ${folderId ? folders.find((f) => f._id === folderId)?.name || 'folder' : 'Uncategorized'}`);
      } else {
        const fd = new FormData();
        fd.append('projectId', projectId);
        fd.append('title', task.title);
        fd.append('description', task.description || '');
        fd.append('priority', task.priority || 'medium');
        fd.append('allowAssigneeEditSubtasks', task.allowAssigneeEditSubtasks ? 'true' : 'false');
        if (task.startDate) fd.append('startDate', task.startDate);
        if (task.dueDate) fd.append('dueDate', task.dueDate);
        if (folderId) fd.append('folderId', folderId);
        fd.append('recurrenceType', task.recurrenceType || 'none');
        if (task.recurrenceType === 'weekly') fd.append('recurrenceDays', JSON.stringify(task.recurrenceDays || []));
        (task.links || []).forEach((l) => fd.append('links', l));
        const assigneeIds = (task.assignees || []).map((a) => a._id || a).filter(Boolean);
        fd.append('assigneeIds', JSON.stringify(assigneeIds));
        if (assigneeIds[0]) fd.append('assigneeId', assigneeIds[0]);
        if (task.linkedNotes && task.linkedNotes.length > 0) {
          fd.append('linkedNotes', JSON.stringify(
            task.linkedNotes.map((ln) => ({ noteId: ln.note?._id || ln.note, source: ln.source }))
          ));
        }
        await createTask(fd).unwrap();
        toast.success(`Copied to ${folderId ? folders.find((f) => f._id === folderId)?.name || 'folder' : 'Uncategorized'}`);
      }
      refreshAll();
    } catch (err) { toast.error(err?.data?.message || `Failed to ${moveCopy.mode}`); }
    setMoveCopy({ isOpen: false, task: null, mode: 'move' });
  };

  const onTaskDragStart = (e, task) => { if (!canReorderTasks) { e.preventDefault(); toast.error('No permission to reorder'); return; } setDraggedTaskId(task._id); };
  const onTaskDragEnd = () => { setDraggedTaskId(null); setDragOverTaskId(null); };
  const onTaskDragOver = (e, task) => { if (draggedTaskId && draggedTaskId !== task._id) setDragOverTaskId(task._id); };
  const onTaskDrop = async (e, target) => {
    const draggedId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDragOverTaskId(null);
    if (!draggedId || draggedId === target._id) return;
    const prev = tasks;
    const di = prev.findIndex((t) => t._id === draggedId), ti = prev.findIndex((t) => t._id === target._id);
    if (di === -1 || ti === -1) return;
    const next = [...prev];
    const [moved] = next.splice(di, 1);
    next.splice(ti, 0, moved);
    setLocalTasks(next);
    setDraggedTaskId(null);
    try { await reorderTasks({ projectId, orderedTaskIds: next.map((t) => t._id) }).unwrap(); refetchTasks(); }
    catch (err) { toast.error(err?.data?.message || 'Failed to reorder'); setLocalTasks(prev); }
  };

  const handleTouchStart = (id) => { longPress.current = setTimeout(() => { setFolderMenuOpen(id); if (navigator.vibrate) navigator.vibrate(50); }, 600); };
  const clearTouch = () => clearTimeout(longPress.current);

  const errorInfo = useMemo(() => {
    const err = pErr || wErr;
    if (!err) return null;

    const status = err?.status;
    const serverMessage = err?.data?.message || err?.error || 'Something went wrong while loading this project.';

    if (status === 403) return { kind: 'denied', title: 'Access Denied', message: serverMessage || "You don't have permission to view this project.", icon: FaUserLock, tone: 'error' };
    if (status === 404) return { kind: 'notfound', title: 'Project Not Found', message: serverMessage || 'This project may have been deleted or moved.', icon: FaExclamationTriangle, tone: 'warn' };
    if (status === 410) return { kind: 'revoked', title: 'Invite no longer valid', message: serverMessage || 'This project link has been revoked.', icon: FaExclamationTriangle, tone: 'warn' };
    return { kind: 'error', title: 'Something went wrong', message: serverMessage, icon: FaExclamationTriangle, tone: 'error' };
  }, [pErr, wErr]);

  if (errorInfo) {
    return (
      <>
        <GlobalStyles />
        <ErrorScreen
          title={errorInfo.title}
          message={errorInfo.message}
          icon={errorInfo.icon}
          tone={errorInfo.tone}
          onRetry={errorInfo.kind !== 'denied' ? () => { refetchProject(); } : undefined}
          onBack={() => navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/projects`, { replace: true })}
        />
      </>
    );
  }

  if (!projectId || !workspaceId) {
    return (
      <>
        <GlobalStyles />
        <ErrorScreen title="Invalid project link" message="This URL is missing a project identifier." onBack={() => navigate(-1)} />
      </>
    );
  }

  if (pLoad || tLoad || foldersLoading || (shouldFetchWorkspace && wLoad)) {
    return (<><GlobalStyles /><ProjectSkeleton brandColor={brandColor} hideWorkspaceChrome={isPublicMode} /></>);
  }
  if (!project) return null;

  return (
    <>
      <GlobalStyles />

      <div className={`h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col overflow-hidden ${isPublicMode ? '' : 'lg:flex-row'}`}>
        {/* Workspace sidebar only for members */}
        {!isPublicMode && workspace && (
          <div className="hidden md:block md:min-h-screen fixed top-0 left-0 z-20 workspace-shell-sidebar">
            <WorkspaceSidebar workspace={workspace} chats={[]} />
          </div>
        )}

        <div className={`flex-1 flex flex-col h-full overflow-hidden ${isPublicMode ? '' : 'md:ml-[260px] workspace-shell-main'}`}>
          {isPublicMode && (
            <PublicViewerBanner
              onSignup={() => navigate('/signup')}
              onLogin={() => navigate('/login')}
            />
          )}

          <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 shrink-0">
            {selectionMode && allowSelection ? (
              <BulkToolbar
                selectedCount={selectedIds.size}
                onCancel={clearSelection}
                onComplete={bulkComplete}
                onDelete={bulkDelete}
              />
            ) : (
              <div className="flex items-center justify-between px-3 md:px-4 h-14 lg:h-16">
                <div className="flex items-center gap-2 min-w-0">
                  {!isPublicMode && workspaceId && (
                    <button onClick={() => navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/projects`)} className="p-1 lg:hidden text-gray-500 dark:text-gray-400"><FaArrowLeft className="text-sm" /></button>
                  )}
                  {project.coverImage ? (
                    <img src={project.coverImage} className="w-8 h-8 md:w-10 md:h-10 rounded-xl object-cover" alt="" />
                  ) : (
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: brandColor }}><FaFolder /></div>
                  )}
                  <div className="min-w-0">
                    <h1 className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[140px] md:max-w-xs flex items-center gap-1.5 flex-wrap">
                      <span className="truncate">{project.name}</span>
                      {isPublicMode && (<span className="text-[10px] font-normal text-teal-600 dark:text-[#0d9488] bg-teal-50 dark:bg-[#0d9488]/15 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"><FaEye className="text-[8px]" /> Public</span>)}
                      {!isPublicMode && viewer?.role?.startsWith('associate') && (<span className="text-[10px] font-normal text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"><FaUserShield className="text-[8px]" /> Associate</span>)}
                      {isArchivedForMe && <span className="text-[10px] font-normal text-gray-400 bg-gray-100 dark:bg-gray-800/40 px-1.5 py-0.5 rounded-full">Archived</span>}
                      {isTrash && <span className="text-[10px] font-normal text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full">Trash</span>}
                    </h1>
                    {!isPublicMode && workspaceId ? (
                      <button onClick={() => navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/project/${projectId}/team`)} className="flex items-center gap-1 text-[10px] md:text-xs text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-[#0d9488] transition">
                        <FaUsers className="text-[9px]" /> Team <FaChevronRight className="text-[8px]" />
                        <span className="w-0.5 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-full ml-1" /> {project.progress || 0}% done
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                        <FaTasks className="text-[9px]" />
                        <span>{project.progress || 0}% done</span>
                        {project.taskStats && (<span className="ml-1">· {project.taskStats.totalTasks} tasks</span>)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <ViewToggle view={viewMode} onChange={setViewMode} />
                  <button onClick={() => setSearchOpen(true)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl"><FaSearch className="text-xs md:text-sm" /></button>
                  {canManage && !isTrash && !isArchivedForMe && (
                    <button onClick={() => setAiMenuOpen(true)} className="p-1.5 text-teal-600 dark:text-[#0d9488] hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 rounded-xl" title="AI Assistant"><FaMagic className="text-xs md:text-sm" /></button>
                  )}
                  {canManage && !isTrash && !isArchivedForMe && (
                    <button onClick={() => setShowCreateTask(true)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl"><FaPlus className="text-xs md:text-sm" /></button>
                  )}
                  <button onClick={() => setMenuOpen(true)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl"><FaEllipsisV className="text-xs md:text-sm" /></button>
                </div>
              </div>
            )}
          </header>

          {/* Folders bar — workspace members only */}
          {!selectionMode && !isPublicMode && (
            <div className="border-b border-gray-200/60 dark:border-gray-800/30 px-3 py-2 bg-gray-50 dark:bg-[#14141a]/60 shrink-0">
              <div className="flex items-center mb-1">
                <span className="text-[10px] md:text-xs font-medium text-gray-500 uppercase">Folders</span>
              </div>
              <div className="flex flex-nowrap overflow-x-auto gap-1.5 pb-1 scrollbar-hide">
                {canManage && !isTrash && !isArchivedForMe && (
                  <button onClick={() => { setEditingFolder(null); setShowFolderForm(true); }}
                    className="text-[10px] md:text-xs px-2.5 py-1 rounded-md border border-dashed border-teal-500/70 text-teal-700 dark:text-[#0d9488] hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 flex items-center gap-1 whitespace-nowrap shrink-0 transition font-medium"
                    title="Create new folder">
                    <FaPlus className="text-[8px]" /> Folder
                  </button>
                )}
                <button onClick={() => setSelectedFolderId(null)}
                  className={`text-[10px] md:text-xs px-2.5 py-1 rounded-md border whitespace-nowrap shrink-0 ${!selectedFolderId ? 'bg-teal-600 dark:bg-[#0d9488] text-white border-teal-600' : 'bg-gray-100 dark:bg-[#1e1e26] border-gray-300 dark:border-gray-700/60 text-gray-700 dark:text-gray-300'}`}>
                  All
                </button>
                {folders.map((f) => (
                  <div key={f._id} className="relative flex items-center shrink-0">
                    <button onClick={() => setSelectedFolderId(selectedFolderId === f._id ? null : f._id)}
                      onTouchStart={() => handleTouchStart(f._id)} onTouchEnd={clearTouch} onTouchMove={clearTouch}
                      className={`text-[10px] md:text-xs px-2.5 py-1 rounded-md border flex items-center gap-1 whitespace-nowrap ${selectedFolderId === f._id ? 'bg-teal-600 dark:bg-[#0d9488] text-white border-teal-600' : 'bg-gray-100 dark:bg-[#1e1e26] border-gray-300 dark:border-gray-700/60 text-gray-700 dark:text-gray-300'}`}>
                      <FaFolder className="text-[8px]" /><span className="truncate max-w-[60px] md:max-w-[100px]">{f.name}</span>
                    </button>
                    {canManage && !isTrash && !isArchivedForMe && (
                      <div className="hidden md:flex items-center gap-0.5 ml-0.5">
                        <button onClick={() => { setEditingFolder(f); setShowFolderForm(true); }} className="p-0.5 text-gray-400 hover:text-blue-500"><FaEdit className="text-[8px]" /></button>
                        <button onClick={() => { setReadOnlyFolder(f); setShowReadOnly(true); }} className="p-0.5 text-gray-400 hover:text-teal-500"><FaUserLock className="text-[8px]" /></button>
                        <button onClick={() => handleDeleteFolder(f)} className="p-0.5 text-gray-400 hover:text-red-500"><FaTrashAlt className="text-[8px]" /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {folderMenuOpen && canManage && !isTrash && !isArchivedForMe && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setFolderMenuOpen(null)}>
                  <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-sm w-full p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { const f = folders.find((x) => x._id === folderMenuOpen); setFolderMenuOpen(null); setEditingFolder(f); setShowFolderForm(true); }} className="flex items-center gap-3 w-full px-4 py-3 bg-gray-50 dark:bg-[#1a1a24] rounded-xl mb-2"><FaEdit className="text-blue-500" /> Edit Folder</button>
                    <button onClick={() => { const f = folders.find((x) => x._id === folderMenuOpen); setFolderMenuOpen(null); setReadOnlyFolder(f); setShowReadOnly(true); }} className="flex items-center gap-3 w-full px-4 py-3 bg-gray-50 dark:bg-[#1a1a24] rounded-xl mb-2"><FaUserLock className="text-teal-500" /> Read‑Only Users</button>
                    <button onClick={() => { const f = folders.find((x) => x._id === folderMenuOpen); setFolderMenuOpen(null); if (f) handleDeleteFolder(f); }} className="flex items-center gap-3 w-full px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400 mb-2"><FaTrashAlt className="text-xs" /> Delete Folder</button>
                    <button onClick={() => setFolderMenuOpen(null)} className="w-full py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Task list */}
          <div className={`flex-1 overflow-y-auto ${viewMode === 'list' ? 'pb-24 md:pb-4' : 'p-2 sm:p-3 md:p-4 pb-24 md:pb-4'}`}>
            {tErr ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                  tErr?.status === 403 ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                }`}>
                  {tErr?.status === 403 ? <FaUserLock className="text-2xl" /> : <FaExclamationTriangle className="text-2xl" />}
                </div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  {tErr?.status === 403 ? "You can't view these tasks" : "Couldn't load tasks"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm break-words mb-4">
                  {tErr?.data?.message || (tErr?.status === 403 ? "You don't have permission to view tasks in this project." : 'Please try again in a moment.')}
                </p>
                <button onClick={() => refetchTasks()} className="px-4 py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl text-sm font-medium hover:opacity-90 transition">Try again</button>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <FaTasks className="text-3xl md:text-4xl mb-2 opacity-30" />
                <p className="text-xs md:text-sm">
                  {viewer?.role?.startsWith('associate') ? "No tasks assigned to you yet" : isPublicMode ? 'No tasks to display' : `No tasks ${selectedFolderId ? 'in this folder' : 'yet'}`}
                </p>
                {viewer?.role?.startsWith('associate') && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-1 max-w-xs text-center">When a manager assigns you work, it will appear here.</p>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {tasks.map((task) => (
                  <TaskCard
                    key={task._id} task={task} view="grid" brandColor={brandColor}
                    onClick={() => navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/project/${projectId}/task/${task._id}`)}
                    onOpenModal={handleOpenTaskModal}
                    draggable={canReorderTasks} onDragStart={onTaskDragStart} onDragEnd={onTaskDragEnd}
                    onDragOver={onTaskDragOver} onDragLeave={() => setDragOverTaskId(null)} onDrop={onTaskDrop}
                    dragOver={dragOverTaskId === task._id}
                    onCopy={handleCopyFromModal}
                    onMove={handleMoveFromModal}
                    isSelected={selectedIds.has(task._id)}
                    onLongPress={handleLongPress}
                    isTouch={isTouch}
                    selectionMode={selectionMode}
                    onTap={toggleSelection}
                    allowSelection={allowSelection}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-[#0f0f12]">
                {tasks.map((task) => (
                  <TaskCard
                    key={task._id} task={task} view="list" brandColor={brandColor}
                    onClick={() => navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/project/${projectId}/task/${task._id}`)}
                    onOpenModal={handleOpenTaskModal}
                    draggable={canReorderTasks} onDragStart={onTaskDragStart} onDragEnd={onTaskDragEnd}
                    onDragOver={onTaskDragOver} onDragLeave={() => setDragOverTaskId(null)} onDrop={onTaskDrop}
                    dragOver={dragOverTaskId === task._id}
                    onCopy={handleCopyFromModal}
                    onMove={handleMoveFromModal}
                    isSelected={selectedIds.has(task._id)}
                    onLongPress={handleLongPress}
                    isTouch={isTouch}
                    selectionMode={selectionMode}
                    onTap={toggleSelection}
                    allowSelection={allowSelection}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Workspace bottombar only for members */}
        {!isPublicMode && workspace && <WorkspaceBottombar workspace={workspace} />}

        <SearchOverlay
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          tasks={tasks}
          brandColor={brandColor}
          onSelect={(id) => navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/project/${projectId}/task/${id}`)}
        />

        {!isPublicMode && (
          <>
            <CreateTaskModal
              isOpen={showCreateTask && canManage}
              onClose={() => setShowCreateTask(false)}
              projectId={projectId}
              workspaceId={workspaceId}
              brandColor={brandColor}
              assignableMembers={assignableMembers}
              folders={folders}
              onSubmit={handleCreateTask}
              onFolderCreated={refetchFolders}
            />

            <EditTaskModal
              isOpen={!!editingTask && canManage}
              onClose={() => setEditingTask(null)}
              task={editingTask}
              projectId={projectId}
              workspaceId={workspaceId}
              brandColor={brandColor}
              assignableMembers={assignableMembers}
              folders={folders}
              onSubmit={handleEditTaskSubmit}
              onFolderCreated={refetchFolders}
            />

            <FolderFormModal isOpen={showFolderForm && canManage} onClose={() => { setShowFolderForm(false); setEditingFolder(null); }} onSuccess={refetchFolders} folder={editingFolder} brandColor={brandColor} projectId={projectId} />
            <FolderReadOnlyModal isOpen={showReadOnly && canManage} onClose={() => { setShowReadOnly(false); setReadOnlyFolder(null); }} folder={readOnlyFolder} project={project} brandColor={brandColor} onSuccess={refetchFolders} />
            <FolderSelectModal isOpen={moveCopy.isOpen && canManage} onClose={() => setMoveCopy({ isOpen: false, task: null, mode: 'move' })} folders={folders} onSelect={handleMoveCopyConfirm} title={moveCopy.mode === 'copy' ? 'Copy task to folder' : 'Move task to folder'} />
            <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog({ isOpen: false })} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} message={confirmDialog.message} danger={confirmDialog.danger} />
            <DeleteTaskDialog isOpen={deleteTaskDialog.isOpen} onClose={() => setDeleteTaskDialog({ isOpen: false })} onConfirm={deleteTaskDialog.onConfirm} taskName={deleteTaskDialog.taskName} />

            <TaskActionModal
              isOpen={actionModal.isOpen}
              onClose={() => setActionModal({ isOpen: false, task: null })}
              task={actionModal.task}
              viewer={viewer}
              isTrash={isTrash}
              isArchivedForMe={isArchivedForMe}
              onEdit={handleEditFromModal}
              onCopy={handleCopyFromModal}
              onMove={handleMoveFromModal}
              onDelete={handleDeleteTask}
              onArchive={handleArchiveTask}
              onRestore={handleRestoreTask}
              onPermanentDelete={handleDeleteTask}
              onSelect={startSelection}
              onMarkComplete={!isArchivedForMe ? handleMarkComplete : undefined}
              onMarkInProgress={!isArchivedForMe ? handleMarkInProgress : undefined}
              brandColor={brandColor}
            />

            <AIMenu
              isOpen={aiMenuOpen && canManage}
              onClose={() => setAiMenuOpen(false)}
              canManage={canManage}
              brandColor={brandColor}
              onPlan={() => setAiPlanOpen(true)}
              onSummary={() => setAiSummaryOpen(true)}
              onReview={() => setAiReviewOpen(true)}
              onDocs={() => setAiDocsOpen(true)}
              onEdit={() => setAiEditOpen(true)}
            />
            <AIPlanModal
              isOpen={aiPlanOpen && canManage}
              onClose={() => setAiPlanOpen(false)}
              workspaceId={workspaceId}
              workspaceMembers={workspaceMembers}
              brandColor={brandColor}
              onExecuted={(proj) => { refreshAll(); if (proj?._id) navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/project/${proj._id}`); }}
            />
            <AISummaryModal isOpen={aiSummaryOpen} onClose={() => setAiSummaryOpen(false)} projectId={projectId} brandColor={brandColor} />
            <AIReviewModal isOpen={aiReviewOpen && canManage} onClose={() => setAiReviewOpen(false)} projectId={projectId} brandColor={brandColor} />
            <AIDocsModal isOpen={aiDocsOpen} onClose={() => setAiDocsOpen(false)} projectId={projectId} brandColor={brandColor} />
            <AIProjectEditModal isOpen={aiEditOpen && canManage} onClose={() => setAiEditOpen(false)} projectId={projectId} brandColor={brandColor} onApplied={() => { refreshAll(); }} />

            {menuOpen && (
              <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)}>
                <div className="bg-white dark:bg-[#14141a] rounded-t-2xl md:rounded-2xl w-full md:max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 truncate pr-4">{project.name}</h3>
                    <button onClick={() => setMenuOpen(false)} className="p-1.5 text-gray-500"><FaTimes /></button>
                  </div>
                  <div className="space-y-1">
                    {isTrash ? (
                      canManage && (
                        <>
                          <button onClick={handleRestore} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[#0d9488] hover:bg-[#0d9488]/10"><FaTrashRestore /> Restore</button>
                          <button onClick={handlePermanentDelete} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 hover:bg-red-500/10"><FaTrashAlt /> Delete Permanently</button>
                        </>
                      )
                    ) : (
                      <>
                        {isArchivedForMe ? (
                          <button onClick={handleUnarchive} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[#0d9488] hover:bg-[#0d9488]/10"><FaUndo /> Unarchive</button>
                        ) : (
                          <button onClick={handleArchive} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30"><FaArchive /> Archive for me</button>
                        )}
                        {canManage && <button onClick={handleTrash} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-yellow-600 hover:bg-yellow-500/10"><FaTrashAlt /> Move to Trash</button>}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!selectionMode && canManage && !isTrash && !isArchivedForMe && (
              <button
                onClick={() => setShowCreateTask(true)}
                className="fixed right-4 sm:right-6 bottom-20 md:bottom-6 z-20 w-12 h-12 text-white rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition active:scale-95"
                style={{ backgroundColor: brandColor }}
              >
                <FaPlus className="text-xl" />
              </button>
            )}

            {bulkLoading && (
              <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 shadow-xl flex flex-col items-center">
                  <FaSpinner className="animate-spin text-teal-500 text-4xl mb-3" />
                  <p className="text-sm text-gray-700 dark:text-gray-300">Processing bulk action...</p>
                </div>
              </div>
            )}

            {isTouch && allowSelection && !selectionMode && tasks.length > 0 && !tErr && (
              <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-10 bg-black/70 dark:bg-[#14141a]/90 backdrop-blur-md text-white text-[11px] px-3 py-1.5 rounded-full flex items-center gap-2 pointer-events-none shadow-lg">
                <FaHandPointer className="text-[10px]" />
                <span><strong>Tap ↓</strong> for options · <strong>Long-press</strong> to select</span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default WorkspaceProjectId;
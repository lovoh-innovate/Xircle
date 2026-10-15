import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';
import {
  FaArrowLeft, FaEllipsisV, FaEdit, FaTrashAlt, FaBell, FaUserPlus,
  FaTasks, FaPlus, FaCheck, FaCheckDouble, FaCheckCircle, FaTimes,
  FaAngleDown, FaFolder, FaFolderOpen, FaCalendarAlt, FaRegClock,
  FaRedo, FaClock, FaGripVertical, FaUser, FaFlag, FaFire, FaCamera,
  FaLink, FaPaperclip, FaExclamationTriangle, FaListUl, FaCommentDots,
  FaMagic, FaMousePointer, FaStickyNote, FaUsers, FaAngleLeft, FaAngleRight,
  FaEye, FaUserShield, FaLock, FaSignInAlt,
} from 'react-icons/fa';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetProjectByIdQuery } from '../slices/projectApiSlice';
import {
  useGetTaskByIdQuery,
  useGetTaskFeedbackQuery,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useAssignTaskMutation,
  useMarkTaskCompletedMutation,
  useConfirmTaskCompletionMutation,
  useRejectTaskMutation,
  useSendManualReminderMutation,
  useAddSubTaskMutation,
  useUpdateSubTaskMutation,
  useMarkSubTaskDoneMutation,
  useConfirmSubTaskMutation,
  useRejectSubTaskMutation,
  useDeleteSubTaskMutation,
  useReorderSubTasksMutation,
  useGetProjectFoldersQuery,
} from '../slices/taskApiSlice';
import {
  useEditTaskWithAIMutation,
  useApplyTaskEditsMutation,
} from '../slices/aiApiSlice';
import { useGetNotesQuery } from '../slices/personalNoteApiSlice';
import { useGetWorkspaceNotesQuery } from '../slices/workspaceNoteApiSlice';
import { useMediaPicker } from '../hooks/useMediaPicker';

const fmtDateTime = (d) => (!d ? 'N/A' : new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
const fmtDate = (d) => (!d ? 'N/A' : new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
const getFirstName = (name) => {
  if (!name) return 'someone';
  return String(name).trim().split(/\s+/)[0] || 'someone';
};

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
const StatusPill = ({ status }) => { const s = STATUS_MAP[status] || STATUS_MAP.pending; return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${s.c}`}>{s.label}</span>; };
const PriorityPill = ({ priority }) => { const p = PRIORITY_MAP[priority] || PRIORITY_MAP.medium; return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${p.c}`}>{p.label}</span>; };
const priorityOptions = [
  { value: 'low', label: 'Low', icon: <FaFlag className="text-blue-400" /> },
  { value: 'medium', label: 'Medium', icon: <FaFlag className="text-yellow-400" /> },
  { value: 'high', label: 'High', icon: <FaFire className="text-red-400" /> },
  { value: 'urgent', label: 'Urgent', icon: <FaFire className="text-red-500" /> },
];
const statusOptions = [
  { value: 'pending', label: 'Pending' }, { value: 'in-progress', label: 'In Progress' },
  { value: 'ready_for_completion', label: 'Ready' }, { value: 'completed', label: 'Completed' },
  { value: 'confirmed_completed', label: 'Confirmed' }, { value: 'cancelled', label: 'Cancelled' },
];

// ═══════════════════════════════════════════════════════════════
// NOTE RICH CSS
// ═══════════════════════════════════════════════════════════════
const buildTableCss = (S, { dark = true } = {}) => `
${S} {
  --tb-def-border: #d1d5db;
  --tb-def-head-bg: #f3f4f6;
  --tb-def-head-color: #111827;
  --tb-def-stripe: rgba(0, 0, 0, 0.04);
}
${dark ? `.dark ${S} {
  --tb-def-border: #3f3f46;
  --tb-def-head-bg: #27272a;
  --tb-def-head-color: #f4f4f5;
  --tb-def-stripe: rgba(255, 255, 255, 0.05);
}` : ''}
${S} .tableWrapper { overflow-x: auto; }
${S} table {
  border-collapse: collapse;
  table-layout: fixed;
  max-width: 100%;
  margin: 12px 0;
  border: var(--tb-bw, 1px) var(--tb-bs, solid) var(--tb-border, var(--tb-def-border));
  color: var(--tb-color, inherit);
}
${S} table[data-align="left"] { margin-left: 0; margin-right: auto; }
${S} table[data-align="center"] { margin-left: auto; margin-right: auto; }
${S} table[data-align="right"] { margin-left: auto; margin-right: 0; }
${S} td, ${S} th {
  border: var(--tb-bw, 1px) var(--tb-bs, solid) var(--tb-border, var(--tb-def-border));
  padding: 8px 10px;
  vertical-align: top;
  text-align: left;
  position: relative;
  box-sizing: border-box;
  min-width: 0;
  overflow-wrap: anywhere;
  background-color: var(--tb-bg, transparent);
  color: var(--tb-color, inherit);
}
${S} th {
  background-color: var(--tb-head-bg, var(--tb-def-head-bg));
  color: var(--tb-head-color, var(--tb-def-head-color));
  font-weight: 600;
}
${S} table[data-density="compact"] td, ${S} table[data-density="compact"] th { padding: 4px 6px; }
${S} table[data-density="roomy"] td, ${S} table[data-density="roomy"] th { padding: 14px 16px; }
${S} table[data-striped="true"] tbody tr:nth-child(even) td {
  background-image: linear-gradient(var(--tb-stripe, var(--tb-def-stripe)), var(--tb-stripe, var(--tb-def-stripe)));
}
${S} td p, ${S} th p { margin: 4px 0; }
${S} td > :first-child, ${S} th > :first-child { margin-top: 0; }
${S} td > :last-child, ${S} th > :last-child { margin-bottom: 0; }
${S} td ul, ${S} td ol, ${S} th ul, ${S} th ol { margin: 2px 0; }
`;

const CALLOUT_ICON_MASKS = {
  lightbulb: "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 18h6'/%3E%3Cpath d='M10 22h4'/%3E%3Cpath d='M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14'/%3E%3C/svg%3E",
  info: "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 16v-4'/%3E%3Cpath d='M12 8h.01'/%3E%3C/svg%3E",
  warning: "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/%3E%3Cline x1='12' y1='9' x2='12' y2='13'/%3E%3Cline x1='12' y1='17' x2='12.01' y2='17'/%3E%3C/svg%3E",
  success: "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/%3E%3Cpolyline points='22 4 12 14.01 9 11.01'/%3E%3C/svg%3E",
  danger: "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='15' y1='9' x2='9' y2='15'/%3E%3Cline x1='9' y1='9' x2='15' y2='15'/%3E%3C/svg%3E",
  note: "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/%3E%3Cpolyline points='14 2 14 8 20 8'/%3E%3C/svg%3E",
};

const buildCalloutCss = (S, { dark = true } = {}) => {
  const maskRules = Object.entries(CALLOUT_ICON_MASKS)
    .map(([name, mask]) => `${S} [data-callout][data-icon="${name}"] { --callout-icon-mask: url("data:image/svg+xml;utf8,${mask}"); }`)
    .join('\n');

  return `
${S} { --callout-def-bg: #f0fdfa; --callout-def-border: #14b8a6; --callout-def-text: #0f172a; }
${dark ? `.dark ${S} { --callout-def-bg: #042f2e; --callout-def-border: #14b8a6; --callout-def-text: #d1faf5; }` : ''}
${S} [data-callout] {
  position: relative;
  margin: 22px 0 16px;
  padding: 14px 18px;
  border-radius: 8px;
  background-color: var(--callout-bg, var(--callout-def-bg));
  border-left: 4px solid var(--callout-border, var(--callout-def-border));
  color: var(--callout-color, var(--callout-def-text));
  transition: box-shadow 120ms ease;
}
${S} [data-callout]::before, ${S} [data-callout]::after {
  content: '';
  position: absolute;
  top: -13px;
  right: 12px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  opacity: 0;
  transform: translateY(3px);
  transition: opacity 160ms ease, transform 160ms ease;
  pointer-events: none;
}
${S} [data-callout]::before {
  background-color: var(--callout-border, var(--callout-def-border));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16), 0 0 0 2px rgba(255, 255, 255, 0.6);
}
${S} [data-callout]::after {
  background-color: #ffffff;
  -webkit-mask-image: var(--callout-icon-mask);
  -webkit-mask-size: 58%;
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-image: var(--callout-icon-mask);
  mask-size: 58%;
  mask-position: center;
  mask-repeat: no-repeat;
}
.dark ${S} [data-callout]::before { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(24, 24, 27, 0.6); }
${S} [data-callout]:hover::before, ${S} [data-callout]:hover::after { opacity: 1; transform: translateY(0); }
@media (hover: none) {
  ${S} [data-callout]::before, ${S} [data-callout]::after { opacity: 1; transform: translateY(0); }
}
${maskRules}
${S} [data-callout] > :first-child { margin-top: 0; }
${S} [data-callout] > :last-child { margin-bottom: 0; }
${S} [data-callout] p { margin: 0.35rem 0; }
${S} [data-callout] p:first-child { margin-top: 0; }
${S} [data-callout] p:last-child { margin-bottom: 0; }
`;
};

const NOTE_RICH_CSS = `
.note-rich { line-height: 1.6; }
.note-rich .note-content {
  outline: none;
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  line-height: 1.6;
  color: inherit;
}
.note-rich .note-content p { margin: 0.5rem 0; line-height: 1.6; }
.note-rich .note-content > p:first-child { margin-top: 0; }
.note-rich .note-content > p:last-child  { margin-bottom: 0; }
.note-rich .note-content p:empty::after { content: '\\200B'; display: inline; }
.note-rich .note-content ul, .note-rich .note-content ol { margin: 0.5rem 0; padding-left: 1.5rem; }
.note-rich .note-content ul { list-style: disc; }
.note-rich .note-content ol { list-style: decimal; }
.note-rich .note-content li { margin: 0.125rem 0; line-height: 1.6; }
.note-rich .note-content li > p, .note-rich .note-content li > p:first-child, .note-rich .note-content li > p:last-child { margin: 0; }
.note-rich .note-content h1 { font-size: 1.875rem; font-weight: 700; line-height: 1.3; margin: 1.25rem 0 0.5rem; }
.note-rich .note-content h2 { font-size: 1.5rem; font-weight: 700; line-height: 1.3; margin: 1rem 0 0.5rem; }
.note-rich .note-content h3 { font-size: 1.25rem; font-weight: 600; line-height: 1.3; margin: 0.875rem 0 0.5rem; }
.note-rich .note-content h1:first-child, .note-rich .note-content h2:first-child, .note-rich .note-content h3:first-child { margin-top: 0; }
.note-rich .note-content a { color: #0d9488; text-decoration: underline; }
.note-rich .note-content img { max-width: 100%; border-radius: 0.5rem; }
` + buildTableCss('.note-rich') + buildCalloutCss('.note-rich');

const EMOJI_TO_ICON_NAME = {
  '💡': 'lightbulb',
  'ℹ️': 'info', 'ℹ': 'info',
  '⚠️': 'warning', '⚠': 'warning',
  '✅': 'success', '✔️': 'success', '✔': 'success',
  '❌': 'danger', '✖️': 'danger', '✖': 'danger',
  '📝': 'note', '📄': 'note', '📌': 'note',
  '🔥': 'warning', '⭐': 'success', '🌟': 'success',
  '🎯': 'success', '❓': 'info', '🚀': 'success',
};

const migrateCalloutIcons = (html) => {
  if (!html || typeof html !== 'string') return html || '';
  if (!html.includes('data-callout')) return html;
  if (typeof document === 'undefined') return html;

  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const callouts = tmp.querySelectorAll('[data-callout]');
  let changed = false;

  callouts.forEach((el) => {
    const raw = el.getAttribute('data-icon');
    if (!raw) { el.setAttribute('data-icon', 'lightbulb'); changed = true; return; }
    const migrated = EMOJI_TO_ICON_NAME[raw];
    if (migrated && migrated !== raw) { el.setAttribute('data-icon', migrated); changed = true; }
  });

  return changed ? tmp.innerHTML : html;
};

const GlobalStyles = () => (
  <style>{`
    .skeleton { position: relative; overflow: hidden; background-color: rgb(229 231 235); }
    .dark .skeleton { background-color: rgba(255, 255, 255, 0.07); }
    .skeleton::after {
      content: ''; position: absolute; inset: 0; transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
      animation: skeletonShimmer 1.5s ease-in-out infinite;
    }
    .dark .skeleton::after { background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.07), transparent); }
    @keyframes skeletonShimmer { 100% { transform: translateX(100%); } }
    @media (prefers-reduced-motion: reduce) { .skeleton::after { animation: none; } }
  `}</style>
);

const Skeleton = ({ className = '' }) => (<div className={`skeleton rounded-lg ${className}`} />);

const TaskSummarySkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1.5"><Skeleton className="h-2.5 w-14" /><Skeleton className="h-3.5 w-24" /></div>
      ))}
    </div>
    <div>
      <Skeleton className="h-2.5 w-16 mb-2" />
      <div className="flex flex-wrap gap-1.5">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
    </div>
    <div>
      <Skeleton className="h-2.5 w-20 mb-1.5" />
      <div className="space-y-1.5"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /><Skeleton className="h-3 w-2/3" /></div>
    </div>
  </div>
);

const ChecklistItemSkeleton = () => (
  <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/40 p-3 lg:p-4">
    <div className="flex items-start gap-2">
      <Skeleton className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start gap-2 flex-wrap"><Skeleton className="h-3.5 flex-1 max-w-[70%]" /><Skeleton className="h-5 w-16 rounded-full" /></div>
        <Skeleton className="h-2.5 w-3/5" />
      </div>
    </div>
  </div>
);

const ActivityItemSkeleton = () => (
  <div className="text-xs bg-gray-50 dark:bg-[#1a1a24] p-3 rounded-xl border border-gray-200 dark:border-gray-800/40 space-y-2">
    <div className="flex items-center gap-2"><Skeleton className="w-5 h-5 rounded-full flex-shrink-0" /><Skeleton className="h-3 w-24" /></div>
    <Skeleton className="h-2.5 w-3/4" />
  </div>
);

const TaskSkeleton = () => (
  <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col overflow-hidden">
    <header className="shrink-0 bg-white/90 dark:bg-[#14141a]/90 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/60 z-20">
      <div className="px-3 lg:px-6 py-2.5 lg:py-3 flex items-center gap-2 lg:gap-3">
        <Skeleton className="w-7 h-7 rounded-lg flex-shrink-0" />
        <Skeleton className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <Skeleton className="h-4 w-48 max-w-[60%]" />
          <div className="flex items-center gap-1.5"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-14 rounded-full" /><Skeleton className="h-2.5 w-12" /></div>
        </div>
        <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
      </div>
    </header>
    <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]">
      <aside className="hidden lg:block lg:h-full lg:overflow-y-auto bg-white dark:bg-[#14141a] border-r border-gray-200/60 dark:border-gray-800/60">
        <div className="p-5"><Skeleton className="h-3 w-24 mb-4" /><TaskSummarySkeleton /></div>
      </aside>
      <main className="lg:h-full lg:overflow-y-auto">
        <div className="p-3 lg:p-6 space-y-4 lg:space-y-5">
          <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-3 w-8" /></div><Skeleton className="h-7 w-24 rounded-lg" /></div>
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => (<ChecklistItemSkeleton key={i} />))}</div>
        </div>
      </main>
      <aside className="hidden xl:flex xl:flex-col xl:h-full xl:overflow-y-auto bg-white dark:bg-[#14141a] border-l border-gray-200/60 dark:border-gray-800/60">
        <div className="p-5"><Skeleton className="h-3 w-20 mb-4" /><div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => (<ActivityItemSkeleton key={i} />))}</div></div>
      </aside>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// Dropdown
// ═══════════════════════════════════════════════════════════════
const Dropdown = ({ label, options, value, onChange, placeholder }) => {
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
    if (below >= MAX_H || below >= above) { top = r.bottom + GAP; maxHeight = Math.max(MIN_H, Math.min(MAX_H, below)); }
    else { bottom = vh - r.top + GAP; maxHeight = Math.max(MIN_H, Math.min(MAX_H, above)); }
    let left = r.left; const width = r.width;
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
      <button ref={triggerRef} type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-300">
        {sel?.icon && <span className="text-xs shrink-0">{sel.icon}</span>}
        <span className={`truncate flex-1 text-left ${sel ? '' : 'text-gray-400 dark:text-gray-500'}`}>{sel ? sel.label : placeholder}</span>
        <FaAngleDown className={`text-[10px] text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div ref={popupRef}
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          className="fixed z-[120] bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 overflow-y-auto">
          {options.map((o) => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${o.value === value ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'}`}>
              {o.icon && <span className="text-xs shrink-0">{o.icon}</span>}
              <span className="truncate flex-1">{o.label}</span>
              {o.value === value && <FaCheck className="text-[9px] shrink-0" />}
            </button>
          ))}
        </div>, document.body)}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MultiDropdown
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
    if (below >= MAX_H || below >= above) { top = r.bottom + GAP; maxHeight = Math.max(MIN_H, Math.min(MAX_H, below)); }
    else { bottom = vh - r.top + GAP; maxHeight = Math.max(MIN_H, Math.min(MAX_H, above)); }
    let left = r.left; const width = r.width;
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
      <button ref={triggerRef} type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-300">
        <span className={`truncate flex-1 text-left ${sel.length === 0 ? 'text-gray-400 dark:text-gray-500' : ''}`}>{text}</span>
        <FaAngleDown className={`text-[10px] text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div ref={popupRef}
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          className="fixed z-[120] bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 overflow-y-auto">
          {options.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">No members available</div>}
          {options.map((o) => {
            const checked = values.includes(o.value);
            return (
              <button key={o.value} type="button" onClick={() => toggle(o.value)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${checked ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'}`}>
                <span className={`w-3.5 h-3.5 flex items-center justify-center border rounded shrink-0 ${checked ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-400 dark:border-gray-600'}`}>
                  {checked && <FaCheck className="text-[8px]" />}
                </span>
                {o.icon}
                <span className="truncate flex-1">{o.label}</span>
              </button>
            );
          })}
        </div>, document.body)}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// CustomDateTimePicker
// ═══════════════════════════════════════════════════════════════
const CustomDateTimePicker = ({ value, onChange, placeholder = 'Select date & time', disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 'auto', bottom: 'auto', left: -9999, maxHeight: 420 });
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const POPUP_W = 290;
  const MAX_H = 420, MIN_H = 220, GAP = 6, EDGE = 8;

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
    if (below >= MAX_H || below >= above) { top = r.bottom + GAP; maxHeight = Math.max(MIN_H, Math.min(MAX_H, below)); }
    else { bottom = vh - r.top + GAP; maxHeight = Math.max(MIN_H, Math.min(MAX_H, above)); }
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

  const isSameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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

  const display = selected ? `${selected.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${pad(hour)}:${pad(minute)}` : '';
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div ref={wrapperRef} className="relative">
      <button ref={triggerRef} type="button" onClick={() => !disabled && setOpen((v) => !v)} disabled={disabled}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-left text-gray-700 dark:text-gray-300 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none disabled:opacity-50 disabled:cursor-not-allowed transition">
        <span className={`truncate ${display ? '' : 'text-gray-400 dark:text-gray-500'}`}>{display || placeholder}</span>
        <FaCalendarAlt className="text-gray-400 text-xs shrink-0" />
      </button>
      {open && !disabled && createPortal(
        <div ref={popupRef}
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: POPUP_W, maxHeight: pos.maxHeight }}
          className="fixed z-[120] bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-gray-800/60 rounded-2xl shadow-2xl p-3 overflow-y-auto">
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
                  className={`aspect-square text-xs rounded-lg transition flex items-center justify-center ${isSel ? 'bg-teal-600 dark:bg-[#0d9488] text-white font-semibold shadow-sm' : isTod ? 'text-teal-600 dark:text-[#0d9488] font-semibold hover:bg-teal-500/10' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60'}`}>{d}</button>
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
        </div>, document.body)}
    </div>
  );
};

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, danger, confirmText = 'Confirm' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">{danger && <FaExclamationTriangle className="text-red-500 text-xl" />}<h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</h3></div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400">Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`flex-1 py-2 text-white rounded-xl text-sm font-medium ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 dark:bg-[#0d9488] hover:opacity-90'}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

const ShowMoreToggle = ({ open, onToggle, label }) => (
  <button type="button" onClick={onToggle}
    className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-[#0b0b10] border border-gray-200 dark:border-gray-700/60 rounded-xl text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/40 transition">
    <span className="font-medium truncate">{label}</span>
    <span className="flex items-center gap-1 text-gray-400 shrink-0 ml-2">
      <span className="text-[10px]">{open ? 'Hide' : 'Show'}</span>
      <FaAngleDown className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`} />
    </span>
  </button>
);

const LinksInput = ({ links = [], onChange, placeholder = 'https://...' }) => {
  const addLink = () => onChange([...(links || []), '']);
  const updateLink = (i, val) => onChange((links || []).map((l, idx) => (idx === i ? val : l)));
  const removeLink = (i) => onChange((links || []).filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {(links || []).map((link, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <FaLink className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] pointer-events-none" />
            <input type="text" value={link} onChange={(e) => updateLink(i, e.target.value)} placeholder={placeholder}
              className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 dark:focus:border-[#0d9488] transition" />
          </div>
          <button type="button" onClick={() => removeLink(i)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition shrink-0" title="Remove link"><FaTimes className="text-xs" /></button>
        </div>
      ))}
      <button type="button" onClick={addLink}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-teal-600 dark:text-[#0d9488] hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 rounded-xl border border-dashed border-teal-300/70 dark:border-[#0d9488]/40 transition">
        <FaPlus className="text-[10px]" /> Add link
      </button>
    </div>
  );
};

const TaskMenuModal = ({
  isOpen, onClose, task,
  canManage, canAIEdit, isReadOnly, hasAssignees,
  onEdit, onReminder, onAssign, onDelete, onAIEdit,
}) => {
  if (!isOpen || !task) return null;
  const noActions = !canManage && !canAIEdit;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <div className="min-w-0 pr-3">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 truncate">{task.title}</h3>
              <div className="flex items-center gap-1.5 mt-1"><StatusPill status={task.status} /><PriorityPill priority={task.priority} /></div>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition flex-shrink-0"><FaTimes /></button>
          </div>
          <div className="space-y-1">
            {canAIEdit && (
              <button onClick={() => { onClose(); onAIEdit(); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition">
                <FaMagic className="text-sm" /><span className="text-sm font-medium">AI Edit</span>
              </button>
            )}
            {canManage && !isReadOnly && (
              <button onClick={() => { onClose(); onReminder(); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition">
                <FaBell className="text-sm" /><span className="text-sm font-medium">Send Reminder</span>
              </button>
            )}
            {canManage && !isReadOnly && (
              <button onClick={() => { onClose(); onEdit(); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition">
                <FaEdit className="text-sm" /><span className="text-sm font-medium">Edit Task</span>
              </button>
            )}
            {canManage && !hasAssignees && !isReadOnly && (
              <button onClick={() => { onClose(); onAssign(); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-teal-600 dark:text-[#0d9488] hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 transition">
                <FaUserPlus className="text-sm" /><span className="text-sm font-medium">Assign Task</span>
              </button>
            )}
            {canManage && !isReadOnly && (
              <button onClick={() => { onClose(); onDelete(); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                <FaTrashAlt className="text-sm" /><span className="text-sm font-medium">Delete Task</span>
              </button>
            )}
            {noActions && (
              <p className="text-sm text-gray-500 dark:text-gray-500 text-center py-4">No actions available for your role.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SubtaskActionModal = ({
  isOpen, onClose, item, index,
  canManage, isReadOnly, isAssignee, canSelectSubs, canDeleteThis,
  canEditThis,
  onEdit, onMarkDone, onConfirm, onReject, onSelect, onDelete,
}) => {
  if (!isOpen || !item) return null;
  const isConfirmed = item.status === 'confirmed';
  const isDone = item.status === 'done';
  const isPending = item.status === 'pending';
  const showEdit = !isReadOnly && canEditThis && !isConfirmed;
  const showMarkDone = !isReadOnly && (isAssignee || canManage) && isPending;
  const showConfirm = !isReadOnly && canManage && isDone;
  const showReject = !isReadOnly && canManage && isDone;
  const noActions = !showEdit && !showMarkDone && !showConfirm && !showReject && !canSelectSubs && !canDeleteThis;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <div className="min-w-0 pr-3">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 break-words">{item.title}</h3>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${isConfirmed ? 'bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-200 border-green-300 dark:border-green-600/50' : isDone ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-700/50' : 'bg-gray-100 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700'}`}>
                  {isConfirmed ? 'Confirmed' : isDone ? 'Awaiting confirmation' : 'Pending'}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition flex-shrink-0"><FaTimes /></button>
          </div>
          <div className="space-y-1">
            {showEdit && (
              <button onClick={() => { onClose(); onEdit(index); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition">
                <FaEdit className="text-sm" /><span className="text-sm font-medium">Edit item</span>
              </button>
            )}
            {showMarkDone && (
              <button onClick={() => { onClose(); onMarkDone(index); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition">
                <FaCheck className="text-sm" /><span className="text-sm font-medium">Mark as Done</span>
              </button>
            )}
            {showConfirm && (
              <button onClick={() => { onClose(); onConfirm(index); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 transition">
                <FaCheckDouble className="text-sm" /><span className="text-sm font-medium">Confirm</span>
              </button>
            )}
            {showReject && (
              <button onClick={() => { onClose(); onReject(index); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition">
                <FaTimes className="text-sm" /><span className="text-sm font-medium">Reject</span>
              </button>
            )}
            {canSelectSubs && (
              <button onClick={() => { onClose(); onSelect(index); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition">
                <FaMousePointer className="text-sm" /><span className="text-sm font-medium">Select</span>
              </button>
            )}
            {canDeleteThis && (
              <button onClick={() => { onClose(); onDelete(index); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                <FaTrashAlt className="text-sm" /><span className="text-sm font-medium">Delete</span>
              </button>
            )}
            {noActions && (
              <p className="text-sm text-gray-500 dark:text-gray-500 text-center py-4">No actions available for your role.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EditSubtaskModal = ({ isOpen, onClose, subtask, brandColor, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [bufferTime, setBufferTime] = useState(0);
  const [links, setLinks] = useState([]);
  const [recurrenceType, setRecurrenceType] = useState('none');
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    if (!isOpen || !subtask) return;
    setTitle(subtask.title || '');
    setDescription(subtask.description || '');
    setStartDate(subtask.startDate ? new Date(subtask.startDate).toISOString().slice(0, 16) : '');
    setDueDate(subtask.dueDate ? new Date(subtask.dueDate).toISOString().slice(0, 16) : '');
    setBufferTime(subtask.bufferTime || 0);
    setLinks(subtask.links || []);
    setRecurrenceType(subtask.recurrenceType || 'none');
    setRecurrenceDays(subtask.recurrenceDays || []);
    setRecurrenceEndDate(subtask.recurrenceEndDate ? new Date(subtask.recurrenceEndDate).toISOString().slice(0, 16) : '');
  }, [isOpen, subtask]);

  if (!isOpen || !subtask) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Title required');
    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        startDate: startDate || null,
        dueDate: dueDate || null,
        bufferTime: parseInt(bufferTime, 10) || 0,
        links: links.map((l) => l.trim()).filter(Boolean),
        recurrenceType,
        recurrenceDays: recurrenceType === 'weekly' ? recurrenceDays : [],
        recurrenceEndDate: recurrenceEndDate || null,
      });
      onClose();
    } catch (err) { /* handled upstream */ } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#14141a] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800/60 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2"><FaEdit className="text-teal-600 dark:text-[#0d9488]" /> Edit item</h2>
          <button onClick={onClose} className="p-1.5 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"><FaTimes className="text-sm" /></button>
        </div>
        <form onSubmit={submit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500" required />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description (optional)" className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500" />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start</label><CustomDateTimePicker value={startDate} onChange={setStartDate} placeholder="Pick start" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Due</label><CustomDateTimePicker value={dueDate} onChange={setDueDate} placeholder="Pick due" /></div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buffer (min)</label>
              <input type="number" min="0" value={bufferTime} onChange={(e) => setBufferTime(parseInt(e.target.value, 10) || 0)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500" />
            </div>
            <div className="bg-gray-50 dark:bg-[#0b0b10] border border-gray-200 dark:border-gray-800/60 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5"><FaRedo className="text-[10px] text-teal-600 dark:text-[#0d9488]" /> Repeat item</label>
                <button type="button" role="switch" aria-checked={recurrenceType !== 'none'} onClick={() => { if (recurrenceType === 'none') { setRecurrenceType('daily'); } else { setRecurrenceType('none'); setRecurrenceDays([]); setRecurrenceEndDate(''); } }} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${recurrenceType !== 'none' ? '' : 'bg-gray-300 dark:bg-gray-700'}`} style={recurrenceType !== 'none' ? { backgroundColor: brandColor } : undefined}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${recurrenceType !== 'none' ? 'translate-x-[1.15rem]' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {recurrenceType !== 'none' && (
                <>
                  <div className="flex gap-2">
                    {['daily', 'weekly'].map((opt) => {
                      const active = recurrenceType === opt;
                      return (
                        <button key={opt} type="button" onClick={() => { setRecurrenceType(opt); if (opt !== 'weekly') setRecurrenceDays([]); }} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${active ? 'text-white border-transparent shadow-sm' : 'bg-white dark:bg-[#14141a] text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700/60 hover:border-gray-400 dark:hover:border-gray-600'}`} style={active ? { backgroundColor: brandColor } : undefined}>{opt === 'daily' ? 'Daily' : 'Weekly'}</button>
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
                            <button key={i} type="button" onClick={() => setRecurrenceDays(on ? recurrenceDays.filter((x) => x !== i) : [...recurrenceDays, i].sort())} className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${on ? 'text-white border-transparent shadow-sm' : 'bg-white dark:bg-[#14141a] text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700/60 hover:border-gray-400 dark:hover:border-gray-600'}`} style={on ? { backgroundColor: brandColor } : undefined}>{d}</button>
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
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaLink className="inline mr-1 text-teal-600 dark:text-[#0d9488]" /> Links</label>
              <LinksInput links={links} onChange={setLinks} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-800/60 shrink-0">
            <button type="button" onClick={onClose} className="py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
            <button type="submit" disabled={loading || !title.trim()} className="py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{loading ? 'Saving...' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const NoteBody = ({ content }) => {
  const safeContent = useMemo(() => {
    if (!content || typeof content !== 'string') return '';
    return DOMPurify.sanitize(content, { USE_PROFILES: { html: true }, ADD_ATTR: ['style', 'target', 'rel'] });
  }, [content]);

  const migratedContent = useMemo(() => migrateCalloutIcons(safeContent), [safeContent]);

  if (!migratedContent) {
    return (
      <div className="text-center py-16">
        <FaStickyNote className="text-3xl mx-auto text-gray-300 dark:text-gray-700 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-500">This note has no content.</p>
      </div>
    );
  }

  return (
    <article className="note-rich text-gray-800 dark:text-gray-100">
      <div className="note-content" dangerouslySetInnerHTML={{ __html: migratedContent }} />
    </article>
  );
};

const NOTE_PANEL_MIN = 320;
const NOTE_PANEL_MAX = 900;
const NOTE_PANEL_DEFAULT = 460;
const NOTE_PANEL_STORAGE_KEY = 'taskNotePanelWidth';

const LinkedNotePanel = ({ isOpen, onClose, link, brandColor, isMobile }) => {
  const [width, setWidth] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem(NOTE_PANEL_STORAGE_KEY), 10);
      if (Number.isFinite(saved) && saved >= NOTE_PANEL_MIN && saved <= NOTE_PANEL_MAX) return saved;
    } catch {}
    return NOTE_PANEL_DEFAULT;
  });
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  useEffect(() => {
    try { localStorage.setItem(NOTE_PANEL_STORAGE_KEY, String(width)); } catch {}
  }, [width]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const onResizeStart = useCallback((e) => {
    if (isMobile) return;
    e.preventDefault();
    resizingRef.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    startXRef.current = clientX;
    startWidthRef.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width, isMobile]);

  useEffect(() => {
    if (isMobile) return;
    const onMove = (e) => {
      if (!resizingRef.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const delta = startXRef.current - clientX;
      const next = Math.max(NOTE_PANEL_MIN, Math.min(NOTE_PANEL_MAX, startWidthRef.current + delta));
      setWidth(next);
    };
    const onUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [isMobile]);

  if (!isOpen || !link) return null;

  const note = link.note || {};
  const isWorkspaceNote = link.source === 'workspace';
  const title = note.title || '[Deleted note]';
  const content = note.content || '';
  const updatedAt = note.updatedAt;

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[90] bg-white dark:bg-[#0b0b10] flex flex-col animate-[slideIn_180ms_ease-out]">
        <header className="shrink-0 sticky top-0 z-10 bg-white/95 dark:bg-[#14141a]/95 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="flex items-center gap-2 px-3 h-14">
            <button onClick={onClose} className="p-2 -ml-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition" aria-label="Back"><FaArrowLeft className="text-sm" /></button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-500">
                {isWorkspaceNote ? <FaUsers className="text-[9px]" /> : <FaUser className="text-[9px]" />}
                <span>{isWorkspaceNote ? 'Workspace note' : 'Personal note'}</span>
              </div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{title}</h2>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto"><div className="px-4 py-4"><NoteBody content={content} brandColor={brandColor} /></div></div>
      </div>
    );
  }

  return (
    <aside className="relative h-full bg-white dark:bg-[#14141a] border-l border-gray-200/60 dark:border-gray-800/60 flex flex-col shadow-[inset_1px_0_0_rgba(0,0,0,0.02)]" style={{ width: `${width}px` }}>
      <div onMouseDown={onResizeStart} onTouchStart={onResizeStart} className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize group select-none z-10" title="Drag to resize">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-1 rounded-full bg-gray-300 dark:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <header className="shrink-0 px-4 py-3 border-b border-gray-200/60 dark:border-gray-800/60 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-500 mb-0.5">
            {isWorkspaceNote ? <FaUsers className="text-[9px]" /> : <FaUser className="text-[9px]" />}
            <span>{isWorkspaceNote ? 'Workspace note' : 'Personal note'}</span>
          </div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-words">{title}</h2>
          {updatedAt && (<p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Updated {fmtDateTime(updatedAt)}</p>)}
        </div>
        <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition shrink-0" aria-label="Close"><FaTimes className="text-sm" /></button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4"><NoteBody content={content} brandColor={brandColor} /></div>
    </aside>
  );
};

const NotesPickerModal = ({ isOpen, onClose, workspaceId, alreadySelected, onConfirm }) => {
  const [stage, setStage] = useState('source');
  const [draft, setDraft] = useState([]);

  const { data: pData, isLoading: pLoading } = useGetNotesQuery(undefined, { skip: !isOpen || stage !== 'personal' });
  const { data: wData, isLoading: wLoading } = useGetWorkspaceNotesQuery(workspaceId, { skip: !isOpen || stage !== 'workspace' || !workspaceId });

  const personalNotes = pData?.notes || [];
  const workspaceNotes = wData?.notes || [];

  useEffect(() => {
    if (isOpen) { setDraft(Array.isArray(alreadySelected) ? alreadySelected : []); setStage('source'); }
  }, [isOpen]); // eslint-disable-line

  const isPicked = (noteId, source) => draft.some((d) => String(d.noteId) === String(noteId) && d.source === source);

  const toggleNote = (note, source) => {
    if (isPicked(note._id, source)) {
      setDraft((prev) => prev.filter((d) => !(String(d.noteId) === String(note._id) && d.source === source)));
    } else {
      setDraft((prev) => [...prev, { noteId: note._id, source, title: note.title }]);
    }
  };

  if (!isOpen) return null;

  const renderNotesList = (notes, source, loading) => (
    <div className="space-y-2">
      {loading && (<div className="flex items-center justify-center py-10"><div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" /></div>)}
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
            <span className={`w-4 h-4 mt-0.5 flex items-center justify-center border rounded shrink-0 ${checked ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-400 dark:border-gray-600'}`}>{checked && <FaCheck className="text-[8px]" />}</span>
            <span className="min-w-0 flex-1">
              <p className={`text-sm font-medium truncate ${checked ? 'text-teal-700 dark:text-[#14b8a6]' : 'text-gray-800 dark:text-gray-200'}`}>{n.title || 'Untitled'}</p>
              {n.content && (<p className="text-[11px] text-gray-500 dark:text-gray-500 truncate mt-0.5">{n.content.replace(/\s+/g, ' ').trim().slice(0, 80)}{n.content.length > 80 ? '…' : ''}</p>)}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg flex flex-col max-h-[88vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="flex items-center gap-2 min-w-0">
            {stage !== 'source' && (
              <button onClick={() => setStage('source')} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/40 rounded-lg transition" title="Back"><FaArrowLeft className="text-xs" /></button>
            )}
            <FaStickyNote className="text-teal-600 dark:text-[#0d9488] text-sm shrink-0" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
              {stage === 'source' && 'Add from notes'}
              {stage === 'workspace' && 'Workspace notes'}
              {stage === 'personal' && 'Personal notes'}
            </h3>
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
                <FaAngleRight className="text-xs text-gray-400 self-center shrink-0" />
              </button>
              <button type="button" onClick={() => setStage('personal')} className="w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border border-gray-200 dark:border-gray-800/60 hover:border-teal-400 dark:hover:border-[#0d9488]/50 hover:bg-teal-50/40 dark:hover:bg-[#0d9488]/5 transition text-left">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-[#0d9488]/15 flex items-center justify-center shrink-0"><FaUser className="text-teal-600 dark:text-[#0d9488]" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Personal notes</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">Your private notes — only you can see them</p>
                </div>
                <FaAngleRight className="text-xs text-gray-400 self-center shrink-0" />
              </button>
            </div>
          )}
          {stage === 'workspace' && renderNotesList(workspaceNotes, 'workspace', wLoading)}
          {stage === 'personal' && renderNotesList(personalNotes, 'personal', pLoading)}
        </div>
        {stage !== 'source' && (
          <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
            <span className="text-xs text-gray-500 dark:text-gray-500 mr-auto">{draft.length} selected</span>
            <button type="button" onClick={() => setStage('source')} className="px-4 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Back</button>
            <button type="button" onClick={() => { onConfirm(draft); onClose(); }} className="px-4 py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl text-sm font-medium hover:opacity-90 transition">Add {draft.length > 0 ? `(${draft.length})` : ''}</button>
          </div>
        )}
      </div>
    </div>
  );
};

const AddChecklistModal = ({ isOpen, onClose, onSubmit }) => {
  const makeEmpty = () => ({ title: '', startDate: '', dueDate: '' });
  const [items, setItems] = useState([makeEmpty()]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (isOpen) setItems([makeEmpty()]); }, [isOpen]);
  if (!isOpen) return null;

  const addRow = () => setItems((prev) => [...prev, makeEmpty()]);
  const removeRow = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateRow = (i, key, val) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  const validItems = items.filter((it) => it.title.trim());

  const submit = async () => {
    if (!validItems.length) return toast.error('Add at least one checklist item');
    setLoading(true);
    let ok = 0;
    try {
      for (const item of validItems) {
        try { await onSubmit({ title: item.title.trim(), startDate: item.startDate || null, dueDate: item.dueDate || null }); ok += 1; }
        catch (e) { console.error('Failed to add checklist item:', e); }
      }
      if (ok === validItems.length) toast.success(`${ok} item${ok > 1 ? 's' : ''} added`);
      else if (ok > 0) toast.success(`${ok} of ${validItems.length} items added`);
      else toast.error('Failed to add items');
      setItems([makeEmpty()]);
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-lg w-full shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-start px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800/60 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200">Add Checklist Items</h3>
            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-500 mt-0.5">Leave a row blank to skip it</p>
          </div>
          <button onClick={onClose} className="p-1.5 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"><FaTimes className="text-sm" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3">
          {items.map((item, i) => (
            <div key={i} className="bg-gray-50 dark:bg-[#0b0b10] rounded-xl border border-gray-200 dark:border-gray-800/60 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">Checklist {i + 1}</span>
                {items.length > 1 && (<button type="button" onClick={() => removeRow(i)} className="ml-auto text-gray-400 hover:text-red-500 transition p-1" title="Remove this row"><FaTimes className="text-xs" /></button>)}
              </div>
              <input value={item.title} onChange={(e) => updateRow(i, 'title', e.target.value)} placeholder={`Checklist ${i + 1}`} className="w-full px-3 py-2 bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500" />
              <div className="grid grid-cols-2 gap-2">
                <CustomDateTimePicker value={item.startDate} onChange={(v) => updateRow(i, 'startDate', v)} placeholder="Start" />
                <CustomDateTimePicker value={item.dueDate} onChange={(v) => updateRow(i, 'dueDate', v)} placeholder="Due" />
              </div>
            </div>
          ))}
          <button type="button" onClick={addRow} className="w-full py-2.5 border border-dashed border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-teal-600 dark:text-[#0d9488] font-medium flex items-center justify-center gap-1.5 hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 transition">
            <FaPlus className="text-xs" /> Add another row
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-800/60 shrink-0">
          <button onClick={onClose} className="py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button onClick={submit} disabled={loading || !validItems.length} className="py-2.5 bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:opacity-90 transition">
            {loading ? 'Creating...' : `Create${validItems.length > 1 ? ` ${validItems.length} items` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

const ChecklistDoneModal = ({ isOpen, onClose, onSubmit, canManage }) => {
  const [notes, setNotes] = useState('');
  const [links, setLinks] = useState([]);
  const { files, pickMedia, setFiles } = useMediaPicker();
  const [loading, setLoading] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => { if (isOpen) { setShowMore(false); setNotes(''); setLinks([]); setFiles([]); } }, [isOpen]); // eslint-disable-line

  if (!isOpen) return null;

  const submit = async () => {
    setLoading(true);
    try {
      await onSubmit({ notes, links: links.map((l) => l.trim()).filter(Boolean), files });
      setNotes(''); setLinks([]); setFiles([]); setShowMore(false);
      onClose();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800/60 shrink-0">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200">Mark Item Done</h3>
          <button onClick={onClose} className="p-1.5 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"><FaTimes className="text-sm" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Confirm you've finished this checklist item.</p>
          <ShowMoreToggle open={showMore} onToggle={() => setShowMore((v) => !v)} label="Notes, links or files" />
          {showMore && (
            <div className="space-y-2">
              <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
              <LinksInput links={links} onChange={setLinks} />
              <button type="button" onClick={() => pickMedia({ multiple: true })} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-xl text-sm text-gray-700 dark:text-gray-300"><FaCamera className="text-xs" /> Choose Files</button>
              {files.length > 0 && files.map((f, i) => (
                <div key={i} className="flex justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5">
                  <span className="text-sm truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                  <button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-red-500"><FaTrashAlt className="text-xs" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-800/60 shrink-0">
          <button onClick={onClose} className="py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button onClick={submit} disabled={loading} className="py-2.5 bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60">
            {loading ? 'Saving...' : canManage ? 'Complete & Confirm' : 'Submit Done'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ChecklistConfirmModal = ({ isOpen, onClose, subTask, onSubmit }) => {
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => { if (isOpen) { setShowMore(false); setFeedback(''); } }, [isOpen]);
  if (!isOpen) return null;

  const submit = async () => {
    setLoading(true);
    try { await onSubmit(feedback); setFeedback(''); setShowMore(false); onClose(); }
    catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800/60 shrink-0">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200">Confirm Item</h3>
          <button onClick={onClose} className="p-1.5 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"><FaTimes className="text-sm" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3">
          {subTask?.notes && (<p className="text-xs text-gray-600 dark:text-gray-400"><span className="font-medium">Notes:</span> {subTask.notes}</p>)}
          <ShowMoreToggle open={showMore} onToggle={() => setShowMore((v) => !v)} label="Add feedback" />
          {showMore && (<textarea placeholder="Feedback (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />)}
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-800/60 shrink-0">
          <button onClick={onClose} className="py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button onClick={submit} disabled={loading} className="py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60">
            {loading ? 'Confirming...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ReasonModal = ({ isOpen, onClose, onSubmit, title }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  if (!isOpen) return null;
  const submit = async () => {
    setLoading(true);
    try { await onSubmit(reason); setReason(''); onClose(); }
    catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800/60 shrink-0">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200">{title}</h3>
          <button onClick={onClose} className="p-1.5 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"><FaTimes className="text-sm" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-800/60 shrink-0">
          <button onClick={onClose} className="py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button onClick={submit} disabled={loading} className="py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60">{loading ? 'Submitting...' : 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
};

const MarkCompleteModal = ({ isOpen, onClose, task, brandColor, onSubmit }) => {
  const [notes, setNotes] = useState('');
  const [links, setLinks] = useState([]);
  const { files, pickMedia, setFiles } = useMediaPicker();
  const [loading, setLoading] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => { if (isOpen) { setShowMore(false); setNotes(''); setLinks([]); setFiles([]); } }, [isOpen]); // eslint-disable-line

  if (!isOpen) return null;

  const submit = async () => {
    setLoading(true);
    try { await onSubmit({ notes: notes.trim(), links: links.map((l) => l.trim()).filter(Boolean), attachments: files }); onClose(); }
    catch (e) { /* handled upstream */ } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800/60 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200">Mark Task Complete</h2>
          <button onClick={onClose} className="p-1.5 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"><FaTimes className="text-sm" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Confirm you have completed <span className="font-medium text-gray-800 dark:text-gray-200">"{task?.title}"</span>.</p>
          <ShowMoreToggle open={showMore} onToggle={() => setShowMore((v) => !v)} label="Notes, links or files" />
          {showMore && (
            <div className="space-y-2">
              <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
              <LinksInput links={links} onChange={setLinks} />
              <button type="button" onClick={() => pickMedia({ multiple: true })} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-xl text-sm text-gray-700 dark:text-gray-300"><FaCamera className="text-xs" /> Choose Files</button>
              {files.length > 0 && files.map((f, i) => (
                <div key={i} className="flex justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5">
                  <span className="text-sm truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                  <button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-red-500"><FaTrashAlt className="text-xs" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-800/60 shrink-0">
          <button onClick={onClose} className="py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button onClick={submit} disabled={loading} className="py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{loading ? 'Submitting...' : 'Complete'}</button>
        </div>
      </div>
    </div>
  );
};

const ConfirmCompletionModal = ({ isOpen, onClose, task, brandColor, onSubmit, onReject }) => {
  const [feedback, setFeedback] = useState('');
  const [finalHours, setFinalHours] = useState('');
  const [finalLinks, setFinalLinks] = useState([]);
  const { files, pickMedia, setFiles } = useMediaPicker();
  const [loading, setLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showMore, setShowMore] = useState(false);

  useEffect(() => { if (isOpen) setShowMore(false); }, [isOpen]);
  if (!isOpen) return null;

  const reset = () => {
    setFeedback(''); setFinalHours(''); setFinalLinks([]); setFiles([]);
    setRejectReason(''); setShowReject(false); setShowMore(false);
  };

  const submit = async () => {
    setLoading(true);
    try {
      const links = finalLinks.map((l) => l.trim()).filter(Boolean);
      await onSubmit({ feedback: feedback.trim(), finalHours: finalHours ? parseFloat(finalHours) : undefined, finalLinks: links.length ? links : undefined, finalAttachments: files });
      onClose(); reset();
    } catch (e) { /* handled */ } finally { setLoading(false); }
  };

  const reject = async () => {
    if (!rejectReason.trim()) return toast.error('Provide a reason');
    setLoading(true);
    try { await onReject(task._id, rejectReason.trim()); onClose(); reset(); }
    catch (e) { /* handled */ } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800/60 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200">Confirm or Reject Task</h2>
          <button onClick={onClose} className="p-1.5 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"><FaTimes className="text-sm" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3">
          {task?.finalLinks?.length > 0 && (
            <div className="text-xs sm:text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">Submitted links:</span>
              <ul className="list-disc pl-5 mt-1">{task.finalLinks.map((l, i) => (<li key={i}><a href={l} target="_blank" rel="noreferrer" className="text-teal-600 underline break-all">{l}</a></li>))}</ul>
            </div>
          )}
          {task?.finalAttachments?.length > 0 && (
            <div className="text-xs sm:text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">Submitted attachments:</span>
              <ul className="list-disc pl-5 mt-1">{task.finalAttachments.map((a, i) => (<li key={i}><a href={a.url} target="_blank" rel="noreferrer" className="text-teal-600 underline break-all">{a.name || 'file'}</a></li>))}</ul>
            </div>
          )}
          <ShowMoreToggle open={showMore} onToggle={() => setShowMore((v) => !v)} label="Feedback, hours or files" />
          {showMore && (
            <div className="space-y-2">
              <textarea placeholder="Feedback (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
              <input type="number" step="0.5" placeholder="Actual hours (optional)" value={finalHours} onChange={(e) => setFinalHours(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
              <LinksInput links={finalLinks} onChange={setFinalLinks} placeholder="https://... (final link)" />
              <button type="button" onClick={() => pickMedia({ multiple: true })} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-xl text-sm text-gray-700 dark:text-gray-300"><FaCamera className="text-xs" /> Choose Files</button>
              {files.length > 0 && files.map((f, i) => (
                <div key={i} className="flex justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5">
                  <span className="text-sm truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                  <button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-red-500"><FaTrashAlt className="text-xs" /></button>
                </div>
              ))}
            </div>
          )}
          {showReject && (<input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection *" className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-red-300 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />)}
        </div>
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-800/60 shrink-0">
          {!showReject ? (
            <div className="grid grid-cols-3 gap-2">
              <button onClick={onClose} className="py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={() => setShowReject(true)} className="py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-medium transition">Reject</button>
              <button onClick={submit} disabled={loading} className="py-2.5 text-white rounded-xl text-xs sm:text-sm font-medium hover:opacity-90 transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{loading ? 'Confirming...' : 'Confirm'}</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowReject(false)} className="py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Back</button>
              <button onClick={reject} disabled={loading} className="py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-60">{loading ? 'Rejecting...' : 'Confirm Rejection'}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AssignTaskModal = ({ isOpen, onClose, task, assignableMembers, brandColor, onAssign }) => {
  const [ids, setIds] = useState((task?.assignees || []).map((a) => a._id || a).filter(Boolean));
  const [loading, setLoading] = useState(false);
  useEffect(() => setIds((task?.assignees || []).map((a) => a._id || a).filter(Boolean)), [task?._id, isOpen]);
  if (!isOpen) return null;
  const opts = assignableMembers.map((m) => { const u = m.user || m; return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full object-cover" alt="" /> : <FaUser className="text-gray-400" /> }; });
  const submit = async () => {
    if (!ids.length) return toast.error('Select at least one member');
    setLoading(true);
    try { await onAssign(ids); onClose(); } catch (e) { toast.error(e?.data?.message || 'Failed'); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800/60 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1"><FaUserPlus className="text-teal-600" /> Assign Task</h2>
          <button onClick={onClose} className="p-1.5 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"><FaTimes className="text-sm" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4">
          <MultiDropdown label="Assignees" options={opts} values={ids} onChange={setIds} placeholder="Select members..." />
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-800/60 shrink-0">
          <button onClick={onClose} className="py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button onClick={submit} disabled={loading || !ids.length} className="py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{loading ? 'Assigning...' : 'Assign'}</button>
        </div>
      </div>
    </div>
  );
};

const EditTaskModal = ({ isOpen, onClose, task, workspaceId, brandColor, assignableMembers, folders, onSuccess }) => {
  const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [assigneeIds, setAssigneeIds] = useState([]); const [priority, setPriority] = useState('medium'); const [status, setStatus] = useState('pending');
  const [startDate, setStartDate] = useState(''); const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(''); const [bufferTime, setBufferTime] = useState(0);
  const [allowAssigneeEditSubtasks, setAllowAssigneeEditSubtasks] = useState(false);
  const [links, setLinks] = useState([]); const { files, pickMedia, setFiles } = useMediaPicker();
  const [folderId, setFolderId] = useState(''); const [loading, setLoading] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('none'); const [recurrenceDays, setRecurrenceDays] = useState([]); const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [linkedNotes, setLinkedNotes] = useState([]); const [notesPickerOpen, setNotesPickerOpen] = useState(false);
  const [updateTask] = useUpdateTaskMutation();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    if (!task) return;
    setTitle(task.title || ''); setDescription(task.description || '');
    setAssigneeIds((task.assignees || []).map((a) => a._id || a).filter(Boolean));
    setPriority(task.priority || 'medium'); setStatus(task.status || 'pending');
    setStartDate(task.startDate ? new Date(task.startDate).toISOString().slice(0, 16) : '');
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');
    setEstimatedHours(task.estimatedHours || ''); setBufferTime(task.bufferTime || 0);
    setAllowAssigneeEditSubtasks(task.allowAssigneeEditSubtasks || false);
    setLinks(task.links || []); setFolderId(task.folder?._id || '');
    setRecurrenceType(task.recurrenceType || 'none'); setRecurrenceDays(task.recurrenceDays || []);
    setRecurrenceEndDate(task.recurrenceEndDate ? new Date(task.recurrenceEndDate).toISOString().slice(0, 16) : '');
    const notes = (task.linkedNotes || []).map((ln) => ({ noteId: ln.note?._id || ln.note, source: ln.source, title: ln.note?.title || '[Deleted]' })).filter((n) => n.noteId);
    setLinkedNotes(notes);
  }, [task, isOpen]);

  if (!isOpen || !task) return null;
  const assigneeOpts = assignableMembers.map((m) => { const u = m.user || m; return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full object-cover" alt="" /> : <FaUser className="text-gray-400" /> }; });
  const folderOpts = [{ value: '', label: 'No Folder', icon: <FaFolderOpen className="text-gray-400" /> }, ...folders.map((f) => ({ value: f._id, label: f.name, icon: <FaFolder className="text-gray-400" /> }))];

  const removeLinkedNote = (noteId, source) => setLinkedNotes((prev) => prev.filter((d) => !(String(d.noteId) === String(noteId) && d.source === source)));

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Title required');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim()); fd.append('description', description.trim()); fd.append('priority', priority); fd.append('status', status);
      fd.append('assigneeIds', JSON.stringify(assigneeIds)); if (assigneeIds[0]) fd.append('assigneeId', assigneeIds[0]);
      fd.append('estimatedHours', estimatedHours || ''); fd.append('bufferTime', bufferTime.toString());
      fd.append('allowAssigneeEditSubtasks', allowAssigneeEditSubtasks ? 'true' : 'false');
      fd.append('startDate', startDate || ''); fd.append('dueDate', dueDate || ''); fd.append('folderId', folderId || '');
      fd.append('recurrenceType', recurrenceType);
      if (recurrenceType === 'weekly') fd.append('recurrenceDays', JSON.stringify(recurrenceDays));
      fd.append('recurrenceEndDate', recurrenceEndDate || '');
      links.map((l) => l.trim()).filter(Boolean).forEach((l) => fd.append('links', l));
      files.forEach((f) => fd.append('attachments', f));
      fd.append('linkedNotes', JSON.stringify(linkedNotes.map(({ noteId, source }) => ({ noteId, source }))));
      await updateTask({ taskId: task._id, data: fd }).unwrap();
      toast.success('Task updated'); onSuccess(); onClose(); setFiles([]);
    } catch (err) { toast.error(err?.data?.message || 'Failed'); } finally { setLoading(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4">
        <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full shadow-xl max-h-[92vh] flex flex-col">
          <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800/60 shrink-0">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1"><FaEdit className="text-teal-600" /> Edit Task</h2>
            <button onClick={onClose} className="p-1.5 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"><FaTimes className="text-sm" /></button>
          </div>
          <form onSubmit={submit} className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" required />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description" className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaStickyNote className="inline mr-1 text-teal-600 dark:text-[#0d9488]" /> Notes</label>
                <div className="space-y-2">
                  {linkedNotes.map((n) => (
                    <div key={`${n.source}:${n.noteId}`} className="flex items-center gap-2 bg-teal-50/60 dark:bg-[#0d9488]/10 border border-teal-200/60 dark:border-[#0d9488]/30 rounded-xl px-3 py-2">
                      {n.source === 'workspace' ? <FaUsers className="text-teal-600 dark:text-[#0d9488] text-xs shrink-0" /> : <FaUser className="text-teal-600 dark:text-[#0d9488] text-xs shrink-0" />}
                      <span className="text-sm truncate flex-1 text-gray-800 dark:text-gray-200">{n.title || 'Untitled'}</span>
                      <button type="button" onClick={() => removeLinkedNote(n.noteId, n.source)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded p-1 transition" title="Remove"><FaTimes className="text-[10px]" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setNotesPickerOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-[#0d9488] rounded-lg text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/30 transition">
                    <FaPlus className="text-[10px]" /> Add from notes
                  </button>
                </div>
              </div>
              <Dropdown label="Status" options={statusOptions} value={status} onChange={setStatus} />
              <MultiDropdown label="Assignees" options={assigneeOpts} values={assigneeIds} onChange={setAssigneeIds} placeholder="Select members..." />
              <Dropdown label="Folder" options={folderOpts} value={folderId} onChange={setFolderId} />
              <div className="grid grid-cols-2 gap-3">
                <Dropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} />
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start</label><CustomDateTimePicker value={startDate} onChange={setStartDate} placeholder="Pick start" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Due</label><CustomDateTimePicker value={dueDate} onChange={setDueDate} placeholder="Pick due" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Est. hours</label><input type="number" step="0.5" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" /></div>
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buffer (min)</label><input type="number" min="0" value={bufferTime} onChange={(e) => setBufferTime(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" /></div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"><input type="checkbox" checked={allowAssigneeEditSubtasks} onChange={(e) => setAllowAssigneeEditSubtasks(e.target.checked)} className="accent-teal-600" /> Allow assignee to edit checklist</label>
              <div className="bg-gray-50 dark:bg-[#0b0b10] border border-gray-200 dark:border-gray-800/60 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5"><FaRedo className="text-[10px] text-teal-600 dark:text-[#0d9488]" /> Repeat task</label>
                  <button type="button" role="switch" aria-checked={recurrenceType !== 'none'} onClick={() => { if (recurrenceType === 'none') { setRecurrenceType('daily'); } else { setRecurrenceType('none'); setRecurrenceDays([]); setRecurrenceEndDate(''); } }} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${recurrenceType !== 'none' ? '' : 'bg-gray-300 dark:bg-gray-700'}`} style={recurrenceType !== 'none' ? { backgroundColor: brandColor } : undefined}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${recurrenceType !== 'none' ? 'translate-x-[1.15rem]' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {recurrenceType !== 'none' && (
                  <>
                    <div className="flex gap-2">
                      {['daily', 'weekly'].map((opt) => {
                        const active = recurrenceType === opt;
                        return (
                          <button key={opt} type="button" onClick={() => { setRecurrenceType(opt); if (opt !== 'weekly') setRecurrenceDays([]); }} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${active ? 'text-white border-transparent shadow-sm' : 'bg-white dark:bg-[#14141a] text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700/60 hover:border-gray-400 dark:hover:border-gray-600'}`} style={active ? { backgroundColor: brandColor } : undefined}>{opt === 'daily' ? 'Daily' : 'Weekly'}</button>
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
                              <button key={i} type="button" onClick={() => setRecurrenceDays(on ? recurrenceDays.filter((x) => x !== i) : [...recurrenceDays, i].sort())} className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${on ? 'text-white border-transparent shadow-sm' : 'bg-white dark:bg-[#14141a] text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700/60 hover:border-gray-400 dark:hover:border-gray-600'}`} style={on ? { backgroundColor: brandColor } : undefined}>{d}</button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ends on <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label><CustomDateTimePicker value={recurrenceEndDate} onChange={setRecurrenceEndDate} placeholder="Pick end date" /></div>
                  </>
                )}
              </div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaLink className="inline mr-1 text-teal-600 dark:text-[#0d9488]" /> Links</label><LinksInput links={links} onChange={setLinks} /></div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaPaperclip className="inline mr-1" />New attachments</label>
                <button type="button" onClick={() => pickMedia({ multiple: true })} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-xl text-sm text-gray-700 dark:text-gray-300"><FaCamera className="text-xs" /> Choose Files</button>
                {files.length > 0 && files.map((f, i) => <div key={i} className="flex justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5 mt-1"><span className="text-sm truncate text-gray-700 dark:text-gray-300">{f.name}</span><button type="button" onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-red-500"><FaTrashAlt className="text-xs" /></button></div>)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-800/60 shrink-0">
              <button type="button" onClick={onClose} className="py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button type="submit" disabled={loading} className="py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60" style={{ backgroundColor: brandColor }}>{loading ? 'Updating...' : 'Update Task'}</button>
            </div>
          </form>
        </div>
      </div>
      <NotesPickerModal isOpen={notesPickerOpen} onClose={() => setNotesPickerOpen(false)} workspaceId={workspaceId} alreadySelected={linkedNotes} onConfirm={setLinkedNotes} />
    </>
  );
};

const AIEditTaskModal = ({ isOpen, onClose, task, brandColor, onApplied }) => {
  const [view, setView] = useState('prompt');
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [editTaskWithAI] = useEditTaskWithAIMutation();
  const [applyTaskEdits] = useApplyTaskEditsMutation();

  useEffect(() => { if (!isOpen) { setView('prompt'); setPrompt(''); setPreview(null); setLoading(false); setApplying(false); } }, [isOpen]);
  if (!isOpen) return null;
  const suggestions = ['Reduce the checklist items', 'Add 2 more subtasks', 'Extend the deadline by 2 weeks', 'Make this high priority', 'Rewrite the description', 'Reassign to someone else'];

  const askAI = async () => {
    const p = prompt.trim();
    if (!p) return toast.error('Describe what you want to change');
    setLoading(true);
    try { const res = await editTaskWithAI({ taskId: task._id, prompt: p }).unwrap(); setPreview(res); setView('preview'); }
    catch (err) { toast.error(err?.data?.message || 'AI could not process that right now'); }
    finally { setLoading(false); }
  };

  const applyChanges = async () => {
    if (!preview?.proposed) return;
    setApplying(true);
    try { await applyTaskEdits({ taskId: task._id, proposed: preview.proposed }).unwrap(); toast.success('Task updated'); onApplied?.(); onClose(); }
    catch (err) { toast.error(err?.data?.message || 'Failed to apply changes'); }
    finally { setApplying(false); }
  };

  const currentSubs = preview?.current?.subTasks?.length ?? 0;
  const proposedSubs = preview?.proposed?.subTasks?.length ?? 0;
  const subDelta = proposedSubs - currentSubs;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl w-full max-w-lg shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800/60 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2"><FaMagic className="text-teal-600 dark:text-[#0d9488]" /><span>AI Edit</span></h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5 truncate">{task?.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg shrink-0"><FaTimes className="text-sm" /></button>
        </div>
        {view === 'prompt' ? (
          <>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Tell the AI what to change. It will show you a preview first — nothing saves until you tap Apply.</p>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder={`e.g. "Reduce the checklist to the 2 most important items"`} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 resize-none" maxLength={3000} />
              <div>
                <div className="text-[11px] font-medium text-gray-500 dark:text-gray-500 mb-2">Quick ideas</div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (<button key={s} type="button" onClick={() => setPrompt(s)} className="text-[11px] px-2.5 py-1 bg-gray-100 dark:bg-[#1a1a24] hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-[#0d9488] rounded-full transition border border-gray-200 dark:border-gray-800/40">{s}</button>))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-800/60 shrink-0">
              <button onClick={onClose} className="py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={askAI} disabled={loading || !prompt.trim()} className="py-2.5 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition hover:opacity-90" style={{ backgroundColor: brandColor }}>
                {loading ? (<><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /><span>Thinking...</span></>) : (<><FaMagic className="text-xs" /><span>Preview</span></>)}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3">
              {preview?.summary && (<div className="bg-teal-50 dark:bg-[#0d9488]/10 border border-teal-200 dark:border-[#0d9488]/30 rounded-xl p-3"><div className="text-[10px] font-semibold text-teal-700 dark:text-[#0d9488] uppercase tracking-wide mb-1">Summary</div><p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words">{preview.summary}</p></div>)}
              {Array.isArray(preview?.changes) && preview.changes.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Changes ({preview.changes.length})</div>
                  <div className="space-y-1.5">
                    {preview.changes.map((c, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-[#0b0b10] rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-800/60">
                        <div className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 break-words">{c.field}</div>
                        <div className="text-[11px] space-y-0.5">
                          {c.from && (<div className="text-red-600 dark:text-red-400 line-through break-words">{c.from}</div>)}
                          {c.to && (<div className="text-green-600 dark:text-green-400 break-words">{c.to}</div>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {currentSubs !== proposedSubs && (
                <div className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-[#0b0b10] rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-800/60">
                  <FaListUl className="text-teal-600 dark:text-[#0d9488] text-[10px] shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400 break-words">Checklist: {currentSubs} → <span className={subDelta > 0 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>{proposedSubs}</span>{subDelta !== 0 && (<span className="ml-1 opacity-70">({subDelta > 0 ? '+' : ''}{subDelta})</span>)}</span>
                </div>
              )}
              {Array.isArray(preview?.warnings) && preview.warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1"><FaExclamationTriangle className="text-[10px]" /> Notes</div>
                  <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5 list-disc pl-4">{preview.warnings.map((w, i) => (<li key={i} className="break-words">{w}</li>))}</ul>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-800/60 shrink-0">
              <button onClick={() => setView('prompt')} disabled={applying} className="py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition disabled:opacity-50">Back</button>
              <button onClick={applyChanges} disabled={applying} className="py-2.5 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition hover:opacity-90" style={{ backgroundColor: brandColor }}>
                {applying ? (<><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /><span>Applying...</span></>) : (<><FaCheck className="text-xs" /><span>Apply</span></>)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const TaskSummary = ({
  task, brandColor,
  submissionExpanded, setSubmissionExpanded,
  rejectionExpanded, setRejectionExpanded,
  hasSubmissionData, showRejection, isOverdueTask,
  onOpenNote,
}) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 text-xs">
      {task.dueDate && (<div><div className="text-gray-500 dark:text-gray-500 mb-0.5 flex items-center gap-1"><FaCalendarAlt /> Due</div><div className={`font-medium break-words ${isOverdueTask ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>{fmtDateTime(task.dueDate)}</div></div>)}
      {task.startDate && (<div><div className="text-gray-500 dark:text-gray-500 mb-0.5 flex items-center gap-1"><FaRegClock /> Start</div><div className="font-medium text-gray-800 dark:text-gray-200 break-words">{fmtDateTime(task.startDate)}</div></div>)}
      {task.estimatedHours != null && task.estimatedHours !== '' && (<div><div className="text-gray-500 dark:text-gray-500 mb-0.5">Est. hours</div><div className="font-medium text-gray-800 dark:text-gray-200">{task.estimatedHours}</div></div>)}
      {task.actualHours != null && task.status === 'confirmed_completed' && (<div><div className="text-gray-500 dark:text-gray-500 mb-0.5">Actual hours</div><div className="font-medium text-gray-800 dark:text-gray-200">{task.actualHours}</div></div>)}
    </div>
    {(task.assignees || []).length > 0 && (
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-500 mb-2">Assignees</div>
        <div className="flex flex-wrap gap-1.5">
          {task.assignees.map((a) => (
            <div key={a._id || a} className="flex items-center gap-1.5 bg-gray-50 dark:bg-[#1a1a24] rounded-full pl-0.5 pr-2.5 py-0.5 border border-gray-200 dark:border-gray-800/40 max-w-full">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold overflow-hidden shrink-0" style={{ backgroundColor: brandColor }}>{a.profile ? <img src={a.profile} className="w-full h-full object-cover" alt="" /> : (a.name || '?').charAt(0).toUpperCase()}</div>
              <span className="text-[11px] text-gray-700 dark:text-gray-300 break-words">{a.name || 'Unknown'}</span>
            </div>
          ))}
        </div>
      </div>
    )}
    {task.description && (<div><div className="text-xs text-gray-500 dark:text-gray-500 mb-1">Description</div><p className="text-sm text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap leading-relaxed">{task.description}</p></div>)}
    {task.links?.length > 0 && (<div><div className="text-xs text-gray-500 dark:text-gray-500 mb-1.5 flex items-center gap-1"><FaLink /> Links</div><div className="space-y-1">{task.links.map((l, i) => (<a key={i} href={l} target="_blank" rel="noreferrer" className="block text-xs text-teal-600 dark:text-[#0d9488] underline break-all hover:opacity-80">{l}</a>))}</div></div>)}
    {task.attachments?.length > 0 && (<div><div className="text-xs text-gray-500 dark:text-gray-500 mb-1.5 flex items-center gap-1"><FaPaperclip /> Attachments</div><div className="space-y-1">{task.attachments.map((a, i) => (<a key={i} href={a.url} target="_blank" rel="noreferrer" className="block text-xs text-teal-600 dark:text-[#0d9488] underline break-all hover:opacity-80">{a.name || 'file'}</a>))}</div></div>)}
    {task.linkedNotes?.length > 0 && (
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-500 mb-1.5 flex items-center gap-1"><FaStickyNote /> Linked notes</div>
        <div className="space-y-1">
          {task.linkedNotes.map((ln, i) => {
            const title = ln.note?.title || '[Deleted]';
            const snippet = ln.note?.content ? ln.note.content.replace(/\s+/g, ' ').replace(/<[^>]+>/g, '').trim().slice(0, 90) : '';
            const isWs = ln.source === 'workspace';
            return (
              <button key={i} type="button" onClick={() => onOpenNote(ln)} className="w-full text-left flex items-start gap-2 text-xs bg-teal-50/60 dark:bg-[#0d9488]/10 border border-teal-200/60 dark:border-[#0d9488]/30 rounded-lg px-2.5 py-2 hover:bg-teal-100/60 dark:hover:bg-[#0d9488]/20 hover:border-teal-300 dark:hover:border-[#0d9488]/50 transition group" title="Open note">
                {isWs ? <FaUsers className="text-teal-600 dark:text-[#0d9488] text-[10px] shrink-0 mt-0.5" /> : <FaUser className="text-teal-600 dark:text-[#0d9488] text-[10px] shrink-0 mt-0.5" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-gray-700 dark:text-gray-300 break-words truncate font-medium">{title}</span>
                  {snippet && (<span className="block text-[10px] text-gray-500 dark:text-gray-500 truncate mt-0.5">{snippet}{ln.note?.content && ln.note.content.length > 90 ? '…' : ''}</span>)}
                </span>
                <FaAngleRight className="text-[10px] text-teal-500/70 dark:text-[#0d9488]/70 shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            );
          })}
        </div>
      </div>
    )}
    {hasSubmissionData && (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800/60 bg-gray-50 dark:bg-[#1a1a24] overflow-hidden">
        <button onClick={() => setSubmissionExpanded(!submissionExpanded)} className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/40 transition">
          <span className="flex items-center gap-1.5"><FaCheckDouble className="text-teal-500" /> Submission Details</span>
          <FaAngleDown className={`text-gray-400 text-[10px] transition-transform ${submissionExpanded ? 'rotate-180' : ''}`} />
        </button>
        {submissionExpanded && (
          <div className="px-3 pb-3 space-y-2 text-xs">
            {task.completionNotes && <div className="break-words"><span className="font-medium text-gray-700 dark:text-gray-300">Notes: </span><span className="text-gray-600 dark:text-gray-400">{task.completionNotes}</span></div>}
            {task.finalLinks?.length > 0 && (<div><div className="font-medium text-gray-700 dark:text-gray-300 mb-0.5">Links:</div>{task.finalLinks.map((l, i) => <a key={i} href={l} target="_blank" rel="noreferrer" className="block text-teal-600 dark:text-[#0d9488] underline break-all">{l}</a>)}</div>)}
            {task.finalAttachments?.length > 0 && (<div><div className="font-medium text-gray-700 dark:text-gray-300 mb-0.5">Attachments:</div>{task.finalAttachments.map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block text-teal-600 dark:text-[#0d9488] underline break-all">{a.name || 'file'}</a>)}</div>)}
            {task.completedBy && <div className="break-words text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Submitted by: </span>{task.completedBy.name || 'Unknown'} on {fmtDateTime(task.completedAt)}</div>}
            {task.status === 'confirmed_completed' && task.completionFeedback && <div className="break-words text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Feedback: </span>{task.completionFeedback}</div>}
          </div>
        )}
      </div>
    )}
    {showRejection && (
      <div className="rounded-2xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10 overflow-hidden">
        <button onClick={() => setRejectionExpanded(!rejectionExpanded)} className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-red-700 dark:text-red-400">
          <span className="flex items-center gap-1.5"><FaExclamationTriangle /> Task Rejected</span>
          <FaAngleDown className={`text-red-400 text-[10px] transition-transform ${rejectionExpanded ? 'rotate-180' : ''}`} />
        </button>
        {rejectionExpanded && (
          <div className="px-3 pb-3 space-y-1.5 text-xs">
            <div className="break-words text-gray-700 dark:text-gray-300"><span className="font-medium">Rejected by: </span>{task.rejectedBy?.name || 'Unknown'} on {fmtDateTime(task.rejectedAt)}</div>
            {task.rejectionReason && <div className="break-words text-gray-700 dark:text-gray-300"><span className="font-medium">Reason: </span>{task.rejectionReason}</div>}
          </div>
        )}
      </div>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// Public viewer banner
// ═══════════════════════════════════════════════════════════════
const PublicViewerBanner = ({ onSignup, onLogin }) => (
  <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-[#0d9488]/10 dark:to-[#0d9488]/5 border-b border-teal-200/60 dark:border-[#0d9488]/30 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
    <div className="flex items-center gap-2 min-w-0">
      <FaEye className="text-teal-600 dark:text-[#0d9488] shrink-0 text-sm" />
      <p className="text-[11px] sm:text-xs text-teal-800 dark:text-teal-300 truncate">
        <span className="font-semibold">Public view</span> · You're seeing this task as a guest. Sign up to interact.
      </p>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      <button onClick={onLogin} className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-teal-500/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100/60 dark:hover:bg-[#0d9488]/20 transition">Sign in</button>
      <button onClick={onSignup} className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-teal-600 dark:bg-[#0d9488] text-white hover:opacity-90 transition">Sign up</button>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// Guest prompt modal — polite signup/login nudge
// ═══════════════════════════════════════════════════════════════
const GuestPromptModal = ({ isOpen, onClose, onSignup, onLogin, actionLabel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 dark:from-[#0d9488] dark:via-[#0f9e96] dark:to-[#0f766e] px-6 pt-7 pb-6 text-center">
          <div className="absolute inset-0 opacity-[0.14] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '14px 14px' }} />
          <div className="relative w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-white/15 backdrop-blur-sm border border-white/25 shadow-lg">
            <FaUserPlus className="text-white text-2xl" />
          </div>
          <h3 className="relative text-lg font-bold text-white">Join in a second</h3>
          <p className="relative text-xs text-white/85 mt-1">
            {actionLabel ? <>You'll need a free account to {actionLabel}.</> : "You'll need a free account to do that."}
          </p>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center leading-relaxed mb-5">
            Creating an account is free and only takes a moment.
            Then you can assign, complete and comment on tasks.
          </p>
          <div className="space-y-2.5">
            <button onClick={onSignup} className="w-full py-3 bg-teal-600 hover:bg-teal-700 dark:bg-[#0d9488] dark:hover:bg-[#0f9e96] text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 active:scale-[0.98]">
              <FaUserPlus className="text-xs" /> Create free account
            </button>
            <button onClick={onLogin} className="w-full py-3 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition flex items-center justify-center gap-2 active:scale-[0.98]">
              <FaSignInAlt className="text-xs" /> I already have an account
            </button>
          </div>
          <button onClick={onClose} className="w-full mt-4 py-2 text-xs text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════
const YourWorkspaceTaskId = () => {
  // ONE route, ONE URL. No token, no /p/ path. Everyone hits
  // /workspace/:workspaceId/project/:projectId/task/:taskId.
  const { workspaceId, projectId, taskId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((s) => s.auth);

  // ─── Guest detection ────────────────────────────────────────
  // If there's no userInfo in Redux, this person is a guest.
  // We never block them from viewing — we just intercept actions.
  const isGuest = !userInfo;

  const [guestPrompt, setGuestPrompt] = useState({ isOpen: false, actionLabel: null });

  const promptGuest = useCallback((actionLabel) => {
    if (!isGuest) return false;
    setGuestPrompt({ isOpen: true, actionLabel });
    return true;
  }, [isGuest]);

  // ─── Queries ────────────────────────────────────────────────
  const shouldFetchWorkspace = !!workspaceId && !isGuest;
  const shouldFetchProject   = !!projectId   && !isGuest;

  const { data: wData } = useGetWorkspaceQuery(workspaceId, { skip: !shouldFetchWorkspace });

  const { data: pData, isLoading: pLoad, error: pErr } = useGetProjectByIdQuery(projectId, { skip: !shouldFetchProject });

  const { data: tData, isLoading: tLoad, error: tErr, refetch: refetchTask } = useGetTaskByIdQuery(taskId, { skip: !taskId });

  const { data: foldersData } = useGetProjectFoldersQuery(projectId, { skip: !projectId || isGuest });

  const { data: feedbackData } = useGetTaskFeedbackQuery({ taskId }, { skip: !taskId || isGuest });

  // ─── Mutations ──────────────────────────────────────────────
  const [deleteTask] = useDeleteTaskMutation();
  const [assignTask] = useAssignTaskMutation();
  const [markTaskCompleted] = useMarkTaskCompletedMutation();
  const [confirmTaskCompletion] = useConfirmTaskCompletionMutation();
  const [rejectTask] = useRejectTaskMutation();
  const [sendManualReminder] = useSendManualReminderMutation();
  const [addSubTask] = useAddSubTaskMutation();
  const [updateSubTask] = useUpdateSubTaskMutation();
  const [markSubTaskDone] = useMarkSubTaskDoneMutation();
  const [confirmSubTask] = useConfirmSubTaskMutation();
  const [rejectSubTask] = useRejectSubTaskMutation();
  const [deleteSubTask] = useDeleteSubTaskMutation();
  const [reorderSubTasks] = useReorderSubTasksMutation();

  // ─── Response unwrap ────────────────────────────────────────
  const task      = tData?.task;
  const project   = pData?.project   || tData?.project;
  const workspace = wData?.workspace || tData?.workspace;

  const serverViewer = tData?.viewer;
  const serverMode   = tData?.mode;
  const isPublicMode = serverMode === 'public';

  // ─── Permissions — the server tells us what's allowed ──────
  // Guests get `false` from all of these because the server
  // never marks an anonymous caller as a manager/assignee.
  const canManage = !!serverViewer?.canManage && !isGuest;
  const canAct    = !!serverViewer?.canAct    && !isGuest;
  const canEdit   = !!serverViewer?.canEdit   && !isGuest;
  const canComment= !!serverViewer?.canComment&& !isGuest;

  const isAssignee = !isGuest && (task?.assignedToMe ?? false);
  const isAssociate = !isGuest && String(serverViewer?.role || '').startsWith('associate');

  const taskAccess    = task?.access || {};
  const taskCanManage = !isGuest && (taskAccess.canManage ?? canManage);
  const taskCanAct    = !isGuest && (taskAccess.canAct    ?? canAct);
  const taskCanEdit   = !isGuest && (taskAccess.canEdit   ?? canEdit);

  const isReadOnly   = !!(task?.isArchived || task?.isTrash);
  const hasAssignees = (task?.assignees || []).length > 0;

  const brandColor = workspace?.color || project?.color || '#0d9488';

  const assignableMembers = useMemo(() => {
    if (!project || isGuest) return [];
    const mgrs = project.projectManagers || [];
    const active = (project.teamMembers || []).filter((m) => m.status === 'active');
    const all = [...active, ...mgrs.map((pm) => ({ user: pm }))];
    const seen = new Set();
    return all.filter((it) => {
      const id = it.user?._id || it._id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [project, isGuest]);

  // ─── UI state ───────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const [openNoteLink, setOpenNoteLink] = useState(null);
  const notePanelOpen = !!openNoteLink && !isMobile;
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showMarkComplete, setShowMarkComplete] = useState(false);
  const [showConfirmCompletion, setShowConfirmCompletion] = useState(false);
  const [showAIEdit, setShowAIEdit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [doneModal, setDoneModal] = useState({ isOpen: false, index: null });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, index: null });
  const [rejectModal, setRejectModal] = useState({ isOpen: false, index: null });
  const [deleteSubModal, setDeleteSubModal] = useState({ isOpen: false, index: null });
  const [itemActionModal, setItemActionModal] = useState({ isOpen: false, index: null });
  const [subTaskEditModal, setSubTaskEditModal] = useState({ isOpen: false, index: null });
  const [expandedSub, setExpandedSub] = useState(null);
  const [submissionExpanded, setSubmissionExpanded] = useState(false);
  const [rejectionExpanded, setRejectionExpanded] = useState(!!task?.rejectedBy);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [selectedSubIndices, setSelectedSubIndices] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const longPressTimerRef = useRef(null);
  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => { if (task?.rejectedBy) setRejectionExpanded(true); }, [task?.rejectedBy]);
  useEffect(() => { setSelectedSubIndices(new Set()); }, [task?._id]);
  useEffect(() => () => clearLongPress(), []);

  const canAIEdit =
    !isGuest && !isReadOnly &&
    (taskCanManage || (isAssignee && task?.allowAssigneeEditSubtasks));

  // ─── Early returns ──────────────────────────────────────────
  if (!taskId) {
    return (
      <>
        <GlobalStyles />
        <div className="min-h-dvh flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10] p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"><FaExclamationTriangle className="text-2xl" /></div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Invalid task link</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">This URL is missing a task identifier.</p>
            <button onClick={() => navigate(-1)} className="w-full py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl text-sm font-medium hover:opacity-90 transition">Go back</button>
          </div>
        </div>
      </>
    );
  }

  // Only block on initial load, not on refetch
  const stillLoading = tLoad && !task;

  if (stillLoading) {
    return (<><GlobalStyles /><TaskSkeleton /></>);
  }

  // ─── Errors ─────────────────────────────────────────────────
  if (tErr) {
    const status = tErr?.status;
    const serverMessage = tErr?.data?.message || '';
    const is403 = status === 403;
    const is404 = status === 404;
    const is410 = status === 410;
    const title = is403 ? 'Access Denied' : is410 ? 'Invite no longer valid' : is404 ? 'Task Not Found' : 'Something went wrong';
    const message = serverMessage || (
      is403 ? "You don't have permission to view this task."
      : is410 ? 'This share link has been revoked.'
      : is404 ? 'This task may have been deleted or moved.'
      : 'Please try again in a moment.'
    );

    return (
      <>
        <GlobalStyles />
        <div className="min-h-dvh flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10] p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl text-center">
            <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 ${is403 ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'}`}><FaExclamationTriangle className="text-2xl" /></div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">{title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 break-words leading-relaxed">{message}</p>
            <div className="flex gap-3">
              {!is403 && !is404 && !is410 && (<button onClick={() => refetchTask()} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Try again</button>)}
              <button onClick={() => navigate(`/workspace/${workspaceId}/project/${projectId}`)} className="flex-1 py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl text-sm font-medium hover:opacity-90 transition">Back to project</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!task) {
    return (
      <>
        <GlobalStyles />
        <div className="min-h-dvh flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10] p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"><FaExclamationTriangle className="text-2xl" /></div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Task unavailable</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">We couldn't load this task.</p>
            <button onClick={() => refetchTask()} className="w-full py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl text-sm font-medium hover:opacity-90 transition">Try again</button>
          </div>
        </div>
      </>
    );
  }

  // ─── Navigation — always workspace route, no /p/ ───────────
  const backToProject = () => navigate(`/workspace/${workspaceId}/project/${projectId}`);

  // ─── Handlers ───────────────────────────────────────────────
  const handleDelete = async () => { try { await deleteTask(task._id).unwrap(); toast.success('Deleted'); backToProject(); } catch (e) { toast.error(e?.data?.message || 'Failed'); } };
  const handleAssign = async (ids) => { try { await assignTask({ taskId: task._id, assigneeIds: ids, assigneeId: ids[0] || '' }).unwrap(); toast.success('Assigned'); refetchTask(); } catch (err) { throw err; } };
  const handleMarkComplete = async ({ notes, links, attachments }) => {
    try {
      const fd = new FormData();
      fd.append('notes', notes || '');
      links.forEach((l) => fd.append('links', l));
      attachments.forEach((f) => fd.append('completionAttachments', f));
      await markTaskCompleted({ taskId: task._id, data: fd }).unwrap();
      toast.success(taskCanManage ? 'Task completed and confirmed' : 'Task submitted, awaiting confirmation');
      refetchTask();
    } catch (err) { toast.error(err?.data?.message || 'Failed to submit task'); throw err; }
  };
  const handleConfirmCompletion = async (data) => {
    try {
      const fd = new FormData();
      fd.append('feedback', data.feedback || '');
      if (data.finalHours !== undefined) fd.append('finalHours', data.finalHours.toString());
      (data.finalLinks || []).forEach((l) => fd.append('finalLinks', l));
      (data.finalAttachments || []).forEach((f) => fd.append('finalAttachments', f));
      await confirmTaskCompletion({ taskId: task._id, data: fd }).unwrap();
      toast.success('Task completion confirmed');
      refetchTask();
    } catch (err) { toast.error(err?.data?.message || 'Failed to confirm'); throw err; }
  };
  const handleRejectTask = async (id, reason) => { try { await rejectTask({ taskId: id, reason }).unwrap(); toast.success('Task rejected'); refetchTask(); } catch (err) { toast.error(err?.data?.message || 'Failed to reject'); throw err; } };
  const handleReminder = async () => { try { await sendManualReminder({ taskId: task._id, message: '' }).unwrap(); toast.success('Reminder sent'); } catch (e) { toast.error(e?.data?.message || 'Failed to send reminder'); } };
  const handleAddSubtask = async (data) => { await addSubTask({ taskId: task._id, data }).unwrap(); refetchTask(); };
  const submitEditSubTask = async (data) => {
    try {
      await updateSubTask({ taskId: task._id, subTaskIndex: subTaskEditModal.index, data }).unwrap();
      toast.success('Item updated'); refetchTask();
    } catch (e) { toast.error(e?.data?.message || 'Failed to update item'); throw e; }
  };
  const submitDone = async ({ notes, links, files }) => {
    const fd = new FormData();
    fd.append('notes', notes || '');
    fd.append('links', JSON.stringify(links || []));
    (files || []).forEach((f) => fd.append('attachments', f));
    await markSubTaskDone({ taskId: task._id, subTaskIndex: doneModal.index, data: fd }).unwrap();
    toast.success(taskCanManage ? 'Item completed & confirmed' : 'Item marked done');
    refetchTask();
  };
  const submitConfirmSub = async (feedback) => { await confirmSubTask({ taskId: task._id, subTaskIndex: confirmModal.index, feedback }).unwrap(); toast.success('Item confirmed'); refetchTask(); };
  const submitRejectSub = async (reason) => { await rejectSubTask({ taskId: task._id, subTaskIndex: rejectModal.index, reason }).unwrap(); toast.success('Item rejected'); refetchTask(); };
  const confirmDeleteSub = async () => {
    try { await deleteSubTask({ taskId: task._id, subTaskIndex: deleteSubModal.index }).unwrap(); toast.success('Item deleted'); refetchTask(); }
    catch (e) { toast.error(e?.data?.message || 'Failed'); }
    setDeleteSubModal({ isOpen: false, index: null });
  };
  const toggleSubSelection = (idx) => {
    setSelectedSubIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };
  const startSubSelection = (idx) => { setSelectedSubIndices(new Set([idx])); };
  const clearSubSelection = () => setSelectedSubIndices(new Set());
  const handleDeleteSelectedSubs = async () => {
    if (selectedSubIndices.size === 0) return;
    setBulkDeleting(true);
    const indices = [...selectedSubIndices].sort((a, b) => b - a);
    let ok = 0;
    for (const idx of indices) { try { await deleteSubTask({ taskId: task._id, subTaskIndex: idx }).unwrap(); ok += 1; } catch (e) { /* continue */ } }
    clearSubSelection();
    refetchTask();
    setBulkDeleting(false);
    if (ok === indices.length) toast.success(`${ok} item${ok > 1 ? 's' : ''} deleted`);
    else if (ok > 0) toast.success(`${ok} of ${indices.length} items deleted`);
    else toast.error('Failed to delete items');
  };

  const canReorderSub = !isGuest && !isReadOnly && (taskCanManage || (isAssignee && task.allowAssigneeEditSubtasks));

  const onSubDragStart = (e, i) => {
    if (!canReorderSub) { e.preventDefault(); promptGuest('reorder checklist items'); return; }
    setDraggedIdx(i);
    try { e.dataTransfer.setData('text/plain', String(i)); } catch {}
    e.dataTransfer.effectAllowed = 'move';
  };
  const onSubDragEnd = () => { setDraggedIdx(null); setDragOverIdx(null); };
  const onSubDragOver = (e, idx) => {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch {}
    if (draggedIdx !== null && draggedIdx !== idx) setDragOverIdx(idx);
  };
  const onSubDrop = async (e, targetIdx) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    const di = raw !== '' ? parseInt(raw, 10) : draggedIdx;
    setDragOverIdx(null);
    if (di === null || di === undefined || isNaN(di) || di === targetIdx) { setDraggedIdx(null); return; }
    const subtasks = task.subTasks || [];
    const indices = subtasks.map((_, i) => i);
    const [moved] = indices.splice(di, 1);
    indices.splice(targetIdx, 0, moved);
    setDraggedIdx(null);
    try { await reorderSubTasks({ taskId: task._id, orderedSubTaskIndices: indices }).unwrap(); refetchTask(); }
    catch (err) { toast.error(err?.data?.message || 'Failed to reorder'); }
  };

  const openItemModal = (idx) => { setItemActionModal({ isOpen: true, index: idx }); };

  // Row interactions — guests get the prompt
  const handleRowContextMenu = (e, idx) => {
    e.preventDefault();
    if (isGuest) { promptGuest('open the item menu'); return; }
    if (selectedSubIndices.size > 0) { toggleSubSelection(idx); return; }
    openItemModal(idx);
  };
  const handleRowTouchStart = (idx) => {
    if (isGuest) { promptGuest('open the item menu'); return; }
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      if (selectedSubIndices.size > 0) { toggleSubSelection(idx); return; }
      openItemModal(idx);
    }, 500);
  };
  const handleRowTouchEnd = () => { clearLongPress(); };
  const handleRowTouchMove = () => { clearLongPress(); };
  const handleRowClick = (e, idx) => {
    if (selectedSubIndices.size > 0) {
      if (e.target.closest('.subtask-grip') || e.target.closest('.subtask-checkbox') || e.target.closest('.subtask-expand')) return;
      toggleSubSelection(idx);
    }
  };

  const progress = task.progress || 0;
  const subTasks = task.subTasks || [];
  const confirmedCount = subTasks.filter((s) => s.status === 'confirmed').length;
  const hasRecurrence = task.recurrenceType && task.recurrenceType !== 'none';
  const hasSubmissionData = task.completionNotes || task.finalLinks?.length || task.finalAttachments?.length || task.completedBy;
  const showRejection = task.rejectedBy && task.rejectedAt;
  const isOverdueTask = task.dueDate && new Date(task.dueDate) < new Date() && !['completed', 'confirmed_completed', 'cancelled'].includes(task.status);

  const showMarkCompleteBtn = !isGuest && !isReadOnly && task.status === 'ready_for_completion' && (isAssignee || taskCanManage);
  const showConfirmCompletionBtn = !isGuest && !isReadOnly && taskCanManage && task.status === 'completed';
  const canSelectSubs = !isGuest && !isReadOnly && ((isAssignee && task.allowAssigneeEditSubtasks) || taskCanManage) && subTasks.length > 0;
  const canAddItems = !isGuest && !isReadOnly && ((isAssignee && task.allowAssigneeEditSubtasks) || taskCanManage);

  const currentItem = itemActionModal.index != null ? subTasks[itemActionModal.index] : null;
  const editingItem = subTaskEditModal.index != null ? subTasks[subTaskEditModal.index] : null;

  // ─── Render ─────────────────────────────────────────────────
  return (
    <>
      <GlobalStyles />
      <style>{NOTE_RICH_CSS}</style>

      <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col overflow-hidden">
        {/* Public banner for guests / public-mode viewers */}
        {(isGuest || isPublicMode) && (
          <PublicViewerBanner onSignup={() => navigate('/signup')} onLogin={() => navigate('/login')} />
        )}

        <header className="shrink-0 bg-white/90 dark:bg-[#14141a]/90 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/60 z-20">
          <div className="px-3 lg:px-6 py-2.5 lg:py-3 flex items-center gap-2 lg:gap-3">
            <button onClick={backToProject} className="p-1.5 -ml-1 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition shrink-0">
              <FaArrowLeft className="text-sm" />
            </button>
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: brandColor }}>
              {task.title.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm lg:text-base font-semibold text-gray-800 dark:text-gray-100 leading-tight truncate flex items-center gap-1.5 flex-wrap">
                <span className="truncate">{task.title}</span>
                {(isGuest || isPublicMode) && (
                  <span className="text-[10px] font-normal text-teal-600 dark:text-[#0d9488] bg-teal-50 dark:bg-[#0d9488]/15 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
                    <FaEye className="text-[8px]" /> Public
                  </span>
                )}
                {!isGuest && isAssociate && (
                  <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
                    <FaUserShield className="text-[8px]" /> Associate
                  </span>
                )}
                {isReadOnly && (
                  <span className="text-[10px] font-normal text-gray-500 bg-gray-100 dark:bg-gray-800/40 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
                    <FaLock className="text-[8px]" /> Read-only
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-1.5 text-[11px] flex-wrap mt-0.5 text-gray-500 dark:text-gray-400">
                <StatusPill status={task.status} />
                <span className="hidden sm:inline"><PriorityPill priority={task.priority} /></span>
                <span className="font-mono">{confirmedCount}/{subTasks.length} done</span>
                {task.dueDate && (<><span className="hidden sm:inline">·</span><span className={`${isOverdueTask ? 'text-red-500 font-medium' : ''} flex items-center gap-0.5`}><FaCalendarAlt className="text-[9px]" /> {fmtDate(task.dueDate)}</span></>)}
                {hasRecurrence && (<><span className="hidden sm:inline">·</span><span className="text-teal-600 dark:text-[#0d9488] flex items-center gap-0.5"><FaRedo className="text-[9px]" /> {task.recurrenceType === 'daily' ? 'Daily' : 'Weekly'}</span></>)}
              </div>
            </div>

            {showMarkCompleteBtn && (
              <button onClick={() => setShowMarkComplete(true)} className="hidden lg:flex shrink-0 px-3.5 py-2 text-white rounded-lg text-sm font-medium items-center gap-1.5 hover:opacity-90 transition" style={{ backgroundColor: brandColor }}>
                <FaCheckDouble className="text-xs" />{taskCanManage ? 'Mark as Complete & Confirm' : 'Mark as Complete'}
              </button>
            )}
            {showConfirmCompletionBtn && (
              <button onClick={() => setShowConfirmCompletion(true)} className="hidden lg:flex shrink-0 px-3.5 py-2 text-white rounded-lg text-sm font-medium items-center gap-1.5 hover:opacity-90 transition" style={{ backgroundColor: brandColor }}>
                <FaCheckCircle className="text-xs" />Confirm Completion
              </button>
            )}

            {/* Options menu — visible for everyone. Guests get prompted. */}
            <button
              onClick={() => { if (promptGuest('open the task menu')) return; setShowMenu(true); }}
              className="shrink-0 p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"
              aria-label="Task options">
              <FaEllipsisV className="text-sm" />
            </button>
          </div>
          <div className="w-full h-0.5 bg-gray-200/60 dark:bg-gray-800/40">
            <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: brandColor }} />
          </div>
        </header>

        {/* BODY */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className={`flex-1 min-w-0 overflow-y-auto lg:overflow-hidden lg:grid ${notePanelOpen ? 'lg:grid-cols-[320px_minmax(0,1fr)_auto]' : 'lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]'}`}>
            <aside className="hidden lg:block lg:h-full lg:overflow-y-auto bg-white dark:bg-[#14141a] border-r border-gray-200/60 dark:border-gray-800/60">
              <div className="p-5">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-4">Task Details</h3>
                <TaskSummary
                  task={task} brandColor={brandColor}
                  submissionExpanded={submissionExpanded} setSubmissionExpanded={setSubmissionExpanded}
                  rejectionExpanded={rejectionExpanded} setRejectionExpanded={setRejectionExpanded}
                  hasSubmissionData={hasSubmissionData} showRejection={showRejection} isOverdueTask={isOverdueTask}
                  onOpenNote={setOpenNoteLink}
                />
              </div>
            </aside>

            <main className="lg:h-full lg:overflow-y-auto">
              <div className="p-3 lg:p-6 space-y-4 lg:space-y-5">
                <div className="lg:hidden">
                  <button onClick={() => setMobileDetailsOpen(!mobileDetailsOpen)} className="w-full flex items-center justify-between bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/40 px-3 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                    <span className="flex items-center gap-2"><FaListUl className="text-teal-600 dark:text-[#0d9488] text-[11px]" /> Task details</span>
                    <FaAngleDown className={`text-gray-400 text-[10px] transition-transform ${mobileDetailsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileDetailsOpen && (
                    <div className="mt-2 bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/40 p-3">
                      <TaskSummary
                        task={task} brandColor={brandColor}
                        submissionExpanded={submissionExpanded} setSubmissionExpanded={setSubmissionExpanded}
                        rejectionExpanded={rejectionExpanded} setRejectionExpanded={setRejectionExpanded}
                        hasSubmissionData={hasSubmissionData} showRejection={showRejection} isOverdueTask={isOverdueTask}
                        onOpenNote={setOpenNoteLink}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <FaTasks className="text-teal-600 dark:text-[#0d9488]" /> Checklist
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-500">({confirmedCount}/{subTasks.length})</span>
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {canAIEdit && (
                      <button onClick={() => setShowAIEdit(true)} className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-500/10 transition" title="AI Edit">
                        <FaMagic className="text-xs" /> AI
                      </button>
                    )}
                    {canAddItems && (
                      <button onClick={() => setAddSubOpen(true)} className="text-xs text-teal-600 dark:text-[#0d9488] font-medium flex items-center gap-1 hover:text-teal-700 dark:hover:text-[#14b8a6] transition px-2.5 py-1 rounded-lg hover:bg-teal-50 dark:hover:bg-[#0d9488]/10">
                        <FaPlus className="text-xs" /> Add items
                      </button>
                    )}
                    {/* Guests: soft-styled duplicate prompts on click */}
                    {isGuest && (
                      <button onClick={() => promptGuest('add checklist items')} className="text-xs text-teal-600 dark:text-[#0d9488] font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 transition">
                        <FaPlus className="text-xs" /> Add items
                      </button>
                    )}
                  </div>
                </div>

                {selectedSubIndices.size > 0 && !isGuest && (
                  <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl shadow-lg">
                    <span className="text-sm font-medium flex-1">{selectedSubIndices.size} selected</span>
                    <button onClick={clearSubSelection} className="text-xs px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition">Clear</button>
                    {canSelectSubs && (
                      <button onClick={handleDeleteSelectedSubs} disabled={bulkDeleting} className="text-xs px-2.5 py-1 bg-red-500 hover:bg-red-600 disabled:opacity-60 rounded-lg flex items-center gap-1 transition">
                        <FaTrashAlt className="text-[10px]" />{bulkDeleting ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </div>
                )}

                {subTasks.length === 0 ? (
                  <div className="text-center py-14 bg-white dark:bg-[#14141a] rounded-2xl border border-dashed border-gray-300 dark:border-gray-800/60">
                    <FaListUl className="text-3xl mx-auto text-gray-300 dark:text-gray-700 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-500">No checklist items yet</p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Break this task down into smaller pieces</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {subTasks.map((st, idx) => {
                      const isConfirmed = st.status === 'confirmed';
                      const isDone = st.status === 'done';
                      const isPending = st.status === 'pending';
                      const isSelected = selectedSubIndices.has(idx);
                      const isDragOver = dragOverIdx === idx;

                      const subAccess = st.access || {};
                      const subCanAct = !isGuest && (subAccess.canAct ?? taskCanAct);
                      const subCanConfirm = !isGuest && (subAccess.canConfirm ?? taskCanManage);

                      const showMarkDone = !isGuest && !isReadOnly && (isAssignee || subCanAct) && isPending;
                      const canDeleteThis = !isGuest && ((isAssignee && !isConfirmed) || taskCanManage) && canReorderSub;

                      const hasDetails = st.notes || st.links?.length || st.attachments?.length || st.feedback || st.rejectedBy;
                      const isOverdue = st.dueDate && new Date(st.dueDate) < new Date() && !isConfirmed;
                      const completedBy = st.confirmedBy || st.completedBy;

                      const checkboxClass = isConfirmed || isDone
                        ? 'text-white border-transparent'
                        : 'border-gray-300 dark:border-gray-600 hover:border-teal-500';
                      const checkboxStyle = isConfirmed
                        ? { backgroundColor: brandColor, borderColor: brandColor }
                        : isDone
                          ? { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }
                          : {};

                      const handleCheckboxClick = (e) => {
                        e.stopPropagation();
                        if (isReadOnly) return;
                        // Guests → polite prompt
                        if (isGuest) { promptGuest('mark this item done'); return; }
                        if (selectedSubIndices.size > 0) { toggleSubSelection(idx); return; }
                        if (isConfirmed) { toast.info('Already confirmed'); return; }
                        if (isPending && showMarkDone) { setDoneModal({ isOpen: true, index: idx }); return; }
                        if (isDone && subCanConfirm) { setConfirmModal({ isOpen: true, index: idx }); return; }
                        if (isPending && !showMarkDone) { toast.error("You can't mark this item done"); return; }
                        if (isDone && !subCanConfirm) { toast.info('Waiting for a manager to confirm'); }
                      };

                      return (
                        <div
                          key={idx}
                          onContextMenu={(e) => handleRowContextMenu(e, idx)}
                          onTouchStart={() => handleRowTouchStart(idx)}
                          onTouchEnd={handleRowTouchEnd}
                          onTouchMove={handleRowTouchMove}
                          onClick={(e) => handleRowClick(e, idx)}
                          onDragOver={(e) => onSubDragOver(e, idx)}
                          onDragLeave={() => setDragOverIdx(null)}
                          onDrop={(e) => onSubDrop(e, idx)}
                          className={`bg-white dark:bg-[#14141a] rounded-2xl border transition-all select-none ${
                            isDragOver ? 'border-teal-500 dark:border-[#0d9488] bg-teal-50/50 dark:bg-[#0d9488]/5'
                            : isSelected ? 'border-teal-400 dark:border-[#0d9488]/70 bg-teal-50/60 dark:bg-[#0d9488]/10'
                            : 'border-gray-200/60 dark:border-gray-800/40 hover:border-gray-300 dark:hover:border-gray-700/60'
                          }`}
                        >
                          <div className="p-3 lg:p-4">
                            <div className="flex items-start gap-2 sm:gap-3 w-full">
                              {canReorderSub && (
                                <div className="subtask-grip shrink-0 text-gray-300 dark:text-gray-700 mt-0.5 cursor-grab touch-none active:cursor-grabbing" draggable onDragStart={(e) => onSubDragStart(e, idx)} onDragEnd={onSubDragEnd} title="Drag to reorder">
                                  <FaGripVertical className="text-sm" />
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={handleCheckboxClick}
                                className={`subtask-checkbox w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${checkboxClass}`}
                                style={checkboxStyle}
                                title={
                                  isConfirmed ? 'Confirmed'
                                  : isDone ? 'Marked done — awaiting confirmation'
                                  : isGuest ? 'Sign up to mark this item done'
                                  : showMarkDone ? 'Mark done'
                                  : 'Pending'
                                }
                              >
                                {(isConfirmed || isDone) && <FaCheck className="text-[10px]" />}
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1 sm:gap-2">
                                  <span className="text-sm break-words flex-1 min-w-0">
                                    <span className={isConfirmed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-white'}>{st.title}</span>
                                    {(isDone || isConfirmed) && completedBy && (<span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">by {getFirstName(completedBy.name)}</span>)}
                                    {isDone && (<span className="text-[10px] text-blue-500 dark:text-blue-400 ml-1 font-medium">· awaiting confirmation</span>)}
                                  </span>
                                  {hasDetails && (
                                    <button onClick={(e) => { e.stopPropagation(); setExpandedSub(expandedSub === idx ? null : idx); }} className="subtask-expand p-1.5 -mr-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition flex-shrink-0" title={expandedSub === idx ? 'Hide details' : 'Show details'}>
                                      <FaAngleDown className={`text-xs transition-transform ${expandedSub === idx ? 'rotate-180' : ''}`} />
                                    </button>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-1 sm:gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {st.dueDate && (<span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : ''}`}><FaRegClock className="text-[10px]" /> {fmtDateTime(st.dueDate)}</span>)}
                                  {st.recurrenceType && st.recurrenceType !== 'none' && (<span className="flex items-center gap-0.5 text-teal-600 dark:text-teal-400"><FaRedo className="text-[10px]" /> {st.recurrenceType === 'daily' ? 'Daily' : 'Weekly'}</span>)}
                                  {isOverdue && <span className="text-red-500 font-medium">Overdue</span>}
                                </div>
                              </div>
                            </div>

                            {expandedSub === idx && hasDetails && (
                              <div className="mt-3 pt-3 pl-6 sm:pl-10 border-t border-gray-100 dark:border-gray-800/40 text-xs space-y-1.5">
                                {st.notes && <div className="break-words text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Notes: </span>{st.notes}</div>}
                                {st.links?.length > 0 && (<div><span className="font-medium text-gray-700 dark:text-gray-300">Links:</span>{st.links.map((l, i) => <a key={i} href={l} target="_blank" rel="noreferrer" className="block text-teal-600 dark:text-[#0d9488] underline break-all mt-0.5">{l}</a>)}</div>)}
                                {st.attachments?.length > 0 && (<div><span className="font-medium text-gray-700 dark:text-gray-300">Attachments:</span>{st.attachments.map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block text-teal-600 dark:text-[#0d9488] underline break-all mt-0.5">{a.name || 'file'}</a>)}</div>)}
                                {st.feedback && <div className="break-words text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Confirm feedback: </span>{st.feedback}</div>}
                                {st.rejectedBy && <div className="break-words text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Rejected by: </span>{st.rejectedBy.name || 'Unknown'} on {fmtDateTime(st.rejectedAt)}</div>}
                                {st.rejectionReason && <div className="break-words text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Reason: </span>{st.rejectionReason}</div>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isGuest && feedbackData?.feedback?.length > 0 && (
                  <div className="xl:hidden">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Activity</h3>
                    <div className="space-y-2">
                      {feedbackData.feedback.map((f) => (
                        <div key={f._id} className="text-xs bg-white dark:bg-[#14141a] p-3 rounded-xl border border-gray-200 dark:border-gray-800/40">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{f.user?.name || 'Someone'}</span>
                          <span className="text-gray-500 dark:text-gray-500"> — {f.type?.replace('_', ' ')}</span>
                          <span className="text-gray-400"> · {fmtDateTime(f.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </main>

            {notePanelOpen ? (
              <LinkedNotePanel isOpen onClose={() => setOpenNoteLink(null)} link={openNoteLink} brandColor={brandColor} isMobile={false} />
            ) : (
              !isGuest && (
                <aside className="hidden xl:flex xl:flex-col xl:h-full xl:overflow-y-auto bg-white dark:bg-[#14141a] border-l border-gray-200/60 dark:border-gray-800/60">
                  <div className="p-5">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <FaCommentDots className="text-teal-600 dark:text-[#0d9488]" /> Activity
                    </h3>
                    {feedbackData?.feedback?.length > 0 ? (
                      <div className="space-y-2">
                        {feedbackData.feedback.map((f) => (
                          <div key={f._id} className="text-xs bg-gray-50 dark:bg-[#1a1a24] p-3 rounded-xl border border-gray-200 dark:border-gray-800/40">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold overflow-hidden shrink-0" style={{ backgroundColor: brandColor }}>
                                {f.user?.profile ? <img src={f.user.profile} className="w-full h-full object-cover" alt="" /> : (f.user?.name || '?').charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-gray-700 dark:text-gray-300 break-words">{f.user?.name || 'Someone'}</span>
                            </div>
                            <p className="text-gray-500 dark:text-gray-500 break-words">{f.type?.replace('_', ' ')}</p>
                            <p className="text-gray-400 dark:text-gray-600 text-[10px] mt-1">{fmtDateTime(f.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-10"><FaCommentDots className="text-2xl mx-auto text-gray-300 dark:text-gray-700 mb-2" /><p className="text-xs text-gray-500 dark:text-gray-500">No activity yet</p></div>
                    )}
                  </div>
                </aside>
              )
            )}
          </div>

          {isMobile && (
            <LinkedNotePanel isOpen={!!openNoteLink} onClose={() => setOpenNoteLink(null)} link={openNoteLink} brandColor={brandColor} isMobile />
          )}
        </div>

        {!isGuest && (showMarkCompleteBtn || showConfirmCompletionBtn) && (
          <div className="shrink-0 lg:hidden border-t border-gray-200/60 dark:border-gray-800/60 bg-white/95 dark:bg-[#14141a]/95 backdrop-blur-xl px-3 py-2.5 z-20">
            {showMarkCompleteBtn && (<button onClick={() => setShowMarkComplete(true)} className="w-full py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition" style={{ backgroundColor: brandColor }}><FaCheckDouble className="text-sm" />{taskCanManage ? 'Mark as Complete & Confirm' : 'Mark as Complete'}</button>)}
            {showConfirmCompletionBtn && (<button onClick={() => setShowConfirmCompletion(true)} className="w-full py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition" style={{ backgroundColor: brandColor }}><FaCheckCircle className="text-sm" />Confirm Completion</button>)}
          </div>
        )}

        {/* Modals — mounted for members only */}
        {!isGuest && (
          <>
            <TaskMenuModal isOpen={showMenu} onClose={() => setShowMenu(false)} task={task} canManage={taskCanManage} canAIEdit={canAIEdit} isReadOnly={isReadOnly} hasAssignees={hasAssignees} onEdit={() => setShowEdit(true)} onReminder={handleReminder} onAssign={() => setShowAssign(true)} onDelete={() => setDeleteConfirm(true)} onAIEdit={() => setShowAIEdit(true)} />
            <SubtaskActionModal isOpen={itemActionModal.isOpen} onClose={() => setItemActionModal({ isOpen: false, index: null })} item={currentItem} index={itemActionModal.index} canManage={taskCanManage} isReadOnly={isReadOnly} isAssignee={isAssignee} canSelectSubs={canSelectSubs} canEditThis={canReorderSub} canDeleteThis={itemActionModal.index != null && ((isAssignee && subTasks[itemActionModal.index]?.status !== 'confirmed') || taskCanManage) && canReorderSub} onEdit={(idx) => setSubTaskEditModal({ isOpen: true, index: idx })} onMarkDone={(idx) => setDoneModal({ isOpen: true, index: idx })} onConfirm={(idx) => setConfirmModal({ isOpen: true, index: idx })} onReject={(idx) => setRejectModal({ isOpen: true, index: idx })} onSelect={(idx) => startSubSelection(idx)} onDelete={(idx) => setDeleteSubModal({ isOpen: true, index: idx })} />
            <EditSubtaskModal isOpen={subTaskEditModal.isOpen} onClose={() => setSubTaskEditModal({ isOpen: false, index: null })} subtask={editingItem} brandColor={brandColor} onSubmit={submitEditSubTask} />
            {canManage && (<EditTaskModal isOpen={showEdit} onClose={() => setShowEdit(false)} task={task} workspaceId={workspaceId} brandColor={brandColor} assignableMembers={assignableMembers} folders={foldersData?.folders || []} onSuccess={refetchTask} />)}
            {taskCanManage && (<AssignTaskModal isOpen={showAssign} onClose={() => setShowAssign(false)} task={task} assignableMembers={assignableMembers} brandColor={brandColor} onAssign={handleAssign} />)}
            {showMarkCompleteBtn && (<MarkCompleteModal isOpen={showMarkComplete} onClose={() => setShowMarkComplete(false)} task={task} brandColor={brandColor} onSubmit={handleMarkComplete} />)}
            {showConfirmCompletionBtn && (<ConfirmCompletionModal isOpen={showConfirmCompletion} onClose={() => setShowConfirmCompletion(false)} task={task} brandColor={brandColor} onSubmit={handleConfirmCompletion} onReject={handleRejectTask} />)}
            {taskCanManage && (<ConfirmDialog isOpen={deleteConfirm} onClose={() => setDeleteConfirm(false)} onConfirm={handleDelete} title="Delete Task" message={`Delete "${task.title}"? This cannot be undone.`} danger confirmText="Delete" />)}
            {canAddItems && (<AddChecklistModal isOpen={addSubOpen} onClose={() => setAddSubOpen(false)} onSubmit={handleAddSubtask} />)}
            {!isReadOnly && (isAssignee || taskCanAct) && (<ChecklistDoneModal isOpen={doneModal.isOpen} onClose={() => setDoneModal({ isOpen: false, index: null })} canManage={taskCanManage} onSubmit={submitDone} />)}
            {taskCanManage && (<ChecklistConfirmModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false, index: null })} subTask={confirmModal.index != null ? subTasks[confirmModal.index] : null} onSubmit={submitConfirmSub} />)}
            {taskCanManage && (<ReasonModal isOpen={rejectModal.isOpen} onClose={() => setRejectModal({ isOpen: false, index: null })} onSubmit={submitRejectSub} title="Reject Item" />)}
            <ConfirmDialog isOpen={deleteSubModal.isOpen} onClose={() => setDeleteSubModal({ isOpen: false, index: null })} onConfirm={confirmDeleteSub} title="Delete Item" message="This cannot be undone." danger confirmText="Delete" />
            {canAIEdit && (<AIEditTaskModal isOpen={showAIEdit} onClose={() => setShowAIEdit(false)} task={task} brandColor={brandColor} onApplied={refetchTask} />)}
          </>
        )}

        {/* Guest prompt */}
        <GuestPromptModal
          isOpen={guestPrompt.isOpen}
          onClose={() => setGuestPrompt({ isOpen: false, actionLabel: null })}
          onSignup={() => { setGuestPrompt({ isOpen: false, actionLabel: null }); navigate('/signup'); }}
          onLogin={() => { setGuestPrompt({ isOpen: false, actionLabel: null }); navigate('/login'); }}
          actionLabel={guestPrompt.actionLabel}
        />
      </div>
    </>
  );
};

export default YourWorkspaceTaskId;
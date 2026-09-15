import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FaArrowLeft, FaSearch, FaPlus, FaEllipsisV, FaFolder, FaFolderOpen,
  FaEdit, FaUserLock, FaTrashAlt, FaTasks, FaTimes, FaGripVertical,
  FaRedo, FaClock, FaUsers, FaArchive, FaUndo, FaTrashRestore,
  FaExclamationTriangle, FaCheck, FaAngleDown, FaUser, FaFlag, FaFire,
  FaCopy, FaCamera, FaLink, FaPaperclip, FaChevronRight,
  FaMagic, FaRobot, FaFileAlt, FaHeartbeat, FaLightbulb, FaDownload,
  FaExclamationCircle, FaCheckCircle, FaSpinner,
} from 'react-icons/fa';
import { jsPDF } from 'jspdf';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import {
  useGetProjectByIdQuery,
  useArchiveProjectMutation,
  useUnarchiveProjectMutation,
  useDeleteProjectMutation,
  useRestoreProjectMutation,
  usePermanentlyDeleteProjectMutation,
} from '../slices/projectApiSlice';
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
} from '../slices/taskApiSlice';
import {
  usePlanWithAIMutation,
  useExecuteAIPlanMutation,
  useReviewProjectMutation,
  useSummarizeProjectMutation,
  useGenerateProjectDocsMutation,
} from '../slices/aiApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
import { useMediaPicker } from '../hooks/useMediaPicker';

// ─── format helpers ─────────────────────────────────────────────
const fmtDate = (d) => (!d ? 'N/A' : new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
const fmtDateTime = (d) => (!d ? 'No due' : new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));

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
const StatusPill = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  return <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${s.c}`}>{s.label}</span>;
};
const PriorityPill = ({ priority }) => {
  const p = PRIORITY_MAP[priority] || PRIORITY_MAP.medium;
  return <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${p.c}`}>{p.label}</span>;
};

const priorityOptions = [
  { value: 'low', label: 'Low', icon: <FaFlag className="text-blue-400" /> },
  { value: 'medium', label: 'Medium', icon: <FaFlag className="text-yellow-400" /> },
  { value: 'high', label: 'High', icon: <FaFire className="text-red-400" /> },
  { value: 'urgent', label: 'Urgent', icon: <FaFire className="text-red-500" /> },
];

// ─── tiny dropdowns ─────────────────────────────────────────────
const Dropdown = ({ label, options, value, onChange, placeholder, brandColor }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const sel = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      {label && <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>}
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-300">
        {sel?.icon && <span className="text-xs">{sel.icon}</span>}
        <span className="truncate flex-1 text-left">{sel ? sel.label : placeholder}</span>
        <FaAngleDown className={`text-[10px] text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-50 max-h-48 overflow-y-auto">
          {options.map((o) => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${o.value === value ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'}`}>
              {o.icon && <span className="text-xs">{o.icon}</span>}
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const MultiDropdown = ({ label, options, values = [], onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const sel = options.filter((o) => values.includes(o.value));
  const text = sel.length === 0 ? placeholder : sel.length === 1 ? sel[0].label : `${sel.length} selected`;
  const toggle = (v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <div ref={ref} className="relative">
      {label && <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>}
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-300">
        <span className="truncate flex-1 text-left">{text}</span>
        <FaAngleDown className={`text-[10px] text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-50 max-h-56 overflow-y-auto">
          {options.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">No members available</div>}
          {options.map((o) => {
            const checked = values.includes(o.value);
            return (
              <button key={o.value} type="button" onClick={() => toggle(o.value)} className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${checked ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'}`}>
                <span className={`w-3.5 h-3.5 flex items-center justify-center border rounded ${checked ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-400 dark:border-gray-600'}`}>
                  {checked && <FaCheck className="text-[8px]" />}
                </span>
                {o.icon}
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
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

// ─── Task Card ──────────────────────────────────────────────────
const TaskCard = ({ task, onClick, brandColor, draggable, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, dragOver, onCopy, onMove }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const progress = task.progress || 0;
  const subCount = task.subTasks?.length || 0;
  const confirmed = (task.subTasks || []).filter((s) => s.status === 'confirmed').length;
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due && due < new Date() && !['completed', 'confirmed_completed', 'cancelled'].includes(task.status);
  const assignees = task.assignees || [];
  const hasRecurrence = task.recurrenceType && task.recurrenceType !== 'none';

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => { if (!draggable) { e.preventDefault(); return; } e.dataTransfer.setData('text/plain', task._id); onDragStart(e, task); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e, task); }}
      onDrop={(e) => { e.preventDefault(); onDrop(e, task); }}
      onDragLeave={onDragLeave}
      onClick={onClick}
      className={`group bg-white dark:bg-[#14141a] rounded-2xl border p-4 cursor-pointer transition-all ${dragOver ? 'border-teal-500 dark:border-[#0d9488] bg-teal-50/50 dark:bg-[#0d9488]/5' : 'border-gray-200/60 dark:border-gray-800/40 hover:border-teal-500/60 dark:hover:border-[#0d9488]/50'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {draggable && <FaGripVertical className="text-gray-300 dark:text-gray-700 text-xs shrink-0" />}
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: brandColor }}>
            {task.title.charAt(0).toUpperCase()}
          </div>
          <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[140px] md:max-w-[220px]">{task.title}</h4>
          {hasRecurrence && <FaRedo className="text-[10px] text-teal-600 dark:text-[#0d9488] shrink-0" />}
        </div>
        <div className="flex items-center gap-1 shrink-0 relative" ref={menuRef}>
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50">
            <FaEllipsisV className="text-sm" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-30 min-w-[110px]">
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onCopy(task); }} className="flex items-center gap-2 px-3 py-1.5 w-full text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 whitespace-nowrap"><FaCopy className="text-xs" /> Copy</button>
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onMove(task); }} className="flex items-center gap-2 px-3 py-1.5 w-full text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 whitespace-nowrap"><FaFolderOpen className="text-xs" /> Move</button>
            </div>
          )}
          <StatusPill status={task.status} />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <PriorityPill priority={task.priority} />
        {subCount > 0 && <span className="text-[10px] text-gray-500">• {confirmed}/{subCount} done</span>}
        {overdue && <span className="text-[10px] text-red-500 flex items-center gap-1"><FaClock className="text-[8px]" /> Overdue</span>}
        {task.folder?.name && <span className="text-[10px] text-gray-500 flex items-center gap-1"><FaFolder className="text-[8px]" /> {task.folder.name}</span>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {assignees.length === 0 ? (
            <span className="text-xs text-gray-500">Unassigned</span>
          ) : (
            <>
              <div className="flex -space-x-1.5 shrink-0">
                {assignees.slice(0, 3).map((a, i) => (
                  <div key={a._id || i} className="w-5 h-5 rounded-full border border-white dark:border-[#14141a] flex items-center justify-center text-white text-[9px] font-semibold overflow-hidden" style={{ backgroundColor: brandColor }}>
                    {a.profile ? <img src={a.profile} className="w-full h-full object-cover" alt="" /> : (a.name || '?').charAt(0).toUpperCase()}
                  </div>
                ))}
                {assignees.length > 3 && <div className="w-5 h-5 rounded-full border border-white dark:border-[#14141a] flex items-center justify-center bg-gray-500 text-white text-[8px]">+{assignees.length - 3}</div>}
              </div>
              <span className="text-xs text-gray-500 truncate">{assignees.length === 1 ? assignees[0].name : `${assignees.length} assignees`}</span>
            </>
          )}
        </div>
        <span className="text-xs text-gray-500 shrink-0">{fmtDateTime(task.dueDate)}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800/60 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: brandColor }} />
        </div>
        <span className="text-xs font-mono text-gray-400">{progress}%</span>
      </div>
    </div>
  );
};

// ─── Create Task Modal ──────────────────────────────────────────
const CreateTaskModal = ({ isOpen, onClose, projectId, brandColor, assignableMembers, folders, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [priority, setPriority] = useState('medium');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [bufferTime, setBufferTime] = useState(0);
  const [allowAssigneeEditSubtasks, setAllowAssigneeEditSubtasks] = useState(false);
  const [linksText, setLinksText] = useState('');
  const { files, pickMedia, setFiles } = useMediaPicker();
  const [folderId, setFolderId] = useState('');
  const [recurrenceType, setRecurrenceType] = useState('none');
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    if (startDate && dueDate) {
      const s = new Date(startDate), d = new Date(dueDate);
      setEstimatedHours(s < d ? ((d - s) / 3600000).toFixed(1) : '0');
    } else setEstimatedHours('');
  }, [startDate, dueDate]);

  const setQuickDue = (preset) => {
    const now = new Date();
    let t = new Date(now);
    if (preset === '1h') t.setHours(now.getHours() + 1);
    else if (preset === '12h') t.setHours(now.getHours() + 12);
    else if (preset === 'today') t.setHours(23, 59, 59);
    else if (preset === '2d') t.setDate(now.getDate() + 2);
    else if (preset === '1w') t.setDate(now.getDate() + 7);
    else if (preset === '2w') t.setDate(now.getDate() + 14);
    else if (preset === '1m') t.setMonth(now.getMonth() + 1);
    const p = (n) => String(n).padStart(2, '0');
    setDueDate(`${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`);
  };

  const assigneeOpts = assignableMembers.map((m) => {
    const u = m.user || m;
    return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full object-cover" alt="" /> : <FaUser className="text-gray-400" /> };
  });
  const folderOpts = [{ value: '', label: 'No Folder', icon: <FaFolderOpen className="text-gray-400" /> }, ...folders.map((f) => ({ value: f._id, label: f.name, icon: <FaFolder className="text-gray-400" /> }))];

  const reset = () => {
    setTitle(''); setDescription(''); setAssigneeIds([]); setPriority('medium'); setStartDate(''); setDueDate('');
    setEstimatedHours(''); setBufferTime(0); setAllowAssigneeEditSubtasks(false); setLinksText(''); setFiles([]);
    setFolderId(''); setRecurrenceType('none'); setRecurrenceDays([]); setRecurrenceEndDate(''); setShowDetails(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title required'); return; }
    setLoading(true);
    try {
      await onSubmit({
        projectId, title: title.trim(), description, assigneeIds, priority,
        estimatedHours, bufferTime, allowAssigneeEditSubtasks, startDate, dueDate,
        folderId, recurrenceType, recurrenceDays, recurrenceEndDate,
        links: linksText.split('\n').map((l) => l.trim()).filter(Boolean), attachments: files,
      });
      reset();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create task');
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;
  return (
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
          <button type="button" onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-2 text-sm text-teal-600 dark:text-[#0d9488]">
            <FaAngleDown className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} /> {showDetails ? 'Hide details' : 'Add more details'}
          </button>
          {showDetails && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
              </div>
              <MultiDropdown label="Assignees" options={assigneeOpts} values={assigneeIds} onChange={setAssigneeIds} placeholder="Select members..." />
              <Dropdown label="Folder" options={folderOpts} value={folderId} onChange={setFolderId} placeholder="Select folder" />
              <div className="grid grid-cols-2 gap-3">
                <Dropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} />
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start</label>
                  <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Due</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[['1h', 'in an hour'], ['12h', 'in 12 hours'], ['today', 'today'], ['2d', 'in 2 days'], ['1w', 'in a week'], ['2w', 'in 2 weeks'], ['1m', 'in a month']].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setQuickDue(k)} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">{l}</button>
                  ))}
                </div>
                <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Est. hours</label>
                  <input type="number" step="0.5" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} readOnly={!!(startDate && dueDate)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buffer (min)</label>
                  <input type="number" min="0" value={bufferTime} onChange={(e) => setBufferTime(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <input type="checkbox" checked={allowAssigneeEditSubtasks} onChange={(e) => setAllowAssigneeEditSubtasks(e.target.checked)} className="accent-teal-600" /> Allow assignee to edit sub‑tasks
              </label>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recurrence</label>
                <select value={recurrenceType} onChange={(e) => { setRecurrenceType(e.target.value); if (e.target.value !== 'weekly') setRecurrenceDays([]); }} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none">
                  <option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
                </select>
              </div>
              {recurrenceType === 'weekly' && (
                <div className="flex flex-wrap gap-2">
                  {weekDays.map((d, i) => (
                    <button key={i} type="button" onClick={() => setRecurrenceDays(recurrenceDays.includes(i) ? recurrenceDays.filter((x) => x !== i) : [...recurrenceDays, i].sort())} className={`px-3 py-1 rounded-full text-xs font-medium ${recurrenceDays.includes(i) ? 'bg-teal-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>{d}</button>
                  ))}
                </div>
              )}
              {recurrenceType !== 'none' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recurrence end (optional)</label>
                  <input type="datetime-local" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaLink className="inline mr-1" />Links (one per line)</label>
                <textarea value={linksText} onChange={(e) => setLinksText(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
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
            </>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium" style={{ backgroundColor: brandColor }}>{loading ? 'Creating...' : 'Create Task'}</button>
          </div>
        </form>
      </div>
    </div>
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
// Professional PDF generator — Times, 12pt, justified body.
// ══════════════════════════════════════════════════════════════
const downloadDocsPDF = (doc) => {
  if (!doc) return;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  // Page geometry (A4 = 595.28 × 841.89 pt)
  const PAGE_W = pdf.internal.pageSize.getWidth();
  const PAGE_H = pdf.internal.pageSize.getHeight();
  const MARGIN_X = 60;
  const MARGIN_TOP = 72;
  const MARGIN_BOTTOM = 72;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  // Type scale — Times, body locked at 12pt, 1.5 line height
  const BODY_SIZE = 12;
  const BODY_LINE_H = 18;
  const TITLE_SIZE = 26;
  const SUB_SIZE = 13;
  const H1_SIZE = 16;
  const TABLE_SIZE = 10;
  const TABLE_LINE_H = 13;
  const FOOTER_SIZE = 10;

  const ACCENT = [13, 148, 136];
  const TEXT_DARK = [17, 17, 17];
  const TEXT_MUTED = [110, 110, 110];

  let y = MARGIN_TOP;
  let pageNum = 0;
  let onCover = true;

  const setFont = (style = 'normal', size = BODY_SIZE, color = TEXT_DARK) => {
    pdf.setFont('times', style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
  };

  // Manual justification — split into words, distribute extra space
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
    pdf.setDrawColor(...ACCENT);
    pdf.setLineWidth(0.8);
    pdf.line(PAGE_W / 2 - 8, PAGE_H - 50, PAGE_W / 2 + 8, PAGE_H - 50);
  };

  const newPage = () => {
    drawFooter();
    pdf.addPage();
    pageNum += 1;
    onCover = false;
    y = MARGIN_TOP;
  };

  const ensure = (h) => { if (y + h > PAGE_H - MARGIN_BOTTOM) newPage(); };

  const writeParagraph = (text, opts = {}) => {
    const {
      size = BODY_SIZE, style = 'normal', color = TEXT_DARK,
      align = 'left', lineH = size * 1.5, gap = 10, indent = 0,
    } = opts;
    setFont(style, size, color);
    const usableW = CONTENT_W - indent;
    const lines = pdf.splitTextToSize(String(text ?? ''), usableW);
    if (!lines.length) { y += gap; return; }
    for (let i = 0; i < lines.length; i++) {
      ensure(lineH);
      const line = lines[i];
      const isLast = i === lines.length - 1;
      const trimmed = line.trim();
      if (align === 'justify' && !isLast && trimmed.includes(' ')) {
        justifyLine(line, MARGIN_X + indent, y, usableW);
      } else if (align === 'center') {
        pdf.text(line, MARGIN_X + CONTENT_W / 2, y, { align: 'center' });
      } else if (align === 'right') {
        pdf.text(line, MARGIN_X + CONTENT_W, y, { align: 'right' });
      } else {
        pdf.text(line, MARGIN_X + indent, y);
      }
      y += lineH;
    }
    y += gap;
  };

  const writeHeading = (text, level = 1) => {
    const size = level === 1 ? H1_SIZE : size;
    const lineH = size * 1.35;
    setFont('bold', size, TEXT_DARK);
    const lines = pdf.splitTextToSize(String(text ?? ''), CONTENT_W);
    lines.forEach((ln) => {
      ensure(lineH + 10);
      pdf.text(ln, MARGIN_X, y);
      y += lineH;
    });
    y += 2;
    pdf.setDrawColor(...ACCENT);
    pdf.setLineWidth(level === 1 ? 1.2 : 0.8);
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
    const padX = 8;
    const padY = 7;
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
      const cellLines = cells.map((c) =>
        pdf.splitTextToSize(String(c ?? '').replace(/\s*\n\s*/g, ' '), colW - padX * 2)
      );
      const maxLines = Math.max(1, ...cellLines.map((l) => l.length));
      const rowH = maxLines * TABLE_LINE_H + padY * 2;

      if (y + rowH > PAGE_H - MARGIN_BOTTOM) {
        newPage();
        drawHeader();
      }

      if (rowIdx % 2 === 1) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(MARGIN_X, y, CONTENT_W, rowH, 'F');
      }

      setFont('normal', TABLE_SIZE, TEXT_DARK);
      cellLines.forEach((lines, i) => {
        let cy = y + padY + TABLE_SIZE;
        lines.forEach((ln) => { pdf.text(ln, MARGIN_X + i * colW + padX, cy); cy += TABLE_LINE_H; });
      });

      pdf.setDrawColor(225, 228, 232);
      pdf.setLineWidth(0.5);
      pdf.line(MARGIN_X, y + rowH, MARGIN_X + CONTENT_W, y + rowH);

      y += rowH;
    });

    y += 12;
  };

  // ── Cover page ──
  pdf.setFillColor(238, 243, 245);
  pdf.rect(0, 0, PAGE_W, 8, 'F');
  pdf.setFillColor(...ACCENT);
  pdf.rect(0, 0, 170, 8, 'F');

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
  pdf.setDrawColor(...ACCENT);
  pdf.setLineWidth(3);
  pdf.line(MARGIN_X, ty, MARGIN_X + 90, ty);

  const metaY = PAGE_H - 200;
  setFont('normal', 10, TEXT_MUTED);
  pdf.text('PROJECT', MARGIN_X, metaY);
  setFont('bold', 13, TEXT_DARK);
  pdf.text(doc.meta?.projectName || '—', MARGIN_X, metaY + 20);

  setFont('normal', 10, TEXT_MUTED);
  pdf.text('VERSION', MARGIN_X, metaY + 52);
  setFont('bold', 13, TEXT_DARK);
  pdf.text(doc.meta?.version || '1.0', MARGIN_X, metaY + 72);

  setFont('normal', 10, TEXT_MUTED);
  pdf.text('GENERATED', MARGIN_X, metaY + 104);
  setFont('bold', 13, TEXT_DARK);
  pdf.text(
    new Date(doc.meta?.generatedAt || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    MARGIN_X, metaY + 124
  );

  if (doc.meta?.generatedBy) {
    setFont('normal', 10, TEXT_MUTED);
    pdf.text('BY', MARGIN_X, metaY + 156);
    setFont('bold', 13, TEXT_DARK);
    pdf.text(doc.meta.generatedBy, MARGIN_X, metaY + 176);
  }

  // ── Body ──
  newPage();

  (doc.sections || []).forEach((section, sIdx) => {
    if (sIdx > 0) y += 8;
    ensure(34);
    writeHeading(section.heading, 1);

    (section.paragraphs || []).forEach((p) => {
      writeParagraph(p, { size: BODY_SIZE, style: 'normal', align: 'justify', lineH: BODY_LINE_H, gap: 10 });
    });

    if (section.bullets?.length) writeBullets(section.bullets);
    if (section.table?.headers?.length && section.table?.rows?.length) {
      writeTable(section.table.headers, section.table.rows);
    }
  });

  drawFooter();

  const safeName = (doc.meta?.projectName || 'project').replace(/[^\w\-]+/g, '_');
  pdf.save(`${safeName}_docs.pdf`);
};

// ══════════════════════════════════════════════════════════════
// AI — Menu, Plan editor, Review, Summary, Docs
// ══════════════════════════════════════════════════════════════
const AIMenu = ({ isOpen, onClose, canManage, brandColor, onPlan, onSummary, onReview, onDocs }) => {
  if (!isOpen) return null;
  const Item = ({ icon, label, sub, onClick, disabled }) => (
    <button
      onClick={() => { if (!disabled) { onClick(); onClose(); } }}
      disabled={disabled}
      className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800/40'}`}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: brandColor }}>
        {icon}
      </div>
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
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <FaMagic className="text-teal-600 dark:text-[#0d9488]" /> AI Assistant
            </h3>
            <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
          </div>
          <div className="space-y-1">
            <Item icon={<FaRobot className="text-sm" />} label="Plan a new project" sub="Describe it in plain English — get a full plan" onClick={onPlan} disabled={!canManage} />
            <Item icon={<FaLightbulb className="text-sm" />} label="Summarize this project" sub="Headline, highlights, risks, next steps" onClick={onSummary} />
            <Item icon={<FaHeartbeat className="text-sm" />} label="Review this project" sub="Audit workload, deadlines, and blockers" onClick={onReview} disabled={!canManage} />
            <Item icon={<FaFileAlt className="text-sm" />} label="Generate documentation" sub="Formal project doc, downloadable as PDF" onClick={onDocs} />
          </div>
        </div>
      </div>
    </div>
  );
};

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
    try {
      const res = await planWithAI({ workspaceId, prompt: prompt.trim() }).unwrap();
      setPlan(res.plan); setStage('edit');
    } catch (err) { toast.error(err?.data?.message || 'Failed to generate plan'); }
    finally { setBusy(false); }
  };

  const handleExecute = async () => {
    if (!plan) return;
    if (!plan.project.name?.trim()) return toast.error('Project name required');
    if (!plan.tasks?.length) return toast.error('Add at least one task');
    setBusy(true);
    try {
      const cleanPlan = {
        project: {
          name: plan.project.name.trim(),
          description: plan.project.description || '',
          detailedDescription: plan.project.detailedDescription || '',
          priority: plan.project.priority,
          projectType: plan.project.projectType,
          tags: plan.project.tags || [],
          teamMemberIds: plan.project.teamMemberIds || [],
        },
        tasks: plan.tasks.map((t) => ({
          title: t.title.trim(),
          description: t.description || '',
          priority: t.priority,
          assigneeIds: t.assigneeIds || [],
          dueDateOffsetDays: Number.isFinite(t.dueDateOffsetDays) ? t.dueDateOffsetDays : null,
          subtasks: (t.subtasks || []).map((s) => ({
            title: s.title.trim(),
            description: s.description || '',
            dueDateOffsetDays: Number.isFinite(s.dueDateOffsetDays) ? s.dueDateOffsetDays : null,
          })),
        })),
      };
      const res = await executeAIPlan({ workspaceId, plan: cleanPlan }).unwrap();
      toast.success(`Created ${res.taskCount} tasks`);
      onExecuted?.(res.project);
      onClose();
    } catch (err) { toast.error(err?.data?.message || 'Failed to create project'); }
    finally { setBusy(false); }
  };

  const updateProject = (patch) => setPlan((p) => ({ ...p, project: { ...p.project, ...patch } }));
  const updateTask = (i, patch) => setPlan((p) => { const tasks = [...p.tasks]; tasks[i] = { ...tasks[i], ...patch }; return { ...p, tasks }; });
  const removeTask = (i) => setPlan((p) => ({ ...p, tasks: p.tasks.filter((_, k) => k !== i) }));
  const addTask = () => setPlan((p) => ({ ...p, tasks: [...p.tasks, { title: 'New task', description: '', priority: 'medium', assigneeIds: [], dueDateOffsetDays: 7, subtasks: [] }] }));
  const toggleAssignee = (i, uid) => {
    const t = plan.tasks[i];
    const has = t.assigneeIds.includes(uid);
    updateTask(i, { assigneeIds: has ? t.assigneeIds.filter((x) => x !== uid) : [...t.assigneeIds, uid] });
  };
  const toggleTeamMember = (uid) => {
    const has = (plan.project.teamMemberIds || []).includes(uid);
    updateProject({ teamMemberIds: has ? plan.project.teamMemberIds.filter((x) => x !== uid) : [...(plan.project.teamMemberIds || []), uid] });
  };
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
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <FaMagic className="text-teal-600 dark:text-[#0d9488]" />
              {stage === 'prompt' ? 'Plan with AI' : 'Review AI Plan'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
              {stage === 'prompt' ? 'Describe your project — the AI will draft the plan' : `Edit anything · ${plan?.tasks?.length || 0} tasks · ${totalSubtasks} subtasks`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {stage === 'prompt' && (
            <div className="space-y-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                placeholder="e.g. Plan a 3-week launch for our new mobile app. We have Sarah (designer), Marcus (backend), and Priya (marketer). Include QA and a soft-launch milestone."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-2xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 dark:focus:border-[#0d9488] resize-none"
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-500">Tip: mention who's on the team and any deadlines or phases.</p>
            </div>
          )}

          {stage === 'edit' && plan && (
            <div className="space-y-5">
              {plan.warnings?.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3 flex gap-2">
                  <FaExclamationTriangle className="text-amber-600 dark:text-amber-400 text-sm mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
                    {plan.warnings.map((w, i) => <div key={i}>{w}</div>)}
                  </div>
                </div>
              )}

              <section>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Project</h3>
                <div className="space-y-2">
                  <input value={plan.project.name} onChange={(e) => updateProject({ name: e.target.value })} placeholder="Project name"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-100 outline-none focus:border-teal-500 dark:focus:border-[#0d9488]" />
                  <input value={plan.project.description || ''} onChange={(e) => updateProject({ description: e.target.value })} placeholder="Short description"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 dark:focus:border-[#0d9488]" />
                  <textarea value={plan.project.detailedDescription || ''} onChange={(e) => updateProject({ detailedDescription: e.target.value })} rows={3} placeholder="Detailed description"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 dark:focus:border-[#0d9488] resize-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={plan.project.priority} onChange={(e) => updateProject({ priority: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none">
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select value={plan.project.projectType} onChange={(e) => updateProject({ projectType: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none">
                      {PROJECT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-500 mb-1.5">Team members</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(workspaceMembers || []).map((u) => {
                        const selected = (plan.project.teamMemberIds || []).includes(u._id);
                        return (
                          <button key={u._id} type="button" onClick={() => toggleTeamMember(u._id)}
                            className={`flex items-center gap-1.5 text-[11px] pl-0.5 pr-2.5 py-0.5 rounded-full border transition ${selected
                              ? 'bg-teal-50 dark:bg-[#0d9488]/15 border-teal-500/50 dark:border-[#0d9488]/50 text-teal-700 dark:text-[#14b8a6]'
                              : 'bg-gray-50 dark:bg-[#1a1a24] border-gray-200 dark:border-gray-800/40 text-gray-600 dark:text-gray-400 hover:border-gray-300'}`}>
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold overflow-hidden shrink-0" style={{ backgroundColor: brandColor }}>
                              {u.profile ? <img src={u.profile} alt="" className="w-full h-full object-cover" /> : (u.name || '?').charAt(0).toUpperCase()}
                            </span>
                            {u.name || 'Unknown'}
                            {selected && <FaCheck className="text-[8px]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">Tasks ({plan.tasks.length})</h3>
                  <button onClick={addTask} className="text-xs text-teal-600 dark:text-[#0d9488] font-medium flex items-center gap-1 hover:underline">
                    <FaPlus className="text-[10px]" /> Add task
                  </button>
                </div>
                <div className="space-y-2">
                  {plan.tasks.map((t, idx) => {
                    const expanded = expandedTask === idx;
                    return (
                      <div key={idx} className="bg-gray-50 dark:bg-[#1a1a24] rounded-xl border border-gray-200/60 dark:border-gray-800/40 overflow-hidden">
                        <div className="flex items-start gap-2 p-3">
                          <div className="flex-1 min-w-0 space-y-2">
                            <input value={t.title} onChange={(e) => updateTask(idx, { title: e.target.value })}
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-100 outline-none focus:border-teal-500 dark:focus:border-[#0d9488]" />
                            <div className="flex flex-wrap gap-1.5">
                              <select value={t.priority} onChange={(e) => updateTask(idx, { priority: e.target.value })}
                                className="px-2 py-1 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-md text-[11px] text-gray-700 dark:text-gray-300 outline-none">
                                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                              </select>
                              <input type="number" min={0} value={t.dueDateOffsetDays ?? ''}
                                onChange={(e) => updateTask(idx, { dueDateOffsetDays: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                                placeholder="due in N days"
                                className="w-32 px-2 py-1 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-md text-[11px] text-gray-700 dark:text-gray-300 outline-none" />
                              <span className="px-2 py-1 text-[11px] text-gray-500 dark:text-gray-500">{(t.subtasks || []).length} subtask{(t.subtasks || []).length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(workspaceMembers || []).map((u) => {
                                const sel = (t.assigneeIds || []).includes(u._id);
                                return (
                                  <button key={u._id} type="button" onClick={() => toggleAssignee(idx, u._id)} title={u.name}
                                    className={`flex items-center gap-1 text-[10px] pl-0.5 pr-1.5 py-0.5 rounded-full border transition ${sel
                                      ? 'bg-teal-50 dark:bg-[#0d9488]/15 border-teal-500/50 text-teal-700 dark:text-[#14b8a6]'
                                      : 'bg-white dark:bg-[#0f0f12] border-gray-200 dark:border-gray-800/40 text-gray-500 dark:text-gray-500 hover:border-gray-300'}`}>
                                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold overflow-hidden" style={{ backgroundColor: brandColor }}>
                                      {u.profile ? <img src={u.profile} alt="" className="w-full h-full object-cover" /> : (u.name || '?').charAt(0).toUpperCase()}
                                    </span>
                                    {(u.name || '').split(' ')[0] || 'Unknown'}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            <button onClick={() => setExpandedTask(expanded ? null : idx)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded" title={expanded ? 'Collapse' : 'Expand'}>
                              <FaAngleDown className={`text-xs transition-transform ${expanded ? 'rotate-180' : ''}`} />
                            </button>
                            <button onClick={() => removeTask(idx)} className="p-1 text-gray-400 hover:text-red-500 rounded" title="Remove task">
                              <FaTrashAlt className="text-xs" />
                            </button>
                          </div>
                        </div>
                        {expanded && (
                          <div className="px-3 pb-3 space-y-3 border-t border-gray-200/60 dark:border-gray-800/40 pt-3">
                            <textarea value={t.description || ''} onChange={(e) => updateTask(idx, { description: e.target.value })} rows={2} placeholder="Task description"
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none resize-none" />
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-500">Subtasks ({(t.subtasks || []).length})</span>
                              <button onClick={() => addSubtask(idx)} className="text-[11px] text-teal-600 dark:text-[#0d9488] font-medium flex items-center gap-1 hover:underline">
                                <FaPlus className="text-[9px]" /> Add
                              </button>
                            </div>
                            <div className="space-y-1.5">
                              {(t.subtasks || []).map((s, sidx) => (
                                <div key={sidx} className="flex items-start gap-2">
                                  <input value={s.title} onChange={(e) => updateSubtask(idx, sidx, { title: e.target.value })}
                                    className="flex-1 px-2.5 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none" />
                                  <input type="number" min={0} value={s.dueDateOffsetDays ?? ''}
                                    onChange={(e) => updateSubtask(idx, sidx, { dueDateOffsetDays: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                                    placeholder="N"
                                    className="w-14 px-2 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none" />
                                  <button onClick={() => removeSubtask(idx, sidx)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                                    <FaTrashAlt className="text-[11px]" />
                                  </button>
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
              <button onClick={handleGenerate} disabled={busy || !prompt.trim()}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: brandColor }}>
                {busy ? <><FaSpinner className="animate-spin text-xs" /> Generating…</> : <><FaMagic className="text-xs" /> Generate plan</>}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStage('prompt')} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Back</button>
              <button onClick={handleExecute} disabled={busy}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: brandColor }}>
                {busy ? <><FaSpinner className="animate-spin text-xs" /> Creating…</> : <><FaCheck className="text-xs" /> Create project</>}
              </button>
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
    try {
      const res = await reviewProject({ projectId, focus: focus.trim() || undefined }).unwrap();
      setResult(res.review);
    } catch (err) { toast.error(err?.data?.message || 'Review failed'); }
    finally { setBusy(false); }
  };

  if (!isOpen) return null;
  const scoreColor = !result ? brandColor : result.healthScore >= 75 ? '#16a34a' : result.healthScore >= 50 ? '#eab308' : '#dc2626';
  const sevColor = { low: 'text-blue-600 dark:text-blue-400', medium: 'text-yellow-600 dark:text-yellow-400', high: 'text-orange-600 dark:text-orange-400', critical: 'text-red-600 dark:text-red-400' };

  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FaHeartbeat className="text-teal-600 dark:text-[#0d9488]" /> Project Review
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {!result && (
            <div className="space-y-3">
              <input value={focus} onChange={(e) => setFocus(e.target.value)}
                placeholder="Optional focus — e.g. 'deadlines' or 'team balance'"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 dark:focus:border-[#0d9488]" />
              <p className="text-[11px] text-gray-500 dark:text-gray-500">The AI audits workload, priorities, deadlines, and gaps.</p>
            </div>
          )}

          {result && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-2xl text-white shrink-0" style={{ backgroundColor: scoreColor }}>
                  {result.healthScore}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-500 uppercase font-semibold tracking-wide">Health Score</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 break-words">{result.overallAssessment}</p>
                </div>
              </div>

              {result.strengths?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Strengths</h4>
                  <div className="space-y-1.5">
                    {result.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <FaCheckCircle className="text-green-500 text-xs mt-1 shrink-0" />
                        <span className="break-words">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.issues?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Issues ({result.issues.length})</h4>
                  <div className="space-y-2">
                    {result.issues.map((it, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-[#1a1a24] rounded-xl p-3 border border-gray-200/60 dark:border-gray-800/40">
                        <div className="flex items-start gap-2">
                          <FaExclamationCircle className={`text-xs mt-1 shrink-0 ${sevColor[it.severity] || 'text-gray-400'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">
                              {it.title}
                              <span className={`ml-2 text-[10px] uppercase font-semibold ${sevColor[it.severity] || ''}`}>{it.severity}</span>
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">{it.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.recommendations?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Recommendations</h4>
                  <div className="space-y-2">
                    {result.recommendations.map((r, i) => (
                      <div key={i} className="bg-teal-50/60 dark:bg-[#0d9488]/10 rounded-xl p-3 border border-teal-200/60 dark:border-[#0d9488]/20">
                        <div className="flex items-start gap-2">
                          <FaLightbulb className="text-teal-600 dark:text-[#0d9488] text-xs mt-1 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">
                              {r.title}
                              <span className="ml-2 text-[10px] uppercase font-semibold text-teal-700 dark:text-[#0d9488]">{r.impact}</span>
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">{r.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
          {!result ? (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={run} disabled={busy}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: brandColor }}>
                {busy ? <><FaSpinner className="animate-spin text-xs" /> Analyzing…</> : <><FaHeartbeat className="text-xs" /> Run review</>}
              </button>
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
      summarizeProject({ projectId }).unwrap()
        .then((r) => setResult(r.summary))
        .catch((e) => toast.error(e?.data?.message || 'Summarize failed'))
        .finally(() => setBusy(false));
    }
  }, [isOpen]); // eslint-disable-line

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FaLightbulb className="text-teal-600 dark:text-[#0d9488]" /> Project Summary
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {busy && !result && (
            <div className="flex flex-col items-center justify-center py-16">
              <FaSpinner className="animate-spin text-2xl text-teal-600 dark:text-[#0d9488] mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-500">Thinking…</p>
            </div>
          )}
          {result && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 break-words">{result.headline}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 break-words leading-relaxed whitespace-pre-wrap">{result.summary}</p>
              </div>
              {result.currentState && (
                <div className="bg-gray-50 dark:bg-[#1a1a24] rounded-xl p-3 border border-gray-200/60 dark:border-gray-800/40">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-1">Current state</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{result.currentState}</p>
                </div>
              )}
              {result.highlights?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Highlights</h4>
                  <div className="space-y-1.5">
                    {result.highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <FaCheckCircle className="text-green-500 text-xs mt-1 shrink-0" />
                        <span className="break-words">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.risks?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Risks</h4>
                  <div className="space-y-1.5">
                    {result.risks.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <FaExclamationTriangle className="text-amber-500 text-xs mt-1 shrink-0" />
                        <span className="break-words">{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.nextSteps?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Next steps</h4>
                  <div className="space-y-1.5">
                    {result.nextSteps.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: brandColor }}>{i + 1}</span>
                        <span className="break-words">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
      generate({ projectId }).unwrap()
        .then((r) => setDoc(r.doc))
        .catch((e) => toast.error(e?.data?.message || 'Doc generation failed'))
        .finally(() => setBusy(false));
    }
  }, [isOpen]); // eslint-disable-line

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-3xl shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FaFileAlt className="text-teal-600 dark:text-[#0d9488]" /> Project Documentation
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {busy && !doc && (
            <div className="flex flex-col items-center justify-center py-16">
              <FaSpinner className="animate-spin text-2xl text-teal-600 dark:text-[#0d9488] mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-500">Writing documentation…</p>
            </div>
          )}
          {doc && (
            <article className="space-y-6">
              <header>
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 break-words">{doc.meta?.title}</h1>
                {doc.meta?.subtitle && <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 break-words">{doc.meta.subtitle}</p>}
                <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-2">
                  Version {doc.meta?.version || '1.0'} · Generated {new Date(doc.meta?.generatedAt || Date.now()).toLocaleString()}
                </p>
              </header>

              {(doc.sections || []).map((s, i) => (
                <section key={i} className="space-y-2">
                  <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200/60 dark:border-gray-800/40 pb-1">{s.heading}</h2>
                  {(s.paragraphs || []).map((p, j) => (
                    <p key={j} className="text-sm text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap leading-relaxed">{p}</p>
                  ))}
                  {(s.bullets || []).length > 0 && (
                    <ul className="list-disc pl-5 space-y-1">
                      {s.bullets.map((b, j) => <li key={j} className="text-sm text-gray-700 dark:text-gray-300 break-words">{b}</li>)}
                    </ul>
                  )}
                  {s.table?.headers?.length > 0 && s.table?.rows?.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-gray-200/60 dark:border-gray-800/40">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-[#1a1a24]">
                          <tr>
                            {s.table.headers.map((h, j) => (
                              <th key={j} className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/30">
                          {s.table.rows.map((row, j) => (
                            <tr key={j}>
                              {row.map((c, k) => <td key={k} className="px-3 py-2 text-gray-700 dark:text-gray-300 align-top">{c}</td>)}
                            </tr>
                          ))}
                        </tbody>
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
          <button onClick={() => doc && downloadDocsPDF(doc)} disabled={!doc || busy}
            className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
            style={{ backgroundColor: brandColor }}>
            <FaDownload className="text-xs" /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════
const YourWorkspaceProjectId = () => {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();

  const { data: wData, isLoading: wLoad, error: wErr } = useGetWorkspaceQuery(workspaceId);
  const { data: pData, isLoading: pLoad, error: pErr, refetch: refetchProject } = useGetProjectByIdQuery(projectId);
  const { data: foldersData, isLoading: foldersLoading, refetch: refetchFolders } = useGetProjectFoldersQuery(projectId);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const { data: tData, isLoading: tLoad, refetch: refetchTasks } = useGetProjectTasksQuery({ projectId, folderId: selectedFolderId || undefined });

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

  const [searchOpen, setSearchOpen] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
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

  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiPlanOpen, setAiPlanOpen] = useState(false);
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [aiDocsOpen, setAiDocsOpen] = useState(false);

  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);

  const workspace = wData?.workspace;
  const project = pData?.project;
  const brandColor = workspace?.color || '#0d9488';
  const canManage = !!project?.canManage;
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

  const refreshAll = useCallback(() => { refetchTasks(); refetchProject(); refetchFolders(); }, [refetchTasks, refetchProject, refetchFolders]);

  const handleCreateTask = useCallback(async (formData) => {
    const assigneeIds = formData.assigneeIds || [];
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      _id: tempId, title: formData.title, description: formData.description || '',
      priority: formData.priority || 'medium', status: assigneeIds.length > 0 ? 'ready_for_completion' : 'pending',
      progress: 0, assignees: assigneeIds.map((id) => ({ _id: id, name: 'Loading...' })),
      folder: formData.folderId ? { _id: formData.folderId, name: folders.find((f) => f._id === formData.folderId)?.name || 'Folder' } : null,
      dueDate: formData.dueDate || null, subTasks: [], recurrenceType: formData.recurrenceType || 'none',
    };
    setLocalTasks((prev) => [optimistic, ...prev]);

    const fd = new FormData();
    fd.append('projectId', formData.projectId);
    fd.append('title', formData.title);
    fd.append('description', formData.description);
    if (assigneeIds.length > 0) { fd.append('assigneeIds', JSON.stringify(assigneeIds)); fd.append('assigneeId', assigneeIds[0]); }
    fd.append('priority', formData.priority);
    fd.append('estimatedHours', formData.estimatedHours || '');
    fd.append('bufferTime', formData.bufferTime);
    fd.append('allowAssigneeEditSubtasks', formData.allowAssigneeEditSubtasks);
    if (formData.startDate) fd.append('startDate', formData.startDate);
    if (formData.dueDate) fd.append('dueDate', formData.dueDate);
    if (formData.folderId) fd.append('folderId', formData.folderId);
    fd.append('recurrenceType', formData.recurrenceType);
    if (formData.recurrenceType === 'weekly') fd.append('recurrenceDays', JSON.stringify(formData.recurrenceDays));
    if (formData.recurrenceEndDate) fd.append('recurrenceEndDate', formData.recurrenceEndDate);
    formData.links.forEach((l) => fd.append('links', l));
    formData.attachments.forEach((f) => fd.append('attachments', f));

    try {
      const result = await createTask(fd).unwrap();
      setLocalTasks((prev) => prev.map((t) => (t._id === tempId ? result.task : t)));
      refetchTasks(); refetchProject();
    } catch (err) {
      setLocalTasks((prev) => prev.filter((t) => t._id !== tempId));
      throw err;
    }
  }, [createTask, refetchTasks, refetchProject, folders]);

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
    setConfirmDialog({ isOpen: true, title: 'Move to Trash', message: `Move "${project?.name}" to trash? You can restore it within 30 days.`, onConfirm: async () => { try { await deleteProject(projectId).unwrap(); toast.success('Moved to trash'); navigate(`/workspace/${workspaceId}/projects`); } catch (e) { toast.error(e?.data?.message || 'Failed'); } } });
    setMenuOpen(false);
  };
  const handleRestore = () => {
    setConfirmDialog({ isOpen: true, title: 'Restore Project', message: `Restore "${project?.name}" from trash?`, onConfirm: async () => { try { await restoreProject(projectId).unwrap(); toast.success('Restored'); refetchProject(); } catch (e) { toast.error(e?.data?.message || 'Failed'); } } });
    setMenuOpen(false);
  };
  const handlePermanentDelete = () => {
    setConfirmDialog({ isOpen: true, title: 'Permanently Delete', danger: true, message: `Permanently delete "${project?.name}"? This cannot be undone.`, onConfirm: async () => { try { await permanentlyDeleteProject(projectId).unwrap(); toast.success('Deleted'); navigate(`/workspace/${workspaceId}/projects`); } catch (e) { toast.error(e?.data?.message || 'Failed'); } } });
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
        fd.append('estimatedHours', task.estimatedHours || '');
        fd.append('bufferTime', task.bufferTime || 0);
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

  useEffect(() => {
    if (wErr || pErr) navigate(`/workspace/${workspaceId}/projects`, { replace: true });
  }, [wErr, pErr, navigate, workspaceId]);

  if (wErr || pErr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (wLoad || pLoad || tLoad || foldersLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]"><div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: brandColor }} /></div>;
  }
  if (!workspace || !project) return null;

  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      <div className="hidden lg:block lg:w-64 lg:h-full shrink-0">
        <YourWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 shrink-0">
          <div className="flex items-center justify-between px-3 md:px-4 h-14 lg:h-16">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => navigate(`/workspace/${workspaceId}/projects`)} className="p-1 lg:hidden text-gray-500 dark:text-gray-400"><FaArrowLeft className="text-sm" /></button>
              {project.coverImage ? <img src={project.coverImage} className="w-8 h-8 md:w-10 md:h-10 rounded-xl object-cover" alt="" /> : (
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: brandColor }}><FaFolder /></div>
              )}
              <div className="min-w-0">
                <h1 className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[140px] md:max-w-xs flex items-center gap-1">
                  {project.name}
                  {isArchivedForMe && <span className="text-[10px] font-normal text-gray-400 bg-gray-100 dark:bg-gray-800/40 px-1.5 py-0.5 rounded-full">Archived</span>}
                  {isTrash && <span className="text-[10px] font-normal text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full">Trash</span>}
                </h1>
                <button onClick={() => navigate(`/workspace/${workspaceId}/project/${projectId}/team`)} className="flex items-center gap-1 text-[10px] md:text-xs text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-[#0d9488] transition">
                  <FaUsers className="text-[9px]" /> Team <FaChevronRight className="text-[8px]" />
                  <span className="w-0.5 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-full ml-1" /> {project.progress || 0}% done
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <button onClick={() => setSearchOpen(true)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl"><FaSearch className="text-xs md:text-sm" /></button>
              {!isTrash && !isArchivedForMe && (
                <button onClick={() => setAiMenuOpen(true)} className="p-1.5 text-teal-600 dark:text-[#0d9488] hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 rounded-xl" title="AI Assistant">
                  <FaMagic className="text-xs md:text-sm" />
                </button>
              )}
              {!isTrash && !isArchivedForMe && <button onClick={() => setShowCreateTask(true)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl"><FaPlus className="text-xs md:text-sm" /></button>}
              <button onClick={() => setMenuOpen(true)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl"><FaEllipsisV className="text-xs md:text-sm" /></button>
            </div>
          </div>
        </header>

        <div className="border-b border-gray-200/60 dark:border-gray-800/30 px-3 py-2 bg-gray-50 dark:bg-[#14141a]/60 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] md:text-xs font-medium text-gray-500 uppercase">Folders</span>
            {canManage && !isTrash && !isArchivedForMe && (
              <button onClick={() => { setEditingFolder(null); setShowFolderForm(true); }} className="text-[10px] md:text-xs text-teal-600 dark:text-[#0d9488] font-medium flex items-center gap-1"><FaPlus className="text-[8px]" /> New</button>
            )}
          </div>
          <div className="flex flex-nowrap overflow-x-auto gap-1.5 pb-1 scrollbar-hide">
            <button onClick={() => setSelectedFolderId(null)} className={`text-[10px] md:text-xs px-2 py-1 rounded-full border whitespace-nowrap ${!selectedFolderId ? 'bg-teal-600 dark:bg-[#0d9488] text-white border-teal-600' : 'bg-gray-100 dark:bg-[#1e1e26] border-gray-300 dark:border-gray-700/60 text-gray-700 dark:text-gray-300'}`}>All</button>
            {folders.map((f) => (
              <div key={f._id} className="relative flex items-center shrink-0">
                <button
                  onClick={() => setSelectedFolderId(selectedFolderId === f._id ? null : f._id)}
                  onTouchStart={() => handleTouchStart(f._id)} onTouchEnd={clearTouch} onTouchMove={clearTouch}
                  className={`text-[10px] md:text-xs px-2 py-1 rounded-full border flex items-center gap-1 whitespace-nowrap ${selectedFolderId === f._id ? 'bg-teal-600 dark:bg-[#0d9488] text-white border-teal-600' : 'bg-gray-100 dark:bg-[#1e1e26] border-gray-300 dark:border-gray-700/60 text-gray-700 dark:text-gray-300'}`}
                >
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

        <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-24 md:pb-4">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400"><FaTasks className="text-3xl md:text-4xl mb-2 opacity-30" /><p className="text-xs md:text-sm">No tasks {selectedFolderId ? 'in this folder' : 'yet'}</p></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {tasks.map((task) => (
                <TaskCard
                  key={task._id} task={task} brandColor={brandColor}
                  onClick={() => navigate(`/workspace/${workspaceId}/project/${projectId}/task/${task._id}`)}
                  draggable={canReorderTasks} onDragStart={onTaskDragStart} onDragEnd={onTaskDragEnd}
                  onDragOver={onTaskDragOver} onDragLeave={() => setDragOverTaskId(null)} onDrop={onTaskDrop}
                  dragOver={dragOverTaskId === task._id}
                  onCopy={(t) => setMoveCopy({ isOpen: true, task: t, mode: 'copy' })}
                  onMove={(t) => setMoveCopy({ isOpen: true, task: t, mode: 'move' })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <YourWorkspaceBottombar workspace={workspace} />

      {/* Modals */}
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} tasks={tasks} brandColor={brandColor} onSelect={(id) => navigate(`/workspace/${workspaceId}/project/${projectId}/task/${id}`)} />
      <CreateTaskModal isOpen={showCreateTask} onClose={() => setShowCreateTask(false)} projectId={projectId} brandColor={brandColor} assignableMembers={assignableMembers} folders={folders} onSubmit={handleCreateTask} />
      <FolderFormModal isOpen={showFolderForm} onClose={() => { setShowFolderForm(false); setEditingFolder(null); }} onSuccess={refetchFolders} folder={editingFolder} brandColor={brandColor} projectId={projectId} />
      <FolderReadOnlyModal isOpen={showReadOnly} onClose={() => { setShowReadOnly(false); setReadOnlyFolder(null); }} folder={readOnlyFolder} project={project} brandColor={brandColor} onSuccess={refetchFolders} />
      <FolderSelectModal isOpen={moveCopy.isOpen} onClose={() => setMoveCopy({ isOpen: false, task: null, mode: 'move' })} folders={folders} onSelect={handleMoveCopyConfirm} title={moveCopy.mode === 'copy' ? 'Copy task to folder' : 'Move task to folder'} />
      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog({ isOpen: false })} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} message={confirmDialog.message} danger={confirmDialog.danger} />
      <DeleteTaskDialog isOpen={deleteTaskDialog.isOpen} onClose={() => setDeleteTaskDialog({ isOpen: false })} onConfirm={deleteTaskDialog.onConfirm} taskName={deleteTaskDialog.taskName} />

      {/* AI */}
      <AIMenu
        isOpen={aiMenuOpen}
        onClose={() => setAiMenuOpen(false)}
        canManage={canManage}
        brandColor={brandColor}
        onPlan={() => setAiPlanOpen(true)}
        onSummary={() => setAiSummaryOpen(true)}
        onReview={() => setAiReviewOpen(true)}
        onDocs={() => setAiDocsOpen(true)}
      />
      <AIPlanModal
        isOpen={aiPlanOpen}
        onClose={() => setAiPlanOpen(false)}
        workspaceId={workspaceId}
        workspaceMembers={workspaceMembers}
        brandColor={brandColor}
        onExecuted={(proj) => { refreshAll(); if (proj?._id) navigate(`/workspace/${workspaceId}/project/${proj._id}`); }}
      />
      <AISummaryModal isOpen={aiSummaryOpen} onClose={() => setAiSummaryOpen(false)} projectId={projectId} brandColor={brandColor} />
      <AIReviewModal isOpen={aiReviewOpen} onClose={() => setAiReviewOpen(false)} projectId={projectId} brandColor={brandColor} />
      <AIDocsModal isOpen={aiDocsOpen} onClose={() => setAiDocsOpen(false)} projectId={projectId} brandColor={brandColor} />

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
    </div>
  );
};

export default YourWorkspaceProjectId;
// src/workspaceScreens/YourWorkspaceProjectId.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import {
  useGetProjectByIdQuery,
  useManageProjectManagersMutation,
  useAddTeamMemberMutation,
  useRemoveTeamMemberMutation,
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
  useAddSubTaskMutation,
  useUpdateSubTaskMutation,
  useMarkSubTaskDoneMutation,
  useConfirmSubTaskMutation,
  useRejectSubTaskMutation,
  useDeleteSubTaskMutation,
  useMarkTaskCompletedMutation,
  useConfirmTaskCompletionMutation,
  useSendManualReminderMutation,
  useGetTaskFeedbackQuery,
  useAssignTaskMutation,
  useReorderTasksMutation,
  useReorderSubTasksMutation,
} from '../slices/taskApiSlice';
import {
  useGetProjectFoldersQuery,
  useCreateFolderMutation,
  useUpdateFolderMutation,
  useDeleteFolderMutation,
  useAddFolderReadOnlyMutation,
  useRemoveFolderReadOnlyMutation,
} from '../slices/taskApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
import {
  FaArrowLeft,
  FaFolder,
  FaUsers,
  FaTasks,
  FaCheckCircle,
  FaClock,
  FaCalendarAlt,
  FaChartLine,
  FaUserCheck,
  FaPlus,
  FaTimes,
  FaEllipsisV,
  FaEdit,
  FaTrashAlt,
  FaUserPlus,
  FaUserMinus,
  FaCrown,
  FaCheck,
  FaSpinner,
  FaUser,
  FaFlag,
  FaFire,
  FaAngleDown,
  FaLink,
  FaPercent,
  FaHistory,
  FaCommentDots,
  FaPaperclip,
  FaSearch,
  FaCheckDouble,
  FaBell,
  FaRegClock,
  FaRocket,
  FaChartPie,
  FaClipboardList,
  FaStream,
  FaExclamationTriangle,
  FaArchive,
  FaUndo,
  FaTrashRestore,
  FaFolderOpen,
  FaLock,
  FaUserLock,
  FaUserEdit,
  FaRedo,
  FaGripVertical,
} from 'react-icons/fa';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────
const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const formatTimeAgo = (date) => {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

// ─── Media query hook ────────────────────────────────────────────────
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
};

// ─── Custom Dropdown (modern style) ───────────────────────────────
const CustomDropdown = React.memo(({ options, value, onChange, placeholder, label, brandColor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={dropdownRef} className="relative">
      {label && <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-all focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none whitespace-nowrap"
      >
        {selectedOption?.icon && <span className="text-[10px] flex-shrink-0">{selectedOption.icon}</span>}
        <span className="truncate flex-1 text-left">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <FaAngleDown className={`text-[8px] text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-full w-max min-w-[140px] bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-50 max-h-48 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition whitespace-nowrap ${
                option.value === value
                  ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'
              }`}
            >
              {option.icon && <span className="text-[10px] flex-shrink-0">{option.icon}</span>}
              <span>{option.label}</span>
              {option.value === value && (
                <FaCheck className="ml-auto text-[10px] text-teal-500 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── Badges ──────────────────────────────────────────────────────────
const priorityOptions = [
  { value: 'low', label: 'Low', icon: <FaFlag className="text-blue-400" /> },
  { value: 'medium', label: 'Medium', icon: <FaFlag className="text-yellow-400" /> },
  { value: 'high', label: 'High', icon: <FaFire className="text-red-400" /> },
  { value: 'urgent', label: 'Urgent', icon: <FaFire className="text-red-500" /> },
];
const statusOptions = [
  { value: 'pending', label: 'Pending', icon: <FaClock className="text-gray-400" /> },
  { value: 'in-progress', label: 'In Progress', icon: <FaSpinner className="text-yellow-400" /> },
  { value: 'ready_for_completion', label: 'Ready', icon: <FaCheckCircle className="text-blue-400" /> },
  { value: 'completed', label: 'Completed', icon: <FaCheckCircle className="text-green-400" /> },
  { value: 'confirmed_completed', label: 'Confirmed', icon: <FaCheckCircle className="text-green-600" /> },
];

const TaskStatusBadge = React.memo(({ status }) => {
  const map = {
    pending: { label: 'Pending', color: 'bg-gray-100 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700' },
    'in-progress': { label: 'In Progress', color: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700/50' },
    ready_for_completion: { label: 'Ready', color: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-700/50' },
    completed: { label: 'Completed', color: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 border-green-200 dark:border-green-700/50' },
    confirmed_completed: { label: 'Confirmed', color: 'bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-200 border-green-300 dark:border-green-600/50' },
  };
  const s = map[status] || map.pending;
  return <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>;
});

const TaskPriorityBadge = React.memo(({ priority }) => {
  const map = {
    low: { label: 'Low', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/40' },
    medium: { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700/40' },
    high: { label: 'High', color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40' },
    urgent: { label: 'Urgent', color: 'text-red-700 dark:text-red-500 bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700/50' },
  };
  const p = map[priority] || map.medium;
  return <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${p.color}`}>{p.label}</span>;
});

// ─── Confirm Modal ──────────────────────────────────────────────────
const ConfirmModal = React.memo(({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          {danger && <FaExclamationTriangle className="text-red-500 text-xl" />}
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
            {cancelText}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 dark:bg-[#0d9488] hover:bg-teal-700 dark:hover:bg-[#0f9e96]'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Delete Task Confirm Modal ────────────────────────────────
const DeleteTaskConfirmModal = React.memo(({ isOpen, onClose, onConfirm, taskName }) => {
  const [inputValue, setInputValue] = useState('');
  const expectedPhrase = `I want to delete ${taskName}`;

  const handleConfirm = () => {
    if (inputValue === expectedPhrase) {
      onConfirm();
      onClose();
      setInputValue('');
    } else {
      toast.error('Please type the exact phrase to confirm deletion.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <FaExclamationTriangle className="text-red-500 text-xl" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Delete Task</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          This action cannot be undone. Type the following to confirm:
        </p>
        <div className="bg-gray-100 dark:bg-[#0b0b10] p-3 rounded-xl border border-gray-300 dark:border-gray-700/60 mb-4">
          <code className="text-sm text-gray-800 dark:text-gray-200 font-mono">{expectedPhrase}</code>
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type the phrase above"
          className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none mb-4"
        />
        <div className="flex gap-3">
          <button onClick={() => { onClose(); setInputValue(''); }} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Reject Reason Modal ────────────────────────────────────────────────
const RejectReasonModal = React.memo(({ isOpen, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason);
    setReason('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Reject Sub‑task</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Reason for rejection (optional):</p>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason..."
          className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none mb-4"
        />
        <div className="flex gap-3">
          <button onClick={() => { onClose(); setReason(''); }} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
            Cancel
          </button>
          <button onClick={handleConfirm} className="flex-1 py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl text-sm font-medium transition hover:opacity-80">
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Task Card ─────────────────────────────────────────────────────────
const TaskCard = React.memo(({
  task,
  onClick,
  brandColor,
  isActive,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDragLeave,
  dragOver,
}) => {
  const progress = task.progress || 0;
  const subTaskCount = task.subTasks?.length || 0;
  const confirmedCount = (task.subTasks || []).filter(st => st.status === 'confirmed').length || 0;
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = due && due < new Date() && task.status !== 'completed' && task.status !== 'confirmed_completed';
  const assignee = task.assignee;
  const folderName = task.folder?.name;

  const hasRecurrence = task.recurrenceType && task.recurrenceType !== 'none';
  const recurrenceLabel = task.recurrenceType === 'daily' ? 'Daily' : task.recurrenceType === 'weekly' ? 'Weekly' : '';

  const handleDragStart = (e) => {
    if (!draggable) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', task._id);
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(e, task);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (onDragOver) onDragOver(e, task);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (onDrop) onDrop(e, task);
  };

  return (
    <div
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={onDragLeave}
      onClick={() => onClick(task._id)}
      className={`group relative bg-white dark:bg-[#14141a] rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
        isActive ? 'border-teal-500 dark:border-[#0d9488] shadow-[0_0_20px_rgba(13,148,136,0.15)]' : 'border-gray-200/60 dark:border-gray-800/40 hover:border-teal-500 dark:hover:border-[#0d9488]/50'
      } ${draggable ? 'active:cursor-grabbing' : ''} ${dragOver ? 'border-teal-500 dark:border-[#0d9488] bg-teal-50/50 dark:bg-[#0d9488]/5' : ''}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {draggable && (
              <FaGripVertical className="text-gray-300 dark:text-gray-700 text-xs flex-shrink-0 cursor-grab" />
            )}
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {task.title.charAt(0).toUpperCase()}
            </div>
            <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-gray-900 dark:group-hover:text-white transition">
              {task.title}
            </h4>
            {hasRecurrence && (
              <span className="flex-shrink-0 text-[10px] text-teal-600 dark:text-[#0d9488] flex items-center gap-0.5" title={`Recurring: ${recurrenceLabel}`}>
                <FaRedo className="text-[8px]" /> {recurrenceLabel}
              </span>
            )}
          </div>
          <TaskStatusBadge status={task.status} />
        </div>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <TaskPriorityBadge priority={task.priority} />
          {subTaskCount > 0 && (
            <span className="text-[10px] text-gray-500 dark:text-gray-500">• {confirmedCount}/{subTaskCount} done</span>
          )}
          {isOverdue && (
            <span className="text-[10px] text-red-500 dark:text-red-400 flex items-center gap-1">
              <FaClock className="text-[8px]" /> Overdue
            </span>
          )}
          {folderName && (
            <span className="text-[10px] text-gray-500 dark:text-gray-500 flex items-center gap-1">
              <FaFolder className="text-[8px]" /> {folderName}
            </span>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-500">
            {assignee ? `${assignee.name}` : 'Unassigned'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-500">{task.dueDate ? formatDateTime(task.dueDate) : 'No due'}</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: brandColor }}
            />
          </div>
          <span className="text-xs font-mono text-gray-400 dark:text-gray-400">{progress}%</span>
        </div>
      </div>
    </div>
  );
});

// ─── Search Modal ──────────────────────────────────────────────────────
const SearchModal = React.memo(({ isOpen, onClose, items, type, brandColor, onSelect }) => {
  const [query, setQuery] = useState('');
  if (!isOpen) return null;
  const filtered = items.filter(item => {
    if (type === 'tasks') return item.title?.toLowerCase().includes(query.toLowerCase());
    const user = item.user || item;
    return (user.name || '').toLowerCase().includes(query.toLowerCase()) ||
           (user.email || '').toLowerCase().includes(query.toLowerCase());
  });
  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-[#0b0b10]/90 backdrop-blur-xl flex flex-col">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200/60 dark:border-gray-800/60 bg-gray-50 dark:bg-[#14141a]/80">
        <button onClick={onClose} className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"><FaArrowLeft /></button>
        <div className="flex-1 bg-gray-100 dark:bg-[#1e1e26] rounded-2xl px-4 py-2 flex items-center gap-3 border border-gray-200 dark:border-gray-800/40 focus-within:border-teal-500 dark:focus-within:border-[#0d9488]/50 transition">
          <FaSearch className="text-gray-400 dark:text-gray-500 text-xs" />
          <input
            type="text"
            placeholder={type === 'tasks' ? 'Search tasks...' : 'Search members...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent w-full outline-none text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <FaTimes className="text-xs" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {!query && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <FaSearch className="text-5xl mb-3 opacity-20" />
            <p className="text-sm">Search {type === 'tasks' ? 'tasks' : 'members'}</p>
          </div>
        )}
        {query && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <p className="text-sm">No results for "{query}"</p>
          </div>
        )}
        {query && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map(item => (
              <div
                key={item._id || (item.user?._id)}
                onClick={() => {
                  if (type === 'tasks') onSelect(item._id);
                  onClose();
                }}
                className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/40 hover:border-teal-500 dark:hover:border-[#0d9488]/40 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition cursor-pointer group"
              >
                {type === 'tasks' ? (
                  <>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold" style={{ backgroundColor: brandColor }}>
                      {item.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition">{item.title}</p>
                      <div className="flex items-center gap-1.5 text-xs">
                        <TaskStatusBadge status={item.status} />
                        <TaskPriorityBadge priority={item.priority} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="relative flex-shrink-0">
                      {(item.user?.profile && <img src={item.user.profile} className="w-10 h-10 rounded-full object-cover" />) || (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: brandColor }}>
                          {(item.user?.name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      {item.status === 'active' && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-[#0b0b10]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition">{item.user?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{item.user?.email}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Sub‑task Item ────────────────────────────────────────────────────
const SubTaskItem = React.memo(({
  subTask,
  index,
  taskId,
  isAssignee,
  canManage,
  onRefresh,
  brandColor,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDragLeave,
  dragOver,
}) => {
  const [markDone] = useMarkSubTaskDoneMutation();
  const [confirmSub] = useConfirmSubTaskMutation();
  const [rejectSub] = useRejectSubTaskMutation();
  const [deleteSub] = useDeleteSubTaskMutation();
  const [updating, setUpdating] = useState(false);
  const [showDoneForm, setShowDoneForm] = useState(false);
  const [doneNotes, setDoneNotes] = useState('');
  const [doneLinks, setDoneLinks] = useState('');
  const [doneFiles, setDoneFiles] = useState([]);

  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [confirmFeedback, setConfirmFeedback] = useState('');

  const [isExpanded, setIsExpanded] = useState(false);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // ✅ Custom delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const hasDetails = subTask.notes ||
    (subTask.links && subTask.links.length > 0) ||
    (subTask.attachments && subTask.attachments.length > 0) ||
    subTask.feedback ||
    subTask.rejectedBy;

  const handleMarkDone = () => {
    if (subTask.status === 'done' || subTask.status === 'confirmed') return;
    setShowDoneForm(true);
  };

  const submitDone = async () => {
    setUpdating(true);
    try {
      const fd = new FormData();
      fd.append('notes', doneNotes);
      fd.append('links', JSON.stringify(doneLinks.split('\n').filter(Boolean)));
      doneFiles.forEach(f => fd.append('attachments', f));
      await markDone({ taskId, subTaskIndex: index, data: fd }).unwrap();
      toast.success('Sub‑task marked done');
      setShowDoneForm(false);
      setDoneNotes('');
      setDoneLinks('');
      setDoneFiles([]);
      onRefresh();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setUpdating(false); }
  };

  const cancelDone = () => {
    setShowDoneForm(false);
    setDoneNotes('');
    setDoneLinks('');
    setDoneFiles([]);
  };

  const handleConfirmClick = () => setShowConfirmForm(true);

  const submitConfirm = async () => {
    setUpdating(true);
    try {
      await confirmSub({ taskId, subTaskIndex: index, feedback: confirmFeedback }).unwrap();
      toast.success('Sub‑task confirmed');
      setShowConfirmForm(false);
      setConfirmFeedback('');
      onRefresh();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setUpdating(false); }
  };

  const cancelConfirm = () => {
    setShowConfirmForm(false);
    setConfirmFeedback('');
  };

  const handleRejectClick = () => setShowRejectModal(true);

  const handleRejectConfirm = async (reason) => {
    setUpdating(true);
    try {
      await rejectSub({ taskId, subTaskIndex: index, reason }).unwrap();
      toast.success('Sub‑task rejected');
      onRefresh();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setUpdating(false); }
  };

  // ✅ Replaced window.confirm with custom modal
  const handleDelete = () => {
    if (canManage || isAssignee) {
      setShowDeleteModal(true);
    }
  };

  const confirmDelete = async () => {
    setShowDeleteModal(false);
    setUpdating(true);
    try {
      await deleteSub({ taskId, subTaskIndex: index }).unwrap();
      toast.success('Sub‑task deleted');
      onRefresh();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setUpdating(false); }
  };

  const statusMap = {
    pending: { label: 'Pending', color: 'text-gray-400' },
    done: { label: 'Done', color: 'text-blue-500' },
    confirmed: { label: 'Confirmed', color: 'text-green-500' },
  };
  const st = statusMap[subTask.status] || statusMap.pending;

  const handleDragStart = (e) => {
    if (!draggable) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(e, index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (onDragOver) onDragOver(e, index);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (onDrop) onDrop(e, index);
  };

  return (
    <>
      <div
        draggable={draggable}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={onDragLeave}
        className={`flex flex-col py-2 border-b border-gray-100 dark:border-gray-800/20 last:border-0 transition-colors ${
          dragOver ? 'bg-teal-50/50 dark:bg-[#0d9488]/5 border-teal-500 dark:border-[#0d9488]' : ''
        }`}
      >
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {draggable && (
                <FaGripVertical className="text-gray-300 dark:text-gray-700 text-xs flex-shrink-0 cursor-grab" />
              )}
              <span className="text-sm font-medium text-gray-800 dark:text-gray-300">{subTask.title}</span>
              <span className={`text-[10px] font-medium ${st.color}`}>{st.label}</span>
              {subTask.dueDate && new Date(subTask.dueDate) < new Date() && subTask.status !== 'confirmed' && (
                <span className="text-[10px] text-red-500 dark:text-red-400 flex items-center gap-1"><FaClock className="text-[8px]" /> Overdue</span>
              )}
            </div>
            {subTask.description && <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{subTask.description}</p>}
            {subTask.dueDate && <p className="text-[10px] text-gray-500 dark:text-gray-500 flex items-center gap-1"><FaRegClock className="text-xs" /> {formatDateTime(subTask.dueDate)}</p>}
          </div>
          {hasDetails && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition flex-shrink-0"
            >
              <FaAngleDown className={`text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1 mt-1 sm:mt-0 sm:ml-auto sm:flex-nowrap">
          {isAssignee && subTask.status === 'pending' && (
            <button onClick={handleMarkDone} disabled={updating} className="p-1 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition">
              <FaCheck className="text-xs" />
            </button>
          )}
          {canManage && subTask.status === 'done' && (
            <>
              <button onClick={handleConfirmClick} disabled={updating} className="p-1 text-green-500 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition">
                <FaCheckDouble className="text-xs" />
              </button>
              <button onClick={handleRejectClick} disabled={updating} className="p-1 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition">
                <FaTimes className="text-xs" />
              </button>
            </>
          )}
          {(isAssignee && subTask.status !== 'confirmed') || canManage ? (
            <button onClick={handleDelete} disabled={updating} className="p-1 text-red-400 dark:text-red-400/60 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition">
              <FaTrashAlt className="text-xs" />
            </button>
          ) : null}
        </div>

        {isExpanded && (
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-1 bg-gray-50 dark:bg-[#1a1a24] p-3 rounded-xl border border-gray-200 dark:border-gray-800/40 w-full overflow-hidden">
            {subTask.notes && <div><span className="font-medium text-gray-700 dark:text-gray-300">Notes:</span> {subTask.notes}</div>}
            {subTask.links && subTask.links.length > 0 && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Links:</span>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {subTask.links.map((l, i) => (
                    <React.Fragment key={i}>
                      <a
                        href={l}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-600 dark:text-[#0d9488] underline hover:text-teal-700 dark:hover:text-[#14b8a6] break-all"
                      >
                        {l}
                      </a>
                      {i < subTask.links.length - 1 && <span className="text-gray-400 dark:text-gray-500">,</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
            {subTask.attachments && subTask.attachments.length > 0 && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Attachments:</span>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {subTask.attachments.map((att, i) => (
                    <React.Fragment key={i}>
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-[#0d9488] underline hover:text-teal-700 dark:hover:text-[#14b8a6] break-all">
                        {att.name || 'file'}
                      </a>
                      {i < subTask.attachments.length - 1 && <span className="text-gray-400 dark:text-gray-500">,</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
            {subTask.feedback && <div><span className="font-medium text-gray-700 dark:text-gray-300">Confirm feedback:</span> {subTask.feedback}</div>}
            {subTask.rejectedBy && (
              <div><span className="font-medium text-gray-700 dark:text-gray-300">Rejected by:</span> {subTask.rejectedBy.name || 'Unknown'} on {formatDateTime(subTask.rejectedAt)}</div>
            )}
            {subTask.rejectionReason && <div><span className="font-medium text-gray-700 dark:text-gray-300">Rejection reason:</span> {subTask.rejectionReason}</div>}
            {subTask.completedAt && <div><span className="font-medium text-gray-700 dark:text-gray-300">Submitted on:</span> {formatDateTime(subTask.completedAt)}</div>}
            {subTask.confirmedAt && <div><span className="font-medium text-gray-700 dark:text-gray-300">Confirmed on:</span> {formatDateTime(subTask.confirmedAt)}</div>}
          </div>
        )}

        {showDoneForm && (
          <div className="mt-2 bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-gray-800/60 rounded-xl p-3 w-full">
            <textarea
              placeholder="Add notes (optional)"
              value={doneNotes}
              onChange={(e) => setDoneNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none mb-2"
            />
            <textarea
              placeholder="Links (one per line)"
              value={doneLinks}
              onChange={(e) => setDoneLinks(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none mb-2"
            />
            <div className="flex items-center gap-2 mb-2">
              <input
                type="file"
                multiple
                onChange={(e) => setDoneFiles([...e.target.files])}
                className="text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-teal-50 dark:file:bg-[#0d9488]/20 file:text-teal-600 dark:file:text-[#0d9488]"
              />
              {doneFiles.length > 0 && <span className="text-xs text-gray-500 dark:text-gray-500">{doneFiles.length} file(s)</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={submitDone} disabled={updating} className="px-3 py-1.5 bg-teal-600 dark:bg-[#0d9488] text-white text-xs rounded-lg hover:bg-teal-700 dark:hover:bg-[#0f9e96] transition">
                {updating ? 'Saving...' : 'Submit Done'}
              </button>
              <button onClick={cancelDone} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                Cancel
              </button>
            </div>
          </div>
        )}

        {showConfirmForm && (
          <div className="mt-2 bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-gray-800/60 rounded-xl p-3 w-full">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Assignee submitted:</p>
            {subTask.notes && <div className="text-xs text-gray-600 dark:text-gray-400 mb-1"><span className="font-medium text-gray-700 dark:text-gray-300">Notes:</span> {subTask.notes}</div>}
            {subTask.links && subTask.links.length > 0 && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span className="font-medium text-gray-700 dark:text-gray-300">Links:</span>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {subTask.links.map((l, i) => (
                    <React.Fragment key={i}>
                      <a href={l} target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-[#0d9488] underline break-all">{l}</a>
                      {i < subTask.links.length - 1 && <span className="text-gray-400 dark:text-gray-500">,</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
            {subTask.attachments && subTask.attachments.length > 0 && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">Attachments:</span>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {subTask.attachments.map((att, i) => (
                    <React.Fragment key={i}>
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-[#0d9488] underline break-all">{att.name || 'file'}</a>
                      {i < subTask.attachments.length - 1 && <span className="text-gray-400 dark:text-gray-500">,</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
            <textarea
              placeholder="Add feedback (optional)"
              value={confirmFeedback}
              onChange={(e) => setConfirmFeedback(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none mb-2"
            />
            <div className="flex gap-2">
              <button onClick={submitConfirm} disabled={updating} className="px-3 py-1.5 bg-green-600 dark:bg-green-700 text-white text-xs rounded-lg hover:bg-green-700 dark:hover:bg-green-800 transition">
                {updating ? 'Confirming...' : 'Confirm'}
              </button>
              <button onClick={cancelConfirm} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <RejectReasonModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={(reason) => handleRejectConfirm(reason)}
      />

      {/* ✅ Custom delete confirmation modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Sub‑task"
        message={`Are you sure you want to delete "${subTask.title}"? This cannot be undone.`}
        confirmText="Delete"
        danger
      />
    </>
  );
});

// ─── Assign Task Modal ──────────────────────────────────────────────────
const AssignTaskModal = React.memo(({ isOpen, onClose, task, assignableMembers, brandColor, onAssign }) => {
  const [assigneeId, setAssigneeId] = useState('');
  const [loading, setLoading] = useState(false);

  const assigneeOpts = [
    { value: '', label: 'Select a member...', icon: <FaUser className="text-gray-400" /> },
    ...assignableMembers.map(m => {
      const u = m.user || m;
      return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" alt="" /> : <FaUser className="text-gray-400" /> };
    })
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assigneeId) { toast.error('Please select a member'); return; }
    setLoading(true);
    try {
      await onAssign(assigneeId);
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to assign task');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaUserPlus className="inline mr-1 text-teal-600 dark:text-[#0d9488]" /> Assign Task</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Assign "{task?.title}" to a member.</p>
          <CustomDropdown
            label="Select Member"
            options={assigneeOpts}
            value={assigneeId}
            onChange={setAssigneeId}
            placeholder="Select..."
            brandColor={brandColor}
          />
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>
              {loading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

// ─── Task Detail View ────────────────────────────────────────────────
const TaskDetailView = React.memo(({
  task,
  brandColor,
  feedbackData,
  isLoading,
  userInfo,
  onBack,
  onEdit,
  onDelete,
  onRefresh,
  canManage,
  onSendReminder,
  onConfirmCompletion,
  onAssignTask,
  subDragStart,
  subDragEnd,
  subDragOver,
  subDrop,
  subDragLeave,
  subDragOverIndex,
}) => {
  const isAssignee = task.assignee?._id === userInfo?._id;
  const [showMenu, setShowMenu] = useState(false);
  const [addSubTaskOpen, setAddSubTaskOpen] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [newSubTaskStart, setNewSubTaskStart] = useState('');
  const [newSubTaskDue, setNewSubTaskDue] = useState('');
  const [adding, setAdding] = useState(false);
  const [addSubTask] = useAddSubTaskMutation();

  const hasRecurrence = task.recurrenceType && task.recurrenceType !== 'none';
  const recurrenceLabel = task.recurrenceType === 'daily' ? 'Daily' : task.recurrenceType === 'weekly' ? 'Weekly' : '';

  const handleAddSubTask = async () => {
    if (!newSubTaskTitle.trim()) { toast.error('Title required'); return; }
    setAdding(true);
    try {
      await addSubTask({
        taskId: task._id,
        data: {
          title: newSubTaskTitle.trim(),
          startDate: newSubTaskStart || null,
          dueDate: newSubTaskDue || null,
        },
      }).unwrap();
      toast.success('Sub‑task added');
      setNewSubTaskTitle('');
      setNewSubTaskStart('');
      setNewSubTaskDue('');
      setAddSubTaskOpen(false);
      onRefresh();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setAdding(false); }
  };

  const progress = task.progress || 0;
  const total = task.subTasks?.length || 0;
  const confirmed = (task.subTasks || []).filter(st => st.status === 'confirmed').length || 0;

  const canReorderSub = canManage || (isAssignee && task.allowAssigneeEditSubtasks);
  const isReadOnly = task.isArchived || task.isTrash || false;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-[#0f0f12]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-[#14141a]/80 backdrop-blur-sm flex-shrink-0 sticky top-0 z-10">
        <button onClick={onBack} className="p-1 md:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"><FaArrowLeft /></button>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: brandColor }}
        >
          {task.title.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{task.title}</h2>
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            {hasRecurrence && (
              <span className="flex items-center gap-0.5 text-teal-600 dark:text-[#0d9488]">
                <FaRedo className="text-[10px]" /> {recurrenceLabel}
              </span>
            )}
            {task.assignee && <span className="text-gray-600 dark:text-gray-400 truncate">{task.assignee.name}</span>}
            {task.folder && <span className="text-gray-600 dark:text-gray-400 truncate flex items-center gap-1"><FaFolder className="text-xs" /> {task.folder.name}</span>}
          </div>
        </div>
        <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition">
          <FaEllipsisV className="text-sm" />
        </button>
        {showMenu && (
          <div className="absolute right-4 top-12 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-800/60 rounded-xl min-w-[150px] z-20 py-1 shadow-lg">
            {canManage && !isReadOnly && (
              <button onClick={() => { setShowMenu(false); onSendReminder(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 w-full transition">
                <FaBell className="text-xs" /> Send Reminder
              </button>
            )}
            {!isReadOnly && (
              <button onClick={() => { setShowMenu(false); onEdit(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 w-full transition">
                <FaEdit className="text-xs" /> Edit
              </button>
            )}
            {canManage && !isReadOnly && (
              <button onClick={() => { setShowMenu(false); onDelete(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 w-full transition">
                <FaTrashAlt className="text-xs" /> Delete
              </button>
            )}
            {canManage && !task.assignee && !isReadOnly && (
              <button onClick={() => { setShowMenu(false); onAssignTask(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-teal-600 dark:text-[#0d9488] hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 w-full transition">
                <FaUserPlus className="text-xs" /> Assign Task
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress & Stats */}
      <div className="bg-white dark:bg-[#14141a] border-b border-gray-200/60 dark:border-gray-800/40 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">Progress</span>
          <span className="text-gray-600 dark:text-gray-400">{progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800/60 rounded-full mt-1 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, backgroundColor: brandColor, boxShadow: `0 0 12px ${brandColor}66` }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-500">
          <span>{confirmed}/{total} sub‑tasks confirmed</span>
          {task.dueDate && (
            <span className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && task.status !== 'completed' && task.status !== 'confirmed_completed' ? 'text-red-500 dark:text-red-400' : ''}`}>
              <FaCalendarAlt className="text-[10px]" /> Due: {formatDateTime(task.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Sub‑tasks area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-24 md:pb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <FaTasks className="text-teal-600 dark:text-[#0d9488]" /> Sub‑tasks
          </h3>
          {!isReadOnly && ((isAssignee && task.allowAssigneeEditSubtasks) || canManage) && (
            <button onClick={() => setAddSubTaskOpen(!addSubTaskOpen)} className="text-xs text-teal-600 dark:text-[#0d9488] font-medium flex items-center gap-1 hover:text-teal-700 dark:hover:text-[#14b8a6] transition">
              <FaPlus className="text-xs" /> Add
            </button>
          )}
        </div>

        {addSubTaskOpen && (
          <div className="bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-gray-800/60 rounded-xl p-3 mb-3 w-full">
            <input
              type="text"
              placeholder="Sub‑task title"
              value={newSubTaskTitle}
              onChange={(e) => setNewSubTaskTitle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none mb-2"
            />
            <input
              type="datetime-local"
              placeholder="Start date & time"
              value={newSubTaskStart}
              onChange={(e) => setNewSubTaskStart(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none mb-2"
            />
            <input
              type="datetime-local"
              placeholder="Due date & time"
              value={newSubTaskDue}
              onChange={(e) => setNewSubTaskDue(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none mb-2"
            />
            <div className="flex gap-2">
              <button onClick={() => setAddSubTaskOpen(false)} className="flex-1 py-1.5 border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={handleAddSubTask} disabled={adding} className="flex-1 py-1.5 text-white rounded-lg text-sm transition" style={{ backgroundColor: brandColor }}>
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {(task.subTasks || []).length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-500 text-sm">No sub‑tasks yet</div>
        ) : (
          (task.subTasks || []).map((st, idx) => {
            const isDragOver = subDragOverIndex === idx;
            return (
              <SubTaskItem
                key={idx}
                subTask={st}
                index={idx}
                taskId={task._id}
                isAssignee={isAssignee}
                canManage={canManage}
                onRefresh={onRefresh}
                brandColor={brandColor}
                draggable={canReorderSub && !isReadOnly}
                onDragStart={subDragStart}
                onDragEnd={subDragEnd}
                onDragOver={subDragOver}
                onDrop={subDrop}
                onDragLeave={subDragLeave}
                dragOver={isDragOver}
              />
            );
          })
        )}
      </div>

      {/* Bottom action bar */}
      {!isReadOnly && isAssignee && task.status !== 'completed' && task.status !== 'confirmed_completed' && (
        <div className="border-t border-gray-200/60 dark:border-gray-800/40 bg-white dark:bg-[#14141a] px-3 py-2 flex-shrink-0 sticky bottom-0">
          <button
            onClick={() => onRefresh()}
            className="w-full py-2 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition hover:opacity-80"
            style={{ backgroundColor: brandColor }}
          >
            <FaChartLine className="text-sm" /> Refresh status
          </button>
        </div>
      )}
      {!isReadOnly && canManage && task.status === 'completed' && task.status !== 'confirmed_completed' && (
        <div className="border-t border-gray-200/60 dark:border-gray-800/40 bg-white dark:bg-[#14141a] px-3 py-2 flex-shrink-0 sticky bottom-0">
          <button
            onClick={onConfirmCompletion}
            className="w-full py-2 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition hover:opacity-80"
            style={{ backgroundColor: brandColor }}
          >
            <FaCheckDouble className="text-sm" /> Confirm Completion
          </button>
        </div>
      )}
    </div>
  );
});

// ─── Folder Form Modal ──────────────────────────────────────────────
const FolderFormModal = React.memo(({ isOpen, onClose, onSuccess, folder, brandColor, projectId }) => {
  const [name, setName] = useState(folder?.name || '');
  const [loading, setLoading] = useState(false);
  const [createFolder] = useCreateFolderMutation();
  const [updateFolder] = useUpdateFolderMutation();

  useEffect(() => {
    if (folder) setName(folder.name);
    else setName('');
  }, [folder]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Folder name required'); return; }
    setLoading(true);
    try {
      if (folder) {
        await updateFolder({ folderId: folder._id, name: name.trim() }).unwrap();
        toast.success('Folder updated');
      } else {
        await createFolder({ projectId, name: name.trim() }).unwrap();
        toast.success('Folder created');
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            {folder ? <FaEdit className="inline mr-1 text-teal-600 dark:text-[#0d9488]" /> : <FaFolder className="inline mr-1 text-teal-600 dark:text-[#0d9488]" />}
            {folder ? 'Edit Folder' : 'New Folder'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Folder Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none"
            required
          />
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>
              {loading ? 'Saving...' : folder ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

// ─── Folder Read‑Only Modal ─────────────────────────────────────────
const FolderReadOnlyModal = React.memo(({ isOpen, onClose, folder, project, brandColor, onSuccess }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addReadOnly] = useAddFolderReadOnlyMutation();
  const [removeReadOnly] = useRemoveFolderReadOnlyMutation();

  const activeTeam = (project?.teamMembers || []).filter(m => m.status === 'active');
  const currentReadOnly = folder?.readOnlyUsers?.map(id => id.toString()) || [];
  const available = activeTeam.filter(m => {
    const uid = m.user?._id || m._id;
    return uid && !currentReadOnly.includes(uid.toString());
  });

  const [selectedUsers, setSelectedUsers] = useState([]);

  useEffect(() => {
    setSelectedUsers([]);
  }, [folder]);

  const handleAdd = async () => {
    if (selectedUsers.length === 0) { toast.error('Select at least one user'); return; }
    setLoading(true);
    try {
      await addReadOnly({ folderId: folder._id, users: selectedUsers }).unwrap();
      toast.success(`${selectedUsers.length} user(s) added`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId) => {
    setLoading(true);
    try {
      await removeReadOnly({ folderId: folder._id, users: [userId] }).unwrap();
      toast.success('User removed from read-only');
      onSuccess();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !folder) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <FaUserLock className="text-teal-600 dark:text-[#0d9488]" /> Read-Only Users
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">- {folder.name}</span>
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>

        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Current Read-Only Users</h4>
          {currentReadOnly.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-500">No users have read-only access.</p>
          ) : (
            <div className="space-y-2">
              {currentReadOnly.map((uid) => {
                const member = activeTeam.find(m => (m.user?._id || m._id)?.toString() === uid);
                const user = member?.user || member;
                return (
                  <div key={uid} className="flex items-center justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      {user?.profile ? <img src={user.profile} className="w-6 h-6 rounded-full object-cover" alt="" /> : <FaUser className="text-gray-400" />}
                      <span className="text-sm text-gray-800 dark:text-gray-200">{user?.name || 'Unknown'}</span>
                    </div>
                    <button
                      onClick={() => handleRemove(uid)}
                      disabled={loading}
                      className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition"
                    >
                      <FaUserMinus className="text-xs" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {available.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Add Users</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {available.map((m) => {
                const user = m.user || m;
                const uid = (user._id || m._id).toString();
                const isChecked = selectedUsers.includes(uid);
                return (
                  <label key={uid} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-[#1a1a24] rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-[#0d9488]/5 transition">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedUsers([...selectedUsers, uid]);
                        else setSelectedUsers(selectedUsers.filter(id => id !== uid));
                      }}
                      className="accent-teal-600 dark:accent-[#0d9488]"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-200">{user?.name || 'Unknown'}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-3 mt-3">
              <button
                onClick={handleAdd}
                disabled={loading || selectedUsers.length === 0}
                className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: brandColor }}
              >
                {loading ? 'Adding...' : `Add ${selectedUsers.length} user(s)`}
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Close</button>
        </div>
      </div>
    </div>
  );
});

// ─── Create Task Modal ──────────────────────────────────────────────
const CreateTaskModal = React.memo(({ isOpen, onClose, projectId, brandColor, assignableMembers, folders, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [bufferTime, setBufferTime] = useState(0);
  const [allowAssigneeEditSubtasks, setAllowAssigneeEditSubtasks] = useState(false);
  const [linksText, setLinksText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [folderId, setFolderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [createTask] = useCreateTaskMutation();

  // ── Recurrence states ──
  const [recurrenceType, setRecurrenceType] = useState('none');
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDay = (day) => {
    if (recurrenceDays.includes(day)) {
      setRecurrenceDays(recurrenceDays.filter(d => d !== day));
    } else {
      setRecurrenceDays([...recurrenceDays, day].sort());
    }
  };

  const setQuickDueDate = (preset) => {
    const now = new Date();
    let target = new Date(now);
    switch (preset) {
      case 'in an hour': target.setHours(now.getHours() + 1); break;
      case 'in 12 hours': target.setHours(now.getHours() + 12); break;
      case 'today': target.setHours(23, 59, 59); break;
      case 'in two days': target.setDate(now.getDate() + 2); break;
      case 'in one week': target.setDate(now.getDate() + 7); break;
      case 'in two weeks': target.setDate(now.getDate() + 14); break;
      case 'in one month': target.setMonth(now.getMonth() + 1); break;
      default: return;
    }
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hours = String(target.getHours()).padStart(2, '0');
    const minutes = String(target.getMinutes()).padStart(2, '0');
    setDueDate(`${year}-${month}-${day}T${hours}:${minutes}`);
  };

  useEffect(() => {
    if (startDate && dueDate) {
      const start = new Date(startDate);
      const due = new Date(dueDate);
      if (start < due) {
        const diffMs = due - start;
        const diffHours = diffMs / (1000 * 60 * 60);
        setEstimatedHours(diffHours.toFixed(1));
      } else {
        setEstimatedHours('0');
      }
    } else {
      setEstimatedHours('');
    }
  }, [startDate, dueDate]);

  const assigneeOpts = [
    { value: '', label: 'Unassigned', icon: <FaUser className="text-gray-400" /> },
    ...assignableMembers.map(m => {
      const u = m.user || m;
      return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" alt="" /> : <FaUser className="text-gray-400" /> };
    })
  ];

  const folderOpts = [
    { value: '', label: 'No Folder', icon: <FaFolderOpen className="text-gray-400" /> },
    ...folders.map(f => ({ value: f._id, label: f.name, icon: <FaFolder className="text-gray-400" /> })),
  ];

  const handleFile = (e) => { setAttachments(prev => [...prev, ...Array.from(e.target.files)]); e.target.value = ''; };
  const removeFile = (i) => setAttachments(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title required'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('projectId', projectId);
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('assigneeId', assigneeId || '');
      fd.append('priority', priority);
      fd.append('estimatedHours', estimatedHours || '');
      fd.append('bufferTime', bufferTime.toString());
      fd.append('allowAssigneeEditSubtasks', allowAssigneeEditSubtasks ? 'true' : 'false');
      if (startDate) fd.append('startDate', startDate);
      if (dueDate) fd.append('dueDate', dueDate);
      if (folderId) fd.append('folderId', folderId);
      fd.append('recurrenceType', recurrenceType);
      if (recurrenceType === 'weekly') {
        fd.append('recurrenceDays', JSON.stringify(recurrenceDays));
      }
      if (recurrenceEndDate) fd.append('recurrenceEndDate', recurrenceEndDate);
      linksText.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => fd.append('links', l));
      attachments.forEach(f => fd.append('attachments', f));
      await createTask(fd).unwrap();
      toast.success('Task created');
      onSuccess();
      onClose();
    } catch (err) { toast.error(err?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaTasks className="inline mr-1 text-teal-600 dark:text-[#0d9488]" /> New Task</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description <span className="text-gray-400 text-xs">(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none" />
          </div>
          <CustomDropdown label="Assignee" options={assigneeOpts} value={assigneeId} onChange={setAssigneeId} placeholder="Select assignee" brandColor={brandColor} />
          <CustomDropdown label="Folder" options={folderOpts} value={folderId} onChange={setFolderId} placeholder="Select folder" brandColor={brandColor} />
          <div className="grid grid-cols-2 gap-3">
            <CustomDropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} brandColor={brandColor} />
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date & Time <span className="text-gray-400 text-xs">(optional)</span></label>
              <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Due Date & Time</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {['in an hour', 'in 12 hours', 'today', 'in two days', 'in one week', 'in two weeks', 'in one month'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQuickDueDate(preset)}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 transition"
                >
                  {preset}
                </button>
              ))}
            </div>
            <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Est. Hours <span className="text-gray-400 text-xs">(optional)</span></label>
              <input type="number" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none" readOnly={!!(startDate && dueDate)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buffer (min) <span className="text-gray-400 text-xs">(optional)</span></label>
              <input type="number" min="0" value={bufferTime} onChange={e => setBufferTime(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={allowAssigneeEditSubtasks} onChange={e => setAllowAssigneeEditSubtasks(e.target.checked)} id="allowEdit" className="accent-teal-600 dark:accent-[#0d9488]" />
            <label htmlFor="allowEdit" className="text-xs text-gray-600 dark:text-gray-400">Allow assignee to edit sub‑tasks</label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recurrence</label>
            <select
              value={recurrenceType}
              onChange={(e) => {
                setRecurrenceType(e.target.value);
                if (e.target.value !== 'weekly') setRecurrenceDays([]);
              }}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none"
            >
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          {recurrenceType === 'weekly' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Repeat on</label>
              <div className="flex flex-wrap gap-2">
                {weekDays.map((day, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      recurrenceDays.includes(idx)
                        ? 'bg-teal-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(recurrenceType === 'daily' || recurrenceType === 'weekly') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date (optional)</label>
              <input
                type="datetime-local"
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaLink className="inline mr-1" /> Links <span className="text-gray-400 text-xs">(optional, one per line)</span></label>
            <textarea value={linksText} onChange={e => setLinksText(e.target.value)} rows={3} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaPaperclip className="inline mr-1" /> Attachments <span className="text-gray-400 text-xs">(optional)</span></label>
            <input type="file" multiple onChange={handleFile} className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-teal-50 dark:file:bg-[#0d9488]/20 file:text-teal-600 dark:file:text-[#0d9488]" />
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((f, i) => (
                  <div key={i} className="flex justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5">
                    <span className="text-sm truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"><FaTrashAlt className="text-xs" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Creating...' : 'Create Task'}</button>
          </div>
        </form>
      </div>
    </div>
  );
});

// ─── Edit Task Modal ────────────────────────────────────────────────
const EditTaskModal = React.memo(({ isOpen, onClose, task, brandColor, assignableMembers, folders, onSuccess }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [assigneeId, setAssigneeId] = useState(task?.assignee?._id || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [startDate, setStartDate] = useState(task?.startDate ? new Date(task.startDate).toISOString().slice(0, 16) : '');
  const [dueDate, setDueDate] = useState(task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');
  const [status, setStatus] = useState(task?.status || 'pending');
  const [estimatedHours, setEstimatedHours] = useState(task?.estimatedHours || '');
  const [bufferTime, setBufferTime] = useState(task?.bufferTime || 0);
  const [allowAssigneeEditSubtasks, setAllowAssigneeEditSubtasks] = useState(task?.allowAssigneeEditSubtasks || false);
  const [linksText, setLinksText] = useState(task?.links?.join('\n') || '');
  const [attachments, setAttachments] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState(task?.attachments || []);
  const [folderId, setFolderId] = useState(task?.folder?._id || '');
  const [loading, setLoading] = useState(false);
  const [updateTask] = useUpdateTaskMutation();

  // ── Recurrence states ──
  const [recurrenceType, setRecurrenceType] = useState(task?.recurrenceType || 'none');
  const [recurrenceDays, setRecurrenceDays] = useState(task?.recurrenceDays || []);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    task?.recurrenceEndDate ? new Date(task.recurrenceEndDate).toISOString().slice(0, 16) : ''
  );
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDay = (day) => {
    if (recurrenceDays.includes(day)) {
      setRecurrenceDays(recurrenceDays.filter(d => d !== day));
    } else {
      setRecurrenceDays([...recurrenceDays, day].sort());
    }
  };

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setAssigneeId(task.assignee?._id || task.assignee || '');
      setPriority(task.priority || 'medium');
      setStartDate(task.startDate ? new Date(task.startDate).toISOString().slice(0, 16) : '');
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');
      setStatus(task.status || 'pending');
      setEstimatedHours(task.estimatedHours || '');
      setBufferTime(task.bufferTime || 0);
      setAllowAssigneeEditSubtasks(task.allowAssigneeEditSubtasks || false);
      setLinksText((task.links || []).join('\n'));
      setExistingAttachments(task.attachments || []);
      setFolderId(task.folder?._id || '');
      setRecurrenceType(task.recurrenceType || 'none');
      setRecurrenceDays(task.recurrenceDays || []);
      setRecurrenceEndDate(task.recurrenceEndDate ? new Date(task.recurrenceEndDate).toISOString().slice(0, 16) : '');
    }
  }, [task]);

  useEffect(() => {
    if (startDate && dueDate) {
      const start = new Date(startDate);
      const due = new Date(dueDate);
      if (start < due) {
        const diffMs = due - start;
        const diffHours = diffMs / (1000 * 60 * 60);
        setEstimatedHours(diffHours.toFixed(1));
      } else {
        setEstimatedHours('0');
      }
    } else if (task?.estimatedHours && !startDate && !dueDate) {
      setEstimatedHours(task.estimatedHours);
    } else {
      setEstimatedHours('');
    }
  }, [startDate, dueDate, task]);

  const assigneeOpts = [
    { value: '', label: 'Unassigned', icon: <FaUser className="text-gray-400" /> },
    ...assignableMembers.map(m => {
      const u = m.user || m;
      return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" alt="" /> : <FaUser className="text-gray-400" /> };
    })
  ];

  const folderOpts = [
    { value: '', label: 'No Folder', icon: <FaFolderOpen className="text-gray-400" /> },
    ...folders.map(f => ({ value: f._id, label: f.name, icon: <FaFolder className="text-gray-400" /> })),
  ];

  const handleFile = (e) => { setAttachments(prev => [...prev, ...Array.from(e.target.files)]); e.target.value = ''; };
  const removeNew = (i) => setAttachments(prev => prev.filter((_, idx) => idx !== i));
  const removeExisting = (i) => setExistingAttachments(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title required'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('priority', priority);
      fd.append('status', status);
      fd.append('estimatedHours', estimatedHours || '');
      fd.append('bufferTime', bufferTime.toString());
      fd.append('allowAssigneeEditSubtasks', allowAssigneeEditSubtasks ? 'true' : 'false');
      if (startDate) fd.append('startDate', startDate);
      if (dueDate) fd.append('dueDate', dueDate);
      if (folderId) fd.append('folderId', folderId);
      fd.append('recurrenceType', recurrenceType);
      if (recurrenceType === 'weekly') {
        fd.append('recurrenceDays', JSON.stringify(recurrenceDays));
      }
      if (recurrenceEndDate) fd.append('recurrenceEndDate', recurrenceEndDate);
      linksText.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => fd.append('links', l));
      attachments.forEach(f => fd.append('attachments', f));
      await updateTask({ taskId: task._id, data: fd }).unwrap();
      toast.success('Task updated');
      onSuccess();
      onClose();
    } catch (err) { toast.error(err?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaEdit className="inline mr-1 text-teal-600 dark:text-[#0d9488]" /> Edit Task</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description <span className="text-gray-400 text-xs">(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none" />
          </div>
          <CustomDropdown label="Status" options={statusOptions} value={status} onChange={setStatus} brandColor={brandColor} />
          <CustomDropdown label="Assignee" options={assigneeOpts} value={assigneeId} onChange={setAssigneeId} brandColor={brandColor} />
          <CustomDropdown label="Folder" options={folderOpts} value={folderId} onChange={setFolderId} brandColor={brandColor} />
          <div className="grid grid-cols-2 gap-3">
            <CustomDropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} brandColor={brandColor} />
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date & Time <span className="text-gray-400 text-xs">(optional)</span></label>
              <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Due Date & Time</label>
            <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Est. Hours <span className="text-gray-400 text-xs">(optional)</span></label>
              <input type="number" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none" readOnly={!!(startDate && dueDate)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buffer (min) <span className="text-gray-400 text-xs">(optional)</span></label>
              <input type="number" min="0" value={bufferTime} onChange={e => setBufferTime(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={allowAssigneeEditSubtasks} onChange={e => setAllowAssigneeEditSubtasks(e.target.checked)} id="allowEditEdit" className="accent-teal-600 dark:accent-[#0d9488]" />
            <label htmlFor="allowEditEdit" className="text-xs text-gray-600 dark:text-gray-400">Allow assignee to edit sub‑tasks</label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recurrence</label>
            <select
              value={recurrenceType}
              onChange={(e) => {
                setRecurrenceType(e.target.value);
                if (e.target.value !== 'weekly') setRecurrenceDays([]);
              }}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none"
            >
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          {recurrenceType === 'weekly' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Repeat on</label>
              <div className="flex flex-wrap gap-2">
                {weekDays.map((day, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      recurrenceDays.includes(idx)
                        ? 'bg-teal-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(recurrenceType === 'daily' || recurrenceType === 'weekly') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date (optional)</label>
              <input
                type="datetime-local"
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaLink className="inline mr-1" /> Links <span className="text-gray-400 text-xs">(optional)</span></label>
            <textarea value={linksText} onChange={e => setLinksText(e.target.value)} rows={3} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaPaperclip className="inline mr-1" /> Attachments <span className="text-gray-400 text-xs">(optional)</span></label>
            {existingAttachments.length > 0 && (
              <div className="mb-2 space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-500">Existing:</p>
                {existingAttachments.map((f, i) => (
                  <div key={i} className="flex justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5">
                    <span className="text-sm truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                    <button type="button" onClick={() => removeExisting(i)} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"><FaTrashAlt className="text-xs" /></button>
                  </div>
                ))}
              </div>
            )}
            <input type="file" multiple onChange={handleFile} className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-teal-50 dark:file:bg-[#0d9488]/20 file:text-teal-600 dark:file:text-[#0d9488]" />
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-500">New:</p>
                {attachments.map((f, i) => (
                  <div key={i} className="flex justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5">
                    <span className="text-sm truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                    <button type="button" onClick={() => removeNew(i)} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"><FaTrashAlt className="text-xs" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Updating...' : 'Update Task'}</button>
          </div>
        </form>
      </div>
    </div>
  );
});

// ─── Add Member Modal ────────────────────────────────────────────────
const AddMemberModal = React.memo(({ isOpen, onClose, workspace, project, brandColor, onSuccess }) => {
  const [memberId, setMemberId] = useState('');
  const [loading, setLoading] = useState(false);
  const [addTeamMember] = useAddTeamMemberMutation();

  const projectMemberIds = project.teamMembers?.filter(m => m.status === 'active').map(m => m.user?._id || m._id) || [];
  const available = workspace.members?.filter(m => m.status === 'active' && !projectMemberIds.includes(m.user?._id || m._id)) || [];
  const options = available.map(m => {
    const u = m.user || m;
    return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" /> : <FaUser className="text-gray-400" /> };
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!memberId) { toast.error('Select a member'); return; }
    setLoading(true);
    try {
      await addTeamMember({ projectId: project._id, userId: memberId, role: 'member' }).unwrap();
      toast.success('Member added');
      onSuccess();
      onClose();
    } catch (err) { toast.error(err?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaUserPlus className="inline mr-1 text-teal-600 dark:text-[#0d9488]" /> Add Member</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <CustomDropdown label="Select Member" options={options} value={memberId} onChange={setMemberId} placeholder="Select..." brandColor={brandColor} />
          {available.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">All workspace members already in project</p>}
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
            <button type="submit" disabled={loading || available.length === 0} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Adding...' : 'Add Member'}</button>
          </div>
        </form>
      </div>
    </div>
  );
});

// ─── Main Component ──────────────────────────────────────────────────
const YourWorkspaceProjectId = () => {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  // ─── All hooks unconditionally first ──────────────────────────────

  // States
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks');
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTaskTarget, setAssignTaskTarget] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [showReadOnlyModal, setShowReadOnlyModal] = useState(false);
  const [readOnlyFolder, setReadOnlyFolder] = useState(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    danger: false,
  });
  const [deleteTaskModal, setDeleteTaskModal] = useState({
    isOpen: false,
    taskName: '',
    onConfirm: () => {},
  });
  const [addManagerConfirm, setAddManagerConfirm] = useState({
    isOpen: false,
    managerName: '',
    managerId: '',
  });

  // Queries
  const { data: wData, isLoading: wLoad, error: wErr } = useGetWorkspaceQuery(workspaceId);
  const { data: pData, isLoading: pLoad, error: pErr, refetch: refetchProject } = useGetProjectByIdQuery(projectId);
  const { data: foldersData, isLoading: foldersLoading, refetch: refetchFolders } = useGetProjectFoldersQuery(projectId);
  const { data: tData, isLoading: tLoad, refetch: refetchTasks } = useGetProjectTasksQuery(
    { projectId, folderId: selectedFolderId || undefined }
  );
  const { data: feedbackData, isLoading: feedbackLoading } = useGetTaskFeedbackQuery(
    { taskId: selectedTaskId },
    { skip: !selectedTaskId }
  );

  // Mutations
  const [archiveProject] = useArchiveProjectMutation();
  const [unarchiveProject] = useUnarchiveProjectMutation();
  const [deleteProject] = useDeleteProjectMutation();
  const [restoreProject] = useRestoreProjectMutation();
  const [permanentlyDeleteProject] = usePermanentlyDeleteProjectMutation();
  const [deleteTask] = useDeleteTaskMutation();
  const [removeTeamMember] = useRemoveTeamMemberMutation();
  const [manageProjectManagers] = useManageProjectManagersMutation();
  const [sendManualReminder] = useSendManualReminderMutation();
  const [confirmTaskCompletion] = useConfirmTaskCompletionMutation();
  const [assignTask] = useAssignTaskMutation();
  const [reorderTasks] = useReorderTasksMutation();
  const [reorderSubTasks] = useReorderSubTasksMutation();

  // Local tasks for optimistic updates
  const [localTasks, setLocalTasks] = useState([]);
  useEffect(() => {
    setLocalTasks(tData?.tasks || []);
  }, [tData]);
  const tasks = localTasks;

  // Derived data
  const workspace = wData?.workspace;
  const project = pData?.project;
  const folders = foldersData?.folders || [];

  const activeTeam = useMemo(() => (project?.teamMembers || []).filter(m => m.status === 'active'), [project?.teamMembers]);
  const assignableMembers = useMemo(() => {
    if (!project) return [];
    const mgrs = project.projectManagers || [];
    const all = [...activeTeam, ...mgrs.map(pm => ({ user: pm }))];
    const seen = new Set();
    return all.filter(item => {
      const id = item.user?._id || item._id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [activeTeam, project?.projectManagers]);

  const brandColor = workspace?.color || '#0d9488';
  const isOwner = useMemo(() => workspace?.owner?._id === userInfo?._id || workspace?.owner === userInfo?._id, [workspace, userInfo]);
  const isManager = useMemo(() => project?.projectManagers?.some(pm => {
    const id = (pm._id || pm)?.toString();
    return id === userInfo?._id;
  }), [project, userInfo]);
  const canManage = isOwner || isManager;

  const activeTask = useMemo(() => tasks.find(t => t._id === selectedTaskId) || null, [tasks, selectedTaskId]);
  const projectManagers = project?.projectManagers || [];
  const projectProgress = project?.progress || 0;
  const isArchivedForMe = project?.isArchivedForMe || false;
  const isTrash = project?.isTrash || false;

  const availableForManager = useMemo(() => workspace?.members?.filter(m => m.status === 'active' && !projectManagers.some(pm => pm._id === (m.user?._id || m._id))) || [], [workspace, projectManagers]);
  const managerOptions = useMemo(() => availableForManager.map(m => {
    const u = m.user || m;
    return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" /> : <FaUser className="text-gray-400" /> };
  }), [availableForManager]);

  // ── Drag state ──
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [isDraggingTask, setIsDraggingTask] = useState(false);
  const [draggedSubIdx, setDraggedSubIdx] = useState(null);
  const [dragOverSubIdx, setDragOverSubIdx] = useState(null);

  // ── Handlers (useCallback) ──────────────────────────────────────────
  const refreshAll = useCallback(() => {
    refetchTasks();
    refetchProject();
    refetchFolders();
  }, [refetchTasks, refetchProject, refetchFolders]);

  const handleArchiveProject = useCallback(async () => {
    try {
      await archiveProject(projectId).unwrap();
      toast.success('Project archived for you.');
      refetchProject();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to archive');
    }
    setProjectMenuOpen(false);
  }, [archiveProject, projectId, refetchProject]);

  const handleUnarchiveProject = useCallback(async () => {
    try {
      await unarchiveProject(projectId).unwrap();
      toast.success('Project unarchived.');
      refetchProject();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to unarchive');
    }
    setProjectMenuOpen(false);
  }, [unarchiveProject, projectId, refetchProject]);

  const handleMoveToTrash = useCallback(() => {
    setConfirmModal({
      isOpen: true,
      title: 'Move to Trash',
      message: `Are you sure you want to move "${project.name}" to trash? This can be restored within 30 days.`,
      onConfirm: async () => {
        try {
          await deleteProject(projectId).unwrap();
          toast.success('Project moved to trash.');
          navigate(`/workspace/${workspaceId}/projects`);
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to move to trash');
        }
      },
      danger: false,
    });
    setProjectMenuOpen(false);
  }, [deleteProject, projectId, navigate, workspaceId, project?.name]);

  const handleRestoreProject = useCallback(() => {
    setConfirmModal({
      isOpen: true,
      title: 'Restore Project',
      message: `Are you sure you want to restore "${project.name}" from trash?`,
      onConfirm: async () => {
        try {
          await restoreProject(projectId).unwrap();
          toast.success('Project restored.');
          refetchProject();
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to restore');
        }
      },
      danger: false,
    });
    setProjectMenuOpen(false);
  }, [restoreProject, projectId, refetchProject, project?.name]);

  const handlePermanentDeleteProject = useCallback(() => {
    setConfirmModal({
      isOpen: true,
      title: 'Permanently Delete',
      message: `Are you sure you want to permanently delete "${project.name}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await permanentlyDeleteProject(projectId).unwrap();
          toast.success('Project permanently deleted.');
          navigate(`/workspace/${workspaceId}/projects`);
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to delete');
        }
      },
      danger: true,
    });
    setProjectMenuOpen(false);
  }, [permanentlyDeleteProject, projectId, navigate, workspaceId, project?.name]);

  const handleDeleteTask = useCallback((task) => {
    setDeleteTaskModal({
      isOpen: true,
      taskName: task.title,
      onConfirm: async () => {
        try {
          await deleteTask(task._id).unwrap();
          toast.success('Deleted');
          refetchTasks();
          refetchProject();
          if (selectedTaskId === task._id) {
            setSelectedTaskId(null);
            setMobileShowDetail(false);
          }
        } catch (e) {
          toast.error(e?.data?.message || 'Failed');
        }
      },
    });
  }, [deleteTask, refetchTasks, refetchProject, selectedTaskId]);

  const handleEditTask = useCallback((task) => { setSelectedTask(task); setShowEditTask(true); }, []);

  const handleRemoveMember = useCallback(async (id) => {
    if (!id) { toast.error('Invalid member ID'); return; }
    setConfirmModal({
      isOpen: true,
      title: 'Remove Member',
      message: 'Are you sure you want to remove this member from the project?',
      onConfirm: async () => {
        try {
          await removeTeamMember({ projectId, memberId: id }).unwrap();
          toast.success('Removed');
          refetchProject();
        } catch (e) {
          toast.error(e?.data?.message || 'Failed');
        }
      },
      danger: true,
    });
  }, [removeTeamMember, projectId, refetchProject]);

  const handleAddManager = useCallback((id, name) => {
    setAddManagerConfirm({ isOpen: true, managerName: name, managerId: id });
  }, []);

  const confirmAddManager = useCallback(async () => {
    try {
      await manageProjectManagers({ projectId, action: 'add', managerId: addManagerConfirm.managerId }).unwrap();
      toast.success('Manager added');
      refetchProject();
      setAddManagerConfirm({ isOpen: false, managerName: '', managerId: '' });
    } catch (e) {
      toast.error(e?.data?.message || 'Failed');
    }
  }, [manageProjectManagers, projectId, addManagerConfirm.managerId, refetchProject]);

  const handleRemoveManager = useCallback(async (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Manager',
      message: 'Are you sure you want to remove this manager?',
      onConfirm: async () => {
        try {
          await manageProjectManagers({ projectId, action: 'remove', managerId: id }).unwrap();
          toast.success('Manager removed');
          refetchProject();
        } catch (e) {
          toast.error(e?.data?.message || 'Failed');
        }
      },
      danger: true,
    });
  }, [manageProjectManagers, projectId, refetchProject]);

  const handleTaskClick = useCallback((taskId) => { setSelectedTaskId(taskId); setMobileShowDetail(true); }, []);
  const handleBackToList = useCallback(() => { setSelectedTaskId(null); setMobileShowDetail(false); }, []);

  const openSearchModal = useCallback(() => setSearchModalOpen(true), []);
  const closeSearchModal = useCallback(() => setSearchModalOpen(false), []);

  const searchItems = activeTab === 'tasks' ? tasks : activeTeam;
  const onSearchSelect = useCallback((id) => {
    if (activeTab === 'tasks') handleTaskClick(id);
  }, [activeTab, handleTaskClick]);

  const handleSendManualReminder = useCallback(async (task) => {
    try {
      await sendManualReminder({ taskId: task._id, message: '' }).unwrap();
      toast.success('Reminder sent to assignee');
    } catch (e) { toast.error(e?.data?.message || 'Failed to send reminder'); }
  }, [sendManualReminder]);

  const handleConfirmCompletion = useCallback((taskId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Completion',
      message: 'Are you sure you want to confirm completion of this task?',
      onConfirm: async () => {
        try {
          await confirmTaskCompletion({ taskId }).unwrap();
          toast.success('Task completion confirmed');
          refreshAll();
        } catch (e) {
          toast.error(e?.data?.message || 'Failed');
        }
      },
      danger: false,
    });
  }, [confirmTaskCompletion, refreshAll]);

  const handleAssignTask = useCallback(async (assigneeId) => {
    try {
      await assignTask({ taskId: assignTaskTarget._id, assigneeId }).unwrap();
      toast.success('Task assigned successfully');
      refreshAll();
      setShowAssignModal(false);
      setAssignTaskTarget(null);
    } catch (err) {
      throw err;
    }
  }, [assignTask, assignTaskTarget, refreshAll]);

  const openAssignModal = useCallback((task) => {
    setAssignTaskTarget(task);
    setShowAssignModal(true);
  }, []);

  const handleCreateFolder = useCallback(() => {
    setEditingFolder(null);
    setShowFolderForm(true);
  }, []);

  const handleEditFolder = useCallback((folder) => {
    setEditingFolder(folder);
    setShowFolderForm(true);
  }, []);

  const handleDeleteFolder = useCallback(async (folder) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Folder',
      message: `Are you sure you want to delete folder "${folder.name}"? Tasks will be unlinked but not deleted.`,
      onConfirm: async () => {
        try {
          await useDeleteFolderMutation()[0](folder._id).unwrap();
          toast.success('Folder deleted');
          refetchFolders();
          refetchTasks();
          if (selectedFolderId === folder._id) setSelectedFolderId(null);
        } catch (e) {
          toast.error(e?.data?.message || 'Failed');
        }
      },
      danger: true,
    });
  }, [refetchFolders, refetchTasks, selectedFolderId]);

  const handleManageReadOnly = useCallback((folder) => {
    setReadOnlyFolder(folder);
    setShowReadOnlyModal(true);
  }, []);

  const handleFolderSelect = useCallback((folderId) => {
    setSelectedFolderId(folderId === selectedFolderId ? null : folderId);
    setSelectedTaskId(null);
    setMobileShowDetail(false);
  }, [selectedFolderId]);

  // ── Task reordering ──
  const canReorderTasks = canManage && !isTrash && !isArchivedForMe;

  const handleTaskDragStart = useCallback((e, task) => {
    if (!canReorderTasks) {
      e.preventDefault();
      toast.error('You do not have permission to reorder tasks.');
      return;
    }
    setDraggedTaskId(task._id);
    setIsDraggingTask(true);
    e.dataTransfer.setData('text/plain', task._id);
    e.dataTransfer.effectAllowed = 'move';
  }, [canReorderTasks]);

  const handleTaskDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setIsDraggingTask(false);
  }, []);

  const handleTaskDragOver = useCallback((e, task) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedTaskId && draggedTaskId !== task._id) {
      setDragOverTaskId(task._id);
    }
  }, [draggedTaskId]);

  const handleTaskDragLeave = useCallback(() => {
    setDragOverTaskId(null);
  }, []);

  const handleTaskDrop = useCallback(async (e, targetTask) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!draggedId || draggedId === targetTask._id) {
      setDragOverTaskId(null);
      return;
    }
    setDragOverTaskId(null);

    const previousTasks = tasks;
    const draggedIdx = previousTasks.findIndex(t => t._id === draggedId);
    const targetIdx = previousTasks.findIndex(t => t._id === targetTask._id);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const newOrder = [...previousTasks];
    const [moved] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, moved);
    const orderedIds = newOrder.map(t => t._id);

    setLocalTasks(newOrder);
    setDraggedTaskId(null);
    setIsDraggingTask(false);

    try {
      await reorderTasks({ projectId, orderedTaskIds: orderedIds }).unwrap();
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to reorder tasks');
      setLocalTasks(previousTasks);
    }
  }, [draggedTaskId, tasks, reorderTasks, projectId, refetchTasks]);

  // ── Sub‑task reordering ──
  const canReorderSub = useCallback((task) => {
    return !isTrash && !isArchivedForMe && !task.isArchived && (canManage || (task.assignee?._id === userInfo?._id && task.allowAssigneeEditSubtasks));
  }, [isTrash, isArchivedForMe, canManage, userInfo]);

  const handleSubDragStart = useCallback((e, index) => {
    if (!activeTask) return;
    if (!canReorderSub(activeTask)) {
      e.preventDefault();
      toast.error('You do not have permission to reorder sub‑tasks.');
      return;
    }
    setDraggedSubIdx(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  }, [activeTask, canReorderSub]);

  const handleSubDragEnd = useCallback(() => {
    setDraggedSubIdx(null);
    setDragOverSubIdx(null);
  }, []);

  const handleSubDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedSubIdx !== null && draggedSubIdx !== index) {
      setDragOverSubIdx(index);
    }
  }, [draggedSubIdx]);

  const handleSubDragLeave = useCallback(() => {
    setDragOverSubIdx(null);
  }, []);

  const handleSubDrop = useCallback(async (e, targetIndex) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    const draggedIdx = raw !== '' ? parseInt(raw, 10) : draggedSubIdx;

    if (draggedIdx === null || draggedIdx === undefined || Number.isNaN(draggedIdx) || draggedIdx === targetIndex) {
      setDragOverSubIdx(null);
      return;
    }
    setDragOverSubIdx(null);
    if (!activeTask) return;
    const subtasks = activeTask.subTasks || [];
    if (draggedIdx < 0 || targetIndex < 0 || draggedIdx >= subtasks.length || targetIndex >= subtasks.length) return;

    const previousTasks = tasks;
    const newSubTasks = [...subtasks];
    const [movedSub] = newSubTasks.splice(draggedIdx, 1);
    newSubTasks.splice(targetIndex, 0, movedSub);

    const indices = subtasks.map((_, i) => i);
    const [movedIdx] = indices.splice(draggedIdx, 1);
    indices.splice(targetIndex, 0, movedIdx);
    const orderedSubTaskIndices = indices;

    const optimisticTasks = previousTasks.map(t =>
      t._id === activeTask._id ? { ...t, subTasks: newSubTasks } : t
    );
    setLocalTasks(optimisticTasks);
    setDraggedSubIdx(null);

    try {
      await reorderSubTasks({ taskId: activeTask._id, orderedSubTaskIndices }).unwrap();
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to reorder sub‑tasks');
      setLocalTasks(previousTasks);
    }
  }, [draggedSubIdx, activeTask, tasks, reorderSubTasks, refetchTasks]);

  // ─── Early returns AFTER all hooks ─────────────────────────────────
  if (wErr || pErr) { navigate(`/workspace/${workspaceId}/projects`); return null; }
  if (wLoad || pLoad || tLoad || foldersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: brandColor }} />
      </div>
    );
  }
  if (!workspace || !project) return null;

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <YourWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-4 h-14 lg:h-16">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate(`/workspace/${workspaceId}/projects`)} className="p-1 lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"><FaArrowLeft /></button>
              <div className="flex items-center gap-3">
                {project.coverImage ? (
                  <img src={project.coverImage} className="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700/60" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: brandColor }}>
                    <FaFolder className="text-lg" />
                  </div>
                )}
                <div>
                  <h1 className="text-base font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[150px] md:max-w-xs flex items-center gap-2">
                    {project.name}
                    {isArchivedForMe && (
                      <span className="text-xs font-normal text-gray-400 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/40 px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-700/40">
                        Archived
                      </span>
                    )}
                    {isTrash && (
                      <span className="text-xs font-normal text-red-400 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full border border-red-300 dark:border-red-700/40">
                        Trash
                      </span>
                    )}
                  </h1>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{activeTeam.length} members</span>
                    <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                    <span>{projectProgress}% done</span>
                    {selectedFolderId && (
                      <>
                        <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                        <span className="text-teal-600 dark:text-[#0d9488] flex items-center gap-1">
                          <FaFolder className="text-[10px]" /> {folders.find(f => f._id === selectedFolderId)?.name || 'Folder'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={openSearchModal} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"><FaSearch /></button>
              {canManage && !isTrash && !isArchivedForMe && (
                <button onClick={() => activeTab === 'tasks' ? setShowCreateTask(true) : setShowAddMember(true)} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"><FaPlus /></button>
              )}
              <div className="relative">
                <button
                  onClick={() => setProjectMenuOpen(!projectMenuOpen)}
                  className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"
                >
                  <FaEllipsisV className="text-sm" />
                </button>
                {projectMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-800/60 rounded-xl min-w-[180px] z-20 py-1 shadow-lg">
                    {!isTrash && (
                      isArchivedForMe ? (
                        <button onClick={handleUnarchiveProject} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 w-full transition">
                          <FaUndo className="text-xs text-teal-500 dark:text-[#0d9488]" /> Unarchive
                        </button>
                      ) : (
                        <button onClick={handleArchiveProject} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 w-full transition">
                          <FaArchive className="text-xs text-gray-500" /> Archive
                        </button>
                      )
                    )}
                    {isOwner && (
                      <>
                        <div className="border-t border-gray-200 dark:border-gray-700/60 my-1" />
                        {isTrash ? (
                          <>
                            <button onClick={handleRestoreProject} className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 w-full transition">
                              <FaTrashRestore className="text-xs" /> Restore
                            </button>
                            <button onClick={handlePermanentDeleteProject} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 w-full transition">
                              <FaTrashAlt className="text-xs" /> Delete Permanently
                            </button>
                          </>
                        ) : (
                          !isArchivedForMe && (
                            <button onClick={handleMoveToTrash} className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 w-full transition">
                              <FaTrashAlt className="text-xs" /> Move to Trash
                            </button>
                          )
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-6 px-4 border-t border-gray-200/60 dark:border-gray-800/30">
            <button
              onClick={() => { setActiveTab('tasks'); setMobileShowDetail(false); setSelectedTaskId(null); }}
              className={`pb-2 text-sm font-medium transition ${
                activeTab === 'tasks'
                  ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Tasks ({tasks.length})
            </button>
            <button
              onClick={() => { setActiveTab('team'); setMobileShowDetail(false); setSelectedTaskId(null); }}
              className={`pb-2 text-sm font-medium transition ${
                activeTab === 'team'
                  ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Team ({activeTeam.length})
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className={`${mobileShowDetail ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-2/5 lg:w-1/3 border-r border-gray-200/60 dark:border-gray-800/40 bg-white dark:bg-[#0f0f12] h-full`}>
            {activeTab === 'tasks' && (
              <div className="border-b border-gray-200/60 dark:border-gray-800/30 px-3 py-2 bg-gray-50 dark:bg-[#14141a]/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Folders</span>
                  {canManage && !isTrash && !isArchivedForMe && (
                    <button onClick={handleCreateFolder} className="text-xs text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] transition font-medium flex items-center gap-1">
                      <FaPlus className="text-[10px]" /> New
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleFolderSelect(null)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      !selectedFolderId
                        ? 'bg-teal-600 dark:bg-[#0d9488] text-white border-teal-600 dark:border-[#0d9488]'
                        : 'bg-gray-100 dark:bg-[#1e1e26] border-gray-300 dark:border-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800/30'
                    }`}
                  >
                    All
                  </button>
                  {folders.map(f => (
                    <div key={f._id} className="relative group flex items-center">
                      <button
                        onClick={() => handleFolderSelect(f._id)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1 ${
                          selectedFolderId === f._id
                            ? 'bg-teal-600 dark:bg-[#0d9488] text-white border-teal-600 dark:border-[#0d9488]'
                            : 'bg-gray-100 dark:bg-[#1e1e26] border-gray-300 dark:border-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800/30'
                        }`}
                      >
                        <FaFolder className="text-[10px]" />
                        {f.name}
                      </button>
                      {canManage && !isTrash && !isArchivedForMe && (
                        <div className="hidden group-hover:flex items-center gap-0.5 ml-0.5">
                          <button onClick={(e) => { e.stopPropagation(); handleEditFolder(f); }} className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition">
                            <FaEdit className="text-[8px]" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleManageReadOnly(f); }} className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-teal-500 dark:hover:text-teal-400 transition">
                            <FaUserLock className="text-[8px]" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f); }} className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition">
                            <FaTrashAlt className="text-[8px]" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'tasks' ? (
                tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                    <FaTasks className="text-4xl mb-2 opacity-30" />
                    <p className="text-sm">No tasks {selectedFolderId ? 'in this folder' : 'yet'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {tasks.map(task => (
                      <TaskCard
                        key={task._id}
                        task={task}
                        onClick={() => handleTaskClick(task._id)}
                        brandColor={brandColor}
                        isActive={selectedTaskId === task._id}
                        draggable={canReorderTasks && !task.isArchived}
                        onDragStart={handleTaskDragStart}
                        onDragEnd={handleTaskDragEnd}
                        onDragOver={handleTaskDragOver}
                        onDragLeave={handleTaskDragLeave}
                        onDrop={handleTaskDrop}
                        dragOver={dragOverTaskId === task._id}
                      />
                    ))}
                  </div>
                )
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800/30">
                  <div className="py-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1">
                        <FaCrown className="text-yellow-500 dark:text-yellow-400" /> Managers
                      </span>
                      {isOwner && !isTrash && !isArchivedForMe && (
                        <button onClick={() => setShowAddManager(true)} className="text-xs text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] transition font-medium">
                          Add
                        </button>
                      )}
                    </div>
                    {projectManagers.map(m => (
                      <div key={m._id} className="flex items-center gap-3 py-2 group">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: brandColor }}>
                          {m.profile ? <img src={m.profile} className="w-full h-full rounded-full object-cover" /> : m.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{m.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{m.email}</p>
                        </div>
                        {isOwner && projectManagers.length > 1 && !isTrash && !isArchivedForMe && (
                          <button onClick={() => handleRemoveManager(m._id)} className="p-1 text-red-500 dark:text-red-400 opacity-0 group-hover:opacity-100 transition">
                            <FaUserMinus className="text-sm" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="py-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1">
                        <FaUsers className="text-teal-600 dark:text-[#0d9488]" /> Team ({activeTeam.length})
                      </span>
                      {canManage && !isTrash && !isArchivedForMe && (
                        <button onClick={() => setShowAddMember(true)} className="text-xs text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] transition font-medium">
                          Add
                        </button>
                      )}
                    </div>
                    {activeTeam.map(m => {
                      const user = m.user || m;
                      const memberId = user._id;
                      return (
                        <div key={memberId} className="flex items-center gap-3 py-2 group">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: brandColor }}>
                            {user.profile ? <img src={user.profile} className="w-full h-full rounded-full object-cover" /> : user.name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{user.name || 'Unknown'}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{user.email}</p>
                          </div>
                          {canManage && !isTrash && !isArchivedForMe && (
                            <button onClick={() => handleRemoveMember(memberId)} className="p-1 text-red-500 dark:text-red-400 opacity-0 group-hover:opacity-100 transition">
                              <FaUserMinus className="text-sm" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={`${mobileShowDetail ? 'flex' : 'hidden md:flex'} flex-col flex-1 h-full bg-gray-50 dark:bg-[#0f0f12]`}>
            {activeTask ? (
              <TaskDetailView
                task={activeTask}
                brandColor={brandColor}
                feedbackData={feedbackData}
                isLoading={feedbackLoading}
                userInfo={userInfo}
                onBack={handleBackToList}
                onEdit={handleEditTask}
                onDelete={() => handleDeleteTask(activeTask)}
                onRefresh={refreshAll}
                canManage={canManage}
                onSendReminder={handleSendManualReminder}
                onConfirmCompletion={() => handleConfirmCompletion(activeTask._id)}
                onAssignTask={openAssignModal}
                subDragStart={handleSubDragStart}
                subDragEnd={handleSubDragEnd}
                subDragOver={handleSubDragOver}
                subDrop={handleSubDrop}
                subDragLeave={handleSubDragLeave}
                subDragOverIndex={dragOverSubIdx}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
                <div className="text-center">
                  <FaCommentDots className="text-5xl mx-auto mb-4 opacity-30" style={{ color: brandColor }} />
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Select a task</p>
                  <p className="text-sm mt-1 text-gray-500 dark:text-gray-400">Sub‑tasks and details will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!mobileShowDetail && <YourWorkspaceBottombar workspace={workspace} />}

      {/* Modals */}
      <SearchModal
        isOpen={searchModalOpen}
        onClose={closeSearchModal}
        items={searchItems}
        type={activeTab}
        brandColor={brandColor}
        onSelect={onSearchSelect}
      />
      <CreateTaskModal
        isOpen={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        projectId={projectId}
        brandColor={brandColor}
        assignableMembers={assignableMembers}
        folders={folders}
        onSuccess={() => { refetchTasks(); refetchProject(); refetchFolders(); }}
      />
      <EditTaskModal
        key={selectedTask?._id}
        isOpen={showEditTask}
        onClose={() => {
          setShowEditTask(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        brandColor={brandColor}
        assignableMembers={assignableMembers}
        folders={folders}
        onSuccess={() => { refetchTasks(); refetchProject(); refetchFolders(); }}
      />
      <AddMemberModal
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        workspace={workspace}
        project={project}
        brandColor={brandColor}
        onSuccess={refetchProject}
      />
      {showAddManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Add Manager</h2>
              <button onClick={() => setShowAddManager(false)} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <CustomDropdown
              label="Select Member"
              options={managerOptions}
              value=""
              onChange={(v) => {
                if (v) {
                  const selected = availableForManager.find(m => (m.user?._id || m._id) === v);
                  if (selected) {
                    const name = selected.user?.name || selected.name || 'Unknown';
                    handleAddManager(v, name);
                    setShowAddManager(false);
                  }
                }
              }}
              brandColor={brandColor}
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAddManager(false)} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
      <AssignTaskModal
        isOpen={showAssignModal}
        onClose={() => { setShowAssignModal(false); setAssignTaskTarget(null); }}
        task={assignTaskTarget}
        assignableMembers={assignableMembers}
        brandColor={brandColor}
        onAssign={handleAssignTask}
      />

      <FolderFormModal
        isOpen={showFolderForm}
        onClose={() => { setShowFolderForm(false); setEditingFolder(null); }}
        onSuccess={() => { refetchFolders(); }}
        folder={editingFolder}
        brandColor={brandColor}
        projectId={projectId}
      />
      <FolderReadOnlyModal
        isOpen={showReadOnlyModal}
        onClose={() => { setShowReadOnlyModal(false); setReadOnlyFolder(null); }}
        folder={readOnlyFolder}
        project={project}
        brandColor={brandColor}
        onSuccess={() => { refetchFolders(); }}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
      />
      <DeleteTaskConfirmModal
        isOpen={deleteTaskModal.isOpen}
        onClose={() => setDeleteTaskModal({ isOpen: false, taskName: '', onConfirm: () => {} })}
        onConfirm={deleteTaskModal.onConfirm}
        taskName={deleteTaskModal.taskName}
      />
      <ConfirmModal
        isOpen={addManagerConfirm.isOpen}
        onClose={() => setAddManagerConfirm({ isOpen: false, managerName: '', managerId: '' })}
        onConfirm={confirmAddManager}
        title="Add Manager"
        message={`Are you sure you want to add ${addManagerConfirm.managerName} as manager?`}
        danger={false}
      />
    </div>
  );
};

export default YourWorkspaceProjectId;
// src/workspaceScreens/MyWorkspaceProjectId.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import {
  useGetProjectByIdQuery,
  useManageProjectManagersMutation,
  useAddTeamMemberMutation,
  useRemoveTeamMemberMutation,
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
  useGetProjectFoldersQuery,
  useCreateFolderMutation,
  useUpdateFolderMutation,
  useDeleteFolderMutation,
  useCopyTaskMutation,
  useMoveTaskMutation,
  useArchiveTaskMutation,
  useRestoreTaskMutation,
  usePermanentlyDeleteTaskMutation,
  useAddFolderReadOnlyMutation,
  useRemoveFolderReadOnlyMutation,
} from '../slices/taskApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
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
  FaCopy,
  FaPen,
  FaGripVertical,
  FaLock,
  FaLockOpen,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// ─── Helpers ──────────────────────────────────────────────────────────
const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Display "(copy)" at front if title ends with " (copy)"
const formatTaskTitle = (title) => {
  if (title && title.endsWith(' (copy)')) {
    return `(copy) ${title.slice(0, -7)}`;
  }
  return title;
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

// ─── Badges ──────────────────────────────────────────────────────────
const TaskStatusBadge = ({ status }) => {
  const map = {
    pending: { label: 'Pending', color: 'bg-gray-200 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700' },
    'in-progress': { label: 'In Progress', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700/50' },
    ready_for_completion: { label: 'Ready', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700/50' },
    completed: { label: 'Completed', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700/50' },
    confirmed_completed: { label: 'Confirmed', color: 'bg-green-200 dark:bg-green-800/50 text-green-800 dark:text-green-200 border-green-400 dark:border-green-600/50' },
  };
  const s = map[status] || map.pending;
  return <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>;
};

const TaskPriorityBadge = ({ priority }) => {
  const map = {
    low: { label: 'Low', color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700/40' },
    medium: { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700/40' },
    high: { label: 'High', color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700/40' },
    urgent: { label: 'Urgent', color: 'text-red-700 dark:text-red-500 bg-red-200 dark:bg-red-900/30 border-red-400 dark:border-red-700/50' },
  };
  const p = map[priority] || map.medium;
  return <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${p.color}`}>{p.label}</span>;
};

// ─── Custom Dropdown ───────────────────────────────────────────────────
const CustomDropdown = ({ options, value, onChange, placeholder, label, brandColor }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const selected = options.find(o => o.value === value);
  return (
    <div className="relative" ref={ref}>
      {label && <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0d9488] text-sm bg-white dark:bg-[#1a1a24] text-gray-800 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600 transition"
      >
        <span className={selected ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
          {selected ? selected.label : placeholder || 'Select...'}
        </span>
        <FaAngleDown className={`text-gray-500 dark:text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#1e1e26] border border-gray-300 dark:border-gray-700/60 rounded-xl overflow-hidden max-h-60 overflow-y-auto shadow-lg">
          {options.map(o => (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#0d9488]/10 transition text-left text-gray-700 dark:text-gray-300 ${o.value === value ? 'bg-[#0d9488]/10' : ''}`}
            >
              {o.icon && <span className="text-gray-500 dark:text-gray-400">{o.icon}</span>}
              <span>{o.label}</span>
              {o.value === value && <FaCheck className="ml-auto text-xs" style={{ color: brandColor }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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
const taskTypeOptions = [
  { value: 'general', label: 'General' },
  { value: 'feature', label: 'Feature' },
  { value: 'bug', label: 'Bug' },
  { value: 'improvement', label: 'Improvement' },
];

// ─── Modals ──────────────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) => {
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
            className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0d9488] hover:bg-[#0f9e96]'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const DeleteTaskConfirmModal = ({ isOpen, onClose, onConfirm, taskName }) => {
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
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">This action cannot be undone. Type the following to confirm:</p>
        <div className="bg-gray-100 dark:bg-[#0b0b10] p-3 rounded-xl border border-gray-300 dark:border-gray-700/60 mb-4">
          <code className="text-sm text-gray-800 dark:text-gray-200 font-mono">{expectedPhrase}</code>
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type the phrase above"
          className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none mb-4"
        />
        <div className="flex gap-3">
          <button onClick={() => { onClose(); setInputValue(''); }} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button onClick={handleConfirm} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition">Delete</button>
        </div>
      </div>
    </div>
  );
};

// ─── Folder Select Modal (Copy / Move) ────────────────────────────────
const FolderSelectModal = ({ isOpen, onClose, folders, mode, task, onConfirm, brandColor }) => {
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedFolderId(null);
    }
  }, [isOpen, task]);

  if (!isOpen) return null;

  const options = [
    { value: null, label: 'All Tasks (No Folder)', icon: <FaTasks className="text-gray-400" /> },
    ...folders.map(f => ({ value: f._id, label: f.name, icon: <FaFolder className="text-gray-400" /> })),
  ];

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(task._id, selectedFolderId);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            {mode === 'copy' ? <FaCopy className="text-[#0d9488]" /> : <FaFolder className="text-[#0d9488]" />}
            {mode === 'copy' ? 'Copy Task' : 'Move Task'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {mode === 'copy' ? 'Copy' : 'Move'} <span className="font-medium text-gray-800 dark:text-gray-200">"{task?.title}"</span> to:
        </p>
        <CustomDropdown label="Destination folder" options={options} value={selectedFolderId} onChange={setSelectedFolderId} brandColor={brandColor} />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80"
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? (mode === 'copy' ? 'Copying...' : 'Moving...') : (mode === 'copy' ? 'Copy' : 'Move')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Folder Access Management Modal ──────────────────────────────────
const FolderAccessModal = ({ isOpen, onClose, folder, projectMembers, currentUserId, initialAccessUsers, onSave, brandColor }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && folder) {
      // initialAccessUsers is an array of user IDs currently having read‑only access
      setSelectedIds(initialAccessUsers || []);
    }
  }, [isOpen, folder, initialAccessUsers]);

  if (!isOpen) return null;

  const toggleMember = (userId) => {
    setSelectedIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await onSave(folder._id, selectedIds);
      onClose();
    } catch (error) {
      toast.error('Failed to update folder access.');
    } finally {
      setSubmitting(false);
    }
  };

  // Exclude current user and non‑active members
  const members = projectMembers.filter(m => {
    const id = m.user?._id || m._id;
    return id !== currentUserId && m.status === 'active';
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <FaLockOpen className="text-[#0d9488]" />
            Folder Access: {folder?.name}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Grant read‑only access to this folder for team members. They will see all tasks in this folder even if not assigned.
        </p>
        {members.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-500">No other active members to manage.</p>
        ) : (
          <div className="space-y-2">
            {members.map(m => {
              const user = m.user || m;
              const id = user._id;
              const name = user.name || 'Unknown';
              const checked = selectedIds.includes(id);
              return (
                <label key={id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/30 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMember(id)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-[#0d9488] focus:ring-[#0d9488]"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{name}</span>
                  {checked && <span className="ml-auto text-xs text-[#0d9488]">Read‑only</span>}
                </label>
              );
            })}
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80"
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? 'Saving...' : 'Save Access'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Task Card ──────────────────────────────────────────────────────────
const TaskCard = ({ task, onClick, brandColor, isActive, draggable, onDragStart, onDragEnd, onCopyClick, onMoveClick, readOnly, showArchived }) => {
  const progress = task.progress || 0;
  const subTaskCount = task.subTasks?.length || 0;
  const confirmedCount = (task.subTasks || []).filter(st => st.status === 'confirmed').length || 0;
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = due && due < new Date() && task.status !== 'completed' && task.status !== 'confirmed_completed';
  const assignee = task.assignee;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayTitle = formatTaskTitle(task.title);

  return (
    <div
      draggable={draggable && !readOnly && !showArchived}
      onDragStart={(e) => !readOnly && !showArchived && onDragStart && onDragStart(e, task)}
      onDragEnd={(e) => !readOnly && !showArchived && onDragEnd && onDragEnd(e, task)}
      onClick={() => onClick(task._id)}
      className={`group relative bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/40 hover:border-[#0d9488]/50 transition-all duration-300 cursor-pointer overflow-hidden ${
        isActive ? 'border-[#0d9488] shadow-[0_0_20px_rgba(13,148,136,0.15)]' : ''
      } ${draggable && !readOnly && !showArchived ? 'active:cursor-grabbing' : ''} ${readOnly || showArchived ? 'opacity-80' : ''}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {draggable && !readOnly && !showArchived && (
              <FaGripVertical className="text-gray-300 dark:text-gray-700 text-xs flex-shrink-0 cursor-grab" />
            )}
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: brandColor }}>
              {task.title.charAt(0).toUpperCase()}
            </div>
            <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-gray-900 dark:group-hover:text-white transition">
              {displayTitle}
            </h4>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <TaskStatusBadge status={task.status} />
            {task.isArchived && (
              <span className="text-[10px] text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full border border-orange-300 dark:border-orange-700/50 flex items-center gap-1">
                <FaArchive className="text-[8px]" /> Archived
              </span>
            )}
            {!readOnly && !showArchived && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                  className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition"
                >
                  <FaEllipsisV className="text-xs" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-800/60 rounded-xl min-w-[150px] z-20 py-1 shadow-lg">
                    {!task.isArchived ? (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onCopyClick(task); }}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 w-full transition"
                        >
                          <FaCopy className="text-xs" /> Copy to...
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onMoveClick(task); }}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 w-full transition"
                        >
                          <FaFolder className="text-xs" /> Move to...
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuOpen(false); /* call unarchive */ }}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/10 w-full transition"
                        >
                          <FaUndo className="text-xs" /> Unarchive
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuOpen(false); /* call permanent delete */ }}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 w-full transition"
                        >
                          <FaTrashAlt className="text-xs" /> Delete Permanently
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <TaskPriorityBadge priority={task.priority} />
          {subTaskCount > 0 && (
            <span className="text-[10px] text-gray-500 dark:text-gray-500">• {confirmedCount}/{subTaskCount} done</span>
          )}
          {isOverdue && !task.isArchived && (
            <span className="text-[10px] text-red-400 flex items-center gap-1"><FaClock className="text-[8px]" /> Overdue</span>
          )}
          {readOnly && (
            <span className="text-[10px] text-blue-400 flex items-center gap-1"><FaLock className="text-[8px]" /> Read‑only</span>
          )}
        </div>
        {task.description && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-500">{assignee ? `${assignee.name}` : 'Unassigned'}</span>
          <span className="text-xs text-gray-500 dark:text-gray-500">{task.dueDate ? formatDateTime(task.dueDate) : 'No due'}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800/60 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: brandColor }} />
          </div>
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{progress}%</span>
        </div>
      </div>
    </div>
  );
};

// ─── Sub‑task Item ──────────────────────────────────────────────────────
const SubTaskItem = ({ subTask, index, taskId, isAssignee, canManage, onRefresh, brandColor, readOnly }) => {
  const [markDone] = useMarkSubTaskDoneMutation();
  const [confirmSub] = useConfirmSubTaskMutation();
  const [rejectSub] = useRejectSubTaskMutation();
  const [deleteSub] = useDeleteSubTaskMutation();
  const [updating, setUpdating] = useState(false);
  const [showDoneForm, setShowDoneForm] = useState(false);
  const [doneNotes, setDoneNotes] = useState('');
  const [doneLinks, setDoneLinks] = useState('');
  const [doneFiles, setDoneFiles] = useState([]);
  const fileInputRef = useRef(null);
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [confirmFeedback, setConfirmFeedback] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const hasDetails = subTask.notes || (subTask.links && subTask.links.length > 0) || (subTask.attachments && subTask.attachments.length > 0) || subTask.feedback || subTask.rejectedBy;

  const handleMarkDone = () => { if (!readOnly && subTask.status !== 'done' && subTask.status !== 'confirmed') setShowDoneForm(true); };
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
      setDoneNotes(''); setDoneLinks(''); setDoneFiles([]);
      onRefresh();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setUpdating(false); }
  };
  const cancelDone = () => { setShowDoneForm(false); setDoneNotes(''); setDoneLinks(''); setDoneFiles([]); };
  const handleConfirmClick = () => { if (!readOnly) setShowConfirmForm(true); };
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
  const cancelConfirm = () => { setShowConfirmForm(false); setConfirmFeedback(''); };
  const handleRejectClick = () => { if (!readOnly) setShowRejectModal(true); };
  const handleRejectConfirm = async (reason) => {
    setUpdating(true);
    try {
      await rejectSub({ taskId, subTaskIndex: index, reason }).unwrap();
      toast.success('Sub‑task rejected');
      setShowRejectModal(false);
      setRejectReason('');
      onRefresh();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setUpdating(false); }
  };
  const handleDelete = async () => {
    if (readOnly) return;
    if (!window.confirm('Delete this sub‑task?')) return;
    setUpdating(true);
    try {
      await deleteSub({ taskId, subTaskIndex: index }).unwrap();
      toast.success('Sub‑task deleted');
      onRefresh();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setUpdating(false); }
  };

  const statusMap = {
    pending: { label: 'Pending', color: 'text-gray-500 dark:text-gray-400' },
    done: { label: 'Done', color: 'text-blue-600 dark:text-blue-400' },
    confirmed: { label: 'Confirmed', color: 'text-green-600 dark:text-green-400' },
  };
  const st = statusMap[subTask.status] || statusMap.pending;

  return (
    <>
      <div className="flex flex-col py-2 border-b border-gray-100 dark:border-gray-800/20 last:border-0">
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-300">{subTask.title}</span>
              <span className={`text-[10px] font-medium ${st.color}`}>{st.label}</span>
              {subTask.dueDate && new Date(subTask.dueDate) < new Date() && subTask.status !== 'confirmed' && (
                <span className="text-[10px] text-red-400 flex items-center gap-1"><FaClock className="text-[8px]" /> Overdue</span>
              )}
            </div>
            {subTask.description && <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{subTask.description}</p>}
            {subTask.dueDate && <p className="text-[10px] text-gray-500 dark:text-gray-500 flex items-center gap-1"><FaRegClock className="text-xs" /> {formatDateTime(subTask.dueDate)}</p>}
          </div>
          {hasDetails && (
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 text-gray-500 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition flex-shrink-0">
              <FaAngleDown className={`text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-1 mt-1 sm:mt-0 sm:ml-auto sm:flex-nowrap">
            {isAssignee && subTask.status === 'pending' && (
              <button onClick={handleMarkDone} disabled={updating} className="p-1 text-blue-500 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/10 rounded-lg transition">
                <FaCheck className="text-xs" />
              </button>
            )}
            {canManage && subTask.status === 'done' && (
              <>
                <button onClick={handleConfirmClick} disabled={updating} className="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/10 rounded-lg transition">
                  <FaCheckDouble className="text-xs" />
                </button>
                <button onClick={handleRejectClick} disabled={updating} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 rounded-lg transition">
                  <FaTimes className="text-xs" />
                </button>
              </>
            )}
            {(isAssignee && subTask.status !== 'confirmed') || canManage ? (
              <button onClick={handleDelete} disabled={updating} className="p-1 text-red-400/60 hover:bg-red-100 dark:hover:bg-red-500/10 rounded-lg transition">
                <FaTrashAlt className="text-xs" />
              </button>
            ) : null}
          </div>
        )}
        {isExpanded && (
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-1 bg-gray-100 dark:bg-[#1a1a24] p-3 rounded-xl border border-gray-200 dark:border-gray-800/40 w-full overflow-hidden">
            {subTask.notes && <div><span className="font-medium text-gray-700 dark:text-gray-300">Notes:</span> {subTask.notes}</div>}
            {subTask.links && subTask.links.length > 0 && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Links:</span>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {subTask.links.map((l, i) => (
                    <React.Fragment key={i}>
                      <a href={l} target="_blank" rel="noopener noreferrer" className="text-[#0d9488] underline hover:text-[#14b8a6] break-all">{l}</a>
                      {i < subTask.links.length - 1 && <span className="text-gray-500">,</span>}
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
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[#0d9488] underline hover:text-[#14b8a6] break-all">{att.name || 'file'}</a>
                      {i < subTask.attachments.length - 1 && <span className="text-gray-500">,</span>}
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

        {showDoneForm && !readOnly && (
          <div className="mt-2 bg-gray-100 dark:bg-[#1a1a24] border border-gray-300 dark:border-gray-800/60 rounded-xl p-3 w-full">
            <textarea placeholder="Add notes (optional)" value={doneNotes} onChange={(e) => setDoneNotes(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-[#0d9488] outline-none mb-2" />
            <textarea placeholder="Links (one per line)" value={doneLinks} onChange={(e) => setDoneLinks(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-[#0d9488] outline-none mb-2" />
            <div className="flex items-center gap-2 mb-2">
              <input type="file" multiple ref={fileInputRef} onChange={(e) => setDoneFiles([...e.target.files])} className="text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#0d9488]/20 file:text-[#0d9488]" />
              {doneFiles.length > 0 && <span className="text-xs text-gray-500 dark:text-gray-500">{doneFiles.length} file(s)</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={submitDone} disabled={updating} className="px-3 py-1.5 bg-[#0d9488] text-white text-xs rounded-lg hover:bg-[#0f9e96] transition">{updating ? 'Saving...' : 'Submit Done'}</button>
              <button onClick={cancelDone} className="px-3 py-1.5 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition">Cancel</button>
            </div>
          </div>
        )}

        {showConfirmForm && !readOnly && (
          <div className="mt-2 bg-gray-100 dark:bg-[#1a1a24] border border-gray-300 dark:border-gray-800/60 rounded-xl p-3 w-full">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Assignee submitted:</p>
            {subTask.notes && <div className="text-xs text-gray-600 dark:text-gray-400 mb-1"><span className="font-medium text-gray-700 dark:text-gray-300">Notes:</span> {subTask.notes}</div>}
            {subTask.links && subTask.links.length > 0 && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span className="font-medium text-gray-700 dark:text-gray-300">Links:</span>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {subTask.links.map((l, i) => (
                    <React.Fragment key={i}>
                      <a href={l} target="_blank" rel="noopener noreferrer" className="text-[#0d9488] underline break-all">{l}</a>
                      {i < subTask.links.length - 1 && <span className="text-gray-500">,</span>}
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
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[#0d9488] underline break-all">{att.name || 'file'}</a>
                      {i < subTask.attachments.length - 1 && <span className="text-gray-500">,</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
            <textarea placeholder="Add feedback (optional)" value={confirmFeedback} onChange={(e) => setConfirmFeedback(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-[#0d9488] outline-none mb-2" />
            <div className="flex gap-2">
              <button onClick={submitConfirm} disabled={updating} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition">{updating ? 'Confirming...' : 'Confirm'}</button>
              <button onClick={cancelConfirm} className="px-3 py-1.5 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {showRejectModal && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Reject Sub‑task</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Reason for rejection (optional):</p>
            <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter reason..." className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(false)} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={() => handleRejectConfirm(rejectReason)} className="flex-1 py-2 bg-[#0d9488] text-white rounded-xl text-sm font-medium transition hover:opacity-80">Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
const MyWorkspaceProjectId = () => {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeFolderId, setActiveFolderId] = useState(null); // null = All Tasks
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTaskTarget, setAssignTaskTarget] = useState(null);

  // ── Sub‑task form state ──
  const [addSubTaskOpen, setAddSubTaskOpen] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [newSubTaskStart, setNewSubTaskStart] = useState('');
  const [newSubTaskDue, setNewSubTaskDue] = useState('');
  const [addingSubTask, setAddingSubTask] = useState(false);

  // ── Archived view toggle ──
  const [showArchived, setShowArchived] = useState(false);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, danger: false });
  const [deleteTaskModal, setDeleteTaskModal] = useState({ isOpen: false, taskName: '', onConfirm: () => {} });
  const [addManagerConfirm, setAddManagerConfirm] = useState({ isOpen: false, managerName: '', managerId: '' });

  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRenameFolder, setShowRenameFolder] = useState(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [showFolderMenu, setShowFolderMenu] = useState(false);

  // Folder Access Management
  const [folderAccessModal, setFolderAccessModal] = useState({ isOpen: false, folder: null });

  // Copy / Move via 3-dot menu
  const [folderActionModal, setFolderActionModal] = useState({ isOpen: false, mode: 'copy', task: null });

  // Drag & drop state
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [draggedOverTabId, setDraggedOverTabId] = useState(null);
  const [isDraggingSomething, setIsDraggingSomething] = useState(false);

  // Split pane state
  const [leftWidthPercent, setLeftWidthPercent] = useState(35);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const containerRef = useRef(null);
  const isMd = useMediaQuery('(min-width: 768px)');

  // Queries & Mutations
  const { data: wData, isLoading: wLoad, error: wErr } = useGetWorkspaceQuery(workspaceId);
  const { data: pData, isLoading: pLoad, error: pErr, refetch: refetchProject } = useGetProjectByIdQuery(projectId);
  const { data: tData, isLoading: tLoad, refetch: refetchTasks } = useGetProjectTasksQuery(
    { 
      projectId, 
      ...(activeFolderId ? { folderId: activeFolderId } : {}),
      archived: showArchived ? true : undefined,
    },
    { skip: !projectId }
  );
  const { data: foldersData, refetch: refetchFolders } = useGetProjectFoldersQuery(projectId, { skip: !projectId });
  const { data: feedbackData } = useGetTaskFeedbackQuery({ taskId: selectedTaskId }, { skip: !selectedTaskId });

  const [deleteTask] = useDeleteTaskMutation();
  const [sendManualReminder] = useSendManualReminderMutation();
  const [confirmTaskCompletion] = useConfirmTaskCompletionMutation();
  const [assignTask] = useAssignTaskMutation();
  const [archiveTask] = useArchiveTaskMutation();
  const [restoreTask] = useRestoreTaskMutation();
  const [permanentlyDeleteTask] = usePermanentlyDeleteTaskMutation();
  const [copyTask] = useCopyTaskMutation();
  const [moveTask] = useMoveTaskMutation();
  const [createFolder] = useCreateFolderMutation();
  const [deleteFolder] = useDeleteFolderMutation();
  const [updateFolder] = useUpdateFolderMutation();
  const [addSubTask] = useAddSubTaskMutation(); // for adding sub‑tasks

  // Folder access mutations
  const [addFolderReadOnly] = useAddFolderReadOnlyMutation();
  const [removeFolderReadOnly] = useRemoveFolderReadOnlyMutation();

  const [removeTeamMember] = useRemoveTeamMemberMutation();
  const [manageProjectManagers] = useManageProjectManagersMutation();

  const workspace = wData?.workspace;
  const project = pData?.project;
  const tasks = tData?.tasks || [];
  const folders = foldersData?.folders || [];

  const activeTeam = useMemo(() => (project?.teamMembers || []).filter(m => m.status === 'active'), [project?.teamMembers]);

  // ─── assignableMembers: include owner if not already present ───
  const assignableMembers = useMemo(() => {
    if (!project) return [];
    const mgrs = project.projectManagers || [];
    const all = [...activeTeam, ...mgrs.map(pm => ({ user: pm }))];
    const seen = new Set();
    const ownerId = workspace?.owner?._id || workspace?.owner;
    if (ownerId && !all.some(item => (item.user?._id || item.user) === ownerId)) {
      const ownerMember = workspace?.members?.find(m => (m.user?._id || m.user) === ownerId);
      if (ownerMember) {
        all.push({ user: ownerMember.user || ownerMember });
      } else {
        all.push({ user: { _id: ownerId, name: 'Workspace Owner' } });
      }
    }
    return all.filter(item => {
      const id = item.user?._id || item.user;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [activeTeam, project?.projectManagers, workspace?.owner, workspace?.members]);

  const brandColor = workspace?.color || '#0d9488';
  const isOwner = workspace?.owner?._id === userInfo?._id || workspace?.owner === userInfo?._id;
  const isManager = project?.projectManagers?.some(pm => {
    const id = (pm._id || pm)?.toString();
    return id === userInfo?._id;
  });
  const canManage = isOwner || isManager;

  const activeTask = useMemo(() => tasks.find(t => t._id === selectedTaskId) || null, [tasks, selectedTaskId]);
  const projectManagers = project?.projectManagers || [];
  const projectProgress = project?.progress || 0;

  const availableForManager = workspace?.members?.filter(m => m.status === 'active' && !projectManagers.some(pm => pm._id === (m.user?._id || m._id))) || [];
  const managerOptions = availableForManager.map(m => {
    const u = m.user || m;
    return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" /> : <FaUser className="text-gray-400" /> };
  });

  // ─── Folder visibility and read‑only status ──────────────────────
  const visibleFolders = useMemo(() => {
    if (canManage) return folders;
    const assignedFolderIds = new Set();
    tasks.forEach(task => {
      if (task.assignee?._id === userInfo?._id) {
        const fid = task.folder?._id || task.folder;
        if (fid) assignedFolderIds.add(fid);
      }
    });
    return folders.filter(f => {
      if (assignedFolderIds.has(f._id)) return true;
      return true;
    });
  }, [canManage, folders, tasks, userInfo]);

  const isFolderReadOnly = (folderId) => {
    if (canManage) return false;
    const hasAssigned = tasks.some(t => {
      const fid = t.folder?._id || t.folder;
      return fid === folderId && t.assignee?._id === userInfo?._id;
    });
    if (hasAssigned) return false;
    return visibleFolders.some(f => f._id === folderId);
  };

  // Reset folder selection when toggling archived view
  useEffect(() => {
    if (showArchived) {
      setActiveFolderId(null);
    }
  }, [showArchived]);

  // ─── Save folder permissions ──────────────────────────────────────
  const handleSaveFolderPermissions = async (folderId, selectedUserIds) => {
    const folder = folders.find(f => f._id === folderId);
    if (!folder) return;
    const currentUsers = folder.readOnlyUsers?.map(id => id.toString()) || [];
    const toAdd = selectedUserIds.filter(id => !currentUsers.includes(id));
    const toRemove = currentUsers.filter(id => !selectedUserIds.includes(id));
    try {
      if (toAdd.length > 0) {
        await addFolderReadOnly({ folderId, users: toAdd }).unwrap();
      }
      if (toRemove.length > 0) {
        await removeFolderReadOnly({ folderId, users: toRemove }).unwrap();
      }
      toast.success('Folder access updated');
      refetchFolders();
      refetchTasks();
    } catch (error) {
      toast.error(error?.data?.message || 'Failed to update folder access');
      throw error;
    }
  };

  // ─── Splitter handlers ────────────────────────────────────────────────
  const handleSplitterMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
    document.addEventListener('mousemove', handleSplitterMouseMove);
    document.addEventListener('mouseup', handleSplitterMouseUp);
  };

  const handleSplitterMouseMove = (e) => {
    if (!isDraggingSplitter || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    let newWidth = ((e.clientX - containerRect.left) / containerWidth) * 100;
    newWidth = Math.min(70, Math.max(20, newWidth));
    setLeftWidthPercent(newWidth);
  };

  const handleSplitterMouseUp = () => {
    setIsDraggingSplitter(false);
    document.removeEventListener('mousemove', handleSplitterMouseMove);
    document.removeEventListener('mouseup', handleSplitterMouseUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleSplitterMouseMove);
      document.removeEventListener('mouseup', handleSplitterMouseUp);
    };
  }, []);

  if (wErr || pErr) { navigate(`/my-workspace/${workspaceId}/projects`); return null; }
  if (wLoad || pLoad || tLoad) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: brandColor }} />
    </div>
  );
  if (!workspace || !project) return null;

  // ── Handlers ──────────────────────────────────────────────────────
  const handleDeleteTask = (task) => {
    setDeleteTaskModal({
      isOpen: true,
      taskName: task.title,
      onConfirm: async () => {
        try {
          await deleteTask(task._id).unwrap();
          toast.success('Task moved to trash');
          refetchTasks();
          refetchProject();
          if (selectedTaskId === task._id) { setSelectedTaskId(null); setMobileShowDetail(false); }
        } catch (e) { toast.error(e?.data?.message || 'Failed'); }
      },
    });
  };

  const handleEditTask = (task) => { setSelectedTask(task); setShowEditTask(true); };
  const handleRemoveMember = async (id) => {
    setConfirmModal({
      isOpen: true, title: 'Remove Member', message: 'Are you sure?', onConfirm: async () => {
        try { await removeTeamMember({ projectId, memberId: id }).unwrap(); toast.success('Removed'); refetchProject(); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
      }, danger: true,
    });
  };
  const handleAddManager = (id, name) => setAddManagerConfirm({ isOpen: true, managerName: name, managerId: id });
  const confirmAddManager = async () => {
    try {
      await manageProjectManagers({ projectId, action: 'add', managerId: addManagerConfirm.managerId }).unwrap();
      toast.success('Manager added');
      refetchProject();
      setAddManagerConfirm({ isOpen: false, managerName: '', managerId: '' });
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };
  const handleRemoveManager = async (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Manager',
      message: 'Are you sure?',
      onConfirm: async () => {
        try {
          await manageProjectManagers({ projectId, action: 'remove', managerId: id }).unwrap();
          toast.success('Manager removed');
          refetchProject();
        } catch (e) {
          toast.error(e?.data?.message || 'Failed to remove manager');
        }
      },
      danger: true,
    });
  };

  const handleTaskClick = (taskId) => { setSelectedTaskId(taskId); setMobileShowDetail(true); };
  const handleBackToList = () => { setSelectedTaskId(null); setMobileShowDetail(false); };

  const handleSendManualReminder = async (task) => {
    try { await sendManualReminder({ taskId: task._id, message: '' }).unwrap(); toast.success('Reminder sent'); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };
  const handleConfirmCompletion = async (taskId) => {
    setConfirmModal({
      isOpen: true, title: 'Confirm Completion', message: 'Confirm that this task is complete?', onConfirm: async () => {
        try { await confirmTaskCompletion({ taskId }).unwrap(); toast.success('Completion confirmed'); refetchTasks(); refetchProject(); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
      },
    });
  };
  const handleAssignTask = async (assigneeId) => {
    try {
      await assignTask({ taskId: assignTaskTarget._id, assigneeId }).unwrap();
      toast.success('Task assigned'); refetchTasks(); setShowAssignModal(false); setAssignTaskTarget(null);
    } catch (e) { throw e; }
  };
  const openAssignModal = (task) => { setAssignTaskTarget(task); setShowAssignModal(true); };

  const handleArchiveTask = async (taskId) => { 
    try { 
      await archiveTask(taskId).unwrap(); 
      toast.success('Archived'); 
      refetchTasks(); 
      if (showArchived) setShowArchived(true); // keep archived view
    } catch (e) { toast.error(e?.data?.message || 'Failed'); } 
  };
  const handleUnarchiveTask = async (taskId) => { 
    try { 
      await restoreTask(taskId).unwrap(); 
      toast.success('Restored to active'); 
      refetchTasks(); 
      // if we are in archived view, maybe stay or switch? we'll stay.
    } catch (e) { toast.error(e?.data?.message || 'Failed'); } 
  };
  const handleRestoreTask = async (taskId) => { 
    try { 
      await restoreTask(taskId).unwrap(); 
      toast.success('Restored from trash'); 
      refetchTasks(); 
    } catch (e) { toast.error(e?.data?.message || 'Failed'); } 
  };
  const handlePermanentlyDeleteTask = async (taskId) => {
    if (!window.confirm('PERMANENTLY DELETE this task?')) return;
    try { 
      await permanentlyDeleteTask(taskId).unwrap(); 
      toast.success('Permanently deleted'); 
      refetchTasks(); 
      refetchProject(); 
      if (selectedTaskId === taskId) { setSelectedTaskId(null); setMobileShowDetail(false); }
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return toast.error('Folder name required');
    try {
      await createFolder({ projectId, name: newFolderName.trim() }).unwrap();
      toast.success('Folder created');
      setNewFolderName('');
      setShowCreateFolder(false);
      refetchFolders();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };

  const handleDeleteFolder = async (folderId) => {
    if (!window.confirm('Delete folder and unlink its tasks?')) return;
    try { await deleteFolder(folderId).unwrap(); toast.success('Folder deleted'); refetchFolders(); refetchTasks(); if (activeFolderId === folderId) setActiveFolderId(null); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };

  const handleRenameFolder = async (folderId) => {
    if (!renameFolderName.trim()) return toast.error('Name required');
    try {
      await updateFolder({ folderId, name: renameFolderName.trim() }).unwrap();
      toast.success('Folder renamed');
      setShowRenameFolder(null);
      setRenameFolderName('');
      refetchFolders();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };

  // ── Add Sub‑task handler ──
  const handleAddSubTask = async () => {
    if (!newSubTaskTitle.trim()) {
      toast.error('Sub‑task title required');
      return;
    }
    setAddingSubTask(true);
    try {
      await addSubTask({
        taskId: activeTask._id,
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
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to add sub‑task');
    } finally {
      setAddingSubTask(false);
    }
  };

  const refreshAll = () => { refetchTasks(); refetchProject(); };

  // ── 3-dot menu: Copy / Move via modal ──────────────────────────────
  const openCopyModal = (task) => setFolderActionModal({ isOpen: true, mode: 'copy', task });
  const openMoveModal = (task) => setFolderActionModal({ isOpen: true, mode: 'move', task });
  const closeFolderActionModal = () => setFolderActionModal({ isOpen: false, mode: 'copy', task: null });

  const handleFolderActionConfirm = async (taskId, targetFolderId) => {
    try {
      if (folderActionModal.mode === 'copy') {
        await copyTask({ taskId, targetFolderId }).unwrap();
        toast.success('Task copied');
      } else {
        await moveTask({ taskId, targetFolderId }).unwrap();
        toast.success('Task moved');
      }
      refetchTasks();
      closeFolderActionModal();
    } catch (e) {
      toast.error(e?.data?.message || 'Failed');
    }
  };

  // ── Drag & Drop ──────────────────────────────────────────────────────
  const handleDragStart = (e, task) => {
    const folderId = task.folder?._id || task.folder;
    if (folderId && isFolderReadOnly(folderId)) {
      e.preventDefault();
      toast.error('Cannot move a task from a read‑only folder.');
      return;
    }
    setDraggedTaskId(task._id);
    setIsDraggingSomething(true);
    e.dataTransfer.setData('text/plain', task._id);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
    } catch (err) {}
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDraggedOverTabId(null);
    setIsDraggingSomething(false);
  };

  const handleDragOver = (e, folderId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedOverTabId !== folderId) setDraggedOverTabId(folderId);
  };

  const handleDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDraggedOverTabId(null);
  };

  const handleDrop = async (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedOverTabId(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);
    setIsDraggingSomething(false);
    if (!taskId) return;
    if (!canManage && folderId && isFolderReadOnly(folderId)) {
      toast.error('You do not have write access to this folder.');
      return;
    }
    try {
      await moveTask({ taskId, targetFolderId: folderId }).unwrap();
      toast.success('Task moved');
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to move task');
    }
  };

  // Determine if active folder is read-only (for detail view actions)
  const isActiveFolderReadOnly = activeFolderId ? isFolderReadOnly(activeFolderId) : false;

  // ── Toggle archived view ──
  const toggleArchived = () => {
    setShowArchived(prev => !prev);
    setActiveFolderId(null);
    setSelectedTaskId(null);
    setMobileShowDetail(false);
  };

  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-4 h-14 lg:h-16">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate(`/my-workspace/${workspaceId}/projects`)} className="p-1 lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"><FaArrowLeft /></button>
              <div className="flex items-center gap-3">
                {project.coverImage ? (
                  <img src={project.coverImage} className="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700/60" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: brandColor }}>
                    <FaFolder className="text-lg" />
                  </div>
                )}
                <div>
                  <h1 className="text-base font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[150px] md:max-w-xs">{project.name}</h1>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <FaChartLine className="text-[#0d9488] text-[10px]" />
                      {projectProgress}% done
                    </span>
                    <span className="w-1 h-1 bg-gray-400 dark:bg-gray-600 rounded-full" />
                    <span className="flex items-center gap-1">
                      <FaUsers className="text-[10px]" />
                      {activeTeam.length} members
                      {canManage && (
                        <button onClick={() => setShowAddMember(true)} className="text-[#0d9488] hover:text-[#14b8a6] transition ml-0.5">
                          <FaPlus className="text-[10px]" />
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSearchOpen(true)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"><FaSearch /></button>
              {canManage && !showArchived && (
                <button onClick={() => setShowCreateTask(true)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"><FaPlus /></button>
              )}
            </div>
          </div>

          {/* Tabs with hover actions and Access Management */}
          <div className="flex items-center gap-2 px-4 border-t border-gray-200 dark:border-gray-800/30 overflow-x-auto">
            <div
              onClick={() => { setActiveFolderId(null); setShowArchived(false); setMobileShowDetail(false); setSelectedTaskId(null); }}
              onDragOver={(e) => !showArchived && handleDragOver(e, null)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => !showArchived && handleDrop(e, null)}
              className={`relative flex-shrink-0 cursor-pointer pb-2 text-sm font-medium transition px-3 py-1.5 rounded-xl ${
                !showArchived && activeFolderId === null
                  ? 'bg-[#0d9488]/10 text-[#0d9488]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              } ${!showArchived && draggedOverTabId === null && isDraggingSomething ? 'ring-2 ring-[#0d9488] ring-offset-2 bg-[#0d9488]/5' : ''}`}
            >
              All Tasks
              {!showArchived && draggedOverTabId === null && isDraggingSomething && (
                <span className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-[9px] font-medium text-[#0d9488] bg-white dark:bg-[#0f0f12] px-1.5 py-0.5 rounded shadow">
                  Move here?
                </span>
              )}
            </div>

            {/* Archived Tab */}
            <div
              onClick={toggleArchived}
              className={`relative flex-shrink-0 cursor-pointer pb-2 text-sm font-medium transition px-3 py-1.5 rounded-xl ${
                showArchived
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <span className="flex items-center gap-1">
                <FaArchive className="text-xs" /> Archived
              </span>
            </div>

            {!showArchived && visibleFolders.map(folder => {
              const readOnly = isFolderReadOnly(folder._id);
              return (
                <div
                  key={folder._id}
                  className="relative flex-shrink-0 group"
                  onDragOver={(e) => handleDragOver(e, folder._id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, folder._id)}
                >
                  <div
                    onClick={() => { setActiveFolderId(folder._id); setShowArchived(false); setMobileShowDetail(false); setSelectedTaskId(null); }}
                    className={`flex items-center gap-1 cursor-pointer pb-2 text-sm font-medium transition px-3 py-1.5 rounded-xl ${
                      !showArchived && activeFolderId === folder._id
                        ? 'bg-[#0d9488]/10 text-[#0d9488]'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    } ${!showArchived && draggedOverTabId === folder._id && isDraggingSomething ? 'ring-2 ring-[#0d9488] ring-offset-2 bg-[#0d9488]/5' : ''}`}
                  >
                    <span>{folder.name}</span>
                    {readOnly && <FaLock className="text-[10px] text-blue-400" />}
                    {canManage && (
                      <span className="opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5 ml-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowRenameFolder(folder._id); setRenameFolderName(folder.name); }}
                          className="p-0.5 text-blue-400 hover:text-blue-600 transition rounded"
                          title="Rename"
                        >
                          <FaPen className="text-[10px]" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder._id); }}
                          className="p-0.5 text-red-400 hover:text-red-600 transition rounded"
                          title="Delete"
                        >
                          <FaTimes className="text-[10px]" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setFolderAccessModal({ isOpen: true, folder }); }}
                          className="p-0.5 text-yellow-500 hover:text-yellow-600 transition rounded"
                          title="Manage Access"
                        >
                          <FaLockOpen className="text-[10px]" />
                        </button>
                      </span>
                    )}
                    {!showArchived && draggedOverTabId === folder._id && isDraggingSomething && (
                      <span className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-[9px] font-medium text-[#0d9488] bg-white dark:bg-[#0f0f12] px-1.5 py-0.5 rounded shadow">
                        Move here?
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {canManage && !showArchived && (
              <button
                onClick={() => setShowCreateFolder(true)}
                className="flex-shrink-0 p-1.5 text-[#0d9488] hover:bg-[#0d9488]/10 rounded-lg transition"
                title="Create new folder"
              >
                <FaPlus className="text-sm" />
              </button>
            )}
          </div>
        </header>

        {/* Split pane */}
        <div className="flex-1 flex overflow-hidden" ref={containerRef}>
          {/* Left panel */}
          <div
            className={`flex flex-col h-full overflow-hidden flex-shrink-0 border-r border-gray-200 dark:border-gray-800/40 bg-gray-50 dark:bg-[#0f0f12] ${!isMd && mobileShowDetail ? 'hidden' : ''}`}
            style={{ width: isMd ? `${leftWidthPercent}%` : (mobileShowDetail ? '0%' : '100%') }}
          >
            <div className="flex-1 overflow-y-auto p-4">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-500">
                  <FaTasks className="text-4xl mb-2 opacity-30" />
                  <p className="text-sm">{showArchived ? 'No archived tasks' : 'No tasks in this view'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {tasks.map(task => {
                    const folderId = task.folder?._id || task.folder;
                    const readOnly = !canManage && folderId && isFolderReadOnly(folderId);
                    return (
                      <TaskCard
                        key={task._id}
                        task={task}
                        onClick={handleTaskClick}
                        brandColor={brandColor}
                        isActive={selectedTaskId === task._id}
                        draggable={!readOnly && !showArchived}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onCopyClick={openCopyModal}
                        onMoveClick={openMoveModal}
                        readOnly={readOnly}
                        showArchived={showArchived}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Splitter divider */}
          {isMd && (
            <div
              className="hidden md:flex items-center justify-center w-2 flex-shrink-0 bg-transparent hover:bg-[#0d9488]/10 cursor-col-resize transition-colors duration-150 select-none"
              onMouseDown={handleSplitterMouseDown}
              style={{ touchAction: 'none' }}
            >
              <div className="w-0.5 h-12 bg-gray-300 dark:bg-gray-700 rounded-full hover:bg-[#0d9488] transition" />
            </div>
          )}

          {/* Right panel */}
          <div
            className={`flex flex-col flex-1 h-full bg-gray-50 dark:bg-[#0f0f12] ${!isMd && !mobileShowDetail ? 'hidden' : ''}`}
          >
            {activeTask ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800/60 bg-white/80 dark:bg-[#14141a]/80 backdrop-blur-sm flex-shrink-0 sticky top-0 z-10">
                  {!isMd && (
                    <button onClick={handleBackToList} className="p-1 md:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"><FaArrowLeft /></button>
                  )}
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: brandColor }}>{activeTask.title.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{formatTaskTitle(activeTask.title)}</h2>
                    <div className="flex items-center gap-1.5 text-xs flex-wrap">
                      <TaskStatusBadge status={activeTask.status} />
                      <TaskPriorityBadge priority={activeTask.priority} />
                      {activeTask.assignee && <span className="text-gray-500 dark:text-gray-400 truncate">{activeTask.assignee.name}</span>}
                      {activeTask.isArchived && (
                        <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1">
                          <FaArchive className="text-[10px]" /> Archived
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <button onClick={() => setShowFolderMenu(!showFolderMenu)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaEllipsisV className="text-sm" /></button>
                    {showFolderMenu && (
                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-800/60 rounded-xl min-w-[180px] z-20 py-1 shadow-lg">
                        {canManage && !activeTask.isArchived && (
                          <>
                            <button onClick={() => { setShowFolderMenu(false); handleSendManualReminder(activeTask); }} className="flex items-center gap-2 px-4 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/10 w-full transition"><FaBell className="text-xs" /> Send Reminder</button>
                            <button onClick={() => { setShowFolderMenu(false); openCopyModal(activeTask); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 w-full transition"><FaCopy className="text-xs" /> Copy Task</button>
                            <button onClick={() => { setShowFolderMenu(false); openMoveModal(activeTask); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 w-full transition"><FaFolder className="text-xs" /> Move Task</button>
                            <button onClick={() => { setShowFolderMenu(false); handleArchiveTask(activeTask._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 w-full transition"><FaArchive className="text-xs" /> Archive</button>
                            <button onClick={() => { setShowFolderMenu(false); handleDeleteTask(activeTask); }} className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-500/10 w-full transition"><FaTrashAlt className="text-xs" /> Move to Trash</button>
                          </>
                        )}
                        {canManage && activeTask.isArchived && (
                          <>
                            <button onClick={() => { setShowFolderMenu(false); handleUnarchiveTask(activeTask._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/10 w-full transition"><FaUndo className="text-xs" /> Unarchive</button>
                            <button onClick={() => { setShowFolderMenu(false); handlePermanentlyDeleteTask(activeTask._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 w-full transition"><FaTrashAlt className="text-xs" /> Delete Permanently</button>
                          </>
                        )}
                        <button onClick={() => { setShowFolderMenu(false); handleEditTask(activeTask); }} className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/10 w-full transition"><FaEdit className="text-xs" /> Edit</button>
                        {canManage && !activeTask.assignee && !activeTask.isArchived && (
                          <button onClick={() => { setShowFolderMenu(false); openAssignModal(activeTask); }} className="flex items-center gap-2 px-4 py-2 text-sm text-[#0d9488] hover:bg-[#0d9488]/10 w-full transition"><FaUserPlus className="text-xs" /> Assign Task</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-white dark:bg-[#14141a] border-b border-gray-200 dark:border-gray-800/40 px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Progress</span>
                    <span className="text-gray-600 dark:text-gray-400">{activeTask.progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800/60 rounded-full mt-1 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${activeTask.progress}%`, backgroundColor: brandColor, boxShadow: `0 0 12px ${brandColor}66` }} />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-500">
                    <span>{activeTask.subTasks?.filter(st => st.status === 'confirmed').length || 0}/{activeTask.subTasks?.length || 0} sub‑tasks confirmed</span>
                    {activeTask.dueDate && <span className="flex items-center gap-1"><FaCalendarAlt className="text-[10px]" /> Due: {formatDateTime(activeTask.dueDate)}</span>}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 pb-24 md:pb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2"><FaTasks className="text-[#0d9488]" /> Sub‑tasks</h3>
                    {!activeTask.isArchived && !isActiveFolderReadOnly && ((activeTask.assignee?._id === userInfo?._id && activeTask.allowAssigneeEditSubtasks) || canManage) && (
                      <button
                        onClick={() => setAddSubTaskOpen(!addSubTaskOpen)}
                        className="text-xs text-[#0d9488] font-medium flex items-center gap-1 hover:text-[#14b8a6] transition"
                      >
                        <FaPlus className="text-xs" /> Add
                      </button>
                    )}
                  </div>

                  {/* Inline sub‑task form */}
                  {addSubTaskOpen && (
                    <div className="bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-gray-800/60 rounded-xl p-3 mb-3 w-full">
                      <input
                        type="text"
                        placeholder="Sub‑task title"
                        value={newSubTaskTitle}
                        onChange={(e) => setNewSubTaskTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-[#0d9488] outline-none mb-2"
                      />
                      <input
                        type="datetime-local"
                        placeholder="Start date & time"
                        value={newSubTaskStart}
                        onChange={(e) => setNewSubTaskStart(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none mb-2"
                      />
                      <input
                        type="datetime-local"
                        placeholder="Due date & time"
                        value={newSubTaskDue}
                        onChange={(e) => setNewSubTaskDue(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAddSubTaskOpen(false)}
                          className="flex-1 py-1.5 border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddSubTask}
                          disabled={addingSubTask}
                          className="flex-1 py-1.5 text-white rounded-lg text-sm transition hover:opacity-80"
                          style={{ backgroundColor: brandColor }}
                        >
                          {addingSubTask ? 'Adding...' : 'Add'}
                        </button>
                      </div>
                    </div>
                  )}

                  {(activeTask.subTasks || []).length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-500 text-sm">No sub‑tasks yet</div>
                  ) : (
                    (activeTask.subTasks || []).map((st, idx) => (
                      <SubTaskItem
                        key={idx}
                        subTask={st}
                        index={idx}
                        taskId={activeTask._id}
                        isAssignee={activeTask.assignee?._id === userInfo?._id}
                        canManage={canManage}
                        onRefresh={refreshAll}
                        brandColor={brandColor}
                        readOnly={isActiveFolderReadOnly || activeTask.isArchived}
                      />
                    ))
                  )}
                </div>
                {!activeTask.isArchived && !isActiveFolderReadOnly && activeTask.assignee?._id === userInfo?._id && activeTask.status === 'ready_for_completion' && (
                  <div className="border-t border-gray-200 dark:border-gray-800/40 bg-white dark:bg-[#14141a] px-3 py-2 flex-shrink-0 sticky bottom-0">
                    <button onClick={refreshAll} className="w-full py-2 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition hover:opacity-80" style={{ backgroundColor: brandColor }}><FaChartLine className="text-sm" /> Refresh status</button>
                  </div>
                )}
                {!activeTask.isArchived && !isActiveFolderReadOnly && canManage && activeTask.status === 'completed' && activeTask.status !== 'confirmed_completed' && (
                  <div className="border-t border-gray-200 dark:border-gray-800/40 bg-white dark:bg-[#14141a] px-3 py-2 flex-shrink-0 sticky bottom-0">
                    <button onClick={() => handleConfirmCompletion(activeTask._id)} className="w-full py-2 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition hover:opacity-80" style={{ backgroundColor: brandColor }}><FaCheckDouble className="text-sm" /> Confirm Completion</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-500">
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

      {!mobileShowDetail && <MyWorkspaceBottombar workspace={workspace} />}

      {/* ── Modals ──────────────────────────────────────────── */}
      {showCreateTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaTasks className="inline mr-1 text-[#0d9488]" /> New Task</h2>
              <button onClick={() => setShowCreateTask(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <CreateTaskForm
              projectId={projectId}
              brandColor={brandColor}
              assignableMembers={assignableMembers}
              folders={folders}
              onSuccess={() => { setShowCreateTask(false); refreshAll(); }}
            />
          </div>
        </div>
      )}

      {showEditTask && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaEdit className="inline mr-1 text-[#0d9488]" /> Edit Task</h2>
              <button onClick={() => setShowEditTask(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <EditTaskForm task={selectedTask} brandColor={brandColor} assignableMembers={assignableMembers} folders={folders} onSuccess={() => { setShowEditTask(false); refreshAll(); }} />
          </div>
        </div>
      )}

      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaUserPlus className="inline mr-1 text-[#0d9488]" /> Add Member</h2>
              <button onClick={() => setShowAddMember(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <AddMemberForm
              project={project}
              workspace={workspace}
              brandColor={brandColor}
              onSuccess={() => { setShowAddMember(false); refetchProject(); }}
              onAddManager={handleAddManager}
            />
          </div>
        </div>
      )}

      {showAssignModal && assignTaskTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaUserPlus className="inline mr-1 text-[#0d9488]" /> Assign Task</h2>
              <button onClick={() => setShowAssignModal(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <AssignForm assignableMembers={assignableMembers} onAssign={handleAssignTask} brandColor={brandColor} />
          </div>
        </div>
      )}

      {showAddManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Add Manager</h2>
              <button onClick={() => setShowAddManager(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
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
          </div>
        </div>
      )}

      {showCreateFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaFolder className="inline mr-1 text-[#0d9488]" /> New Folder</h2>
              <button onClick={() => setShowCreateFolder(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowCreateFolder(false)} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={handleCreateFolder} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>Create Folder</button>
            </div>
          </div>
        </div>
      )}

      {showRenameFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaPen className="inline mr-1 text-[#0d9488]" /> Rename Folder</h2>
              <button onClick={() => setShowRenameFolder(null)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <input
              type="text"
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              placeholder="New folder name"
              className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowRenameFolder(null)} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={() => handleRenameFolder(showRenameFolder)} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Access Modal */}
      <FolderAccessModal
        isOpen={folderAccessModal.isOpen}
        onClose={() => setFolderAccessModal({ isOpen: false, folder: null })}
        folder={folderAccessModal.folder}
        projectMembers={activeTeam}
        currentUserId={userInfo?._id}
        initialAccessUsers={folderAccessModal.folder?.readOnlyUsers?.map(id => id.toString()) || []}
        onSave={handleSaveFolderPermissions}
        brandColor={brandColor}
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
      <FolderSelectModal
        isOpen={folderActionModal.isOpen}
        onClose={closeFolderActionModal}
        folders={folders}
        mode={folderActionModal.mode}
        task={folderActionModal.task}
        onConfirm={handleFolderActionConfirm}
        brandColor={brandColor}
      />
    </div>
  );
};

// ─── Inline Form Components ──────────────────────────────────────────
const CreateTaskForm = ({ projectId, brandColor, assignableMembers, folders, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('general');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [bufferTime, setBufferTime] = useState(0);
  const [links, setLinks] = useState('');
  const [allowAssigneeEditSubtasks, setAllowAssigneeEditSubtasks] = useState(false);
  const [folderId, setFolderId] = useState(null);
  const [dailyReminderTime, setDailyReminderTime] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createTask] = useCreateTaskMutation();

  const assigneeOpts = [
    { value: '', label: 'Unassigned', icon: <FaUser className="text-gray-400" /> },
    ...assignableMembers.map(m => {
      const u = m.user || m;
      return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" alt="" /> : <FaUser className="text-gray-400" /> };
    })
  ];
  const folderOpts = [
    { value: null, label: 'No Folder', icon: <FaFolder className="text-gray-400" /> },
    ...folders.map(f => ({ value: f._id, label: f.name, icon: <FaFolder className="text-gray-400" /> }))
  ];

  const setDueDateRelative = (hours) => {
    const now = new Date();
    setStartDate(now.toISOString().slice(0, 16));
    const due = new Date(now.getTime() + hours * 60 * 60 * 1000);
    setDueDate(due.toISOString().slice(0, 16));
  };
  const setDueDateToday = () => {
    const now = new Date();
    setStartDate(now.toISOString().slice(0, 16));
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 0, 0);
    setDueDate(endOfDay.toISOString().slice(0, 16));
  };
  const setDueDateTomorrow = () => {
    const now = new Date();
    setStartDate(now.toISOString().slice(0, 16));
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 0, 0);
    setDueDate(tomorrow.toISOString().slice(0, 16));
  };
  const setDueDateInDays = (days) => {
    const now = new Date();
    setStartDate(now.toISOString().slice(0, 16));
    const target = new Date(now);
    target.setDate(target.getDate() + days);
    target.setHours(23, 59, 0, 0);
    setDueDate(target.toISOString().slice(0, 16));
  };
  const setDueDateInMonths = (months) => {
    const now = new Date();
    setStartDate(now.toISOString().slice(0, 16));
    const target = new Date(now);
    target.setMonth(target.getMonth() + months);
    target.setHours(23, 59, 0, 0);
    setDueDate(target.toISOString().slice(0, 16));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Title required');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('projectId', projectId);
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('taskType', taskType);
      if (assigneeId) fd.append('assigneeId', assigneeId);
      fd.append('priority', priority);
      if (startDate) fd.append('startDate', new Date(startDate).toISOString());
      if (dueDate) fd.append('dueDate', new Date(dueDate).toISOString());
      if (estimatedHours) fd.append('estimatedHours', estimatedHours);
      fd.append('bufferTime', bufferTime);
      fd.append('links', JSON.stringify(links.split('\n').filter(Boolean)));
      fd.append('allowAssigneeEditSubtasks', allowAssigneeEditSubtasks);
      if (folderId) fd.append('folderId', folderId);
      if (dailyReminderTime) fd.append('dailyReminderTime', dailyReminderTime);
      attachments.forEach(file => fd.append('attachments', file));
      await createTask(fd).unwrap();
      toast.success('Task created');
      onSuccess();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" required />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
      </div>
      <CustomDropdown label="Task Type" options={taskTypeOptions} value={taskType} onChange={setTaskType} brandColor={brandColor} />
      <CustomDropdown label="Folder" options={folderOpts} value={folderId} onChange={setFolderId} brandColor={brandColor} />
      <CustomDropdown label="Assignee" options={assigneeOpts} value={assigneeId} onChange={setAssigneeId} brandColor={brandColor} />
      <div className="grid grid-cols-2 gap-3">
        <CustomDropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} brandColor={brandColor} />
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date & Time</label>
          <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Due Date & Time</label>
        <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Quick set due date</label>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setDueDateRelative(1)} className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-800/40 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">in 1 hour</button>
          <button type="button" onClick={() => setDueDateRelative(10)} className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-800/40 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">in 10 hours</button>
          <button type="button" onClick={setDueDateToday} className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-800/40 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">today</button>
          <button type="button" onClick={setDueDateTomorrow} className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-800/40 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">tomorrow</button>
          <button type="button" onClick={() => setDueDateInDays(7)} className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-800/40 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">1 week</button>
          <button type="button" onClick={() => setDueDateInDays(14)} className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-800/40 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">2 weeks</button>
          <button type="button" onClick={() => setDueDateInMonths(1)} className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-800/40 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">1 month</button>
          <button type="button" onClick={() => setDueDateInMonths(2)} className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-800/40 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">2 months</button>
          <button type="button" onClick={() => setDueDateInMonths(6)} className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-800/40 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">6 months</button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Sets start date to now and due date accordingly</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Est. Hours</label>
          <input type="number" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buffer Time (hours)</label>
          <input type="number" step="0.5" value={bufferTime} onChange={e => setBufferTime(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Links (one per line)</label>
        <textarea value={links} onChange={e => setLinks(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" placeholder="https://..." />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Attachments</label>
        <input type="file" multiple onChange={e => setAttachments([...e.target.files])} className="text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#0d9488]/20 file:text-[#0d9488]" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="allowAssigneeEditSubtasks" checked={allowAssigneeEditSubtasks} onChange={e => setAllowAssigneeEditSubtasks(e.target.checked)} className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-[#0d9488] focus:ring-[#0d9488]" />
        <label htmlFor="allowAssigneeEditSubtasks" className="text-xs text-gray-700 dark:text-gray-300">Allow assignee to add/edit sub‑tasks</label>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Daily Reminder Time</label>
        <input type="time" value={dailyReminderTime} onChange={e => setDailyReminderTime(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => {}} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Creating...' : 'Create Task'}</button>
      </div>
    </form>
  );
};

const EditTaskForm = ({ task, brandColor, assignableMembers, folders, onSuccess }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [taskType, setTaskType] = useState(task?.taskType || 'general');
  const [assigneeId, setAssigneeId] = useState(task?.assignee?._id || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [startDate, setStartDate] = useState(task?.startDate ? new Date(task.startDate).toISOString().slice(0, 16) : '');
  const [dueDate, setDueDate] = useState(task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');
  const [status, setStatus] = useState(task?.status || 'pending');
  const [estimatedHours, setEstimatedHours] = useState(task?.estimatedHours || '');
  const [bufferTime, setBufferTime] = useState(task?.bufferTime || 0);
  const [links, setLinks] = useState((task?.links || []).join('\n'));
  const [allowAssigneeEditSubtasks, setAllowAssigneeEditSubtasks] = useState(task?.allowAssigneeEditSubtasks || false);
  const [folderId, setFolderId] = useState(task?.folder?._id || null);
  const [dailyReminderTime, setDailyReminderTime] = useState(task?.dailyReminderTime || '');
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updateTask] = useUpdateTaskMutation();

  const assigneeOpts = [
    { value: '', label: 'Unassigned', icon: <FaUser className="text-gray-400" /> },
    ...assignableMembers.map(m => {
      const u = m.user || m;
      return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" alt="" /> : <FaUser className="text-gray-400" /> };
    })
  ];
  const folderOpts = [
    { value: null, label: 'No Folder', icon: <FaFolder className="text-gray-400" /> },
    ...folders.map(f => ({ value: f._id, label: f.name, icon: <FaFolder className="text-gray-400" /> }))
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('taskType', taskType);
      if (assigneeId) fd.append('assigneeId', assigneeId);
      fd.append('priority', priority);
      if (startDate) fd.append('startDate', new Date(startDate).toISOString());
      if (dueDate) fd.append('dueDate', new Date(dueDate).toISOString());
      fd.append('status', status);
      if (estimatedHours) fd.append('estimatedHours', estimatedHours);
      fd.append('bufferTime', bufferTime);
      fd.append('links', JSON.stringify(links.split('\n').filter(Boolean)));
      fd.append('allowAssigneeEditSubtasks', allowAssigneeEditSubtasks);
      if (folderId) fd.append('folderId', folderId);
      if (dailyReminderTime) fd.append('dailyReminderTime', dailyReminderTime);
      attachments.forEach(file => fd.append('attachments', file));
      await updateTask({ taskId: task._id, data: fd }).unwrap();
      toast.success('Task updated');
      onSuccess();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" required />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
      </div>
      <CustomDropdown label="Task Type" options={taskTypeOptions} value={taskType} onChange={setTaskType} brandColor={brandColor} />
      <CustomDropdown label="Status" options={statusOptions} value={status} onChange={setStatus} brandColor={brandColor} />
      <CustomDropdown label="Folder" options={folderOpts} value={folderId} onChange={setFolderId} brandColor={brandColor} />
      <CustomDropdown label="Assignee" options={assigneeOpts} value={assigneeId} onChange={setAssigneeId} brandColor={brandColor} />
      <div className="grid grid-cols-2 gap-3">
        <CustomDropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} brandColor={brandColor} />
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date & Time</label>
          <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Due Date & Time</label>
        <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Est. Hours</label>
          <input type="number" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buffer Time (hours)</label>
          <input type="number" step="0.5" value={bufferTime} onChange={e => setBufferTime(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Links (one per line)</label>
        <textarea value={links} onChange={e => setLinks(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" placeholder="https://..." />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Attachments</label>
        <input type="file" multiple onChange={e => setAttachments([...e.target.files])} className="text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#0d9488]/20 file:text-[#0d9488]" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="allowAssigneeEditSubtasks-edit" checked={allowAssigneeEditSubtasks} onChange={e => setAllowAssigneeEditSubtasks(e.target.checked)} className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-[#0d9488] focus:ring-[#0d9488]" />
        <label htmlFor="allowAssigneeEditSubtasks-edit" className="text-xs text-gray-700 dark:text-gray-300">Allow assignee to add/edit sub‑tasks</label>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Daily Reminder Time</label>
        <input type="time" value={dailyReminderTime} onChange={e => setDailyReminderTime(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => {}} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Updating...' : 'Update Task'}</button>
      </div>
    </form>
  );
};

const AddMemberForm = ({ project, workspace, brandColor, onSuccess, onAddManager }) => {
  const [role, setRole] = useState('member');
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
    if (!memberId) return toast.error('Select a member');
    setLoading(true);
    try {
      if (role === 'member') {
        await addTeamMember({ projectId: project._id, userId: memberId }).unwrap();
        toast.success('Member added');
        onSuccess();
      } else {
        const selected = available.find(m => (m.user?._id || m._id) === memberId);
        const name = selected?.user?.name || selected?.name || 'Unknown';
        onAddManager(memberId, name);
        onSuccess();
      }
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Role</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRole('member')}
            className={`flex-1 py-1.5 text-sm rounded-lg border transition ${
              role === 'member'
                ? 'border-[#0d9488] bg-[#0d9488]/10 text-[#0d9488]'
                : 'border-gray-300 dark:border-gray-700/60 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30'
            }`}
          >
            Member
          </button>
          <button
            type="button"
            onClick={() => setRole('manager')}
            className={`flex-1 py-1.5 text-sm rounded-lg border transition ${
              role === 'manager'
                ? 'border-[#0d9488] bg-[#0d9488]/10 text-[#0d9488]'
                : 'border-gray-300 dark:border-gray-700/60 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30'
            }`}
          >
            Manager
          </button>
        </div>
      </div>
      <CustomDropdown label="Select Member" options={options} value={memberId} onChange={setMemberId} brandColor={brandColor} />
      {available.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">All workspace members already in project</p>}
      <div className="flex gap-3 mt-4">
        <button type="button" onClick={onSuccess} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
        <button type="submit" disabled={loading || available.length === 0} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Adding...' : 'Add'}</button>
      </div>
    </form>
  );
};

const AssignForm = ({ assignableMembers, onAssign, brandColor }) => {
  const [assigneeId, setAssigneeId] = useState('');
  const [loading, setLoading] = useState(false);

  const assigneeOpts = assignableMembers.map(m => {
    const u = m.user || m;
    return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" alt="" /> : <FaUser className="text-gray-400" /> };
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assigneeId) return toast.error('Select a member');
    setLoading(true);
    try {
      await onAssign(assigneeId);
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CustomDropdown label="Select Member" options={assigneeOpts} value={assigneeId} onChange={setAssigneeId} brandColor={brandColor} />
      <div className="flex gap-3 mt-4">
        <button type="button" onClick={() => {}} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Assigning...' : 'Assign'}</button>
      </div>
    </form>
  );
};

export default MyWorkspaceProjectId;
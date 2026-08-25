// src/workspaceScreens/MyWorkspaceProjectId.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  useReorderTasksMutation,
  useReorderSubTasksMutation,
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
  FaRedo,
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
const TaskStatusBadge = React.memo(({ status }) => {
  const map = {
    pending: { label: 'Pending', color: 'bg-gray-200 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700' },
    'in-progress': { label: 'In Progress', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700/50' },
    ready_for_completion: { label: 'Ready', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700/50' },
    completed: { label: 'Completed', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700/50' },
    confirmed_completed: { label: 'Confirmed', color: 'bg-green-200 dark:bg-green-800/50 text-green-800 dark:text-green-200 border-green-400 dark:border-green-600/50' },
  };
  const s = map[status] || map.pending;
  return <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>;
});

const TaskPriorityBadge = React.memo(({ priority }) => {
  const map = {
    low: { label: 'Low', color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700/40' },
    medium: { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700/40' },
    high: { label: 'High', color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700/40' },
    urgent: { label: 'Urgent', color: 'text-red-700 dark:text-red-500 bg-red-200 dark:bg-red-900/30 border-red-400 dark:border-red-700/50' },
  };
  const p = map[priority] || map.medium;
  return <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${p.color}`}>{p.label}</span>;
});

// ─── Custom Dropdown ───────────────────────────────────────────────────
const CustomDropdown = React.memo(({ options, value, onChange, placeholder, label, brandColor }) => {
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
});

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

// ─── Confirm Modal ──────────────────────────────────────────────────
const ConfirmModal = React.memo(({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) => {
  if (!isOpen) return null;
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
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
});

// ─── Delete Task Confirm Modal ────────────────────────────────
const DeleteTaskConfirmModal = React.memo(({ isOpen, onClose, onConfirm, taskName }) => {
  const [inputValue, setInputValue] = useState('');
  const expectedPhrase = `I want to delete ${taskName}`;

  useEffect(() => {
    if (!isOpen) setInputValue('');
  }, [isOpen]);

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
          onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
        />
        <div className="flex gap-3">
          <button onClick={() => { onClose(); setInputValue(''); }} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button onClick={handleConfirm} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition">Delete</button>
        </div>
      </div>
    </div>
  );
});

// ─── Mark Complete Modal ────────────────────────────────────────────
const MarkCompleteModal = React.memo(({ isOpen, onClose, task, brandColor, onSubmit }) => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({ notes: notes.trim() });
      onClose();
      setNotes('');
    } catch (err) {
      // Error handled in parent
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Mark Task Complete</h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Confirm you have completed "{task?.title}". Add any final notes (optional).
        </p>
        <textarea
          placeholder="Completion notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-[#0d9488] outline-none mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            {loading ? 'Submitting...' : 'Complete'}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Confirm Completion Modal ──────────────────────────────────────
const ConfirmCompletionModal = React.memo(({ isOpen, onClose, task, brandColor, onSubmit }) => {
  const [feedback, setFeedback] = useState('');
  const [finalHours, setFinalHours] = useState('');
  const [finalLinksText, setFinalLinksText] = useState('');
  const [finalAttachments, setFinalAttachments] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFinalAttachments([...e.target.files]);
    e.target.value = '';
  };

  const removeFile = (index) => {
    setFinalAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const links = finalLinksText.split('\n').map(l => l.trim()).filter(Boolean);
      await onSubmit({
        feedback: feedback.trim(),
        finalHours: finalHours ? parseFloat(finalHours) : undefined,
        finalLinks: links.length ? links : undefined,
        finalAttachments,
      });
      onClose();
      // Reset
      setFeedback('');
      setFinalHours('');
      setFinalLinksText('');
      setFinalAttachments([]);
    } catch (err) {
      // Error handled in parent
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Confirm Task Completion</h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Provide final details for "{task?.title}" before confirming completion.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Feedback (optional)</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-[#0d9488] outline-none"
              placeholder="Any feedback for the assignee..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Actual Hours (optional)</label>
            <input
              type="number"
              step="0.5"
              value={finalHours}
              onChange={(e) => setFinalHours(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
              placeholder="e.g. 2.5"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Final Links (one per line, optional)</label>
            <textarea
              value={finalLinksText}
              onChange={(e) => setFinalLinksText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-[#0d9488] outline-none"
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Final Attachments (optional)</label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#0d9488]/20 file:text-[#0d9488]"
            />
            {finalAttachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {finalAttachments.map((f, i) => (
                  <div key={i} className="flex justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5">
                    <span className="text-sm truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"><FaTrashAlt className="text-xs" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            {loading ? 'Submitting...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Folder Select Modal ────────────────────────────────────────────────
const FolderSelectModal = React.memo(({ isOpen, onClose, folders, mode, task, onConfirm, brandColor }) => {
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedFolderId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const options = [
    { value: null, label: 'All Tasks (No Folder)', icon: <FaTasks className="text-gray-400" /> },
    ...folders.map(f => ({ value: f._id, label: f.name, icon: <FaFolder className="text-gray-400" /> })),
  ];

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(task._id, selectedFolderId);
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Operation failed');
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
});

// ─── Folder Access Management Modal ──────────────────────────────────
const FolderAccessModal = React.memo(({ isOpen, onClose, folder, projectMembers, currentUserId, initialAccessUsers, onSave, brandColor }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && folder) {
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
      toast.success('Folder access updated');
      onClose();
    } catch (error) {
      toast.error('Failed to update folder access.');
    } finally {
      setSubmitting(false);
    }
  };

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
});

// ─── Task Card ──────────────────────────────────────────────────────────
const TaskCard = React.memo(({
  task, onClick, brandColor, isActive, draggable, onDragStart, onDragEnd, onCopyClick, onMoveClick, readOnly, showArchived,
  onDragOver, onDrop, onDragLeave, dragOver,
}) => {
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
      draggable={draggable && !readOnly && !showArchived}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={onDragLeave}
      onClick={() => onClick(task._id)}
      className={`group relative bg-white dark:bg-[#14141a] rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
        isActive ? 'border-[#0d9488] shadow-[0_0_20px_rgba(13,148,136,0.15)]' : 'border-gray-200 dark:border-gray-800/40 hover:border-[#0d9488]/50'
      } ${draggable && !readOnly && !showArchived ? 'active:cursor-grabbing' : ''} ${readOnly || showArchived ? 'opacity-80' : ''} ${dragOver ? 'border-[#0d9488] bg-[#0d9488]/5' : ''}`}
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
            <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[120px] md:max-w-[200px] group-hover:text-gray-900 dark:group-hover:text-white transition">
              {displayTitle}
            </h4>
            {hasRecurrence && (
              <span className="flex-shrink-0 text-[10px] text-teal-600 dark:text-[#0d9488] flex items-center gap-0.5" title={`Recurring: ${recurrenceLabel}`}>
                <FaRedo className="text-[8px]" /> {recurrenceLabel}
              </span>
            )}
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
        {task.description && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2 truncate">{task.description}</p>}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-500 truncate max-w-[80px] md:max-w-[120px]">{assignee ? `${assignee.name}` : 'Unassigned'}</span>
          <span className="text-xs text-gray-500 dark:text-gray-500 truncate">{task.dueDate ? formatDateTime(task.dueDate) : 'No due'}</span>
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
});

// ─── Sub‑task Item ──────────────────────────────────────────────────────
const SubTaskItem = React.memo(({
  subTask, index, taskId, isAssignee, canManage, onRefresh, brandColor, readOnly,
  onDragStart, onDragOver, onDrop, onDragLeave, dragOver,
  onDragEnd,
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
  const fileInputRef = useRef(null);
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [confirmFeedback, setConfirmFeedback] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const hasDetails = subTask.notes || (subTask.links && subTask.links.length > 0) || (subTask.attachments && subTask.attachments.length > 0) || subTask.feedback || subTask.rejectedBy;

  const hasRecurrence = subTask.recurrenceType && subTask.recurrenceType !== 'none';
  const recurrenceLabel = subTask.recurrenceType === 'daily' ? 'Daily' : subTask.recurrenceType === 'weekly' ? 'Weekly' : '';

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
    setShowDeleteModal(true);
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
    pending: { label: 'Pending', color: 'text-gray-500 dark:text-gray-400' },
    done: { label: 'Done', color: 'text-blue-600 dark:text-blue-400' },
    confirmed: { label: 'Confirmed', color: 'text-green-600 dark:text-green-400' },
  };
  const st = statusMap[subTask.status] || statusMap.pending;

  const canDrag = !readOnly && (canManage || (isAssignee && subTask.status !== 'confirmed'));

  const handleDragStart = (e) => {
    if (!canDrag) {
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
        draggable={canDrag}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={onDragLeave}
        className={`flex flex-col py-2 border-b border-gray-100 dark:border-gray-800/20 last:border-0 transition-colors ${
          dragOver ? 'bg-[#0d9488]/5 border-[#0d9488]' : ''
        }`}
      >
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {canDrag && (
                <FaGripVertical className="text-gray-300 dark:text-gray-700 text-xs flex-shrink-0 cursor-grab" />
              )}
              <span className="text-sm font-medium text-gray-800 dark:text-gray-300 truncate max-w-[140px] md:max-w-[200px]">{subTask.title}</span>
              <span className={`text-[10px] font-medium ${st.color}`}>{st.label}</span>
              {hasRecurrence && (
                <span className="text-[10px] text-teal-600 dark:text-[#0d9488] flex items-center gap-0.5">
                  <FaRedo className="text-[8px]" /> {recurrenceLabel}
                </span>
              )}
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
            <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter reason..." className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none mb-4" onKeyDown={(e) => e.key === 'Enter' && handleRejectConfirm(rejectReason)} />
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(false)} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={() => handleRejectConfirm(rejectReason)} className="flex-1 py-2 bg-[#0d9488] text-white rounded-xl text-sm font-medium transition hover:opacity-80">Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}

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

// ─── Inline Form Components ──────────────────────────────────────────

const CreateTaskForm = React.memo(({ projectId, brandColor, assignableMembers, folders, onSuccess, onCancel }) => {
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

  const [recurrenceType, setRecurrenceType] = useState('none');
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const [showDetails, setShowDetails] = useState(false);

  const toggleDay = (day) => {
    if (recurrenceDays.includes(day)) {
      setRecurrenceDays(recurrenceDays.filter(d => d !== day));
    } else {
      setRecurrenceDays([...recurrenceDays, day].sort());
    }
  };

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
      fd.append('recurrenceType', recurrenceType);
      if (recurrenceType === 'weekly') {
        fd.append('recurrenceDays', JSON.stringify(recurrenceDays));
      }
      if (recurrenceEndDate) fd.append('recurrenceEndDate', recurrenceEndDate);
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

      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 text-sm text-[#0d9488] hover:text-[#14b8a6] transition"
      >
        <FaAngleDown className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        {showDetails ? 'Hide details' : 'Add more details'}
      </button>

      {showDetails && (
        <>
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
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recurrence</label>
            <select
              value={recurrenceType}
              onChange={(e) => {
                setRecurrenceType(e.target.value);
                if (e.target.value !== 'weekly') setRecurrenceDays([]);
              }}
              className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
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
                        ? 'bg-[#0d9488] text-white'
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
                className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
              />
            </div>
          )}

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
        </>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Creating...' : 'Create Task'}</button>
      </div>
    </form>
  );
});

const EditTaskForm = React.memo(({ task, brandColor, assignableMembers, folders, onSuccess, onCancel }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [taskType, setTaskType] = useState(task?.taskType || 'general');
  const [assigneeId, setAssigneeId] = useState(task?.assignee?._id || task?.assignee || '');
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

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setTaskType(task.taskType || 'general');
      setAssigneeId(task.assignee?._id || task.assignee || '');
      setPriority(task.priority || 'medium');
      setStartDate(task.startDate ? new Date(task.startDate).toISOString().slice(0, 16) : '');
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');
      setStatus(task.status || 'pending');
      setEstimatedHours(task.estimatedHours || '');
      setBufferTime(task.bufferTime || 0);
      setAllowAssigneeEditSubtasks(task.allowAssigneeEditSubtasks || false);
      setLinks((task.links || []).join('\n'));
      setFolderId(task.folder?._id || null);
      setDailyReminderTime(task.dailyReminderTime || '');
      setRecurrenceType(task.recurrenceType || 'none');
      setRecurrenceDays(task.recurrenceDays || []);
      setRecurrenceEndDate(task.recurrenceEndDate ? new Date(task.recurrenceEndDate).toISOString().slice(0, 16) : '');
    }
  }, [task]);

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
      fd.append('recurrenceType', recurrenceType);
      if (recurrenceType === 'weekly') {
        fd.append('recurrenceDays', JSON.stringify(recurrenceDays));
      }
      if (recurrenceEndDate) fd.append('recurrenceEndDate', recurrenceEndDate);
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
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recurrence</label>
        <select
          value={recurrenceType}
          onChange={(e) => {
            setRecurrenceType(e.target.value);
            if (e.target.value !== 'weekly') setRecurrenceDays([]);
          }}
          className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
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
                    ? 'bg-[#0d9488] text-white'
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
            className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
          />
        </div>
      )}

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
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Updating...' : 'Update Task'}</button>
      </div>
    </form>
  );
});

const AddMemberForm = React.memo(({ project, workspace, brandColor, onSuccess, onCancel, onAddManager }) => {
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
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
        <button type="submit" disabled={loading || available.length === 0} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Adding...' : 'Add'}</button>
      </div>
    </form>
  );
});

const AssignForm = React.memo(({ assignableMembers, onAssign, brandColor, onCancel }) => {
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
      onCancel();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CustomDropdown label="Select Member" options={assigneeOpts} value={assigneeId} onChange={setAssigneeId} brandColor={brandColor} />
      <div className="flex gap-3 mt-4">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Assigning...' : 'Assign'}</button>
      </div>
    </form>
  );
});

// ─── Main Component ──────────────────────────────────────────────────
const MyWorkspaceProjectId = () => {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  // ─── All hooks called unconditionally FIRST ──────────────────────

  // State
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTaskTarget, setAssignTaskTarget] = useState(null);
  const [addSubTaskOpen, setAddSubTaskOpen] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [newSubTaskStart, setNewSubTaskStart] = useState('');
  const [newSubTaskDue, setNewSubTaskDue] = useState('');
  const [newSubTaskRecurrenceType, setNewSubTaskRecurrenceType] = useState('none');
  const [newSubTaskRecurrenceDays, setNewSubTaskRecurrenceDays] = useState([]);
  const [newSubTaskRecurrenceEndDate, setNewSubTaskRecurrenceEndDate] = useState('');
  const [addingSubTask, setAddingSubTask] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, danger: false });
  const [deleteTaskModal, setDeleteTaskModal] = useState({ isOpen: false, taskName: '', onConfirm: () => {} });
  const [addManagerConfirm, setAddManagerConfirm] = useState({ isOpen: false, managerName: '', managerId: '' });
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRenameFolder, setShowRenameFolder] = useState(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [folderAccessModal, setFolderAccessModal] = useState({ isOpen: false, folder: null });
  const [folderActionModal, setFolderActionModal] = useState({ isOpen: false, mode: 'copy', task: null });
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [draggedOverTabId, setDraggedOverTabId] = useState(null);
  const [isDraggingSomething, setIsDraggingSomething] = useState(false);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [draggedSubIdx, setDraggedSubIdx] = useState(null);
  const [dragOverSubIdx, setDragOverSubIdx] = useState(null);
  const [leftWidthPercent, setLeftWidthPercent] = useState(35);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const containerRef = useRef(null);
  const isMd = useMediaQuery('(min-width: 768px)');

  // ── New modals state ──
  const [showMarkCompleteModal, setShowMarkCompleteModal] = useState(false);
  const [showConfirmCompletionModal, setShowConfirmCompletionModal] = useState(false);

  // ── Mobile folder long-press menu ─────────────────────────────────
  const [folderMenuOpen, setFolderMenuOpen] = useState(null);
  const longPressTimer = useRef(null);

  // Data fetching hooks
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
  const { data: foldersData, isLoading: foldersLoading, refetch: refetchFolders } = useGetProjectFoldersQuery(projectId, { skip: !projectId });
  const { data: feedbackData } = useGetTaskFeedbackQuery({ taskId: selectedTaskId }, { skip: !selectedTaskId });

  // Mutation hooks
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
  const [addSubTask] = useAddSubTaskMutation();
  const [addFolderReadOnly] = useAddFolderReadOnlyMutation();
  const [removeFolderReadOnly] = useRemoveFolderReadOnlyMutation();
  const [removeTeamMember] = useRemoveTeamMemberMutation();
  const [manageProjectManagers] = useManageProjectManagersMutation();
  const [reorderTasks] = useReorderTasksMutation();
  const [reorderSubTasks] = useReorderSubTasksMutation();
  const [createTask] = useCreateTaskMutation(); // for optimistic creation
  const [markTaskCompleted] = useMarkTaskCompletedMutation(); // for assignee
  const [updateTask] = useUpdateTaskMutation(); // for setting ready

  // Derived data (useMemo)
  const workspace = wData?.workspace;
  const project = pData?.project;
  const folders = foldersData?.folders || [];

  // Local state for tasks and folders (optimistic updates)
  const [localTasks, setLocalTasks] = useState([]);
  const [localFolders, setLocalFolders] = useState([]);

  useEffect(() => {
    setLocalTasks(tData?.tasks || []);
  }, [tData]);

  useEffect(() => {
    setLocalFolders(foldersData?.folders || []);
  }, [foldersData]);

  const tasks = localTasks;
  const visibleFolders = localFolders; // we'll filter later

  const activeTeam = useMemo(() => (project?.teamMembers || []).filter(m => m.status === 'active'), [project?.teamMembers]);

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
  const isOwner = useMemo(() => workspace?.owner?._id === userInfo?._id || workspace?.owner === userInfo?._id, [workspace, userInfo]);
  const isManager = useMemo(() => project?.projectManagers?.some(pm => {
    const id = (pm._id || pm)?.toString();
    return id === userInfo?._id;
  }), [project, userInfo]);
  const canManage = isOwner || isManager;

  const activeTask = useMemo(() => tasks.find(t => t._id === selectedTaskId) || null, [tasks, selectedTaskId]);
  const projectManagers = project?.projectManagers || [];
  const projectProgress = project?.progress || 0;

  const availableForManager = useMemo(() => workspace?.members?.filter(m => m.status === 'active' && !projectManagers.some(pm => pm._id === (m.user?._id || m._id))) || [], [workspace, projectManagers]);
  const managerOptions = useMemo(() => availableForManager.map(m => {
    const u = m.user || m;
    return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" /> : <FaUser className="text-gray-400" /> };
  }), [availableForManager]);

  const isFolderReadOnly = useCallback((folderId) => {
    if (canManage) return false;
    const hasAssigned = tasks.some(t => {
      const fid = t.folder?._id || t.folder;
      return fid === folderId && t.assignee?._id === userInfo?._id;
    });
    if (hasAssigned) return false;
    return visibleFolders.some(f => f._id === folderId);
  }, [canManage, tasks, userInfo, visibleFolders]);

  // ─── Effects ───────────────────────────────────────────────────────
  useEffect(() => {
    if (showArchived) {
      setActiveFolderId(null);
    }
  }, [showArchived]);

  // ─── Splitter handlers (useCallback) ───────────────────────────────
  const handleSplitterMouseMove = useCallback((e) => {
    if (!isDraggingSplitter || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    let newWidth = ((e.clientX - containerRect.left) / containerWidth) * 100;
    newWidth = Math.min(70, Math.max(20, newWidth));
    setLeftWidthPercent(newWidth);
  }, [isDraggingSplitter]);

  const handleSplitterMouseUp = useCallback(() => {
    setIsDraggingSplitter(false);
    document.removeEventListener('mousemove', handleSplitterMouseMove);
    document.removeEventListener('mouseup', handleSplitterMouseUp);
  }, [handleSplitterMouseMove]);

  const handleSplitterMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
    document.addEventListener('mousemove', handleSplitterMouseMove);
    document.addEventListener('mouseup', handleSplitterMouseUp);
  }, [handleSplitterMouseMove, handleSplitterMouseUp]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleSplitterMouseMove);
      document.removeEventListener('mouseup', handleSplitterMouseUp);
    };
  }, [handleSplitterMouseMove, handleSplitterMouseUp]);

  // ─── Optimistic task creation ────────────────────────────────────────
  const handleCreateTaskOptimistic = useCallback(async (formData) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const optimisticTask = {
      _id: tempId,
      title: formData.title,
      description: formData.description || '',
      taskType: formData.taskType || 'general',
      priority: formData.priority || 'medium',
      status: 'pending',
      progress: 0,
      assignee: formData.assigneeId ? { _id: formData.assigneeId, name: 'Loading...' } : null,
      folder: formData.folderId ? { _id: formData.folderId, name: visibleFolders.find(f => f._id === formData.folderId)?.name || 'Folder' } : null,
      startDate: formData.startDate || null,
      dueDate: formData.dueDate || null,
      estimatedHours: formData.estimatedHours || 0,
      bufferTime: parseFloat(formData.bufferTime) || 0,
      allowAssigneeEditSubtasks: formData.allowAssigneeEditSubtasks || false,
      recurrenceType: formData.recurrenceType || 'none',
      recurrenceDays: formData.recurrenceDays || [],
      recurrenceEndDate: formData.recurrenceEndDate || null,
      links: formData.links || [],
      attachments: [],
      subTasks: [],
      isArchived: false,
      isTrash: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setLocalTasks(prev => [optimisticTask, ...prev]);

    try {
      const fd = new FormData();
      fd.append('projectId', formData.projectId);
      fd.append('title', formData.title);
      fd.append('description', formData.description);
      fd.append('taskType', formData.taskType);
      if (formData.assigneeId) fd.append('assigneeId', formData.assigneeId);
      fd.append('priority', formData.priority);
      if (formData.startDate) fd.append('startDate', new Date(formData.startDate).toISOString());
      if (formData.dueDate) fd.append('dueDate', new Date(formData.dueDate).toISOString());
      if (formData.estimatedHours) fd.append('estimatedHours', formData.estimatedHours);
      fd.append('bufferTime', formData.bufferTime);
      fd.append('links', JSON.stringify(formData.links || []));
      fd.append('allowAssigneeEditSubtasks', formData.allowAssigneeEditSubtasks);
      if (formData.folderId) fd.append('folderId', formData.folderId);
      if (formData.dailyReminderTime) fd.append('dailyReminderTime', formData.dailyReminderTime);
      fd.append('recurrenceType', formData.recurrenceType);
      if (formData.recurrenceType === 'weekly') {
        fd.append('recurrenceDays', JSON.stringify(formData.recurrenceDays));
      }
      if (formData.recurrenceEndDate) fd.append('recurrenceEndDate', formData.recurrenceEndDate);
      formData.attachments?.forEach(file => fd.append('attachments', file));

      const result = await createTask(fd).unwrap();
      setLocalTasks(prev => prev.map(t => t._id === tempId ? result.task : t));
      refetchTasks();
      refetchProject();
    } catch (err) {
      setLocalTasks(prev => prev.filter(t => t._id !== tempId));
      toast.error(err?.data?.message || 'Failed to create task');
      throw err;
    }
  }, [createTask, refetchTasks, refetchProject, visibleFolders]);

  // ─── Optimistic folder delete ────────────────────────────────────────
  const handleDeleteFolderOptimistic = useCallback(async (folderId) => {
    const folderToDelete = localFolders.find(f => f._id === folderId);
    if (!folderToDelete) return;

    // Remove from local state optimistically
    setLocalFolders(prev => prev.filter(f => f._id !== folderId));
    if (activeFolderId === folderId) {
      setActiveFolderId(null);
    }

    try {
      await deleteFolder(folderId).unwrap();
      toast.success('Folder deleted');
      refetchFolders();
      refetchTasks();
    } catch (err) {
      // Revert on error
      setLocalFolders(prev => [...prev, folderToDelete]);
      toast.error(err?.data?.message || 'Failed to delete folder');
    }
  }, [localFolders, deleteFolder, refetchFolders, refetchTasks, activeFolderId]);

  // ─── Handlers (useCallback) ────────────────────────────────────────
  const refreshAll = useCallback(() => { refetchTasks(); refetchProject(); }, [refetchTasks, refetchProject]);

  const handleSaveFolderPermissions = useCallback(async (folderId, selectedUserIds) => {
    const folder = localFolders.find(f => f._id === folderId);
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
  }, [localFolders, addFolderReadOnly, removeFolderReadOnly, refetchFolders, refetchTasks]);

  const handleDeleteTask = useCallback((task) => {
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
  }, [deleteTask, refetchTasks, refetchProject, selectedTaskId]);

  const handleEditTask = useCallback((task) => { setSelectedTask(task); setShowEditTask(true); }, []);
  const handleRemoveMember = useCallback((id) => {
    setConfirmModal({
      isOpen: true, title: 'Remove Member', message: 'Are you sure?', onConfirm: async () => {
        try { await removeTeamMember({ projectId, memberId: id }).unwrap(); toast.success('Removed'); refetchProject(); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
      }, danger: true,
    });
  }, [removeTeamMember, projectId, refetchProject]);

  const handleAddManager = useCallback((id, name) => setAddManagerConfirm({ isOpen: true, managerName: name, managerId: id }), []);
  const confirmAddManager = useCallback(async () => {
    try {
      await manageProjectManagers({ projectId, action: 'add', managerId: addManagerConfirm.managerId }).unwrap();
      toast.success('Manager added');
      refetchProject();
      setAddManagerConfirm({ isOpen: false, managerName: '', managerId: '' });
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [manageProjectManagers, projectId, addManagerConfirm.managerId, refetchProject]);

  const handleRemoveManager = useCallback((id) => {
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
  }, [manageProjectManagers, projectId, refetchProject]);

  const handleTaskClick = useCallback((taskId) => { setSelectedTaskId(taskId); setMobileShowDetail(true); }, []);
  const handleBackToList = useCallback(() => { setSelectedTaskId(null); setMobileShowDetail(false); }, []);

  const handleSendManualReminder = useCallback(async (task) => {
    try { await sendManualReminder({ taskId: task._id, message: '' }).unwrap(); toast.success('Reminder sent'); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [sendManualReminder]);

  // ── Modified handlers for completion ──
  const handleMarkComplete = useCallback(async (notes) => {
    try {
      await markTaskCompleted({ taskId: activeTask._id, notes }).unwrap();
      toast.success('Task marked as complete');
      refreshAll();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to mark task complete');
      throw err;
    }
  }, [activeTask, markTaskCompleted, refreshAll]);

  const handleConfirmCompletion = useCallback(async (data) => {
    try {
      const fd = new FormData();
      fd.append('feedback', data.feedback || '');
      if (data.finalHours !== undefined) fd.append('finalHours', data.finalHours.toString());
      if (data.finalLinks) {
        data.finalLinks.forEach(l => fd.append('finalLinks', l));
      }
      if (data.finalAttachments) {
        data.finalAttachments.forEach(f => fd.append('finalAttachments', f));
      }
      await confirmTaskCompletion({ taskId: activeTask._id, data: fd }).unwrap();
      toast.success('Task completion confirmed');
      refreshAll();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to confirm completion');
      throw err;
    }
  }, [activeTask, confirmTaskCompletion, refreshAll]);

  // ── FIXED: Set task status to "ready_for_completion" ──
  const handleSetReadyForCompletion = useCallback(async () => {
    const previousStatus = activeTask.status;
    try {
      // Optimistic update
      setLocalTasks(prev => prev.map(t =>
        t._id === activeTask._id ? { ...t, status: 'ready_for_completion' } : t
      ));
      await updateTask({ taskId: activeTask._id, data: { status: 'ready_for_completion' } }).unwrap();
      toast.success('Task is now ready for completion');
      refreshAll();
    } catch (err) {
      // Revert optimistic update
      setLocalTasks(prev => prev.map(t =>
        t._id === activeTask._id ? { ...t, status: previousStatus } : t
      ));
      toast.error(err?.data?.message || 'Failed to update task status');
    }
  }, [activeTask, updateTask, refreshAll]);

  const handleAssignTask = useCallback(async (assigneeId) => {
    try {
      await assignTask({ taskId: assignTaskTarget._id, assigneeId }).unwrap();
      toast.success('Task assigned'); refetchTasks(); setShowAssignModal(false); setAssignTaskTarget(null);
    } catch (e) { throw e; }
  }, [assignTask, assignTaskTarget, refetchTasks]);

  const openAssignModal = useCallback((task) => { setAssignTaskTarget(task); setShowAssignModal(true); }, []);

  const handleArchiveTask = useCallback(async (taskId) => {
    try {
      await archiveTask(taskId).unwrap();
      toast.success('Archived');
      refetchTasks();
      if (showArchived) setShowArchived(true);
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [archiveTask, refetchTasks, showArchived]);

  const handleUnarchiveTask = useCallback(async (taskId) => {
    try {
      await restoreTask(taskId).unwrap();
      toast.success('Restored to active');
      refetchTasks();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [restoreTask, refetchTasks]);

  const handleRestoreTask = useCallback(async (taskId) => {
    try {
      await restoreTask(taskId).unwrap();
      toast.success('Restored from trash');
      refetchTasks();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [restoreTask, refetchTasks]);

  const handlePermanentlyDeleteTask = useCallback((taskId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Permanently Delete Task',
      message: 'This action cannot be undone. Are you sure?',
      confirmText: 'Delete Permanently',
      danger: true,
      onConfirm: async () => {
        try {
          await permanentlyDeleteTask(taskId).unwrap();
          toast.success('Permanently deleted');
          refetchTasks();
          refetchProject();
          if (selectedTaskId === taskId) { setSelectedTaskId(null); setMobileShowDetail(false); }
        } catch (e) { toast.error(e?.data?.message || 'Failed'); }
      }
    });
  }, [permanentlyDeleteTask, refetchTasks, refetchProject, selectedTaskId]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return toast.error('Folder name required');
    try {
      const result = await createFolder({ projectId, name: newFolderName.trim() }).unwrap();
      // Add folder optimistically
      setLocalFolders(prev => [...prev, result.folder]);
      toast.success('Folder created');
      setNewFolderName('');
      setShowCreateFolder(false);
      refetchFolders();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [createFolder, projectId, newFolderName, refetchFolders]);

  const handleDeleteFolder = useCallback((folderId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Folder',
      message: 'Deleting this folder will unlink its tasks. Are you sure?',
      confirmText: 'Delete',
      danger: true,
      onConfirm: () => handleDeleteFolderOptimistic(folderId),
    });
  }, [handleDeleteFolderOptimistic]);

  const handleRenameFolder = useCallback(async (folderId) => {
    if (!renameFolderName.trim()) return toast.error('Name required');
    try {
      await updateFolder({ folderId, name: renameFolderName.trim() }).unwrap();
      toast.success('Folder renamed');
      setShowRenameFolder(null);
      setRenameFolderName('');
      refetchFolders();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [updateFolder, renameFolderName, refetchFolders]);

  const handleAddSubTask = useCallback(async () => {
    if (!newSubTaskTitle.trim()) {
      toast.error('Sub‑task title required');
      return;
    }
    setAddingSubTask(true);
    try {
      const payload = {
        title: newSubTaskTitle.trim(),
        startDate: newSubTaskStart || null,
        dueDate: newSubTaskDue || null,
        recurrenceType: newSubTaskRecurrenceType,
        recurrenceDays: newSubTaskRecurrenceType === 'weekly' ? newSubTaskRecurrenceDays : [],
        recurrenceEndDate: newSubTaskRecurrenceEndDate || null,
      };
      await addSubTask({
        taskId: activeTask._id,
        data: payload,
      }).unwrap();
      toast.success('Sub‑task added');
      setNewSubTaskTitle('');
      setNewSubTaskStart('');
      setNewSubTaskDue('');
      setNewSubTaskRecurrenceType('none');
      setNewSubTaskRecurrenceDays([]);
      setNewSubTaskRecurrenceEndDate('');
      setAddSubTaskOpen(false);
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to add sub‑task');
    } finally {
      setAddingSubTask(false);
    }
  }, [newSubTaskTitle, newSubTaskStart, newSubTaskDue, newSubTaskRecurrenceType, newSubTaskRecurrenceDays, newSubTaskRecurrenceEndDate, addSubTask, activeTask, refetchTasks]);

  const openCopyModal = useCallback((task) => setFolderActionModal({ isOpen: true, mode: 'copy', task }), []);
  const openMoveModal = useCallback((task) => setFolderActionModal({ isOpen: true, mode: 'move', task }), []);
  const closeFolderActionModal = useCallback(() => setFolderActionModal({ isOpen: false, mode: 'copy', task: null }), []);

  const handleFolderActionConfirm = useCallback(async (taskId, targetFolderId) => {
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
  }, [folderActionModal.mode, copyTask, moveTask, refetchTasks, closeFolderActionModal]);

  // ── Folder-tab drag handlers ──
  const handleDragStart = useCallback((e, task) => {
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
  }, [isFolderReadOnly]);

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDraggedOverTabId(null);
    setIsDraggingSomething(false);
  }, []);

  const handleDragOver = useCallback((e, folderId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedOverTabId !== folderId) setDraggedOverTabId(folderId);
  }, [draggedOverTabId]);

  const handleDragLeave = useCallback((e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDraggedOverTabId(null);
  }, []);

  const handleDrop = useCallback(async (e, folderId) => {
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

    const previousTasks = tasks;
    setLocalTasks(prev => prev.filter(t => t._id !== taskId));

    try {
      await moveTask({ taskId, targetFolderId: folderId }).unwrap();
      toast.success('Task moved');
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to move task');
      setLocalTasks(previousTasks);
    }
  }, [draggedTaskId, canManage, isFolderReadOnly, tasks, moveTask, refetchTasks]);

  // ── Task reordering ──
  const handleTaskDragStart = useCallback((e, task) => {
    const folderId = task.folder?._id || task.folder;
    if (folderId && isFolderReadOnly(folderId)) {
      e.preventDefault();
      toast.error('Cannot reorder a task from a read‑only folder.');
      return;
    }
    if (!canManage) {
      e.preventDefault();
      toast.error('You do not have permission to reorder tasks.');
      return;
    }
    handleDragStart(e, task);
  }, [isFolderReadOnly, canManage, handleDragStart]);

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
    setIsDraggingSomething(false);

    try {
      await reorderTasks({ projectId, orderedTaskIds: orderedIds }).unwrap();
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to reorder tasks');
      setLocalTasks(previousTasks);
    }
  }, [draggedTaskId, tasks, reorderTasks, projectId, refetchTasks]);

  // ── Sub‑task reordering ──
  const handleSubDragStart = useCallback((e, index) => {
    if (!canManage && !(activeTask?.assignee?._id === userInfo?._id && activeTask?.allowAssigneeEditSubtasks)) {
      e.preventDefault();
      toast.error('You do not have permission to reorder sub‑tasks.');
      return;
    }
    setDraggedSubIdx(index);
  }, [canManage, activeTask, userInfo]);

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

  const toggleArchived = useCallback(() => {
    setShowArchived(prev => !prev);
    setActiveFolderId(null);
    setSelectedTaskId(null);
    setMobileShowDetail(false);
  }, []);

  const isActiveFolderReadOnly = activeFolderId ? isFolderReadOnly(activeFolderId) : false;
  const canReorderTasks = canManage && !showArchived;

  // ── Long press handlers for folder options ────────────────────────
  const handleTouchStart = (e, folderId) => {
    if (!canManage) return;
    longPressTimer.current = setTimeout(() => {
      setFolderMenuOpen(folderId);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  const handleTouchMove = () => {
    clearTimeout(longPressTimer.current);
  };

  // ── Early returns AFTER all hooks ─────────────────────────────────
  if (wErr || pErr) { navigate(`/my-workspace/${workspaceId}/projects`); return null; }
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
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-3 md:px-4 h-14 lg:h-16">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => navigate(`/my-workspace/${workspaceId}/projects`)} className="p-1 lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"><FaArrowLeft className="text-sm" /></button>
              <div className="flex items-center gap-2 min-w-0">
                {project.coverImage ? (
                  <img src={project.coverImage} className="w-8 h-8 md:w-10 md:h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700/60" alt="" />
                ) : (
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm md:text-base" style={{ backgroundColor: brandColor }}>
                    <FaFolder className="text-base md:text-lg" />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[120px] md:max-w-xs">{project.name}</h1>
                  <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <FaChartLine className="text-[#0d9488] text-[8px] md:text-[10px]" />
                      {projectProgress}% done
                    </span>
                    <span className="w-0.5 h-0.5 bg-gray-400 dark:bg-gray-600 rounded-full" />
                    <span className="flex items-center gap-1">
                      <FaUsers className="text-[8px] md:text-[10px]" />
                      {activeTeam.length} members
                      {canManage && (
                        <button onClick={() => setShowAddMember(true)} className="text-[#0d9488] hover:text-[#14b8a6] transition ml-0.5">
                          <FaPlus className="text-[8px] md:text-[10px]" />
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <button onClick={() => setSearchOpen(true)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"><FaSearch className="text-xs md:text-sm" /></button>
              {canManage && !showArchived && (
                <button onClick={() => setShowCreateTask(true)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"><FaPlus className="text-xs md:text-sm" /></button>
              )}
            </div>
          </div>

          {/* Tabs - scrollable horizontally */}
          <div className="flex items-center gap-1 px-3 md:px-4 border-t border-gray-200 dark:border-gray-800/30 overflow-x-auto scrollbar-hide py-1">
            <div
              onClick={() => { setActiveFolderId(null); setShowArchived(false); setMobileShowDetail(false); setSelectedTaskId(null); }}
              onDragOver={(e) => !showArchived && handleDragOver(e, null)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => !showArchived && handleDrop(e, null)}
              className={`relative flex-shrink-0 cursor-pointer text-xs md:text-sm font-medium transition px-2.5 md:px-3 py-1.5 rounded-xl whitespace-nowrap ${
                !showArchived && activeFolderId === null
                  ? 'bg-[#0d9488]/10 text-[#0d9488]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              } ${!showArchived && draggedOverTabId === null && isDraggingSomething ? 'ring-2 ring-[#0d9488] ring-offset-2 bg-[#0d9488]/5' : ''}`}
            >
              All Tasks
              {!showArchived && draggedOverTabId === null && isDraggingSomething && (
                <span className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-[9px] font-medium text-[#0d9488] bg-white dark:bg-[#0f0f12] px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                  Move here?
                </span>
              )}
            </div>

            <div
              onClick={toggleArchived}
              className={`flex-shrink-0 cursor-pointer text-xs md:text-sm font-medium transition px-2.5 md:px-3 py-1.5 rounded-xl whitespace-nowrap ${
                showArchived
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <span className="flex items-center gap-1"><FaArchive className="text-[10px] md:text-xs" /> Archived</span>
            </div>

            {!showArchived && localFolders.map(folder => {
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
                    onTouchStart={(e) => handleTouchStart(e, folder._id)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    className={`flex items-center gap-1 cursor-pointer text-xs md:text-sm font-medium transition px-2.5 md:px-3 py-1.5 rounded-xl whitespace-nowrap ${
                      !showArchived && activeFolderId === folder._id
                        ? 'bg-[#0d9488]/10 text-[#0d9488]'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    } ${!showArchived && draggedOverTabId === folder._id && isDraggingSomething ? 'ring-2 ring-[#0d9488] ring-offset-2 bg-[#0d9488]/5' : ''}`}
                  >
                    <span className="truncate max-w-[80px] md:max-w-[120px]">{folder.name}</span>
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
                      <span className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-[9px] font-medium text-[#0d9488] bg-white dark:bg-[#0f0f12] px-1.5 py-0.5 rounded shadow whitespace-nowrap">
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

        {/* Mobile folder menu (long press) */}
        {folderMenuOpen && canManage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4" onClick={() => setFolderMenuOpen(null)}>
            <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-sm w-full p-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col gap-2">
                <button onClick={() => { setFolderMenuOpen(null); const f = localFolders.find(f => f._id === folderMenuOpen); if (f) { setShowRenameFolder(f._id); setRenameFolderName(f.name); } }} className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-[#1a1a24] rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 transition">
                  <FaPen className="text-blue-500" /> Rename Folder
                </button>
                <button onClick={() => { setFolderMenuOpen(null); const f = localFolders.find(f => f._id === folderMenuOpen); if (f) setFolderAccessModal({ isOpen: true, folder: f }); }} className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-[#1a1a24] rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 transition">
                  <FaLockOpen className="text-yellow-500" /> Manage Access
                </button>
                <button onClick={() => { setFolderMenuOpen(null); handleDeleteFolder(folderMenuOpen); }} className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-800/30 transition text-red-600 dark:text-red-400">
                  <FaTrashAlt className="text-xs" /> Delete Folder
                </button>
                <button onClick={() => setFolderMenuOpen(null)} className="mt-2 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Split pane */}
        <div className="flex-1 flex overflow-hidden" ref={containerRef}>
          <div
            className={`flex flex-col h-full overflow-hidden flex-shrink-0 border-r border-gray-200 dark:border-gray-800/40 bg-gray-50 dark:bg-[#0f0f12] ${!isMd && mobileShowDetail ? 'hidden' : ''}`}
            style={{ width: isMd ? `${leftWidthPercent}%` : (mobileShowDetail ? '0%' : '100%') }}
          >
            <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-20 md:pb-4">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-500">
                  <FaTasks className="text-3xl md:text-4xl mb-2 opacity-30" />
                  <p className="text-xs md:text-sm">{showArchived ? 'No archived tasks' : 'No tasks in this view'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {tasks.map(task => {
                    const folderId = task.folder?._id || task.folder;
                    const readOnly = !canManage && folderId && isFolderReadOnly(folderId);
                    const isDragOver = dragOverTaskId === task._id;
                    return (
                      <TaskCard
                        key={task._id}
                        task={task}
                        onClick={handleTaskClick}
                        brandColor={brandColor}
                        isActive={selectedTaskId === task._id}
                        draggable={canReorderTasks && !readOnly && !showArchived}
                        onDragStart={handleTaskDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleTaskDragOver}
                        onDragLeave={handleTaskDragLeave}
                        onDrop={handleTaskDrop}
                        onCopyClick={openCopyModal}
                        onMoveClick={openMoveModal}
                        readOnly={readOnly}
                        showArchived={showArchived}
                        dragOver={isDragOver}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {isMd && (
            <div
              className="hidden md:flex items-center justify-center w-2 flex-shrink-0 bg-transparent hover:bg-[#0d9488]/10 cursor-col-resize transition-colors duration-150 select-none"
              onMouseDown={handleSplitterMouseDown}
              style={{ touchAction: 'none' }}
            >
              <div className="w-0.5 h-12 bg-gray-300 dark:bg-gray-700 rounded-full hover:bg-[#0d9488] transition" />
            </div>
          )}

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
                    <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[180px] md:max-w-full">{formatTaskTitle(activeTask.title)}</h2>
                    <div className="flex items-center gap-1.5 text-xs flex-wrap">
                      <TaskStatusBadge status={activeTask.status} />
                      <TaskPriorityBadge priority={activeTask.priority} />
                      {activeTask.recurrenceType && activeTask.recurrenceType !== 'none' && (
                        <span className="flex items-center gap-0.5 text-teal-600 dark:text-[#0d9488]">
                          <FaRedo className="text-[10px]" /> {activeTask.recurrenceType === 'daily' ? 'Daily' : 'Weekly'}
                        </span>
                      )}
                      {activeTask.assignee && <span className="text-gray-500 dark:text-gray-400 truncate max-w-[80px] md:max-w-[120px]">{activeTask.assignee.name}</span>}
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

                  {/* ─── Show final details if confirmed ─── */}
                  {activeTask.status === 'confirmed_completed' && (
                    <div className="mt-3 bg-gray-50 dark:bg-[#1a1a24] p-3 rounded-xl border border-gray-200 dark:border-gray-800/40 space-y-1">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Final Details</p>
                      {activeTask.completionFeedback && <div><span className="font-medium text-gray-600 dark:text-gray-400">Feedback:</span> {activeTask.completionFeedback}</div>}
                      {activeTask.actualHours !== undefined && activeTask.actualHours !== null && <div><span className="font-medium text-gray-600 dark:text-gray-400">Actual Hours:</span> {activeTask.actualHours}</div>}
                      {activeTask.finalLinks && activeTask.finalLinks.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Final Links:</span>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {activeTask.finalLinks.map((l, i) => (
                              <React.Fragment key={i}>
                                <a href={l} target="_blank" rel="noopener noreferrer" className="text-[#0d9488] underline break-all">{l}</a>
                                {i < activeTask.finalLinks.length - 1 && <span className="text-gray-500">,</span>}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      )}
                      {activeTask.finalAttachments && activeTask.finalAttachments.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Final Attachments:</span>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {activeTask.finalAttachments.map((att, i) => (
                              <React.Fragment key={i}>
                                <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[#0d9488] underline break-all">{att.name || 'file'}</a>
                                {i < activeTask.finalAttachments.length - 1 && <span className="text-gray-500">,</span>}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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

                  {addSubTaskOpen && (
                    <div className="bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-gray-800/60 rounded-xl p-3 mb-3 w-full space-y-2">
                      <input
                        type="text"
                        placeholder="Sub‑task title"
                        value={newSubTaskTitle}
                        onChange={(e) => setNewSubTaskTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-[#0d9488] outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddSubTask()}
                      />
                      <input
                        type="datetime-local"
                        placeholder="Start date & time"
                        value={newSubTaskStart}
                        onChange={(e) => setNewSubTaskStart(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
                      />
                      <input
                        type="datetime-local"
                        placeholder="Due date & time"
                        value={newSubTaskDue}
                        onChange={(e) => setNewSubTaskDue(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
                      />
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recurrence</label>
                        <select
                          value={newSubTaskRecurrenceType}
                          onChange={(e) => {
                            setNewSubTaskRecurrenceType(e.target.value);
                            if (e.target.value !== 'weekly') setNewSubTaskRecurrenceDays([]);
                          }}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
                        >
                          <option value="none">None</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                        </select>
                      </div>
                      {newSubTaskRecurrenceType === 'weekly' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Repeat on</label>
                          <div className="flex flex-wrap gap-2">
                            {weekDays.map((day, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  if (newSubTaskRecurrenceDays.includes(idx)) {
                                    setNewSubTaskRecurrenceDays(newSubTaskRecurrenceDays.filter(d => d !== idx));
                                  } else {
                                    setNewSubTaskRecurrenceDays([...newSubTaskRecurrenceDays, idx].sort());
                                  }
                                }}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                                  newSubTaskRecurrenceDays.includes(idx)
                                    ? 'bg-[#0d9488] text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {(newSubTaskRecurrenceType === 'daily' || newSubTaskRecurrenceType === 'weekly') && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date (optional)</label>
                          <input
                            type="datetime-local"
                            value={newSubTaskRecurrenceEndDate}
                            onChange={(e) => setNewSubTaskRecurrenceEndDate(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
                          />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setAddSubTaskOpen(false);
                            setNewSubTaskTitle('');
                            setNewSubTaskStart('');
                            setNewSubTaskDue('');
                            setNewSubTaskRecurrenceType('none');
                            setNewSubTaskRecurrenceDays([]);
                            setNewSubTaskRecurrenceEndDate('');
                          }}
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
                    (activeTask.subTasks || []).map((st, idx) => {
                      const canReorderSub = !isActiveFolderReadOnly && !activeTask.isArchived &&
                        (canManage || (activeTask.assignee?._id === userInfo?._id && activeTask.allowAssigneeEditSubtasks));
                      const isDragOverSub = dragOverSubIdx === idx;
                      return (
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
                          onDragStart={canReorderSub ? handleSubDragStart : null}
                          onDragOver={canReorderSub ? handleSubDragOver : null}
                          onDrop={canReorderSub ? handleSubDrop : null}
                          onDragLeave={handleSubDragLeave}
                          onDragEnd={canReorderSub ? handleSubDragEnd : null}
                          dragOver={isDragOverSub}
                        />
                      );
                    })
                  )}
                </div>
                {/* ─── Bottom action bar ──────────────────────────────── */}
                {!activeTask.isArchived && !isActiveFolderReadOnly && (
                  <div className="border-t border-gray-200 dark:border-gray-800/40 bg-white dark:bg-[#14141a] px-3 py-2 flex-shrink-0 sticky bottom-0 space-y-2">
                    {/* NEW: Set Ready for Completion button (for managers) */}
                    {canManage && activeTask.status !== 'ready_for_completion' && activeTask.status !== 'completed' && activeTask.status !== 'confirmed_completed' && (
                      <button
                        onClick={handleSetReadyForCompletion}
                        className="w-full py-2 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition hover:opacity-80"
                        style={{ backgroundColor: brandColor }}
                      >
                        <FaCheckCircle className="text-sm" /> Set Ready for Completion
                      </button>
                    )}
                    {activeTask.assignee?._id === userInfo?._id && activeTask.status === 'ready_for_completion' && (
                      <button
                        onClick={() => setShowMarkCompleteModal(true)}
                        className="w-full py-2 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition hover:opacity-80"
                        style={{ backgroundColor: brandColor }}
                      >
                        <FaCheckDouble className="text-sm" /> Mark as Complete
                      </button>
                    )}
                    {canManage && activeTask.status === 'completed' && activeTask.status !== 'confirmed_completed' && (
                      <button
                        onClick={() => setShowConfirmCompletionModal(true)}
                        className="w-full py-2 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition hover:opacity-80"
                        style={{ backgroundColor: brandColor }}
                      >
                        <FaCheckDouble className="text-sm" /> Confirm Completion
                      </button>
                    )}
                    {!(canManage && activeTask.status !== 'ready_for_completion' && activeTask.status !== 'completed' && activeTask.status !== 'confirmed_completed') && !(activeTask.assignee?._id === userInfo?._id && activeTask.status === 'ready_for_completion') && !(canManage && activeTask.status === 'completed' && activeTask.status !== 'confirmed_completed') && (
                      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                        {activeTask.status === 'confirmed_completed' ? 'Task confirmed' : 'No actions available'}
                      </p>
                    )}
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
              folders={visibleFolders}
              onSuccess={() => { setShowCreateTask(false); refreshAll(); }}
              onCancel={() => setShowCreateTask(false)}
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
            <EditTaskForm
              task={selectedTask}
              brandColor={brandColor}
              assignableMembers={assignableMembers}
              folders={visibleFolders}
              onSuccess={() => { setShowEditTask(false); refreshAll(); }}
              onCancel={() => setShowEditTask(false)}
            />
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
              onCancel={() => setShowAddMember(false)}
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
            <AssignForm
              assignableMembers={assignableMembers}
              onAssign={handleAssignTask}
              brandColor={brandColor}
              onCancel={() => setShowAssignModal(false)}
            />
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
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
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
              onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder(showRenameFolder)}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowRenameFolder(null)} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={() => handleRenameFolder(showRenameFolder)} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>Rename</button>
            </div>
          </div>
        </div>
      )}

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
        confirmText={confirmModal.confirmText || 'Confirm'}
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
        folders={visibleFolders}
        mode={folderActionModal.mode}
        task={folderActionModal.task}
        onConfirm={handleFolderActionConfirm}
        brandColor={brandColor}
      />

      {/* ─── New Completion Modals ──────────────────────────────────── */}
      <MarkCompleteModal
        isOpen={showMarkCompleteModal}
        onClose={() => setShowMarkCompleteModal(false)}
        task={activeTask}
        brandColor={brandColor}
        onSubmit={handleMarkComplete}
      />
      <ConfirmCompletionModal
        isOpen={showConfirmCompletionModal}
        onClose={() => setShowConfirmCompletionModal(false)}
        task={activeTask}
        brandColor={brandColor}
        onSubmit={handleConfirmCompletion}
      />
    </div>
  );
};

export default MyWorkspaceProjectId;
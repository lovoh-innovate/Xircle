// src/components/ProjectHelpers.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  FaAngleDown, FaCheck, FaClock, FaFire, FaFlag, FaSpinner,
  FaCheckCircle, FaExclamationTriangle, FaTimes, FaTrashAlt,
  FaUser, FaRegClock, FaFolder, FaLink, FaPaperclip, FaSearch,
  FaArrowLeft, FaUserPlus, FaUserMinus, FaCrown, FaUsers,
  FaEllipsisV, FaEdit, FaPlus, FaGripVertical, FaRedo,
  FaCheckDouble, FaBell, FaCalendarAlt, FaCommentDots,
  FaUserLock, FaFolderOpen, FaTrashRestore, FaArchive, FaUndo, FaTasks,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useCreateFolderMutation, useUpdateFolderMutation, useDeleteFolderMutation, useAddFolderReadOnlyMutation, useRemoveFolderReadOnlyMutation } from '../slices/taskApiSlice';
import { useAddTeamMemberMutation } from '../slices/projectApiSlice';
import { useUpdateTaskMutation } from '../slices/taskApiSlice';

// ─── Format helpers ──────────────────────────────────────────────
export const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const formatTimeAgo = (date) => {
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

// ─── Custom Dropdown ──────────────────────────────────────────────
export const CustomDropdown = React.memo(({ options, value, onChange, placeholder, label, brandColor }) => {
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

// ─── Priority / Status Options ────────────────────────────────────
export const priorityOptions = [
  { value: 'low', label: 'Low', icon: <FaFlag className="text-blue-400" /> },
  { value: 'medium', label: 'Medium', icon: <FaFlag className="text-yellow-400" /> },
  { value: 'high', label: 'High', icon: <FaFire className="text-red-400" /> },
  { value: 'urgent', label: 'Urgent', icon: <FaFire className="text-red-500" /> },
];

export const statusOptions = [
  { value: 'pending', label: 'Pending', icon: <FaClock className="text-gray-400" /> },
  { value: 'in-progress', label: 'In Progress', icon: <FaSpinner className="text-yellow-400" /> },
  { value: 'ready_for_completion', label: 'Ready', icon: <FaCheckCircle className="text-blue-400" /> },
  { value: 'completed', label: 'Completed', icon: <FaCheckCircle className="text-green-400" /> },
  { value: 'confirmed_completed', label: 'Confirmed', icon: <FaCheckCircle className="text-green-600" /> },
];

// ─── Badges ──────────────────────────────────────────────────────
export const TaskStatusBadge = React.memo(({ status }) => {
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

export const TaskPriorityBadge = React.memo(({ priority }) => {
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
export const ConfirmModal = React.memo(({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) => {
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
export const DeleteTaskConfirmModal = React.memo(({ isOpen, onClose, onConfirm, taskName }) => {
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
export const RejectReasonModal = React.memo(({ isOpen, onClose, onConfirm }) => {
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

// ─── Mark Task Complete Modal (with links & attachments) ──────────
export const MarkCompleteModal = React.memo(({ isOpen, onClose, task, brandColor, onSubmit }) => {
  const [notes, setNotes] = useState('');
  const [linksText, setLinksText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setAttachments([...e.target.files]);
    e.target.value = '';
  };
  const removeFile = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const links = linksText.split('\n').map(l => l.trim()).filter(Boolean);
      await onSubmit({
        notes: notes.trim(),
        links,
        attachments,
      });
      onClose();
      setNotes('');
      setLinksText('');
      setAttachments([]);
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
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Mark Task Complete</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Confirm you have completed <span className="font-medium text-gray-800 dark:text-gray-200">"{task?.title}"</span>.
          You may provide additional info below.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none"
              placeholder="Completion notes..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Links (one per line, optional)</label>
            <textarea
              value={linksText}
              onChange={(e) => setLinksText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none"
              placeholder="https://example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Attachments (optional)</label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-teal-50 dark:file:bg-[#0d9488]/20 file:text-teal-600 dark:file:text-[#0d9488]"
            />
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
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
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

// ─── Confirm Completion Modal (with reject) ──────────────────────
export const ConfirmCompletionModal = React.memo(({ isOpen, onClose, task, brandColor, onSubmit, onReject }) => {
  const [feedback, setFeedback] = useState('');
  const [finalHours, setFinalHours] = useState('');
  const [finalLinksText, setFinalLinksText] = useState('');
  const [finalAttachments, setFinalAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

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
      resetForm();
    } catch (err) {
      // Error handled in parent
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection.');
      return;
    }
    setLoading(true);
    try {
      await onReject(task._id, rejectReason.trim());
      onClose();
      resetForm();
      setShowReject(false);
    } catch (err) {
      // Error handled in parent
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFeedback('');
    setFinalHours('');
    setFinalLinksText('');
    setFinalAttachments([]);
    setRejectReason('');
    setShowReject(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Confirm or Reject Task</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Review the submission for <span className="font-medium text-gray-800 dark:text-gray-200">"{task?.title}"</span> and either confirm or reject it.
        </p>

        {/* Show submitted info if any */}
        {task?.finalLinks && task.finalLinks.length > 0 && (
          <div className="mb-3 text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">Submitted links:</span>
            <ul className="list-disc pl-5 mt-1">
              {task.finalLinks.map((link, i) => (
                <li key={i}><a href={link} target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-[#0d9488] underline break-all">{link}</a></li>
              ))}
            </ul>
          </div>
        )}
        {task?.finalAttachments && task.finalAttachments.length > 0 && (
          <div className="mb-3 text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">Submitted attachments:</span>
            <ul className="list-disc pl-5 mt-1">
              {task.finalAttachments.map((att, i) => (
                <li key={i}><a href={att.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-[#0d9488] underline break-all">{att.name || 'file'}</a></li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Feedback (optional)</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none"
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
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none"
              placeholder="e.g. 2.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Final Links (one per line, optional)</label>
            <textarea
              value={finalLinksText}
              onChange={(e) => setFinalLinksText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none"
              placeholder="https://example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Final Attachments (optional)</label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-teal-50 dark:file:bg-[#0d9488]/20 file:text-teal-600 dark:file:text-[#0d9488]"
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

          {showReject && (
            <div className="border-t border-gray-200 dark:border-gray-800/60 pt-4">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Reason for rejection *</label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-red-500 outline-none"
                placeholder="Enter reason..."
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
          {!showReject ? (
            <>
              <button
                onClick={() => setShowReject(true)}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition"
              >
                Reject
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: brandColor }}
              >
                {loading ? 'Confirming...' : 'Confirm'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowReject(false)}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
              >
                Back
              </button>
              <button
                onClick={handleReject}
                disabled={loading}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-50"
              >
                {loading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Assign Task Modal ──────────────────────────────────────────────────
export const AssignTaskModal = React.memo(({ isOpen, onClose, task, assignableMembers, brandColor, onAssign }) => {
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

// ─── Search Modal ──────────────────────────────────────────────────────
export const SearchModal = React.memo(({ isOpen, onClose, items, type, brandColor, onSelect }) => {
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
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition truncate">{item.title}</p>
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
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition truncate">{item.user?.name || 'Unknown'}</p>
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

// ─── Project Menu Modal (bottom sheet) ────────────────────────────────
export const ProjectMenuModal = ({
  isOpen,
  onClose,
  project,
  canManage,
  isArchivedForMe,
  isTrash,
  onArchive,
  onUnarchive,
  onMoveToTrash,
  onRestore,
  onPermanentDelete,
  brandColor,
}) => {
  if (!isOpen) return null;

  const isMobile = window.innerWidth < 768;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-2xl md:rounded-2xl w-full md:max-w-sm ${isMobile ? 'max-h-[80vh]' : 'max-h-[80vh]'} overflow-y-auto transform transition-transform duration-300 ${
          isMobile ? 'mt-auto' : 'mx-auto'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 truncate pr-4">
              {project?.name || 'Project'}
            </h3>
            <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition flex-shrink-0">
              <FaTimes />
            </button>
          </div>

          <div className="space-y-1">
            {isTrash ? (
              <>
                {canManage && (
                  <button
                    onClick={() => { onClose(); onRestore(); }}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[#0d9488] hover:bg-[#0d9488]/10 transition"
                  >
                    <FaTrashRestore className="text-sm" />
                    <span className="text-sm font-medium">Restore</span>
                  </button>
                )}
                {canManage && (
                  <button
                    onClick={() => { onClose(); onPermanentDelete(); }}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-500/10 transition"
                  >
                    <FaTrashAlt className="text-sm" />
                    <span className="text-sm font-medium">Delete Permanently</span>
                  </button>
                )}
              </>
            ) : (
              <>
                {canManage && (
                  <button
                    onClick={() => { onClose(); /* navigate to edit */ }}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
                  >
                    <FaEdit className="text-sm text-[#0d9488]" />
                    <span className="text-sm font-medium">Edit Project</span>
                  </button>
                )}
                {isArchivedForMe ? (
                  <button
                    onClick={() => { onClose(); onUnarchive(); }}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[#0d9488] hover:bg-[#0d9488]/10 transition"
                  >
                    <FaUndo className="text-sm" />
                    <span className="text-sm font-medium">Unarchive</span>
                  </button>
                ) : (
                  <button
                    onClick={() => { onClose(); onArchive(); }}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 transition"
                  >
                    <FaArchive className="text-sm" />
                    <span className="text-sm font-medium">Archive for me</span>
                  </button>
                )}
                {canManage && !isTrash && (
                  <button
                    onClick={() => { onClose(); onMoveToTrash(); }}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10 transition"
                  >
                    <FaTrashAlt className="text-sm" />
                    <span className="text-sm font-medium">Move to Trash</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Task Card ─────────────────────────────────────────────────────────
export const TaskCard = React.memo(({
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
            <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[120px] md:max-w-[200px] group-hover:text-gray-900 dark:group-hover:text-white transition">
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
              <FaFolder className="text-[8px]" /> <span className="truncate max-w-[60px] md:max-w-[100px]">{folderName}</span>
            </span>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 truncate">{task.description}</p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-500 truncate max-w-[80px] md:max-w-[120px]">
            {assignee ? `${assignee.name}` : 'Unassigned'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-500 truncate">{task.dueDate ? formatDateTime(task.dueDate) : 'No due'}</span>
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

// ─── Folder Form Modal ──────────────────────────────────────────────
export const FolderFormModal = React.memo(({ isOpen, onClose, onSuccess, folder, brandColor, projectId }) => {
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
export const FolderReadOnlyModal = React.memo(({ isOpen, onClose, folder, project, brandColor, onSuccess }) => {
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
                      <span className="text-sm text-gray-800 dark:text-gray-200 truncate max-w-[150px]">{user?.name || 'Unknown'}</span>
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
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{user?.name || 'Unknown'}</span>
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
export const CreateTaskModal = React.memo(({ isOpen, onClose, projectId, brandColor, assignableMembers, folders, onSuccess, onSubmit }) => {
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

    const formData = {
      projectId,
      title: title.trim(),
      description: description.trim(),
      assigneeId: assigneeId || '',
      priority,
      estimatedHours: estimatedHours || '',
      bufferTime: bufferTime.toString(),
      allowAssigneeEditSubtasks: allowAssigneeEditSubtasks ? 'true' : 'false',
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      folderId: folderId || undefined,
      recurrenceType,
      recurrenceDays: recurrenceType === 'weekly' ? recurrenceDays : undefined,
      recurrenceEndDate: recurrenceEndDate || undefined,
      links: linksText.split('\n').map(l => l.trim()).filter(Boolean),
      attachments,
    };

    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setPriority('medium');
      setStartDate('');
      setDueDate('');
      setEstimatedHours('');
      setBufferTime(0);
      setAllowAssigneeEditSubtasks(false);
      setLinksText('');
      setAttachments([]);
      setFolderId('');
      setRecurrenceType('none');
      setRecurrenceDays([]);
      setRecurrenceEndDate('');
      setShowDetails(false);
      toast.success('Task created (optimistic)');
    } catch (err) {
      toast.error(err?.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
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

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] transition"
          >
            <FaAngleDown className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            {showDetails ? 'Hide details' : 'Add more details'}
          </button>

          {showDetails && (
            <>
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
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${recurrenceDays.includes(idx) ? 'bg-teal-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
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
            </>
          )}

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
export const EditTaskModal = React.memo(({ isOpen, onClose, task, brandColor, assignableMembers, folders, onSuccess }) => {
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
      fd.append('assigneeId', assigneeId || '');
      fd.append('estimatedHours', estimatedHours || '');
      fd.append('bufferTime', bufferTime.toString());
      fd.append('allowAssigneeEditSubtasks', allowAssigneeEditSubtasks ? 'true' : 'false');
      fd.append('startDate', startDate || '');
      fd.append('dueDate', dueDate || '');
      fd.append('folderId', folderId || '');
      fd.append('recurrenceType', recurrenceType);
      if (recurrenceType === 'weekly') {
        fd.append('recurrenceDays', JSON.stringify(recurrenceDays));
      }
      fd.append('recurrenceEndDate', recurrenceEndDate || '');
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
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${recurrenceDays.includes(idx) ? 'bg-teal-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
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
export const AddMemberModal = React.memo(({ isOpen, onClose, workspace, project, brandColor, onSuccess }) => {
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
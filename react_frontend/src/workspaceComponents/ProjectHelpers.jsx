// src/workspaceComponents/ProjectHelpers.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  FaAngleDown, FaCheck, FaClock, FaFire, FaFlag, FaSpinner,
  FaCheckCircle, FaExclamationTriangle, FaTimes, FaTrashAlt,
  FaUser, FaRegClock, FaFolder, FaLink, FaPaperclip, FaSearch,
  FaArrowLeft, FaUserPlus, FaUserMinus, FaCrown, FaUsers,
  FaEllipsisV, FaEdit, FaPlus, FaGripVertical, FaRedo,
  FaCheckDouble, FaBell, FaCalendarAlt, FaCommentDots,
  FaUserLock, FaFolderOpen, FaTrashRestore, FaArchive, FaUndo,
  FaCopy, FaPen, FaLock, FaLockOpen, FaTasks, FaChartLine,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import {
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useMarkSubTaskDoneMutation,
  useConfirmSubTaskMutation,
  useRejectSubTaskMutation,
  useDeleteSubTaskMutation,
} from '../slices/taskApiSlice';
import { useAddTeamMemberMutation } from '../slices/projectApiSlice';

// ─── Format helpers ──────────────────────────────────────────────
export const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
export const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const formatTaskTitle = (title) => {
  if (title && title.endsWith(' (copy)')) {
    return `(copy) ${title.slice(0, -7)}`;
  }
  return title;
};

// ─── Custom Dropdown ──────────────────────────────────────────────
export const CustomDropdown = React.memo(({ options, value, onChange, placeholder, label, brandColor }) => {
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

// ─── Priority / Status Options ──────────────────────────────────
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
export const taskTypeOptions = [
  { value: 'general', label: 'General' },
  { value: 'feature', label: 'Feature' },
  { value: 'bug', label: 'Bug' },
  { value: 'improvement', label: 'Improvement' },
];

// ─── Badges ──────────────────────────────────────────────────────
export const TaskStatusBadge = React.memo(({ status }) => {
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
export const TaskPriorityBadge = React.memo(({ priority }) => {
  const map = {
    low: { label: 'Low', color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700/40' },
    medium: { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700/40' },
    high: { label: 'High', color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700/40' },
    urgent: { label: 'Urgent', color: 'text-red-700 dark:text-red-500 bg-red-200 dark:bg-red-900/30 border-red-400 dark:border-red-700/50' },
  };
  const p = map[priority] || map.medium;
  return <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${p.color}`}>{p.label}</span>;
});

// ─── Confirm Modal ──────────────────────────────────────────────────
export const ConfirmModal = React.memo(({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) => {
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
export const DeleteTaskConfirmModal = React.memo(({ isOpen, onClose, onConfirm, taskName }) => {
  const [inputValue, setInputValue] = useState('');
  const expectedPhrase = `I want to delete ${taskName}`;
  useEffect(() => { if (!isOpen) setInputValue(''); }, [isOpen]);
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
export const MarkCompleteModal = React.memo(({ isOpen, onClose, task, brandColor, onSubmit }) => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({ notes: notes.trim() });
      onClose();
      setNotes('');
    } catch (err) {}
    finally { setLoading(false); }
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Mark Task Complete</h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Confirm you have completed "{task?.title}". Add any final notes (optional).</p>
        <textarea placeholder="Completion notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-[#0d9488] outline-none mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 disabled:opacity-50" style={{ backgroundColor: brandColor }}>{loading ? 'Submitting...' : 'Complete'}</button>
        </div>
      </div>
    </div>
  );
});

// ─── Confirm Completion Modal ──────────────────────────────────────
export const ConfirmCompletionModal = React.memo(({ isOpen, onClose, task, brandColor, onSubmit }) => {
  const [feedback, setFeedback] = useState('');
  const [finalHours, setFinalHours] = useState('');
  const [finalLinksText, setFinalLinksText] = useState('');
  const [finalAttachments, setFinalAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const handleFileChange = (e) => { setFinalAttachments([...e.target.files]); e.target.value = ''; };
  const removeFile = (index) => { setFinalAttachments(prev => prev.filter((_, i) => i !== index)); };
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const links = finalLinksText.split('\n').map(l => l.trim()).filter(Boolean);
      await onSubmit({ feedback: feedback.trim(), finalHours: finalHours ? parseFloat(finalHours) : undefined, finalLinks: links.length ? links : undefined, finalAttachments });
      onClose();
      setFeedback(''); setFinalHours(''); setFinalLinksText(''); setFinalAttachments([]);
    } catch (err) {}
    finally { setLoading(false); }
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Confirm Task Completion</h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Provide final details for "{task?.title}" before confirming completion.</p>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Feedback (optional)</label><textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-[#0d9488] outline-none" placeholder="Any feedback for the assignee..." /></div>
          <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Actual Hours (optional)</label><input type="number" step="0.5" value={finalHours} onChange={(e) => setFinalHours(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" placeholder="e.g. 2.5" /></div>
          <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Final Links (one per line, optional)</label><textarea value={finalLinksText} onChange={(e) => setFinalLinksText(e.target.value)} rows={3} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-[#0d9488] outline-none" placeholder="https://example.com" /></div>
          <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Final Attachments (optional)</label><input type="file" multiple onChange={handleFileChange} className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#0d9488]/20 file:text-[#0d9488]" />{finalAttachments.length > 0 && (<div className="mt-2 space-y-1">{finalAttachments.map((f, i) => (<div key={i} className="flex justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5"><span className="text-sm truncate text-gray-700 dark:text-gray-300">{f.name}</span><button type="button" onClick={() => removeFile(i)} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"><FaTrashAlt className="text-xs" /></button></div>))}</div>)}</div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 disabled:opacity-50" style={{ backgroundColor: brandColor }}>{loading ? 'Submitting...' : 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
});

// ─── Folder Select Modal ────────────────────────────────────────────────
export const FolderSelectModal = React.memo(({ isOpen, onClose, folders, mode, task, onConfirm, brandColor }) => {
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (isOpen) setSelectedFolderId(null); }, [isOpen]);
  if (!isOpen) return null;
  const options = [{ value: null, label: 'All Tasks (No Folder)', icon: <FaTasks className="text-gray-400" /> }, ...folders.map(f => ({ value: f._id, label: f.name, icon: <FaFolder className="text-gray-400" /> }))];
  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(task._id, selectedFolderId);
      onClose();
    } catch (err) { toast.error(err?.data?.message || 'Operation failed'); }
    finally { setSubmitting(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">{mode === 'copy' ? <FaCopy className="text-[#0d9488]" /> : <FaFolder className="text-[#0d9488]" />}{mode === 'copy' ? 'Copy Task' : 'Move Task'}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{mode === 'copy' ? 'Copy' : 'Move'} <span className="font-medium text-gray-800 dark:text-gray-200">"{task?.title}"</span> to:</p>
        <CustomDropdown label="Destination folder" options={options} value={selectedFolderId} onChange={setSelectedFolderId} brandColor={brandColor} />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button onClick={handleConfirm} disabled={submitting} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{submitting ? (mode === 'copy' ? 'Copying...' : 'Moving...') : (mode === 'copy' ? 'Copy' : 'Move')}</button>
        </div>
      </div>
    </div>
  );
});

// ─── Folder Access Management Modal ──────────────────────────────────
export const FolderAccessModal = React.memo(({ isOpen, onClose, folder, projectMembers, currentUserId, initialAccessUsers, onSave, brandColor }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (isOpen && folder) setSelectedIds(initialAccessUsers || []); }, [isOpen, folder, initialAccessUsers]);
  if (!isOpen) return null;
  const toggleMember = (userId) => { setSelectedIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]); };
  const handleSave = async () => {
    setSubmitting(true);
    try {
      await onSave(folder._id, selectedIds);
      toast.success('Folder access updated');
      onClose();
    } catch (error) { toast.error('Failed to update folder access.'); }
    finally { setSubmitting(false); }
  };
  const members = projectMembers.filter(m => { const id = m.user?._id || m._id; return id !== currentUserId && m.status === 'active'; });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2"><FaLockOpen className="text-[#0d9488]" /> Folder Access: {folder?.name}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Grant read‑only access to this folder for team members. They will see all tasks in this folder even if not assigned.</p>
        {members.length === 0 ? (<p className="text-sm text-gray-500 dark:text-gray-500">No other active members to manage.</p>) : (
          <div className="space-y-2">
            {members.map(m => { const user = m.user || m; const id = user._id; const name = user.name || 'Unknown'; const checked = selectedIds.includes(id); return (
              <label key={id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/30 transition cursor-pointer">
                <input type="checkbox" checked={checked} onChange={() => toggleMember(id)} className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-[#0d9488] focus:ring-[#0d9488]" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{name}</span>
                {checked && <span className="ml-auto text-xs text-[#0d9488]">Read‑only</span>}
              </label>
            ); })}
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button onClick={handleSave} disabled={submitting} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{submitting ? 'Saving...' : 'Save Access'}</button>
        </div>
      </div>
    </div>
  );
});

// ─── Task Card ──────────────────────────────────────────────────────────
export const TaskCard = React.memo(({
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
    if (!draggable) { e.preventDefault(); return; }
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
      className={`group relative bg-white dark:bg-[#14141a] rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${isActive ? 'border-[#0d9488] shadow-[0_0_20px_rgba(13,148,136,0.15)]' : 'border-gray-200 dark:border-gray-800/40 hover:border-[#0d9488]/50'} ${draggable && !readOnly && !showArchived ? 'active:cursor-grabbing' : ''} ${readOnly || showArchived ? 'opacity-80' : ''} ${dragOver ? 'border-[#0d9488] bg-[#0d9488]/5' : ''}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {draggable && !readOnly && !showArchived && (<FaGripVertical className="text-gray-300 dark:text-gray-700 text-xs flex-shrink-0 cursor-grab" />)}
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: brandColor }}>{task.title.charAt(0).toUpperCase()}</div>
            <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[120px] md:max-w-[200px] group-hover:text-gray-900 dark:group-hover:text-white transition">{displayTitle}</h4>
            {hasRecurrence && (<span className="flex-shrink-0 text-[10px] text-teal-600 dark:text-[#0d9488] flex items-center gap-0.5" title={`Recurring: ${recurrenceLabel}`}><FaRedo className="text-[8px]" /> {recurrenceLabel}</span>)}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <TaskStatusBadge status={task.status} />
            {task.isArchived && (<span className="text-[10px] text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full border border-orange-300 dark:border-orange-700/50 flex items-center gap-1"><FaArchive className="text-[8px]" /> Archived</span>)}
            {!readOnly && !showArchived && (
              <div className="relative" ref={menuRef}>
                <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition"><FaEllipsisV className="text-xs" /></button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-800/60 rounded-xl min-w-[150px] z-20 py-1 shadow-lg">
                    {!task.isArchived ? (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onCopyClick(task); }} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 w-full transition"><FaCopy className="text-xs" /> Copy to...</button>
                        <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onMoveClick(task); }} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 w-full transition"><FaFolder className="text-xs" /> Move to...</button>
                      </>
                    ) : (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); /* handled by parent */ }} className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/10 w-full transition"><FaUndo className="text-xs" /> Unarchive</button>
                        <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); /* handled by parent */ }} className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 w-full transition"><FaTrashAlt className="text-xs" /> Delete Permanently</button>
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
          {subTaskCount > 0 && (<span className="text-[10px] text-gray-500 dark:text-gray-500">• {confirmedCount}/{subTaskCount} done</span>)}
          {isOverdue && !task.isArchived && (<span className="text-[10px] text-red-400 flex items-center gap-1"><FaClock className="text-[8px]" /> Overdue</span>)}
          {readOnly && (<span className="text-[10px] text-blue-400 flex items-center gap-1"><FaLock className="text-[8px]" /> Read‑only</span>)}
        </div>
        {task.description && (<p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2 truncate">{task.description}</p>)}
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
export const SubTaskItem = React.memo(({
  subTask, index, taskId, isAssignee, canManage, onRefresh, brandColor, readOnly,
  onDragStart, onDragOver, onDrop, onDragLeave, dragOver, onDragEnd,
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
      setShowConfirmForm(false); setConfirmFeedback(''); onRefresh();
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
      setShowRejectModal(false); setRejectReason('');
      onRefresh();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setUpdating(false); }
  };
  const handleDelete = async () => { if (readOnly) return; setShowDeleteModal(true); };
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
  const statusMap = { pending: { label: 'Pending', color: 'text-gray-500 dark:text-gray-400' }, done: { label: 'Done', color: 'text-blue-600 dark:text-blue-400' }, confirmed: { label: 'Confirmed', color: 'text-green-600 dark:text-green-400' } };
  const st = statusMap[subTask.status] || statusMap.pending;
  const canDrag = !readOnly && (canManage || (isAssignee && subTask.status !== 'confirmed'));
  const handleDragStart = (e) => {
    if (!canDrag) { e.preventDefault(); return; }
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
        className={`flex flex-col py-2 border-b border-gray-100 dark:border-gray-800/20 last:border-0 transition-colors ${dragOver ? 'bg-[#0d9488]/5 border-[#0d9488]' : ''}`}
      >
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {canDrag && (<FaGripVertical className="text-gray-300 dark:text-gray-700 text-xs flex-shrink-0 cursor-grab" />)}
              <span className="text-sm font-medium text-gray-800 dark:text-gray-300 truncate max-w-[140px] md:max-w-[200px]">{subTask.title}</span>
              <span className={`text-[10px] font-medium ${st.color}`}>{st.label}</span>
              {hasRecurrence && (<span className="text-[10px] text-teal-600 dark:text-[#0d9488] flex items-center gap-0.5"><FaRedo className="text-[8px]" /> {recurrenceLabel}</span>)}
              {subTask.dueDate && new Date(subTask.dueDate) < new Date() && subTask.status !== 'confirmed' && (<span className="text-[10px] text-red-400 flex items-center gap-1"><FaClock className="text-[8px]" /> Overdue</span>)}
            </div>
            {subTask.description && (<p className="text-xs text-gray-500 dark:text-gray-500 truncate">{subTask.description}</p>)}
            {subTask.dueDate && (<p className="text-[10px] text-gray-500 dark:text-gray-500 flex items-center gap-1"><FaRegClock className="text-xs" /> {formatDateTime(subTask.dueDate)}</p>)}
          </div>
          {hasDetails && (<button onClick={() => setIsExpanded(!isExpanded)} className="p-1 text-gray-500 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition flex-shrink-0"><FaAngleDown className={`text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`} /></button>)}
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-1 mt-1 sm:mt-0 sm:ml-auto sm:flex-nowrap">
            {isAssignee && subTask.status === 'pending' && (<button onClick={handleMarkDone} disabled={updating} className="p-1 text-blue-500 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/10 rounded-lg transition"><FaCheck className="text-xs" /></button>)}
            {canManage && subTask.status === 'done' && (<><button onClick={handleConfirmClick} disabled={updating} className="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/10 rounded-lg transition"><FaCheckDouble className="text-xs" /></button><button onClick={handleRejectClick} disabled={updating} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 rounded-lg transition"><FaTimes className="text-xs" /></button></>)}
            {(isAssignee && subTask.status !== 'confirmed') || canManage ? (<button onClick={handleDelete} disabled={updating} className="p-1 text-red-400/60 hover:bg-red-100 dark:hover:bg-red-500/10 rounded-lg transition"><FaTrashAlt className="text-xs" /></button>) : null}
          </div>
        )}
        {isExpanded && (
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-1 bg-gray-100 dark:bg-[#1a1a24] p-3 rounded-xl border border-gray-200 dark:border-gray-800/40 w-full overflow-hidden">
            {subTask.notes && <div><span className="font-medium text-gray-700 dark:text-gray-300">Notes:</span> {subTask.notes}</div>}
            {subTask.links && subTask.links.length > 0 && (<div><span className="font-medium text-gray-700 dark:text-gray-300">Links:</span> <div className="flex flex-wrap items-center gap-1 mt-0.5">{subTask.links.map((l, i) => (<React.Fragment key={i}><a href={l} target="_blank" rel="noopener noreferrer" className="text-[#0d9488] underline hover:text-[#14b8a6] break-all">{l}</a>{i < subTask.links.length - 1 && <span className="text-gray-500">,</span>}</React.Fragment>))}</div></div>)}
            {subTask.attachments && subTask.attachments.length > 0 && (<div><span className="font-medium text-gray-700 dark:text-gray-300">Attachments:</span> <div className="flex flex-wrap items-center gap-1 mt-0.5">{subTask.attachments.map((att, i) => (<React.Fragment key={i}><a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[#0d9488] underline hover:text-[#14b8a6] break-all">{att.name || 'file'}</a>{i < subTask.attachments.length - 1 && <span className="text-gray-500">,</span>}</React.Fragment>))}</div></div>)}
            {subTask.feedback && <div><span className="font-medium text-gray-700 dark:text-gray-300">Confirm feedback:</span> {subTask.feedback}</div>}
            {subTask.rejectedBy && (<div><span className="font-medium text-gray-700 dark:text-gray-300">Rejected by:</span> {subTask.rejectedBy.name || 'Unknown'} on {formatDateTime(subTask.rejectedAt)}</div>)}
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
              <input type="file" multiple onChange={(e) => setDoneFiles([...e.target.files])} className="text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#0d9488]/20 file:text-[#0d9488]" />
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
            {subTask.links && subTask.links.length > 0 && (<div className="text-xs text-gray-600 dark:text-gray-400 mb-1"><span className="font-medium text-gray-700 dark:text-gray-300">Links:</span> <div className="flex flex-wrap items-center gap-1 mt-0.5">{subTask.links.map((l, i) => (<React.Fragment key={i}><a href={l} target="_blank" rel="noopener noreferrer" className="text-[#0d9488] underline break-all">{l}</a>{i < subTask.links.length - 1 && <span className="text-gray-500">,</span>}</React.Fragment>))}</div></div>)}
            {subTask.attachments && subTask.attachments.length > 0 && (<div className="text-xs text-gray-600 dark:text-gray-400 mb-2"><span className="font-medium text-gray-700 dark:text-gray-300">Attachments:</span> <div className="flex flex-wrap items-center gap-1 mt-0.5">{subTask.attachments.map((att, i) => (<React.Fragment key={i}><a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[#0d9488] underline break-all">{att.name || 'file'}</a>{i < subTask.attachments.length - 1 && <span className="text-gray-500">,</span>}</React.Fragment>))}</div></div>)}
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
      <ConfirmModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={confirmDelete} title="Delete Sub‑task" message={`Are you sure you want to delete "${subTask.title}"? This cannot be undone.`} confirmText="Delete" danger />
    </>
  );
});

// ─── Inline Form Components ──────────────────────────────────────────
export const CreateTaskForm = React.memo(({ projectId, brandColor, assignableMembers, folders, onSuccess, onCancel }) => {
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
  const toggleDay = (day) => { if (recurrenceDays.includes(day)) setRecurrenceDays(recurrenceDays.filter(d => d !== day)); else setRecurrenceDays([...recurrenceDays, day].sort()); };
  const assigneeOpts = [{ value: '', label: 'Unassigned', icon: <FaUser className="text-gray-400" /> }, ...assignableMembers.map(m => { const u = m.user || m; return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" alt="" /> : <FaUser className="text-gray-400" /> }; })];
  const folderOpts = [{ value: null, label: 'No Folder', icon: <FaFolder className="text-gray-400" /> }, ...folders.map(f => ({ value: f._id, label: f.name, icon: <FaFolder className="text-gray-400" /> }))];
  const setDueDateRelative = (hours) => { const now = new Date(); setStartDate(now.toISOString().slice(0, 16)); const due = new Date(now.getTime() + hours * 60 * 60 * 1000); setDueDate(due.toISOString().slice(0, 16)); };
  const setDueDateToday = () => { const now = new Date(); setStartDate(now.toISOString().slice(0, 16)); const endOfDay = new Date(now); endOfDay.setHours(23, 59, 0, 0); setDueDate(endOfDay.toISOString().slice(0, 16)); };
  const setDueDateTomorrow = () => { const now = new Date(); setStartDate(now.toISOString().slice(0, 16)); const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(23, 59, 0, 0); setDueDate(tomorrow.toISOString().slice(0, 16)); };
  const setDueDateInDays = (days) => { const now = new Date(); setStartDate(now.toISOString().slice(0, 16)); const target = new Date(now); target.setDate(target.getDate() + days); target.setHours(23, 59, 0, 0); setDueDate(target.toISOString().slice(0, 16)); };
  const setDueDateInMonths = (months) => { const now = new Date(); setStartDate(now.toISOString().slice(0, 16)); const target = new Date(now); target.setMonth(target.getMonth() + months); target.setHours(23, 59, 0, 0); setDueDate(target.toISOString().slice(0, 16)); };
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
      if (recurrenceType === 'weekly') { fd.append('recurrenceDays', JSON.stringify(recurrenceDays)); }
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
      <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title *</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" required /></div>
      <button type="button" onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-2 text-sm text-[#0d9488] hover:text-[#14b8a6] transition"><FaAngleDown className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />{showDetails ? 'Hide details' : 'Add more details'}</button>
      {showDetails && (
        <>
          <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" /></div>
          <CustomDropdown label="Task Type" options={taskTypeOptions} value={taskType} onChange={setTaskType} brandColor={brandColor} />
          <CustomDropdown label="Folder" options={folderOpts} value={folderId} onChange={setFolderId} brandColor={brandColor} />
          <CustomDropdown label="Assignee" options={assigneeOpts} value={assigneeId} onChange={setAssigneeId} brandColor={brandColor} />
          <div className="grid grid-cols-2 gap-3">
            <CustomDropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} brandColor={brandColor} />
            <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date & Time</label><input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Due Date & Time</label><input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" /></div>
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
            <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Est. Hours</label><input type="number" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" /></div>
            <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buffer Time (hours)</label><input type="number" step="0.5" value={bufferTime} onChange={e => setBufferTime(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" /></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recurrence</label>
            <select value={recurrenceType} onChange={(e) => { setRecurrenceType(e.target.value); if (e.target.value !== 'weekly') setRecurrenceDays([]); }} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none">
              <option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
            </select>
          </div>
          {recurrenceType === 'weekly' && (
            <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Repeat on</label><div className="flex flex-wrap gap-2">{weekDays.map((day, idx) => (<button key={idx} type="button" onClick={() => toggleDay(idx)} className={`px-3 py-1 rounded-full text-xs font-medium transition ${recurrenceDays.includes(idx) ? 'bg-[#0d9488] text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>{day}</button>))}</div></div>
          )}
          {(recurrenceType === 'daily' || recurrenceType === 'weekly') && (<div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date (optional)</label><input type="datetime-local" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" /></div>)}
          <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Links (one per line)</label><textarea value={links} onChange={e => setLinks(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" placeholder="https://..." /></div>
          <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Attachments</label><input type="file" multiple onChange={e => setAttachments([...e.target.files])} className="text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#0d9488]/20 file:text-[#0d9488]" /></div>
          <div className="flex items-center gap-2"><input type="checkbox" id="allowAssigneeEditSubtasks" checked={allowAssigneeEditSubtasks} onChange={e => setAllowAssigneeEditSubtasks(e.target.checked)} className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-[#0d9488] focus:ring-[#0d9488]" /><label htmlFor="allowAssigneeEditSubtasks" className="text-xs text-gray-700 dark:text-gray-300">Allow assignee to add/edit sub‑tasks</label></div>
          <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Daily Reminder Time</label><input type="time" value={dailyReminderTime} onChange={e => setDailyReminderTime(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" /></div>
        </>
      )}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Creating...' : 'Create Task'}</button>
      </div>
    </form>
  );
});

export const EditTaskForm = React.memo(({ task, brandColor, assignableMembers, folders, onSuccess, onCancel }) => {
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
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(task?.recurrenceEndDate ? new Date(task.recurrenceEndDate).toISOString().slice(0, 16) : '');
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const toggleDay = (day) => { if (recurrenceDays.includes(day)) setRecurrenceDays(recurrenceDays.filter(d => d !== day)); else setRecurrenceDays([...recurrenceDays, day].sort()); };
  const assigneeOpts = [{ value: '', label: 'Unassigned', icon: <FaUser className="text-gray-400" /> }, ...assignableMembers.map(m => { const u = m.user || m; return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" alt="" /> : <FaUser className="text-gray-400" /> }; })];
  const folderOpts = [{ value: null, label: 'No Folder', icon: <FaFolder className="text-gray-400" /> }, ...folders.map(f => ({ value: f._id, label: f.name, icon: <FaFolder className="text-gray-400" /> }))];
  useEffect(() => {
    if (task) {
      setTitle(task.title || ''); setDescription(task.description || ''); setTaskType(task.taskType || 'general'); setAssigneeId(task.assignee?._id || task.assignee || ''); setPriority(task.priority || 'medium'); setStartDate(task.startDate ? new Date(task.startDate).toISOString().slice(0, 16) : ''); setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : ''); setStatus(task.status || 'pending'); setEstimatedHours(task.estimatedHours || ''); setBufferTime(task.bufferTime || 0); setAllowAssigneeEditSubtasks(task.allowAssigneeEditSubtasks || false); setLinks((task.links || []).join('\n')); setFolderId(task.folder?._id || null); setDailyReminderTime(task.dailyReminderTime || ''); setRecurrenceType(task.recurrenceType || 'none'); setRecurrenceDays(task.recurrenceDays || []); setRecurrenceEndDate(task.recurrenceEndDate ? new Date(task.recurrenceEndDate).toISOString().slice(0, 16) : '');
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
      if (recurrenceType === 'weekly') { fd.append('recurrenceDays', JSON.stringify(recurrenceDays)); }
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
      <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title *</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" required /></div>
      <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" /></div>
      <CustomDropdown label="Task Type" options={taskTypeOptions} value={taskType} onChange={setTaskType} brandColor={brandColor} />
      <CustomDropdown label="Status" options={statusOptions} value={status} onChange={setStatus} brandColor={brandColor} />
      <CustomDropdown label="Folder" options={folderOpts} value={folderId} onChange={setFolderId} brandColor={brandColor} />
      <CustomDropdown label="Assignee" options={assigneeOpts} value={assigneeId} onChange={setAssigneeId} brandColor={brandColor} />
      <div className="grid grid-cols-2 gap-3">
        <CustomDropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} brandColor={brandColor} />
        <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date & Time</label><input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" /></div>
      </div>
      <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Due Date & Time</label><input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Est. Hours</label><input type="number" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" /></div>
        <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buffer Time (hours)</label><input type="number" step="0.5" value={bufferTime} onChange={e => setBufferTime(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" /></div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recurrence</label>
        <select value={recurrenceType} onChange={(e) => { setRecurrenceType(e.target.value); if (e.target.value !== 'weekly') setRecurrenceDays([]); }} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none">
          <option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
        </select>
      </div>
      {recurrenceType === 'weekly' && (
        <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Repeat on</label><div className="flex flex-wrap gap-2">{weekDays.map((day, idx) => (<button key={idx} type="button" onClick={() => toggleDay(idx)} className={`px-3 py-1 rounded-full text-xs font-medium transition ${recurrenceDays.includes(idx) ? 'bg-[#0d9488] text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>{day}</button>))}</div></div>
      )}
      {(recurrenceType === 'daily' || recurrenceType === 'weekly') && (<div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date (optional)</label><input type="datetime-local" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" /></div>)}
      <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Links (one per line)</label><textarea value={links} onChange={e => setLinks(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" placeholder="https://..." /></div>
      <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Attachments</label><input type="file" multiple onChange={e => setAttachments([...e.target.files])} className="text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#0d9488]/20 file:text-[#0d9488]" /></div>
      <div className="flex items-center gap-2"><input type="checkbox" id="allowAssigneeEditSubtasks-edit" checked={allowAssigneeEditSubtasks} onChange={e => setAllowAssigneeEditSubtasks(e.target.checked)} className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-[#0d9488] focus:ring-[#0d9488]" /><label htmlFor="allowAssigneeEditSubtasks-edit" className="text-xs text-gray-700 dark:text-gray-300">Allow assignee to add/edit sub‑tasks</label></div>
      <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Daily Reminder Time</label><input type="time" value={dailyReminderTime} onChange={e => setDailyReminderTime(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" /></div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Updating...' : 'Update Task'}</button>
      </div>
    </form>
  );
});

export const AddMemberForm = React.memo(({ project, workspace, brandColor, onSuccess, onCancel, onAddManager }) => {
  const [role, setRole] = useState('member');
  const [memberId, setMemberId] = useState('');
  const [loading, setLoading] = useState(false);
  const [addTeamMember] = useAddTeamMemberMutation();
  const projectMemberIds = project.teamMembers?.filter(m => m.status === 'active').map(m => m.user?._id || m._id) || [];
  const available = workspace.members?.filter(m => m.status === 'active' && !projectMemberIds.includes(m.user?._id || m._id)) || [];
  const options = available.map(m => { const u = m.user || m; return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" /> : <FaUser className="text-gray-400" /> }; });
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
          <button type="button" onClick={() => setRole('member')} className={`flex-1 py-1.5 text-sm rounded-lg border transition ${role === 'member' ? 'border-[#0d9488] bg-[#0d9488]/10 text-[#0d9488]' : 'border-gray-300 dark:border-gray-700/60 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30'}`}>Member</button>
          <button type="button" onClick={() => setRole('manager')} className={`flex-1 py-1.5 text-sm rounded-lg border transition ${role === 'manager' ? 'border-[#0d9488] bg-[#0d9488]/10 text-[#0d9488]' : 'border-gray-300 dark:border-gray-700/60 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30'}`}>Manager</button>
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

export const AssignForm = React.memo(({ assignableMembers, onAssign, brandColor, onCancel }) => {
  const [assigneeId, setAssigneeId] = useState('');
  const [loading, setLoading] = useState(false);
  const assigneeOpts = assignableMembers.map(m => { const u = m.user || m; return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" alt="" /> : <FaUser className="text-gray-400" /> }; });
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
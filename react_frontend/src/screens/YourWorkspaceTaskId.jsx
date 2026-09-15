import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  FaArrowLeft, FaEllipsisV, FaEdit, FaTrashAlt, FaBell, FaUserPlus,
  FaTasks, FaPlus, FaCheck, FaCheckDouble, FaCheckCircle, FaTimes,
  FaAngleDown, FaFolder, FaFolderOpen, FaCalendarAlt, FaRegClock,
  FaRedo, FaClock, FaGripVertical, FaUser, FaFlag, FaFire, FaCamera,
  FaLink, FaPaperclip, FaExclamationTriangle, FaListUl, FaCommentDots,
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
  useMarkSubTaskDoneMutation,
  useConfirmSubTaskMutation,
  useRejectSubTaskMutation,
  useDeleteSubTaskMutation,
  useReorderSubTasksMutation,
  useGetProjectFoldersQuery,
} from '../slices/taskApiSlice';
import { useMediaPicker } from '../hooks/useMediaPicker';

const fmtDateTime = (d) => (!d ? 'N/A' : new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
const fmtDate = (d) => (!d ? 'N/A' : new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

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

const Dropdown = ({ label, options, value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const sel = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      {label && <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>}
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-300">
        {sel?.icon}<span className="truncate flex-1 text-left">{sel ? sel.label : placeholder}</span><FaAngleDown className={`text-[10px] text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-50 max-h-48 overflow-y-auto">
          {options.map((o) => <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${o.value === value ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'}`}>{o.icon}<span>{o.label}</span></button>)}
        </div>
      )}
    </div>
  );
};
const MultiDropdown = ({ label, options, values = [], onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const sel = options.filter((o) => values.includes(o.value));
  const text = sel.length === 0 ? placeholder : sel.length === 1 ? sel[0].label : `${sel.length} selected`;
  const toggle = (v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <div ref={ref} className="relative">
      {label && <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>}
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-300">
        <span className="truncate flex-1 text-left">{text}</span><FaAngleDown className={`text-[10px] text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-50 max-h-56 overflow-y-auto">
          {options.map((o) => { const checked = values.includes(o.value); return (
            <button key={o.value} type="button" onClick={() => toggle(o.value)} className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${checked ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'}`}>
              <span className={`w-3.5 h-3.5 flex items-center justify-center border rounded ${checked ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-400 dark:border-gray-600'}`}>{checked && <FaCheck className="text-[8px]" />}</span>{o.icon}<span className="truncate">{o.label}</span>
            </button>
          ); })}
        </div>
      )}
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

// ─── Checklist modals ─────────────────────────────────────────────
const AddChecklistModal = ({ isOpen, onClose, onSubmit }) => {
  const [title, setTitle] = useState(''); const [start, setStart] = useState(''); const [due, setDue] = useState(''); const [loading, setLoading] = useState(false);
  if (!isOpen) return null;
  const submit = async () => {
    if (!title.trim()) return toast.error('Title required');
    setLoading(true);
    try { await onSubmit({ title: title.trim(), startDate: start || null, dueDate: due || null }); setTitle(''); setStart(''); setDue(''); onClose(); }
    catch (e) { toast.error(e?.data?.message || 'Failed'); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4"><h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Add Checklist Item</h3><button onClick={onClose}><FaTimes className="text-gray-400" /></button></div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Item title" className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 mb-2 outline-none" />
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 mb-2 outline-none" />
        <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 mb-4 outline-none" />
        <div className="flex gap-3"><button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600">Cancel</button><button onClick={submit} disabled={loading} className="flex-1 py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl text-sm font-medium">{loading ? 'Adding...' : 'Add'}</button></div>
      </div>
    </div>
  );
};

const ChecklistDoneModal = ({ isOpen, onClose, onSubmit, canManage }) => {
  const [notes, setNotes] = useState(''); const [linksText, setLinksText] = useState('');
  const { files, pickMedia, setFiles } = useMediaPicker();
  const [loading, setLoading] = useState(false);
  if (!isOpen) return null;
  const submit = async () => {
    setLoading(true);
    try { await onSubmit({ notes, links: linksText.split('\n').filter(Boolean), files }); setNotes(''); setLinksText(''); setFiles([]); onClose(); }
    catch (e) { toast.error(e?.data?.message || 'Failed'); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between mb-4"><h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Mark Item Done</h3><button onClick={onClose}><FaTimes className="text-gray-400" /></button></div>
        <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 mb-2 outline-none" />
        <textarea placeholder="Links (one per line)" value={linksText} onChange={(e) => setLinksText(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 mb-2 outline-none" />
        <button type="button" onClick={() => pickMedia({ multiple: true })} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-xl text-sm text-gray-700 dark:text-gray-300 mb-2"><FaCamera className="text-xs" /> Choose Files</button>
        {files.length > 0 && files.map((f, i) => <div key={i} className="flex justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5 mb-1"><span className="text-sm truncate text-gray-700 dark:text-gray-300">{f.name}</span><button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-red-500"><FaTrashAlt className="text-xs" /></button></div>)}
        <div className="flex gap-3 mt-2"><button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600">Cancel</button><button onClick={submit} disabled={loading} className="flex-1 py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl text-sm font-medium">{loading ? 'Saving...' : canManage ? 'Complete & Confirm' : 'Submit Done'}</button></div>
      </div>
    </div>
  );
};

const ChecklistConfirmModal = ({ isOpen, onClose, subTask, onSubmit }) => {
  const [feedback, setFeedback] = useState(''); const [loading, setLoading] = useState(false);
  if (!isOpen) return null;
  const submit = async () => { setLoading(true); try { await onSubmit(feedback); setFeedback(''); onClose(); } catch (e) { toast.error(e?.data?.message || 'Failed'); } finally { setLoading(false); } };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4"><h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Confirm Item</h3><button onClick={onClose}><FaTimes className="text-gray-400" /></button></div>
        {subTask?.notes && <p className="text-xs text-gray-600 dark:text-gray-400 mb-2"><span className="font-medium">Notes:</span> {subTask.notes}</p>}
        <textarea placeholder="Feedback (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 mb-4 outline-none" />
        <div className="flex gap-3"><button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600">Cancel</button><button onClick={submit} disabled={loading} className="flex-1 py-2 bg-green-600 text-white rounded-xl text-sm font-medium">{loading ? 'Confirming...' : 'Confirm'}</button></div>
      </div>
    </div>
  );
};

const ReasonModal = ({ isOpen, onClose, onSubmit, title }) => {
  const [reason, setReason] = useState(''); const [loading, setLoading] = useState(false);
  if (!isOpen) return null;
  const submit = async () => { setLoading(true); try { await onSubmit(reason); setReason(''); onClose(); } catch (e) { toast.error(e?.data?.message || 'Failed'); } finally { setLoading(false); } };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4"><h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{title}</h3><button onClick={onClose}><FaTimes className="text-gray-400" /></button></div>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 mb-4 outline-none" />
        <div className="flex gap-3"><button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600">Cancel</button><button onClick={submit} disabled={loading} className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium">{loading ? 'Submitting...' : 'Confirm'}</button></div>
      </div>
    </div>
  );
};

// ─── Task-level completion modals ───────────────────────────────
const MarkCompleteModal = ({ isOpen, onClose, task, brandColor, onSubmit }) => {
  const [notes, setNotes] = useState(''); const [linksText, setLinksText] = useState('');
  const { files, pickMedia, setFiles } = useMediaPicker(); const [loading, setLoading] = useState(false);
  if (!isOpen) return null;
  const submit = async () => {
    setLoading(true);
    try { await onSubmit({ notes: notes.trim(), links: linksText.split('\n').map((l) => l.trim()).filter(Boolean), attachments: files }); onClose(); setNotes(''); setLinksText(''); setFiles([]); }
    catch (e) { /* handled by caller */ } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between mb-4"><h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Mark Task Complete</h2><button onClick={onClose}><FaTimes className="text-gray-400" /></button></div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Confirm you have completed <span className="font-medium text-gray-800 dark:text-gray-200">"{task?.title}"</span>.</p>
        <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 mb-2 outline-none" />
        <textarea placeholder="Links (one per line, optional)" value={linksText} onChange={(e) => setLinksText(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 mb-2 outline-none" />
        <button type="button" onClick={() => pickMedia({ multiple: true })} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-xl text-sm text-gray-700 dark:text-gray-300 mb-2"><FaCamera className="text-xs" /> Choose Files</button>
        {files.length > 0 && files.map((f, i) => <div key={i} className="flex justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5 mb-1"><span className="text-sm truncate text-gray-700 dark:text-gray-300">{f.name}</span><button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-red-500"><FaTrashAlt className="text-xs" /></button></div>)}
        <div className="flex gap-3 mt-2"><button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600">Cancel</button><button onClick={submit} disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium" style={{ backgroundColor: brandColor }}>{loading ? 'Submitting...' : 'Complete'}</button></div>
      </div>
    </div>
  );
};

const ConfirmCompletionModal = ({ isOpen, onClose, task, brandColor, onSubmit, onReject }) => {
  const [feedback, setFeedback] = useState(''); const [finalHours, setFinalHours] = useState(''); const [finalLinksText, setFinalLinksText] = useState('');
  const { files, pickMedia, setFiles } = useMediaPicker(); const [loading, setLoading] = useState(false);
  const [showReject, setShowReject] = useState(false); const [rejectReason, setRejectReason] = useState('');
  if (!isOpen) return null;
  const reset = () => { setFeedback(''); setFinalHours(''); setFinalLinksText(''); setFiles([]); setRejectReason(''); setShowReject(false); };
  const submit = async () => {
    setLoading(true);
    try {
      const links = finalLinksText.split('\n').map((l) => l.trim()).filter(Boolean);
      await onSubmit({ feedback: feedback.trim(), finalHours: finalHours ? parseFloat(finalHours) : undefined, finalLinks: links.length ? links : undefined, finalAttachments: files });
      onClose(); reset();
    } catch (e) { /* handled by caller */ } finally { setLoading(false); }
  };
  const reject = async () => {
    if (!rejectReason.trim()) return toast.error('Provide a reason');
    setLoading(true);
    try { await onReject(task._id, rejectReason.trim()); onClose(); reset(); } catch (e) { /* handled */ } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between mb-4"><h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Confirm or Reject Task</h2><button onClick={onClose}><FaTimes className="text-gray-400" /></button></div>
        {task?.finalLinks?.length > 0 && <div className="mb-3 text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">Submitted links:</span><ul className="list-disc pl-5 mt-1">{task.finalLinks.map((l, i) => <li key={i}><a href={l} target="_blank" rel="noreferrer" className="text-teal-600 underline break-all">{l}</a></li>)}</ul></div>}
        {task?.finalAttachments?.length > 0 && <div className="mb-3 text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">Submitted attachments:</span><ul className="list-disc pl-5 mt-1">{task.finalAttachments.map((a, i) => <li key={i}><a href={a.url} target="_blank" rel="noreferrer" className="text-teal-600 underline break-all">{a.name || 'file'}</a></li>)}</ul></div>}
        <textarea placeholder="Feedback (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 mb-2 outline-none" />
        <input type="number" step="0.5" placeholder="Actual hours (optional)" value={finalHours} onChange={(e) => setFinalHours(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 mb-2 outline-none" />
        <textarea placeholder="Final links (one per line, optional)" value={finalLinksText} onChange={(e) => setFinalLinksText(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 mb-2 outline-none" />
        <button type="button" onClick={() => pickMedia({ multiple: true })} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-xl text-sm text-gray-700 dark:text-gray-300 mb-2"><FaCamera className="text-xs" /> Choose Files</button>
        {files.length > 0 && files.map((f, i) => <div key={i} className="flex justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5 mb-1"><span className="text-sm truncate text-gray-700 dark:text-gray-300">{f.name}</span><button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-red-500"><FaTrashAlt className="text-xs" /></button></div>)}
        {showReject && <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection *" className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-red-300 rounded-xl text-sm text-gray-800 dark:text-gray-200 mt-2 outline-none" />}
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600">Cancel</button>
          {!showReject ? (
            <>
              <button onClick={() => setShowReject(true)} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium">Reject</button>
              <button onClick={submit} disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium" style={{ backgroundColor: brandColor }}>{loading ? 'Confirming...' : 'Confirm'}</button>
            </>
          ) : (
            <>
              <button onClick={() => setShowReject(false)} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600">Back</button>
              <button onClick={reject} disabled={loading} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium">{loading ? 'Rejecting...' : 'Confirm Rejection'}</button>
            </>
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4"><h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaUserPlus className="inline mr-1 text-teal-600" /> Assign Task</h2><button onClick={onClose}><FaTimes className="text-gray-400" /></button></div>
        <MultiDropdown label="Assignees" options={opts} values={ids} onChange={setIds} placeholder="Select members..." />
        <div className="flex gap-3 mt-4"><button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600">Cancel</button><button onClick={submit} disabled={loading || !ids.length} className="flex-1 py-2 text-white rounded-xl text-sm font-medium" style={{ backgroundColor: brandColor }}>{loading ? 'Assigning...' : 'Assign'}</button></div>
      </div>
    </div>
  );
};

const EditTaskModal = ({ isOpen, onClose, task, brandColor, assignableMembers, folders, onSuccess }) => {
  const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [assigneeIds, setAssigneeIds] = useState([]); const [priority, setPriority] = useState('medium'); const [status, setStatus] = useState('pending');
  const [startDate, setStartDate] = useState(''); const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(''); const [bufferTime, setBufferTime] = useState(0);
  const [allowAssigneeEditSubtasks, setAllowAssigneeEditSubtasks] = useState(false);
  const [linksText, setLinksText] = useState(''); const { files, pickMedia, setFiles } = useMediaPicker();
  const [folderId, setFolderId] = useState(''); const [loading, setLoading] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('none'); const [recurrenceDays, setRecurrenceDays] = useState([]); const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
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
    setLinksText((task.links || []).join('\n')); setFolderId(task.folder?._id || '');
    setRecurrenceType(task.recurrenceType || 'none'); setRecurrenceDays(task.recurrenceDays || []);
    setRecurrenceEndDate(task.recurrenceEndDate ? new Date(task.recurrenceEndDate).toISOString().slice(0, 16) : '');
  }, [task, isOpen]);

  if (!isOpen || !task) return null;
  const assigneeOpts = assignableMembers.map((m) => { const u = m.user || m; return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full object-cover" alt="" /> : <FaUser className="text-gray-400" /> }; });
  const folderOpts = [{ value: '', label: 'No Folder', icon: <FaFolderOpen className="text-gray-400" /> }, ...folders.map((f) => ({ value: f._id, label: f.name, icon: <FaFolder className="text-gray-400" /> }))];

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
      linksText.split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => fd.append('links', l));
      files.forEach((f) => fd.append('attachments', f));
      await updateTask({ taskId: task._id, data: fd }).unwrap();
      toast.success('Task updated'); onSuccess(); onClose(); setFiles([]);
    } catch (err) { toast.error(err?.data?.message || 'Failed'); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between mb-4"><h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaEdit className="inline mr-1 text-teal-600" /> Edit Task</h2><button onClick={onClose}><FaTimes className="text-gray-400" /></button></div>
        <form onSubmit={submit} className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" required />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description" className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" />
          <Dropdown label="Status" options={statusOptions} value={status} onChange={setStatus} />
          <MultiDropdown label="Assignees" options={assigneeOpts} values={assigneeIds} onChange={setAssigneeIds} placeholder="Select members..." />
          <Dropdown label="Folder" options={folderOpts} value={folderId} onChange={setFolderId} />
          <div className="grid grid-cols-2 gap-3">
            <Dropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} />
            <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start</label><input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Due</label><input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Est. hours</label><input type="number" step="0.5" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" /></div>
            <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buffer (min)</label><input type="number" min="0" value={bufferTime} onChange={(e) => setBufferTime(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" /></div>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"><input type="checkbox" checked={allowAssigneeEditSubtasks} onChange={(e) => setAllowAssigneeEditSubtasks(e.target.checked)} className="accent-teal-600" /> Allow assignee to edit checklist</label>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recurrence</label>
            <select value={recurrenceType} onChange={(e) => { setRecurrenceType(e.target.value); if (e.target.value !== 'weekly') setRecurrenceDays([]); }} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none"><option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select>
          </div>
          {recurrenceType === 'weekly' && <div className="flex flex-wrap gap-2">{weekDays.map((d, i) => <button key={i} type="button" onClick={() => setRecurrenceDays(recurrenceDays.includes(i) ? recurrenceDays.filter((x) => x !== i) : [...recurrenceDays, i].sort())} className={`px-3 py-1 rounded-full text-xs font-medium ${recurrenceDays.includes(i) ? 'bg-teal-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>{d}</button>)}</div>}
          {recurrenceType !== 'none' && <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recurrence end</label><input type="datetime-local" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" /></div>}
          <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaLink className="inline mr-1" />Links</label><textarea value={linksText} onChange={(e) => setLinksText(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none" /></div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><FaPaperclip className="inline mr-1" />New attachments</label>
            <button type="button" onClick={() => pickMedia({ multiple: true })} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-xl text-sm text-gray-700 dark:text-gray-300"><FaCamera className="text-xs" /> Choose Files</button>
            {files.length > 0 && files.map((f, i) => <div key={i} className="flex justify-between bg-gray-50 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5 mt-1"><span className="text-sm truncate text-gray-700 dark:text-gray-300">{f.name}</span><button type="button" onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-red-500"><FaTrashAlt className="text-xs" /></button></div>)}
          </div>
          <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600">Cancel</button><button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium" style={{ backgroundColor: brandColor }}>{loading ? 'Updating...' : 'Update Task'}</button></div>
        </form>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Task summary block (shared between desktop sidebar & mobile accordion)
// ═══════════════════════════════════════════════════════════════
const TaskSummary = ({ task, brandColor, submissionExpanded, setSubmissionExpanded, rejectionExpanded, setRejectionExpanded, hasSubmissionData, showRejection, isOverdueTask }) => (
  <div className="space-y-4">
    {/* Meta grid */}
    <div className="grid grid-cols-2 gap-3 text-xs">
      {task.dueDate && (
        <div>
          <div className="text-gray-500 dark:text-gray-500 mb-0.5 flex items-center gap-1"><FaCalendarAlt /> Due</div>
          <div className={`font-medium break-words ${isOverdueTask ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>{fmtDateTime(task.dueDate)}</div>
        </div>
      )}
      {task.startDate && (
        <div>
          <div className="text-gray-500 dark:text-gray-500 mb-0.5 flex items-center gap-1"><FaRegClock /> Start</div>
          <div className="font-medium text-gray-800 dark:text-gray-200 break-words">{fmtDateTime(task.startDate)}</div>
        </div>
      )}
      {task.estimatedHours != null && task.estimatedHours !== '' && (
        <div>
          <div className="text-gray-500 dark:text-gray-500 mb-0.5">Est. hours</div>
          <div className="font-medium text-gray-800 dark:text-gray-200">{task.estimatedHours}</div>
        </div>
      )}
      {task.actualHours != null && task.status === 'confirmed_completed' && (
        <div>
          <div className="text-gray-500 dark:text-gray-500 mb-0.5">Actual hours</div>
          <div className="font-medium text-gray-800 dark:text-gray-200">{task.actualHours}</div>
        </div>
      )}
    </div>

    {/* Assignees */}
    {(task.assignees || []).length > 0 && (
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-500 mb-2">Assignees</div>
        <div className="flex flex-wrap gap-1.5">
          {task.assignees.map((a) => (
            <div key={a._id || a} className="flex items-center gap-1.5 bg-gray-50 dark:bg-[#1a1a24] rounded-full pl-0.5 pr-2.5 py-0.5 border border-gray-200 dark:border-gray-800/40 max-w-full">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold overflow-hidden shrink-0" style={{ backgroundColor: brandColor }}>
                {a.profile ? <img src={a.profile} className="w-full h-full object-cover" alt="" /> : (a.name || '?').charAt(0).toUpperCase()}
              </div>
              <span className="text-[11px] text-gray-700 dark:text-gray-300 break-words">{a.name || 'Unknown'}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Description */}
    {task.description && (
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-500 mb-1">Description</div>
        <p className="text-sm text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap leading-relaxed">{task.description}</p>
      </div>
    )}

    {/* Links */}
    {task.links?.length > 0 && (
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-500 mb-1.5 flex items-center gap-1"><FaLink /> Links</div>
        <div className="space-y-1">
          {task.links.map((l, i) => (
            <a key={i} href={l} target="_blank" rel="noreferrer" className="block text-xs text-teal-600 dark:text-[#0d9488] underline break-all hover:opacity-80">{l}</a>
          ))}
        </div>
      </div>
    )}

    {/* Attachments */}
    {task.attachments?.length > 0 && (
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-500 mb-1.5 flex items-center gap-1"><FaPaperclip /> Attachments</div>
        <div className="space-y-1">
          {task.attachments.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block text-xs text-teal-600 dark:text-[#0d9488] underline break-all hover:opacity-80">{a.name || 'file'}</a>
          ))}
        </div>
      </div>
    )}

    {/* Submission */}
    {hasSubmissionData && (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800/60 bg-gray-50 dark:bg-[#1a1a24] overflow-hidden">
        <button onClick={() => setSubmissionExpanded(!submissionExpanded)} className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/40 transition">
          <span className="flex items-center gap-1.5"><FaCheckDouble className="text-teal-500" /> Submission Details</span>
          <FaAngleDown className={`text-gray-400 text-[10px] transition-transform ${submissionExpanded ? 'rotate-180' : ''}`} />
        </button>
        {submissionExpanded && (
          <div className="px-3 pb-3 space-y-2 text-xs">
            {task.completionNotes && <div className="break-words"><span className="font-medium text-gray-700 dark:text-gray-300">Notes: </span><span className="text-gray-600 dark:text-gray-400">{task.completionNotes}</span></div>}
            {task.finalLinks?.length > 0 && (
              <div>
                <div className="font-medium text-gray-700 dark:text-gray-300 mb-0.5">Links:</div>
                {task.finalLinks.map((l, i) => <a key={i} href={l} target="_blank" rel="noreferrer" className="block text-teal-600 dark:text-[#0d9488] underline break-all">{l}</a>)}
              </div>
            )}
            {task.finalAttachments?.length > 0 && (
              <div>
                <div className="font-medium text-gray-700 dark:text-gray-300 mb-0.5">Attachments:</div>
                {task.finalAttachments.map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block text-teal-600 dark:text-[#0d9488] underline break-all">{a.name || 'file'}</a>)}
              </div>
            )}
            {task.completedBy && <div className="break-words text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Submitted by: </span>{task.completedBy.name || 'Unknown'} on {fmtDateTime(task.completedAt)}</div>}
            {task.status === 'confirmed_completed' && task.completionFeedback && <div className="break-words text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Feedback: </span>{task.completionFeedback}</div>}
          </div>
        )}
      </div>
    )}

    {/* Rejection */}
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
const YourWorkspaceTaskId = () => {
  const { workspaceId, projectId, taskId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((s) => s.auth);

  const { data: wData } = useGetWorkspaceQuery(workspaceId);
  const { data: pData, isLoading: pLoad } = useGetProjectByIdQuery(projectId);
  const { data: foldersData } = useGetProjectFoldersQuery(projectId);
  const { data: tData, isLoading: tLoad, error: tErr, refetch: refetchTask } = useGetTaskByIdQuery(taskId, { skip: !taskId });
  const { data: feedbackData } = useGetTaskFeedbackQuery({ taskId }, { skip: !taskId });

  const [deleteTask] = useDeleteTaskMutation();
  const [assignTask] = useAssignTaskMutation();
  const [markTaskCompleted] = useMarkTaskCompletedMutation();
  const [confirmTaskCompletion] = useConfirmTaskCompletionMutation();
  const [rejectTask] = useRejectTaskMutation();
  const [sendManualReminder] = useSendManualReminderMutation();
  const [addSubTask] = useAddSubTaskMutation();
  const [markSubTaskDone] = useMarkSubTaskDoneMutation();
  const [confirmSubTask] = useConfirmSubTaskMutation();
  const [rejectSubTask] = useRejectSubTaskMutation();
  const [deleteSubTask] = useDeleteSubTaskMutation();
  const [reorderSubTasks] = useReorderSubTasksMutation();

  const workspace = wData?.workspace;
  const project = pData?.project;
  const task = tData?.task;
  const brandColor = workspace?.color || '#0d9488';
  const canManage = !!project?.canManage;
  const isAssignee = (task?.assignees || []).some((a) => (a._id || a)?.toString() === userInfo?._id?.toString());
  const isReadOnly = task?.isArchived || task?.isTrash || false;
  const hasAssignees = (task?.assignees || []).length > 0;

  const assignableMembers = useMemo(() => {
    if (!project) return [];
    const mgrs = project.projectManagers || [];
    const active = (project.teamMembers || []).filter((m) => m.status === 'active');
    const all = [...active, ...mgrs.map((pm) => ({ user: pm }))];
    const seen = new Set();
    return all.filter((item) => { const id = item.user?._id || item._id; if (seen.has(id)) return false; seen.add(id); return true; });
  }, [project]);

  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showMarkComplete, setShowMarkComplete] = useState(false);
  const [showConfirmCompletion, setShowConfirmCompletion] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [doneModal, setDoneModal] = useState({ isOpen: false, index: null });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, index: null });
  const [rejectModal, setRejectModal] = useState({ isOpen: false, index: null });
  const [deleteSubModal, setDeleteSubModal] = useState({ isOpen: false, index: null });
  const [expandedSub, setExpandedSub] = useState(null);
  const [submissionExpanded, setSubmissionExpanded] = useState(false);
  const [rejectionExpanded, setRejectionExpanded] = useState(!!task?.rejectedBy);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  useEffect(() => { if (task?.rejectedBy) setRejectionExpanded(true); }, [task?.rejectedBy]);

  useEffect(() => {
    if (!taskId || tErr) {
      navigate(`/workspace/${workspaceId}/project/${projectId}`, { replace: true });
    }
  }, [taskId, tErr, navigate, workspaceId, projectId]);

  if (!taskId || tErr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (pLoad || tLoad || !task || !project || !workspace) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]"><div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: brandColor }} /></div>;
  }

  const backToProject = () => navigate(`/workspace/${workspaceId}/project/${projectId}`);

  const handleDelete = async () => {
    try { await deleteTask(task._id).unwrap(); toast.success('Deleted'); backToProject(); }
    catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };

  const handleAssign = async (ids) => {
    try { await assignTask({ taskId: task._id, assigneeIds: ids, assigneeId: ids[0] || '' }).unwrap(); toast.success('Assigned'); refetchTask(); }
    catch (err) { throw err; }
  };

  const handleMarkComplete = async ({ notes, links, attachments }) => {
    try {
      const fd = new FormData();
      fd.append('notes', notes || '');
      links.forEach((l) => fd.append('links', l));
      attachments.forEach((f) => fd.append('completionAttachments', f));
      await markTaskCompleted({ taskId: task._id, data: fd }).unwrap();
      toast.success(canManage ? 'Task completed and confirmed' : 'Task submitted, awaiting confirmation');
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
      toast.success('Task completion confirmed'); refetchTask();
    } catch (err) { toast.error(err?.data?.message || 'Failed to confirm'); throw err; }
  };

  const handleRejectTask = async (id, reason) => {
    try { await rejectTask({ taskId: id, reason }).unwrap(); toast.success('Task rejected'); refetchTask(); }
    catch (err) { toast.error(err?.data?.message || 'Failed to reject'); throw err; }
  };

  const handleReminder = async () => {
    try { await sendManualReminder({ taskId: task._id, message: '' }).unwrap(); toast.success('Reminder sent'); }
    catch (e) { toast.error(e?.data?.message || 'Failed to send reminder'); }
  };

  const handleAddSubtask = async (data) => {
    await addSubTask({ taskId: task._id, data }).unwrap();
    toast.success('Checklist item added'); refetchTask();
  };

  const submitDone = async ({ notes, links, files }) => {
    const fd = new FormData(); fd.append('notes', notes); fd.append('links', JSON.stringify(links)); files.forEach((f) => fd.append('attachments', f));
    await markSubTaskDone({ taskId: task._id, subTaskIndex: doneModal.index, data: fd }).unwrap();
    toast.success(canManage ? 'Item completed & confirmed' : 'Item marked done'); refetchTask();
  };

  const submitConfirmSub = async (feedback) => {
    await confirmSubTask({ taskId: task._id, subTaskIndex: confirmModal.index, feedback }).unwrap();
    toast.success('Item confirmed'); refetchTask();
  };

  const submitRejectSub = async (reason) => {
    await rejectSubTask({ taskId: task._id, subTaskIndex: rejectModal.index, reason }).unwrap();
    toast.success('Item rejected'); refetchTask();
  };

  const confirmDeleteSub = async () => {
    try { await deleteSubTask({ taskId: task._id, subTaskIndex: deleteSubModal.index }).unwrap(); toast.success('Item deleted'); refetchTask(); }
    catch (e) { toast.error(e?.data?.message || 'Failed'); }
    setDeleteSubModal({ isOpen: false, index: null });
  };

  const canReorderSub = (canManage || (isAssignee && task.allowAssigneeEditSubtasks)) && !isReadOnly;
  const onSubDragStart = (e, i) => { if (!canReorderSub) { e.preventDefault(); toast.error('No permission to reorder'); return; } setDraggedIdx(i); e.dataTransfer.setData('text/plain', String(i)); };
  const onSubDrop = async (e, targetIdx) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    const di = raw !== '' ? parseInt(raw, 10) : draggedIdx;
    setDragOverIdx(null);
    if (di === null || di === undefined || di === targetIdx) return;
    const subtasks = task.subTasks || [];
    const indices = subtasks.map((_, i) => i);
    const [moved] = indices.splice(di, 1);
    indices.splice(targetIdx, 0, moved);
    setDraggedIdx(null);
    try { await reorderSubTasks({ taskId: task._id, orderedSubTaskIndices: indices }).unwrap(); refetchTask(); }
    catch (err) { toast.error(err?.data?.message || 'Failed to reorder'); }
  };

  const progress = task.progress || 0;
  const subTasks = task.subTasks || [];
  const confirmedCount = subTasks.filter((s) => s.status === 'confirmed').length;
  const hasRecurrence = task.recurrenceType && task.recurrenceType !== 'none';
  const hasSubmissionData = task.completionNotes || task.finalLinks?.length || task.finalAttachments?.length || task.completedBy;
  const showRejection = task.rejectedBy && task.rejectedAt;
  const isOverdueTask = task.dueDate && new Date(task.dueDate) < new Date() && !['completed', 'confirmed_completed', 'cancelled'].includes(task.status);

  const showMarkCompleteBtn = !isReadOnly && task.status === 'ready_for_completion' && (isAssignee || canManage);
  const showConfirmCompletionBtn = !isReadOnly && canManage && task.status === 'completed';

  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col overflow-hidden">
      {/* ─── Header ─────────────────────────────────────── */}
      <header className="shrink-0 bg-white/90 dark:bg-[#14141a]/90 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/60 z-20">
        <div className="px-3 lg:px-6 py-2.5 lg:py-3 flex items-center gap-2 lg:gap-3">
          <button onClick={backToProject} className="p-1.5 -ml-1 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition shrink-0">
            <FaArrowLeft className="text-sm" />
          </button>
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: brandColor }}>
            {task.title.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm lg:text-base font-semibold text-gray-800 dark:text-gray-100 leading-tight truncate">{task.title}</h2>
            <div className="flex items-center gap-1.5 text-[11px] flex-wrap mt-0.5 text-gray-500 dark:text-gray-400">
              <StatusPill status={task.status} />
              <span className="hidden sm:inline"><PriorityPill priority={task.priority} /></span>
              <span className="font-mono">{confirmedCount}/{subTasks.length} done</span>
              {task.dueDate && (
                <>
                  <span className="hidden sm:inline">·</span>
                  <span className={`${isOverdueTask ? 'text-red-500 font-medium' : ''} flex items-center gap-0.5`}>
                    <FaCalendarAlt className="text-[9px]" /> {fmtDate(task.dueDate)}
                  </span>
                </>
              )}
              {hasRecurrence && (
                <>
                  <span className="hidden sm:inline">·</span>
                  <span className="text-teal-600 dark:text-[#0d9488] flex items-center gap-0.5">
                    <FaRedo className="text-[9px]" /> {task.recurrenceType === 'daily' ? 'Daily' : 'Weekly'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action button — desktop only (lg+) */}
          {showMarkCompleteBtn && (
            <button
              onClick={() => setShowMarkComplete(true)}
              className="hidden lg:flex shrink-0 px-3.5 py-2 text-white rounded-lg text-sm font-medium items-center gap-1.5 hover:opacity-90 transition"
              style={{ backgroundColor: brandColor }}
            >
              <FaCheckDouble className="text-xs" />
              {canManage ? 'Mark as Complete & Confirm' : 'Mark as Complete'}
            </button>
          )}
          {showConfirmCompletionBtn && (
            <button
              onClick={() => setShowConfirmCompletion(true)}
              className="hidden lg:flex shrink-0 px-3.5 py-2 text-white rounded-lg text-sm font-medium items-center gap-1.5 hover:opacity-90 transition"
              style={{ backgroundColor: brandColor }}
            >
              <FaCheckCircle className="text-xs" />
              Confirm Completion
            </button>
          )}

          <div className="relative shrink-0">
            <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition">
              <FaEllipsisV className="text-sm" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-800/60 rounded-xl min-w-[180px] z-30 py-1 shadow-lg">
                {canManage && !isReadOnly && <button onClick={() => { setShowMenu(false); handleReminder(); }} className="flex items-center gap-2 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 w-full"><FaBell className="text-xs" /> Send Reminder</button>}
                {!isReadOnly && <button onClick={() => { setShowMenu(false); setShowEdit(true); }} className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 w-full"><FaEdit className="text-xs" /> Edit</button>}
                {canManage && !hasAssignees && !isReadOnly && <button onClick={() => { setShowMenu(false); setShowAssign(true); }} className="flex items-center gap-2 px-4 py-2 text-sm text-teal-600 hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 w-full"><FaUserPlus className="text-xs" /> Assign Task</button>}
                {canManage && !isReadOnly && <button onClick={() => { setShowMenu(false); setDeleteConfirm(true); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 w-full"><FaTrashAlt className="text-xs" /> Delete</button>}
              </div>
            )}
          </div>
        </div>

        {/* Slim progress bar under header */}
        <div className="w-full h-0.5 bg-gray-200/60 dark:bg-gray-800/40">
          <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: brandColor }} />
        </div>
      </header>

      {/* ─── Body ─────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]">

        {/* LEFT: Task summary (desktop) */}
        <aside className="hidden lg:block lg:h-full lg:overflow-y-auto bg-white dark:bg-[#14141a] border-r border-gray-200/60 dark:border-gray-800/60">
          <div className="p-5">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-4">Task Details</h3>
            <TaskSummary
              task={task}
              brandColor={brandColor}
              submissionExpanded={submissionExpanded}
              setSubmissionExpanded={setSubmissionExpanded}
              rejectionExpanded={rejectionExpanded}
              setRejectionExpanded={setRejectionExpanded}
              hasSubmissionData={hasSubmissionData}
              showRejection={showRejection}
              isOverdueTask={isOverdueTask}
            />
          </div>
        </aside>

        {/* MIDDLE: Checklist */}
        <main className="lg:h-full lg:overflow-y-auto">
          <div className="p-3 lg:p-6 space-y-4 lg:space-y-5">

            {/* Mobile: collapsible task details */}
            <div className="lg:hidden">
              <button
                onClick={() => setMobileDetailsOpen(!mobileDetailsOpen)}
                className="w-full flex items-center justify-between bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/40 px-3 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-300"
              >
                <span className="flex items-center gap-2"><FaListUl className="text-teal-600 dark:text-[#0d9488] text-[11px]" /> Task details</span>
                <FaAngleDown className={`text-gray-400 text-[10px] transition-transform ${mobileDetailsOpen ? 'rotate-180' : ''}`} />
              </button>
              {mobileDetailsOpen && (
                <div className="mt-2 bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/40 p-3">
                  <TaskSummary
                    task={task}
                    brandColor={brandColor}
                    submissionExpanded={submissionExpanded}
                    setSubmissionExpanded={setSubmissionExpanded}
                    rejectionExpanded={rejectionExpanded}
                    setRejectionExpanded={setRejectionExpanded}
                    hasSubmissionData={hasSubmissionData}
                    showRejection={showRejection}
                    isOverdueTask={isOverdueTask}
                  />
                </div>
              )}
            </div>

            {/* Checklist header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <FaTasks className="text-teal-600 dark:text-[#0d9488]" /> Checklist
                <span className="text-xs font-normal text-gray-500 dark:text-gray-500">({confirmedCount}/{subTasks.length})</span>
              </h3>
              {!isReadOnly && ((isAssignee && task.allowAssigneeEditSubtasks) || canManage) && (
                <button onClick={() => setAddSubOpen(true)} className="text-xs text-teal-600 dark:text-[#0d9488] font-medium flex items-center gap-1 hover:text-teal-700 dark:hover:text-[#14b8a6] transition px-2.5 py-1 rounded-lg hover:bg-teal-50 dark:hover:bg-[#0d9488]/10">
                  <FaPlus className="text-xs" /> Add item
                </button>
              )}
            </div>

            {subTasks.length === 0 ? (
              <div className="text-center py-14 bg-white dark:bg-[#14141a] rounded-2xl border border-dashed border-gray-300 dark:border-gray-800/60">
                <FaListUl className="text-3xl mx-auto text-gray-300 dark:text-gray-700 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-500">No checklist items yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Break this task down into smaller pieces</p>
              </div>
            ) : (
              <div className="space-y-2">
                {subTasks.map((st, idx) => {
                  const showMarkDone = (isAssignee || canManage) && st.status === 'pending';
                  const showConfirmReject = canManage && st.status === 'done';
                  const canDeleteThis = ((isAssignee && st.status !== 'confirmed') || canManage) && canReorderSub;
                  const isDragOver = dragOverIdx === idx;
                  const hasDetails = st.notes || st.links?.length || st.attachments?.length || st.feedback || st.rejectedBy;
                  const stStatus = st.status === 'confirmed' ? 'Confirmed' : st.status === 'done' ? 'Done' : 'Pending';
                  const stStatusColor = st.status === 'confirmed'
                    ? 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30'
                    : st.status === 'done'
                      ? 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30'
                      : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/60';
                  const isOverdue = st.dueDate && new Date(st.dueDate) < new Date() && st.status !== 'confirmed';
                  return (
                    <div
                      key={idx}
                      draggable={canReorderSub}
                      onDragStart={(e) => onSubDragStart(e, idx)}
                      onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                      onDragOver={(e) => { e.preventDefault(); if (draggedIdx !== null && draggedIdx !== idx) setDragOverIdx(idx); }}
                      onDragLeave={() => setDragOverIdx(null)}
                      onDrop={(e) => onSubDrop(e, idx)}
                      className={`group bg-white dark:bg-[#14141a] rounded-2xl border transition-all ${
                        isDragOver
                          ? 'border-teal-500 dark:border-[#0d9488] bg-teal-50/50 dark:bg-[#0d9488]/5'
                          : 'border-gray-200/60 dark:border-gray-800/40 hover:border-gray-300 dark:hover:border-gray-700/60'
                      }`}
                    >
                      <div className="p-3 lg:p-4">
                        <div className="flex items-start gap-3">
                          {canReorderSub && (
                            <FaGripVertical className="text-gray-300 dark:text-gray-700 text-xs shrink-0 mt-1 cursor-grab" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 flex-wrap mb-1">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words flex-1 min-w-0">
                                {st.title}
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${stStatusColor}`}>
                                {stStatus}
                              </span>
                            </div>
                            {st.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-500 break-words whitespace-pre-wrap mb-1.5 leading-relaxed">
                                {st.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 flex-wrap text-[11px] text-gray-500 dark:text-gray-500">
                              {st.dueDate && (
                                <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 dark:text-red-400' : ''}`}>
                                  <FaRegClock className="text-[10px]" /> {fmtDateTime(st.dueDate)}
                                </span>
                              )}
                              {isOverdue && <span className="text-red-500 dark:text-red-400 font-medium">Overdue</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {showMarkDone && (
                              <button onClick={() => setDoneModal({ isOpen: true, index: idx })} title="Mark done" className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition">
                                <FaCheck className="text-xs" />
                              </button>
                            )}
                            {showConfirmReject && (
                              <>
                                <button onClick={() => setConfirmModal({ isOpen: true, index: idx })} title="Confirm" className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition">
                                  <FaCheckDouble className="text-xs" />
                                </button>
                                <button onClick={() => setRejectModal({ isOpen: true, index: idx })} title="Reject" className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition">
                                  <FaTimes className="text-xs" />
                                </button>
                              </>
                            )}
                            {hasDetails && (
                              <button onClick={() => setExpandedSub(expandedSub === idx ? null : idx)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition">
                                <FaAngleDown className={`text-xs transition-transform ${expandedSub === idx ? 'rotate-180' : ''}`} />
                              </button>
                            )}
                            {canDeleteThis && (
                              <button onClick={() => setDeleteSubModal({ isOpen: true, index: idx })} title="Delete" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition">
                                <FaTrashAlt className="text-xs" />
                              </button>
                            )}
                          </div>
                        </div>

                        {expandedSub === idx && hasDetails && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/40 text-xs space-y-1.5">
                            {st.notes && <div className="break-words text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Notes: </span>{st.notes}</div>}
                            {st.links?.length > 0 && (
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Links:</span>
                                {st.links.map((l, i) => <a key={i} href={l} target="_blank" rel="noreferrer" className="block text-teal-600 dark:text-[#0d9488] underline break-all mt-0.5">{l}</a>)}
                              </div>
                            )}
                            {st.attachments?.length > 0 && (
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Attachments:</span>
                                {st.attachments.map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block text-teal-600 dark:text-[#0d9488] underline break-all mt-0.5">{a.name || 'file'}</a>)}
                              </div>
                            )}
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

            {/* Mobile-only: activity at bottom of single scroll */}
            {feedbackData?.feedback?.length > 0 && (
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

        {/* RIGHT (xl+): Activity feed */}
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
              <div className="text-center py-10">
                <FaCommentDots className="text-2xl mx-auto text-gray-300 dark:text-gray-700 mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-500">No activity yet</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ─── Mobile bottom action bar (full width button) ─────── */}
      {(showMarkCompleteBtn || showConfirmCompletionBtn) && (
        <div className="shrink-0 lg:hidden border-t border-gray-200/60 dark:border-gray-800/60 bg-white/95 dark:bg-[#14141a]/95 backdrop-blur-xl px-3 py-2.5 z-20">
          {showMarkCompleteBtn && (
            <button
              onClick={() => setShowMarkComplete(true)}
              className="w-full py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition"
              style={{ backgroundColor: brandColor }}
            >
              <FaCheckDouble className="text-sm" />
              {canManage ? 'Mark as Complete & Confirm' : 'Mark as Complete'}
            </button>
          )}
          {showConfirmCompletionBtn && (
            <button
              onClick={() => setShowConfirmCompletion(true)}
              className="w-full py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition"
              style={{ backgroundColor: brandColor }}
            >
              <FaCheckCircle className="text-sm" />
              Confirm Completion
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      <EditTaskModal isOpen={showEdit} onClose={() => setShowEdit(false)} task={task} brandColor={brandColor} assignableMembers={assignableMembers} folders={foldersData?.folders || []} onSuccess={refetchTask} />
      <AssignTaskModal isOpen={showAssign} onClose={() => setShowAssign(false)} task={task} assignableMembers={assignableMembers} brandColor={brandColor} onAssign={handleAssign} />
      <MarkCompleteModal isOpen={showMarkComplete} onClose={() => setShowMarkComplete(false)} task={task} brandColor={brandColor} onSubmit={handleMarkComplete} />
      <ConfirmCompletionModal isOpen={showConfirmCompletion} onClose={() => setShowConfirmCompletion(false)} task={task} brandColor={brandColor} onSubmit={handleConfirmCompletion} onReject={handleRejectTask} />
      <ConfirmDialog isOpen={deleteConfirm} onClose={() => setDeleteConfirm(false)} onConfirm={handleDelete} title="Delete Task" message={`Delete "${task.title}"? This cannot be undone.`} danger confirmText="Delete" />
      <AddChecklistModal isOpen={addSubOpen} onClose={() => setAddSubOpen(false)} onSubmit={handleAddSubtask} />
      <ChecklistDoneModal isOpen={doneModal.isOpen} onClose={() => setDoneModal({ isOpen: false, index: null })} canManage={canManage} onSubmit={submitDone} />
      <ChecklistConfirmModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false, index: null })} subTask={confirmModal.index != null ? subTasks[confirmModal.index] : null} onSubmit={submitConfirmSub} />
      <ReasonModal isOpen={rejectModal.isOpen} onClose={() => setRejectModal({ isOpen: false, index: null })} onSubmit={submitRejectSub} title="Reject Item" />
      <ConfirmDialog isOpen={deleteSubModal.isOpen} onClose={() => setDeleteSubModal({ isOpen: false, index: null })} onConfirm={confirmDeleteSub} title="Delete Item" message="This cannot be undone." danger confirmText="Delete" />
    </div>
  );
};

export default YourWorkspaceTaskId;
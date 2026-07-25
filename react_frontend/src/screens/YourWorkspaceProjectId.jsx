// src/workspaceScreens/YourWorkspaceProjectId.jsx
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
  useRejectSubTaskMutation, // 👈 new import
  useDeleteSubTaskMutation,
  useMarkTaskCompletedMutation,
  useConfirmTaskCompletionMutation,
  useSendManualReminderMutation,
  useGetTaskFeedbackQuery,
  useAssignTaskMutation, // 👈 new import
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

// ─── Custom Dropdown ────────────────────────────────────────────────
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
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-sm bg-white"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.label : placeholder || 'Select...'}
        </span>
        <FaAngleDown className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition text-left ${o.value === value ? 'bg-gray-50' : ''}`}
            >
              {o.icon && <span className="text-gray-400">{o.icon}</span>}
              <span>{o.label}</span>
              {o.value === value && <FaCheck className="ml-auto text-xs" style={{ color: brandColor }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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

const TaskStatusBadge = ({ status }) => {
  const map = {
    pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700' },
    'in-progress': { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
    ready_for_completion: { label: 'Ready', color: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
    confirmed_completed: { label: 'Confirmed', color: 'bg-green-200 text-green-800' },
  };
  const s = map[status] || map.pending;
  return <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>;
};

const TaskPriorityBadge = ({ priority }) => {
  const map = {
    low: { label: 'Low', color: 'bg-blue-100 text-blue-700' },
    medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
    high: { label: 'High', color: 'bg-red-100 text-red-700' },
    urgent: { label: 'Urgent', color: 'bg-red-200 text-red-800' },
  };
  const p = map[priority] || map.medium;
  return <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${p.color}`}>{p.label}</span>;
};

// ─── Task Card (list item, flat) ─────────────────────────────────────
const TaskListItem = ({ task, isActive, onClick, brandColor }) => {
  const progress = task.progress || 0;
  const subTaskCount = task.subTasks?.length || 0;
  const confirmedCount = (task.subTasks || []).filter(st => st.status === 'confirmed').length || 0;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left border-b border-gray-100 ${isActive ? 'bg-gray-100' : ''}`}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-lg"
        style={{ backgroundColor: brandColor }}
      >
        {task.title.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900 truncate">{task.title}</h4>
          <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
            {task.dueDate ? formatDateTime(task.dueDate) : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <TaskPriorityBadge priority={task.priority} />
          <TaskStatusBadge status={task.status} />
          {subTaskCount > 0 && (
            <span className="text-[10px] text-gray-500">• {confirmedCount}/{subTaskCount} done</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          {task.assignee ? `${task.assignee.name} · ` : ''}{progress}% complete
        </p>
      </div>
    </button>
  );
};

// ─── Search Modal ─────────────────────────────────────────────────────
const SearchModal = ({ isOpen, onClose, items, type, brandColor, onSelect }) => {
  const [query, setQuery] = useState('');
  if (!isOpen) return null;
  const filtered = items.filter(item => {
    if (type === 'tasks') return item.title?.toLowerCase().includes(query.toLowerCase());
    const user = item.user || item;
    return (user.name || '').toLowerCase().includes(query.toLowerCase()) ||
           (user.email || '').toLowerCase().includes(query.toLowerCase());
  });
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-100">
        <button onClick={onClose} className="p-1"><FaArrowLeft className="text-gray-600" /></button>
        <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 flex items-center gap-2">
          <FaSearch className="text-gray-400 text-xs" />
          <input type="text" placeholder={type === 'tasks' ? 'Search tasks...' : 'Search members...'} value={query} onChange={(e) => setQuery(e.target.value)} className="bg-transparent w-full outline-none text-sm" autoFocus />
          {query && <button onClick={() => setQuery('')}><FaTimes className="text-gray-400 text-xs" /></button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {!query && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FaSearch className="text-4xl mb-2 opacity-30" />
            <p className="text-sm">Search {type === 'tasks' ? 'tasks' : 'members'}</p>
          </div>
        )}
        {query && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-sm">No results for "{query}"</p>
          </div>
        )}
        {query && filtered.length > 0 && (
          <div className="divide-y divide-gray-100">
            {filtered.map(item => (
              <div key={item._id || (item.user?._id)} onClick={() => { onSelect(type === 'tasks' ? item._id : (item.user || item)._id); onClose(); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition cursor-pointer">
                {type === 'tasks' ? (
                  <>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ backgroundColor: brandColor }}>
                      {item.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
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
                      {item.status === 'active' && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.user?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400 truncate">{item.user?.email}</p>
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
};

// ─── Sub‑task Item (with inline 'Mark Done', 'Confirm', and 'Reject') ──
const SubTaskItem = ({ subTask, index, taskId, isAssignee, canManage, onRefresh, brandColor }) => {
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

  // Expandable details
  const [isExpanded, setIsExpanded] = useState(false);

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

  const handleConfirmClick = () => {
    setShowConfirmForm(true);
  };

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

  const handleReject = async () => {
    const reason = window.prompt('Reason for rejection (optional):');
    if (reason === null) return;
    setUpdating(true);
    try {
      await rejectSub({ taskId, subTaskIndex: index, reason }).unwrap();
      toast.success('Sub‑task rejected');
      onRefresh();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setUpdating(false); }
  };

  const handleDelete = async () => {
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
    pending: { label: 'Pending', color: 'text-gray-400' },
    done: { label: 'Done', color: 'text-blue-500' },
    confirmed: { label: 'Confirmed', color: 'text-green-500' },
  };
  const st = statusMap[subTask.status] || statusMap.pending;

  return (
    <div className="flex flex-col py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{subTask.title}</span>
            <span className={`text-[10px] font-medium ${st.color}`}>{st.label}</span>
          </div>
          {subTask.description && <p className="text-xs text-gray-400 truncate">{subTask.description}</p>}
          {subTask.dueDate && <p className="text-[10px] text-gray-400 flex items-center gap-1"><FaRegClock className="text-xs" /> {formatDateTime(subTask.dueDate)}</p>}
        </div>
        <div className="flex items-center gap-1">
          {isAssignee && subTask.status === 'pending' && (
            <button onClick={handleMarkDone} disabled={updating} className="p-1 text-blue-500 hover:bg-blue-50 rounded">
              <FaCheck className="text-xs" />
            </button>
          )}
          {canManage && subTask.status === 'done' && (
            <>
              <button onClick={handleConfirmClick} disabled={updating} className="p-1 text-green-500 hover:bg-green-50 rounded">
                <FaCheckDouble className="text-xs" />
              </button>
              <button onClick={handleReject} disabled={updating} className="p-1 text-red-500 hover:bg-red-50 rounded">
                <FaTimes className="text-xs" />
              </button>
            </>
          )}
          {(isAssignee && subTask.status !== 'confirmed') || canManage ? (
            <button onClick={handleDelete} disabled={updating} className="p-1 text-red-400 hover:bg-red-50 rounded">
              <FaTrashAlt className="text-xs" />
            </button>
          ) : null}
          {hasDetails && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-400 hover:bg-gray-100 rounded"
              title={isExpanded ? 'Hide details' : 'Show details'}
            >
              <FaAngleDown className={`text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Expandable details */}
      {isExpanded && (
        <div className="mt-1 ml-6 text-xs text-gray-600 space-y-1 bg-gray-50 p-2 rounded border border-gray-200">
          {subTask.notes && (
            <div><span className="font-medium">Notes:</span> {subTask.notes}</div>
          )}
          {subTask.links && subTask.links.length > 0 && (
            <div>
              <span className="font-medium">Links:</span>{' '}
              {subTask.links.map((l, i) => (
                <a key={i} href={l} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{l}</a>
              )).reduce((prev, curr) => [prev, ', ', curr])}
            </div>
          )}
          {subTask.attachments && subTask.attachments.length > 0 && (
            <div>
              <span className="font-medium">Attachments:</span>{' '}
              {subTask.attachments.map((att, i) => (
                <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline ml-1">{att.name || 'file'}</a>
              )).reduce((prev, curr) => [prev, ', ', curr])}
            </div>
          )}
          {subTask.feedback && (
            <div><span className="font-medium">Confirm feedback:</span> {subTask.feedback}</div>
          )}
          {subTask.rejectedBy && (
            <div><span className="font-medium">Rejected by:</span> {subTask.rejectedBy.name || 'Unknown'} on {formatDateTime(subTask.rejectedAt)}</div>
          )}
          {subTask.rejectionReason && (
            <div><span className="font-medium">Rejection reason:</span> {subTask.rejectionReason}</div>
          )}
          {subTask.completedAt && (
            <div><span className="font-medium">Submitted on:</span> {formatDateTime(subTask.completedAt)}</div>
          )}
          {subTask.confirmedAt && (
            <div><span className="font-medium">Confirmed on:</span> {formatDateTime(subTask.confirmedAt)}</div>
          )}
        </div>
      )}

      {/* Inline Mark Done form */}
      {showDoneForm && (
        <div className="mt-2 ml-6 bg-white border border-gray-200 rounded-lg p-3">
          <textarea
            placeholder="Add notes (optional)"
            value={doneNotes}
            onChange={(e) => setDoneNotes(e.target.value)}
            rows={2}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
          />
          <textarea
            placeholder="Links (one per line)"
            value={doneLinks}
            onChange={(e) => setDoneLinks(e.target.value)}
            rows={2}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
          />
          <div className="flex items-center gap-2 mb-2">
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={(e) => setDoneFiles([...e.target.files])}
              className="text-sm file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-gray-100"
            />
            {doneFiles.length > 0 && <span className="text-xs text-gray-500">{doneFiles.length} file(s)</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={submitDone} disabled={updating} className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition">
              {updating ? 'Saving...' : 'Submit Done'}
            </button>
            <button onClick={cancelDone} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Inline Confirm form */}
      {showConfirmForm && (
        <div className="mt-2 ml-6 bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-700 mb-1">Assignee submitted:</p>
          {subTask.notes && (
            <div className="text-xs text-gray-600 mb-1">
              <span className="font-medium">Notes:</span> {subTask.notes}
            </div>
          )}
          {subTask.links && subTask.links.length > 0 && (
            <div className="text-xs text-gray-600 mb-1">
              <span className="font-medium">Links:</span>{' '}
              {subTask.links.map((l, i) => (
                <a key={i} href={l} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{l}</a>
              )).reduce((prev, curr) => [prev, ', ', curr])}
            </div>
          )}
          {subTask.attachments && subTask.attachments.length > 0 && (
            <div className="text-xs text-gray-600 mb-2">
              <span className="font-medium">Attachments:</span>{' '}
              {subTask.attachments.map((att, i) => (
                <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline ml-1">{att.name || 'file'}</a>
              )).reduce((prev, curr) => [prev, ', ', curr])}
            </div>
          )}
          <textarea
            placeholder="Add feedback (optional)"
            value={confirmFeedback}
            onChange={(e) => setConfirmFeedback(e.target.value)}
            rows={2}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
          />
          <div className="flex gap-2">
            <button onClick={submitConfirm} disabled={updating} className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition">
              {updating ? 'Confirming...' : 'Confirm'}
            </button>
            <button onClick={cancelConfirm} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 transition">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Assign Task Modal ──────────────────────────────────────────────
const AssignTaskModal = ({ isOpen, onClose, task, assignableMembers, brandColor, onAssign }) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-gray-300 rounded-2xl max-w-md w-full p-6">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold"><FaUserPlus className="inline mr-1" /> Assign Task</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <p className="text-sm text-gray-600 mb-3">Assign "{task?.title}" to a member.</p>
          <CustomDropdown
            label="Select Member"
            options={assigneeOpts}
            value={assigneeId}
            onChange={setAssigneeId}
            placeholder="Select..."
            brandColor={brandColor}
          />
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: brandColor }}>
              {loading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Task Detail View (without Feedback section) ────────────────────
const TaskDetailView = ({
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
}) => {
  const isAssignee = task.assignee?._id === userInfo?._id;
  const [showMenu, setShowMenu] = useState(false);
  const bottomRef = useRef(null);
  const [addSubTaskOpen, setAddSubTaskOpen] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [newSubTaskStart, setNewSubTaskStart] = useState('');
  const [newSubTaskDue, setNewSubTaskDue] = useState('');
  const [adding, setAdding] = useState(false);
  const [addSubTask] = useAddSubTaskMutation();

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-teal-600 text-white flex-shrink-0 sticky top-0 z-10">
        <button onClick={onBack} className="p-1 md:hidden"><FaArrowLeft /></button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/20 font-bold text-lg">
          {task.title.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate">{task.title}</h2>
          <div className="flex items-center gap-1.5 text-xs text-white/80">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            {task.assignee && <span className="truncate">{task.assignee.name}</span>}
          </div>
        </div>
        <button onClick={() => setShowMenu(!showMenu)} className="p-1.5">
          <FaEllipsisV className="text-sm" />
        </button>
        {showMenu && (
          <div className="absolute right-4 top-12 bg-white rounded-lg border border-gray-200 min-w-[140px] z-20 py-1 text-gray-700">
            {canManage && (
              <button onClick={() => { setShowMenu(false); onSendReminder(task); }} className="flex items-center gap-2 px-4 py-1.5 text-sm text-orange-600 hover:bg-orange-50 w-full">
                <FaBell className="text-xs" /> Send Reminder
              </button>
            )}
            <button onClick={() => { setShowMenu(false); onEdit(task); }} className="flex items-center gap-2 px-4 py-1.5 text-sm text-blue-600 hover:bg-blue-50 w-full">
              <FaEdit className="text-xs" /> Edit
            </button>
            {canManage && (
              <button onClick={() => { setShowMenu(false); onDelete(task._id); }} className="flex items-center gap-2 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 w-full">
                <FaTrashAlt className="text-xs" /> Delete
              </button>
            )}
            {canManage && !task.assignee && (
              <button onClick={() => { setShowMenu(false); onAssignTask(task); }} className="flex items-center gap-2 px-4 py-1.5 text-sm text-teal-600 hover:bg-teal-50 w-full">
                <FaUserPlus className="text-xs" /> Assign Task
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress + sub‑tasks */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Progress</span>
          <span className="text-gray-500">{progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: brandColor }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>{confirmed}/{total} sub‑tasks confirmed</span>
          {task.dueDate && <span>Due: {formatDateTime(task.dueDate)}</span>}
        </div>
      </div>

      {/* Sub‑tasks list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Sub‑tasks</h3>
          {(isAssignee && task.allowAssigneeEditSubtasks) || canManage ? (
            <button onClick={() => setAddSubTaskOpen(!addSubTaskOpen)} className="text-xs text-teal-600 font-medium flex items-center gap-1">
              <FaPlus className="text-xs" /> Add
            </button>
          ) : null}
        </div>

        {addSubTaskOpen && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
            <input
              type="text"
              placeholder="Sub‑task title"
              value={newSubTaskTitle}
              onChange={(e) => setNewSubTaskTitle(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mb-2"
            />
            <input
              type="datetime-local"
              placeholder="Start date & time"
              value={newSubTaskStart}
              onChange={(e) => setNewSubTaskStart(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mb-2"
            />
            <input
              type="datetime-local"
              placeholder="Due date & time"
              value={newSubTaskDue}
              onChange={(e) => setNewSubTaskDue(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mb-2"
            />
            <div className="flex gap-2">
              <button onClick={() => setAddSubTaskOpen(false)} className="flex-1 py-1.5 border border-gray-300 rounded text-sm">Cancel</button>
              <button onClick={handleAddSubTask} disabled={adding} className="flex-1 py-1.5 text-white rounded text-sm" style={{ backgroundColor: brandColor }}>
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {(task.subTasks || []).length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">No sub‑tasks</div>
        ) : (
          (task.subTasks || []).map((st, idx) => (
            <SubTaskItem
              key={idx}
              subTask={st}
              index={idx}
              taskId={task._id}
              isAssignee={isAssignee}
              canManage={canManage}
              onRefresh={onRefresh}
              brandColor={brandColor}
            />
          ))
        )}

        <div ref={bottomRef} />
      </div>

      {/* Bottom action bar */}
      {isAssignee && task.status !== 'completed' && task.status !== 'confirmed_completed' && (
        <div className="border-t bg-white px-3 py-2 flex-shrink-0 sticky bottom-0">
          <button
            onClick={() => onRefresh()}
            className="w-full py-2 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
            style={{ backgroundColor: brandColor }}
          >
            <FaChartLine className="text-sm" /> Refresh status
          </button>
        </div>
      )}
      {canManage && task.status === 'completed' && task.status !== 'confirmed_completed' && (
        <div className="border-t bg-white px-3 py-2 flex-shrink-0 sticky bottom-0">
          <button
            onClick={onConfirmCompletion}
            className="w-full py-2 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
            style={{ backgroundColor: brandColor }}
          >
            <FaCheckDouble className="text-sm" /> Confirm Completion
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Create Task Modal ───────────────────────────────────────────────
const CreateTaskModal = ({ isOpen, onClose, projectId, brandColor, assignableMembers, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [detailedDescription, setDetailedDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [bufferTime, setBufferTime] = useState(0);
  const [allowAssigneeEditSubtasks, setAllowAssigneeEditSubtasks] = useState(false);
  const [linksText, setLinksText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createTask] = useCreateTaskMutation();

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
      fd.append('detailedDescription', detailedDescription.trim());
      fd.append('assigneeId', assigneeId || '');
      fd.append('priority', priority);
      fd.append('estimatedHours', estimatedHours || '');
      fd.append('bufferTime', bufferTime.toString());
      fd.append('allowAssigneeEditSubtasks', allowAssigneeEditSubtasks ? 'true' : 'false');
      if (startDate) fd.append('startDate', startDate);
      if (dueDate) fd.append('dueDate', dueDate);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-gray-300 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold"><FaTasks className="inline mr-1" /> New Task</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Title *</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Detailed Description</label><textarea value={detailedDescription} onChange={e => setDetailedDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <CustomDropdown label="Assignee" options={assigneeOpts} value={assigneeId} onChange={setAssigneeId} placeholder="Select assignee" brandColor={brandColor} />
          <div className="grid grid-cols-2 gap-3">
            <CustomDropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} brandColor={brandColor} />
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Start Date & Time</label><input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Due Date & Time</label><input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Est. Hours</label><input type="number" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" readOnly={!!(startDate && dueDate)} /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Buffer (min)</label><input type="number" min="0" value={bufferTime} onChange={e => setBufferTime(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={allowAssigneeEditSubtasks} onChange={e => setAllowAssigneeEditSubtasks(e.target.checked)} id="allowEdit" />
            <label htmlFor="allowEdit" className="text-xs text-gray-600">Allow assignee to edit sub‑tasks</label>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1"><FaLink className="inline mr-1" /> Links (one per line)</label><textarea value={linksText} onChange={e => setLinksText(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1"><FaPaperclip className="inline mr-1" /> Attachments</label>
            <input type="file" multiple onChange={handleFile} className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-50" />
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">{attachments.map((f, i) => <div key={i} className="flex justify-between bg-gray-50 rounded-lg px-3 py-1.5"><span className="text-sm truncate">{f.name}</span><button type="button" onClick={() => removeFile(i)} className="text-red-400"><FaTrashAlt className="text-xs" /></button></div>)}</div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: brandColor }}>{loading ? 'Creating...' : 'Create Task'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Edit Task Modal ──────────────────────────────────────────────────
const EditTaskModal = ({ isOpen, onClose, task, brandColor, assignableMembers, onSuccess }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [detailedDescription, setDetailedDescription] = useState(task?.detailedDescription || '');
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
  const [loading, setLoading] = useState(false);
  const [updateTask] = useUpdateTaskMutation();

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setDetailedDescription(task.detailedDescription || '');
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
      fd.append('detailedDescription', detailedDescription.trim());
      fd.append('priority', priority);
      fd.append('status', status);
      fd.append('estimatedHours', estimatedHours || '');
      fd.append('bufferTime', bufferTime.toString());
      fd.append('allowAssigneeEditSubtasks', allowAssigneeEditSubtasks ? 'true' : 'false');
      if (startDate) fd.append('startDate', startDate);
      if (dueDate) fd.append('dueDate', dueDate);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-gray-300 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between mb-4"><h2 className="text-lg font-bold"><FaEdit className="inline mr-1" /> Edit Task</h2><button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><FaTimes /></button></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Title *</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Detailed Description</label><textarea value={detailedDescription} onChange={e => setDetailedDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <CustomDropdown label="Status" options={statusOptions} value={status} onChange={setStatus} brandColor={brandColor} />
          <CustomDropdown label="Assignee" options={assigneeOpts} value={assigneeId} onChange={setAssigneeId} brandColor={brandColor} />
          <div className="grid grid-cols-2 gap-3">
            <CustomDropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} brandColor={brandColor} />
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Start Date & Time</label><input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Due Date & Time</label><input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Est. Hours</label><input type="number" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" readOnly={!!(startDate && dueDate)} /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Buffer (min)</label><input type="number" min="0" value={bufferTime} onChange={e => setBufferTime(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={allowAssigneeEditSubtasks} onChange={e => setAllowAssigneeEditSubtasks(e.target.checked)} id="allowEditEdit" />
            <label htmlFor="allowEditEdit" className="text-xs text-gray-600">Allow assignee to edit sub‑tasks</label>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1"><FaLink className="inline mr-1" /> Links</label><textarea value={linksText} onChange={e => setLinksText(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1"><FaPaperclip className="inline mr-1" /> Attachments</label>
            {existingAttachments.length > 0 && (
              <div className="mb-2 space-y-1"><p className="text-xs text-gray-400">Existing:</p>{existingAttachments.map((f, i) => <div key={i} className="flex justify-between bg-gray-50 rounded-lg px-3 py-1.5"><span className="text-sm truncate">{f.name}</span><button type="button" onClick={() => removeExisting(i)} className="text-red-400"><FaTrashAlt className="text-xs" /></button></div>)}</div>
            )}
            <input type="file" multiple onChange={handleFile} className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-50" />
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1"><p className="text-xs text-gray-400">New:</p>{attachments.map((f, i) => <div key={i} className="flex justify-between bg-gray-50 rounded-lg px-3 py-1.5"><span className="text-sm truncate">{f.name}</span><button type="button" onClick={() => removeNew(i)} className="text-red-400"><FaTrashAlt className="text-xs" /></button></div>)}</div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: brandColor }}>{loading ? 'Updating...' : 'Update Task'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Add Member Modal ──────────────────────────────────────────────────
const AddMemberModal = ({ isOpen, onClose, workspace, project, brandColor, onSuccess }) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-gray-300 rounded-2xl max-w-md w-full p-6">
        <div className="flex justify-between mb-4"><h2 className="text-lg font-bold"><FaUserPlus className="inline mr-1" /> Add Member</h2><button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><FaTimes /></button></div>
        <form onSubmit={handleSubmit}>
          <CustomDropdown label="Select Member" options={options} value={memberId} onChange={setMemberId} placeholder="Select..." brandColor={brandColor} />
          {available.length === 0 && <p className="text-xs text-gray-400 mt-1">All workspace members already in project</p>}
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={loading || available.length === 0} className="flex-1 py-2 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: brandColor }}>{loading ? 'Adding...' : 'Add Member'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
const YourWorkspaceProjectId = () => {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [listView, setListView] = useState('tasks');
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTaskTarget, setAssignTaskTarget] = useState(null);

  const { data: wData, isLoading: wLoad, error: wErr } = useGetWorkspaceQuery(workspaceId);
  const { data: pData, isLoading: pLoad, error: pErr, refetch: refetchProject } = useGetProjectByIdQuery(projectId);
  const { data: tData, isLoading: tLoad, refetch: refetchTasks } = useGetProjectTasksQuery({ projectId });
  const { data: feedbackData, isLoading: feedbackLoading } = useGetTaskFeedbackQuery(
    { taskId: selectedTaskId },
    { skip: !selectedTaskId }
  );

  const [deleteTask] = useDeleteTaskMutation();
  const [removeTeamMember] = useRemoveTeamMemberMutation();
  const [manageProjectManagers] = useManageProjectManagersMutation();
  const [sendManualReminder] = useSendManualReminderMutation();
  const [confirmTaskCompletion] = useConfirmTaskCompletionMutation();
  const [assignTask] = useAssignTaskMutation();

  const workspace = wData?.workspace;
  const project = pData?.project;
  const tasks = tData?.tasks || [];

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
  const isOwner = workspace?.owner?._id === userInfo?._id || workspace?.owner === userInfo?._id;
  const isManager = project?.projectManagers?.some(pm => {
    const id = (pm._id || pm)?.toString();
    return id === userInfo?._id;
  });
  const canManage = isOwner || isManager;

  const activeTask = useMemo(() => tasks.find(t => t._id === selectedTaskId) || null, [tasks, selectedTaskId]);
  const projectManagers = project?.projectManagers || [];
  const projectProgress = project?.progress || 0;

  if (wErr || pErr) { navigate(`/workspace/${workspaceId}/projects`); return null; }
  if (wLoad || pLoad || tLoad) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: brandColor }} />
    </div>
  );
  if (!workspace || !project) return null;

  const handleDeleteTask = async (id) => {
    if (!confirm('Delete task?')) return;
    try { await deleteTask(id).unwrap(); toast.success('Deleted'); refetchTasks(); refetchProject(); if (selectedTaskId === id) { setSelectedTaskId(null); setMobileShowDetail(false); } } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };
  const handleEditTask = (task) => { setSelectedTask(task); setShowEditTask(true); };
  const handleRemoveMember = async (id) => {
    if (!id) { toast.error('Invalid member ID'); return; }
    if (!confirm('Remove member?')) return;
    try { await removeTeamMember({ projectId, memberId: id }).unwrap(); toast.success('Removed'); refetchProject(); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };
  const handleAddManager = async (id) => {
    try { await manageProjectManagers({ projectId, action: 'add', managerId: id }).unwrap(); toast.success('Manager added'); refetchProject(); setShowAddManager(false); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };
  const handleRemoveManager = async (id) => {
    if (!confirm('Remove manager?')) return;
    try { await manageProjectManagers({ projectId, action: 'remove', managerId: id }).unwrap(); toast.success('Manager removed'); refetchProject(); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };

  const handleTaskClick = (taskId) => { setSelectedTaskId(taskId); setMobileShowDetail(true); };
  const handleBackToList = () => { setSelectedTaskId(null); setMobileShowDetail(false); };

  const openSearchModal = () => setSearchModalOpen(true);
  const closeSearchModal = () => setSearchModalOpen(false);

  const searchItems = listView === 'tasks' ? tasks : activeTeam;
  const onSearchSelect = (id) => {
    if (listView === 'tasks') handleTaskClick(id);
  };

  const availableForManager = workspace.members?.filter(m => m.status === 'active' && !projectManagers.some(pm => pm._id === (m.user?._id || m._id))) || [];
  const managerOptions = availableForManager.map(m => {
    const u = m.user || m;
    return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" /> : <FaUser className="text-gray-400" /> };
  });

  const handleSendManualReminder = async (task) => {
    try {
      await sendManualReminder({ taskId: task._id, message: '' }).unwrap();
      toast.success('Reminder sent to assignee');
    } catch (e) { toast.error(e?.data?.message || 'Failed to send reminder'); }
  };

  const refreshAll = () => {
    refetchTasks();
    refetchProject();
  };

  const handleConfirmCompletion = async (taskId) => {
    if (!window.confirm('Confirm completion of this task?')) return;
    try {
      await confirmTaskCompletion({ taskId }).unwrap();
      toast.success('Task completion confirmed');
      refreshAll();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };

  const handleAssignTask = async (assigneeId) => {
    try {
      await assignTask({ taskId: assignTaskTarget._id, assigneeId }).unwrap();
      toast.success('Task assigned successfully');
      refreshAll();
      setShowAssignModal(false);
      setAssignTaskTarget(null);
    } catch (err) {
      throw err;
    }
  };

  const openAssignModal = (task) => {
    setAssignTaskTarget(task);
    setShowAssignModal(true);
  };

  return (
    <div className="h-dvh bg-gray-50 flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <YourWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Fixed Header */}
        <header className="sticky top-0 z-10 bg-teal-600 text-white flex-shrink-0 shadow-sm">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate(`/workspace/${workspaceId}/projects`)} className="p-1 lg:hidden"><FaArrowLeft /></button>
              <div className="flex items-center gap-2">
                {project.coverImage ? <img src={project.coverImage} className="w-8 h-8 rounded-full object-cover" /> : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/20 font-bold"><FaFolder className="text-sm" /></div>
                )}
                <div>
                  <h1 className="text-base font-semibold truncate">{project.name}</h1>
                  <p className="text-xs text-white/80">{activeTeam.length} members · {projectProgress}% done</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={openSearchModal} className="p-1"><FaSearch /></button>
              {canManage && (
                <button onClick={() => listView === 'tasks' ? setShowCreateTask(true) : setShowAddMember(true)} className="p-1"><FaPlus /></button>
              )}
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-6 px-4 border-t border-white/20">
            <button
              onClick={() => { setListView('tasks'); setMobileShowDetail(false); setSelectedTaskId(null); }}
              className={`pb-2 text-sm font-medium transition ${listView === 'tasks' ? 'border-b-2 border-white text-white' : 'text-white/70 hover:text-white'}`}
            >
              Tasks ({tasks.length})
            </button>
            <button
              onClick={() => { setListView('team'); setMobileShowDetail(false); setSelectedTaskId(null); }}
              className={`pb-2 text-sm font-medium transition ${listView === 'team' ? 'border-b-2 border-white text-white' : 'text-white/70 hover:text-white'}`}
            >
              Team ({activeTeam.length})
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel – List */}
          <div className={`${mobileShowDetail ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 border-r border-gray-200 bg-white h-full`}>
            <div className="flex-1 overflow-y-auto">
              {listView === 'tasks' ? (
                tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <FaTasks className="text-4xl mb-2 opacity-30" />
                    <p className="text-sm">No tasks yet</p>
                  </div>
                ) : (
                  tasks.map(task => (
                    <TaskListItem key={task._id} task={task} isActive={selectedTaskId === task._id} onClick={() => handleTaskClick(task._id)} brandColor={brandColor} />
                  ))
                )
              ) : (
                <div className="divide-y divide-gray-100">
                  {/* Managers */}
                  <div className="px-4 py-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase"><FaCrown className="inline mr-1" /> Managers</span>
                      {isOwner && <button onClick={() => setShowAddManager(true)} className="text-xs text-teal-600 font-medium">Add</button>}
                    </div>
                    {projectManagers.map(m => (
                      <div key={m._id} className="flex items-center gap-3 py-2">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: brandColor }}>
                          {m.profile ? <img src={m.profile} className="w-full h-full rounded-full object-cover" /> : m.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{m.name}</p>
                          <p className="text-xs text-gray-400 truncate">{m.email}</p>
                        </div>
                        {isOwner && projectManagers.length > 1 && <button onClick={() => handleRemoveManager(m._id)} className="p-1 text-red-400"><FaUserMinus className="text-sm" /></button>}
                      </div>
                    ))}
                  </div>
                  {/* Team Members */}
                  <div className="px-4 py-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase"><FaUsers className="inline mr-1" /> Team ({activeTeam.length})</span>
                      {canManage && <button onClick={() => setShowAddMember(true)} className="text-xs text-teal-600 font-medium">Add</button>}
                    </div>
                    {activeTeam.map(m => {
                      const user = m.user || m;
                      const memberId = user._id;
                      return (
                        <div key={memberId} className="flex items-center gap-3 py-2">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: brandColor }}>
                            {user.profile ? <img src={user.profile} className="w-full h-full rounded-full object-cover" /> : user.name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.name || 'Unknown'}</p>
                            <p className="text-xs text-gray-400 truncate">{user.email}</p>
                          </div>
                          {canManage && <button onClick={() => handleRemoveMember(memberId)} className="p-1 text-red-400"><FaUserMinus className="text-sm" /></button>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel – Detail */}
          <div className={`${mobileShowDetail ? 'flex' : 'hidden md:flex'} flex-col flex-1 h-full bg-gray-50`}>
            {activeTask ? (
              <TaskDetailView
                task={activeTask}
                brandColor={brandColor}
                feedbackData={feedbackData}
                isLoading={feedbackLoading}
                userInfo={userInfo}
                onBack={handleBackToList}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onRefresh={refreshAll}
                canManage={canManage}
                onSendReminder={handleSendManualReminder}
                onConfirmCompletion={() => handleConfirmCompletion(activeTask._id)}
                onAssignTask={openAssignModal}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FaCommentDots className="text-5xl mx-auto mb-4 opacity-30" style={{ color: brandColor }} />
                  <p className="text-lg font-medium">Select a task to view details</p>
                  <p className="text-sm mt-1">Sub‑tasks will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation (mobile) */}
      {!mobileShowDetail && <YourWorkspaceBottombar workspace={workspace} />}

      {/* Modals */}
      <SearchModal isOpen={searchModalOpen} onClose={closeSearchModal} items={searchItems} type={listView} brandColor={brandColor} onSelect={onSearchSelect} />
      <CreateTaskModal isOpen={showCreateTask} onClose={() => setShowCreateTask(false)} projectId={projectId} brandColor={brandColor} assignableMembers={assignableMembers} onSuccess={() => { refetchTasks(); refetchProject(); }} />
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
        onSuccess={() => { refetchTasks(); refetchProject(); }}
      />
      <AddMemberModal isOpen={showAddMember} onClose={() => setShowAddMember(false)} workspace={workspace} project={project} brandColor={brandColor} onSuccess={refetchProject} />
      {showAddManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-300 rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between mb-4"><h2 className="text-lg font-bold">Add Manager</h2><button onClick={() => setShowAddManager(false)}><FaTimes /></button></div>
            <CustomDropdown label="Select Member" options={managerOptions} value="" onChange={(v) => { if (v) handleAddManager(v); setShowAddManager(false); }} brandColor={brandColor} />
            <div className="flex gap-3 mt-4"><button onClick={() => setShowAddManager(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button></div>
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
    </div>
  );
};

export default YourWorkspaceProjectId;
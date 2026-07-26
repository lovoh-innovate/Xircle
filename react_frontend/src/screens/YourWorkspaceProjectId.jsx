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
  useRejectSubTaskMutation,
  useDeleteSubTaskMutation,
  useMarkTaskCompletedMutation,
  useConfirmTaskCompletionMutation,
  useSendManualReminderMutation,
  useGetTaskFeedbackQuery,
  useAssignTaskMutation,
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

// ─── Custom Dropdown (dark themed) ───────────────────────────────────
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
      {label && <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-700/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0d9488] text-sm bg-[#1a1a24] text-gray-200 hover:border-gray-600 transition"
      >
        <span className={selected ? 'text-gray-200' : 'text-gray-500'}>
          {selected ? selected.label : placeholder || 'Select...'}
        </span>
        <FaAngleDown className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-10 w-full mt-1 bg-[#1e1e26] border border-gray-700/60 rounded-xl overflow-hidden max-h-60 overflow-y-auto shadow-lg">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#0d9488]/10 transition text-left text-gray-300 ${o.value === value ? 'bg-[#0d9488]/10' : ''}`}
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
    pending: { label: 'Pending', color: 'bg-gray-800/60 text-gray-300 border-gray-700' },
    'in-progress': { label: 'In Progress', color: 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50' },
    ready_for_completion: { label: 'Ready', color: 'bg-blue-900/30 text-blue-300 border-blue-700/50' },
    completed: { label: 'Completed', color: 'bg-green-900/30 text-green-300 border-green-700/50' },
    confirmed_completed: { label: 'Confirmed', color: 'bg-green-800/50 text-green-200 border-green-600/50' },
  };
  const s = map[status] || map.pending;
  return <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>;
};

const TaskPriorityBadge = ({ priority }) => {
  const map = {
    low: { label: 'Low', color: 'text-blue-400 bg-blue-900/20 border-blue-700/40' },
    medium: { label: 'Medium', color: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/40' },
    high: { label: 'High', color: 'text-red-400 bg-red-900/20 border-red-700/40' },
    urgent: { label: 'Urgent', color: 'text-red-500 bg-red-900/30 border-red-700/50' },
  };
  const p = map[priority] || map.medium;
  return <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${p.color}`}>{p.label}</span>;
};

// ─── Task Card (grid style) ──────────────────────────────────────────
const TaskCard = ({ task, onClick, brandColor, isActive }) => {
  const progress = task.progress || 0;
  const subTaskCount = task.subTasks?.length || 0;
  const confirmedCount = (task.subTasks || []).filter(st => st.status === 'confirmed').length || 0;
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = due && due < new Date() && task.status !== 'completed' && task.status !== 'confirmed_completed';
  const assignee = task.assignee;

  return (
    <div
      onClick={() => onClick(task._id)}
      className={`group relative bg-[#14141a] rounded-2xl border border-gray-800/40 hover:border-[#0d9488]/50 transition-all duration-300 cursor-pointer overflow-hidden ${
        isActive ? 'border-[#0d9488] shadow-[0_0_20px_rgba(13,148,136,0.15)]' : ''
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {task.title.charAt(0).toUpperCase()}
            </div>
            <h4 className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition">
              {task.title}
            </h4>
          </div>
          <TaskStatusBadge status={task.status} />
        </div>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <TaskPriorityBadge priority={task.priority} />
          {subTaskCount > 0 && (
            <span className="text-[10px] text-gray-500">• {confirmedCount}/{subTaskCount} done</span>
          )}
          {isOverdue && (
            <span className="text-[10px] text-red-400 flex items-center gap-1">
              <FaClock className="text-[8px]" /> Overdue
            </span>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{task.description}</p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {assignee ? `${assignee.name}` : 'Unassigned'}
          </span>
          <span className="text-xs text-gray-500">{task.dueDate ? formatDateTime(task.dueDate) : 'No due'}</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-800/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: brandColor }}
            />
          </div>
          <span className="text-xs font-mono text-gray-400">{progress}%</span>
        </div>
      </div>
    </div>
  );
};

// ─── Search Modal (dark) ─────────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 bg-[#0b0b10]/90 backdrop-blur-xl flex flex-col">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-800/60 bg-[#14141a]/80">
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-white"><FaArrowLeft /></button>
        <div className="flex-1 bg-[#1e1e26] rounded-2xl px-4 py-2 flex items-center gap-3 border border-gray-800/40 focus-within:border-[#0d9488]/50 transition">
          <FaSearch className="text-gray-500 text-xs" />
          <input
            type="text"
            placeholder={type === 'tasks' ? 'Search tasks...' : 'Search members...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent w-full outline-none text-sm text-gray-200 placeholder-gray-500"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-500 hover:text-gray-300">
              <FaTimes className="text-xs" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {!query && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FaSearch className="text-5xl mb-3 opacity-20" />
            <p className="text-sm">Search {type === 'tasks' ? 'tasks' : 'members'}</p>
          </div>
        )}
        {query && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
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
                className="flex items-center gap-4 px-4 py-3 bg-[#14141a] rounded-xl border border-gray-800/40 hover:border-[#0d9488]/40 hover:bg-[#1a1a24] transition cursor-pointer group"
              >
                {type === 'tasks' ? (
                  <>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold" style={{ backgroundColor: brandColor }}>
                      {item.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 group-hover:text-white transition">{item.title}</p>
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
                      {item.status === 'active' && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#0b0b10]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 group-hover:text-white transition">{item.user?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 truncate">{item.user?.email}</p>
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

// ─── Sub‑task Item (mobile‑friendly, with link wrapping) ────────────
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
    done: { label: 'Done', color: 'text-blue-400' },
    confirmed: { label: 'Confirmed', color: 'text-green-400' },
  };
  const st = statusMap[subTask.status] || statusMap.pending;

  return (
    <div className="flex flex-col py-2 border-b border-gray-800/20 last:border-0">
      {/* Main row: title + status + toggle button */}
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-300">{subTask.title}</span>
            <span className={`text-[10px] font-medium ${st.color}`}>{st.label}</span>
            {subTask.dueDate && new Date(subTask.dueDate) < new Date() && subTask.status !== 'confirmed' && (
              <span className="text-[10px] text-red-400 flex items-center gap-1"><FaClock className="text-[8px]" /> Overdue</span>
            )}
          </div>
          {subTask.description && <p className="text-xs text-gray-500 truncate">{subTask.description}</p>}
          {subTask.dueDate && <p className="text-[10px] text-gray-500 flex items-center gap-1"><FaRegClock className="text-xs" /> {formatDateTime(subTask.dueDate)}</p>}
        </div>
        {/* Toggle details button (only if there are details) */}
        {hasDetails && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-500 hover:bg-gray-800/30 rounded-lg transition flex-shrink-0"
          >
            <FaAngleDown className={`text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Action buttons – stacked below on mobile, inline on larger screens */}
      <div className="flex flex-wrap items-center gap-1 mt-1 sm:mt-0 sm:ml-auto sm:flex-nowrap">
        {isAssignee && subTask.status === 'pending' && (
          <button onClick={handleMarkDone} disabled={updating} className="p-1 text-blue-400 hover:bg-blue-500/10 rounded-lg transition">
            <FaCheck className="text-xs" />
          </button>
        )}
        {canManage && subTask.status === 'done' && (
          <>
            <button onClick={handleConfirmClick} disabled={updating} className="p-1 text-green-400 hover:bg-green-500/10 rounded-lg transition">
              <FaCheckDouble className="text-xs" />
            </button>
            <button onClick={handleReject} disabled={updating} className="p-1 text-red-400 hover:bg-red-500/10 rounded-lg transition">
              <FaTimes className="text-xs" />
            </button>
          </>
        )}
        {(isAssignee && subTask.status !== 'confirmed') || canManage ? (
          <button onClick={handleDelete} disabled={updating} className="p-1 text-red-400/60 hover:bg-red-500/10 rounded-lg transition">
            <FaTrashAlt className="text-xs" />
          </button>
        ) : null}
      </div>

      {/* Expandable details – now with proper link wrapping */}
      {isExpanded && (
        <div className="mt-1 text-xs text-gray-400 space-y-1 bg-[#1a1a24] p-3 rounded-xl border border-gray-800/40 w-full overflow-hidden">
          {subTask.notes && <div><span className="font-medium text-gray-300">Notes:</span> {subTask.notes}</div>}
          {subTask.links && subTask.links.length > 0 && (
            <div>
              <span className="font-medium text-gray-300">Links:</span>
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                {subTask.links.map((l, i) => (
                  <React.Fragment key={i}>
                    <a
                      href={l}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0d9488] underline hover:text-[#14b8a6] break-all"
                    >
                      {l}
                    </a>
                    {i < subTask.links.length - 1 && <span className="text-gray-500">,</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
          {subTask.attachments && subTask.attachments.length > 0 && (
            <div>
              <span className="font-medium text-gray-300">Attachments:</span>
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                {subTask.attachments.map((att, i) => (
                  <React.Fragment key={i}>
                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[#0d9488] underline hover:text-[#14b8a6] break-all">
                      {att.name || 'file'}
                    </a>
                    {i < subTask.attachments.length - 1 && <span className="text-gray-500">,</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
          {subTask.feedback && <div><span className="font-medium text-gray-300">Confirm feedback:</span> {subTask.feedback}</div>}
          {subTask.rejectedBy && (
            <div><span className="font-medium text-gray-300">Rejected by:</span> {subTask.rejectedBy.name || 'Unknown'} on {formatDateTime(subTask.rejectedAt)}</div>
          )}
          {subTask.rejectionReason && <div><span className="font-medium text-gray-300">Rejection reason:</span> {subTask.rejectionReason}</div>}
          {subTask.completedAt && <div><span className="font-medium text-gray-300">Submitted on:</span> {formatDateTime(subTask.completedAt)}</div>}
          {subTask.confirmedAt && <div><span className="font-medium text-gray-300">Confirmed on:</span> {formatDateTime(subTask.confirmedAt)}</div>}
        </div>
      )}

      {showDoneForm && (
        <div className="mt-2 bg-[#1a1a24] border border-gray-800/60 rounded-xl p-3 w-full">
          <textarea
            placeholder="Add notes (optional)"
            value={doneNotes}
            onChange={(e) => setDoneNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:border-[#0d9488] outline-none mb-2"
          />
          <textarea
            placeholder="Links (one per line)"
            value={doneLinks}
            onChange={(e) => setDoneLinks(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:border-[#0d9488] outline-none mb-2"
          />
          <div className="flex items-center gap-2 mb-2">
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={(e) => setDoneFiles([...e.target.files])}
              className="text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#0d9488]/20 file:text-[#0d9488]"
            />
            {doneFiles.length > 0 && <span className="text-xs text-gray-500">{doneFiles.length} file(s)</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={submitDone} disabled={updating} className="px-3 py-1.5 bg-[#0d9488] text-white text-xs rounded-lg hover:bg-[#0f9e96] transition">
              {updating ? 'Saving...' : 'Submit Done'}
            </button>
            <button onClick={cancelDone} className="px-3 py-1.5 bg-gray-700 text-gray-200 text-xs rounded-lg hover:bg-gray-600 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showConfirmForm && (
        <div className="mt-2 bg-[#1a1a24] border border-gray-800/60 rounded-xl p-3 w-full">
          <p className="text-xs font-medium text-gray-300 mb-1">Assignee submitted:</p>
          {subTask.notes && <div className="text-xs text-gray-400 mb-1"><span className="font-medium text-gray-300">Notes:</span> {subTask.notes}</div>}
          {subTask.links && subTask.links.length > 0 && (
            <div className="text-xs text-gray-400 mb-1">
              <span className="font-medium text-gray-300">Links:</span>
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
            <div className="text-xs text-gray-400 mb-2">
              <span className="font-medium text-gray-300">Attachments:</span>
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
          <textarea
            placeholder="Add feedback (optional)"
            value={confirmFeedback}
            onChange={(e) => setConfirmFeedback(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:border-[#0d9488] outline-none mb-2"
          />
          <div className="flex gap-2">
            <button onClick={submitConfirm} disabled={updating} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition">
              {updating ? 'Confirming...' : 'Confirm'}
            </button>
            <button onClick={cancelConfirm} className="px-3 py-1.5 bg-gray-700 text-gray-200 text-xs rounded-lg hover:bg-gray-600 transition">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Assign Task Modal (dark) ────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-[#14141a] border border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-200"><FaUserPlus className="inline mr-1 text-[#0d9488]" /> Assign Task</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <p className="text-sm text-gray-400 mb-3">Assign "{task?.title}" to a member.</p>
          <CustomDropdown
            label="Select Member"
            options={assigneeOpts}
            value={assigneeId}
            onChange={setAssigneeId}
            placeholder="Select..."
            brandColor={brandColor}
          />
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-700/60 rounded-xl text-sm text-gray-400 hover:bg-gray-800/30 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>
              {loading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Task Detail View ──────────────────────────────────────────────────
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
    <div className="flex flex-col h-full bg-[#0f0f12]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60 bg-[#14141a]/80 backdrop-blur-sm flex-shrink-0 sticky top-0 z-10">
        <button onClick={onBack} className="p-1 md:hidden text-gray-400 hover:text-white transition"><FaArrowLeft /></button>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: brandColor }}
        >
          {task.title.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-200 truncate">{task.title}</h2>
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            {task.assignee && <span className="text-gray-400 truncate">{task.assignee.name}</span>}
          </div>
        </div>
        <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/60 rounded-lg transition">
          <FaEllipsisV className="text-sm" />
        </button>
        {showMenu && (
          <div className="absolute right-4 top-12 bg-[#1e1e26] border border-gray-800/60 rounded-xl min-w-[150px] z-20 py-1 shadow-lg">
            {canManage && (
              <button onClick={() => { setShowMenu(false); onSendReminder(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-orange-400 hover:bg-orange-500/10 w-full transition">
                <FaBell className="text-xs" /> Send Reminder
              </button>
            )}
            <button onClick={() => { setShowMenu(false); onEdit(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/10 w-full transition">
              <FaEdit className="text-xs" /> Edit
            </button>
            {canManage && (
              <button onClick={() => { setShowMenu(false); onDelete(task._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 w-full transition">
                <FaTrashAlt className="text-xs" /> Delete
              </button>
            )}
            {canManage && !task.assignee && (
              <button onClick={() => { setShowMenu(false); onAssignTask(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-[#0d9488] hover:bg-[#0d9488]/10 w-full transition">
                <FaUserPlus className="text-xs" /> Assign Task
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress & Stats */}
      <div className="bg-[#14141a] border-b border-gray-800/40 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-300">Progress</span>
          <span className="text-gray-400">{progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-800/60 rounded-full mt-1 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, backgroundColor: brandColor, boxShadow: `0 0 12px ${brandColor}66` }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>{confirmed}/{total} sub‑tasks confirmed</span>
          {task.dueDate && (
            <span className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && task.status !== 'completed' && task.status !== 'confirmed_completed' ? 'text-red-400' : ''}`}>
              <FaCalendarAlt className="text-[10px]" /> Due: {formatDateTime(task.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Sub‑tasks area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-24 md:pb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <FaTasks className="text-[#0d9488]" /> Sub‑tasks
          </h3>
          {(isAssignee && task.allowAssigneeEditSubtasks) || canManage ? (
            <button onClick={() => setAddSubTaskOpen(!addSubTaskOpen)} className="text-xs text-[#0d9488] font-medium flex items-center gap-1 hover:text-[#14b8a6] transition">
              <FaPlus className="text-xs" /> Add
            </button>
          ) : null}
        </div>

        {addSubTaskOpen && (
          <div className="bg-[#1a1a24] border border-gray-800/60 rounded-xl p-3 mb-3 w-full">
            <input
              type="text"
              placeholder="Sub‑task title"
              value={newSubTaskTitle}
              onChange={(e) => setNewSubTaskTitle(e.target.value)}
              className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:border-[#0d9488] outline-none mb-2"
            />
            <input
              type="datetime-local"
              placeholder="Start date & time"
              value={newSubTaskStart}
              onChange={(e) => setNewSubTaskStart(e.target.value)}
              className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-lg text-sm text-gray-200 focus:border-[#0d9488] outline-none mb-2"
            />
            <input
              type="datetime-local"
              placeholder="Due date & time"
              value={newSubTaskDue}
              onChange={(e) => setNewSubTaskDue(e.target.value)}
              className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-lg text-sm text-gray-200 focus:border-[#0d9488] outline-none mb-2"
            />
            <div className="flex gap-2">
              <button onClick={() => setAddSubTaskOpen(false)} className="flex-1 py-1.5 border border-gray-700/60 rounded-lg text-sm text-gray-400 hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={handleAddSubTask} disabled={adding} className="flex-1 py-1.5 text-white rounded-lg text-sm transition" style={{ backgroundColor: brandColor }}>
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {(task.subTasks || []).length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">No sub‑tasks yet</div>
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
        <div className="border-t border-gray-800/40 bg-[#14141a] px-3 py-2 flex-shrink-0 sticky bottom-0">
          <button
            onClick={() => onRefresh()}
            className="w-full py-2 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition hover:opacity-80"
            style={{ backgroundColor: brandColor }}
          >
            <FaChartLine className="text-sm" /> Refresh status
          </button>
        </div>
      )}
      {canManage && task.status === 'completed' && task.status !== 'confirmed_completed' && (
        <div className="border-t border-gray-800/40 bg-[#14141a] px-3 py-2 flex-shrink-0 sticky bottom-0">
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
};

// ─── Create Task Modal (dark) ─────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-[#14141a] border border-gray-800/60 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-200"><FaTasks className="inline mr-1 text-[#0d9488]" /> New Task</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Detailed Description</label>
            <textarea value={detailedDescription} onChange={e => setDetailedDescription(e.target.value)} rows={3} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" />
          </div>
          <CustomDropdown label="Assignee" options={assigneeOpts} value={assigneeId} onChange={setAssigneeId} placeholder="Select assignee" brandColor={brandColor} />
          <div className="grid grid-cols-2 gap-3">
            <CustomDropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} brandColor={brandColor} />
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Start Date & Time</label>
              <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Due Date & Time</label>
            <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Est. Hours</label>
              <input type="number" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" readOnly={!!(startDate && dueDate)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Buffer (min)</label>
              <input type="number" min="0" value={bufferTime} onChange={e => setBufferTime(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={allowAssigneeEditSubtasks} onChange={e => setAllowAssigneeEditSubtasks(e.target.checked)} id="allowEdit" className="accent-[#0d9488]" />
            <label htmlFor="allowEdit" className="text-xs text-gray-400">Allow assignee to edit sub‑tasks</label>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1"><FaLink className="inline mr-1" /> Links (one per line)</label>
            <textarea value={linksText} onChange={e => setLinksText(e.target.value)} rows={3} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1"><FaPaperclip className="inline mr-1" /> Attachments</label>
            <input type="file" multiple onChange={handleFile} className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#0d9488]/20 file:text-[#0d9488]" />
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((f, i) => (
                  <div key={i} className="flex justify-between bg-[#1a1a24] rounded-lg px-3 py-1.5">
                    <span className="text-sm truncate text-gray-300">{f.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-300"><FaTrashAlt className="text-xs" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-700/60 rounded-xl text-sm text-gray-400 hover:bg-gray-800/30 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Creating...' : 'Create Task'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Edit Task Modal (dark) ───────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-[#14141a] border border-gray-800/60 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-200"><FaEdit className="inline mr-1 text-[#0d9488]" /> Edit Task</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Detailed Description</label>
            <textarea value={detailedDescription} onChange={e => setDetailedDescription(e.target.value)} rows={3} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" />
          </div>
          <CustomDropdown label="Status" options={statusOptions} value={status} onChange={setStatus} brandColor={brandColor} />
          <CustomDropdown label="Assignee" options={assigneeOpts} value={assigneeId} onChange={setAssigneeId} brandColor={brandColor} />
          <div className="grid grid-cols-2 gap-3">
            <CustomDropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} brandColor={brandColor} />
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Start Date & Time</label>
              <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Due Date & Time</label>
            <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Est. Hours</label>
              <input type="number" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" readOnly={!!(startDate && dueDate)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Buffer (min)</label>
              <input type="number" min="0" value={bufferTime} onChange={e => setBufferTime(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={allowAssigneeEditSubtasks} onChange={e => setAllowAssigneeEditSubtasks(e.target.checked)} id="allowEditEdit" className="accent-[#0d9488]" />
            <label htmlFor="allowEditEdit" className="text-xs text-gray-400">Allow assignee to edit sub‑tasks</label>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1"><FaLink className="inline mr-1" /> Links</label>
            <textarea value={linksText} onChange={e => setLinksText(e.target.value)} rows={3} className="w-full px-3 py-2 bg-[#0b0b10] border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-[#0d9488] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1"><FaPaperclip className="inline mr-1" /> Attachments</label>
            {existingAttachments.length > 0 && (
              <div className="mb-2 space-y-1">
                <p className="text-xs text-gray-500">Existing:</p>
                {existingAttachments.map((f, i) => (
                  <div key={i} className="flex justify-between bg-[#1a1a24] rounded-lg px-3 py-1.5">
                    <span className="text-sm truncate text-gray-300">{f.name}</span>
                    <button type="button" onClick={() => removeExisting(i)} className="text-red-400 hover:text-red-300"><FaTrashAlt className="text-xs" /></button>
                  </div>
                ))}
              </div>
            )}
            <input type="file" multiple onChange={handleFile} className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#0d9488]/20 file:text-[#0d9488]" />
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-500">New:</p>
                {attachments.map((f, i) => (
                  <div key={i} className="flex justify-between bg-[#1a1a24] rounded-lg px-3 py-1.5">
                    <span className="text-sm truncate text-gray-300">{f.name}</span>
                    <button type="button" onClick={() => removeNew(i)} className="text-red-400 hover:text-red-300"><FaTrashAlt className="text-xs" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-700/60 rounded-xl text-sm text-gray-400 hover:bg-gray-800/30 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Updating...' : 'Update Task'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Add Member Modal (dark) ──────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-[#14141a] border border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-200"><FaUserPlus className="inline mr-1 text-[#0d9488]" /> Add Member</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <CustomDropdown label="Select Member" options={options} value={memberId} onChange={setMemberId} placeholder="Select..." brandColor={brandColor} />
          {available.length === 0 && <p className="text-xs text-gray-500 mt-1">All workspace members already in project</p>}
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-700/60 rounded-xl text-sm text-gray-400 hover:bg-gray-800/30 transition">Cancel</button>
            <button type="submit" disabled={loading || available.length === 0} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Adding...' : 'Add Member'}</button>
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
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'team'
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
    <div className="min-h-screen flex items-center justify-center bg-[#0b0b10]">
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

  const searchItems = activeTab === 'tasks' ? tasks : activeTeam;
  const onSearchSelect = (id) => {
    if (activeTab === 'tasks') handleTaskClick(id);
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
    <div className="h-dvh bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <YourWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-4 h-14 lg:h-16">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate(`/workspace/${workspaceId}/projects`)} className="p-1 lg:hidden text-gray-400 hover:text-white transition"><FaArrowLeft /></button>
              <div className="flex items-center gap-3">
                {project.coverImage ? (
                  <img src={project.coverImage} className="w-10 h-10 rounded-xl object-cover border border-gray-700/60" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: brandColor }}>
                    <FaFolder className="text-lg" />
                  </div>
                )}
                <div>
                  <h1 className="text-base font-semibold text-gray-200 truncate max-w-[150px] md:max-w-xs">{project.name}</h1>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{activeTeam.length} members</span>
                    <span className="w-1 h-1 bg-gray-600 rounded-full" />
                    <span>{projectProgress}% done</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={openSearchModal} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/30 rounded-xl transition"><FaSearch /></button>
              {canManage && (
                <button onClick={() => activeTab === 'tasks' ? setShowCreateTask(true) : setShowAddMember(true)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/30 rounded-xl transition"><FaPlus /></button>
              )}
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-6 px-4 border-t border-gray-800/30">
            <button
              onClick={() => { setActiveTab('tasks'); setMobileShowDetail(false); setSelectedTaskId(null); }}
              className={`pb-2 text-sm font-medium transition ${
                activeTab === 'tasks'
                  ? 'border-b-2 border-[#0d9488] text-[#0d9488]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Tasks ({tasks.length})
            </button>
            <button
              onClick={() => { setActiveTab('team'); setMobileShowDetail(false); setSelectedTaskId(null); }}
              className={`pb-2 text-sm font-medium transition ${
                activeTab === 'team'
                  ? 'border-b-2 border-[#0d9488] text-[#0d9488]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Team ({activeTeam.length})
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel – List (grid or team list) */}
          <div className={`${mobileShowDetail ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-2/5 lg:w-1/3 border-r border-gray-800/40 bg-[#0f0f12] h-full`}>
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'tasks' ? (
                tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <FaTasks className="text-4xl mb-2 opacity-30" />
                    <p className="text-sm">No tasks yet</p>
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
                      />
                    ))}
                  </div>
                )
              ) : (
                <div className="divide-y divide-gray-800/30">
                  {/* Managers */}
                  <div className="py-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
                        <FaCrown className="text-yellow-400" /> Managers
                      </span>
                      {isOwner && (
                        <button onClick={() => setShowAddManager(true)} className="text-xs text-[#0d9488] hover:text-[#14b8a6] transition font-medium">
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
                          <p className="text-sm font-medium text-gray-200 truncate">{m.name}</p>
                          <p className="text-xs text-gray-500 truncate">{m.email}</p>
                        </div>
                        {isOwner && projectManagers.length > 1 && (
                          <button onClick={() => handleRemoveManager(m._id)} className="p-1 text-red-400 opacity-0 group-hover:opacity-100 transition">
                            <FaUserMinus className="text-sm" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Team Members */}
                  <div className="py-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
                        <FaUsers className="text-[#0d9488]" /> Team ({activeTeam.length})
                      </span>
                      {canManage && (
                        <button onClick={() => setShowAddMember(true)} className="text-xs text-[#0d9488] hover:text-[#14b8a6] transition font-medium">
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
                            <p className="text-sm font-medium text-gray-200 truncate">{user.name || 'Unknown'}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>
                          {canManage && (
                            <button onClick={() => handleRemoveMember(memberId)} className="p-1 text-red-400 opacity-0 group-hover:opacity-100 transition">
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

          {/* Right Panel – Detail (slides in) */}
          <div className={`${mobileShowDetail ? 'flex' : 'hidden md:flex'} flex-col flex-1 h-full bg-[#0f0f12]`}>
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
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <FaCommentDots className="text-5xl mx-auto mb-4 opacity-30" style={{ color: brandColor }} />
                  <p className="text-lg font-medium text-gray-300">Select a task</p>
                  <p className="text-sm mt-1 text-gray-400">Sub‑tasks and details will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation (mobile) – hidden when detail open */}
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
        onSuccess={() => { refetchTasks(); refetchProject(); }}
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
        onSuccess={() => { refetchTasks(); refetchProject(); }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-[#14141a] border border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-200">Add Manager</h2>
              <button onClick={() => setShowAddManager(false)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <CustomDropdown
              label="Select Member"
              options={managerOptions}
              value=""
              onChange={(v) => { if (v) handleAddManager(v); setShowAddManager(false); }}
              brandColor={brandColor}
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAddManager(false)} className="flex-1 py-2 border border-gray-700/60 rounded-xl text-sm text-gray-400 hover:bg-gray-800/30 transition">Cancel</button>
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
    </div>
  );
};

export default YourWorkspaceProjectId;
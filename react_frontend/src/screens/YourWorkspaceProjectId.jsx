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
  useUpdateTaskProgressMutation,
  useApproveTaskCompletionMutation,
  useGetTaskFeedbackQuery,
  useReviewTaskProgressMutation,   // ← required for inline review actions
} from '../slices/taskApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
import {
  FaArrowLeft, FaFolder, FaUsers, FaTasks, FaCheckCircle, FaClock,
  FaCalendarAlt, FaChartLine, FaUserCheck, FaPlus, FaTimes, FaEllipsisV,
  FaEdit, FaTrashAlt, FaUserPlus, FaUserMinus, FaCrown, FaCheck,
  FaSpinner, FaUser, FaFlag, FaFire, FaAngleDown, FaLink,
  FaPercent, FaHistory, FaCommentDots, FaSearch,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// ──────────────────────── Helpers ────────────────────────
const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ───────────────────── Custom Dropdown ─────────────────────
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
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm bg-white"
        style={{ '--tw-ring-color': brandColor }}
        onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.label : placeholder || 'Select...'}
        </span>
        <FaAngleDown className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition text-left ${o.value === value ? 'bg-gray-50' : ''}`}
              style={o.value === value ? { backgroundColor: `${brandColor}10`, color: brandColor } : {}}
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

// ───────────────────── Badges ─────────────────────
const priorityOptions = [
  { value: 'low', label: 'Low', icon: <FaFlag className="text-blue-400" /> },
  { value: 'medium', label: 'Medium', icon: <FaFlag className="text-yellow-400" /> },
  { value: 'high', label: 'High', icon: <FaFire className="text-red-400" /> },
  { value: 'urgent', label: 'Urgent', icon: <FaFire className="text-red-500" /> },
];
const statusOptions = [
  { value: 'pending', label: 'Pending', icon: <FaClock className="text-gray-400" /> },
  { value: 'in-progress', label: 'In Progress', icon: <FaSpinner className="text-yellow-400" /> },
  { value: 'review', label: 'Review', icon: <FaCheckCircle className="text-purple-400" /> },
  { value: 'completed', label: 'Completed', icon: <FaCheckCircle className="text-green-400" /> },
];

const TaskStatusBadge = ({ status }) => {
  const map = {
    pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700' },
    'in-progress': { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
    review: { label: 'Review', color: 'bg-purple-100 text-purple-700' },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
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

// ─────────────────── Task List Item ───────────────────
const TaskListItem = ({ task, isActive, onClick, brandColor }) => {
  const progress = task.progress || 0;
  const lastActivity =
    task.status === 'completed' ? 'Completed' :
    task.status === 'review' ? 'In review' :
    task.status === 'in-progress' ? `${progress}% done` : 'Pending';
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left border-b border-gray-100 ${
        isActive ? 'bg-gray-100' : ''
      }`}
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
            {formatDate(task.dueDate) !== 'N/A' ? formatDate(task.dueDate) : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <TaskPriorityBadge priority={task.priority} />
          <TaskStatusBadge status={task.status} />
        </div>
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          {task.assignee ? `${task.assignee.name} · ` : ''}{lastActivity}
        </p>
      </div>
    </button>
  );
};

// ────────────────── Chat Bubble (with review actions) ──────────────────
const ChatBubble = ({ message, isOwn, brandColor, canManage, onReview }) => {
  const user = message.user || {};
  const avatarChar = user.name ? user.name.charAt(0).toUpperCase() : '?';
  const isPendingReview = message.type === 'progress_update' && message.approved === null;
  const showReviewActions = canManage && isPendingReview;

  return (
    <div className={`flex gap-2 mb-4 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: isOwn ? brandColor : '#CBD5E0' }}
      >
        {user.profile ? <img src={user.profile} className="w-full h-full rounded-full object-cover" /> : avatarChar}
      </div>
      <div className={`max-w-[85%] md:max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-2.5 rounded-2xl shadow-sm break-words overflow-hidden ${
            isOwn ? 'text-white rounded-br-md' : 'bg-white border border-gray-200 rounded-bl-md'
          }`}
          style={isOwn ? { backgroundColor: brandColor } : {}}
        >
          {!isOwn && <p className="text-xs font-medium text-gray-700 mb-1">{user.name || 'Unknown'}</p>}
          <div className="flex items-center gap-1 text-xs font-medium">
            <FaPercent className="text-[10px]" />
            <span>Progress: {message.progress}%</span>
          </div>
          {message.notes && <p className="text-sm mt-1 whitespace-pre-wrap break-words">{message.notes}</p>}
          {message.links?.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {message.links.map((l, i) => (
                <a key={i} href={l} target="_blank" className="text-xs underline break-all" style={{ color: isOwn ? 'white' : brandColor }}>{l}</a>
              ))}
            </div>
          )}
          {message.attachments?.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {message.attachments.map((att, i) => (
                <a key={i} href={att.url} target="_blank" className="text-xs underline break-all" style={{ color: isOwn ? 'white' : brandColor }}>{att.name || att.url}</a>
              ))}
            </div>
          )}
          <span className="text-[10px] mt-1.5 block opacity-70 text-right">{formatDateTime(message.createdAt)}</span>
        </div>

        {/* Inline review buttons */}
        {showReviewActions && (
          <div className="mt-2 flex gap-2 justify-end">
            <button
              onClick={() => onReview(message._id, true)}
              className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg transition"
            >
              Confirm
            </button>
            <button
              onClick={() => onReview(message._id, false)}
              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg transition"
            >
              Not Satisfied
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ────────────────── Task Detail View ──────────────────
const TaskDetailView = ({
  task,
  brandColor,
  feedbackData,
  isLoading,
  userInfo,
  onBack,
  onEdit,
  onDelete,
  onUpdateProgress,
  onApproveCompletion,
  canManage,
}) => {
  const feedbackList = feedbackData?.feedback || [];
  const isAssignee = task.assignee?._id === userInfo?._id;
  const [showMenu, setShowMenu] = useState(false);

  // Review flow states
  const [reviewItemId, setReviewItemId] = useState(null);
  const [reviewAction, setReviewAction] = useState(null); // true = confirm, false = not satisfied
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewTaskProgress] = useReviewTaskProgressMutation();

  const handleStartReview = (itemId, approved) => {
    setReviewItemId(itemId);
    setReviewAction(approved);
    setReviewMessage('');
  };

  const handleSubmitReview = async () => {
    setReviewSubmitting(true);
    try {
      await reviewTaskProgress({
        taskId: task._id,
        approved: reviewAction,
        feedback: reviewMessage.trim(),
      }).unwrap();
      toast.success(reviewAction ? 'Progress confirmed' : 'Progress rejected');
      setReviewItemId(null);
      setReviewAction(null);
      setReviewMessage('');
      // RTK Query tag invalidation will refetch feedback automatically
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const cancelReview = () => {
    setReviewItemId(null);
    setReviewAction(null);
    setReviewMessage('');
  };

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
        {canManage && (
          <button onClick={() => setShowMenu(!showMenu)} className="p-1.5">
            <FaEllipsisV className="text-sm" />
          </button>
        )}
        {showMenu && (
          <div className="absolute right-4 top-12 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[140px] z-20 py-1 text-gray-700">
            {canManage && (
              <button
                onClick={() => { setShowMenu(false); onApproveCompletion(task); }}
                className="flex items-center gap-2 px-4 py-1.5 text-sm text-green-600 hover:bg-green-50 w-full"
              >
                <FaCheckCircle className="text-xs" /> Approve
              </button>
            )}
            <button
              onClick={() => { setShowMenu(false); onEdit(task); }}
              className="flex items-center gap-2 px-4 py-1.5 text-sm text-blue-600 hover:bg-blue-50 w-full"
            >
              <FaEdit className="text-xs" /> Edit
            </button>
            {canManage && (
              <button
                onClick={() => { setShowMenu(false); onDelete(task._id); }}
                className="flex items-center gap-2 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 w-full"
              >
                <FaTrashAlt className="text-xs" /> Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#efeae2]">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: brandColor }} />
          </div>
        ) : feedbackList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FaCommentDots className="text-4xl mb-2 opacity-30" />
            <p className="text-sm">No feedback yet</p>
          </div>
        ) : (
          feedbackList.map((item, idx) => {
            const isOwn = item.user?._id === userInfo?._id;
            const isReviewingThis = reviewItemId === item._id;

            return (
              <div key={idx}>
                <ChatBubble
                  message={item}
                  isOwn={isOwn}
                  brandColor={brandColor}
                  canManage={canManage}
                  onReview={(itemId, approved) => handleStartReview(itemId, approved)}
                />
                {isReviewingThis && (
                  <div className="mt-1 ml-10 mr-2 bg-white p-3 rounded-xl border shadow-sm">
                    <textarea
                      value={reviewMessage}
                      onChange={(e) => setReviewMessage(e.target.value)}
                      placeholder="Add optional message..."
                      rows={2}
                      className="w-full px-2 py-1 border rounded text-xs resize-none mb-2"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={handleSubmitReview}
                        disabled={reviewSubmitting}
                        className={`px-3 py-1 text-white text-xs rounded-lg transition ${
                          reviewAction ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                        }`}
                      >
                        {reviewSubmitting ? '...' : reviewAction ? 'Confirm' : 'Not Satisfied'}
                      </button>
                      <button
                        onClick={cancelReview}
                        className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-700 text-xs rounded-lg transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom action – only for assignee and not completed */}
      {isAssignee && task.status !== 'completed' && (
        <div className="border-t bg-white px-3 py-2 flex-shrink-0 sticky bottom-0">
          <button
            onClick={() => onUpdateProgress(task)}
            className="w-full py-2 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
            style={{ backgroundColor: brandColor }}
          >
            <FaChartLine className="text-sm" /> Update Progress
          </button>
        </div>
      )}
    </div>
  );
};

// ────────────────── Search Modal ──────────────────
const SearchModal = ({ isOpen, onClose, items, type, brandColor, workspaceId, projectId, onSelect }) => {
  const [query, setQuery] = useState('');
  if (!isOpen) return null;

  const filtered = items.filter(item => {
    if (type === 'tasks') {
      return item.title?.toLowerCase().includes(query.toLowerCase());
    } else {
      const user = item.user || item;
      return (user.name || '').toLowerCase().includes(query.toLowerCase()) ||
             (user.email || '').toLowerCase().includes(query.toLowerCase());
    }
  });

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-100">
        <button onClick={onClose} className="p-1"><FaArrowLeft className="text-gray-600" /></button>
        <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 flex items-center gap-2">
          <FaSearch className="text-gray-400 text-xs" />
          <input
            type="text"
            placeholder={type === 'tasks' ? 'Search tasks...' : 'Search members...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent w-full outline-none text-sm"
            autoFocus
          />
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
              <div
                key={item._id || (item.user?._id)}
                onClick={() => {
                  onSelect(type === 'tasks' ? item._id : (item.user || item)._id);
                  onClose();
                }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition cursor-pointer"
              >
                {type === 'tasks' ? (
                  <>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: brandColor }}
                    >
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
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: brandColor }}
                        >
                          {(item.user?.name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      {item.status === 'active' && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                      )}
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

// ────────────────── Create Task Modal ──────────────────
const CreateTaskModal = ({ isOpen, onClose, projectId, brandColor, assignableMembers, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [detailedDescription, setDetailedDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [linksText, setLinksText] = useState('');
  const [loading, setLoading] = useState(false);
  const [createTask] = useCreateTaskMutation();

  const assigneeOpts = [
    { value: '', label: 'Unassigned', icon: <FaUser className="text-gray-400" /> },
    ...assignableMembers.map(m => {
      const u = m.user || m;
      return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" alt="" /> : <FaUser className="text-gray-400" /> };
    })
  ];

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
      if (dueDate) fd.append('dueDate', dueDate);
      const links = linksText.split('\n').map(l => l.trim()).filter(Boolean);
      links.forEach(l => fd.append('links', l));
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between mb-4"><h2 className="text-xl font-bold"><FaTasks className="inline mr-1" /> New Task</h2><button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><FaTimes /></button></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1.5">Title *</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm" required /></div>
          <div><label className="block text-sm font-medium mb-1.5">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Detailed Description</label><textarea value={detailedDescription} onChange={e => setDetailedDescription(e.target.value)} rows={3} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <CustomDropdown label="Assignee" options={assigneeOpts} value={assigneeId} onChange={setAssigneeId} placeholder="Select assignee" brandColor={brandColor} />
          <div className="grid grid-cols-2 gap-3">
            <CustomDropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} brandColor={brandColor} />
            <div><label className="block text-sm font-medium mb-1.5">Due Date</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1.5">Est. Hours</label><input type="number" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <div>
            <label className="block text-sm font-medium mb-1.5"><FaLink className="inline mr-1" /> Links (one per line)</label>
            <textarea value={linksText} onChange={e => setLinksText(e.target.value)} rows={3} className="w-full px-4 py-2 border rounded-lg text-sm" placeholder="Paste URLs to documents, images, etc." />
          </div>
          <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg">Cancel</button><button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-lg" style={{ backgroundColor: brandColor }}>{loading ? 'Creating...' : 'Create Task'}</button></div>
        </form>
      </div>
    </div>
  );
};

// ────────────────── Edit Task Modal ──────────────────
const EditTaskModal = ({ isOpen, onClose, task, brandColor, assignableMembers, onSuccess }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [detailedDescription, setDetailedDescription] = useState(task?.detailedDescription || '');
  const [assigneeId, setAssigneeId] = useState(task?.assignee?._id || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
  const [status, setStatus] = useState(task?.status || 'pending');
  const [estimatedHours, setEstimatedHours] = useState(task?.estimatedHours || '');
  const [linksText, setLinksText] = useState(task?.links?.join('\n') || '');
  const [loading, setLoading] = useState(false);
  const [updateTask] = useUpdateTaskMutation();

  const assigneeOpts = [
    { value: '', label: 'Unassigned', icon: <FaUser className="text-gray-400" /> },
    ...assignableMembers.map(m => {
      const u = m.user || m;
      return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" alt="" /> : <FaUser className="text-gray-400" /> };
    })
  ];

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
      if (dueDate) fd.append('dueDate', dueDate);
      const links = linksText.split('\n').map(l => l.trim()).filter(Boolean);
      links.forEach(l => fd.append('links', l));
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between mb-4"><h2 className="text-xl font-bold"><FaEdit className="inline mr-1" /> Edit Task</h2><button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><FaTimes /></button></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1.5">Title *</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm" required /></div>
          <div><label className="block text-sm font-medium mb-1.5">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Detailed Description</label><textarea value={detailedDescription} onChange={e => setDetailedDescription(e.target.value)} rows={3} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <CustomDropdown label="Status" options={statusOptions} value={status} onChange={setStatus} brandColor={brandColor} />
          <CustomDropdown label="Assignee" options={assigneeOpts} value={assigneeId} onChange={setAssigneeId} brandColor={brandColor} />
          <div className="grid grid-cols-2 gap-3">
            <CustomDropdown label="Priority" options={priorityOptions} value={priority} onChange={setPriority} brandColor={brandColor} />
            <div><label className="block text-sm font-medium mb-1.5">Due Date</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1.5">Est. Hours</label><input type="number" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <div>
            <label className="block text-sm font-medium mb-1.5"><FaLink className="inline mr-1" /> Links (one per line)</label>
            <textarea value={linksText} onChange={e => setLinksText(e.target.value)} rows={3} className="w-full px-4 py-2 border rounded-lg text-sm" placeholder="Paste URLs to documents, images, etc." />
          </div>
          <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg">Cancel</button><button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-lg" style={{ backgroundColor: brandColor }}>{loading ? 'Updating...' : 'Update Task'}</button></div>
        </form>
      </div>
    </div>
  );
};

// ────────────────── Progress Update Modal (with file uploads) ──────────────────
const ProgressUpdateModal = ({ isOpen, onClose, task, brandColor, onSuccess }) => {
  const [progress, setProgress] = useState(task?.progress || 0);
  const [notes, setNotes] = useState('');
  const [links, setLinks] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updateTaskProgress] = useUpdateTaskProgressMutation();
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => { setFiles([...e.target.files]); };
  const removeFile = (index) => { setFiles(files.filter((_, i) => i !== index)); };

  const submit = async (e) => {
    e.preventDefault();
    if (progress < 0 || progress > 100) { toast.error('Progress must be 0-100'); return; }
    setLoading(true);
    try {
      const linksArr = links.split('\n').map(l => l.trim()).filter(Boolean);
      if (files.length > 0) {
        const formData = new FormData();
        formData.append('taskId', task._id);
        formData.append('progress', progress);
        formData.append('notes', notes);
        formData.append('links', JSON.stringify(linksArr));
        files.forEach(file => formData.append('attachments', file));
        await updateTaskProgress(formData).unwrap();
      } else {
        await updateTaskProgress({ taskId: task._id, progress, notes, links: linksArr }).unwrap();
      }
      toast.success('Progress updated');
      onSuccess();
      onClose();
    } catch (err) { toast.error(err?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold"><FaChartLine className="inline mr-1" /> Progress</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><FaTimes /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Progress: {progress}%</label>
            <input
              type="range" min="0" max="100" value={progress}
              onChange={e => setProgress(parseInt(e.target.value))}
              className="w-full" style={{ accentColor: brandColor }}
            />
          </div>
          <div><label className="block text-sm font-medium mb-1.5">Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <div><label className="block text-sm font-medium mb-1.5"><FaLink className="inline mr-1" /> Links (one per line)</label><textarea value={links} onChange={e => setLinks(e.target.value)} rows={2} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Attachments (images/documents)</label>
            <input type="file" multiple onChange={handleFileChange} className="hidden" ref={fileInputRef} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-2 border border-dashed rounded-lg text-sm text-gray-500 hover:bg-gray-50">
              <FaPlus className="inline mr-1" /> Add files
            </button>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((file, i) => (
                  <li key={i} className="flex items-center justify-between text-xs bg-gray-100 px-2 py-1 rounded">
                    <span className="truncate">{file.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-red-400 ml-2"><FaTimes /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-lg" style={{ backgroundColor: brandColor }}>{loading ? 'Updating...' : 'Update Progress'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ────────────────── Add Member Modal ──────────────────
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between mb-4"><h2 className="text-xl font-bold"><FaUserPlus className="inline mr-1" /> Add Member</h2><button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><FaTimes /></button></div>
        <form onSubmit={handleSubmit}>
          <CustomDropdown label="Select Member" options={options} value={memberId} onChange={setMemberId} placeholder="Select..." brandColor={brandColor} />
          {available.length === 0 && <p className="text-xs text-gray-400 mt-1">All workspace members already in project</p>}
          <div className="flex gap-3 mt-4"><button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg">Cancel</button><button type="submit" disabled={loading || available.length === 0} className="flex-1 py-2 text-white rounded-lg" style={{ backgroundColor: brandColor }}>{loading ? 'Adding...' : 'Add Member'}</button></div>
        </form>
      </div>
    </div>
  );
};

// ───────────────────── Main Component ─────────────────────
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
  const [showProgress, setShowProgress] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);

  const { data: wData, isLoading: wLoad, error: wErr } = useGetWorkspaceQuery(workspaceId);
  const { data: pData, isLoading: pLoad, error: pErr, refetch: refetchProject } = useGetProjectByIdQuery(projectId);
  const { data: tData, isLoading: tLoad, error: tErr, refetch: refetchTasks } = useGetProjectTasksQuery({ projectId });
  const { data: feedbackData, isLoading: feedbackLoading } = useGetTaskFeedbackQuery(
    { taskId: selectedTaskId },
    { skip: !selectedTaskId }
  );

  const [deleteTask] = useDeleteTaskMutation();
  const [approveTaskCompletion] = useApproveTaskCompletionMutation();
  const [removeTeamMember] = useRemoveTeamMemberMutation();
  const [manageProjectManagers] = useManageProjectManagersMutation();

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

  // ✅ CORRECTED: works for both object form (populated) and plain string IDs
  const isManager = project?.projectManagers?.some(pm => {
    const id = (pm._id || pm)?.toString();
    return id === userInfo?._id;
  });

  const canManage = isOwner || isManager;

  const activeTask = useMemo(() => tasks.find(t => t._id === selectedTaskId) || null, [tasks, selectedTaskId]);
  const projectManagers = project?.projectManagers || [];
  const projectProgress = project?.progress || 0;

  useEffect(() => {
    if (wErr || pErr || tErr) navigate(`/workspace/${workspaceId}/projects`);
  }, [wErr, pErr, tErr, navigate, workspaceId]);

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
  const handleUpdateProgress = (task) => { setSelectedTask(task); setShowProgress(true); };
  const handleApproveCompletion = async (task) => {
    if (!confirm(`Mark "${task.title}" as completed?`)) return;
    try { await approveTaskCompletion({ taskId: task._id }).unwrap(); toast.success('Completed'); refetchTasks(); refetchProject(); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
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
                onUpdateProgress={handleUpdateProgress}
                onApproveCompletion={handleApproveCompletion}
                canManage={canManage}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FaCommentDots className="text-5xl mx-auto mb-4 opacity-30" style={{ color: brandColor }} />
                  <p className="text-lg font-medium">Select a task to view details</p>
                  <p className="text-sm mt-1">Feedback and updates will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation (mobile) */}
      {!mobileShowDetail && <YourWorkspaceBottombar workspace={workspace} />}

      {/* Modals */}
      <SearchModal isOpen={searchModalOpen} onClose={closeSearchModal} items={searchItems} type={listView} brandColor={brandColor} workspaceId={workspaceId} projectId={projectId} onSelect={onSearchSelect} />
      <CreateTaskModal isOpen={showCreateTask} onClose={() => setShowCreateTask(false)} projectId={projectId} brandColor={brandColor} assignableMembers={assignableMembers} onSuccess={() => { refetchTasks(); refetchProject(); }} />
      <EditTaskModal isOpen={showEditTask} onClose={() => { setShowEditTask(false); setSelectedTask(null); }} task={selectedTask} brandColor={brandColor} assignableMembers={assignableMembers} onSuccess={() => { refetchTasks(); refetchProject(); }} />
      <ProgressUpdateModal isOpen={showProgress} onClose={() => { setShowProgress(false); setSelectedTask(null); }} task={selectedTask} brandColor={brandColor} onSuccess={() => { refetchTasks(); refetchProject(); }} />
      <AddMemberModal isOpen={showAddMember} onClose={() => setShowAddMember(false)} workspace={workspace} project={project} brandColor={brandColor} onSuccess={refetchProject} />
      {showAddManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between mb-4"><h2 className="text-xl font-bold">Add Manager</h2><button onClick={() => setShowAddManager(false)}><FaTimes /></button></div>
            <CustomDropdown label="Select Member" options={managerOptions} value="" onChange={(v) => { if (v) handleAddManager(v); setShowAddManager(false); }} brandColor={brandColor} />
            <div className="flex gap-3 mt-4"><button onClick={() => setShowAddManager(false)} className="flex-1 py-2 border rounded-lg">Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YourWorkspaceProjectId;
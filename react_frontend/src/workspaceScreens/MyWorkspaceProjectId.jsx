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
  useUpdateTaskProgressMutation,
  useApproveTaskCompletionMutation,
  useGetTaskFeedbackQuery,
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

// ─── Custom Dropdown ──────────────────────────────────────────────────
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

// ─── Badges ────────────────────────────────────────────────────────────
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

// ─── Task List Item (WhatsApp chat style) ────────────────────────────
const TaskListItem = ({ task, isActive, onClick, brandColor }) => {
  const progress = task.progress || 0;
  const lastActivity =
    task.status === 'completed'
      ? 'Completed'
      : task.status === 'review'
      ? 'In review'
      : task.status === 'in-progress'
      ? `${progress}% done`
      : 'Pending';
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

// ─── Search Modal ──────────────────────────────────────────────────────
const SearchModal = ({ isOpen, onClose, items, type, brandColor, onSelect }) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filtered = items.filter(item => {
    if (type === 'tasks') {
      return item.title?.toLowerCase().includes(query.toLowerCase());
    } else {
      const user = item.user || item;
      return (
        (user.name || '').toLowerCase().includes(query.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(query.toLowerCase())
      );
    }
  });

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-100">
        <button onClick={onClose} className="p-1">
          <FaArrowLeft className="text-gray-600" />
        </button>
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
          {query && (
            <button onClick={() => setQuery('')}>
              <FaTimes className="text-gray-400 text-xs" />
            </button>
          )}
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

// ─── Task Detail View (Chat style) ────────────────────────────────────
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
            return (
              <div key={idx} className={`flex gap-2 mb-4 ${isOwn ? 'flex-row-reverse' : ''}`}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: isOwn ? brandColor : '#CBD5E0' }}
                >
                  {item.user?.profile ? (
                    <img src={item.user.profile} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    item.user?.name?.charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div className={`max-w-[85%] md:max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-4 py-2.5 rounded-2xl shadow-sm break-words overflow-hidden ${
                      isOwn ? 'text-white rounded-br-md' : 'bg-white border border-gray-200 rounded-bl-md'
                    }`}
                    style={isOwn ? { backgroundColor: brandColor } : {}}
                  >
                    {!isOwn && <p className="text-xs font-medium text-gray-700 mb-1">{item.user?.name || 'Unknown'}</p>}
                    <div className="flex items-center gap-1 text-xs font-medium">
                      <FaPercent className="text-[10px]" />
                      <span>Progress: {item.progress}%</span>
                    </div>
                    {item.notes && <p className="text-sm mt-1 whitespace-pre-wrap break-words">{item.notes}</p>}
                    {item.links?.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        {item.links.map((l, i) => (
                          <a key={i} href={l} target="_blank" className="text-xs underline break-all" style={{ color: isOwn ? 'white' : brandColor }}>
                            {l}
                          </a>
                        ))}
                      </div>
                    )}
                    <span className="text-[10px] mt-1.5 block opacity-70 text-right">{formatDateTime(item.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom action bar – only for assignee and not completed */}
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

// ─── Create Task Modal ────────────────────────────────────────────────
const CreateTaskModal = ({ isOpen, onClose, projectId, brandColor, assignableMembers, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [detailedDescription, setDetailedDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [linksText, setLinksText] = useState('');
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
          <div><label className="block text-sm font-medium mb-1.5"><FaLink className="inline mr-1" /> Links (one per line)</label><textarea value={linksText} onChange={e => setLinksText(e.target.value)} rows={3} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <div>
            <label className="block text-sm font-medium mb-1.5"><FaPaperclip className="inline mr-1" /> Attachments</label>
            <input type="file" multiple onChange={handleFile} className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-50" />
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">{attachments.map((f, i) => <div key={i} className="flex justify-between bg-gray-50 rounded-lg px-3 py-1.5"><span className="text-sm truncate">{f.name}</span><button type="button" onClick={() => removeFile(i)} className="text-red-400"><FaTrashAlt className="text-xs" /></button></div>)}</div>
            )}
          </div>
          <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg">Cancel</button><button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-lg" style={{ backgroundColor: brandColor }}>{loading ? 'Creating...' : 'Create Task'}</button></div>
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
  const [dueDate, setDueDate] = useState(task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
  const [status, setStatus] = useState(task?.status || 'pending');
  const [estimatedHours, setEstimatedHours] = useState(task?.estimatedHours || '');
  const [linksText, setLinksText] = useState(task?.links?.join('\n') || '');
  const [attachments, setAttachments] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState(task?.attachments || []);
  const [loading, setLoading] = useState(false);
  const [updateTask] = useUpdateTaskMutation();

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
          <div><label className="block text-sm font-medium mb-1.5"><FaLink className="inline mr-1" /> Links</label><textarea value={linksText} onChange={e => setLinksText(e.target.value)} rows={3} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <div>
            <label className="block text-sm font-medium mb-1.5"><FaPaperclip className="inline mr-1" /> Attachments</label>
            {existingAttachments.length > 0 && (
              <div className="mb-2 space-y-1"><p className="text-xs text-gray-400">Existing:</p>{existingAttachments.map((f, i) => <div key={i} className="flex justify-between bg-gray-50 rounded-lg px-3 py-1.5"><span className="text-sm truncate">{f.name}</span><button type="button" onClick={() => removeExisting(i)} className="text-red-400"><FaTrashAlt className="text-xs" /></button></div>)}</div>
            )}
            <input type="file" multiple onChange={handleFile} className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-50" />
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1"><p className="text-xs text-gray-400">New:</p>{attachments.map((f, i) => <div key={i} className="flex justify-between bg-gray-50 rounded-lg px-3 py-1.5"><span className="text-sm truncate">{f.name}</span><button type="button" onClick={() => removeNew(i)} className="text-red-400"><FaTrashAlt className="text-xs" /></button></div>)}</div>
            )}
          </div>
          <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg">Cancel</button><button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-lg" style={{ backgroundColor: brandColor }}>{loading ? 'Updating...' : 'Update Task'}</button></div>
        </form>
      </div>
    </div>
  );
};

// ─── Progress Update Modal ────────────────────────────────────────────
const ProgressUpdateModal = ({ isOpen, onClose, task, brandColor, onSuccess }) => {
  const [progress, setProgress] = useState(task?.progress || 0);
  const [notes, setNotes] = useState('');
  const [links, setLinks] = useState('');
  const [loading, setLoading] = useState(false);
  const [updateTaskProgress] = useUpdateTaskProgressMutation();

  const submit = async (e) => {
    e.preventDefault();
    if (progress < 0 || progress > 100) { toast.error('Progress must be 0-100'); return; }
    setLoading(true);
    try {
      await updateTaskProgress({ taskId: task._id, progress, notes, links: links.split('\n').filter(Boolean) }).unwrap();
      toast.success('Progress updated');
      onSuccess();
      onClose();
    } catch (err) { toast.error(err?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between mb-4"><h2 className="text-xl font-bold"><FaChartLine className="inline mr-1" /> Progress</h2><button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><FaTimes /></button></div>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1.5">Progress: {progress}%</label><input type="range" min="0" max="100" value={progress} onChange={e => setProgress(parseInt(e.target.value))} className="w-full" style={{ accentColor: brandColor }} /></div>
          <div><label className="block text-sm font-medium mb-1.5">Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <div><label className="block text-sm font-medium mb-1.5"><FaLink className="inline mr-1" /> Links</label><textarea value={links} onChange={e => setLinks(e.target.value)} rows={2} className="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <div className="flex gap-3"><button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg">Cancel</button><button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-lg" style={{ backgroundColor: brandColor }}>{loading ? 'Updating...' : 'Update Progress'}</button></div>
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

// ─── Feedback Modal (chat-like, can be reused as detail) ────────────────
const FeedbackModal = ({ isOpen, onClose, task, brandColor }) => {
  const { data: feedbackData, isLoading } = useGetTaskFeedbackQuery({ taskId: task?._id }, { skip: !isOpen || !task });
  if (!isOpen) return null;
  const list = feedbackData?.feedback || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
        <div className="flex justify-between mb-4"><h2 className="text-xl font-bold"><FaHistory className="inline mr-1" /> Feedback</h2><button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><FaTimes /></button></div>
        <div className="text-sm text-gray-500 mb-3">{task?.title}</div>
        <div className="flex-1 overflow-y-auto pr-2">
          {isLoading ? <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: brandColor }} /></div> :
            list.length === 0 ? <div className="text-center py-8 text-gray-400"><FaCommentDots className="text-3xl mx-auto mb-3" /><p>No feedback yet</p></div> :
            <div className="space-y-4">{list.map((item, idx) => (
              <div key={idx} className="bg-gray-50 rounded-xl p-4 border">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {item.user?.profile ? <img src={item.user.profile} className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: brandColor }}>{item.user?.name?.charAt(0) || '?'}</div>}
                    <span className="text-sm font-medium">{item.user?.name || 'Unknown'}</span>
                    <span className="text-xs text-gray-400">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.type === 'progress_update' ? 'bg-blue-100 text-blue-700' : item.type === 'daily_report' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                      {item.type === 'progress_update' ? 'Progress' : item.type === 'daily_report' ? 'Daily Report' : 'Review'}
                    </span>
                    {item.approved !== undefined && <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.approved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.approved ? 'Approved' : 'Rejected'}</span>}
                    {item.isLate && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Late</span>}
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div><FaPercent className="text-xs text-gray-400 inline mr-1" /><span className="font-medium">Progress:</span> {item.progress}%</div>
                  {item.notes && <div className="flex gap-2"><FaCommentDots className="text-xs text-gray-400 mt-0.5" /><span>{item.notes}</span></div>}
                  {item.links?.length > 0 && <div className="flex gap-2"><FaLink className="text-xs text-gray-400 mt-0.5" /><div className="flex flex-wrap gap-1">{item.links.map((l, i) => <a key={i} href={l} target="_blank" className="text-blue-600 text-xs hover:underline">{l}</a>)}</div></div>}
                  {item.blocks?.length > 0 && <div className="flex gap-2"><FaFire className="text-xs text-amber-400 mt-0.5" /><div className="flex flex-wrap gap-1">{item.blocks.map((b, i) => <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{b}</span>)}</div></div>}
                  {item.feedback && <div className="italic text-gray-600">“{item.feedback}”</div>}
                  {item.reviewedBy && <div className="text-xs text-gray-400"><FaUserCheck className="inline mr-1" />Reviewed by {item.reviewedBy.name}</div>}
                </div>
              </div>
            ))}</div>
          }
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
const MyWorkspaceProjectId = () => {
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
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackTask, setFeedbackTask] = useState(null);

  const { data: wData, isLoading: wLoad, error: wErr } = useGetWorkspaceQuery(workspaceId);
  const { data: pData, isLoading: pLoad, error: pErr, refetch: refetchProject } = useGetProjectByIdQuery(projectId);
  const { data: tData, isLoading: tLoad, refetch: refetchTasks } = useGetProjectTasksQuery({ projectId });
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
  const isManager = project?.projectManagers?.some(pm => pm._id === userInfo?._id || pm === userInfo?._id);
  const canManage = isOwner || isManager;

  const activeTask = useMemo(() => tasks.find(t => t._id === selectedTaskId) || null, [tasks, selectedTaskId]);
  const projectManagers = project?.projectManagers || [];
  const progress = project?.progress || 0;

  if (wErr || pErr) { navigate(`/my-workspace/${workspaceId}/projects`); return null; }
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
    try { await manageProjectManagers({ projectId, action: 'add', managerId: id }).unwrap(); toast.success('Manager added'); refetchProject(); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
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
    if (listView === 'tasks') {
      handleTaskClick(id);
    }
    // For team members, we could highlight or navigate? we'll just close.
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
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Fixed Header */}
        <header className="sticky top-0 z-10 bg-teal-600 text-white flex-shrink-0 shadow-sm">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate(`/my-workspace/${workspaceId}/projects`)} className="p-1 lg:hidden">
                <FaArrowLeft />
              </button>
              <div className="flex items-center gap-2">
                {project.coverImage ? <img src={project.coverImage} className="w-8 h-8 rounded-full object-cover" /> : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/20 font-bold">
                    <FaFolder className="text-sm" />
                  </div>
                )}
                <div>
                  <h1 className="text-base font-semibold truncate">{project.name}</h1>
                  <p className="text-xs text-white/80">{activeTeam.length} members · {progress}% done</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={openSearchModal} className="p-1"><FaSearch /></button>
              {canManage && (
                <button onClick={() => listView === 'tasks' ? setShowCreateTask(true) : setShowAddMember(true)} className="p-1">
                  <FaPlus />
                </button>
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
          {/* Left Panel – List (hidden on mobile when detail shown) */}
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
                    <TaskListItem
                      key={task._id}
                      task={task}
                      isActive={selectedTaskId === task._id}
                      onClick={() => handleTaskClick(task._id)}
                      brandColor={brandColor}
                    />
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

          {/* Right Panel – Detail (hidden on mobile when list shown) */}
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

      {/* Bottom Navigation (only when list is visible on mobile) */}
      {!mobileShowDetail && <MyWorkspaceBottombar workspace={workspace} />}

      {/* Modals */}
      <SearchModal isOpen={searchModalOpen} onClose={closeSearchModal} items={searchItems} type={listView} brandColor={brandColor} onSelect={onSearchSelect} />
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
      <FeedbackModal isOpen={showFeedback} onClose={() => { setShowFeedback(false); setFeedbackTask(null); }} task={feedbackTask} brandColor={brandColor} />
    </div>
  );
};

export default MyWorkspaceProjectId;
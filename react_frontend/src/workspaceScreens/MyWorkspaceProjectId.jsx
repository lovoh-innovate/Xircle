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
  FaFileAlt,
  FaLink,
  FaPercent,
  FaDownload,
  FaExternalLinkAlt,
  FaFilePdf,
  FaImage,
  FaFile,
  FaHistory,
  FaCommentDots,
  FaPaperclip,
  FaSearch,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// ─── Helpers (unchanged) ──────────────────────────────────────────────
const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const formatTime = (time) => {
  if (!time) return 'N/A';
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

// ─── Dropdown (unchanged) ─────────────────────────────────────────────
const CustomDropdown = ({ options, value, onChange, placeholder, label, brandColor }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  const selected = options.find(o => o.value === value);
  return (
    <div className="relative" ref={ref}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm bg-white"
        style={{ '--tw-ring-color': brandColor }}
        onFocus={e => e.target.style.setProperty('--tw-ring-color', brandColor)}>
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.label : placeholder || 'Select...'}
        </span>
        <FaAngleDown className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map(o => (
            <button key={o.value} type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition text-left ${o.value === value ? 'bg-gray-50' : ''}`}
              style={o.value === value ? { backgroundColor: `${brandColor}10`, color: brandColor } : {}}>
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

// ─── Badges & Options (unchanged) ─────────────────────────────────────
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

// ─── Task Item (original) ─────────────────────────────────────────────
const TaskItem = ({ task, brandColor, onEdit, onDelete, onUpdateProgress, onApproveCompletion, onFeedback, canManage, currentUserId }) => {
  const [menu, setMenu] = useState(false);
  const progress = task.progress || 0;
  const isAssignee = task.assignee?._id === currentUserId;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl transition border border-gray-100">
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${task.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : task.status === 'review' ? 'bg-purple-500 border-purple-500 text-white' : 'border-gray-300'}`}>
        {task.status === 'completed' && <FaCheck className="text-[8px]" />}
        {task.status === 'review' && <FaCheckCircle className="text-[8px]" />}
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onFeedback && onFeedback(task)}>
        <div className="flex items-center flex-wrap gap-1.5">
          <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</p>
          <TaskPriorityBadge priority={task.priority} />
          <TaskStatusBadge status={task.status} />
          {progress > 0 && progress < 100 && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{progress}%</span>}
        </div>
        <div className="flex items-center flex-wrap gap-3 text-xs text-gray-400 mt-0.5">
          {task.assignee && <span className="flex items-center gap-1"><FaUserCheck className="text-[10px]" /> {task.assignee.name || 'Unknown'}</span>}
          {task.dueDate && <span className="flex items-center gap-1"><FaCalendarAlt className="text-[10px]" /> {formatDate(task.dueDate)}</span>}
        </div>
        {progress > 0 && progress < 100 && (
          <div className="mt-1.5 w-full max-w-[200px] h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: brandColor }} />
          </div>
        )}
      </div>
      <div className="relative">
        <button onClick={e => { e.stopPropagation(); setMenu(!menu); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><FaEllipsisV className="text-xs" /></button>
        {menu && (
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[160px] z-10 py-1">
            <button onClick={e => { e.stopPropagation(); setMenu(false); onEdit && onEdit(task); }} className="flex items-center gap-2 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 w-full"><FaEdit className="text-xs" /> Edit</button>
            {isAssignee && task.status !== 'completed' && (
              <button onClick={e => { e.stopPropagation(); setMenu(false); onUpdateProgress && onUpdateProgress(task); }} className="flex items-center gap-2 px-4 py-1.5 text-sm text-blue-600 hover:bg-blue-50 w-full"><FaChartLine className="text-xs" /> Update Progress</button>
            )}
            {canManage && task.status !== 'completed' && (
              <button onClick={e => { e.stopPropagation(); setMenu(false); onApproveCompletion && onApproveCompletion(task); }} className="flex items-center gap-2 px-4 py-1.5 text-sm text-green-600 hover:bg-green-50 w-full"><FaCheckCircle className="text-xs" /> Approve Completion</button>
            )}
            <button onClick={e => { e.stopPropagation(); setMenu(false); onFeedback && onFeedback(task); }} className="flex items-center gap-2 px-4 py-1.5 text-sm text-blue-600 hover:bg-blue-50 w-full"><FaHistory className="text-xs" /> Feedback</button>
            {canManage && <button onClick={e => { e.stopPropagation(); setMenu(false); onDelete && onDelete(task._id); }} className="flex items-center gap-2 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 w-full"><FaTrashAlt className="text-xs" /> Delete</button>}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Create Task Modal (unchanged) ────────────────────────────────────
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

  const handleFile = (e) => { setAttachments([...attachments, ...Array.from(e.target.files)]); e.target.value = ''; };
  const removeFile = (i) => setAttachments(attachments.filter((_, idx) => idx !== i));

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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

// ─── Edit Task Modal (unchanged) ──────────────────────────────────────
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

  const handleFile = (e) => { setAttachments([...attachments, ...Array.from(e.target.files)]); e.target.value = ''; };
  const removeNew = (i) => setAttachments(attachments.filter((_, idx) => idx !== i));
  const removeExisting = (i) => setExistingAttachments(existingAttachments.filter((_, idx) => idx !== i));

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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

// ─── Progress Update Modal (unchanged) ────────────────────────────────
const ProgressUpdateModal = ({ isOpen, onClose, task, brandColor, onSuccess }) => {
  const [progress, setProgress] = useState(task?.progress || 0);
  const [notes, setNotes] = useState('');
  const [links, setLinks] = useState('');
  const [loading, setLoading] = useState(false);
  const [updateTaskProgress] = useUpdateTaskProgressMutation();

  const submit = async (e) => {
    e.preventDefault();
    if (progress < 0 || progress > 100) { toast.error('0-100 only'); return; }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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

// ─── Add Member Modal (unchanged) ─────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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

// ─── Feedback Modal (unchanged) ────────────────────────────────────────
const FeedbackModal = ({ isOpen, onClose, task, brandColor }) => {
  const { data: feedbackData, isLoading } = useGetTaskFeedbackQuery({ taskId: task?._id }, { skip: !isOpen || !task });
  if (!isOpen) return null;
  const list = feedbackData?.feedback || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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

// ─── New WhatsApp‑like Task List Item ──────────────────────────────────
const TaskListItem = ({ task, isActive, onClick, brandColor }) => {
  const progress = task.progress || 0;
  const lastActivity = task.status === 'completed' ? 'Completed' : task.status === 'review' ? 'In review' : task.status === 'in-progress' ? `${progress}% done` : 'Pending';
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left border-b border-gray-100 ${
        isActive ? 'bg-gray-100' : ''
      }`}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-lg"
        style={{ backgroundColor: brandColor }}
      >
        {task.title.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900 truncate">{task.title}</h4>
          <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">{formatDate(task.dueDate) !== 'N/A' ? formatDate(task.dueDate) : ''}</span>
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

// ─── Chat Bubble Component (always shows progress) ────────────────────
const ChatBubble = ({ message, isOwn, brandColor }) => {
  const user = message.user || {};
  const avatarChar = user.name ? user.name.charAt(0).toUpperCase() : '?';
  return (
    <div className={`flex gap-2 mb-4 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: isOwn ? brandColor : '#CBD5E0' }}
      >
        {user.profile ? (
          <img src={user.profile} className="w-full h-full rounded-full object-cover" />
        ) : (
          avatarChar
        )}
      </div>
      <div className={`max-w-[85%] md:max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-2.5 rounded-2xl shadow-sm break-words overflow-hidden ${
            isOwn ? 'text-white rounded-br-md' : 'bg-white border border-gray-200 rounded-bl-md'
          }`}
          style={isOwn ? { backgroundColor: brandColor } : {}}
        >
          {!isOwn && (
            <p className="text-xs font-medium text-gray-700 mb-1">
              {user.name || 'Unknown'}
            </p>
          )}
          <div className="flex items-center gap-1 text-xs font-medium">
            <FaPercent className="text-[10px]" />
            <span>Progress: {message.progress}%</span>
          </div>
          {message.notes && (
            <p className="text-sm mt-1 whitespace-pre-wrap break-words">
              {message.notes}
            </p>
          )}
          {message.links?.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {message.links.map((l, i) => (
                <a
                  key={i}
                  href={l}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline break-all"
                  style={{ color: isOwn ? 'white' : brandColor }}
                >
                  {l}
                </a>
              ))}
            </div>
          )}
          <span className="text-[10px] mt-1.5 block opacity-70 text-right">
            {formatDateTime(message.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Task Detail View (assignee‑only progress button) ─────────────────
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
  const [showMenu, setShowMenu] = useState(false);
  const isAssignee = task.assignee?._id === userInfo?._id;

  return (
    <div className="flex flex-col h-full overflow-x-hidden">
      {/* Compact header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-white sticky top-0 z-10">
        <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg md:hidden">
          <FaArrowLeft className="text-gray-500 text-sm" />
        </button>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-base flex-shrink-0"
          style={{ backgroundColor: brandColor }}
        >
          {task.title.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-gray-900 truncate">{task.title}</h2>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            {task.assignee && (
              <span className="flex items-center gap-1 truncate">
                <FaUserCheck className="text-[10px]" /> {task.assignee.name}
              </span>
            )}
          </div>
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <FaEllipsisV className="text-sm" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[140px] z-20 py-1">
              {canManage && (
                <button
                  onClick={() => { setShowMenu(false); onApproveCompletion(task); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50 w-full"
                >
                  <FaCheckCircle className="text-xs" /> Approve
                </button>
              )}
              <button
                onClick={() => { setShowMenu(false); onEdit(task); }}
                className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 w-full"
              >
                <FaEdit className="text-xs" /> Edit
              </button>
              {canManage && (
                <button
                  onClick={() => { setShowMenu(false); onDelete(task._id); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                >
                  <FaTrashAlt className="text-xs" /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:py-6 bg-[#efeae2] md:bg-gray-50">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div
              className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderTopColor: brandColor }}
            />
          </div>
        ) : feedbackList.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FaCommentDots className="text-3xl mx-auto mb-3" />
            <p className="text-sm">No feedback yet</p>
          </div>
        ) : (
          feedbackList.map((item, idx) => (
            <ChatBubble
              key={idx}
              message={item}
              isOwn={item.user?._id === userInfo?._id}
              brandColor={brandColor}
            />
          ))
        )}
      </div>

      {/* Bottom action bar – only for the assignee */}
      {isAssignee && (
        <div className="border-t bg-white px-3 py-1.5 flex-shrink-0">
          <button
            onClick={() => onUpdateProgress(task)}
            className="w-full py-1.5 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
            style={{ backgroundColor: brandColor }}
          >
            <FaChartLine className="text-sm" /> Update Progress
          </button>
        </div>
      )}
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

  const brandColor = workspace?.color || '#4F46E5';
  const isOwner = workspace?.owner?._id === userInfo?._id || workspace?.owner === userInfo?._id;
  const isManager = project?.projectManagers?.some(pm => pm._id === userInfo?._id || pm === userInfo?._id);
  const canManage = isOwner || isManager;

  const activeTask = useMemo(() => tasks.find(t => t._id === selectedTaskId) || null, [tasks, selectedTaskId]);

  const progress = project?.progress || 0;
  const projectManagers = project?.projectManagers || [];

  if (wErr || pErr) { navigate(`/my-workspace/${workspaceId}/projects`); return null; }
  if (wLoad || pLoad || tLoad) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: brandColor }} /></div>;
  if (!workspace || !project) return null;

  const handleDeleteTask = async (id) => {
    if (!confirm('Delete task?')) return;
    try { await deleteTask(id).unwrap(); toast.success('Deleted'); refetchTasks(); refetchProject(); if (selectedTaskId === id) setSelectedTaskId(null); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
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

  const availableForManager = workspace.members?.filter(m => m.status === 'active' && !projectManagers.some(pm => pm._id === (m.user?._id || m._id))) || [];
  const managerOptions = availableForManager.map(m => {
    const u = m.user || m;
    return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" /> : <FaUser className="text-gray-400" /> };
  });

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      <div className="hidden md:block md:w-64 md:min-h-screen">
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      <div className="flex-1 flex flex-col md:flex-row h-screen overflow-hidden bg-white">
        {/* Left Panel – Task/Team list */}
        <div className={`${mobileShowDetail ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 border-r border-gray-200 h-full`}>
          <div className="px-4 py-3 border-b bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <button onClick={() => navigate(`/my-workspace/${workspaceId}/projects`)} className="p-2 hover:bg-gray-100 rounded-lg"><FaArrowLeft className="text-gray-500" /></button>
                <div className="flex items-center gap-2">
                  {project.coverImage ? <img src={project.coverImage} className="w-10 h-10 rounded-full object-cover" /> : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}><FaFolder className="text-xl" style={{ color: brandColor }} /></div>
                  )}
                  <div><h1 className="text-lg font-bold text-gray-900">{project.name}</h1><p className="text-xs text-gray-500">{activeTeam.length} members · {progress}% done</p></div>
                </div>
              </div>
              {canManage && <button onClick={() => setShowCreateTask(true)} className="p-2 text-white rounded-full" style={{ backgroundColor: brandColor }}><FaPlus /></button>}
            </div>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button onClick={() => setListView('tasks')} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${listView === 'tasks' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>Tasks ({tasks.length})</button>
              <button onClick={() => setListView('team')} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${listView === 'team' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>Team ({activeTeam.length})</button>
            </div>
            <div className="mt-2 relative">
              <FaSearch className="absolute left-3 top-2.5 text-gray-400 text-xs" />
              <input type="text" placeholder={listView === 'tasks' ? 'Search tasks...' : 'Search members...'} className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:border-transparent" style={{ '--tw-ring-color': brandColor }} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {listView === 'tasks' ? (
              tasks.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><FaTasks className="text-3xl mx-auto mb-3" /><p className="text-sm">No tasks yet</p></div>
              ) : (
                tasks.map(task => <TaskListItem key={task._id} task={task} isActive={selectedTaskId === task._id} onClick={() => handleTaskClick(task._id)} brandColor={brandColor} />)
              )
            ) : (
              <div className="py-2">
                <div className="px-4 py-2">
                  <div className="flex justify-between items-center"><span className="text-xs font-semibold text-gray-500 uppercase"><FaCrown className="inline mr-1" /> Managers</span>{isOwner && <button onClick={() => setShowAddManager(true)} className="text-xs text-white px-2 py-0.5 rounded" style={{ backgroundColor: brandColor }}>Add</button>}</div>
                  {projectManagers.map(m => (
                    <div key={m._id} className="flex items-center gap-3 py-2">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: brandColor }}>{m.profile ? <img src={m.profile} className="w-full h-full rounded-full object-cover" /> : m.name?.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{m.name}</p><p className="text-xs text-gray-400 truncate">{m.email}</p></div>
                      {isOwner && projectManagers.length > 1 && <button onClick={() => handleRemoveManager(m._id)} className="p-1 text-red-400"><FaUserMinus className="text-sm" /></button>}
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 border-t">
                  <div className="flex justify-between items-center"><span className="text-xs font-semibold text-gray-500 uppercase"><FaUsers className="inline mr-1" /> Active Team ({activeTeam.length})</span>{canManage && <button onClick={() => setShowAddMember(true)} className="text-xs text-white px-2 py-0.5 rounded" style={{ backgroundColor: brandColor }}>Add</button>}</div>
                  {activeTeam.map(m => {
                    const user = m.user || m;
                    const memberId = user._id;
                    return (
                      <div key={memberId} className="flex items-center gap-3 py-2">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: brandColor }}>{user.profile ? <img src={user.profile} className="w-full h-full rounded-full object-cover" /> : user.name?.charAt(0).toUpperCase()}</div>
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{user.name || 'Unknown'}</p><p className="text-xs text-gray-400 truncate">{user.email}</p></div>
                        {canManage && <button onClick={() => handleRemoveMember(memberId)} className="p-1 text-red-400"><FaUserMinus className="text-sm" /></button>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel – Task Detail */}
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
                <FaCommentDots className="text-5xl mx-auto mb-4" style={{ color: brandColor, opacity: 0.3 }} />
                <p className="text-lg font-medium">Select a task to view details</p>
                <p className="text-sm mt-1">Feedback and updates will appear here like a chat</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {!mobileShowDetail && <MyWorkspaceBottombar workspace={workspace} />}

      {/* Modals */}
      <CreateTaskModal isOpen={showCreateTask} onClose={() => setShowCreateTask(false)} projectId={projectId} brandColor={brandColor} assignableMembers={assignableMembers} onSuccess={() => { refetchTasks(); refetchProject(); }} />
      <EditTaskModal isOpen={showEditTask} onClose={() => { setShowEditTask(false); setSelectedTask(null); }} task={selectedTask} brandColor={brandColor} assignableMembers={assignableMembers} onSuccess={() => { refetchTasks(); refetchProject(); }} />
      <ProgressUpdateModal isOpen={showProgress} onClose={() => { setShowProgress(false); setSelectedTask(null); }} task={selectedTask} brandColor={brandColor} onSuccess={() => { refetchTasks(); refetchProject(); }} />
      <AddMemberModal isOpen={showAddMember} onClose={() => setShowAddMember(false)} workspace={workspace} project={project} brandColor={brandColor} onSuccess={refetchProject} />
      {showAddManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between mb-4"><h2 className="text-xl font-bold">Add Manager</h2><button onClick={() => setShowAddManager(false)}><FaTimes /></button></div>
            <CustomDropdown label="Select Member" options={managerOptions} value="" onChange={(v) => v && handleAddManager(v)} brandColor={brandColor} />
            <div className="flex gap-3 mt-4"><button onClick={() => setShowAddManager(false)} className="flex-1 py-2 border rounded-lg">Cancel</button></div>
          </div>
        </div>
      )}
      <FeedbackModal isOpen={showFeedback} onClose={() => { setShowFeedback(false); setFeedbackTask(null); }} task={feedbackTask} brandColor={brandColor} />
    </div>
  );
};

export default MyWorkspaceProjectId;
// src/components/YourWorkspaceProjectTaskId.jsx
import React, { useState } from 'react';
import {
  FaArrowLeft, FaTasks, FaPlus, FaEdit, FaTrashAlt,
  FaCalendarAlt, FaClock, FaFolder, FaEllipsisV,
  FaCheck, FaCheckDouble, FaTimes, FaUserPlus,
  FaBell, FaUser, FaAngleDown, FaRegClock,
  FaGripVertical, FaRedo, FaCheckCircle
} from 'react-icons/fa';
import {
  TaskStatusBadge,
  TaskPriorityBadge,
  CustomDropdown,
  ConfirmModal,
  RejectReasonModal,
  MarkCompleteModal,
  ConfirmCompletionModal,
  formatDateTime,
} from './ProjectHelpers';
import {
  useAddSubTaskMutation,
  useMarkSubTaskDoneMutation,
  useConfirmSubTaskMutation,
  useRejectSubTaskMutation,
  useDeleteSubTaskMutation,
} from '../slices/taskApiSlice';
import toast from 'react-hot-toast';

// ─── SubTaskItem ──────────────────────────────────────────────────────
const SubTaskItem = React.memo(({
  subTask,
  index,
  taskId,
  isAssignee,
  canManage,
  onRefresh,
  brandColor,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDragLeave,
  dragOver,
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

  const handleRejectClick = () => setShowRejectModal(true);

  const handleRejectConfirm = async (reason) => {
    setUpdating(true);
    try {
      await rejectSub({ taskId, subTaskIndex: index, reason }).unwrap();
      toast.success('Sub‑task rejected');
      onRefresh();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setUpdating(false); }
  };

  const handleDelete = () => {
    if (canManage || isAssignee) {
      setShowDeleteModal(true);
    }
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
    pending: { label: 'Pending', color: 'text-gray-400' },
    done: { label: 'Done', color: 'text-blue-500' },
    confirmed: { label: 'Confirmed', color: 'text-green-500' },
  };
  const st = statusMap[subTask.status] || statusMap.pending;

  const handleDragStart = (e) => {
    if (!draggable) {
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
        draggable={draggable}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={onDragLeave}
        className={`flex flex-col py-2 border-b border-gray-100 dark:border-gray-800/20 last:border-0 transition-colors ${
          dragOver ? 'bg-teal-50/50 dark:bg-[#0d9488]/5 border-teal-500 dark:border-[#0d9488]' : ''
        }`}
      >
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {draggable && (
                <FaGripVertical className="text-gray-300 dark:text-gray-700 text-xs flex-shrink-0 cursor-grab" />
              )}
              <span className="text-sm font-medium text-gray-800 dark:text-gray-300 truncate max-w-[140px] md:max-w-[200px]">{subTask.title}</span>
              <span className={`text-[10px] font-medium ${st.color}`}>{st.label}</span>
              {subTask.dueDate && new Date(subTask.dueDate) < new Date() && subTask.status !== 'confirmed' && (
                <span className="text-[10px] text-red-500 dark:text-red-400 flex items-center gap-1"><FaClock className="text-[8px]" /> Overdue</span>
              )}
            </div>
            {subTask.description && <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{subTask.description}</p>}
            {subTask.dueDate && <p className="text-[10px] text-gray-500 dark:text-gray-500 flex items-center gap-1"><FaRegClock className="text-xs" /> {formatDateTime(subTask.dueDate)}</p>}
          </div>
          {hasDetails && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition flex-shrink-0"
            >
              <FaAngleDown className={`text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1 mt-1 sm:mt-0 sm:ml-auto sm:flex-nowrap">
          {isAssignee && subTask.status === 'pending' && (
            <button onClick={handleMarkDone} disabled={updating} className="p-1 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition">
              <FaCheck className="text-xs" />
            </button>
          )}
          {canManage && subTask.status === 'done' && (
            <>
              <button onClick={handleConfirmClick} disabled={updating} className="p-1 text-green-500 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition">
                <FaCheckDouble className="text-xs" />
              </button>
              <button onClick={handleRejectClick} disabled={updating} className="p-1 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition">
                <FaTimes className="text-xs" />
              </button>
            </>
          )}
          {(isAssignee && subTask.status !== 'confirmed') || canManage ? (
            <button onClick={handleDelete} disabled={updating} className="p-1 text-red-400 dark:text-red-400/60 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition">
              <FaTrashAlt className="text-xs" />
            </button>
          ) : null}
        </div>

        {isExpanded && (
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-1 bg-gray-50 dark:bg-[#1a1a24] p-3 rounded-xl border border-gray-200 dark:border-gray-800/40 w-full overflow-hidden">
            {subTask.notes && <div><span className="font-medium text-gray-700 dark:text-gray-300">Notes:</span> {subTask.notes}</div>}
            {subTask.links && subTask.links.length > 0 && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Links:</span>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {subTask.links.map((l, i) => (
                    <React.Fragment key={i}>
                      <a
                        href={l}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-600 dark:text-[#0d9488] underline hover:text-teal-700 dark:hover:text-[#14b8a6] break-all"
                      >
                        {l}
                      </a>
                      {i < subTask.links.length - 1 && <span className="text-gray-400 dark:text-gray-500">,</span>}
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
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-[#0d9488] underline hover:text-teal-700 dark:hover:text-[#14b8a6] break-all">
                        {att.name || 'file'}
                      </a>
                      {i < subTask.attachments.length - 1 && <span className="text-gray-400 dark:text-gray-500">,</span>}
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

        {showDoneForm && (
          <div className="mt-2 bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-gray-800/60 rounded-xl p-3 w-full">
            <textarea
              placeholder="Add notes (optional)"
              value={doneNotes}
              onChange={(e) => setDoneNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none mb-2"
            />
            <textarea
              placeholder="Links (one per line)"
              value={doneLinks}
              onChange={(e) => setDoneLinks(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none mb-2"
            />
            <div className="flex items-center gap-2 mb-2">
              <input
                type="file"
                multiple
                onChange={(e) => setDoneFiles([...e.target.files])}
                className="text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-teal-50 dark:file:bg-[#0d9488]/20 file:text-teal-600 dark:file:text-[#0d9488]"
              />
              {doneFiles.length > 0 && <span className="text-xs text-gray-500 dark:text-gray-500">{doneFiles.length} file(s)</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={submitDone} disabled={updating} className="px-3 py-1.5 bg-teal-600 dark:bg-[#0d9488] text-white text-xs rounded-lg hover:bg-teal-700 dark:hover:bg-[#0f9e96] transition">
                {updating ? 'Saving...' : 'Submit Done'}
              </button>
              <button onClick={cancelDone} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                Cancel
              </button>
            </div>
          </div>
        )}

        {showConfirmForm && (
          <div className="mt-2 bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-gray-800/60 rounded-xl p-3 w-full">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Assignee submitted:</p>
            {subTask.notes && <div className="text-xs text-gray-600 dark:text-gray-400 mb-1"><span className="font-medium text-gray-700 dark:text-gray-300">Notes:</span> {subTask.notes}</div>}
            {subTask.links && subTask.links.length > 0 && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span className="font-medium text-gray-700 dark:text-gray-300">Links:</span>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {subTask.links.map((l, i) => (
                    <React.Fragment key={i}>
                      <a href={l} target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-[#0d9488] underline break-all">{l}</a>
                      {i < subTask.links.length - 1 && <span className="text-gray-400 dark:text-gray-500">,</span>}
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
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-[#0d9488] underline break-all">{att.name || 'file'}</a>
                      {i < subTask.attachments.length - 1 && <span className="text-gray-400 dark:text-gray-500">,</span>}
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
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none mb-2"
            />
            <div className="flex gap-2">
              <button onClick={submitConfirm} disabled={updating} className="px-3 py-1.5 bg-green-600 dark:bg-green-700 text-white text-xs rounded-lg hover:bg-green-700 dark:hover:bg-green-800 transition">
                {updating ? 'Confirming...' : 'Confirm'}
              </button>
              <button onClick={cancelConfirm} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <RejectReasonModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={(reason) => handleRejectConfirm(reason)}
      />

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

// ─── TaskDetailView ────────────────────────────────────────────────────
const TaskDetailView = React.memo(({
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
  onMarkComplete,
  onSetReadyForCompletion,
  subDragStart,
  subDragEnd,
  subDragOver,
  subDrop,
  subDragLeave,
  subDragOverIndex,
}) => {
  const isAssignee = task.assignee?._id === userInfo?._id;
  const [showMenu, setShowMenu] = useState(false);
  const [addSubTaskOpen, setAddSubTaskOpen] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [newSubTaskStart, setNewSubTaskStart] = useState('');
  const [newSubTaskDue, setNewSubTaskDue] = useState('');
  const [adding, setAdding] = useState(false);
  const [addSubTask] = useAddSubTaskMutation();

  const [showMarkCompleteModal, setShowMarkCompleteModal] = useState(false);
  const [showConfirmCompletionModal, setShowConfirmCompletionModal] = useState(false);

  const hasRecurrence = task.recurrenceType && task.recurrenceType !== 'none';
  const recurrenceLabel = task.recurrenceType === 'daily' ? 'Daily' : task.recurrenceType === 'weekly' ? 'Weekly' : '';

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

  const canReorderSub = canManage || (isAssignee && task.allowAssigneeEditSubtasks);
  const isReadOnly = task.isArchived || task.isTrash || false;

  const handleMarkCompleteClick = () => setShowMarkCompleteModal(true);

  const handleMarkCompleteSubmit = async ({ notes }) => {
    try {
      await onMarkComplete(notes);
      setShowMarkCompleteModal(false);
    } catch (err) {}
  };

  const handleConfirmCompletionClick = () => setShowConfirmCompletionModal(true);

  const handleConfirmCompletionSubmit = async (data) => {
    try {
      await onConfirmCompletion(data);
      setShowConfirmCompletionModal(false);
    } catch (err) {}
  };

  const handleSetReadyClick = () => onSetReadyForCompletion(task);

  const showFinalDetails = task.status === 'confirmed_completed';
  const finalDetails = showFinalDetails ? (
    <div className="mt-4 bg-gray-50 dark:bg-[#1a1a24] p-3 rounded-xl border border-gray-200 dark:border-gray-800/40 space-y-1">
      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Final Details</p>
      {task.completionFeedback && <div><span className="font-medium text-gray-600 dark:text-gray-400">Feedback:</span> {task.completionFeedback}</div>}
      {task.actualHours !== undefined && task.actualHours !== null && <div><span className="font-medium text-gray-600 dark:text-gray-400">Actual Hours:</span> {task.actualHours}</div>}
      {task.finalLinks && task.finalLinks.length > 0 && (
        <div>
          <span className="font-medium text-gray-600 dark:text-gray-400">Final Links:</span>
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            {task.finalLinks.map((l, i) => (
              <React.Fragment key={i}>
                <a href={l} target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-[#0d9488] underline break-all">{l}</a>
                {i < task.finalLinks.length - 1 && <span className="text-gray-400 dark:text-gray-500">,</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
      {task.finalAttachments && task.finalAttachments.length > 0 && (
        <div>
          <span className="font-medium text-gray-600 dark:text-gray-400">Final Attachments:</span>
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            {task.finalAttachments.map((att, i) => (
              <React.Fragment key={i}>
                <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-[#0d9488] underline break-all">{att.name || 'file'}</a>
                {i < task.finalAttachments.length - 1 && <span className="text-gray-400 dark:text-gray-500">,</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : null;

  const showSetReady = canManage && !isReadOnly &&
    task.status !== 'ready_for_completion' &&
    task.status !== 'completed' &&
    task.status !== 'confirmed_completed';

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-[#0f0f12]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-[#14141a]/80 backdrop-blur-sm flex-shrink-0 sticky top-0 z-10">
        <button onClick={onBack} className="p-1 md:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"><FaArrowLeft /></button>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: brandColor }}
        >
          {task.title.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[180px] md:max-w-full">{task.title}</h2>
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            {hasRecurrence && (
              <span className="flex items-center gap-0.5 text-teal-600 dark:text-[#0d9488]">
                <FaRedo className="text-[10px]" /> {recurrenceLabel}
              </span>
            )}
            {task.assignee && <span className="text-gray-600 dark:text-gray-400 truncate max-w-[80px] md:max-w-[120px]">{task.assignee.name}</span>}
            {task.folder && <span className="text-gray-600 dark:text-gray-400 truncate flex items-center gap-1"><FaFolder className="text-xs" /> {task.folder.name}</span>}
          </div>
        </div>
        <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition">
          <FaEllipsisV className="text-sm" />
        </button>
        {showMenu && (
          <div className="absolute right-4 top-12 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-800/60 rounded-xl min-w-[150px] z-20 py-1 shadow-lg">
            {canManage && !isReadOnly && (
              <button onClick={() => { setShowMenu(false); onSendReminder(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 w-full transition">
                <FaBell className="text-xs" /> Send Reminder
              </button>
            )}
            {!isReadOnly && (
              <button onClick={() => { setShowMenu(false); onEdit(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 w-full transition">
                <FaEdit className="text-xs" /> Edit
              </button>
            )}
            {canManage && !isReadOnly && (
              <button onClick={() => { setShowMenu(false); onDelete(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 w-full transition">
                <FaTrashAlt className="text-xs" /> Delete
              </button>
            )}
            {canManage && !task.assignee && !isReadOnly && (
              <button onClick={() => { setShowMenu(false); onAssignTask(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-teal-600 dark:text-[#0d9488] hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 w-full transition">
                <FaUserPlus className="text-xs" /> Assign Task
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress & Stats */}
      <div className="bg-white dark:bg-[#14141a] border-b border-gray-200/60 dark:border-gray-800/40 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">Progress</span>
          <span className="text-gray-600 dark:text-gray-400">{progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800/60 rounded-full mt-1 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, backgroundColor: brandColor, boxShadow: `0 0 12px ${brandColor}66` }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-500">
          <span>{confirmed}/{total} sub‑tasks confirmed</span>
          {task.dueDate && (
            <span className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && task.status !== 'completed' && task.status !== 'confirmed_completed' ? 'text-red-500 dark:text-red-400' : ''}`}>
              <FaCalendarAlt className="text-[10px]" /> Due: {formatDateTime(task.dueDate)}
            </span>
          )}
        </div>
        {finalDetails}
      </div>

      {/* Sub‑tasks area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-24 md:pb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <FaTasks className="text-teal-600 dark:text-[#0d9488]" /> Sub‑tasks
          </h3>
          {!isReadOnly && ((isAssignee && task.allowAssigneeEditSubtasks) || canManage) && (
            <button onClick={() => setAddSubTaskOpen(!addSubTaskOpen)} className="text-xs text-teal-600 dark:text-[#0d9488] font-medium flex items-center gap-1 hover:text-teal-700 dark:hover:text-[#14b8a6] transition">
              <FaPlus className="text-xs" /> Add
            </button>
          )}
        </div>

        {addSubTaskOpen && (
          <div className="bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-gray-800/60 rounded-xl p-3 mb-3 w-full">
            <input
              type="text"
              placeholder="Sub‑task title"
              value={newSubTaskTitle}
              onChange={(e) => setNewSubTaskTitle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none mb-2"
            />
            <input
              type="datetime-local"
              placeholder="Start date & time"
              value={newSubTaskStart}
              onChange={(e) => setNewSubTaskStart(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none mb-2"
            />
            <input
              type="datetime-local"
              placeholder="Due date & time"
              value={newSubTaskDue}
              onChange={(e) => setNewSubTaskDue(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none mb-2"
            />
            <div className="flex gap-2">
              <button onClick={() => setAddSubTaskOpen(false)} className="flex-1 py-1.5 border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={handleAddSubTask} disabled={adding} className="flex-1 py-1.5 text-white rounded-lg text-sm transition" style={{ backgroundColor: brandColor }}>
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {(task.subTasks || []).length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-500 text-sm">No sub‑tasks yet</div>
        ) : (
          (task.subTasks || []).map((st, idx) => {
            const isDragOver = subDragOverIndex === idx;
            return (
              <SubTaskItem
                key={idx}
                subTask={st}
                index={idx}
                taskId={task._id}
                isAssignee={isAssignee}
                canManage={canManage}
                onRefresh={onRefresh}
                brandColor={brandColor}
                draggable={canReorderSub && !isReadOnly}
                onDragStart={subDragStart}
                onDragEnd={subDragEnd}
                onDragOver={subDragOver}
                onDrop={subDrop}
                onDragLeave={subDragLeave}
                dragOver={isDragOver}
              />
            );
          })
        )}
      </div>

      {/* Bottom action bar */}
      <div className="border-t border-gray-200/60 dark:border-gray-800/40 bg-white dark:bg-[#14141a] px-3 py-2 flex-shrink-0 sticky bottom-0 space-y-2">
        {showSetReady && (
          <button
            onClick={handleSetReadyClick}
            className="w-full py-2 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition hover:opacity-80"
            style={{ backgroundColor: brandColor }}
          >
            <FaCheckCircle className="text-sm" /> Set Ready for Completion
          </button>
        )}
        {isAssignee && !isReadOnly && task.status === 'ready_for_completion' && (
          <button
            onClick={handleMarkCompleteClick}
            className="w-full py-2 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition hover:opacity-80"
            style={{ backgroundColor: brandColor }}
          >
            <FaCheckDouble className="text-sm" /> Mark as Complete
          </button>
        )}
        {!isReadOnly && canManage && task.status === 'completed' && task.status !== 'confirmed_completed' && (
          <button
            onClick={handleConfirmCompletionClick}
            className="w-full py-2 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition hover:opacity-80"
            style={{ backgroundColor: brandColor }}
          >
            <FaCheckDouble className="text-sm" /> Confirm Completion
          </button>
        )}
        {!showSetReady && !(isAssignee && task.status === 'ready_for_completion') && !(canManage && task.status === 'completed' && task.status !== 'confirmed_completed') && (
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            {task.status === 'confirmed_completed' ? 'Task confirmed' : 'No actions available'}
          </p>
        )}
      </div>

      {/* Modals */}
      <MarkCompleteModal
        isOpen={showMarkCompleteModal}
        onClose={() => setShowMarkCompleteModal(false)}
        task={task}
        brandColor={brandColor}
        onSubmit={handleMarkCompleteSubmit}
      />
      <ConfirmCompletionModal
        isOpen={showConfirmCompletionModal}
        onClose={() => setShowConfirmCompletionModal(false)}
        task={task}
        brandColor={brandColor}
        onSubmit={handleConfirmCompletionSubmit}
      />
    </div>
  );
});

export default TaskDetailView;
// src/workspaceComponents/MyWorkspaceProjectTaskId.jsx
import React, { useState, useEffect } from 'react';
import {
  FaArrowLeft, FaTasks, FaPlus, FaEdit, FaTrashAlt,
  FaCalendarAlt, FaClock, FaFolder, FaEllipsisV,
  FaCheck, FaCheckDouble, FaTimes, FaUserPlus,
  FaBell, FaUser, FaAngleDown, FaRegClock,
  FaGripVertical, FaRedo, FaCheckCircle, FaArchive,
  FaCopy, FaUndo
} from 'react-icons/fa';
import {
  TaskStatusBadge,
  TaskPriorityBadge,
  CustomDropdown,
  ConfirmModal,
  MarkCompleteModal,
  ConfirmCompletionModal,
  SubTaskItem,
  formatDateTime,
  formatTaskTitle,
} from './ProjectHelpers';
import { useAddSubTaskMutation } from '../slices/taskApiSlice';
import toast from 'react-hot-toast';

const MyWorkspaceProjectTaskId = ({
  task,
  brandColor,
  userInfo,
  onBack,
  onEdit,
  onDelete,
  onRefresh,
  canManage,
  onSendReminder,
  // ─── Renamed to match parent ────────────────────────────
  onMarkCompleteClick,          // <-- was onMarkComplete
  onConfirmCompletionClick,     // <-- was onConfirmCompletion
  onReject,
  onAssignTask,
  onSetReadyForCompletion,
  onArchiveTask,
  onUnarchiveTask,
  onPermanentDelete,
  onCopyClick,
  onMoveClick,
  isReadOnly: isReadOnlyProp,
  subDragStart,
  subDragEnd,
  subDragOver,
  subDrop,
  subDragLeave,
  subDragOverIndex,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [addSubTaskOpen, setAddSubTaskOpen] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [newSubTaskStart, setNewSubTaskStart] = useState('');
  const [newSubTaskDue, setNewSubTaskDue] = useState('');
  const [newSubTaskRecurrenceType, setNewSubTaskRecurrenceType] = useState('none');
  const [newSubTaskRecurrenceDays, setNewSubTaskRecurrenceDays] = useState([]);
  const [newSubTaskRecurrenceEndDate, setNewSubTaskRecurrenceEndDate] = useState('');
  const [addingSubTask, setAddingSubTask] = useState(false);
  const [addSubTask] = useAddSubTaskMutation();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const [showMarkCompleteModal, setShowMarkCompleteModal] = useState(false);
  const [showConfirmCompletionModal, setShowConfirmCompletionModal] = useState(false);

  // ─── Collapsible states for submission & rejection ──────────────
  const [submissionExpanded, setSubmissionExpanded] = useState(false);
  const [rejectionExpanded, setRejectionExpanded] = useState(false);

  // Auto‑expand rejection if data exists
  useEffect(() => {
    if (task.rejectedBy && task.rejectedAt) {
      setRejectionExpanded(true);
    }
  }, [task.rejectedBy, task.rejectedAt]);

  const isAssignee = task.assignee?._id === userInfo?._id;
  const hasRecurrence = task.recurrenceType && task.recurrenceType !== 'none';
  const recurrenceLabel = task.recurrenceType === 'daily' ? 'Daily' : task.recurrenceType === 'weekly' ? 'Weekly' : '';

  // Read‑only if explicitly passed or task is archived
  const isReadOnly = isReadOnlyProp || task.isArchived || false;

  // ─── Submission / Rejection data flags ──────────────────────────
  const hasSubmissionData = task.completionNotes ||
    (task.finalLinks && task.finalLinks.length > 0) ||
    (task.finalAttachments && task.finalAttachments.length > 0) ||
    task.completedBy;

  const showRejection = task.rejectedBy && task.rejectedAt;
  const hasRejectionData = task.rejectedBy || task.rejectionReason;

  // ─── Self‑assigned check ────────────────────────────────────────
  const isSelfAssigned = task.assignee?._id === userInfo?._id && task.createdBy?._id === userInfo?._id;

  const handleAddSubTask = async () => {
    if (!newSubTaskTitle.trim()) { toast.error('Sub‑task title required'); return; }
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
      await addSubTask({ taskId: task._id, data: payload }).unwrap();
      toast.success('Sub‑task added');
      setNewSubTaskTitle('');
      setNewSubTaskStart('');
      setNewSubTaskDue('');
      setNewSubTaskRecurrenceType('none');
      setNewSubTaskRecurrenceDays([]);
      setNewSubTaskRecurrenceEndDate('');
      setAddSubTaskOpen(false);
      onRefresh();
    } catch (err) { toast.error(err?.data?.message || 'Failed to add sub‑task'); }
    finally { setAddingSubTask(false); }
  };

  const progress = task.progress || 0;
  const total = task.subTasks?.length || 0;
  const confirmed = (task.subTasks || []).filter(st => st.status === 'confirmed').length || 0;

  const canReorderSub = !isReadOnly && (canManage || (isAssignee && task.allowAssigneeEditSubtasks));

  // ─── Bottom action bar conditions ──────────────────────────────
  const showSetReady = canManage && !isReadOnly &&
    task.status !== 'ready_for_completion' &&
    task.status !== 'completed' &&
    task.status !== 'confirmed_completed';

  const showMarkComplete = isAssignee && !isReadOnly && task.status === 'ready_for_completion';

  // ✅ Allow self‑assigned users to confirm as well
  const showConfirmCompletion = !isReadOnly && 
    (canManage || isSelfAssigned) && 
    task.status === 'completed';

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800/60 bg-white/80 dark:bg-[#14141a]/80 backdrop-blur-sm flex-shrink-0 sticky top-0 z-10">
        <button onClick={onBack} className="p-1 md:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"><FaArrowLeft /></button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: brandColor }}>{task.title.charAt(0).toUpperCase()}</div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[180px] md:max-w-full">{formatTaskTitle(task.title)}</h2>
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            {hasRecurrence && (<span className="flex items-center gap-0.5 text-teal-600 dark:text-[#0d9488]"><FaRedo className="text-[10px]" /> {recurrenceLabel}</span>)}
            {task.assignee && <span className="text-gray-500 dark:text-gray-400 truncate max-w-[80px] md:max-w-[120px]">{task.assignee.name}</span>}
            {task.isArchived && (<span className="text-orange-600 dark:text-orange-400 flex items-center gap-1"><FaArchive className="text-[10px]" /> Archived</span>)}
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaEllipsisV className="text-sm" /></button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-800/60 rounded-xl min-w-[180px] z-20 py-1 shadow-lg">
              {canManage && !task.isArchived && !isReadOnly && (
                <>
                  <button onClick={() => { setShowMenu(false); onSendReminder(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/10 w-full transition"><FaBell className="text-xs" /> Send Reminder</button>
                  <button onClick={() => { setShowMenu(false); onCopyClick(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 w-full transition"><FaCopy className="text-xs" /> Copy Task</button>
                  <button onClick={() => { setShowMenu(false); onMoveClick(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 w-full transition"><FaFolder className="text-xs" /> Move Task</button>
                  <button onClick={() => { setShowMenu(false); onArchiveTask(task._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 w-full transition"><FaArchive className="text-xs" /> Archive</button>
                  <button onClick={() => { setShowMenu(false); onDelete(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-500/10 w-full transition"><FaTrashAlt className="text-xs" /> Move to Trash</button>
                </>
              )}
              {canManage && task.isArchived && (
                <>
                  <button onClick={() => { setShowMenu(false); onUnarchiveTask(task._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/10 w-full transition"><FaUndo className="text-xs" /> Unarchive</button>
                  <button onClick={() => { setShowMenu(false); onPermanentDelete(task._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 w-full transition"><FaTrashAlt className="text-xs" /> Delete Permanently</button>
                </>
              )}
              <button onClick={() => { setShowMenu(false); onEdit(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/10 w-full transition"><FaEdit className="text-xs" /> Edit</button>
              {canManage && !task.assignee && !task.isArchived && !isReadOnly && (
                <button onClick={() => { setShowMenu(false); onAssignTask(task); }} className="flex items-center gap-2 px-4 py-2 text-sm text-[#0d9488] hover:bg-[#0d9488]/10 w-full transition"><FaUserPlus className="text-xs" /> Assign Task</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress & Stats */}
      <div className="bg-white dark:bg-[#14141a] border-b border-gray-200 dark:border-gray-800/40 px-4 py-3">
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

        {/* ─── SUBMISSION DETAILS ────────────────────────────────── */}
        {hasSubmissionData && (
          <div className="mt-2">
            <button
              onClick={() => setSubmissionExpanded(!submissionExpanded)}
              className="flex items-center justify-between w-full text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/30 px-2 py-1.5 rounded-lg transition"
            >
              <span className="flex items-center gap-1.5">
                <FaCheckDouble className="text-teal-500 text-[10px]" />
                Submission Details
              </span>
              <FaAngleDown className={`text-gray-400 dark:text-gray-500 transition-transform text-[10px] ${submissionExpanded ? 'rotate-180' : ''}`} />
            </button>
            {submissionExpanded && (
              <div className="mt-1 bg-gray-50 dark:bg-[#1a1a24] p-3 rounded-xl border border-gray-200 dark:border-gray-800/40 space-y-1 text-xs">
                {task.completionNotes && (
                  <div className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Notes:</span> {task.completionNotes}
                  </div>
                )}
                {task.finalLinks && task.finalLinks.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Links:</span>
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
                    <span className="font-medium text-gray-700 dark:text-gray-300">Attachments:</span>
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
                {task.completedBy && (
                  <div className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Submitted by:</span> {task.completedBy.name || 'Unknown'} on {formatDateTime(task.completedAt)}
                  </div>
                )}
                {task.status === 'confirmed_completed' && task.completionFeedback && (
                  <div className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Confirmation feedback:</span> {task.completionFeedback}
                  </div>
                )}
                {task.status === 'confirmed_completed' && task.actualHours !== undefined && task.actualHours !== null && (
                  <div className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Actual hours:</span> {task.actualHours}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── REJECTION DETAILS ────────────────────────────────── */}
        {showRejection && hasRejectionData && (
          <div className="mt-2">
            <button
              onClick={() => setRejectionExpanded(!rejectionExpanded)}
              className="flex items-center justify-between w-full text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 px-2 py-1.5 rounded-lg transition"
            >
              <span className="flex items-center gap-1.5">
                <FaTimes className="text-[10px]" />
                Task Rejected
              </span>
              <FaAngleDown className={`text-gray-400 dark:text-gray-500 transition-transform text-[10px] ${rejectionExpanded ? 'rotate-180' : ''}`} />
            </button>
            {rejectionExpanded && (
              <div className="mt-1 bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-200 dark:border-red-800/30 space-y-1 text-xs">
                {task.rejectedBy && (
                  <div className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Rejected by:</span> {task.rejectedBy.name || 'Unknown'} on {formatDateTime(task.rejectedAt)}
                  </div>
                )}
                {task.rejectionReason && (
                  <div className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Reason:</span> {task.rejectionReason}
                  </div>
                )}
                {/* Show submitted data inside rejection for context */}
                {task.completionNotes && (
                  <div className="text-gray-600 dark:text-gray-400 pt-1 border-t border-red-200 dark:border-red-800/30">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Submitted notes:</span> {task.completionNotes}
                  </div>
                )}
                {task.finalLinks && task.finalLinks.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Submitted links:</span>
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
                    <span className="font-medium text-gray-700 dark:text-gray-300">Submitted attachments:</span>
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
            )}
          </div>
        )}
      </div>

      {/* Sub‑tasks area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-24 md:pb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2"><FaTasks className="text-[#0d9488]" /> Sub‑tasks</h3>
          {!isReadOnly && ((isAssignee && task.allowAssigneeEditSubtasks) || canManage) && (
            <button onClick={() => setAddSubTaskOpen(!addSubTaskOpen)} className="text-xs text-[#0d9488] font-medium flex items-center gap-1 hover:text-[#14b8a6] transition"><FaPlus className="text-xs" /> Add</button>
          )}
        </div>

        {addSubTaskOpen && (
          <div className="bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-gray-800/60 rounded-xl p-3 mb-3 w-full space-y-2">
            <input type="text" placeholder="Sub‑task title" value={newSubTaskTitle} onChange={(e) => setNewSubTaskTitle(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-[#0d9488] outline-none" onKeyDown={(e) => e.key === 'Enter' && handleAddSubTask()} />
            <input type="datetime-local" placeholder="Start date & time" value={newSubTaskStart} onChange={(e) => setNewSubTaskStart(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
            <input type="datetime-local" placeholder="Due date & time" value={newSubTaskDue} onChange={(e) => setNewSubTaskDue(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recurrence</label>
              <select value={newSubTaskRecurrenceType} onChange={(e) => { setNewSubTaskRecurrenceType(e.target.value); if (e.target.value !== 'weekly') setNewSubTaskRecurrenceDays([]); }} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none">
                <option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
              </select>
            </div>
            {newSubTaskRecurrenceType === 'weekly' && (
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Repeat on</label><div className="flex flex-wrap gap-2">{weekDays.map((day, idx) => (<button key={idx} type="button" onClick={() => { if (newSubTaskRecurrenceDays.includes(idx)) setNewSubTaskRecurrenceDays(newSubTaskRecurrenceDays.filter(d => d !== idx)); else setNewSubTaskRecurrenceDays([...newSubTaskRecurrenceDays, idx].sort()); }} className={`px-3 py-1 rounded-full text-xs font-medium transition ${newSubTaskRecurrenceDays.includes(idx) ? 'bg-[#0d9488] text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>{day}</button>))}</div></div>
            )}
            {(newSubTaskRecurrenceType === 'daily' || newSubTaskRecurrenceType === 'weekly') && (<div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date (optional)</label><input type="datetime-local" value={newSubTaskRecurrenceEndDate} onChange={(e) => setNewSubTaskRecurrenceEndDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" /></div>)}
            <div className="flex gap-2">
              <button onClick={() => { setAddSubTaskOpen(false); setNewSubTaskTitle(''); setNewSubTaskStart(''); setNewSubTaskDue(''); setNewSubTaskRecurrenceType('none'); setNewSubTaskRecurrenceDays([]); setNewSubTaskRecurrenceEndDate(''); }} className="flex-1 py-1.5 border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={handleAddSubTask} disabled={addingSubTask} className="flex-1 py-1.5 text-white rounded-lg text-sm transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{addingSubTask ? 'Adding...' : 'Add'}</button>
            </div>
          </div>
        )}

        {(task.subTasks || []).length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-500 text-sm">No sub‑tasks yet</div>
        ) : (
          (task.subTasks || []).map((st, idx) => {
            const isDragOverSub = subDragOverIndex === idx;
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
                readOnly={isReadOnly}
                onDragStart={canReorderSub ? subDragStart : null}
                onDragOver={canReorderSub ? subDragOver : null}
                onDrop={canReorderSub ? subDrop : null}
                onDragLeave={subDragLeave}
                onDragEnd={canReorderSub ? subDragEnd : null}
                dragOver={isDragOverSub}
              />
            );
          })
        )}
      </div>

      {/* Bottom action bar */}
      {!isReadOnly && (
        <div className="border-t border-gray-200 dark:border-gray-800/40 bg-white dark:bg-[#14141a] px-3 py-2 flex-shrink-0 sticky bottom-0 space-y-2">
          {showSetReady && (
            <button onClick={onSetReadyForCompletion} className="w-full py-2 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition hover:opacity-80" style={{ backgroundColor: brandColor }}>
              <FaCheckCircle className="text-sm" /> Set Ready for Completion
            </button>
          )}
          {showMarkComplete && (
            <button onClick={() => setShowMarkCompleteModal(true)} className="w-full py-2 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition hover:opacity-80" style={{ backgroundColor: brandColor }}>
              <FaCheckDouble className="text-sm" /> Mark as Complete
            </button>
          )}
          {showConfirmCompletion && (
            <button onClick={() => setShowConfirmCompletionModal(true)} className="w-full py-2 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition hover:opacity-80" style={{ backgroundColor: brandColor }}>
              <FaCheckDouble className="text-sm" /> Confirm Completion
            </button>
          )}
          {!showSetReady && !showMarkComplete && !showConfirmCompletion && (
            <p className="text-center text-xs text-gray-500 dark:text-gray-400">
              {task.status === 'confirmed_completed' ? 'Task confirmed' : 'No actions available'}
            </p>
          )}
        </div>
      )}

      {/* ─── Modals ────────────────────────────────────────────── */}
      <MarkCompleteModal
        isOpen={showMarkCompleteModal}
        onClose={() => setShowMarkCompleteModal(false)}
        task={task}
        brandColor={brandColor}
        onSubmit={onMarkCompleteClick}   // <-- corrected
      />
      <ConfirmCompletionModal
        isOpen={showConfirmCompletionModal}
        onClose={() => setShowConfirmCompletionModal(false)}
        task={task}
        brandColor={brandColor}
        onSubmit={onConfirmCompletionClick}   // <-- corrected
        onReject={onReject}
      />
    </div>
  );
};

export default MyWorkspaceProjectTaskId;
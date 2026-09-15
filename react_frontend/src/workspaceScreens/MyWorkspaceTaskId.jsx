// src/workspaceScreens/MyWorkspaceTaskId.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  FaArrowLeft, FaTasks, FaPlus, FaEdit, FaTrashAlt, FaCalendarAlt,
  FaFolder, FaEllipsisV, FaCheck, FaCheckDouble, FaTimes, FaUserPlus,
  FaBell, FaAngleDown, FaRegClock, FaGripVertical, FaRedo,
  FaCheckCircle, FaArchive, FaCopy, FaUndo, FaExclamationTriangle,
  FaExclamationCircle, FaCommentDots, FaListUl, FaSpinner,
} from 'react-icons/fa';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetProjectByIdQuery } from '../slices/projectApiSlice';
import {
  useGetTaskByIdQuery,
  useGetProjectTasksQuery,
  useGetTaskFeedbackQuery,
  useGetProjectFoldersQuery,
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
  useCopyTaskMutation,
  useMoveTaskMutation,
  useArchiveTaskMutation,
  useRestoreTaskMutation,
  usePermanentlyDeleteTaskMutation,
} from '../slices/taskApiSlice';
import {
  MarkCompleteModal,
  ConfirmCompletionModal,
  DeleteTaskConfirmModal,
  FolderSelectModal,
  EditTaskForm,
  AssignForm,
  ConfirmModal,
  SubTaskItem,
  TaskStatusBadge,
  TaskPriorityBadge,
  formatDateTime,
  formatTaskTitle,
} from '../workspaceComponents/ProjectHelpers';

const fmtDateTime = (d) => (!d ? 'N/A' : new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
const fmtDate = (d) => (!d ? 'N/A' : new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

const isUserInArray = (arr, userId) =>
  (arr || []).some((a) => (a?._id || a)?.toString() === userId?.toString());

// ─── Task summary block (shared) ───────────────────────────────
const TaskSummary = ({ task, brandColor, submissionExpanded, setSubmissionExpanded, rejectionExpanded, setRejectionExpanded, hasSubmissionData, showRejection, isOverdue }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 text-xs">
      {task.dueDate && (
        <div>
          <div className="text-gray-500 dark:text-gray-500 mb-0.5 flex items-center gap-1"><FaCalendarAlt /> Due</div>
          <div className={`font-medium break-words ${isOverdue ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>{fmtDateTime(task.dueDate)}</div>
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

    {task.description && (
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-500 mb-1">Description</div>
        <p className="text-sm text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap leading-relaxed">{task.description}</p>
      </div>
    )}

    {task.links?.length > 0 && (
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-500 mb-1.5">Links</div>
        <div className="space-y-1">
          {task.links.map((l, i) => (
            <a key={i} href={l} target="_blank" rel="noreferrer" className="block text-xs text-teal-600 dark:text-[#0d9488] underline break-all">{l}</a>
          ))}
        </div>
      </div>
    )}

    {task.attachments?.length > 0 && (
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-500 mb-1.5">Attachments</div>
        <div className="space-y-1">
          {task.attachments.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block text-xs text-teal-600 dark:text-[#0d9488] underline break-all">{a.name || 'file'}</a>
          ))}
        </div>
      </div>
    )}

    {hasSubmissionData && (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800/60 bg-gray-50 dark:bg-[#1a1a24] overflow-hidden">
        <button onClick={() => setSubmissionExpanded(!submissionExpanded)} className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-300">
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

// ─── Screen ─────────────────────────────────────────────────────
const MyWorkspaceTaskId = () => {
  const { workspaceId, projectId, taskId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((s) => s.auth);

  const { data: wData } = useGetWorkspaceQuery(workspaceId);
  const { data: pData, isLoading: pLoad } = useGetProjectByIdQuery(projectId);
  const { data: foldersData } = useGetProjectFoldersQuery(projectId);
  const { data: tData, isLoading: tLoad, error: tErr, refetch: refetchTask } = useGetTaskByIdQuery(taskId, { skip: !taskId });
  const { data: feedbackData } = useGetTaskFeedbackQuery({ taskId }, { skip: !taskId });
  const { refetch: refetchTasksList } = useGetProjectTasksQuery({ projectId }, { skip: !projectId });

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
  const [copyTask] = useCopyTaskMutation();
  const [moveTask] = useMoveTaskMutation();
  const [archiveTask] = useArchiveTaskMutation();
  const [restoreTask] = useRestoreTaskMutation();
  const [permanentlyDeleteTask] = usePermanentlyDeleteTaskMutation();

  const workspace = wData?.workspace;
  const project = pData?.project;
  const task = tData?.task;
  const brandColor = workspace?.color || '#0d9488';

  const isOwner = useMemo(() => {
    const oid = workspace?.owner?._id || workspace?.owner;
    return !!oid && oid === userInfo?._id;
  }, [workspace, userInfo]);
  const isManager = useMemo(() => project?.projectManagers?.some((pm) => (pm._id || pm)?.toString() === userInfo?._id), [project, userInfo]);
  const canManage = isOwner || isManager;

  const isAssignee = isUserInArray(task?.assignees, userInfo?._id);
  const isReadOnly = task?.isArchived || task?.isTrash || false;
  const hasAssignees = (task?.assignees || []).length > 0;

  const activeTeam = useMemo(() => (project?.teamMembers || []).filter((m) => m.status === 'active'), [project]);
  const assignableMembers = useMemo(() => {
    if (!project) return [];
    const mgrs = project.projectManagers || [];
    const all = [...activeTeam, ...mgrs.map((pm) => ({ user: pm }))];
    const seen = new Set();
    return all.filter((item) => {
      const id = item.user?._id || item.user;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [activeTeam, project?.projectManagers]);

  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showMarkComplete, setShowMarkComplete] = useState(false);
  const [showConfirmCompletion, setShowConfirmCompletion] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubStart, setNewSubStart] = useState('');
  const [newSubDue, setNewSubDue] = useState('');
  const [addingSub, setAddingSub] = useState(false);
  const [expandedSub, setExpandedSub] = useState(null);
  const [submissionExpanded, setSubmissionExpanded] = useState(false);
  const [rejectionExpanded, setRejectionExpanded] = useState(!!task?.rejectedBy);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [folderActionModal, setFolderActionModal] = useState({ isOpen: false, mode: 'copy', task: null });

  useEffect(() => { if (task?.rejectedBy) setRejectionExpanded(true); }, [task?.rejectedBy]);

  useEffect(() => {
    if (!taskId || tErr) navigate(`/my-workspace/${workspaceId}/project/${projectId}`, { replace: true });
  }, [taskId, tErr, navigate, workspaceId, projectId]);

  const refresh = useCallback(() => { refetchTask(); refetchTasksList(); }, [refetchTask, refetchTasksList]);

  const handleAddSubTask = async () => {
    if (!newSubTitle.trim()) { toast.error('Title required'); return; }
    setAddingSub(true);
    try {
      await addSubTask({ taskId: task._id, data: { title: newSubTitle.trim(), startDate: newSubStart || null, dueDate: newSubDue || null } }).unwrap();
      toast.success('Sub-task added');
      setNewSubTitle(''); setNewSubStart(''); setNewSubDue(''); setAddSubOpen(false);
      refresh();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    finally { setAddingSub(false); }
  };

  const handleMarkComplete = useCallback(async (data) => {
    try {
      const fd = new FormData();
      fd.append('notes', data.notes || '');
      if (data.links) data.links.forEach((l) => fd.append('links', l));
      if (data.attachments) data.attachments.forEach((f) => fd.append('completionAttachments', f));
      await markTaskCompleted({ taskId: task._id, data: fd }).unwrap();
      toast.success(canManage ? 'Task completed & confirmed' : 'Task submitted, awaiting confirmation');
      refresh(); setShowMarkComplete(false);
    } catch (err) { toast.error(err?.data?.message || 'Failed'); throw err; }
  }, [task, markTaskCompleted, refresh, canManage]);

  const handleConfirmCompletion = useCallback(async (data) => {
    try {
      const fd = new FormData();
      fd.append('feedback', data.feedback || '');
      if (data.finalHours !== undefined) fd.append('finalHours', data.finalHours.toString());
      if (data.finalLinks) data.finalLinks.forEach((l) => fd.append('finalLinks', l));
      if (data.finalAttachments) data.finalAttachments.forEach((f) => fd.append('finalAttachments', f));
      await confirmTaskCompletion({ taskId: task._id, data: fd }).unwrap();
      toast.success('Task completion confirmed');
      refresh(); setShowConfirmCompletion(false);
    } catch (err) { toast.error(err?.data?.message || 'Failed'); throw err; }
  }, [task, confirmTaskCompletion, refresh]);

  const handleRejectTask = useCallback(async (id, reason) => {
    try {
      await rejectTask({ taskId: id, reason }).unwrap();
      toast.success('Task rejected'); refresh(); setShowConfirmCompletion(false);
    } catch (err) { toast.error(err?.data?.message || 'Failed'); throw err; }
  }, [rejectTask, refresh]);

  const handleAssign = useCallback(async (ids) => {
    try {
      await assignTask({ taskId: task._id, assigneeIds: ids, assigneeId: ids[0] || '' }).unwrap();
      toast.success('Assigned'); refresh(); setShowAssign(false);
    } catch (err) { toast.error(err?.data?.message || 'Failed'); }
  }, [assignTask, task, refresh]);

  const handleReminder = useCallback(async () => {
    try { await sendManualReminder({ taskId: task._id, message: '' }).unwrap(); toast.success('Reminder sent'); }
    catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [sendManualReminder, task]);

  const handleArchive = async () => {
    try { await archiveTask(task._id).unwrap(); toast.success('Archived'); refresh(); }
    catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };
  const handleUnarchive = async () => {
    try { await restoreTask(task._id).unwrap(); toast.success('Restored'); refresh(); }
    catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };
  const handlePermanentDelete = async () => {
    try { await permanentlyDeleteTask(task._id).unwrap(); toast.success('Permanently deleted'); navigate(`/my-workspace/${workspaceId}/project/${projectId}`); }
    catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };
  const handleDeleteTask = async () => {
    try { await deleteTask(task._id).unwrap(); toast.success('Moved to trash'); navigate(`/my-workspace/${workspaceId}/project/${projectId}`); }
    catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };

  const handleFolderAction = async (taskIdArg, targetFolderId) => {
    try {
      if (folderActionModal.mode === 'copy') { await copyTask({ taskId: taskIdArg, targetFolderId }).unwrap(); toast.success('Copied'); }
      else { await moveTask({ taskId: taskIdArg, targetFolderId }).unwrap(); toast.success('Moved'); refresh(); }
      setFolderActionModal({ isOpen: false, mode: 'copy', task: null });
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };

  const canReorderSub = (canManage || (isAssignee && task?.allowAssigneeEditSubtasks)) && !isReadOnly;
  const onSubDrop = useCallback(async (e, targetIdx) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    const di = raw !== '' ? parseInt(raw, 10) : draggedIdx;
    setDragOverIdx(null);
    if (di === null || di === undefined || Number.isNaN(di) || di === targetIdx) return;
    const subtasks = task.subTasks || [];
    const indices = subtasks.map((_, i) => i);
    const [moved] = indices.splice(di, 1);
    indices.splice(targetIdx, 0, moved);
    setDraggedIdx(null);
    try { await reorderSubTasks({ taskId: task._id, orderedSubTaskIndices: indices }).unwrap(); refresh(); }
    catch (err) { toast.error(err?.data?.message || 'Failed to reorder'); }
  }, [draggedIdx, task, reorderSubTasks, refresh]);

  const goBack = () => navigate(`/my-workspace/${workspaceId}/project/${projectId}`);

  if (!taskId || tErr) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]"><div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (pLoad || tLoad || !task || !project || !workspace) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]"><div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: brandColor }} /></div>;
  }

  const progress = task.progress || 0;
  const subTasks = task.subTasks || [];
  const confirmedCount = subTasks.filter((s) => s.status === 'confirmed').length;
  const hasRecurrence = task.recurrenceType && task.recurrenceType !== 'none';
  const hasSubmissionData = task.completionNotes || task.finalLinks?.length || task.finalAttachments?.length || task.completedBy;
  const showRejection = task.rejectedBy && task.rejectedAt;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !['completed', 'confirmed_completed', 'cancelled'].includes(task.status);

  const showMarkCompleteBtn = !isReadOnly && task.status === 'ready_for_completion' && (isAssignee || canManage);
  const showConfirmCompletionBtn = !isReadOnly && canManage && task.status === 'completed';

  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-white/90 dark:bg-[#14141a]/90 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/60 z-20">
        <div className="px-3 lg:px-6 py-2.5 lg:py-3 flex items-center gap-2 lg:gap-3">
          <button onClick={goBack} className="p-1.5 -ml-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition shrink-0">
            <FaArrowLeft className="text-sm" />
          </button>
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: brandColor }}>
            {task.title.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm lg:text-base font-semibold text-gray-800 dark:text-gray-100 truncate">{formatTaskTitle(task.title)}</h2>
            <div className="flex items-center gap-1.5 text-[11px] flex-wrap mt-0.5 text-gray-500 dark:text-gray-400">
              <TaskStatusBadge status={task.status} />
              <span className="font-mono">{confirmedCount}/{subTasks.length} done</span>
              {task.dueDate && (
                <>
                  <span className="hidden sm:inline">·</span>
                  <span className={isOverdue ? 'text-red-500 font-medium' : ''}>{fmtDate(task.dueDate)}</span>
                </>
              )}
              {hasRecurrence && (
                <>
                  <span className="hidden sm:inline">·</span>
                  <span className="text-teal-600 dark:text-[#0d9488] flex items-center gap-0.5"><FaRedo className="text-[9px]" /> {task.recurrenceType === 'daily' ? 'Daily' : 'Weekly'}</span>
                </>
              )}
            </div>
          </div>

          {/* Desktop action button in header */}
          {showMarkCompleteBtn && (
            <button onClick={() => setShowMarkComplete(true)} className="hidden lg:flex shrink-0 px-3.5 py-2 text-white rounded-lg text-sm font-medium items-center gap-1.5 hover:opacity-90 transition" style={{ backgroundColor: brandColor }}>
              <FaCheckDouble className="text-xs" /> {canManage ? 'Mark as Complete & Confirm' : 'Mark as Complete'}
            </button>
          )}
          {showConfirmCompletionBtn && (
            <button onClick={() => setShowConfirmCompletion(true)} className="hidden lg:flex shrink-0 px-3.5 py-2 text-white rounded-lg text-sm font-medium items-center gap-1.5 hover:opacity-90 transition" style={{ backgroundColor: brandColor }}>
              <FaCheckCircle className="text-xs" /> Confirm Completion
            </button>
          )}

          <div className="relative shrink-0">
            <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition">
              <FaEllipsisV className="text-sm" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-800/60 rounded-xl min-w-[180px] z-30 py-1 shadow-lg">
                {canManage && !task.isArchived && !isReadOnly && (
                  <>
                    <button onClick={() => { setShowMenu(false); handleReminder(); }} className="flex items-center gap-2 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 w-full transition"><FaBell className="text-xs" /> Send Reminder</button>
                    <button onClick={() => { setShowMenu(false); setFolderActionModal({ isOpen: true, mode: 'copy', task }); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 w-full transition"><FaCopy className="text-xs" /> Copy Task</button>
                    <button onClick={() => { setShowMenu(false); setFolderActionModal({ isOpen: true, mode: 'move', task }); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 w-full transition"><FaFolder className="text-xs" /> Move Task</button>
                    <button onClick={() => { setShowMenu(false); handleArchive(); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 w-full transition"><FaArchive className="text-xs" /> Archive</button>
                    <button onClick={() => { setShowMenu(false); setDeleteConfirm(true); }} className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 w-full transition"><FaTrashAlt className="text-xs" /> Move to Trash</button>
                  </>
                )}
                {canManage && task.isArchived && (
                  <>
                    <button onClick={() => { setShowMenu(false); handleUnarchive(); }} className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 w-full transition"><FaUndo className="text-xs" /> Unarchive</button>
                    <button onClick={() => { setShowMenu(false); handlePermanentDelete(); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 w-full transition"><FaTrashAlt className="text-xs" /> Delete Permanently</button>
                  </>
                )}
                {!isReadOnly && (
                  <button onClick={() => { setShowMenu(false); setShowEdit(true); }} className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 w-full transition"><FaEdit className="text-xs" /> Edit</button>
                )}
                {canManage && !hasAssignees && !task.isArchived && !isReadOnly && (
                  <button onClick={() => { setShowMenu(false); setShowAssign(true); }} className="flex items-center gap-2 px-4 py-2 text-sm text-[#0d9488] hover:bg-[#0d9488]/10 w-full transition"><FaUserPlus className="text-xs" /> Assign Task</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Thin progress bar */}
        <div className="w-full h-0.5 bg-gray-200/60 dark:bg-gray-800/40">
          <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: brandColor }} />
        </div>
      </header>

      {/* Body */}
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
              isOverdue={isOverdue}
            />
          </div>
        </aside>

        {/* MIDDLE: Subtasks */}
        <main className="lg:h-full lg:overflow-y-auto">
          <div className="p-3 lg:p-6 space-y-4">
            {/* Mobile details accordion */}
            <div className="lg:hidden">
              <button onClick={() => setMobileDetailsOpen(!mobileDetailsOpen)} className="w-full flex items-center justify-between bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/40 px-3 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-2"><FaListUl className="text-[#0d9488] text-[11px]" /> Task details</span>
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
                    isOverdue={isOverdue}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <FaTasks className="text-[#0d9488]" /> Sub-tasks
                <span className="text-xs font-normal text-gray-500 dark:text-gray-500">({subTasks.length})</span>
              </h3>
              {!isReadOnly && ((isAssignee && task.allowAssigneeEditSubtasks) || canManage) && (
                <button onClick={() => setAddSubOpen(!addSubOpen)} className="text-xs text-[#0d9488] font-medium flex items-center gap-1 hover:text-[#14b8a6] transition px-2.5 py-1 rounded-lg hover:bg-[#0d9488]/10">
                  <FaPlus className="text-xs" /> Add
                </button>
              )}
            </div>

            {addSubOpen && (
              <div className="bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-gray-800/60 rounded-xl p-3 space-y-2">
                <input type="text" placeholder="Sub-task title" value={newSubTitle} onChange={(e) => setNewSubTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSubTask()} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm outline-none focus:border-[#0d9488] text-gray-800 dark:text-gray-200" autoFocus />
                <input type="datetime-local" value={newSubStart} onChange={(e) => setNewSubStart(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm outline-none text-gray-800 dark:text-gray-200" />
                <input type="datetime-local" value={newSubDue} onChange={(e) => setNewSubDue(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm outline-none text-gray-800 dark:text-gray-200" />
                <div className="flex gap-2">
                  <button onClick={() => { setAddSubOpen(false); setNewSubTitle(''); setNewSubStart(''); setNewSubDue(''); }} className="flex-1 py-1.5 border border-gray-300 dark:border-gray-700/60 rounded-lg text-sm text-gray-600 dark:text-gray-400">Cancel</button>
                  <button onClick={handleAddSubTask} disabled={addingSub} className="flex-1 py-1.5 text-white rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: brandColor }}>{addingSub ? 'Adding...' : 'Add'}</button>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/40 overflow-hidden">
              {subTasks.length === 0 ? (
                <div className="text-center py-10 text-gray-500 dark:text-gray-500 text-sm">No sub-tasks yet</div>
              ) : (
                subTasks.map((st, idx) => (
                  <SubTaskItem
                    key={idx}
                    subTask={st}
                    index={idx}
                    taskId={task._id}
                    isAssignee={isAssignee}
                    canManage={canManage}
                    onRefresh={refresh}
                    brandColor={brandColor}
                    readOnly={isReadOnly}
                    onDragStart={canReorderSub ? (e, i) => { setDraggedIdx(i); e.dataTransfer.setData('text/plain', String(i)); } : null}
                    onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                    onDragOver={canReorderSub ? (e, i) => { e.preventDefault(); if (draggedIdx !== null && draggedIdx !== i) setDragOverIdx(i); } : null}
                    onDrop={canReorderSub ? onSubDrop : null}
                    onDragLeave={() => setDragOverIdx(null)}
                    dragOver={dragOverIdx === idx}
                  />
                ))
              )}
            </div>

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

        {/* RIGHT (xl+): Activity */}
        <aside className="hidden xl:flex xl:flex-col xl:h-full xl:overflow-y-auto bg-white dark:bg-[#14141a] border-l border-gray-200/60 dark:border-gray-800/60">
          <div className="p-5">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <FaCommentDots className="text-[#0d9488]" /> Activity
            </h3>
            {feedbackData?.feedback?.length > 0 ? (
              <div className="space-y-2">
                {feedbackData.feedback.map((f) => (
                  <div key={f._id} className="text-xs bg-gray-50 dark:bg-[#1a1a24] p-3 rounded-xl border border-gray-200 dark:border-gray-800/40">
                    <span className="font-medium text-gray-700 dark:text-gray-300 break-words">{f.user?.name || 'Someone'}</span>
                    <p className="text-gray-500 dark:text-gray-500 break-words mt-1">{f.type?.replace('_', ' ')}</p>
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

      {/* Mobile bottom action bar */}
      {(showMarkCompleteBtn || showConfirmCompletionBtn) && (
        <div className="shrink-0 lg:hidden border-t border-gray-200/60 dark:border-gray-800/60 bg-white/95 dark:bg-[#14141a]/95 backdrop-blur-xl px-3 py-2.5 z-20">
          {showMarkCompleteBtn && (
            <button onClick={() => setShowMarkComplete(true)} className="w-full py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition" style={{ backgroundColor: brandColor }}>
              <FaCheckDouble className="text-sm" /> {canManage ? 'Mark as Complete & Confirm' : 'Mark as Complete'}
            </button>
          )}
          {showConfirmCompletionBtn && (
            <button onClick={() => setShowConfirmCompletion(true)} className="w-full py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition" style={{ backgroundColor: brandColor }}>
              <FaCheckCircle className="text-sm" /> Confirm Completion
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      {showEdit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaEdit className="inline mr-1 text-[#0d9488]" /> Edit Task</h2>
              <button onClick={() => setShowEdit(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <EditTaskForm task={task} brandColor={brandColor} assignableMembers={assignableMembers} folders={foldersData?.folders || []} onSuccess={() => { setShowEdit(false); refresh(); }} onCancel={() => setShowEdit(false)} />
          </div>
        </div>
      )}

      {showAssign && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaUserPlus className="inline mr-1 text-[#0d9488]" /> Assign Task</h2>
              <button onClick={() => setShowAssign(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <AssignForm assignableMembers={assignableMembers} onAssign={handleAssign} brandColor={brandColor} onCancel={() => setShowAssign(false)} currentAssignees={task.assignees || []} />
          </div>
        </div>
      )}

      <MarkCompleteModal isOpen={showMarkComplete} onClose={() => setShowMarkComplete(false)} task={task} brandColor={brandColor} onSubmit={handleMarkComplete} />
      <ConfirmCompletionModal isOpen={showConfirmCompletion} onClose={() => setShowConfirmCompletion(false)} task={task} brandColor={brandColor} onSubmit={handleConfirmCompletion} onReject={handleRejectTask} />
      <DeleteTaskConfirmModal isOpen={deleteConfirm} onClose={() => setDeleteConfirm(false)} onConfirm={handleDeleteTask} taskName={task.title} />
      <FolderSelectModal isOpen={folderActionModal.isOpen} onClose={() => setFolderActionModal({ isOpen: false, mode: 'copy', task: null })} folders={foldersData?.folders || []} mode={folderActionModal.mode} task={folderActionModal.task} onConfirm={handleFolderAction} brandColor={brandColor} />
    </div>
  );
};

export default MyWorkspaceTaskId;
// src/screens/MyWorkspaceProjectId.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  useGetProjectFoldersQuery,
  useCreateFolderMutation,
  useUpdateFolderMutation,
  useDeleteFolderMutation,
  useCopyTaskMutation,
  useMoveTaskMutation,
  useArchiveTaskMutation,
  useRestoreTaskMutation,
  usePermanentlyDeleteTaskMutation,
  useAddFolderReadOnlyMutation,
  useRemoveFolderReadOnlyMutation,
  useReorderTasksMutation,
  useReorderSubTasksMutation,
} from '../slices/taskApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
import { FaCommentDots, FaUser, FaEdit, FaTimes } from 'react-icons/fa';
import toast from 'react-hot-toast';

// ─── Import the four components ──────────────────────────────────────
import MyWorkspaceProjectTopBar from '../workspaceComponents/MyWorkspaceProjectTopBar';
import MyWorkspaceProjectTasks from '../workspaceComponents/MyWorkspaceProjectTasks';
import MyWorkspaceProjectTeam from '../workspaceComponents/MyWorkspaceProjectTeam';
import MyWorkspaceProjectTaskId from '../workspaceComponents/MyWorkspaceProjectTaskId';

// ─── Import helpers and modals ──────────────────────────────────────
import {
  ConfirmModal,
  DeleteTaskConfirmModal,
  FolderSelectModal,
  FolderAccessModal,
  CreateTaskForm,
  EditTaskForm,
  AddMemberForm,
  AssignForm,
  CustomDropdown,
  MarkCompleteModal,        // <-- add this
  ConfirmCompletionModal,
} from '../workspaceComponents/ProjectHelpers';

// ─── Main Component ────────────────────────────────────────────────────
const MyWorkspaceProjectId = () => {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  // ─── States ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('tasks');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTaskTarget, setAssignTaskTarget] = useState(null);
  const [addSubTaskOpen, setAddSubTaskOpen] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [newSubTaskStart, setNewSubTaskStart] = useState('');
  const [newSubTaskDue, setNewSubTaskDue] = useState('');
  const [newSubTaskRecurrenceType, setNewSubTaskRecurrenceType] = useState('none');
  const [newSubTaskRecurrenceDays, setNewSubTaskRecurrenceDays] = useState([]);
  const [newSubTaskRecurrenceEndDate, setNewSubTaskRecurrenceEndDate] = useState('');
  const [addingSubTask, setAddingSubTask] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, danger: false });
  const [deleteTaskModal, setDeleteTaskModal] = useState({ isOpen: false, taskName: '', onConfirm: () => {} });
  const [addManagerConfirm, setAddManagerConfirm] = useState({ isOpen: false, managerName: '', managerId: '' });
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRenameFolder, setShowRenameFolder] = useState(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [folderAccessModal, setFolderAccessModal] = useState({ isOpen: false, folder: null });
  const [folderActionModal, setFolderActionModal] = useState({ isOpen: false, mode: 'copy', task: null });
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [draggedOverTabId, setDraggedOverTabId] = useState(null);
  const [isDraggingSomething, setIsDraggingSomething] = useState(false);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [draggedSubIdx, setDraggedSubIdx] = useState(null);
  const [dragOverSubIdx, setDragOverSubIdx] = useState(null);
  const [leftWidthPercent, setLeftWidthPercent] = useState(35);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const containerRef = useRef(null);
  const isMd = useMediaQuery('(min-width: 768px)');

  const [showMarkCompleteModal, setShowMarkCompleteModal] = useState(false);
  const [showConfirmCompletionModal, setShowConfirmCompletionModal] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────
  const { data: wData, isLoading: wLoad, error: wErr } = useGetWorkspaceQuery(workspaceId);
  const { data: pData, isLoading: pLoad, error: pErr, refetch: refetchProject } = useGetProjectByIdQuery(projectId);
  const { data: tData, isLoading: tLoad, refetch: refetchTasks } = useGetProjectTasksQuery(
    { projectId, ...(activeFolderId ? { folderId: activeFolderId } : {}), archived: showArchived ? true : undefined },
    { skip: !projectId }
  );
  const { data: foldersData, isLoading: foldersLoading, refetch: refetchFolders } = useGetProjectFoldersQuery(projectId, { skip: !projectId });
  const { data: feedbackData } = useGetTaskFeedbackQuery({ taskId: selectedTaskId }, { skip: !selectedTaskId });

  // ── Mutations ───────────────────────────────────────────────────────
  const [deleteTask] = useDeleteTaskMutation();
  const [sendManualReminder] = useSendManualReminderMutation();
  const [confirmTaskCompletion] = useConfirmTaskCompletionMutation();
  const [assignTask] = useAssignTaskMutation();
  const [archiveTask] = useArchiveTaskMutation();
  const [restoreTask] = useRestoreTaskMutation();
  const [permanentlyDeleteTask] = usePermanentlyDeleteTaskMutation();
  const [copyTask] = useCopyTaskMutation();
  const [moveTask] = useMoveTaskMutation();
  const [createFolder] = useCreateFolderMutation();
  const [deleteFolder] = useDeleteFolderMutation();
  const [updateFolder] = useUpdateFolderMutation();
  const [addSubTask] = useAddSubTaskMutation();
  const [addFolderReadOnly] = useAddFolderReadOnlyMutation();
  const [removeFolderReadOnly] = useRemoveFolderReadOnlyMutation();
  const [removeTeamMember] = useRemoveTeamMemberMutation();
  const [manageProjectManagers] = useManageProjectManagersMutation();
  const [reorderTasks] = useReorderTasksMutation();
  const [reorderSubTasks] = useReorderSubTasksMutation();
  const [createTask] = useCreateTaskMutation();
  const [markTaskCompleted] = useMarkTaskCompletedMutation();
  const [updateTask] = useUpdateTaskMutation();

  // ─── Derived Data ─────────────────────────────────────────────────
  const workspace = wData?.workspace;
  const project = pData?.project;
  const folders = foldersData?.folders || [];
  const [localTasks, setLocalTasks] = useState([]);
  const [localFolders, setLocalFolders] = useState([]);

  useEffect(() => { setLocalTasks(tData?.tasks || []); }, [tData]);
  useEffect(() => { setLocalFolders(foldersData?.folders || []); }, [foldersData]);

  const tasks = localTasks;
  const visibleFolders = localFolders;

  const activeTeam = useMemo(() => (project?.teamMembers || []).filter(m => m.status === 'active'), [project?.teamMembers]);
  const assignableMembers = useMemo(() => {
    if (!project) return [];
    const mgrs = project.projectManagers || [];
    const all = [...activeTeam, ...mgrs.map(pm => ({ user: pm }))];
    const seen = new Set();
    const ownerId = workspace?.owner?._id || workspace?.owner;
    if (ownerId && !all.some(item => (item.user?._id || item.user) === ownerId)) {
      const ownerMember = workspace?.members?.find(m => (m.user?._id || m.user) === ownerId);
      if (ownerMember) all.push({ user: ownerMember.user || ownerMember });
      else all.push({ user: { _id: ownerId, name: 'Workspace Owner' } });
    }
    return all.filter(item => {
      const id = item.user?._id || item.user;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [activeTeam, project?.projectManagers, workspace?.owner, workspace?.members]);

  const brandColor = workspace?.color || '#0d9488';
  const isOwner = useMemo(() => workspace?.owner?._id === userInfo?._id || workspace?.owner === userInfo?._id, [workspace, userInfo]);
  const isManager = useMemo(() => project?.projectManagers?.some(pm => { const id = (pm._id || pm)?.toString(); return id === userInfo?._id; }), [project, userInfo]);
  const canManage = isOwner || isManager;

  const activeTask = useMemo(() => tasks.find(t => t._id === selectedTaskId) || null, [tasks, selectedTaskId]);
  const projectManagers = project?.projectManagers || [];
  const projectProgress = project?.progress || 0;

  const availableForManager = useMemo(() => workspace?.members?.filter(m => m.status === 'active' && !projectManagers.some(pm => pm._id === (m.user?._id || m._id))) || [], [workspace, projectManagers]);
  const managerOptions = useMemo(() => availableForManager.map(m => {
    const u = m.user || m;
    return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" /> : <FaUser className="text-gray-400" /> };
  }), [availableForManager]);

  const isFolderReadOnly = useCallback((folderId) => {
    if (canManage) return false;
    const hasAssigned = tasks.some(t => { const fid = t.folder?._id || t.folder; return fid === folderId && t.assignee?._id === userInfo?._id; });
    if (hasAssigned) return false;
    return visibleFolders.some(f => f._id === folderId);
  }, [canManage, tasks, userInfo, visibleFolders]);

  // ─── Handlers ────────────────────────────────────────────────────────
  const refreshAll = useCallback(() => { refetchTasks(); refetchProject(); }, [refetchTasks, refetchProject]);

  const handleCreateTaskOptimistic = useCallback(async (formData) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const optimisticTask = { _id: tempId, title: formData.title, description: formData.description || '', taskType: formData.taskType || 'general', priority: formData.priority || 'medium', status: 'pending', progress: 0, assignee: formData.assigneeId ? { _id: formData.assigneeId, name: 'Loading...' } : null, folder: formData.folderId ? { _id: formData.folderId, name: visibleFolders.find(f => f._id === formData.folderId)?.name || 'Folder' } : null, startDate: formData.startDate || null, dueDate: formData.dueDate || null, estimatedHours: formData.estimatedHours || 0, bufferTime: parseFloat(formData.bufferTime) || 0, allowAssigneeEditSubtasks: formData.allowAssigneeEditSubtasks || false, recurrenceType: formData.recurrenceType || 'none', recurrenceDays: formData.recurrenceDays || [], recurrenceEndDate: formData.recurrenceEndDate || null, links: formData.links || [], attachments: [], subTasks: [], isArchived: false, isTrash: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setLocalTasks(prev => [optimisticTask, ...prev]);
    try {
      const fd = new FormData();
      fd.append('projectId', formData.projectId);
      fd.append('title', formData.title);
      fd.append('description', formData.description);
      fd.append('taskType', formData.taskType);
      if (formData.assigneeId) fd.append('assigneeId', formData.assigneeId);
      fd.append('priority', formData.priority);
      if (formData.startDate) fd.append('startDate', new Date(formData.startDate).toISOString());
      if (formData.dueDate) fd.append('dueDate', new Date(formData.dueDate).toISOString());
      if (formData.estimatedHours) fd.append('estimatedHours', formData.estimatedHours);
      fd.append('bufferTime', formData.bufferTime);
      fd.append('links', JSON.stringify(formData.links || []));
      fd.append('allowAssigneeEditSubtasks', formData.allowAssigneeEditSubtasks);
      if (formData.folderId) fd.append('folderId', formData.folderId);
      if (formData.dailyReminderTime) fd.append('dailyReminderTime', formData.dailyReminderTime);
      fd.append('recurrenceType', formData.recurrenceType);
      if (formData.recurrenceType === 'weekly') { fd.append('recurrenceDays', JSON.stringify(formData.recurrenceDays)); }
      if (formData.recurrenceEndDate) fd.append('recurrenceEndDate', formData.recurrenceEndDate);
      formData.attachments?.forEach(file => fd.append('attachments', file));
      const result = await createTask(fd).unwrap();
      setLocalTasks(prev => prev.map(t => t._id === tempId ? result.task : t));
      refetchTasks(); refetchProject();
    } catch (err) {
      setLocalTasks(prev => prev.filter(t => t._id !== tempId));
      toast.error(err?.data?.message || 'Failed to create task');
      throw err;
    }
  }, [createTask, refetchTasks, refetchProject, visibleFolders]);

  const handleDeleteFolderOptimistic = useCallback(async (folderId) => {
    const folderToDelete = localFolders.find(f => f._id === folderId);
    if (!folderToDelete) return;
    setLocalFolders(prev => prev.filter(f => f._id !== folderId));
    if (activeFolderId === folderId) setActiveFolderId(null);
    try {
      await deleteFolder(folderId).unwrap();
      toast.success('Folder deleted');
      refetchFolders(); refetchTasks();
    } catch (err) {
      setLocalFolders(prev => [...prev, folderToDelete]);
      toast.error(err?.data?.message || 'Failed to delete folder');
    }
  }, [localFolders, deleteFolder, refetchFolders, refetchTasks, activeFolderId]);

  const handleDeleteTask = useCallback((task) => {
    setDeleteTaskModal({ isOpen: true, taskName: task.title, onConfirm: async () => {
      try { await deleteTask(task._id).unwrap(); toast.success('Task moved to trash'); refetchTasks(); refetchProject(); if (selectedTaskId === task._id) { setSelectedTaskId(null); setMobileShowDetail(false); } } catch (e) { toast.error(e?.data?.message || 'Failed'); }
    } });
  }, [deleteTask, refetchTasks, refetchProject, selectedTaskId]);

  const handleEditTask = useCallback((task) => { setSelectedTask(task); setShowEditTask(true); }, []);
  const handleRemoveMember = useCallback((id) => {
    setConfirmModal({ isOpen: true, title: 'Remove Member', message: 'Are you sure?', onConfirm: async () => { try { await removeTeamMember({ projectId, memberId: id }).unwrap(); toast.success('Removed'); refetchProject(); } catch (e) { toast.error(e?.data?.message || 'Failed'); } }, danger: true });
  }, [removeTeamMember, projectId, refetchProject]);

  const handleAddManager = useCallback((id, name) => setAddManagerConfirm({ isOpen: true, managerName: name, managerId: id }), []);
  const confirmAddManager = useCallback(async () => {
    try { await manageProjectManagers({ projectId, action: 'add', managerId: addManagerConfirm.managerId }).unwrap(); toast.success('Manager added'); refetchProject(); setAddManagerConfirm({ isOpen: false, managerName: '', managerId: '' }); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [manageProjectManagers, projectId, addManagerConfirm.managerId, refetchProject]);

  const handleRemoveManager = useCallback((id) => {
    setConfirmModal({ isOpen: true, title: 'Remove Manager', message: 'Are you sure?', onConfirm: async () => { try { await manageProjectManagers({ projectId, action: 'remove', managerId: id }).unwrap(); toast.success('Manager removed'); refetchProject(); } catch (e) { toast.error(e?.data?.message || 'Failed to remove manager'); } }, danger: true });
  }, [manageProjectManagers, projectId, refetchProject]);

  const handleTaskClick = useCallback((taskId) => { setSelectedTaskId(taskId); setMobileShowDetail(true); }, []);
  const handleBackToList = useCallback(() => { setSelectedTaskId(null); setMobileShowDetail(false); }, []);

  const handleSendManualReminder = useCallback(async (task) => {
    try { await sendManualReminder({ taskId: task._id, message: '' }).unwrap(); toast.success('Reminder sent'); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [sendManualReminder]);

  const handleMarkComplete = useCallback(async (notes) => {
    try { await markTaskCompleted({ taskId: activeTask._id, notes }).unwrap(); toast.success('Task marked as complete'); refreshAll(); } catch (err) { toast.error(err?.data?.message || 'Failed to mark task complete'); throw err; }
  }, [activeTask, markTaskCompleted, refreshAll]);

  const handleConfirmCompletion = useCallback(async (data) => {
    try {
      const fd = new FormData();
      fd.append('feedback', data.feedback || '');
      if (data.finalHours !== undefined) fd.append('finalHours', data.finalHours.toString());
      if (data.finalLinks) { data.finalLinks.forEach(l => fd.append('finalLinks', l)); }
      if (data.finalAttachments) { data.finalAttachments.forEach(f => fd.append('finalAttachments', f)); }
      await confirmTaskCompletion({ taskId: activeTask._id, data: fd }).unwrap();
      toast.success('Task completion confirmed');
      refreshAll();
    } catch (err) { toast.error(err?.data?.message || 'Failed to confirm completion'); throw err; }
  }, [activeTask, confirmTaskCompletion, refreshAll]);

  const handleSetReadyForCompletion = useCallback(async () => {
    const previousStatus = activeTask.status;
    setLocalTasks(prev => prev.map(t => t._id === activeTask._id ? { ...t, status: 'ready_for_completion' } : t));
    try {
      await updateTask({ taskId: activeTask._id, data: { status: 'ready_for_completion' } }).unwrap();
      toast.success('Task is now ready for completion');
      refreshAll();
    } catch (err) {
      setLocalTasks(prev => prev.map(t => t._id === activeTask._id ? { ...t, status: previousStatus } : t));
      toast.error(err?.data?.message || 'Failed to update task status');
    }
  }, [activeTask, updateTask, refreshAll]);

  const handleAssignTask = useCallback(async (assigneeId) => {
    try { await assignTask({ taskId: assignTaskTarget._id, assigneeId }).unwrap(); toast.success('Task assigned'); refetchTasks(); setShowAssignModal(false); setAssignTaskTarget(null); } catch (e) { throw e; }
  }, [assignTask, assignTaskTarget, refetchTasks]);

  const openAssignModal = useCallback((task) => { setAssignTaskTarget(task); setShowAssignModal(true); }, []);

  const handleArchiveTask = useCallback(async (taskId) => {
    try { await archiveTask(taskId).unwrap(); toast.success('Archived'); refetchTasks(); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [archiveTask, refetchTasks]);

  const handleUnarchiveTask = useCallback(async (taskId) => {
    try { await restoreTask(taskId).unwrap(); toast.success('Restored to active'); refetchTasks(); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [restoreTask, refetchTasks]);

  const handlePermanentDeleteTask = useCallback((taskId) => {
    setConfirmModal({ isOpen: true, title: 'Permanently Delete Task', message: 'This action cannot be undone. Are you sure?', confirmText: 'Delete Permanently', danger: true, onConfirm: async () => { try { await permanentlyDeleteTask(taskId).unwrap(); toast.success('Permanently deleted'); refetchTasks(); refetchProject(); if (selectedTaskId === taskId) { setSelectedTaskId(null); setMobileShowDetail(false); } } catch (e) { toast.error(e?.data?.message || 'Failed'); } } });
  }, [permanentlyDeleteTask, refetchTasks, refetchProject, selectedTaskId]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return toast.error('Folder name required');
    try {
      const result = await createFolder({ projectId, name: newFolderName.trim() }).unwrap();
      setLocalFolders(prev => [...prev, result.folder]);
      toast.success('Folder created');
      setNewFolderName('');
      setShowCreateFolder(false);
      refetchFolders();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [createFolder, projectId, newFolderName, refetchFolders]);

  const handleDeleteFolder = useCallback((folderId) => {
    setConfirmModal({ isOpen: true, title: 'Delete Folder', message: 'Deleting this folder will unlink its tasks. Are you sure?', confirmText: 'Delete', danger: true, onConfirm: () => handleDeleteFolderOptimistic(folderId) });
  }, [handleDeleteFolderOptimistic]);

  const handleRenameFolder = useCallback(async (folderId) => {
    if (!renameFolderName.trim()) return toast.error('Name required');
    try {
      await updateFolder({ folderId, name: renameFolderName.trim() }).unwrap();
      toast.success('Folder renamed');
      setShowRenameFolder(null);
      setRenameFolderName('');
      refetchFolders();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [updateFolder, renameFolderName, refetchFolders]);

  const openCopyModal = useCallback((task) => setFolderActionModal({ isOpen: true, mode: 'copy', task }), []);
  const openMoveModal = useCallback((task) => setFolderActionModal({ isOpen: true, mode: 'move', task }), []);
  const closeFolderActionModal = useCallback(() => setFolderActionModal({ isOpen: false, mode: 'copy', task: null }), []);

  const handleFolderActionConfirm = useCallback(async (taskId, targetFolderId) => {
    try {
      if (folderActionModal.mode === 'copy') { await copyTask({ taskId, targetFolderId }).unwrap(); toast.success('Task copied'); }
      else { await moveTask({ taskId, targetFolderId }).unwrap(); toast.success('Task moved'); }
      refetchTasks();
      closeFolderActionModal();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [folderActionModal.mode, copyTask, moveTask, refetchTasks, closeFolderActionModal]);

  const handleSaveFolderPermissions = useCallback(async (folderId, selectedUserIds) => {
    const folder = localFolders.find(f => f._id === folderId);
    if (!folder) return;
    const currentUsers = folder.readOnlyUsers?.map(id => id.toString()) || [];
    const toAdd = selectedUserIds.filter(id => !currentUsers.includes(id));
    const toRemove = currentUsers.filter(id => !selectedUserIds.includes(id));
    try {
      if (toAdd.length > 0) { await addFolderReadOnly({ folderId, users: toAdd }).unwrap(); }
      if (toRemove.length > 0) { await removeFolderReadOnly({ folderId, users: toRemove }).unwrap(); }
      toast.success('Folder access updated');
      refetchFolders(); refetchTasks();
    } catch (error) { toast.error(error?.data?.message || 'Failed to update folder access'); throw error; }
  }, [localFolders, addFolderReadOnly, removeFolderReadOnly, refetchFolders, refetchTasks]);

  // ── Drag and drop (folders) ──
  const handleFolderDragOver = useCallback((e, folderId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedOverTabId !== folderId) setDraggedOverTabId(folderId);
  }, [draggedOverTabId]);

  const handleFolderDragLeave = useCallback((e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDraggedOverTabId(null);
  }, []);

  const handleFolderDrop = useCallback(async (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedOverTabId(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);
    setIsDraggingSomething(false);
    if (!taskId) return;
    if (!canManage && folderId && isFolderReadOnly(folderId)) { toast.error('You do not have write access to this folder.'); return; }
    const previousTasks = tasks;
    setLocalTasks(prev => prev.filter(t => t._id !== taskId));
    try {
      await moveTask({ taskId, targetFolderId: folderId }).unwrap();
      toast.success('Task moved');
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to move task');
      setLocalTasks(previousTasks);
    }
  }, [draggedTaskId, canManage, isFolderReadOnly, tasks, moveTask, refetchTasks]);

  // ── Task drag and drop (reordering) ──
  const canReorderTasks = canManage && !showArchived;

  const handleTaskDragStart = useCallback((e, task) => {
    const folderId = task.folder?._id || task.folder;
    if (folderId && isFolderReadOnly(folderId)) { e.preventDefault(); toast.error('Cannot reorder a task from a read‑only folder.'); return; }
    if (!canManage) { e.preventDefault(); toast.error('You do not have permission to reorder tasks.'); return; }
    setDraggedTaskId(task._id);
    setIsDraggingSomething(true);
    e.dataTransfer.setData('text/plain', task._id);
    e.dataTransfer.effectAllowed = 'move';
  }, [isFolderReadOnly, canManage]);

  const handleTaskDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDraggedOverTabId(null);
    setIsDraggingSomething(false);
  }, []);

  const handleTaskDragOver = useCallback((e, task) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedTaskId && draggedTaskId !== task._id) setDragOverTaskId(task._id);
  }, [draggedTaskId]);

  const handleTaskDragLeave = useCallback(() => setDragOverTaskId(null), []);
  const handleTaskDrop = useCallback(async (e, targetTask) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!draggedId || draggedId === targetTask._id) { setDragOverTaskId(null); return; }
    setDragOverTaskId(null);
    const previousTasks = tasks;
    const draggedIdx = previousTasks.findIndex(t => t._id === draggedId);
    const targetIdx = previousTasks.findIndex(t => t._id === targetTask._id);
    if (draggedIdx === -1 || targetIdx === -1) return;
    const newOrder = [...previousTasks];
    const [moved] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, moved);
    const orderedIds = newOrder.map(t => t._id);
    setLocalTasks(newOrder);
    setDraggedTaskId(null);
    setIsDraggingSomething(false);
    try { await reorderTasks({ projectId, orderedTaskIds: orderedIds }).unwrap(); refetchTasks(); } catch (err) { toast.error(err?.data?.message || 'Failed to reorder tasks'); setLocalTasks(previousTasks); }
  }, [draggedTaskId, tasks, reorderTasks, projectId, refetchTasks]);

  // ── Sub-task reordering ──
  const canReorderSub = useCallback(() => {
    if (!activeTask) return false;
    if (isFolderReadOnly(activeFolderId)) return false;
    return !activeTask.isArchived && (canManage || (activeTask.assignee?._id === userInfo?._id && activeTask.allowAssigneeEditSubtasks));
  }, [activeTask, isFolderReadOnly, activeFolderId, canManage, userInfo]);

  const handleSubDragStart = useCallback((e, index) => {
    if (!canReorderSub()) { e.preventDefault(); toast.error('You do not have permission to reorder sub‑tasks.'); return; }
    setDraggedSubIdx(index);
  }, [canReorderSub]);

  const handleSubDragEnd = useCallback(() => { setDraggedSubIdx(null); setDragOverSubIdx(null); }, []);
  const handleSubDragOver = useCallback((e, index) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    if (draggedSubIdx !== null && draggedSubIdx !== index) setDragOverSubIdx(index);
  }, [draggedSubIdx]);
  const handleSubDragLeave = useCallback(() => setDragOverSubIdx(null), []);
  const handleSubDrop = useCallback(async (e, targetIndex) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    const draggedIdx = raw !== '' ? parseInt(raw, 10) : draggedSubIdx;
    if (draggedIdx === null || isNaN(draggedIdx) || draggedIdx === targetIndex) { setDragOverSubIdx(null); return; }
    setDragOverSubIdx(null);
    if (!activeTask) return;
    const subtasks = activeTask.subTasks || [];
    if (draggedIdx < 0 || targetIndex < 0 || draggedIdx >= subtasks.length || targetIndex >= subtasks.length) return;
    const previousTasks = tasks;
    const newSubTasks = [...subtasks];
    const [movedSub] = newSubTasks.splice(draggedIdx, 1);
    newSubTasks.splice(targetIndex, 0, movedSub);
    const indices = subtasks.map((_, i) => i);
    const [movedIdx] = indices.splice(draggedIdx, 1);
    indices.splice(targetIndex, 0, movedIdx);
    const orderedSubTaskIndices = indices;
    const optimisticTasks = previousTasks.map(t => t._id === activeTask._id ? { ...t, subTasks: newSubTasks } : t);
    setLocalTasks(optimisticTasks);
    setDraggedSubIdx(null);
    try { await reorderSubTasks({ taskId: activeTask._id, orderedSubTaskIndices }).unwrap(); refetchTasks(); } catch (err) { toast.error(err?.data?.message || 'Failed to reorder sub‑tasks'); setLocalTasks(previousTasks); }
  }, [draggedSubIdx, activeTask, tasks, reorderSubTasks, refetchTasks]);

  // ── Splitter ──
  const handleSplitterMouseMove = useCallback((e) => {
    if (!isDraggingSplitter || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    let newWidth = ((e.clientX - containerRect.left) / containerWidth) * 100;
    newWidth = Math.min(70, Math.max(20, newWidth));
    setLeftWidthPercent(newWidth);
  }, [isDraggingSplitter]);

  const handleSplitterMouseUp = useCallback(() => {
    setIsDraggingSplitter(false);
    document.removeEventListener('mousemove', handleSplitterMouseMove);
    document.removeEventListener('mouseup', handleSplitterMouseUp);
  }, [handleSplitterMouseMove]);

  const handleSplitterMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
    document.addEventListener('mousemove', handleSplitterMouseMove);
    document.addEventListener('mouseup', handleSplitterMouseUp);
  }, [handleSplitterMouseMove, handleSplitterMouseUp]);

  useEffect(() => {
    return () => { document.removeEventListener('mousemove', handleSplitterMouseMove); document.removeEventListener('mouseup', handleSplitterMouseUp); };
  }, [handleSplitterMouseMove, handleSplitterMouseUp]);

  // ── Toggle archived ──
  const toggleArchived = useCallback(() => {
    setShowArchived(prev => !prev);
    setActiveFolderId(null);
    setSelectedTaskId(null);
    setMobileShowDetail(false);
  }, []);

  // ── Early returns ────────────────────────────────────────────────────
  if (wErr || pErr) { navigate(`/my-workspace/${workspaceId}/projects`); return null; }
  if (wLoad || pLoad || tLoad || foldersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: brandColor }} />
      </div>
    );
  }
  if (!workspace || !project) return null;

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <MyWorkspaceProjectTopBar
          workspaceId={workspaceId}
          project={project}
          brandColor={brandColor}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onSearchOpen={() => setSearchOpen(true)}
          onAddClick={() => setShowCreateTask(true)}
          onAddMemberClick={() => setShowAddMember(true)}
          projectProgress={projectProgress}
          teamCount={activeTeam.length}
          canManage={canManage}
        />

        <div className="flex-1 flex overflow-hidden" ref={containerRef}>
          {/* Left panel */}
          <div
            className={`flex flex-col h-full overflow-hidden flex-shrink-0 border-r border-gray-200 dark:border-gray-800/40 bg-gray-50 dark:bg-[#0f0f12] ${!isMd && mobileShowDetail ? 'hidden' : ''}`}
            style={{ width: isMd ? `${leftWidthPercent}%` : (mobileShowDetail ? '0%' : '100%') }}
          >
            {activeTab === 'tasks' ? (
              <MyWorkspaceProjectTasks
                tasks={tasks}
                folders={visibleFolders}
                activeFolderId={activeFolderId}
                showArchived={showArchived}
                onFolderSelect={setActiveFolderId}
                onTaskClick={handleTaskClick}
                selectedTaskId={selectedTaskId}
                brandColor={brandColor}
                canManage={canManage}
                isFolderReadOnly={isFolderReadOnly}
                onCreateFolder={() => setShowCreateFolder(true)}
                onRenameFolder={(id, name) => { setShowRenameFolder(id); setRenameFolderName(name); }}
                onDeleteFolder={handleDeleteFolder}
                onManageFolderAccess={(folder) => setFolderAccessModal({ isOpen: true, folder })}
                onToggleArchived={toggleArchived}
                onTaskDragStart={handleTaskDragStart}
                onTaskDragEnd={handleTaskDragEnd}
                onTaskDragOver={handleTaskDragOver}
                onTaskDragLeave={handleTaskDragLeave}
                onTaskDrop={handleTaskDrop}
                dragOverTaskId={dragOverTaskId}
                canReorderTasks={canReorderTasks}
                onCopyClick={openCopyModal}
                onMoveClick={openMoveModal}
                onDragOverFolder={handleFolderDragOver}
                onDropOnFolder={handleFolderDrop}
                draggedOverTabId={draggedOverTabId}
                isDraggingSomething={isDraggingSomething}
                onDragLeaveFolder={handleFolderDragLeave}
              />
            ) : (
              <MyWorkspaceProjectTeam
                projectManagers={projectManagers}
                teamMembers={activeTeam}
                canManage={canManage}
                onAddMember={() => setShowAddMember(true)}
                onAddManager={() => setShowAddManager(true)}
                onRemoveMember={handleRemoveMember}
                onRemoveManager={handleRemoveManager}
                brandColor={brandColor}
              />
            )}
          </div>

          {isMd && (
            <div
              className="hidden md:flex items-center justify-center w-2 flex-shrink-0 bg-transparent hover:bg-[#0d9488]/10 cursor-col-resize transition-colors duration-150 select-none"
              onMouseDown={handleSplitterMouseDown}
              style={{ touchAction: 'none' }}
            >
              <div className="w-0.5 h-12 bg-gray-300 dark:bg-gray-700 rounded-full hover:bg-[#0d9488] transition" />
            </div>
          )}

          {/* Right panel – Task Detail */}
          <div className={`flex flex-col flex-1 h-full bg-gray-50 dark:bg-[#0f0f12] ${!isMd && !mobileShowDetail ? 'hidden' : ''}`}>
            {activeTask ? (
              <MyWorkspaceProjectTaskId
                task={activeTask}
                brandColor={brandColor}
                userInfo={userInfo}
                onBack={handleBackToList}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onRefresh={refreshAll}
                canManage={canManage}
                onSendReminder={handleSendManualReminder}
                onConfirmCompletion={handleConfirmCompletion}
                onAssignTask={openAssignModal}
                onMarkComplete={handleMarkComplete}
                onSetReadyForCompletion={handleSetReadyForCompletion}
                onArchiveTask={handleArchiveTask}
                onUnarchiveTask={handleUnarchiveTask}
                onPermanentDelete={handlePermanentDeleteTask}
                onCopyClick={openCopyModal}
                onMoveClick={openMoveModal}
                isReadOnly={activeFolderId ? isFolderReadOnly(activeFolderId) : false}
                subDragStart={canReorderSub() ? handleSubDragStart : null}
                subDragEnd={handleSubDragEnd}
                subDragOver={canReorderSub() ? handleSubDragOver : null}
                subDrop={canReorderSub() ? handleSubDrop : null}
                subDragLeave={handleSubDragLeave}
                subDragOverIndex={dragOverSubIdx}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-500">
                <div className="text-center">
                  <FaCommentDots className="text-5xl mx-auto mb-4 opacity-30" style={{ color: brandColor }} />
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Select a task</p>
                  <p className="text-sm mt-1 text-gray-500 dark:text-gray-400">Sub‑tasks and details will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!mobileShowDetail && <MyWorkspaceBottombar workspace={workspace} />}

      {/* ─── Modals ──────────────────────────────────────────────── */}
      {showCreateTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaTasks className="inline mr-1 text-[#0d9488]" /> New Task</h2>
              <button onClick={() => setShowCreateTask(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <CreateTaskForm
              projectId={projectId}
              brandColor={brandColor}
              assignableMembers={assignableMembers}
              folders={visibleFolders}
              onSuccess={() => { setShowCreateTask(false); refreshAll(); }}
              onCancel={() => setShowCreateTask(false)}
            />
          </div>
        </div>
      )}

      {showEditTask && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaEdit className="inline mr-1 text-[#0d9488]" /> Edit Task</h2>
              <button onClick={() => setShowEditTask(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <EditTaskForm
              task={selectedTask}
              brandColor={brandColor}
              assignableMembers={assignableMembers}
              folders={visibleFolders}
              onSuccess={() => { setShowEditTask(false); refreshAll(); }}
              onCancel={() => setShowEditTask(false)}
            />
          </div>
        </div>
      )}

      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaUserPlus className="inline mr-1 text-[#0d9488]" /> Add Member</h2>
              <button onClick={() => setShowAddMember(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <AddMemberForm
              project={project}
              workspace={workspace}
              brandColor={brandColor}
              onSuccess={() => { setShowAddMember(false); refetchProject(); }}
              onCancel={() => setShowAddMember(false)}
              onAddManager={handleAddManager}
            />
          </div>
        </div>
      )}

      {showAssignModal && assignTaskTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaUserPlus className="inline mr-1 text-[#0d9488]" /> Assign Task</h2>
              <button onClick={() => setShowAssignModal(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <AssignForm
              assignableMembers={assignableMembers}
              onAssign={handleAssignTask}
              brandColor={brandColor}
              onCancel={() => setShowAssignModal(false)}
            />
          </div>
        </div>
      )}

      {showAddManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Add Manager</h2>
              <button onClick={() => setShowAddManager(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <CustomDropdown
              label="Select Member"
              options={managerOptions}
              value=""
              onChange={(v) => {
                if (v) {
                  const selected = availableForManager.find(m => (m.user?._id || m._id) === v);
                  if (selected) {
                    const name = selected.user?.name || selected.name || 'Unknown';
                    handleAddManager(v, name);
                    setShowAddManager(false);
                  }
                }
              }}
              brandColor={brandColor}
            />
          </div>
        </div>
      )}

      {showCreateFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaFolder className="inline mr-1 text-[#0d9488]" /> New Folder</h2>
              <button onClick={() => setShowCreateFolder(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name" className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none mb-4" onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()} />
            <div className="flex gap-3">
              <button onClick={() => setShowCreateFolder(false)} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={handleCreateFolder} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>Create Folder</button>
            </div>
          </div>
        </div>
      )}

      {showRenameFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaPen className="inline mr-1 text-[#0d9488]" /> Rename Folder</h2>
              <button onClick={() => setShowRenameFolder(null)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <input type="text" value={renameFolderName} onChange={(e) => setRenameFolderName(e.target.value)} placeholder="New folder name" className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none mb-4" onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder(showRenameFolder)} />
            <div className="flex gap-3">
              <button onClick={() => setShowRenameFolder(null)} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={() => handleRenameFolder(showRenameFolder)} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>Rename</button>
            </div>
          </div>
        </div>
      )}

      <FolderAccessModal
        isOpen={folderAccessModal.isOpen}
        onClose={() => setFolderAccessModal({ isOpen: false, folder: null })}
        folder={folderAccessModal.folder}
        projectMembers={activeTeam}
        currentUserId={userInfo?._id}
        initialAccessUsers={folderAccessModal.folder?.readOnlyUsers?.map(id => id.toString()) || []}
        onSave={handleSaveFolderPermissions}
        brandColor={brandColor}
      />

      <FolderSelectModal
        isOpen={folderActionModal.isOpen}
        onClose={closeFolderActionModal}
        folders={visibleFolders}
        mode={folderActionModal.mode}
        task={folderActionModal.task}
        onConfirm={handleFolderActionConfirm}
        brandColor={brandColor}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
        confirmText={confirmModal.confirmText || 'Confirm'}
      />

      <DeleteTaskConfirmModal
        isOpen={deleteTaskModal.isOpen}
        onClose={() => setDeleteTaskModal({ isOpen: false, taskName: '', onConfirm: () => {} })}
        onConfirm={deleteTaskModal.onConfirm}
        taskName={deleteTaskModal.taskName}
      />

      <ConfirmModal
        isOpen={addManagerConfirm.isOpen}
        onClose={() => setAddManagerConfirm({ isOpen: false, managerName: '', managerId: '' })}
        onConfirm={confirmAddManager}
        title="Add Manager"
        message={`Are you sure you want to add ${addManagerConfirm.managerName} as manager?`}
        danger={false}
      />

      {/* Completion modals */}
      <MarkCompleteModal isOpen={showMarkCompleteModal} onClose={() => setShowMarkCompleteModal(false)} task={activeTask} brandColor={brandColor} onSubmit={handleMarkComplete} />
      <ConfirmCompletionModal isOpen={showConfirmCompletionModal} onClose={() => setShowConfirmCompletionModal(false)} task={activeTask} brandColor={brandColor} onSubmit={handleConfirmCompletion} />
    </div>
  );
};

// ─── Media query hook ────────────────────────────────────────────────
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
};

export default MyWorkspaceProjectId;
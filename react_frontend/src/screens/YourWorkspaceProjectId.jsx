// src/screens/YourWorkspaceProjectId.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import {
  useGetProjectByIdQuery,
  useManageProjectManagersMutation,
  useAddTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useArchiveProjectMutation,
  useUnarchiveProjectMutation,
  useDeleteProjectMutation,
  useRestoreProjectMutation,
  usePermanentlyDeleteProjectMutation,
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
  useRejectTaskMutation,           // <-- NEW
  useSendManualReminderMutation,
  useGetTaskFeedbackQuery,
  useAssignTaskMutation,
  useReorderTasksMutation,
  useReorderSubTasksMutation,
} from '../slices/taskApiSlice';
import {
  useGetProjectFoldersQuery,
  useCreateFolderMutation,
  useUpdateFolderMutation,
  useDeleteFolderMutation,
  useAddFolderReadOnlyMutation,
  useRemoveFolderReadOnlyMutation,
} from '../slices/taskApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
import { FaCommentDots, FaUser, FaTimes } from 'react-icons/fa';
import toast from 'react-hot-toast';

// ─── Import the four components ──────────────────────────────────────
import YourWorkspaceProjectTopBar from '../components/YourWorkspaceProjectTopBar';
import YourWorkspaceProjectTasks from '../components/YourWorkspaceProjectTasks';
import YourWorkspaceProjectTeam from '../components/YourWorkspaceProjectTeam';
import TaskDetailView from '../components/YourWorkspaceProjectTaskId';

// ─── Import modals and helpers from ProjectHelpers ─────────────────
import {
  SearchModal,
  ConfirmModal,
  DeleteTaskConfirmModal,
  ProjectMenuModal,
  CreateTaskModal,
  EditTaskModal,
  AddMemberModal,
  AssignTaskModal,
  FolderFormModal,
  FolderReadOnlyModal,
  CustomDropdown,
  MarkCompleteModal,          // <-- NEW
  ConfirmCompletionModal,     // <-- NEW
} from '../components/ProjectHelpers';

// ─── Main Component ────────────────────────────────────────────────────
const YourWorkspaceProjectId = () => {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  // ─── States ──────────────────────────────────────────────────────────
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks');
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTaskTarget, setAssignTaskTarget] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [showReadOnlyModal, setShowReadOnlyModal] = useState(false);
  const [readOnlyFolder, setReadOnlyFolder] = useState(null);
  const [projectMenuModalOpen, setProjectMenuModalOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    danger: false,
  });
  const [deleteTaskModal, setDeleteTaskModal] = useState({
    isOpen: false,
    taskName: '',
    onConfirm: () => {},
  });
  const [addManagerConfirm, setAddManagerConfirm] = useState({
    isOpen: false,
    managerName: '',
    managerId: '',
  });

  // ─── NEW: Modals for task completion flow ─────────────────────────
  const [showMarkCompleteModal, setShowMarkCompleteModal] = useState(false);
  const [showConfirmCompletionModal, setShowConfirmCompletionModal] = useState(false);

  const [folderMenuOpen, setFolderMenuOpen] = useState(null);
  const longPressTimer = useRef(null);

  // ─── Queries ──────────────────────────────────────────────────────────
  const { data: wData, isLoading: wLoad, error: wErr } = useGetWorkspaceQuery(workspaceId);
  const { data: pData, isLoading: pLoad, error: pErr, refetch: refetchProject } = useGetProjectByIdQuery(projectId);
  const { data: foldersData, isLoading: foldersLoading, refetch: refetchFolders } = useGetProjectFoldersQuery(projectId);
  const { data: tData, isLoading: tLoad, refetch: refetchTasks } = useGetProjectTasksQuery(
    { projectId, folderId: selectedFolderId || undefined }
  );
  const { data: feedbackData, isLoading: feedbackLoading } = useGetTaskFeedbackQuery(
    { taskId: selectedTaskId },
    { skip: !selectedTaskId }
  );

  // ─── Mutations ───────────────────────────────────────────────────────
  const [archiveProject] = useArchiveProjectMutation();
  const [unarchiveProject] = useUnarchiveProjectMutation();
  const [deleteProject] = useDeleteProjectMutation();
  const [restoreProject] = useRestoreProjectMutation();
  const [permanentlyDeleteProject] = usePermanentlyDeleteProjectMutation();
  const [deleteTask] = useDeleteTaskMutation();
  const [removeTeamMember] = useRemoveTeamMemberMutation();
  const [manageProjectManagers] = useManageProjectManagersMutation();
  const [sendManualReminder] = useSendManualReminderMutation();
  const [confirmTaskCompletion] = useConfirmTaskCompletionMutation();
  const [assignTask] = useAssignTaskMutation();
  const [reorderTasks] = useReorderTasksMutation();
  const [reorderSubTasks] = useReorderSubTasksMutation();
  const [createTask] = useCreateTaskMutation();
  const [deleteFolder] = useDeleteFolderMutation();
  const [markTaskCompleted] = useMarkTaskCompletedMutation();
  const [updateTask] = useUpdateTaskMutation();
  const [rejectTask] = useRejectTaskMutation();               // <-- NEW

  // ─── Local state (optimistic updates) ──────────────────────────────
  const [localTasks, setLocalTasks] = useState([]);
  const [localFolders, setLocalFolders] = useState([]);

  useEffect(() => {
    setLocalTasks(tData?.tasks || []);
  }, [tData]);

  useEffect(() => {
    setLocalFolders(foldersData?.folders || []);
  }, [foldersData]);

  const tasks = localTasks;
  const folders = localFolders;

  // ─── Computed values ────────────────────────────────────────────────
  const workspace = wData?.workspace;
  const project = pData?.project;

  const isOwner = useMemo(() => {
    if (!workspace || !userInfo?._id) return false;
    const ownerId = workspace.owner?._id || workspace.owner;
    return ownerId?.toString() === userInfo._id.toString();
  }, [workspace, userInfo]);

  const isWorkspaceAdmin = useMemo(() => {
    if (!workspace || !userInfo?._id) return false;
    return workspace.members?.some(
      (m) => (m.user?._id || m.user)?.toString() === userInfo._id.toString() && m.role === 'Admin' && m.status === 'active'
    );
  }, [workspace, userInfo]);

  const isProjectManager = useMemo(() => {
    if (!project || !userInfo?._id) return false;
    return project.projectManagers?.some((pm) => {
      const id = pm._id || pm;
      return id?.toString() === userInfo._id.toString();
    });
  }, [project, userInfo]);

  const canManage = useMemo(() => isOwner || isWorkspaceAdmin || isProjectManager, [isOwner, isWorkspaceAdmin, isProjectManager]);

  const activeTask = useMemo(() => tasks.find(t => t._id === selectedTaskId) || null, [tasks, selectedTaskId]);
  const projectManagers = project?.projectManagers || [];
  const projectProgress = project?.progress || 0;
  const isArchivedForMe = project?.isArchivedForMe || false;
  const isTrash = project?.isTrash || false;

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

  const availableForManager = useMemo(() => {
    if (!workspace) return [];
    return workspace.members?.filter(m =>
      m.status === 'active' &&
      !projectManagers.some(pm => (pm._id || pm) === (m.user?._id || m._id))
    ) || [];
  }, [workspace, projectManagers]);

  const managerOptions = useMemo(() => availableForManager.map(m => {
    const u = m.user || m;
    return { value: u._id, label: u.name || 'Unknown', icon: u.profile ? <img src={u.profile} className="w-4 h-4 rounded-full" /> : <FaUser className="text-gray-400" /> };
  }), [availableForManager]);

  // ─── Drag state ──────────────────────────────────────────────────────
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [isDraggingTask, setIsDraggingTask] = useState(false);
  const [draggedSubIdx, setDraggedSubIdx] = useState(null);
  const [dragOverSubIdx, setDragOverSubIdx] = useState(null);

  // ─── Handlers ────────────────────────────────────────────────────────
  const refreshAll = useCallback(() => {
    refetchTasks();
    refetchProject();
    refetchFolders();
  }, [refetchTasks, refetchProject, refetchFolders]);

  const handleCreateTaskOptimistic = useCallback(async (formData) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const optimisticTask = {
      _id: tempId,
      title: formData.title,
      description: formData.description || '',
      priority: formData.priority || 'medium',
      status: 'pending',
      progress: 0,
      assignee: formData.assigneeId ? { _id: formData.assigneeId, name: 'Loading...' } : null,
      folder: formData.folderId ? { _id: formData.folderId, name: folders.find(f => f._id === formData.folderId)?.name || 'Folder' } : null,
      startDate: formData.startDate || null,
      dueDate: formData.dueDate || null,
      estimatedHours: formData.estimatedHours || 0,
      bufferTime: parseInt(formData.bufferTime) || 0,
      allowAssigneeEditSubtasks: formData.allowAssigneeEditSubtasks === 'true',
      recurrenceType: formData.recurrenceType || 'none',
      recurrenceDays: formData.recurrenceDays || [],
      recurrenceEndDate: formData.recurrenceEndDate || null,
      links: formData.links || [],
      attachments: [],
      subTasks: [],
      isArchived: false,
      isTrash: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setLocalTasks(prev => [optimisticTask, ...prev]);

    const fd = new FormData();
    fd.append('projectId', formData.projectId);
    fd.append('title', formData.title);
    fd.append('description', formData.description);
    fd.append('assigneeId', formData.assigneeId || '');
    fd.append('priority', formData.priority);
    fd.append('estimatedHours', formData.estimatedHours || '');
    fd.append('bufferTime', formData.bufferTime);
    fd.append('allowAssigneeEditSubtasks', formData.allowAssigneeEditSubtasks);
    if (formData.startDate) fd.append('startDate', formData.startDate);
    if (formData.dueDate) fd.append('dueDate', formData.dueDate);
    if (formData.folderId) fd.append('folderId', formData.folderId);
    fd.append('recurrenceType', formData.recurrenceType);
    if (formData.recurrenceType === 'weekly') {
      fd.append('recurrenceDays', JSON.stringify(formData.recurrenceDays));
    }
    if (formData.recurrenceEndDate) fd.append('recurrenceEndDate', formData.recurrenceEndDate);
    formData.links.forEach(l => fd.append('links', l));
    formData.attachments.forEach(f => fd.append('attachments', f));

    try {
      const result = await createTask(fd).unwrap();
      setLocalTasks(prev => prev.map(t => t._id === tempId ? result.task : t));
      refetchTasks();
      refetchProject();
      return result;
    } catch (err) {
      setLocalTasks(prev => prev.filter(t => t._id !== tempId));
      toast.error(err?.data?.message || 'Failed to create task');
      throw err;
    }
  }, [createTask, refetchTasks, refetchProject, folders]);

  const handleDeleteFolderOptimistic = useCallback(async (folderId) => {
    const folderToDelete = folders.find(f => f._id === folderId);
    if (!folderToDelete) return;

    setLocalFolders(prev => prev.filter(f => f._id !== folderId));
    if (selectedFolderId === folderId) {
      setSelectedFolderId(null);
    }

    try {
      await deleteFolder(folderId).unwrap();
      toast.success('Folder deleted');
      refetchFolders();
      refetchTasks();
    } catch (err) {
      setLocalFolders(prev => [...prev, folderToDelete]);
      toast.error(err?.data?.message || 'Failed to delete folder');
    }
  }, [folders, deleteFolder, refetchFolders, refetchTasks, selectedFolderId]);

  const handleArchiveProject = useCallback(async () => {
    try {
      await archiveProject(projectId).unwrap();
      toast.success('Project archived for you.');
      refetchProject();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to archive');
    }
    setProjectMenuOpen(false);
    setProjectMenuModalOpen(false);
  }, [archiveProject, projectId, refetchProject]);

  const handleUnarchiveProject = useCallback(async () => {
    try {
      await unarchiveProject(projectId).unwrap();
      toast.success('Project unarchived.');
      refetchProject();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to unarchive');
    }
    setProjectMenuOpen(false);
    setProjectMenuModalOpen(false);
  }, [unarchiveProject, projectId, refetchProject]);

  const handleMoveToTrash = useCallback(() => {
    setConfirmModal({
      isOpen: true,
      title: 'Move to Trash',
      message: `Are you sure you want to move "${project?.name}" to trash? This can be restored within 30 days.`,
      onConfirm: async () => {
        try {
          await deleteProject(projectId).unwrap();
          toast.success('Project moved to trash.');
          navigate(`/workspace/${workspaceId}/projects`);
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to move to trash');
        }
      },
      danger: false,
    });
    setProjectMenuOpen(false);
    setProjectMenuModalOpen(false);
  }, [deleteProject, projectId, navigate, workspaceId, project?.name]);

  const handleRestoreProject = useCallback(() => {
    setConfirmModal({
      isOpen: true,
      title: 'Restore Project',
      message: `Are you sure you want to restore "${project?.name}" from trash?`,
      onConfirm: async () => {
        try {
          await restoreProject(projectId).unwrap();
          toast.success('Project restored.');
          refetchProject();
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to restore');
        }
      },
      danger: false,
    });
    setProjectMenuOpen(false);
    setProjectMenuModalOpen(false);
  }, [restoreProject, projectId, refetchProject, project?.name]);

  const handlePermanentDeleteProject = useCallback(() => {
    setConfirmModal({
      isOpen: true,
      title: 'Permanently Delete',
      message: `Are you sure you want to permanently delete "${project?.name}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await permanentlyDeleteProject(projectId).unwrap();
          toast.success('Project permanently deleted.');
          navigate(`/workspace/${workspaceId}/projects`);
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to delete');
        }
      },
      danger: true,
    });
    setProjectMenuOpen(false);
    setProjectMenuModalOpen(false);
  }, [permanentlyDeleteProject, projectId, navigate, workspaceId, project?.name]);

  const handleDeleteTask = useCallback((task) => {
    setDeleteTaskModal({
      isOpen: true,
      taskName: task.title,
      onConfirm: async () => {
        try {
          await deleteTask(task._id).unwrap();
          toast.success('Deleted');
          refetchTasks();
          refetchProject();
          if (selectedTaskId === task._id) {
            setSelectedTaskId(null);
            setMobileShowDetail(false);
          }
        } catch (e) {
          toast.error(e?.data?.message || 'Failed');
        }
      },
    });
  }, [deleteTask, refetchTasks, refetchProject, selectedTaskId]);

  const handleEditTask = useCallback((task) => { setSelectedTask(task); setShowEditTask(true); }, []);

  const handleRemoveMember = useCallback(async (id) => {
    if (!id) { toast.error('Invalid member ID'); return; }
    setConfirmModal({
      isOpen: true,
      title: 'Remove Member',
      message: 'Are you sure you want to remove this member from the project?',
      onConfirm: async () => {
        try {
          await removeTeamMember({ projectId, memberId: id }).unwrap();
          toast.success('Removed');
          refetchProject();
        } catch (e) {
          toast.error(e?.data?.message || 'Failed');
        }
      },
      danger: true,
    });
  }, [removeTeamMember, projectId, refetchProject]);

  const handleAddManager = useCallback((id, name) => {
    setAddManagerConfirm({ isOpen: true, managerName: name, managerId: id });
  }, []);

  const confirmAddManager = useCallback(async () => {
    try {
      await manageProjectManagers({ projectId, action: 'add', managerId: addManagerConfirm.managerId }).unwrap();
      toast.success('Manager added');
      refetchProject();
      setAddManagerConfirm({ isOpen: false, managerName: '', managerId: '' });
    } catch (e) {
      toast.error(e?.data?.message || 'Failed');
    }
  }, [manageProjectManagers, projectId, addManagerConfirm.managerId, refetchProject]);

  const handleRemoveManager = useCallback(async (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Manager',
      message: 'Are you sure you want to remove this manager?',
      onConfirm: async () => {
        try {
          await manageProjectManagers({ projectId, action: 'remove', managerId: id }).unwrap();
          toast.success('Manager removed');
          refetchProject();
        } catch (e) {
          toast.error(e?.data?.message || 'Failed');
        }
      },
      danger: true,
    });
  }, [manageProjectManagers, projectId, refetchProject]);

  const handleTaskClick = useCallback((taskId) => { setSelectedTaskId(taskId); setMobileShowDetail(true); }, []);
  const handleBackToList = useCallback(() => { setSelectedTaskId(null); setMobileShowDetail(false); }, []);

  const openSearchModal = useCallback(() => setSearchModalOpen(true), []);
  const closeSearchModal = useCallback(() => setSearchModalOpen(false), []);

  const searchItems = activeTab === 'tasks' ? tasks : activeTeam;
  const onSearchSelect = useCallback((id) => {
    if (activeTab === 'tasks') handleTaskClick(id);
  }, [activeTab, handleTaskClick]);

  const handleSendManualReminder = useCallback(async (task) => {
    try {
      await sendManualReminder({ taskId: task._id, message: '' }).unwrap();
      toast.success('Reminder sent to assignee');
    } catch (e) { toast.error(e?.data?.message || 'Failed to send reminder'); }
  }, [sendManualReminder]);

  // ─── NEW: Mark complete handler (submits notes, links, attachments) ──
  const handleMarkComplete = useCallback(async ({ notes, links, attachments }) => {
    try {
      const fd = new FormData();
      fd.append('notes', notes || '');
      if (links && links.length) {
        links.forEach(l => fd.append('links', l));
      }
      if (attachments && attachments.length) {
        attachments.forEach(f => fd.append('completionAttachments', f));
      }
      await markTaskCompleted({ taskId: activeTask._id, data: fd }).unwrap();
      toast.success('Task submitted for review');
      refreshAll();
      setShowMarkCompleteModal(false);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to submit task');
      throw err;
    }
  }, [activeTask, markTaskCompleted, refreshAll]);

  // ─── Confirm completion handler (already exists, but we'll pass to modal) ──
  const handleConfirmCompletion = useCallback(async (data) => {
    try {
      const fd = new FormData();
      fd.append('feedback', data.feedback || '');
      if (data.finalHours !== undefined) fd.append('finalHours', data.finalHours.toString());
      if (data.finalLinks) {
        data.finalLinks.forEach(l => fd.append('finalLinks', l));
      }
      if (data.finalAttachments) {
        data.finalAttachments.forEach(f => fd.append('finalAttachments', f));
      }
      await confirmTaskCompletion({ taskId: activeTask._id, data: fd }).unwrap();
      toast.success('Task completion confirmed');
      refreshAll();
      setShowConfirmCompletionModal(false);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to confirm completion');
      throw err;
    }
  }, [activeTask, confirmTaskCompletion, refreshAll]);

  // ─── NEW: Reject handler ─────────────────────────────────────────────
  const handleRejectTask = useCallback(async (taskId, reason) => {
    try {
      await rejectTask({ taskId, reason }).unwrap();
      toast.success('Task rejected – returned to pending');
      refreshAll();
      setShowConfirmCompletionModal(false);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to reject task');
      throw err;
    }
  }, [rejectTask, refreshAll]);

  const handleSetReadyForCompletion = useCallback(async (task) => {
    const previousStatus = task.status;
    setLocalTasks(prev => prev.map(t =>
      t._id === task._id ? { ...t, status: 'ready_for_completion' } : t
    ));
    try {
      await updateTask({ taskId: task._id, data: { status: 'ready_for_completion' } }).unwrap();
      toast.success('Task is now ready for completion');
      refreshAll();
    } catch (err) {
      setLocalTasks(prev => prev.map(t =>
        t._id === task._id ? { ...t, status: previousStatus } : t
      ));
      toast.error(err?.data?.message || 'Failed to update task status');
    }
  }, [updateTask, refreshAll]);

  const handleAssignTask = useCallback(async (assigneeId) => {
    try {
      await assignTask({ taskId: assignTaskTarget._id, assigneeId }).unwrap();
      toast.success('Task assigned successfully');
      refreshAll();
      setShowAssignModal(false);
      setAssignTaskTarget(null);
    } catch (err) {
      throw err;
    }
  }, [assignTask, assignTaskTarget, refreshAll]);

  const openAssignModal = useCallback((task) => {
    setAssignTaskTarget(task);
    setShowAssignModal(true);
  }, []);

  const handleCreateFolder = useCallback(() => {
    setEditingFolder(null);
    setShowFolderForm(true);
  }, []);

  const handleEditFolder = useCallback((folder) => {
    setEditingFolder(folder);
    setShowFolderForm(true);
  }, []);

  const handleDeleteFolder = useCallback((folder) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Folder',
      message: `Are you sure you want to delete folder "${folder.name}"? Tasks will be unlinked but not deleted.`,
      onConfirm: () => handleDeleteFolderOptimistic(folder._id),
      danger: true,
    });
  }, [handleDeleteFolderOptimistic]);

  const handleManageReadOnly = useCallback((folder) => {
    setReadOnlyFolder(folder);
    setShowReadOnlyModal(true);
  }, []);

  const handleFolderSelect = useCallback((folderId) => {
    setSelectedFolderId(folderId === selectedFolderId ? null : folderId);
    setSelectedTaskId(null);
    setMobileShowDetail(false);
  }, [selectedFolderId]);

  // ─── Task drag & drop ─────────────────────────────────────────────────
  const canReorderTasks = canManage && !isTrash && !isArchivedForMe;

  const handleTaskDragStart = useCallback((e, task) => {
    if (!canReorderTasks) {
      e.preventDefault();
      toast.error('You do not have permission to reorder tasks.');
      return;
    }
    setDraggedTaskId(task._id);
    setIsDraggingTask(true);
    e.dataTransfer.setData('text/plain', task._id);
    e.dataTransfer.effectAllowed = 'move';
  }, [canReorderTasks]);

  const handleTaskDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setIsDraggingTask(false);
  }, []);

  const handleTaskDragOver = useCallback((e, task) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedTaskId && draggedTaskId !== task._id) {
      setDragOverTaskId(task._id);
    }
  }, [draggedTaskId]);

  const handleTaskDragLeave = useCallback(() => {
    setDragOverTaskId(null);
  }, []);

  const handleTaskDrop = useCallback(async (e, targetTask) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!draggedId || draggedId === targetTask._id) {
      setDragOverTaskId(null);
      return;
    }
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
    setIsDraggingTask(false);

    try {
      await reorderTasks({ projectId, orderedTaskIds: orderedIds }).unwrap();
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to reorder tasks');
      setLocalTasks(previousTasks);
    }
  }, [draggedTaskId, tasks, reorderTasks, projectId, refetchTasks]);

  // ─── Sub‑task drag & drop ────────────────────────────────────────────
  const canReorderSub = useCallback((task) => {
    return !isTrash && !isArchivedForMe && !task.isArchived && (canManage || (task.assignee?._id === userInfo?._id && task.allowAssigneeEditSubtasks));
  }, [isTrash, isArchivedForMe, canManage, userInfo]);

  const handleSubDragStart = useCallback((e, index) => {
    if (!activeTask) return;
    if (!canReorderSub(activeTask)) {
      e.preventDefault();
      toast.error('You do not have permission to reorder sub‑tasks.');
      return;
    }
    setDraggedSubIdx(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  }, [activeTask, canReorderSub]);

  const handleSubDragEnd = useCallback(() => {
    setDraggedSubIdx(null);
    setDragOverSubIdx(null);
  }, []);

  const handleSubDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedSubIdx !== null && draggedSubIdx !== index) {
      setDragOverSubIdx(index);
    }
  }, [draggedSubIdx]);

  const handleSubDragLeave = useCallback(() => {
    setDragOverSubIdx(null);
  }, []);

  const handleSubDrop = useCallback(async (e, targetIndex) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    const draggedIdx = raw !== '' ? parseInt(raw, 10) : draggedSubIdx;

    if (draggedIdx === null || draggedIdx === undefined || Number.isNaN(draggedIdx) || draggedIdx === targetIndex) {
      setDragOverSubIdx(null);
      return;
    }
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

    const optimisticTasks = previousTasks.map(t =>
      t._id === activeTask._id ? { ...t, subTasks: newSubTasks } : t
    );
    setLocalTasks(optimisticTasks);
    setDraggedSubIdx(null);

    try {
      await reorderSubTasks({ taskId: activeTask._id, orderedSubTaskIndices }).unwrap();
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to reorder sub‑tasks');
      setLocalTasks(previousTasks);
    }
  }, [draggedSubIdx, activeTask, tasks, reorderSubTasks, refetchTasks]);

  // ─── Long press handlers ──────────────────────────────────────────────
  const handleTouchStart = (e, folderId) => {
    longPressTimer.current = setTimeout(() => {
      setFolderMenuOpen(folderId);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  const handleTouchMove = () => {
    clearTimeout(longPressTimer.current);
  };

  // ─── Early returns ────────────────────────────────────────────────────
  if (wErr || pErr) { navigate(`/workspace/${workspaceId}/projects`); return null; }
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
        <YourWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Bar */}
        <YourWorkspaceProjectTopBar
          workspaceId={workspaceId}
          project={project}
          brandColor={brandColor}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onSearchOpen={openSearchModal}
          onAddClick={() => activeTab === 'tasks' ? setShowCreateTask(true) : setShowAddMember(true)}
          onMenuOpen={() => setProjectMenuModalOpen(true)}
          isArchivedForMe={isArchivedForMe}
          isTrash={isTrash}
          tasksCount={tasks.length}
          teamCount={activeTeam.length}
        />

        <div className="flex-1 flex overflow-hidden">
          {/* Left panel */}
          <div className={`${mobileShowDetail ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-2/5 lg:w-1/3 border-r border-gray-200/60 dark:border-gray-800/40 bg-white dark:bg-[#0f0f12] h-full`}>
            {activeTab === 'tasks' ? (
              <YourWorkspaceProjectTasks
                tasks={tasks}
                folders={folders}
                selectedFolderId={selectedFolderId}
                onFolderSelect={handleFolderSelect}
                onTaskClick={handleTaskClick}
                selectedTaskId={selectedTaskId}
                brandColor={brandColor}
                canManage={canManage}
                isTrash={isTrash}
                isArchivedForMe={isArchivedForMe}
                onCreateFolder={handleCreateFolder}
                onEditFolder={handleEditFolder}
                onDeleteFolder={handleDeleteFolder}
                onManageReadOnly={handleManageReadOnly}
                onTaskDragStart={handleTaskDragStart}
                onTaskDragEnd={handleTaskDragEnd}
                onTaskDragOver={handleTaskDragOver}
                onTaskDragLeave={handleTaskDragLeave}
                onTaskDrop={handleTaskDrop}
                dragOverTaskId={dragOverTaskId}
                canReorderTasks={canReorderTasks}
              />
            ) : (
              <YourWorkspaceProjectTeam
                projectManagers={projectManagers}
                teamMembers={activeTeam}
                canManage={canManage}
                isTrash={isTrash}
                isArchivedForMe={isArchivedForMe}
                onAddManager={() => setShowAddManager(true)}
                onRemoveManager={handleRemoveManager}
                onAddMember={() => setShowAddMember(true)}
                onRemoveMember={handleRemoveMember}
                brandColor={brandColor}
              />
            )}
          </div>

          {/* Right panel – Task Detail */}
          <div className={`${mobileShowDetail ? 'flex' : 'hidden md:flex'} flex-col flex-1 h-full bg-gray-50 dark:bg-[#0f0f12]`}>
            {activeTask ? (
              <TaskDetailView
                task={activeTask}
                brandColor={brandColor}
                feedbackData={feedbackData}
                isLoading={feedbackLoading}
                userInfo={userInfo}
                onBack={handleBackToList}
                onEdit={handleEditTask}
                onDelete={() => handleDeleteTask(activeTask)}
                onRefresh={refreshAll}
                canManage={canManage}
                onSendReminder={handleSendManualReminder}
                onConfirmCompletion={handleConfirmCompletion}
                onAssignTask={openAssignModal}
                onMarkCompleteClick={() => setShowMarkCompleteModal(true)}          // <-- NEW
                onConfirmCompletionClick={() => setShowConfirmCompletionModal(true)} // <-- NEW
                onSetReadyForCompletion={handleSetReadyForCompletion}
                subDragStart={handleSubDragStart}
                subDragEnd={handleSubDragEnd}
                subDragOver={handleSubDragOver}
                subDrop={handleSubDrop}
                subDragLeave={handleSubDragLeave}
                subDragOverIndex={dragOverSubIdx}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
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

      {!mobileShowDetail && <YourWorkspaceBottombar workspace={workspace} />}

      {/* ─── All modals ──────────────────────────────────────────────── */}
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
        folders={folders}
        onSuccess={() => { refetchTasks(); refetchProject(); refetchFolders(); }}
        onSubmit={handleCreateTaskOptimistic}
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
        folders={folders}
        onSuccess={() => { refetchTasks(); refetchProject(); refetchFolders(); }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Add Manager</h2>
              <button onClick={() => setShowAddManager(false)} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
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
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAddManager(false)} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
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
      <FolderFormModal
        isOpen={showFolderForm}
        onClose={() => { setShowFolderForm(false); setEditingFolder(null); }}
        onSuccess={() => { refetchFolders(); }}
        folder={editingFolder}
        brandColor={brandColor}
        projectId={projectId}
      />
      <FolderReadOnlyModal
        isOpen={showReadOnlyModal}
        onClose={() => { setShowReadOnlyModal(false); setReadOnlyFolder(null); }}
        folder={readOnlyFolder}
        project={project}
        brandColor={brandColor}
        onSuccess={() => { refetchFolders(); }}
      />
      <ProjectMenuModal
        isOpen={projectMenuModalOpen}
        onClose={() => setProjectMenuModalOpen(false)}
        project={project}
        canManage={canManage}
        isArchivedForMe={isArchivedForMe}
        isTrash={isTrash}
        onArchive={handleArchiveProject}
        onUnarchive={handleUnarchiveProject}
        onMoveToTrash={() => {
          setProjectMenuModalOpen(false);
          handleMoveToTrash();
        }}
        onRestore={() => {
          setProjectMenuModalOpen(false);
          handleRestoreProject();
        }}
        onPermanentDelete={() => {
          setProjectMenuModalOpen(false);
          handlePermanentDeleteProject();
        }}
        brandColor={brandColor}
      />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
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

      {/* ─── NEW: Mark Complete Modal ────────────────────────────────── */}
      <MarkCompleteModal
        isOpen={showMarkCompleteModal}
        onClose={() => setShowMarkCompleteModal(false)}
        task={activeTask}
        brandColor={brandColor}
        onSubmit={handleMarkComplete}
      />

      {/* ─── NEW: Confirm/Reject Completion Modal ───────────────────── */}
      <ConfirmCompletionModal
        isOpen={showConfirmCompletionModal}
        onClose={() => setShowConfirmCompletionModal(false)}
        task={activeTask}
        brandColor={brandColor}
        onSubmit={handleConfirmCompletion}
        onReject={handleRejectTask}
      />
    </div>
  );
};

export default YourWorkspaceProjectId;
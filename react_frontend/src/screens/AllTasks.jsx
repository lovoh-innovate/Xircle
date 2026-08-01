// src/workspaceScreens/AllTasks.jsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetWorkspaceProjectsQuery } from '../slices/projectApiSlice';
import {
  useGetProjectTasksQuery,
  useReorderTasksMutation,
} from '../slices/taskApiSlice';
import {
  FaTasks,
  FaFolder,
  FaProjectDiagram,
  FaTimes,
  FaSearch,
  FaGripVertical,
  FaClock,
  FaChevronDown,
  FaChevronRight,
  FaCheck,
  FaSpinner,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// ─── Correct imports ──
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';

// ─── Helpers ──────────────────────────────────────────────────────────
const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ─── Badges ──────────────────────────────────────────────────────────
const TaskStatusBadge = ({ status }) => {
  const map = {
    pending: { label: 'Pending', color: 'bg-gray-200 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700' },
    'in-progress': { label: 'In Progress', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700/50' },
    ready_for_completion: { label: 'Ready', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700/50' },
    completed: { label: 'Completed', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700/50' },
    confirmed_completed: { label: 'Confirmed', color: 'bg-green-200 dark:bg-green-800/50 text-green-800 dark:text-green-200 border-green-400 dark:border-green-600/50' },
  };
  const s = map[status] || map.pending;
  return <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>;
};

const TaskPriorityBadge = ({ priority }) => {
  const map = {
    low: { label: 'Low', color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700/40' },
    medium: { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700/40' },
    high: { label: 'High', color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700/40' },
    urgent: { label: 'Urgent', color: 'text-red-700 dark:text-red-500 bg-red-200 dark:bg-red-900/30 border-red-400 dark:border-red-700/50' },
  };
  const p = map[priority] || map.medium;
  return <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${p.color}`}>{p.label}</span>;
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
      {label && <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm bg-white dark:bg-[#1a1a24] text-gray-800 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600 transition"
      >
        <span className={selected ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
          {selected ? selected.label : placeholder || 'Select...'}
        </span>
        <FaChevronDown className={`text-gray-500 dark:text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700/60 rounded-xl overflow-hidden max-h-60 overflow-y-auto shadow-lg">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-[#0d9488]/10 transition text-left text-gray-700 dark:text-gray-300 ${o.value === value ? 'bg-gray-100 dark:bg-[#0d9488]/10' : ''}`}
            >
              {o.icon && <span className="text-gray-400 dark:text-gray-400">{o.icon}</span>}
              <span>{o.label}</span>
              {o.value === value && <FaCheck className="ml-auto text-xs text-teal-600 dark:text-[#0d9488]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Task Card ─────────────────────────────────────────────────────────
const TaskCard = ({
  task,
  brandColor,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDragLeave,
  dragOver,
  onClick,
  projectName,
}) => {
  const progress = task.progress || 0;
  const subTaskCount = task.subTasks?.length || 0;
  const confirmedCount = (task.subTasks || []).filter(st => st.status === 'confirmed').length || 0;
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = due && due < new Date() && task.status !== 'completed' && task.status !== 'confirmed_completed';
  const assignee = task.assignee;

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => draggable && onDragStart && onDragStart(e, task)}
      onDragEnd={(e) => draggable && onDragEnd && onDragEnd(e, task)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggable && onDragOver) onDragOver(e, task);
      }}
      onDrop={(e) => {
        if (draggable && onDrop) onDrop(e, task);
      }}
      onDragLeave={(e) => {
        if (draggable && onDragLeave) onDragLeave(e);
      }}
      onClick={() => onClick && onClick(task._id)}
      className={`group relative bg-white dark:bg-[#14141a] rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
        dragOver ? 'border-teal-500 dark:border-[#0d9488] bg-teal-50/50 dark:bg-[#0d9488]/5' : 'border-gray-200 dark:border-gray-800/40 hover:border-teal-500 dark:hover:border-[#0d9488]/50'
      } ${draggable ? 'active:cursor-grabbing' : ''}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {draggable && (
              <FaGripVertical className="text-gray-300 dark:text-gray-700 text-xs flex-shrink-0 cursor-grab" />
            )}
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {task.title.charAt(0).toUpperCase()}
            </div>
            <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-gray-900 dark:group-hover:text-white transition">
              {task.title}
            </h4>
          </div>
          <TaskStatusBadge status={task.status} />
        </div>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <TaskPriorityBadge priority={task.priority} />
          {subTaskCount > 0 && (
            <span className="text-[10px] text-gray-500 dark:text-gray-500">• {confirmedCount}/{subTaskCount} done</span>
          )}
          {isOverdue && (
            <span className="text-[10px] text-red-500 dark:text-red-400 flex items-center gap-1">
              <FaClock className="text-[8px]" /> Overdue
            </span>
          )}
          <span className="text-[10px] text-gray-500 dark:text-gray-500 flex items-center gap-1">
            <FaProjectDiagram className="text-[8px]" /> {projectName}
          </span>
        </div>

        {task.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-500">
            {assignee ? `${assignee.name}` : 'Unassigned'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-500">{task.dueDate ? formatDateTime(task.dueDate) : 'No due'}</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: brandColor }}
            />
          </div>
          <span className="text-xs font-mono text-gray-400 dark:text-gray-400">{progress}%</span>
        </div>
      </div>
    </div>
  );
};

// ─── Project Section Component ──────────────────────────────────────
const ProjectSection = ({
  project,
  workspaceId,
  brandColor,
  canManageProject,
  onTaskClick,
  expanded,
  onToggle,
  onTasksLoaded,
  routePrefix,
  filters,
  searchQuery,
}) => {
  const [localTasks, setLocalTasks] = useState([]);
  const [dragState, setDragState] = useState({
    draggedTaskId: null,
    dragOverTaskId: null,
  });
  const [reorderTasks] = useReorderTasksMutation();

  const { data, isLoading, refetch } = useGetProjectTasksQuery(
    { projectId: project._id },
    { skip: !project._id }
  );

  useEffect(() => {
    if (data?.tasks) {
      setLocalTasks(data.tasks);
      if (onTasksLoaded) onTasksLoaded(project._id, data.tasks);
    }
  }, [data, onTasksLoaded, project._id]);

  const displayedTasks = useMemo(() => {
    return localTasks.filter(task => {
      const matchStatus = !filters.status || task.status === filters.status;
      const matchPriority = !filters.priority || task.priority === filters.priority;
      const matchAssignee = !filters.assignee || (task.assignee?._id === filters.assignee);
      const matchSearch = !searchQuery || task.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchPriority && matchAssignee && matchSearch;
    });
  }, [localTasks, filters, searchQuery]);

  const handleDragStart = (e, task) => {
    if (!canManageProject) {
      e.preventDefault();
      toast.error('You do not have permission to reorder tasks in this project.');
      return;
    }
    setDragState({ draggedTaskId: task._id, dragOverTaskId: null });
    e.dataTransfer.setData('text/plain', task._id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDragState({ draggedTaskId: null, dragOverTaskId: null });
  };

  const handleDragOver = (e, task) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragState.draggedTaskId && dragState.draggedTaskId !== task._id) {
      setDragState(prev => ({ ...prev, dragOverTaskId: task._id }));
    }
  };

  const handleDragLeave = () => {
    setDragState(prev => ({ ...prev, dragOverTaskId: null }));
  };

  const handleDrop = async (e, targetTask) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain') || dragState.draggedTaskId;
    if (!draggedId || draggedId === targetTask._id) {
      setDragState({ draggedTaskId: null, dragOverTaskId: null });
      return;
    }

    const draggedIdx = localTasks.findIndex(t => t._id === draggedId);
    const targetIdx = localTasks.findIndex(t => t._id === targetTask._id);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const newOrder = [...localTasks];
    const [moved] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, moved);
    const orderedIds = newOrder.map(t => t._id);

    setLocalTasks(newOrder);
    if (onTasksLoaded) onTasksLoaded(project._id, newOrder);
    setDragState({ draggedTaskId: null, dragOverTaskId: null });

    try {
      await reorderTasks({ projectId: project._id, orderedTaskIds: orderedIds }).unwrap();
      toast.success('Tasks reordered');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to reorder tasks');
      const result = await refetch();
      if (result.data?.tasks) {
        setLocalTasks(result.data.tasks);
        if (onTasksLoaded) onTasksLoaded(project._id, result.data.tasks);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/40 p-4">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-500">
          <FaSpinner className="animate-spin" /> Loading tasks...
        </div>
      </div>
    );
  }

  if (!project._id) return null;

  const totalTasks = localTasks.length;
  const hasDisplayedTasks = displayedTasks.length > 0;

  if (totalTasks === 0) {
    return (
      <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/40 overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-[#1a1a24] cursor-pointer"
          onClick={() => onToggle(project._id)}
        >
          <div className="flex items-center gap-2">
            {expanded ? <FaChevronDown className="text-gray-500 dark:text-gray-400 text-xs" /> : <FaChevronRight className="text-gray-500 dark:text-gray-400 text-xs" />}
            <FaFolder className="text-teal-600 dark:text-[#0d9488] text-sm" />
            <span className="font-medium text-gray-800 dark:text-gray-200">{project.name}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/60 px-2 py-0.5 rounded-full">
              0 tasks
            </span>
          </div>
        </div>
        {expanded && (
          <div className="p-4 text-center text-gray-500 dark:text-gray-500 text-sm">
            No tasks in this project
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/40 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-[#1a1a24] cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
        onClick={() => onToggle(project._id)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <FaChevronDown className="text-gray-500 dark:text-gray-400 text-xs" /> : <FaChevronRight className="text-gray-500 dark:text-gray-400 text-xs" />}
          <FaFolder className="text-teal-600 dark:text-[#0d9488] text-sm" />
          <span className="font-medium text-gray-800 dark:text-gray-200">{project.name}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/60 px-2 py-0.5 rounded-full">
            {totalTasks} tasks
          </span>
          {canManageProject && (
            <span className="text-xs text-teal-600 dark:text-[#0d9488] flex items-center gap-1 ml-2">
              <FaGripVertical className="text-[10px]" /> Drag to reorder
            </span>
          )}
          {!hasDisplayedTasks && totalTasks > 0 && (
            <span className="text-xs text-orange-500 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">
              Filtered out
            </span>
          )}
        </div>
        <Link
          to={`/${routePrefix}/${workspaceId}/project/${project._id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-[#0d9488] transition"
        >
          View Project →
        </Link>
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          {!hasDisplayedTasks ? (
            <div className="text-center text-gray-500 dark:text-gray-500 text-sm py-4">
              No tasks match the current filters
            </div>
          ) : (
            displayedTasks.map(task => {
              const isDragOver =
                dragState.dragOverTaskId === task._id &&
                dragState.draggedTaskId !== task._id;
              return (
                <TaskCard
                  key={task._id}
                  task={task}
                  brandColor={brandColor}
                  draggable={canManageProject}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  dragOver={isDragOver}
                  onClick={(taskId) => onTaskClick(taskId, project._id)}
                  projectName={project.name}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
const AllTasks = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { userInfo } = useSelector((state) => state.auth);

  const path = location.pathname;
  const isMyWorkspace = path.startsWith('/my-workspace');
  const routePrefix = isMyWorkspace ? 'my-workspace' : 'workspace';

  const { data: workspaceData, isLoading: wLoading } = useGetWorkspaceQuery(workspaceId);
  const workspace = workspaceData?.workspace;
  const brandColor = workspace?.color || '#0d9488';

  const { data: projectsData, isLoading: pLoading } = useGetWorkspaceProjectsQuery({ workspaceId });
  const projects = projectsData?.projects || [];

  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    assignee: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProjects, setExpandedProjects] = useState({});

  const [allTasksMap, setAllTasksMap] = useState({});
  const handleTasksLoaded = (projectId, tasks) => {
    setAllTasksMap(prev => ({ ...prev, [projectId]: tasks }));
  };

  const isOwner = workspace?.owner?._id === userInfo?._id || workspace?.owner === userInfo?._id;
  const isProjectManager = (project) =>
    project.projectManagers?.some(pm => (pm._id || pm)?.toString() === userInfo?._id);
  const canManageProject = (project) => isOwner || isProjectManager(project);

  const allTasks = useMemo(() => {
    const flat = [];
    projects.forEach(project => {
      const tasks = allTasksMap[project._id] || [];
      tasks.forEach(task => {
        flat.push({
          ...task,
          _projectId: project._id,
          _projectName: project.name,
        });
      });
    });
    return flat;
  }, [projects, allTasksMap]);

  const toggleProject = (projectId) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'ready_for_completion', label: 'Ready' },
    { value: 'completed', label: 'Completed' },
    { value: 'confirmed_completed', label: 'Confirmed' },
  ];
  const priorityOptions = [
    { value: '', label: 'All Priorities' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  const assigneeOptions = useMemo(() => {
    const set = new Set();
    const opts = [{ value: '', label: 'All Assignees' }];
    allTasks.forEach(task => {
      if (task.assignee?._id && !set.has(task.assignee._id)) {
        set.add(task.assignee._id);
        opts.push({ value: task.assignee._id, label: task.assignee.name || 'Unknown' });
      }
    });
    return opts;
  }, [allTasks]);

  const loading = wLoading || pLoading;

  const Sidebar = isMyWorkspace ? MyWorkspaceSidebar : YourWorkspaceSidebar;
  const Bottombar = isMyWorkspace ? MyWorkspaceBottombar : YourWorkspaceBottombar;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: brandColor }} />
      </div>
    );
  }

  if (!workspace) {
    return <div className="p-8 text-center text-gray-500">Workspace not found.</div>;
  }

  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      {/* ─── Sidebar – hidden on mobile, visible on lg+ ─── */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <Sidebar workspace={workspace} />
      </div>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800/40 flex-shrink-0 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <FaTasks className="text-teal-600 dark:text-[#0d9488]" /> All Tasks
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {allTasks.length} tasks across {projects.length} projects
              </p>
            </div>
            <button
              onClick={() => navigate(`/${routePrefix}/${workspaceId}/projects`)}
              className="px-3 py-1.5 text-sm bg-teal-600 dark:bg-[#0d9488] text-white rounded-xl hover:bg-teal-700 dark:hover:bg-[#0f9e96] transition"
            >
              Go to Projects
            </button>
          </div>

          {/* ── Filters ── */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-[#1a1a24] border border-gray-300 dark:border-gray-700/60 rounded-xl px-3 py-1.5 flex-1 min-w-[180px]">
              <FaSearch className="text-gray-400 dark:text-gray-500 text-xs" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-sm text-gray-800 dark:text-gray-200 w-full placeholder-gray-500 dark:placeholder-gray-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <FaTimes className="text-xs" />
                </button>
              )}
            </div>

            <CustomDropdown
              label="Status"
              options={statusOptions}
              value={filters.status}
              onChange={(val) => setFilters(prev => ({ ...prev, status: val }))}
              brandColor={brandColor}
            />
            <CustomDropdown
              label="Priority"
              options={priorityOptions}
              value={filters.priority}
              onChange={(val) => setFilters(prev => ({ ...prev, priority: val }))}
              brandColor={brandColor}
            />
            <CustomDropdown
              label="Assignee"
              options={assigneeOptions}
              value={filters.assignee}
              onChange={(val) => setFilters(prev => ({ ...prev, assignee: val }))}
              brandColor={brandColor}
            />
            {(filters.status || filters.priority || filters.assignee || searchQuery) && (
              <button
                onClick={() => setFilters({ status: '', priority: '', assignee: '' })}
                className="text-xs text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-500">
              <FaFolder className="text-5xl mb-4 opacity-30" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No projects yet</p>
              <p className="text-sm mt-1 text-gray-500 dark:text-gray-400">Create a project to get started.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {projects.map(project => {
                const isExpanded = expandedProjects[project._id] !== false;
                const canManage = canManageProject(project);

                return (
                  <ProjectSection
                    key={project._id}
                    project={project}
                    workspaceId={workspaceId}
                    brandColor={brandColor}
                    canManageProject={canManage}
                    onTaskClick={(taskId, projId) => {
                      navigate(`/${routePrefix}/${workspaceId}/project/${projId}`, {
                        state: { selectedTaskId: taskId },
                      });
                    }}
                    expanded={isExpanded}
                    onToggle={toggleProject}
                    onTasksLoaded={handleTasksLoaded}
                    routePrefix={routePrefix}
                    filters={filters}
                    searchQuery={searchQuery}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Bottombar – only visible on mobile ─── */}
      <div className="lg:hidden">
        <Bottombar workspace={workspace} />
      </div>
    </div>
  );
};

export default AllTasks;
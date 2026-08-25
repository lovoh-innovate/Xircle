// src/workspaceScreens/MyWorkspaceProjects.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import {
  useGetWorkspaceProjectsQuery,
  useDeleteProjectMutation,
  useCreateProjectMutation,
  useArchiveProjectMutation,
  useUnarchiveProjectMutation,
  useRestoreProjectMutation,
  usePermanentlyDeleteProjectMutation,
  useGetProjectByIdQuery,
  useUpdateProjectMutation,
} from '../slices/projectApiSlice';
import { useGetProjectTasksQuery } from '../slices/taskApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
import {
  FaPlus,
  FaFolder,
  FaUsers,
  FaSearch,
  FaTasks,
  FaTrashAlt,
  FaEdit,
  FaEllipsisV,
  FaTimes,
  FaArrowLeft,
  FaSpinner,
  FaCheckCircle,
  FaClock,
  FaRocket,
  FaFilter,
  FaChevronDown,
  FaChartPie,
  FaArchive,
  FaUndo,
  FaTrashRestore,
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';

// Helper: treat progress >= 100 as completed
const isProjectCompleted = (p) => p.status === 'completed' || (p.progress || 0) >= 100;

// ─── Confirm Modal ──────────────────────────────────────────────────────
const ConfirmModal = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmColor = 'bg-red-600 hover:bg-red-700',
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-sm w-full p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition ${confirmColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Filter Drawer (mobile) ─────────────────────────────────────────────
const FilterDrawer = ({ isOpen, onClose, filters, setFilters, view, setView, isOwner }) => {
  if (!isOpen) return null;
  const statuses = view === 'active'
    ? ['all', 'planning', 'in-progress', 'completed']
    : [];

  return (
    <div className="fixed inset-0 z-40 bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm flex justify-end">
      <div className="w-72 max-w-full h-full bg-white dark:bg-[#14141a] border-l border-gray-200 dark:border-gray-800/60 p-6 overflow-y-auto animate-slide-in-right">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Filters</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">
            <FaTimes />
          </button>
        </div>

        {/* View tabs */}
        <div className="mb-4">
          <label className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wider">View</label>
          <div className="mt-1 flex gap-1">
            <button
              onClick={() => setView('active')}
              className={`flex-1 py-1.5 text-xs rounded-lg ${view === 'active' ? 'bg-[#0d9488]/20 text-[#0d9488] border border-[#0d9488]/30' : 'text-gray-500 bg-gray-100 dark:bg-[#1a1a24] border border-gray-300 dark:border-gray-800/40'}`}
            >
              All
            </button>
            <button
              onClick={() => setView('archived')}
              className={`flex-1 py-1.5 text-xs rounded-lg ${view === 'archived' ? 'bg-[#0d9488]/20 text-[#0d9488] border border-[#0d9488]/30' : 'text-gray-500 bg-gray-100 dark:bg-[#1a1a24] border border-gray-300 dark:border-gray-800/40'}`}
            >
              Archived
            </button>
            {isOwner && (
              <button
                onClick={() => setView('trash')}
                className={`flex-1 py-1.5 text-xs rounded-lg ${view === 'trash' ? 'bg-[#0d9488]/20 text-[#0d9488] border border-[#0d9488]/30' : 'text-gray-500 bg-gray-100 dark:bg-[#1a1a24] border border-gray-300 dark:border-gray-800/40'}`}
              >
                Trash
              </button>
            )}
          </div>
        </div>

        {/* Status filter – only for active view */}
        {view === 'active' && statuses.length > 0 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wider">Status</label>
              <div className="mt-2 space-y-1">
                {statuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilters({ ...filters, status })}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${
                      filters.status === status
                        ? 'bg-[#0d9488]/20 text-[#0d9488] border border-[#0d9488]/30'
                        : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30'
                    }`}
                  >
                    {status === 'all' ? 'All Projects' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wider">Sort By</label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                className="w-full bg-white dark:bg-[#1e1e26] border border-gray-300 dark:border-gray-800/60 rounded-xl px-3 py-2 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#0d9488]/50 mt-2"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="progress">Progress</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        )}

        <button
          onClick={() => setFilters({ status: 'all', sort: 'newest' })}
          className="w-full mt-4 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
};

// ─── Search Projects Modal ──────────────────────────────────────────────
const SearchProjectsModal = ({ isOpen, onClose, projects, brandColor, workspaceId }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  if (!isOpen) return null;

  const filtered = projects.filter(
    (p) =>
      p.name?.toLowerCase().includes(query.toLowerCase()) ||
      p.description?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-white/90 dark:bg-[#0b0b10]/90 backdrop-blur-xl flex flex-col">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200/60 dark:border-gray-800/60 bg-gray-50 dark:bg-[#14141a]/80">
        <button onClick={onClose} className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
          <FaArrowLeft />
        </button>
        <div className="flex-1 bg-gray-100 dark:bg-[#1e1e26] rounded-2xl px-4 py-2 flex items-center gap-3 border border-gray-300 dark:border-gray-800/40 focus-within:border-[#0d9488]/50 transition">
          <FaSearch className="text-gray-400 dark:text-gray-500 text-xs" />
          <input
            type="text"
            placeholder="Search projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent w-full outline-none text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <FaTimes className="text-xs" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {!query && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <FaSearch className="text-5xl mb-3 opacity-20" />
            <p className="text-sm">Search projects by name or description</p>
          </div>
        )}
        {query && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <p className="text-sm">No results for "{query}"</p>
          </div>
        )}
        {query && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((project) => (
              <div
                key={project._id}
                onClick={() => {
                  onClose();
                  navigate(`/my-workspace/${workspaceId}/project/${project._id}`);
                }}
                className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-[#14141a] rounded-xl border border-gray-200 dark:border-gray-800/40 hover:border-[#0d9488]/40 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition cursor-pointer group"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
                >
                  <FaFolder className="text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition">
                    {project.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                    {project.description || 'No description'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Create Project Modal ─────────────────────────────────────────────
const CreateProjectModal = ({ workspace, isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const brandColor = workspace?.color || '#0d9488';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }
    const tempId = `temp-${Date.now()}`;
    const optimisticProject = {
      _id: tempId,
      name: name.trim(),
      description: description.trim(),
      workspaceId: workspace._id,
      status: 'planning',
      progress: 0,
      isArchivedForMe: false,
      isTrash: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      teamMembers: [],
      coverImage: null,
    };
    onCreate(optimisticProject);
    onClose();
    setName('');
    setDescription('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            <FaPlus className="inline mr-2 text-[#0d9488]" /> New Project
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Project Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80"
              style={{ backgroundColor: brandColor }}
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Edit Project Modal (bottom sheet on mobile, centered on desktop) ──
const EditProjectModal = ({ isOpen, onClose, projectId, workspaceId, brandColor, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [updateProject] = useUpdateProjectMutation();

  const { data: projectData, isLoading: projectLoading } = useGetProjectByIdQuery(projectId, {
    skip: !isOpen || !projectId,
  });

  useEffect(() => {
    if (projectData?.project) {
      const p = projectData.project;
      setName(p.name || '');
      setDescription(p.description || '');
      setStatus(p.status || 'planning');
      setPriority(p.priority || 'medium');
      setStartDate(p.startDate ? new Date(p.startDate).toISOString().slice(0, 16) : '');
      setEndDate(p.endDate ? new Date(p.endDate).toISOString().slice(0, 16) : '');
    }
  }, [projectData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('description', description.trim());
      fd.append('status', status);
      fd.append('priority', priority);
      if (startDate) fd.append('startDate', startDate);
      if (endDate) fd.append('endDate', endDate);
      await updateProject({ projectId, data: fd }).unwrap();
      toast.success('Project updated');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update project');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isMobile = window.innerWidth < 768;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-2xl md:rounded-2xl w-full md:max-w-md ${isMobile ? 'max-h-[90vh]' : 'max-h-[90vh]'} overflow-y-auto transform transition-transform duration-300 ${
          isMobile ? 'mt-auto' : 'mx-auto'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
              <FaEdit className="inline mr-2 text-[#0d9488]" /> Edit Project
            </h2>
            <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition">
              <FaTimes />
            </button>
          </div>

          {projectLoading ? (
            <div className="flex justify-center py-8">
              <FaSpinner className="animate-spin text-2xl text-[#0d9488]" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Project Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
                >
                  <option value="planning">Planning</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Start Date</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">End Date</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80"
                  style={{ backgroundColor: brandColor }}
                >
                  {loading ? 'Updating...' : 'Update Project'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Project Menu Modal (bottom sheet on mobile, centered on desktop) ──
const ProjectMenuModal = ({
  isOpen,
  onClose,
  project,
  isOwner,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  onPermanentDelete,
  onRestore,
  brandColor,
}) => {
  if (!isOpen || !project) return null;

  const isTrashed = project.isTrash;
  const isArchivedForMe = project.isArchivedForMe;
  const isTemp = project._id?.startsWith?.('temp-');

  const handleAction = (action) => {
    onClose();
    action();
  };

  const isMobile = window.innerWidth < 768;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-2xl md:rounded-2xl w-full md:max-w-sm ${isMobile ? 'max-h-[80vh]' : 'max-h-[80vh]'} overflow-y-auto transform transition-transform duration-300 ${
          isMobile ? 'mt-auto' : 'mx-auto'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 truncate pr-4">
              {project.name}
            </h3>
            <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition flex-shrink-0">
              <FaTimes />
            </button>
          </div>

          <div className="space-y-1">
            {isTrashed ? (
              <>
                <button
                  onClick={() => handleAction(onRestore)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[#0d9488] hover:bg-[#0d9488]/10 transition"
                >
                  <FaTrashRestore className="text-sm" />
                  <span className="text-sm font-medium">Restore</span>
                </button>
                <button
                  onClick={() => handleAction(onPermanentDelete)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-500/10 transition"
                >
                  <FaTrashAlt className="text-sm" />
                  <span className="text-sm font-medium">Delete Permanently</span>
                </button>
              </>
            ) : (
              <>
                {!isTemp && (
                  <button
                    onClick={() => handleAction(() => onEdit(project._id))}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
                  >
                    <FaEdit className="text-sm text-[#0d9488]" />
                    <span className="text-sm font-medium">Edit</span>
                  </button>
                )}
                {isArchivedForMe ? (
                  <button
                    onClick={() => handleAction(onUnarchive)}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[#0d9488] hover:bg-[#0d9488]/10 transition"
                  >
                    <FaUndo className="text-sm" />
                    <span className="text-sm font-medium">Unarchive</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction(onArchive)}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 transition"
                  >
                    <FaArchive className="text-sm" />
                    <span className="text-sm font-medium">Archive for me</span>
                  </button>
                )}
                {isOwner && !isTemp && (
                  <button
                    onClick={() => handleAction(onDelete)}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10 transition"
                  >
                    <FaTrashAlt className="text-sm" />
                    <span className="text-sm font-medium">Move to Trash</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Project Card ──────────────────────────────────────────────────────
const ProjectCard = ({
  project,
  brandColor,
  workspaceId,
  isOwner,
  onDelete,
  onPermanentDelete,
  onRestore,
  onArchive,
  onUnarchive,
  onEdit,
  onMenuOpen,
}) => {
  const progress = project.progress || 0;
  const completed = isProjectCompleted(project);
  const statusLabels = {
    planning: 'Planning',
    'in-progress': 'In Progress',
    completed: 'Completed',
    archived: 'Archived',
  };
  const statusColor = {
    planning: 'text-blue-600 dark:text-blue-400',
    'in-progress': 'text-yellow-600 dark:text-yellow-400',
    completed: 'text-green-600 dark:text-green-400',
    archived: 'text-gray-500 dark:text-gray-400',
  };
  const displayStatus = completed ? 'completed' : project.status;

  const { data: taskData, isLoading: taskLoading } = useGetProjectTasksQuery(
    { projectId: project._id },
    { skip: project.isTrash || project._id?.startsWith?.('temp-') }
  );
  const tasks = taskData?.tasks || [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(
    (t) => t.status === 'completed' || t.status === 'confirmed_completed'
  ).length;

  const stopProp = (e) => e.stopPropagation();

  const handleCardClick = () => {
    if (!project._id?.startsWith?.('temp-')) {
      window.__navigate(`/my-workspace/${workspaceId}/project/${project._id}`);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/40 hover:border-[#0d9488]/50 transition-all duration-500 hover:shadow-[0_8px_40px_rgba(13,148,136,0.15)] active:scale-[0.98] cursor-pointer overflow-hidden ${
        project._id?.startsWith?.('temp-') ? 'opacity-70' : ''
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d9488]/0 via-[#0d9488]/0 to-transparent group-hover:from-[#0d9488]/10 group-hover:via-[#0d9488]/5 transition-all duration-700 pointer-events-none" />
      <div className="relative h-20 md:h-28 bg-gray-100 dark:bg-[#1a1a24] overflow-hidden">
        {project.coverImage ? (
          <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}>
            <FaFolder className="text-2xl md:text-3xl" style={{ color: brandColor }} />
          </div>
        )}
        <span className={`absolute top-2 right-2 text-[10px] font-medium px-2.5 py-1 rounded-full backdrop-blur-sm border ${statusColor[displayStatus]} bg-white/60 dark:bg-black/30 border-gray-200 dark:border-gray-700/50 pointer-events-none`}>
          {statusLabels[displayStatus] || 'Planning'}
        </span>

        {/* Menu button */}
        <button
          onClick={(e) => { stopProp(e); onMenuOpen(project); }}
          className="absolute top-2 left-2 p-1.5 bg-white/60 dark:bg-black/40 backdrop-blur-sm rounded-lg text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-black/60 transition z-10"
        >
          <FaEllipsisV className="text-xs" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 md:p-4">
        <h3 className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition truncate">
          {project.name}
          {project._id?.startsWith?.('temp-') && (
            <span className="ml-2 text-[10px] text-gray-400 dark:text-gray-500">(Creating...)</span>
          )}
        </h3>
        {project.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 md:line-clamp-2 mt-0.5 md:mt-1">
            {project.description}
          </p>
        )}
        <div className="flex items-center mt-2 md:mt-3 gap-1">
          <div className="flex -space-x-2">
            {(project.teamMembers || []).slice(0, 4).map((member, idx) => (
              <div
                key={idx}
                className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-gray-300 dark:border-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[7px] md:text-[8px] font-bold text-white"
                style={{ backgroundColor: member?.profile ? 'transparent' : brandColor }}
              >
                {member?.profile ? (
                  <img src={member.profile} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  (member?.name?.charAt(0) || '?').toUpperCase()
                )}
              </div>
            ))}
            {(project.teamMembers || []).length > 4 && (
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-gray-300 dark:border-gray-800 bg-gray-200 dark:bg-[#1e1e26] flex items-center justify-center text-[7px] md:text-[8px] text-gray-600 dark:text-gray-400">
                +{(project.teamMembers || []).length - 4}
              </div>
            )}
          </div>
          <span className="text-[9px] md:text-[10px] text-gray-500 dark:text-gray-500 ml-1">
            {(project.teamMembers || []).length} members
          </span>
        </div>
        {!project.isTrash && (
          <>
            <div className="mt-2 md:mt-3 relative">
              <div className="flex justify-between text-[9px] md:text-[10px] text-gray-500 dark:text-gray-500 mb-0.5 md:mb-1">
                <span>Progress</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <div className="w-full h-1 md:h-1.5 bg-gray-200 dark:bg-gray-800/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%`, backgroundColor: brandColor, boxShadow: `0 0 12px ${brandColor}88` }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2 md:mt-3 text-[9px] md:text-[10px] text-gray-500 dark:text-gray-500 pointer-events-none">
              <span className="flex items-center gap-1">
                <FaTasks className="text-[8px] md:text-[10px] text-[#0d9488]" />
                {taskLoading ? <FaSpinner className="animate-spin text-[10px]" /> : totalTasks}
              </span>
              <span className="flex items-center gap-1">
                <FaCheckCircle className="text-[8px] md:text-[10px] text-green-500 dark:text-green-400" />
                {taskLoading ? '...' : completedTasks}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────
const MyWorkspaceProjects = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editProjectId, setEditProjectId] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [filters, setFilters] = useState({ status: 'all', sort: 'newest', search: '' });
  const [view, setView] = useState('active');

  // Local projects state for optimistic updates
  const [projects, setProjects] = useState([]);
  const [backupProjects, setBackupProjects] = useState([]);

  // Fetch workspace and projects
  const { data: workspaceData, isLoading: workspaceLoading, error: workspaceError } = useGetWorkspaceQuery(workspaceId);
  const queryArgs = {
    workspaceId,
    archived: view === 'archived' ? 'true' : undefined,
    trash: view === 'trash' ? 'true' : undefined,
  };
  const { data: projectsData, isLoading: projectsLoading, refetch: refetchProjects } = useGetWorkspaceProjectsQuery(queryArgs);

  // Mutations
  const [createProject] = useCreateProjectMutation();
  const [deleteProject] = useDeleteProjectMutation();
  const [permanentlyDeleteProject] = usePermanentlyDeleteProjectMutation();
  const [restoreProject] = useRestoreProjectMutation();
  const [archiveProject] = useArchiveProjectMutation();
  const [unarchiveProject] = useUnarchiveProjectMutation();

  useEffect(() => {
    if (projectsData?.projects) {
      setProjects(projectsData.projects);
      setBackupProjects(projectsData.projects);
    }
  }, [projectsData]);

  const workspace = workspaceData?.workspace;
  const brandColor = workspace?.color || '#0d9488';

  const ownerId = workspace?.owner?._id || workspace?.owner;
  const isOwner = !!ownerId && !!userInfo?._id && String(ownerId) === String(userInfo._id);

  if (workspaceError) { navigate('/my-workspaces'); return null; }
  if (workspaceLoading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: brandColor, borderTopColor: 'transparent' }} />
          <p className="mt-3 text-gray-500 dark:text-gray-500 text-sm">Loading projects...</p>
        </div>
      </div>
    );
  }
  if (!workspace) return null;

  // ─── Optimistic update helpers ──────────────────────────────────────
  const saveBackup = () => setBackupProjects([...projects]);
  const rollback = () => setProjects([...backupProjects]);

  // ─── Create handler ──────────────────────────────────────────────────
  const handleCreateOptimistic = (optimisticProject) => {
    saveBackup();
    setProjects([optimisticProject, ...projects]);

    const fd = new FormData();
    fd.append('workspaceId', workspace._id);
    fd.append('name', optimisticProject.name);
    fd.append('description', optimisticProject.description || '');

    createProject({ workspaceId: workspace._id, data: fd })
      .unwrap()
      .then((newProject) => {
        setProjects((prev) =>
          prev.map((p) =>
            p._id === optimisticProject._id ? { ...newProject } : p
          )
        );
        toast.success('Project created!');
      })
      .catch((err) => {
        toast.error(err?.data?.message || 'Failed to create project');
        setProjects((prev) => prev.filter((p) => p._id !== optimisticProject._id));
      });
  };

  // ─── Delete (move to trash) ──────────────────────────────────────────
  const handleDeleteProject = (projectId) => {
    saveBackup();
    setProjects((prev) => prev.filter((p) => p._id !== projectId));

    deleteProject(projectId)
      .unwrap()
      .then(() => {
        toast.success('Project moved to trash.');
        refetchProjects();
      })
      .catch((err) => {
        toast.error(err?.data?.message || 'Failed to move project');
        rollback();
      });
  };

  // ─── Permanent Delete ──────────────────────────────────────────────
  const handlePermanentDelete = (projectId) => {
    saveBackup();
    setProjects((prev) => prev.filter((p) => p._id !== projectId));

    permanentlyDeleteProject(projectId)
      .unwrap()
      .then(() => {
        toast.success('Project permanently deleted.');
        refetchProjects();
      })
      .catch((err) => {
        toast.error(err?.data?.message || 'Failed to delete project');
        rollback();
      });
  };

  // ─── Restore ────────────────────────────────────────────────────────
  const handleRestore = (projectId) => {
    saveBackup();
    setProjects((prev) => prev.filter((p) => p._id !== projectId));

    restoreProject(projectId)
      .unwrap()
      .then(() => {
        toast.success('Project restored.');
        refetchProjects();
      })
      .catch((err) => {
        toast.error(err?.data?.message || 'Failed to restore project');
        rollback();
      });
  };

  // ─── Archive ────────────────────────────────────────────────────────
  const handleArchive = (projectId) => {
    saveBackup();
    setProjects((prev) => prev.filter((p) => p._id !== projectId));

    archiveProject(projectId)
      .unwrap()
      .then(() => {
        toast.success('Project archived.');
        refetchProjects();
      })
      .catch((err) => {
        toast.error(err?.data?.message || 'Failed to archive project');
        rollback();
      });
  };

  // ─── Unarchive ──────────────────────────────────────────────────────
  const handleUnarchive = (projectId) => {
    saveBackup();
    setProjects((prev) => prev.filter((p) => p._id !== projectId));

    unarchiveProject(projectId)
      .unwrap()
      .then(() => {
        toast.success('Project unarchived.');
        refetchProjects();
      })
      .catch((err) => {
        toast.error(err?.data?.message || 'Failed to unarchive project');
        rollback();
      });
  };

  // ─── Edit handler ──────────────────────────────────────────────────
  const handleEdit = (projectId) => {
    setEditProjectId(projectId);
  };

  const handleEditSuccess = () => {
    refetchProjects();
    setEditProjectId(null);
  };

  // ─── Menu modal handlers ──────────────────────────────────────────
  const handleMenuOpen = (project) => {
    setSelectedProject(project);
    setMenuModalOpen(true);
  };

  const handleMenuClose = () => {
    setMenuModalOpen(false);
    setSelectedProject(null);
  };

  // ─── Filter and sort projects ────────────────────────────────────────
  const displayedProjects = projects.filter((p) => {
    if (view === 'active') return !p.isArchivedForMe && !p.isTrash;
    if (view === 'archived') return p.isArchivedForMe && !p.isTrash;
    if (view === 'trash') return p.isTrash;
    return true;
  });

  const activeProjectsList = displayedProjects.filter(p => !p.isTrash);
  const totalProjects = activeProjectsList.length;
  const completedProjects = activeProjectsList.filter(isProjectCompleted).length;
  const inProgressProjects = activeProjectsList.filter(p => !isProjectCompleted(p) && p.status === 'in-progress').length;
  const planningProjects = activeProjectsList.filter(p => !isProjectCompleted(p) && p.status === 'planning').length;
  const overallProgress = totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0;

  const filteredProjects = displayedProjects
    .filter((p) => {
      if (view !== 'active') return true;
      if (filters.status !== 'all') {
        if (filters.status === 'completed' ? !isProjectCompleted(p) : p.status !== filters.status) {
          return false;
        }
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
      }
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (filters.sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (filters.sort === 'progress') return (b.progress || 0) - (a.progress || 0);
      if (filters.sort === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  const activeProjects = [...activeProjectsList]
    .filter(p => !isProjectCompleted(p))
    .sort((a, b) => (b.progress || 0) - (a.progress || 0))
    .slice(0, 3);

  const recentActivity = projects.slice(0, 5).map(p => ({
    id: p._id,
    projectName: p.name,
    action: p.updatedAt ? 'updated' : 'created',
    time: p.updatedAt || p.createdAt,
  })).sort((a, b) => new Date(b.time) - new Date(a.time));

  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-4 h-14 lg:h-16">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(`/my-workspace/${workspaceId}`)} className="p-1 lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
                <FaArrowLeft />
              </button>
              <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 tracking-tight">Projects</h1>
              <span className="text-xs font-normal text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-[#1a1a24] px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-800/40">
                {projects.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center bg-gray-100 dark:bg-[#1a1a24] border border-gray-300 dark:border-gray-800/60 rounded-full px-3 py-1.5 gap-2 focus-within:border-[#0d9488]/50 transition">
                <FaSearch className="text-gray-400 dark:text-gray-500 text-xs" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  className="bg-transparent outline-none text-sm text-gray-800 dark:text-gray-200 w-32 lg:w-48"
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
                {filters.search && (
                  <button onClick={() => setFilters({ ...filters, search: '' })} className="text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    <FaTimes className="text-xs" />
                  </button>
                )}
              </div>
              <button onClick={() => setFilterDrawerOpen(true)} className="hidden md:flex items-center gap-1.5 bg-gray-100 dark:bg-[#1a1a24] border border-gray-300 dark:border-gray-800/60 rounded-full px-3 py-1.5 text-xs text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-600 transition">
                <FaFilter className="text-[10px]" /> Filter <FaChevronDown className="text-[8px] ml-1" />
              </button>
              <button onClick={() => setSearchOpen(true)} className="md:hidden p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition">
                <FaSearch className="text-sm" />
              </button>
              <button onClick={() => setFilterDrawerOpen(true)} className="md:hidden p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition">
                <FaFilter className="text-sm" />
              </button>
              {isOwner && (
                <button onClick={() => setShowCreateModal(true)} className="bg-[#0d9488] hover:bg-[#0f9e96] text-white text-sm font-medium px-3 py-1.5 rounded-xl transition flex items-center gap-1.5">
                  <FaPlus className="text-xs" /> <span className="hidden sm:inline">New</span>
                </button>
              )}
            </div>
          </div>

          {/* View tabs + status chips */}
          <div className="flex items-center justify-between px-4 pb-2">
            <div className="flex gap-1">
              {['active', 'archived', ...(isOwner ? ['trash'] : [])].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setView(tab)}
                  className={`text-xs px-3 py-1 rounded-full transition ${
                    view === tab ? 'bg-[#0d9488]/20 text-[#0d9488] border border-[#0d9488]/30' : 'text-gray-600 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                  }`}
                >
                  {tab === 'active' ? 'All' : tab === 'archived' ? 'Archived' : 'Trash'}
                </button>
              ))}
            </div>
            {view === 'active' && (
              <div className="hidden md:flex items-center gap-2 overflow-x-auto">
                {['all', 'planning', 'in-progress', 'completed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilters({ ...filters, status })}
                    className={`text-xs px-3 py-1 rounded-full transition whitespace-nowrap ${
                      filters.status === status ? 'bg-[#0d9488]/20 text-[#0d9488] border border-[#0d9488]/30' : 'text-gray-600 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 border border-transparent hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-28 md:pb-6">
          {/* Mobile Stats */}
          {view === 'active' && (
            <div className="md:hidden mb-4">
              <div className="relative bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/40 p-4 overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#0d9488]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <FaChartPie className="text-[#0d9488]" /> Overview
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    {completedProjects}/{totalProjects} done
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-100 dark:bg-[#1a1a24] rounded-xl p-3 border border-gray-200 dark:border-gray-800/30">
                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{totalProjects}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <FaFolder className="text-[10px] text-[#0d9488]" /> Total
                    </p>
                  </div>
                  <div className="bg-gray-100 dark:bg-[#1a1a24] rounded-xl p-3 border border-blue-200 dark:border-blue-500/20">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{planningProjects}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <FaClock className="text-[10px] text-blue-600 dark:text-blue-400" /> Planning
                    </p>
                  </div>
                  <div className="bg-gray-100 dark:bg-[#1a1a24] rounded-xl p-3 border border-yellow-200 dark:border-yellow-500/20">
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{inProgressProjects}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <FaSpinner className="text-[10px] text-yellow-600 dark:text-yellow-400" /> In Progress
                    </p>
                  </div>
                  <div className="bg-gray-100 dark:bg-[#1a1a24] rounded-xl p-3 border border-green-200 dark:border-green-500/20">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedProjects}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <FaCheckCircle className="text-[10px] text-green-600 dark:text-green-400" /> Completed
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-500 mb-1">
                    <span>Overall progress</span>
                    <span className="font-mono">{overallProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800/60 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${overallProgress}%`, backgroundColor: brandColor }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Stats */}
          {view === 'active' && (
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="bg-white dark:bg-[#14141a] rounded-xl border border-gray-200 dark:border-gray-800/40 p-4 backdrop-blur-sm hover:border-[#0d9488]/30 transition group">
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 group-hover:text-[#0d9488] transition">{totalProjects}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider">Total</p>
              </div>
              <div className="bg-white dark:bg-[#14141a] rounded-xl border border-gray-200 dark:border-gray-800/40 p-4 hover:border-blue-400 dark:hover:border-blue-500/30 transition group">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-500 dark:group-hover:text-blue-300 transition">{planningProjects}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider">Planning</p>
              </div>
              <div className="bg-white dark:bg-[#14141a] rounded-xl border border-gray-200 dark:border-gray-800/40 p-4 hover:border-yellow-400 dark:hover:border-yellow-500/30 transition group">
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 group-hover:text-yellow-500 dark:group-hover:text-yellow-300 transition">{inProgressProjects}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider">In Progress</p>
              </div>
              <div className="bg-white dark:bg-[#14141a] rounded-xl border border-gray-200 dark:border-gray-800/40 p-4 hover:border-green-400 dark:hover:border-green-500/30 transition group">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 group-hover:text-green-500 dark:group-hover:text-green-300 transition">{completedProjects}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider">Completed</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-500">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 flex items-center justify-center mb-4">
                    <FaFolder className="text-3xl text-gray-400 dark:text-gray-700" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">No projects</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-600 mt-1">
                    {view === 'trash' ? 'Trash is empty' : view === 'archived' ? 'No archived projects' : 'No projects match your filters'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredProjects.map((project) => (
                    <ProjectCard
                      key={project._id}
                      project={project}
                      brandColor={brandColor}
                      workspaceId={workspaceId}
                      isOwner={isOwner}
                      onDelete={handleDeleteProject}
                      onPermanentDelete={handlePermanentDelete}
                      onRestore={handleRestore}
                      onArchive={handleArchive}
                      onUnarchive={handleUnarchive}
                      onEdit={handleEdit}
                      onMenuOpen={handleMenuOpen}
                    />
                  ))}
                </div>
              )}
            </div>

            {view === 'active' && (
              <div className="hidden lg:block space-y-5">
                <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/40 p-4">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <FaRocket className="text-[#0d9488]" /> Active Projects
                  </h4>
                  <div className="mt-3 space-y-3">
                    {activeProjects.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-500">No active projects</p>
                    ) : (
                      activeProjects.map((p) => (
                        <Link key={p._id} to={`/my-workspace/${workspaceId}/project/${p._id}`} className="flex items-center justify-between group">
                          <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition truncate">{p.name}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-800/60 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${p.progress || 0}%`, backgroundColor: brandColor }} />
                            </div>
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-500">{p.progress || 0}%</span>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/40 p-4">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <FaClock className="text-[#0d9488]" /> Recent Activity
                  </h4>
                  <div className="mt-3 space-y-2">
                    {recentActivity.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-500">No recent activity</p>
                    ) : (
                      recentActivity.map((act) => (
                        <div key={act.id} className="flex items-start gap-2 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#0d9488] mt-1.5 flex-shrink-0" />
                          <div>
                            <span className="text-gray-800 dark:text-gray-300">{act.projectName}</span>
                            <span className="text-gray-500 dark:text-gray-500"> {act.action}</span>
                            <span className="text-gray-500 dark:text-gray-600 block">{new Date(act.time).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/40 p-4">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <FaCheckCircle className="text-[#0d9488]" /> Completion Rate
                  </h4>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="relative w-16 h-16">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-gray-200 dark:stroke-gray-800/60" strokeWidth="3" />
                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-[#0d9488] transition-all duration-1000" strokeWidth="3" strokeDasharray="100" strokeDashoffset={100 - overallProgress} strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800 dark:text-gray-300">{overallProgress}%</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-800 dark:text-gray-300">{completedProjects} of {totalProjects} completed</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">{totalProjects - completedProjects} remaining</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <MyWorkspaceBottombar workspace={workspace} />

      <SearchProjectsModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} projects={projects} brandColor={brandColor} workspaceId={workspaceId} />
      <FilterDrawer isOpen={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)} filters={filters} setFilters={setFilters} view={view} setView={setView} isOwner={isOwner} />
      {isOwner && (
        <CreateProjectModal
          workspace={workspace}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateOptimistic}
        />
      )}

      {/* Edit Project Modal */}
      <EditProjectModal
        isOpen={!!editProjectId}
        onClose={() => setEditProjectId(null)}
        projectId={editProjectId}
        workspaceId={workspaceId}
        brandColor={brandColor}
        onSuccess={handleEditSuccess}
      />

      {/* Project Menu Modal */}
      <ProjectMenuModal
        isOpen={menuModalOpen}
        onClose={handleMenuClose}
        project={selectedProject}
        isOwner={isOwner}
        onEdit={handleEdit}
        onArchive={() => selectedProject && handleArchive(selectedProject._id)}
        onUnarchive={() => selectedProject && handleUnarchive(selectedProject._id)}
        onDelete={() => selectedProject && handleDeleteProject(selectedProject._id)}
        onPermanentDelete={() => selectedProject && handlePermanentDelete(selectedProject._id)}
        onRestore={() => selectedProject && handleRestore(selectedProject._id)}
        brandColor={brandColor}
      />
    </div>
  );
};

export default MyWorkspaceProjects;
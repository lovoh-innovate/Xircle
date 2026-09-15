// src/workspaceScreens/YourWorkspaceProjects.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import {
  usePlanWithAIMutation,
  useExecuteAIPlanMutation,
  useSummarizeProjectMutation,
  useReviewProjectMutation,
  useGenerateProjectDocsMutation,
} from '../slices/aiApiSlice';
import { jsPDF } from 'jspdf';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
import {
  FaPlus, FaFolder, FaUsers, FaSearch, FaTasks, FaTrashAlt, FaEdit, FaEllipsisV,
  FaTimes, FaArrowLeft, FaSpinner, FaCheckCircle, FaClock, FaRocket, FaFilter,
  FaChevronDown, FaChartPie, FaArchive, FaUndo, FaTrashRestore,
  FaMagic, FaPaperPlane, FaExclamationTriangle, FaCheck, FaUser,
  FaHeartbeat, FaLightbulb, FaFileAlt, FaDownload, FaExclamationCircle,
  FaAngleDown,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// Helper: treat progress >= 100 as completed
const isProjectCompleted = (p) => p.status === 'completed' || (p.progress || 0) >= 100;

// ─── Media query hook ──────────────────────────────────────────────────
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  return matches;
};

// ─── Confirm Modal ──────────────────────────────────────────────────────
const ConfirmModal = ({
  isOpen, onConfirm, onCancel, title, message,
  confirmLabel = 'Confirm', confirmColor = 'bg-red-600 hover:bg-red-700',
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-sm w-full p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition ${confirmColor}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

// ─── Filter Drawer (mobile) ─────────────────────────────────────────────
const FilterDrawer = ({ isOpen, onClose, filters, setFilters, view, setView, canManage }) => {
  if (!isOpen) return null;
  const statuses = view === 'active' ? ['all', 'planning', 'in-progress', 'completed'] : [];
  return (
    <div className="fixed inset-0 z-40 bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm flex justify-end">
      <div className="w-72 max-w-full h-full bg-white dark:bg-[#14141a] border-l border-gray-200 dark:border-gray-800/60 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Filters</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"><FaTimes /></button>
        </div>
        <div className="mb-4">
          <label className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wider">View</label>
          <div className="mt-1 flex gap-1">
            <button onClick={() => setView('active')} className={`flex-1 py-1.5 text-xs rounded-lg ${view === 'active' ? 'bg-[#0d9488]/20 text-[#0d9488] border border-[#0d9488]/30' : 'text-gray-500 bg-gray-100 dark:bg-[#1a1a24] border border-gray-300 dark:border-gray-800/40'}`}>All</button>
            <button onClick={() => setView('archived')} className={`flex-1 py-1.5 text-xs rounded-lg ${view === 'archived' ? 'bg-[#0d9488]/20 text-[#0d9488] border border-[#0d9488]/30' : 'text-gray-500 bg-gray-100 dark:bg-[#1a1a24] border border-gray-300 dark:border-gray-800/40'}`}>Archived</button>
            {canManage && (
              <button onClick={() => setView('trash')} className={`flex-1 py-1.5 text-xs rounded-lg ${view === 'trash' ? 'bg-[#0d9488]/20 text-[#0d9488] border border-[#0d9488]/30' : 'text-gray-500 bg-gray-100 dark:bg-[#1a1a24] border border-gray-300 dark:border-gray-800/40'}`}>Trash</button>
            )}
          </div>
        </div>
        {view === 'active' && statuses.length > 0 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wider">Status</label>
              <div className="mt-2 space-y-1">
                {statuses.map((status) => (
                  <button key={status} onClick={() => setFilters({ ...filters, status })}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${filters.status === status ? 'bg-[#0d9488]/20 text-[#0d9488] border border-[#0d9488]/30' : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30'}`}>
                    {status === 'all' ? 'All Projects' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wider">Sort By</label>
              <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                className="w-full bg-white dark:bg-[#1e1e26] border border-gray-300 dark:border-gray-800/60 rounded-xl px-3 py-2 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#0d9488]/50 mt-2">
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="progress">Progress</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        )}
        <button onClick={() => setFilters({ status: 'all', sort: 'newest' })} className="w-full mt-4 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition">
          Reset Filters
        </button>
      </div>
    </div>
  );
};

// ─── Search Projects Modal ─────────────────────────────────────────────
const SearchProjectsModal = ({ isOpen, onClose, projects, brandColor, workspaceId }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  if (!isOpen) return null;
  const filtered = projects.filter(
    (p) => p.name?.toLowerCase().includes(query.toLowerCase()) || p.description?.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div className="fixed inset-0 z-50 bg-white/90 dark:bg-[#0b0b10]/90 backdrop-blur-xl flex flex-col">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200/60 dark:border-gray-800/60 bg-gray-50 dark:bg-[#14141a]/80">
        <button onClick={onClose} className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"><FaArrowLeft /></button>
        <div className="flex-1 bg-gray-100 dark:bg-[#1e1e26] rounded-2xl px-4 py-2 flex items-center gap-3 border border-gray-300 dark:border-gray-800/40 focus-within:border-[#0d9488]/50 transition">
          <FaSearch className="text-gray-400 dark:text-gray-500 text-xs" />
          <input type="text" placeholder="Search projects..." value={query} onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent w-full outline-none text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500" autoFocus />
          {query && (<button onClick={() => setQuery('')} className="text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><FaTimes className="text-xs" /></button>)}
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
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500"><p className="text-sm">No results for "{query}"</p></div>
        )}
        {query && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((project) => (
              <div key={project._id} onClick={() => { onClose(); navigate(`/workspace/${workspaceId}/project/${project._id}`); }}
                className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-[#14141a] rounded-xl border border-gray-200 dark:border-gray-800/40 hover:border-[#0d9488]/40 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition cursor-pointer group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brandColor}20`, color: brandColor }}>
                  <FaFolder className="text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition">{project.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{project.description || 'No description'}</p>
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
const CreateProjectModal = ({ workspace, isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [createProject] = useCreateProjectMutation();
  const brandColor = workspace?.color || '#0d9488';
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Project name is required'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('workspaceId', workspace._id);
      fd.append('name', name.trim());
      fd.append('description', description.trim());
      await createProject({ workspaceId: workspace._id, data: fd }).unwrap();
      toast.success('Project created!');
      onCreated && onCreated();
      onClose();
    } catch (err) { toast.error(err?.data?.message || 'Failed to create project'); }
    finally { setLoading(false); }
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaPlus className="inline mr-2 text-[#0d9488]" /> New Project</h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Project Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Creating...' : 'Create Project'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Edit Project Modal ─────────────────────────────────────────────
const EditProjectModal = ({ isOpen, onClose, projectId, workspaceId, brandColor, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [updateProject] = useUpdateProjectMutation();
  const { data: projectData, isLoading: projectLoading } = useGetProjectByIdQuery(projectId, { skip: !isOpen || !projectId });

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
    if (!name.trim()) { toast.error('Project name is required'); return; }
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
      toast.success('Project updated'); onSuccess(); onClose();
    } catch (err) { toast.error(err?.data?.message || 'Failed to update project'); }
    finally { setLoading(false); }
  };
  if (!isOpen) return null;
  const isMobile = window.innerWidth < 768;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-0 md:p-4" onClick={onClose}>
      <div className={`bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[90vh] overflow-y-auto transform transition-transform duration-300 ${isMobile ? 'mt-auto' : 'mx-auto'}`} onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaEdit className="inline mr-2 text-[#0d9488]" /> Edit Project</h2>
            <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
          </div>
          {projectLoading ? (
            <div className="flex justify-center py-8"><FaSpinner className="animate-spin text-2xl text-[#0d9488]" /></div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Project Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none">
                  <option value="planning">Planning</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Start Date</label>
                  <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">End Date</label>
                  <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: brandColor }}>{loading ? 'Updating...' : 'Update Project'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Project Menu Modal ─────────────────────────────────────────────
const ProjectMenuModal = ({
  isOpen, onClose, project, canManage,
  onEdit, onArchive, onUnarchive, onDelete, onPermanentDelete, onRestore,
  onAISummary, onAIReview, onAIDocs,
  brandColor,
}) => {
  if (!isOpen || !project) return null;
  const isTrashed = project.isTrash;
  const isArchivedForMe = project.isArchivedForMe;
  const handleAction = (action) => { onClose(); action(); };
  const isMobile = window.innerWidth < 768;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-0 md:p-4" onClick={onClose}>
      <div className={`bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-2xl md:rounded-2xl w-full md:max-w-sm max-h-[85vh] overflow-y-auto transform transition-transform duration-300 ${isMobile ? 'mt-auto' : 'mx-auto'}`} onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 truncate pr-4">{project.name}</h3>
            <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition flex-shrink-0"><FaTimes /></button>
          </div>

          <div className="space-y-1">
            {isTrashed ? (
              <>
                <button onClick={() => handleAction(onRestore)} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[#0d9488] hover:bg-[#0d9488]/10 transition">
                  <FaTrashRestore className="text-sm" /><span className="text-sm font-medium">Restore</span>
                </button>
                <button onClick={() => handleAction(onPermanentDelete)} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-500/10 transition">
                  <FaTrashAlt className="text-sm" /><span className="text-sm font-medium">Delete Permanently</span>
                </button>
              </>
            ) : (
              <>
                {canManage && (
                  <button onClick={() => handleAction(() => onEdit(project._id))} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
                    <FaEdit className="text-sm text-[#0d9488]" /><span className="text-sm font-medium">Edit</span>
                  </button>
                )}

                {/* AI actions */}
                <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-800/40">
                  <p className="px-4 py-1 text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 flex items-center gap-1.5">
                    <FaMagic className="text-[10px] text-[#0d9488]" /> AI
                  </p>
                  <button onClick={() => handleAction(() => onAISummary(project))} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-[#0d9488]/10 transition">
                    <FaLightbulb className="text-sm text-[#0d9488]" /><span className="text-sm font-medium">Summarize</span>
                  </button>
                  {canManage && (
                    <button onClick={() => handleAction(() => onAIReview(project))} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-[#0d9488]/10 transition">
                      <FaHeartbeat className="text-sm text-[#0d9488]" /><span className="text-sm font-medium">Review</span>
                    </button>
                  )}
                  <button onClick={() => handleAction(() => onAIDocs(project))} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-[#0d9488]/10 transition">
                    <FaFileAlt className="text-sm text-[#0d9488]" /><span className="text-sm font-medium">Documentation</span>
                  </button>
                </div>

                <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-800/40">
                  {isArchivedForMe ? (
                    <button onClick={() => handleAction(onUnarchive)} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[#0d9488] hover:bg-[#0d9488]/10 transition">
                      <FaUndo className="text-sm" /><span className="text-sm font-medium">Unarchive</span>
                    </button>
                  ) : (
                    <button onClick={() => handleAction(onArchive)} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-[#0d9488]/10 transition">
                      <FaArchive className="text-sm" /><span className="text-sm font-medium">Archive for me</span>
                    </button>
                  )}
                  {canManage && (
                    <button onClick={() => handleAction(onDelete)} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10 transition">
                      <FaTrashAlt className="text-sm" /><span className="text-sm font-medium">Move to Trash</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Project Card ──────────────────────────────────────────────────────
const ProjectCard = ({ project, brandColor, workspaceId, canManage, onMenuOpen }) => {
  const navigate = useNavigate();
  const progress = project.progress || 0;
  const completed = isProjectCompleted(project);
  const statusLabels = { planning: 'Planning', 'in-progress': 'In Progress', completed: 'Completed', archived: 'Archived' };
  const statusColor = {
    planning: 'text-blue-600 dark:text-blue-400',
    'in-progress': 'text-yellow-600 dark:text-yellow-400',
    completed: 'text-green-600 dark:text-green-400',
    archived: 'text-gray-500 dark:text-gray-400',
  };
  const displayStatus = completed ? 'completed' : project.status;

  const { data: taskData, isLoading: taskLoading } = useGetProjectTasksQuery(
    { projectId: project._id }, { skip: project.isTrash }
  );
  const tasks = taskData?.tasks || [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed' || t.status === 'confirmed_completed').length;

  const stopProp = (e) => e.stopPropagation();
  const handleCardClick = (e) => {
    if (e.target.closest('button')) return;
    navigate(`/workspace/${workspaceId}/project/${project._id}`);
  };

  return (
    <div onClick={handleCardClick}
      className="group relative bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/40 hover:border-[#0d9488]/50 transition-all duration-500 hover:shadow-[0_8px_40px_rgba(13,148,136,0.15)] active:scale-[0.98] cursor-pointer overflow-hidden">
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
        <button onClick={(e) => { stopProp(e); onMenuOpen(project); }}
          className="absolute top-2 left-2 p-1.5 bg-white/60 dark:bg-black/40 backdrop-blur-sm rounded-lg text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-black/60 transition z-10">
          <FaEllipsisV className="text-xs" />
        </button>
      </div>
      <div className="p-3 md:p-4">
        <h3 className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition truncate">{project.name}</h3>
        {project.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 md:line-clamp-2 mt-0.5 md:mt-1">{project.description}</p>
        )}
        <div className="flex items-center mt-2 md:mt-3 gap-1">
          <div className="flex -space-x-2">
            {(project.teamMembers || []).slice(0, 4).map((member, idx) => (
              <div key={idx} className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-gray-300 dark:border-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[7px] md:text-[8px] font-bold text-white"
                style={{ backgroundColor: member?.profile ? 'transparent' : brandColor }}>
                {member?.profile ? <img src={member.profile} alt="" className="w-full h-full rounded-full object-cover" /> : (member?.name?.charAt(0) || '?').toUpperCase()}
              </div>
            ))}
            {(project.teamMembers || []).length > 4 && (
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-gray-300 dark:border-gray-800 bg-gray-200 dark:bg-[#1e1e26] flex items-center justify-center text-[7px] md:text-[8px] text-gray-600 dark:text-gray-400">
                +{(project.teamMembers || []).length - 4}
              </div>
            )}
          </div>
          <span className="text-[9px] md:text-[10px] text-gray-500 dark:text-gray-500 ml-1">{(project.teamMembers || []).length} members</span>
        </div>
        {!project.isTrash && (
          <>
            <div className="mt-2 md:mt-3 relative">
              <div className="flex justify-between text-[9px] md:text-[10px] text-gray-500 dark:text-gray-500 mb-0.5 md:mb-1">
                <span>Progress</span><span className="font-mono">{progress}%</span>
              </div>
              <div className="w-full h-1 md:h-1.5 bg-gray-200 dark:bg-gray-800/60 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%`, backgroundColor: brandColor, boxShadow: `0 0 12px ${brandColor}88` }} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2 md:mt-3 text-[9px] md:text-[10px] text-gray-500 dark:text-gray-500 pointer-events-none">
              <span className="flex items-center gap-1"><FaTasks className="text-[8px] md:text-[10px] text-[#0d9488]" />{taskLoading ? <FaSpinner className="animate-spin text-[10px]" /> : totalTasks}</span>
              <span className="flex items-center gap-1"><FaCheckCircle className="text-[8px] md:text-[10px] text-green-500 dark:text-green-400" />{taskLoading ? '...' : completedTasks}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// Professional PDF generator — Times, 12pt, justified body.
// ══════════════════════════════════════════════════════════════════
const downloadDocsPDF = (doc) => {
  if (!doc) return;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  const PAGE_W = pdf.internal.pageSize.getWidth();
  const PAGE_H = pdf.internal.pageSize.getHeight();
  const MARGIN_X = 60;
  const MARGIN_TOP = 72;
  const MARGIN_BOTTOM = 72;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  const BODY_SIZE = 12;
  const BODY_LINE_H = 18;
  const TITLE_SIZE = 26;
  const SUB_SIZE = 13;
  const H1_SIZE = 16;
  const TABLE_SIZE = 10;
  const TABLE_LINE_H = 13;
  const FOOTER_SIZE = 10;

  const ACCENT = [13, 148, 136];
  const TEXT_DARK = [17, 17, 17];
  const TEXT_MUTED = [110, 110, 110];

  let y = MARGIN_TOP;
  let pageNum = 0;
  let onCover = true;

  const setFont = (style = 'normal', size = BODY_SIZE, color = TEXT_DARK) => {
    pdf.setFont('times', style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
  };

  const justifyLine = (line, xPos, yPos, width) => {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 2) { pdf.text(line, xPos, yPos); return; }
    const spaceW = pdf.getTextWidth(' ');
    const wordsW = words.reduce((s, w) => s + pdf.getTextWidth(w), 0);
    const natural = wordsW + spaceW * (words.length - 1);
    const extra = Math.max(0, width - natural);
    const add = extra / (words.length - 1);
    let cx = xPos;
    for (let i = 0; i < words.length; i++) {
      pdf.text(words[i], cx, yPos);
      cx += pdf.getTextWidth(words[i]);
      if (i < words.length - 1) cx += spaceW + add;
    }
  };

  const drawFooter = () => {
    if (onCover) return;
    setFont('normal', FOOTER_SIZE, TEXT_MUTED);
    pdf.text(String(pageNum), PAGE_W / 2, PAGE_H - 38, { align: 'center' });
    pdf.setDrawColor(...ACCENT);
    pdf.setLineWidth(0.8);
    pdf.line(PAGE_W / 2 - 8, PAGE_H - 50, PAGE_W / 2 + 8, PAGE_H - 50);
  };

  const newPage = () => {
    drawFooter();
    pdf.addPage();
    pageNum += 1;
    onCover = false;
    y = MARGIN_TOP;
  };

  const ensure = (h) => { if (y + h > PAGE_H - MARGIN_BOTTOM) newPage(); };

  const writeParagraph = (text, opts = {}) => {
    const { size = BODY_SIZE, style = 'normal', color = TEXT_DARK, align = 'left', lineH = size * 1.5, gap = 10, indent = 0 } = opts;
    setFont(style, size, color);
    const usableW = CONTENT_W - indent;
    const lines = pdf.splitTextToSize(String(text ?? ''), usableW);
    if (!lines.length) { y += gap; return; }
    for (let i = 0; i < lines.length; i++) {
      ensure(lineH);
      const line = lines[i];
      const isLast = i === lines.length - 1;
      const trimmed = line.trim();
      if (align === 'justify' && !isLast && trimmed.includes(' ')) {
        justifyLine(line, MARGIN_X + indent, y, usableW);
      } else if (align === 'center') {
        pdf.text(line, MARGIN_X + CONTENT_W / 2, y, { align: 'center' });
      } else if (align === 'right') {
        pdf.text(line, MARGIN_X + CONTENT_W, y, { align: 'right' });
      } else {
        pdf.text(line, MARGIN_X + indent, y);
      }
      y += lineH;
    }
    y += gap;
  };

  const writeHeading = (text, level = 1) => {
    const size = level === 1 ? H1_SIZE : 14;
    const lineH = size * 1.35;
    setFont('bold', size, TEXT_DARK);
    const lines = pdf.splitTextToSize(String(text ?? ''), CONTENT_W);
    lines.forEach((ln) => {
      ensure(lineH + 10);
      pdf.text(ln, MARGIN_X, y);
      y += lineH;
    });
    y += 2;
    pdf.setDrawColor(...ACCENT);
    pdf.setLineWidth(level === 1 ? 1.2 : 0.8);
    pdf.line(MARGIN_X, y, MARGIN_X + (level === 1 ? 70 : 42), y);
    y += level === 1 ? 14 : 10;
  };

  const writeBullets = (items) => {
    items.forEach((item) => {
      setFont('normal', BODY_SIZE, TEXT_DARK);
      const usableW = CONTENT_W - 22;
      const lines = pdf.splitTextToSize(String(item ?? ''), usableW);
      ensure(BODY_LINE_H);
      pdf.text('•', MARGIN_X + 4, y);
      lines.forEach((ln, i) => {
        ensure(BODY_LINE_H);
        const isLast = i === lines.length - 1;
        if (!isLast && ln.trim().includes(' ')) justifyLine(ln, MARGIN_X + 22, y, usableW);
        else pdf.text(ln, MARGIN_X + 22, y);
        y += BODY_LINE_H;
      });
      y += 4;
    });
    y += 6;
  };

  const writeTable = (headers, rows) => {
    if (!headers?.length || !rows?.length) return;
    const cols = headers.length;
    const colW = CONTENT_W / cols;
    const padX = 8;
    const padY = 7;
    const headerH = TABLE_SIZE + padY * 2 + 2;

    const drawHeader = () => {
      pdf.setFillColor(238, 243, 245);
      pdf.rect(MARGIN_X, y, CONTENT_W, headerH, 'F');
      setFont('bold', TABLE_SIZE, TEXT_DARK);
      headers.forEach((h, i) => {
        const lines = pdf.splitTextToSize(String(h ?? ''), colW - padX * 2);
        pdf.text(lines, MARGIN_X + i * colW + padX, y + padY + TABLE_SIZE);
      });
      y += headerH;
    };

    ensure(headerH + 4);
    drawHeader();

    rows.forEach((row, rowIdx) => {
      const cells = [...row];
      while (cells.length < cols) cells.push('');
      const cellLines = cells.map((c) => pdf.splitTextToSize(String(c ?? '').replace(/\s*\n\s*/g, ' '), colW - padX * 2));
      const maxLines = Math.max(1, ...cellLines.map((l) => l.length));
      const rowH = maxLines * TABLE_LINE_H + padY * 2;

      if (y + rowH > PAGE_H - MARGIN_BOTTOM) { newPage(); drawHeader(); }

      if (rowIdx % 2 === 1) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(MARGIN_X, y, CONTENT_W, rowH, 'F');
      }

      setFont('normal', TABLE_SIZE, TEXT_DARK);
      cellLines.forEach((lines, i) => {
        let cy = y + padY + TABLE_SIZE;
        lines.forEach((ln) => { pdf.text(ln, MARGIN_X + i * colW + padX, cy); cy += TABLE_LINE_H; });
      });

      pdf.setDrawColor(225, 228, 232);
      pdf.setLineWidth(0.5);
      pdf.line(MARGIN_X, y + rowH, MARGIN_X + CONTENT_W, y + rowH);
      y += rowH;
    });

    y += 12;
  };

  // Cover page
  pdf.setFillColor(238, 243, 245);
  pdf.rect(0, 0, PAGE_W, 8, 'F');
  pdf.setFillColor(...ACCENT);
  pdf.rect(0, 0, 170, 8, 'F');

  setFont('normal', 11, TEXT_MUTED);
  pdf.text('PROJECT DOCUMENTATION', MARGIN_X, 148);

  const title = doc.meta?.title || 'Untitled Project';
  setFont('bold', TITLE_SIZE, TEXT_DARK);
  let ty = 210;
  const titleLines = pdf.splitTextToSize(title, CONTENT_W);
  titleLines.forEach((ln) => { pdf.text(ln, MARGIN_X, ty); ty += TITLE_SIZE * 1.25; });

  if (doc.meta?.subtitle) {
    ty += 12;
    setFont('italic', SUB_SIZE, TEXT_MUTED);
    const subLines = pdf.splitTextToSize(doc.meta.subtitle, CONTENT_W);
    subLines.forEach((ln) => { pdf.text(ln, MARGIN_X, ty); ty += SUB_SIZE * 1.5; });
  }

  ty += 18;
  pdf.setDrawColor(...ACCENT);
  pdf.setLineWidth(3);
  pdf.line(MARGIN_X, ty, MARGIN_X + 90, ty);

  const metaY = PAGE_H - 200;
  setFont('normal', 10, TEXT_MUTED);
  pdf.text('PROJECT', MARGIN_X, metaY);
  setFont('bold', 13, TEXT_DARK);
  pdf.text(doc.meta?.projectName || '—', MARGIN_X, metaY + 20);

  setFont('normal', 10, TEXT_MUTED);
  pdf.text('VERSION', MARGIN_X, metaY + 52);
  setFont('bold', 13, TEXT_DARK);
  pdf.text(doc.meta?.version || '1.0', MARGIN_X, metaY + 72);

  setFont('normal', 10, TEXT_MUTED);
  pdf.text('GENERATED', MARGIN_X, metaY + 104);
  setFont('bold', 13, TEXT_DARK);
  pdf.text(new Date(doc.meta?.generatedAt || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), MARGIN_X, metaY + 124);

  if (doc.meta?.generatedBy) {
    setFont('normal', 10, TEXT_MUTED);
    pdf.text('BY', MARGIN_X, metaY + 156);
    setFont('bold', 13, TEXT_DARK);
    pdf.text(doc.meta.generatedBy, MARGIN_X, metaY + 176);
  }

  // Body
  newPage();

  (doc.sections || []).forEach((section, sIdx) => {
    if (sIdx > 0) y += 8;
    ensure(34);
    writeHeading(section.heading, 1);

    (section.paragraphs || []).forEach((p) => {
      writeParagraph(p, { size: BODY_SIZE, style: 'normal', align: 'justify', lineH: BODY_LINE_H, gap: 10 });
    });

    if (section.bullets?.length) writeBullets(section.bullets);
    if (section.table?.headers?.length && section.table?.rows?.length) {
      writeTable(section.table.headers, section.table.rows);
    }
  });

  drawFooter();

  const safeName = (doc.meta?.projectName || 'project').replace(/[^\w\-]+/g, '_');
  pdf.save(`${safeName}_docs.pdf`);
};

// ══════════════════════════════════════════════════════════════════
// AI Project Panel — editable plan (two-stage)
// ══════════════════════════════════════════════════════════════════
const EXAMPLE_PROMPTS = [
  'Build a marketing website in 3 weeks with design, dev and QA phases.',
  'Launch a new mobile app feature. Need a designer, backend dev and tester.',
  'Plan a 2-day team offsite with logistics and activities.',
  'Create a content calendar for our social media for the next month.',
];

const AIProjectPanel = ({ workspaceId, brandColor, workspaceMembers = [], onClose, onExecuted }) => {
  const [stage, setStage] = useState('prompt');
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [planWithAI, { isLoading: isPlanning }] = usePlanWithAIMutation();
  const [executeAIPlan, { isLoading: isExecuting }] = useExecuteAIPlanMutation();

  const reset = () => { setStage('prompt'); setPrompt(''); setPlan(null); setExpandedTask(null); };

  const handlePlan = async () => {
    if (!prompt.trim()) { toast.error('Describe your project first'); return; }
    try {
      const res = await planWithAI({ workspaceId, prompt: prompt.trim() }).unwrap();
      setPlan(res.plan);
      setStage('edit');
      if (res.plan.warnings?.length > 0) toast.warn(`${res.plan.warnings.length} warning(s) — some assignments were dropped.`);
    } catch (err) { toast.error(err?.data?.message || 'AI planning failed. Try again.'); }
  };

  const handleExecute = async () => {
    if (!plan) return;
    if (!plan.project.name?.trim()) return toast.error('Project name required');
    if (!plan.tasks?.length) return toast.error('Add at least one task');
    try {
      const cleanPlan = {
        project: {
          name: plan.project.name.trim(),
          description: plan.project.description || '',
          detailedDescription: plan.project.detailedDescription || '',
          priority: plan.project.priority,
          projectType: plan.project.projectType,
          tags: plan.project.tags || [],
          teamMemberIds: plan.project.teamMemberIds || [],
        },
        tasks: plan.tasks.map((t) => ({
          title: t.title.trim(),
          description: t.description || '',
          priority: t.priority,
          assigneeIds: t.assigneeIds || [],
          dueDateOffsetDays: Number.isFinite(t.dueDateOffsetDays) ? t.dueDateOffsetDays : null,
          subtasks: (t.subtasks || []).map((s) => ({
            title: s.title.trim(),
            description: s.description || '',
            dueDateOffsetDays: Number.isFinite(s.dueDateOffsetDays) ? s.dueDateOffsetDays : null,
          })),
        })),
      };
      const res = await executeAIPlan({ workspaceId, plan: cleanPlan }).unwrap();
      toast.success(`Created "${res.project.name}" with ${res.taskCount} task${res.taskCount === 1 ? '' : 's'}.`);
      onExecuted?.(res.project);
    } catch (err) { toast.error(err?.data?.message || 'Failed to create project.'); }
  };

  const updateProject = (patch) => setPlan((p) => ({ ...p, project: { ...p.project, ...patch } }));
  const updateTask = (i, patch) => setPlan((p) => { const tasks = [...p.tasks]; tasks[i] = { ...tasks[i], ...patch }; return { ...p, tasks }; });
  const removeTask = (i) => setPlan((p) => ({ ...p, tasks: p.tasks.filter((_, k) => k !== i) }));
  const addTask = () => setPlan((p) => ({ ...p, tasks: [...p.tasks, { title: 'New task', description: '', priority: 'medium', assigneeIds: [], dueDateOffsetDays: 7, subtasks: [] }] }));
  const toggleAssignee = (i, uid) => {
    const t = plan.tasks[i];
    const has = t.assigneeIds.includes(uid);
    updateTask(i, { assigneeIds: has ? t.assigneeIds.filter((x) => x !== uid) : [...t.assigneeIds, uid] });
  };
  const toggleTeamMember = (uid) => {
    const has = (plan.project.teamMemberIds || []).includes(uid);
    updateProject({ teamMemberIds: has ? plan.project.teamMemberIds.filter((x) => x !== uid) : [...(plan.project.teamMemberIds || []), uid] });
  };
  const addSubtask = (i) => { const t = plan.tasks[i]; updateTask(i, { subtasks: [...(t.subtasks || []), { title: 'New subtask', description: '', dueDateOffsetDays: 3 }] }); };
  const updateSubtask = (i, si, patch) => { const t = plan.tasks[i]; const subs = [...(t.subtasks || [])]; subs[si] = { ...subs[si], ...patch }; updateTask(i, { subtasks: subs }); };
  const removeSubtask = (i, si) => { const t = plan.tasks[i]; updateTask(i, { subtasks: (t.subtasks || []).filter((_, k) => k !== si) }); };

  const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
  const PROJECT_TYPES = ['general', 'client', 'internal', 'marketing', 'product'];
  const totalSubtasks = plan?.tasks?.reduce((n, t) => n + (t.subtasks || []).length, 0) || 0;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#14141a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800/60 bg-gradient-to-r from-[#0d9488]/5 to-transparent">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0d9488] to-[#0f766e] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#0d9488]/30">
            <FaMagic className="text-white text-xs" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
              {stage === 'prompt' ? 'AI Project Planner' : 'Review AI Plan'}
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-500 truncate">
              {stage === 'prompt' ? "Describe it — we'll plan it" : `${plan?.tasks?.length || 0} tasks · ${totalSubtasks} subtasks`}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition flex-shrink-0" title="Close AI mode">
          <FaTimes className="text-sm" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {stage === 'prompt' && (
          <>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">What do you want to build?</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Build a coffee shop landing page in 2 weeks. Include design, development and QA. Sarah can do UI, John backend."
              rows={6}
              disabled={isPlanning}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-[#0d9488] outline-none resize-none disabled:opacity-60"
            />
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-2">Try an example</p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_PROMPTS.map((ex, i) => (
                  <button key={i} type="button" onClick={() => setPrompt(ex)} disabled={isPlanning}
                    className="text-[10px] px-2.5 py-1 rounded-full bg-gray-100 dark:bg-[#1a1a24] hover:bg-[#0d9488]/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800/40 hover:border-[#0d9488]/40 transition disabled:opacity-50 text-left max-w-full truncate">
                    {ex.length > 45 ? `${ex.slice(0, 45)}…` : ex}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handlePlan} disabled={isPlanning || !prompt.trim()}
              className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#0d9488]/20"
              style={{ backgroundColor: brandColor }}>
              {isPlanning ? <><FaSpinner className="animate-spin text-xs" /> Planning…</> : <><FaMagic className="text-xs" /> Generate Plan</>}
            </button>
            {isPlanning && <p className="text-[10px] text-gray-500 dark:text-gray-500 text-center mt-2">The AI is reading your workspace members and drafting the plan…</p>}
          </>
        )}

        {stage === 'edit' && plan && (
          <div className="space-y-5">
            {plan.warnings?.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3 flex gap-2">
                <FaExclamationTriangle className="text-amber-600 dark:text-amber-400 text-sm mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
                  {plan.warnings.map((w, i) => <div key={i}>{w}</div>)}
                </div>
              </div>
            )}

            <section>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Project</h3>
              <div className="space-y-2">
                <input value={plan.project.name} onChange={(e) => updateProject({ name: e.target.value })} placeholder="Project name"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-100 outline-none focus:border-[#0d9488]" />
                <input value={plan.project.description || ''} onChange={(e) => updateProject({ description: e.target.value })} placeholder="Short description"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#0d9488]" />
                <textarea value={plan.project.detailedDescription || ''} onChange={(e) => updateProject({ detailedDescription: e.target.value })} rows={3} placeholder="Detailed description"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#0d9488] resize-none" />
                <div className="grid grid-cols-2 gap-2">
                  <select value={plan.project.priority} onChange={(e) => updateProject({ priority: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select value={plan.project.projectType} onChange={(e) => updateProject({ projectType: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none">
                    {PROJECT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {workspaceMembers.length > 0 && (
                  <div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-500 mb-1.5">Team members</div>
                    <div className="flex flex-wrap gap-1.5">
                      {workspaceMembers.map((u) => {
                        const selected = (plan.project.teamMemberIds || []).includes(u._id);
                        return (
                          <button key={u._id} type="button" onClick={() => toggleTeamMember(u._id)}
                            className={`flex items-center gap-1.5 text-[11px] pl-0.5 pr-2.5 py-0.5 rounded-full border transition ${selected
                              ? 'bg-teal-50 dark:bg-[#0d9488]/15 border-teal-500/50 dark:border-[#0d9488]/50 text-teal-700 dark:text-[#14b8a6]'
                              : 'bg-gray-50 dark:bg-[#1a1a24] border-gray-200 dark:border-gray-800/40 text-gray-600 dark:text-gray-400 hover:border-gray-300'}`}>
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold overflow-hidden shrink-0" style={{ backgroundColor: brandColor }}>
                              {u.profile ? <img src={u.profile} alt="" className="w-full h-full object-cover" /> : (u.name || '?').charAt(0).toUpperCase()}
                            </span>
                            {u.name || 'Unknown'}
                            {selected && <FaCheck className="text-[8px]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">Tasks ({plan.tasks.length})</h3>
                <button onClick={addTask} className="text-xs text-teal-600 dark:text-[#0d9488] font-medium flex items-center gap-1 hover:underline">
                  <FaPlus className="text-[10px]" /> Add task
                </button>
              </div>
              <div className="space-y-2">
                {plan.tasks.map((t, idx) => {
                  const expanded = expandedTask === idx;
                  return (
                    <div key={idx} className="bg-gray-50 dark:bg-[#1a1a24] rounded-xl border border-gray-200/60 dark:border-gray-800/40 overflow-hidden">
                      <div className="flex items-start gap-2 p-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          <input value={t.title} onChange={(e) => updateTask(idx, { title: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-100 outline-none focus:border-[#0d9488]" />
                          <div className="flex flex-wrap gap-1.5">
                            <select value={t.priority} onChange={(e) => updateTask(idx, { priority: e.target.value })}
                              className="px-2 py-1 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-md text-[11px] text-gray-700 dark:text-gray-300 outline-none">
                              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <input type="number" min={0} value={t.dueDateOffsetDays ?? ''}
                              onChange={(e) => updateTask(idx, { dueDateOffsetDays: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                              placeholder="due in N days"
                              className="w-32 px-2 py-1 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-md text-[11px] text-gray-700 dark:text-gray-300 outline-none" />
                            <span className="px-2 py-1 text-[11px] text-gray-500 dark:text-gray-500">{(t.subtasks || []).length} subtask{(t.subtasks || []).length !== 1 ? 's' : ''}</span>
                          </div>
                          {workspaceMembers.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {workspaceMembers.map((u) => {
                                const sel = (t.assigneeIds || []).includes(u._id);
                                return (
                                  <button key={u._id} type="button" onClick={() => toggleAssignee(idx, u._id)} title={u.name}
                                    className={`flex items-center gap-1 text-[10px] pl-0.5 pr-1.5 py-0.5 rounded-full border transition ${sel
                                      ? 'bg-teal-50 dark:bg-[#0d9488]/15 border-teal-500/50 text-teal-700 dark:text-[#14b8a6]'
                                      : 'bg-white dark:bg-[#0f0f12] border-gray-200 dark:border-gray-800/40 text-gray-500 dark:text-gray-500 hover:border-gray-300'}`}>
                                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold overflow-hidden" style={{ backgroundColor: brandColor }}>
                                      {u.profile ? <img src={u.profile} alt="" className="w-full h-full object-cover" /> : (u.name || '?').charAt(0).toUpperCase()}
                                    </span>
                                    {(u.name || '').split(' ')[0] || 'Unknown'}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <button onClick={() => setExpandedTask(expanded ? null : idx)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded" title={expanded ? 'Collapse' : 'Expand'}>
                            <FaAngleDown className={`text-xs transition-transform ${expanded ? 'rotate-180' : ''}`} />
                          </button>
                          <button onClick={() => removeTask(idx)} className="p-1 text-gray-400 hover:text-red-500 rounded" title="Remove task">
                            <FaTrashAlt className="text-xs" />
                          </button>
                        </div>
                      </div>
                      {expanded && (
                        <div className="px-3 pb-3 space-y-3 border-t border-gray-200/60 dark:border-gray-800/40 pt-3">
                          <textarea value={t.description || ''} onChange={(e) => updateTask(idx, { description: e.target.value })} rows={2} placeholder="Task description"
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none resize-none" />
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-500">Subtasks ({(t.subtasks || []).length})</span>
                            <button onClick={() => addSubtask(idx)} className="text-[11px] text-teal-600 dark:text-[#0d9488] font-medium flex items-center gap-1 hover:underline">
                              <FaPlus className="text-[9px]" /> Add
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {(t.subtasks || []).map((s, sidx) => (
                              <div key={sidx} className="flex items-start gap-2">
                                <input value={s.title} onChange={(e) => updateSubtask(idx, sidx, { title: e.target.value })}
                                  className="flex-1 px-2.5 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none" />
                                <input type="number" min={0} value={s.dueDateOffsetDays ?? ''}
                                  onChange={(e) => updateSubtask(idx, sidx, { dueDateOffsetDays: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                                  placeholder="N"
                                  className="w-14 px-2 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none" />
                                <button onClick={() => removeSubtask(idx, sidx)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                                  <FaTrashAlt className="text-[11px]" />
                                </button>
                              </div>
                            ))}
                            {(t.subtasks || []).length === 0 && <p className="text-[11px] text-gray-400 dark:text-gray-600 italic">No subtasks</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Footer */}
      {stage === 'edit' && plan && (
        <div className="flex gap-2 px-4 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
          <button onClick={reset} disabled={isExecuting}
            className="flex-1 py-2 rounded-xl border border-gray-300 dark:border-gray-700/60 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition disabled:opacity-50">
            Back
          </button>
          <button onClick={handleExecute} disabled={isExecuting}
            className="flex-1 py-2 rounded-xl text-sm text-white font-medium flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50 shadow-lg shadow-[#0d9488]/20"
            style={{ backgroundColor: brandColor }}>
            {isExecuting ? <><FaSpinner className="animate-spin text-xs" /> Creating…</> : <><FaCheck className="text-xs" /> Confirm & Create</>}
          </button>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// AI Summary / Review / Docs modals (project-scoped)
// ══════════════════════════════════════════════════════════════════
const AISummaryModal = ({ isOpen, onClose, projectId, brandColor }) => {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [summarizeProject] = useSummarizeProjectMutation();

  useEffect(() => { if (!isOpen) setResult(null); }, [isOpen]);
  useEffect(() => {
    if (isOpen && !result && !busy) {
      setBusy(true);
      summarizeProject({ projectId }).unwrap()
        .then((r) => setResult(r.summary))
        .catch((e) => toast.error(e?.data?.message || 'Summarize failed'))
        .finally(() => setBusy(false));
    }
  }, [isOpen]); // eslint-disable-line

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FaLightbulb className="text-[#0d9488]" /> Project Summary
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {busy && !result && (
            <div className="flex flex-col items-center justify-center py-16">
              <FaSpinner className="animate-spin text-2xl text-[#0d9488] mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-500">Thinking…</p>
            </div>
          )}
          {result && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 break-words">{result.headline}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 break-words leading-relaxed whitespace-pre-wrap">{result.summary}</p>
              </div>
              {result.currentState && (
                <div className="bg-gray-50 dark:bg-[#1a1a24] rounded-xl p-3 border border-gray-200/60 dark:border-gray-800/40">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-1">Current state</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{result.currentState}</p>
                </div>
              )}
              {result.highlights?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Highlights</h4>
                  <div className="space-y-1.5">
                    {result.highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <FaCheckCircle className="text-green-500 text-xs mt-1 shrink-0" />
                        <span className="break-words">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.risks?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Risks</h4>
                  <div className="space-y-1.5">
                    {result.risks.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <FaExclamationTriangle className="text-amber-500 text-xs mt-1 shrink-0" />
                        <span className="break-words">{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.nextSteps?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Next steps</h4>
                  <div className="space-y-1.5">
                    {result.nextSteps.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: brandColor }}>{i + 1}</span>
                        <span className="break-words">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
          <button onClick={onClose} className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 transition" style={{ backgroundColor: brandColor }}>Done</button>
        </div>
      </div>
    </div>
  );
};

const AIReviewModal = ({ isOpen, onClose, projectId, brandColor }) => {
  const [focus, setFocus] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reviewProject] = useReviewProjectMutation();

  useEffect(() => { if (!isOpen) { setResult(null); setFocus(''); } }, [isOpen]);

  const run = async () => {
    setBusy(true);
    try {
      const res = await reviewProject({ projectId, focus: focus.trim() || undefined }).unwrap();
      setResult(res.review);
    } catch (err) { toast.error(err?.data?.message || 'Review failed'); }
    finally { setBusy(false); }
  };

  if (!isOpen) return null;
  const scoreColor = !result ? brandColor : result.healthScore >= 75 ? '#16a34a' : result.healthScore >= 50 ? '#eab308' : '#dc2626';
  const sevColor = { low: 'text-blue-600 dark:text-blue-400', medium: 'text-yellow-600 dark:text-yellow-400', high: 'text-orange-600 dark:text-orange-400', critical: 'text-red-600 dark:text-red-400' };

  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FaHeartbeat className="text-[#0d9488]" /> Project Review
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {!result && (
            <div className="space-y-3">
              <input value={focus} onChange={(e) => setFocus(e.target.value)}
                placeholder="Optional focus — e.g. 'deadlines' or 'team balance'"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#0d9488]" />
              <p className="text-[11px] text-gray-500 dark:text-gray-500">The AI audits workload, priorities, deadlines, and gaps.</p>
            </div>
          )}
          {result && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-2xl text-white shrink-0" style={{ backgroundColor: scoreColor }}>{result.healthScore}</div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-500 uppercase font-semibold tracking-wide">Health Score</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 break-words">{result.overallAssessment}</p>
                </div>
              </div>
              {result.strengths?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Strengths</h4>
                  <div className="space-y-1.5">
                    {result.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <FaCheckCircle className="text-green-500 text-xs mt-1 shrink-0" />
                        <span className="break-words">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.issues?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Issues ({result.issues.length})</h4>
                  <div className="space-y-2">
                    {result.issues.map((it, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-[#1a1a24] rounded-xl p-3 border border-gray-200/60 dark:border-gray-800/40">
                        <div className="flex items-start gap-2">
                          <FaExclamationCircle className={`text-xs mt-1 shrink-0 ${sevColor[it.severity] || 'text-gray-400'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">
                              {it.title}
                              <span className={`ml-2 text-[10px] uppercase font-semibold ${sevColor[it.severity] || ''}`}>{it.severity}</span>
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">{it.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.recommendations?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Recommendations</h4>
                  <div className="space-y-2">
                    {result.recommendations.map((r, i) => (
                      <div key={i} className="bg-teal-50/60 dark:bg-[#0d9488]/10 rounded-xl p-3 border border-teal-200/60 dark:border-[#0d9488]/20">
                        <div className="flex items-start gap-2">
                          <FaLightbulb className="text-[#0d9488] text-xs mt-1 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">
                              {r.title}
                              <span className="ml-2 text-[10px] uppercase font-semibold text-teal-700 dark:text-[#0d9488]">{r.impact}</span>
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">{r.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
          {!result ? (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={run} disabled={busy}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: brandColor }}>
                {busy ? <><FaSpinner className="animate-spin text-xs" /> Analyzing…</> : <><FaHeartbeat className="text-xs" /> Run review</>}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setResult(null)} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Run again</button>
              <button onClick={onClose} className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 transition" style={{ backgroundColor: brandColor }}>Done</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const AIDocsModal = ({ isOpen, onClose, projectId, brandColor }) => {
  const [doc, setDoc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [generate] = useGenerateProjectDocsMutation();

  useEffect(() => { if (!isOpen) setDoc(null); }, [isOpen]);
  useEffect(() => {
    if (isOpen && !doc && !busy) {
      setBusy(true);
      generate({ projectId }).unwrap()
        .then((r) => setDoc(r.doc))
        .catch((e) => toast.error(e?.data?.message || 'Doc generation failed'))
        .finally(() => setBusy(false));
    }
  }, [isOpen]); // eslint-disable-line

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-3xl shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FaFileAlt className="text-[#0d9488]" /> Project Documentation
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {busy && !doc && (
            <div className="flex flex-col items-center justify-center py-16">
              <FaSpinner className="animate-spin text-2xl text-[#0d9488] mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-500">Writing documentation…</p>
            </div>
          )}
          {doc && (
            <article className="space-y-6">
              <header>
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 break-words">{doc.meta?.title}</h1>
                {doc.meta?.subtitle && <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 break-words">{doc.meta.subtitle}</p>}
                <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-2">
                  Version {doc.meta?.version || '1.0'} · Generated {new Date(doc.meta?.generatedAt || Date.now()).toLocaleString()}
                </p>
              </header>
              {(doc.sections || []).map((s, i) => (
                <section key={i} className="space-y-2">
                  <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200/60 dark:border-gray-800/40 pb-1">{s.heading}</h2>
                  {(s.paragraphs || []).map((p, j) => (
                    <p key={j} className="text-sm text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap leading-relaxed">{p}</p>
                  ))}
                  {(s.bullets || []).length > 0 && (
                    <ul className="list-disc pl-5 space-y-1">
                      {s.bullets.map((b, j) => <li key={j} className="text-sm text-gray-700 dark:text-gray-300 break-words">{b}</li>)}
                    </ul>
                  )}
                  {s.table?.headers?.length > 0 && s.table?.rows?.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-gray-200/60 dark:border-gray-800/40">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-[#1a1a24]">
                          <tr>{s.table.headers.map((h, j) => (<th key={j} className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{h}</th>))}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/30">
                          {s.table.rows.map((row, j) => (
                            <tr key={j}>{row.map((c, k) => <td key={k} className="px-3 py-2 text-gray-700 dark:text-gray-300 align-top">{c}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </article>
          )}
        </div>
        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Close</button>
          <button onClick={() => doc && downloadDocsPDF(doc)} disabled={!doc || busy}
            className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
            style={{ backgroundColor: brandColor }}>
            <FaDownload className="text-xs" /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────
const YourWorkspaceProjects = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [searchOpen, setSearchOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editProjectId, setEditProjectId] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [filters, setFilters] = useState({ status: 'all', sort: 'newest', search: '' });
  const [view, setView] = useState('active');
  const [optimisticArchivedIds, setOptimisticArchivedIds] = useState([]);

  // AI mode state
  const [aiOpen, setAiOpen] = useState(false);
  const [leftWidthPercent, setLeftWidthPercent] = useState(60);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const containerRef = useRef(null);

  // AI modals
  const [aiSummaryProject, setAiSummaryProject] = useState(null);
  const [aiReviewProject, setAiReviewProject] = useState(null);
  const [aiDocsProject, setAiDocsProject] = useState(null);

  const { data: workspaceData, isLoading: workspaceLoading, error: workspaceError } = useGetWorkspaceQuery(workspaceId);

  const queryArgs = {
    workspaceId,
    archived: view === 'archived' ? 'true' : undefined,
    trash: view === 'trash' ? 'true' : undefined,
  };
  const { data: projectsData, isLoading: projectsLoading, refetch: refetchProjects } = useGetWorkspaceProjectsQuery(queryArgs);

  const [deleteProject] = useDeleteProjectMutation();
  const [permanentlyDeleteProject] = usePermanentlyDeleteProjectMutation();
  const [restoreProject] = useRestoreProjectMutation();
  const [archiveProject] = useArchiveProjectMutation();
  const [unarchiveProject] = useUnarchiveProjectMutation();

  const workspace = workspaceData?.workspace;
  const projects = projectsData?.projects || [];
  const brandColor = workspace?.color || '#0d9488';

  const ownerId = workspace?.owner?._id || workspace?.owner;
  const isOwner = !!ownerId && !!userInfo?._id && String(ownerId) === String(userInfo._id);
  const isAdmin = workspace?.members?.some(
    (m) => m.user?._id?.toString() === userInfo?._id?.toString() && m.role === 'Admin' && m.status === 'active'
  );
  const canManage = isOwner || isAdmin;

  const workspaceMembers = useMemo(() => {
    if (!workspace) return [];
    return (workspace.members || []).filter((m) => m.status === 'active').map((m) => m.user || m).filter(Boolean);
  }, [workspace]);

  useEffect(() => {
    if (!projectsLoading && optimisticArchivedIds.length > 0) setOptimisticArchivedIds([]);
  }, [projectsLoading, optimisticArchivedIds]);

  // Splitter drag
  const handleSplitterMove = useCallback((e) => {
    if (!isDraggingSplitter || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let pct = ((e.clientX - rect.left) / rect.width) * 100;
    pct = Math.min(75, Math.max(35, pct));
    setLeftWidthPercent(pct);
  }, [isDraggingSplitter]);

  const handleSplitterUp = useCallback(() => {
    setIsDraggingSplitter(false);
    document.removeEventListener('mousemove', handleSplitterMove);
    document.removeEventListener('mouseup', handleSplitterUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleSplitterMove]);

  const handleSplitterDown = useCallback((e) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
    document.addEventListener('mousemove', handleSplitterMove);
    document.addEventListener('mouseup', handleSplitterUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [handleSplitterMove, handleSplitterUp]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleSplitterMove);
      document.removeEventListener('mouseup', handleSplitterUp);
    };
  }, [handleSplitterMove, handleSplitterUp]);

  useEffect(() => {
    if (!aiOpen) return;
    const handler = (e) => { if (e.key === 'Escape') setAiOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [aiOpen]);

  const handleAIPlanExecuted = useCallback(() => {
    setAiOpen(false);
    setView('active');
    refetchProjects();
  }, [refetchProjects]);

  if (workspaceError) { navigate('/workspaces'); return null; }
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

  const displayedProjects = view === 'active'
    ? projects.filter(p => !optimisticArchivedIds.includes(p._id) && !p.isArchivedForMe)
    : projects;

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
        if (filters.status === 'completed' ? !isProjectCompleted(p) : p.status !== filters.status) return false;
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
    id: p._id, projectName: p.name,
    action: p.updatedAt ? 'updated' : 'created',
    time: p.updatedAt || p.createdAt,
  })).sort((a, b) => new Date(b.time) - new Date(a.time));

  const handleDeleteProject = async (projectId) => {
    try { await deleteProject(projectId).unwrap(); toast.success('Project moved to trash.'); refetchProjects(); }
    catch (err) { toast.error(err?.data?.message || 'Failed to move project'); }
  };
  const handlePermanentDelete = async (projectId) => {
    try { await permanentlyDeleteProject(projectId).unwrap(); toast.success('Project permanently deleted.'); refetchProjects(); }
    catch (err) { toast.error(err?.data?.message || 'Failed to delete project'); }
  };
  const handleRestore = async (projectId) => {
    try { await restoreProject(projectId).unwrap(); toast.success('Project restored.'); refetchProjects(); }
    catch (err) { toast.error(err?.data?.message || 'Failed to restore project'); }
  };
  const handleArchive = async (projectId) => {
    if (view === 'active') setOptimisticArchivedIds(prev => [...prev, projectId]);
    try { await archiveProject(projectId).unwrap(); toast.success('Project archived.'); refetchProjects(); }
    catch (err) { setOptimisticArchivedIds(prev => prev.filter(id => id !== projectId)); toast.error(err?.data?.message || 'Failed to archive project'); }
  };
  const handleUnarchive = async (projectId) => {
    try { await unarchiveProject(projectId).unwrap(); toast.success('Project unarchived.'); refetchProjects(); }
    catch (err) { toast.error(err?.data?.message || 'Failed to unarchive project'); }
  };

  const handleEdit = (projectId) => setEditProjectId(projectId);
  const handleEditSuccess = () => { refetchProjects(); setEditProjectId(null); };
  const handleMenuOpen = (project) => { setSelectedProject(project); setMenuModalOpen(true); };
  const handleMenuClose = () => { setMenuModalOpen(false); setSelectedProject(null); };

  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <YourWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-4 h-14 lg:h-16">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(`/workspace/${workspaceId}`)} className="p-1 lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"><FaArrowLeft /></button>
              <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 tracking-tight">Projects</h1>
              <span className="text-xs font-normal text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-[#1a1a24] px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-800/40">{projects.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center bg-gray-100 dark:bg-[#1a1a24] border border-gray-300 dark:border-gray-800/60 rounded-full px-3 py-1.5 gap-2 focus-within:border-[#0d9488]/50 transition">
                <FaSearch className="text-gray-400 dark:text-gray-500 text-xs" />
                <input type="text" placeholder="Search projects..." className="bg-transparent outline-none text-sm text-gray-800 dark:text-gray-200 w-32 lg:w-48"
                  value={filters.search || ''} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
                {filters.search && (
                  <button onClick={() => setFilters({ ...filters, search: '' })} className="text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><FaTimes className="text-xs" /></button>
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

              {canManage && (
                <button onClick={() => setAiOpen(v => !v)}
                  className={`text-sm font-medium px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${aiOpen
                    ? 'bg-gradient-to-r from-[#0d9488] to-[#0f766e] text-white shadow-lg shadow-[#0d9488]/30'
                    : 'bg-gray-100 dark:bg-[#1a1a24] border border-gray-300 dark:border-gray-800/60 text-gray-700 dark:text-gray-300 hover:border-[#0d9488]/50 hover:text-[#0d9488]'}`}
                  title={aiOpen ? 'Close AI planner' : 'Open AI planner'}>
                  <FaMagic className="text-xs" />
                  <span className="hidden sm:inline">{aiOpen ? 'Close AI' : 'AI'}</span>
                </button>
              )}

              {canManage && (
                <button onClick={() => setShowCreateModal(true)} className="bg-[#0d9488] hover:bg-[#0f9e96] text-white text-sm font-medium px-3 py-1.5 rounded-xl transition flex items-center gap-1.5">
                  <FaPlus className="text-xs" /> <span className="hidden sm:inline">New</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-4 pb-2">
            <div className="flex gap-1">
              {['active', 'archived', ...(canManage ? ['trash'] : [])].map((tab) => (
                <button key={tab} onClick={() => setView(tab)}
                  className={`text-xs px-3 py-1 rounded-full transition ${view === tab ? 'bg-[#0d9488]/20 text-[#0d9488] border border-[#0d9488]/30' : 'text-gray-600 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}>
                  {tab === 'active' ? 'All' : tab === 'archived' ? 'Archived' : 'Trash'}
                </button>
              ))}
            </div>
            {view === 'active' && !aiOpen && (
              <div className="hidden md:flex items-center gap-2 overflow-x-auto">
                {['all', 'planning', 'in-progress', 'completed'].map((status) => (
                  <button key={status} onClick={() => setFilters({ ...filters, status })}
                    className={`text-xs px-3 py-1 rounded-full transition whitespace-nowrap ${filters.status === status ? 'bg-[#0d9488]/20 text-[#0d9488] border border-[#0d9488]/30' : 'text-gray-600 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 border border-transparent hover:border-gray-300 dark:hover:border-gray-700'}`}>
                    {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <div ref={containerRef} className="flex-1 flex overflow-hidden">
          <div className="overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-28 md:pb-6 flex-shrink-0"
            style={{ width: aiOpen && isDesktop ? `${leftWidthPercent}%` : '100%' }}>

            {view === 'active' && !aiOpen && (
              <div className="md:hidden mb-4">
                <div className="relative bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/40 p-4 overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#0d9488]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  <div className="relative flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2"><FaChartPie className="text-[#0d9488]" /> Overview</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-500">{completedProjects}/{totalProjects} done</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-100 dark:bg-[#1a1a24] rounded-xl p-3 border border-gray-200 dark:border-gray-800/30">
                      <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{totalProjects}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1"><FaFolder className="text-[10px] text-[#0d9488]" /> Total</p>
                    </div>
                    <div className="bg-gray-100 dark:bg-[#1a1a24] rounded-xl p-3 border border-blue-200 dark:border-blue-500/20">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{planningProjects}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1"><FaClock className="text-[10px] text-blue-600 dark:text-blue-400" /> Planning</p>
                    </div>
                    <div className="bg-gray-100 dark:bg-[#1a1a24] rounded-xl p-3 border border-yellow-200 dark:border-yellow-500/20">
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{inProgressProjects}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1"><FaSpinner className="text-[10px] text-yellow-600 dark:text-yellow-400" /> In Progress</p>
                    </div>
                    <div className="bg-gray-100 dark:bg-[#1a1a24] rounded-xl p-3 border border-green-200 dark:border-green-500/20">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedProjects}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1"><FaCheckCircle className="text-[10px] text-green-600 dark:text-green-400" /> Completed</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-500 mb-1">
                      <span>Overall progress</span><span className="font-mono">{overallProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800/60 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${overallProgress}%`, backgroundColor: brandColor }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'active' && !aiOpen && (
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

            <div className={aiOpen ? 'grid grid-cols-1 gap-6' : 'grid grid-cols-1 lg:grid-cols-3 gap-6'}>
              <div className={aiOpen ? '' : 'lg:col-span-2'}>
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
                      <ProjectCard key={project._id} project={project} brandColor={brandColor} workspaceId={workspaceId} canManage={canManage} onMenuOpen={handleMenuOpen} />
                    ))}
                  </div>
                )}
              </div>

              {view === 'active' && !aiOpen && (
                <div className="hidden lg:block space-y-5">
                  <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/40 p-4">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2"><FaRocket className="text-[#0d9488]" /> Active Projects</h4>
                    <div className="mt-3 space-y-3">
                      {activeProjects.length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-500">No active projects</p>
                      ) : (
                        activeProjects.map((p) => (
                          <Link key={p._id} to={`/workspace/${workspaceId}/project/${p._id}`} className="flex items-center justify-between group">
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
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2"><FaClock className="text-[#0d9488]" /> Recent Activity</h4>
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
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2"><FaCheckCircle className="text-[#0d9488]" /> Completion Rate</h4>
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

          {aiOpen && isDesktop && (
            <div onMouseDown={handleSplitterDown}
              className={`w-1.5 flex-shrink-0 cursor-col-resize group relative transition-colors ${isDraggingSplitter ? 'bg-[#0d9488]/40' : 'bg-transparent hover:bg-[#0d9488]/10'}`}
              style={{ touchAction: 'none' }}>
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-12 rounded-full transition-colors ${isDraggingSplitter ? 'bg-[#0d9488]' : 'bg-gray-300 dark:bg-gray-700 group-hover:bg-[#0d9488]'}`} />
            </div>
          )}

          {aiOpen && (
            isDesktop ? (
              <div className="flex-shrink-0 border-l border-gray-200 dark:border-gray-800/60 overflow-hidden" style={{ width: `${100 - leftWidthPercent}%` }}>
                <AIProjectPanel
                  workspaceId={workspaceId}
                  brandColor={brandColor}
                  workspaceMembers={workspaceMembers}
                  onClose={() => setAiOpen(false)}
                  onExecuted={handleAIPlanExecuted}
                />
              </div>
            ) : (
              <div className="fixed inset-0 z-50 bg-white dark:bg-[#14141a] flex flex-col">
                <AIProjectPanel
                  workspaceId={workspaceId}
                  brandColor={brandColor}
                  workspaceMembers={workspaceMembers}
                  onClose={() => setAiOpen(false)}
                  onExecuted={handleAIPlanExecuted}
                />
              </div>
            )
          )}
        </div>
      </div>

      <YourWorkspaceBottombar workspace={workspace} />

      <SearchProjectsModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} projects={projects} brandColor={brandColor} workspaceId={workspaceId} />
      <FilterDrawer isOpen={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)} filters={filters} setFilters={setFilters} view={view} setView={setView} canManage={canManage} />
      {canManage && <CreateProjectModal workspace={workspace} isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onCreated={() => refetchProjects()} />}

      <EditProjectModal
        isOpen={!!editProjectId}
        onClose={() => setEditProjectId(null)}
        projectId={editProjectId}
        workspaceId={workspaceId}
        brandColor={brandColor}
        onSuccess={handleEditSuccess}
      />

      <ProjectMenuModal
        isOpen={menuModalOpen}
        onClose={handleMenuClose}
        project={selectedProject}
        canManage={canManage}
        onEdit={handleEdit}
        onArchive={() => selectedProject && handleArchive(selectedProject._id)}
        onUnarchive={() => selectedProject && handleUnarchive(selectedProject._id)}
        onDelete={() => selectedProject && handleDeleteProject(selectedProject._id)}
        onPermanentDelete={() => selectedProject && handlePermanentDelete(selectedProject._id)}
        onRestore={() => selectedProject && handleRestore(selectedProject._id)}
        onAISummary={(p) => setAiSummaryProject(p)}
        onAIReview={(p) => setAiReviewProject(p)}
        onAIDocs={(p) => setAiDocsProject(p)}
        brandColor={brandColor}
      />

      {/* AI modals — project-scoped */}
      <AISummaryModal
        isOpen={!!aiSummaryProject}
        onClose={() => setAiSummaryProject(null)}
        projectId={aiSummaryProject?._id}
        brandColor={brandColor}
      />
      <AIReviewModal
        isOpen={!!aiReviewProject}
        onClose={() => setAiReviewProject(null)}
        projectId={aiReviewProject?._id}
        brandColor={brandColor}
      />
      <AIDocsModal
        isOpen={!!aiDocsProject}
        onClose={() => setAiDocsProject(null)}
        projectId={aiDocsProject?._id}
        brandColor={brandColor}
      />
    </div>
  );
};

export default YourWorkspaceProjects;
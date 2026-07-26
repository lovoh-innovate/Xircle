// src/workspaceScreens/YourWorkspaceProjects.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetWorkspaceProjectsQuery, useDeleteProjectMutation } from '../slices/projectApiSlice';
import { useGetProjectTasksQuery } from '../slices/taskApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
import {
  FaArrowLeft,
  FaFolder,
  FaUsers,
  FaTasks,
  FaSearch,
  FaChartLine,
  FaCalendarAlt,
  FaUserCheck,
  FaLink,
  FaFileAlt,
  FaEllipsisV,
  FaEdit,
  FaTrashAlt,
  FaTimes,
  FaPlus,
  FaRocket,
  FaFilter,
  FaChevronDown,
  FaClock,
  FaCheckCircle,
  FaSpinner,
  FaChartPie,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// ─── Filter Drawer (mobile) ─────────────────────────────────────────────
const FilterDrawer = ({ isOpen, onClose, filters, setFilters }) => {
  if (!isOpen) return null;
  const statuses = ['all', 'planning', 'in-progress', 'completed', 'archived'];

  return (
    <div className="fixed inset-0 z-40 bg-[#0b0b10]/80 backdrop-blur-sm flex justify-end">
      <div className="w-72 max-w-full h-full bg-[#14141a] border-l border-gray-800/60 p-6 overflow-y-auto animate-slide-in-right">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-200">Filters</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <FaTimes />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Status</label>
            <div className="mt-2 space-y-1">
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => setFilters({ ...filters, status })}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${
                    filters.status === status
                      ? 'bg-[#0d9488]/20 text-[#0d9488] border border-[#0d9488]/30'
                      : 'text-gray-400 hover:bg-gray-800/30'
                  }`}
                >
                  {status === 'all' ? 'All Projects' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Sort By</label>
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
              className="w-full bg-[#1e1e26] border border-gray-800/60 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:border-[#0d9488]/50 mt-2"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="progress">Progress</option>
              <option value="name">Name</option>
            </select>
          </div>
          <button
            onClick={() => setFilters({ status: 'all', sort: 'newest' })}
            className="w-full py-2 text-xs text-gray-400 hover:text-white transition"
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Project Card (futuristic) ──────────────────────────────────────────
const ProjectCard = ({
  project,
  brandColor,
  workspaceId,
  isOwner,
  isManager,
  onDelete,
  onEdit,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const progress = project.progress || 0;
  const statusLabels = {
    planning: 'Planning',
    'in-progress': 'In Progress',
    completed: 'Completed',
    archived: 'Archived',
  };
  const statusColor = {
    planning: 'text-blue-400',
    'in-progress': 'text-yellow-400',
    completed: 'text-green-400',
    archived: 'text-gray-400',
  };
  const canManage = isOwner || isManager;

  // ── fetch tasks for this project ──────────────────────────────
  const { data: taskData, isLoading: taskLoading } = useGetProjectTasksQuery(
    { projectId: project._id }
  );
  const tasks = taskData?.tasks || [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(
    (t) => t.status === 'completed' || t.status === 'confirmed_completed'
  ).length;

  const handleDelete = () => {
    if (window.confirm(`Delete project "${project.name}"?`)) {
      onDelete && onDelete(project._id);
    }
  };

  const stopProp = (e) => e.stopPropagation();

  return (
    <div className="group relative bg-[#14141a] rounded-2xl border border-gray-800/40 hover:border-[#0d9488]/50 transition-all duration-500 hover:shadow-[0_8px_40px_rgba(13,148,136,0.15)] overflow-hidden">
      {/* Animated gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d9488]/0 via-[#0d9488]/0 to-transparent group-hover:from-[#0d9488]/10 group-hover:via-[#0d9488]/5 transition-all duration-700" />

      {/* Cover Image – smaller on mobile */}
      <div className="relative h-20 md:h-28 bg-[#1a1a24] overflow-hidden">
        {project.coverImage ? (
          <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: `${brandColor}15` }}
          >
            <FaFolder className="text-2xl md:text-3xl" style={{ color: brandColor }} />
          </div>
        )}
        {/* Status badge on cover */}
        <span
          className={`absolute top-2 right-2 text-[10px] font-medium px-2.5 py-1 rounded-full backdrop-blur-sm border ${statusColor[project.status]} bg-black/30 border-gray-700/50`}
        >
          {statusLabels[project.status] || 'Planning'}
        </span>
        {/* Menu button */}
        {canManage && (
          <div className="absolute top-2 left-2">
            <button
              onClick={(e) => {
                stopProp(e);
                setShowMenu(!showMenu);
              }}
              className="p-1.5 bg-black/40 backdrop-blur-sm rounded-lg text-gray-300 hover:text-white hover:bg-black/60 transition"
            >
              <FaEllipsisV className="text-xs" />
            </button>
            {showMenu && (
              <div className="absolute left-0 top-full mt-1 bg-[#1e1e26] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.8)] border border-gray-800/60 min-w-[130px] z-20 py-1">
                <button
                  onClick={(e) => {
                    stopProp(e);
                    setShowMenu(false);
                    onEdit && onEdit(project._id);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-[#0d9488]/10 hover:text-white transition w-full"
                >
                  <FaEdit className="text-xs text-[#0d9488]" /> Edit
                </button>
                {isOwner && (
                  <button
                    onClick={(e) => {
                      stopProp(e);
                      setShowMenu(false);
                      handleDelete();
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition w-full"
                  >
                    <FaTrashAlt className="text-xs" /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Body – smaller padding on mobile */}
      <Link
        to={`/workspace/${workspaceId}/project/${project._id}`}
        className="block p-3 md:p-4"
        onClick={(e) => {
          if (showMenu) e.preventDefault();
        }}
      >
        <h3 className="text-sm md:text-base font-semibold text-gray-200 group-hover:text-white transition truncate">
          {project.name}
        </h3>
        {project.description && (
          <p className="text-xs text-gray-400 line-clamp-1 md:line-clamp-2 mt-0.5 md:mt-1">
            {project.description}
          </p>
        )}

        {/* Team avatars */}
        <div className="flex items-center mt-2 md:mt-3 gap-1">
          <div className="flex -space-x-2">
            {(project.teamMembers || []).slice(0, 4).map((member, idx) => (
              <div
                key={idx}
                className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-gray-800 bg-gray-700 flex items-center justify-center text-[7px] md:text-[8px] font-bold text-white"
                style={{
                  backgroundColor: member?.profile ? 'transparent' : brandColor,
                }}
              >
                {member?.profile ? (
                  <img src={member.profile} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  (member?.name?.charAt(0) || '?').toUpperCase()
                )}
              </div>
            ))}
            {(project.teamMembers || []).length > 4 && (
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-gray-800 bg-[#1e1e26] flex items-center justify-center text-[7px] md:text-[8px] text-gray-400">
                +{(project.teamMembers || []).length - 4}
              </div>
            )}
          </div>
          <span className="text-[9px] md:text-[10px] text-gray-500 ml-1">
            {(project.teamMembers || []).length} members
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 md:mt-3 relative">
          <div className="flex justify-between text-[9px] md:text-[10px] text-gray-500 mb-0.5 md:mb-1">
            <span>Progress</span>
            <span className="font-mono">{progress}%</span>
          </div>
          <div className="w-full h-1 md:h-1.5 bg-gray-800/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${progress}%`,
                backgroundColor: brandColor,
                boxShadow: `0 0 12px ${brandColor}88`,
              }}
            />
          </div>
        </div>

        {/* Meta info – now showing real task counts */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2 md:mt-3 text-[9px] md:text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <FaCalendarAlt className="text-[8px] md:text-[10px] text-[#0d9488]" />
            {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}
          </span>
          {taskLoading ? (
            <span className="flex items-center gap-1">
              <FaSpinner className="animate-spin text-[10px]" />
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <FaTasks className="text-[8px] md:text-[10px] text-[#0d9488]" />
              {totalTasks} tasks
            </span>
          )}
          {project.links?.length > 0 && (
            <span className="flex items-center gap-1 text-blue-400">
              <FaLink className="text-[8px] md:text-[10px]" />
              {project.links.length}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────
const YourWorkspaceProjects = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filters, setFilters] = useState({ status: 'all', sort: 'newest', search: '' });

  const {
    data: workspaceData,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useGetWorkspaceQuery(workspaceId);
  const {
    data: projectsData,
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useGetWorkspaceProjectsQuery({ workspaceId });
  const [deleteProject] = useDeleteProjectMutation();

  const workspace = workspaceData?.workspace;
  const projects = projectsData?.projects || [];
  const brandColor = workspace?.color || '#0d9488';
  const isOwner =
    workspace?.owner?._id === userInfo?._id || workspace?.owner === userInfo?._id;

  // ─── AUTO‑COMPLETE LOGIC ────────────────────────────────────────────────
  const projectsWithAutoComplete = projects.map((p) => ({
    ...p,
    status: p.progress >= 100 ? 'completed' : p.status,
  }));

  const allProjects = projectsWithAutoComplete;

  // Filter and sort
  const filteredProjects = allProjects
    .filter((p) => {
      if (filters.status !== 'all' && p.status !== filters.status) return false;
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

  const totalProjects = allProjects.length;
  const completedProjects = allProjects.filter((p) => p.status === 'completed').length;
  const inProgressProjects = allProjects.filter((p) => p.status === 'in-progress').length;
  const planningProjects = allProjects.filter((p) => p.status === 'planning').length;
  const overallProgress = totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0;

  // Active projects (top 3 by progress)
  const activeProjects = [...allProjects]
    .filter((p) => p.status !== 'completed' && p.status !== 'archived')
    .sort((a, b) => (b.progress || 0) - (a.progress || 0))
    .slice(0, 3);

  // Recent activity (simulated)
  const recentActivity = allProjects
    .slice(0, 5)
    .map((p) => ({
      id: p._id,
      projectName: p.name,
      action: p.updatedAt
        ? `updated progress to ${p.progress || 0}%`
        : 'created',
      time: p.updatedAt || p.createdAt,
    }))
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 5);

  const handleDeleteProject = async (projectId) => {
    try {
      await deleteProject(projectId).unwrap();
      toast.success('Project deleted!');
      refetchProjects();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete project');
    }
  };

  const handleEditProject = (projectId) => {
    navigate(`/workspace/${workspaceId}/projects/edit/${projectId}`);
  };

  if (workspaceError || projectsError) {
    navigate(`/workspace/${workspaceId}`);
    return null;
  }

  if (workspaceLoading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b10]">
        <div className="text-center">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: brandColor, borderTopColor: 'transparent' }}
          />
          <p className="mt-3 text-gray-500 text-sm">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <div className="h-dvh bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <YourWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-4 h-14 lg:h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/workspace/${workspaceId}`)}
                className="p-1 lg:hidden text-gray-400 hover:text-white transition"
              >
                <FaArrowLeft />
              </button>
              <h1 className="text-lg font-bold text-gray-100 tracking-tight">Projects</h1>
              <span className="text-xs font-normal text-gray-500 bg-[#1a1a24] px-2 py-0.5 rounded-full border border-gray-800/40">
                {totalProjects}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Search (desktop) */}
              <div className="hidden md:flex items-center bg-[#1a1a24] border border-gray-800/60 rounded-full px-3 py-1.5 gap-2 focus-within:border-[#0d9488]/50 transition">
                <FaSearch className="text-gray-500 text-xs" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  className="bg-transparent outline-none text-sm text-gray-200 w-32 lg:w-48"
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
                {filters.search && (
                  <button
                    onClick={() => setFilters({ ...filters, search: '' })}
                    className="text-gray-500 hover:text-gray-300"
                  >
                    <FaTimes className="text-xs" />
                  </button>
                )}
              </div>
              {/* Filter toggle (desktop) */}
              <button
                onClick={() => setFilterDrawerOpen(true)}
                className="hidden md:flex items-center gap-1.5 bg-[#1a1a24] border border-gray-800/60 rounded-full px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-gray-600 transition"
              >
                <FaFilter className="text-[10px]" />
                Filter
                <FaChevronDown className="text-[8px] ml-1" />
              </button>
              {/* Mobile search + filter */}
              <button
                onClick={() => setSearchOpen(true)}
                className="md:hidden p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/30 rounded-xl transition"
              >
                <FaSearch className="text-sm" />
              </button>
              <button
                onClick={() => setFilterDrawerOpen(true)}
                className="md:hidden p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/30 rounded-xl transition"
              >
                <FaFilter className="text-sm" />
              </button>
              {/* ── Removed "New Project" button ── */}
            </div>
          </div>
          {/* Filter chips (desktop) */}
          <div className="hidden md:flex items-center gap-2 px-4 pb-2 overflow-x-auto">
            {['all', 'planning', 'in-progress', 'completed', 'archived'].map((status) => (
              <button
                key={status}
                onClick={() => setFilters({ ...filters, status })}
                className={`text-xs px-3 py-1 rounded-full transition whitespace-nowrap ${
                  filters.status === status
                    ? 'bg-[#0d9488]/20 text-[#0d9488] border border-[#0d9488]/30'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent hover:border-gray-700'
                }`}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-28 md:pb-6">
          {/* ─── MOBILE STATS CARD ───────────────────────────── */}
          <div className="md:hidden mb-4">
            <div className="relative bg-[#14141a] rounded-2xl border border-gray-800/40 p-4 overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#0d9488]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                  <FaChartPie className="text-[#0d9488]" />
                  Overview
                </h3>
                <span className="text-xs text-gray-500">
                  {completedProjects}/{totalProjects} done
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1a1a24] rounded-xl p-3 border border-gray-800/30">
                  <p className="text-2xl font-bold text-gray-100">{totalProjects}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <FaFolder className="text-[10px] text-[#0d9488]" /> Total
                  </p>
                </div>
                <div className="bg-[#1a1a24] rounded-xl p-3 border border-blue-500/20">
                  <p className="text-2xl font-bold text-blue-400">{planningProjects}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <FaClock className="text-[10px] text-blue-400" /> Planning
                  </p>
                </div>
                <div className="bg-[#1a1a24] rounded-xl p-3 border border-yellow-500/20">
                  <p className="text-2xl font-bold text-yellow-400">{inProgressProjects}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <FaSpinner className="text-[10px] text-yellow-400" /> In Progress
                  </p>
                </div>
                <div className="bg-[#1a1a24] rounded-xl p-3 border border-green-500/20">
                  <p className="text-2xl font-bold text-green-400">{completedProjects}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <FaCheckCircle className="text-[10px] text-green-400" /> Completed
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>Overall progress</span>
                  <span className="font-mono">{overallProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-800/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${overallProgress}%`, backgroundColor: brandColor }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ─── DESKTOP STATS GRID ──────────────────────────── */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="bg-[#14141a] rounded-xl border border-gray-800/40 p-4 backdrop-blur-sm hover:border-[#0d9488]/30 transition group">
              <p className="text-2xl font-bold text-gray-100 group-hover:text-[#0d9488] transition">
                {totalProjects}
              </p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total</p>
            </div>
            <div className="bg-[#14141a] rounded-xl border border-gray-800/40 p-4 hover:border-blue-500/30 transition group">
              <p className="text-2xl font-bold text-blue-400 group-hover:text-blue-300 transition">
                {planningProjects}
              </p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Planning</p>
            </div>
            <div className="bg-[#14141a] rounded-xl border border-gray-800/40 p-4 hover:border-yellow-500/30 transition group">
              <p className="text-2xl font-bold text-yellow-400 group-hover:text-yellow-300 transition">
                {inProgressProjects}
              </p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">In Progress</p>
            </div>
            <div className="bg-[#14141a] rounded-xl border border-gray-800/40 p-4 hover:border-green-500/30 transition group">
              <p className="text-2xl font-bold text-green-400 group-hover:text-green-300 transition">
                {completedProjects}
              </p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Completed</p>
            </div>
          </div>

          {/* Two‑column layout: projects + insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Projects Grid (2/3) */}
            <div className="lg:col-span-2">
              {filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <div className="w-16 h-16 rounded-full bg-[#14141a] border border-gray-800/60 flex items-center justify-center mb-4">
                    <FaFolder className="text-3xl text-gray-700" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-300">No projects match</h3>
                  <p className="text-sm text-gray-600 mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredProjects.map((project) => {
                    const isManager = project.projectManagers?.some(
                      (pm) => pm._id === userInfo?._id
                    );
                    return (
                      <ProjectCard
                        key={project._id}
                        project={project}
                        brandColor={brandColor}
                        workspaceId={workspaceId}
                        isOwner={isOwner}
                        isManager={isManager}
                        onDelete={handleDeleteProject}
                        onEdit={handleEditProject}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Insights Panel (1/3) – hidden on mobile, visible on lg */}
            <div className="hidden lg:block space-y-5">
              {/* Active Projects */}
              <div className="bg-[#14141a] rounded-2xl border border-gray-800/40 p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <FaRocket className="text-[#0d9488]" />
                  Active Projects
                </h4>
                <div className="mt-3 space-y-3">
                  {activeProjects.length === 0 ? (
                    <p className="text-xs text-gray-500">No active projects</p>
                  ) : (
                    activeProjects.map((p) => (
                      <Link
                        key={p._id}
                        to={`/workspace/${workspaceId}/project/${p._id}`}
                        className="flex items-center justify-between group"
                      >
                        <span className="text-sm text-gray-300 group-hover:text-white transition truncate">
                          {p.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-gray-800/60 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${p.progress || 0}%`, backgroundColor: brandColor }}
                            />
                          </div>
                          <span className="text-xs font-mono text-gray-500">
                            {p.progress || 0}%
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-[#14141a] rounded-2xl border border-gray-800/40 p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <FaClock className="text-[#0d9488]" />
                  Recent Activity
                </h4>
                <div className="mt-3 space-y-2">
                  {recentActivity.length === 0 ? (
                    <p className="text-xs text-gray-500">No recent activity</p>
                  ) : (
                    recentActivity.map((act) => (
                      <div key={act.id} className="flex items-start gap-2 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#0d9488] mt-1.5 flex-shrink-0" />
                        <div>
                          <span className="text-gray-300">{act.projectName}</span>
                          <span className="text-gray-500"> {act.action}</span>
                          <span className="text-gray-600 block">
                            {new Date(act.time).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Completion Rate */}
              <div className="bg-[#14141a] rounded-2xl border border-gray-800/40 p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <FaCheckCircle className="text-[#0d9488]" />
                  Completion Rate
                </h4>
                <div className="mt-3 flex items-center gap-4">
                  <div className="relative w-16 h-16">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        className="stroke-gray-800/60"
                        strokeWidth="3"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        className="stroke-[#0d9488] transition-all duration-1000"
                        strokeWidth="3"
                        strokeDasharray="100"
                        strokeDashoffset={100 - (totalProjects ? (completedProjects / totalProjects) * 100 : 0)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-300">
                      {overallProgress}%
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-300">
                      {completedProjects} of {totalProjects} completed
                    </p>
                    <p className="text-xs text-gray-500">
                      {totalProjects - completedProjects} remaining
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation (mobile) */}
      <YourWorkspaceBottombar workspace={workspace} />

      {/* Mobile Search Modal */}
      <SearchProjectsModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        projects={allProjects}
        brandColor={brandColor}
        workspaceId={workspaceId}
      />

      {/* Filter Drawer (mobile) */}
      <FilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={filters}
        setFilters={setFilters}
      />
    </div>
  );
};

// ─── Search Projects Modal (dark theme) ──────────────────────────────
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
    <div className="fixed inset-0 z-50 bg-[#0b0b10]/90 backdrop-blur-xl flex flex-col">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-800/60 bg-[#14141a]/80">
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition">
          <FaArrowLeft />
        </button>
        <div className="flex-1 bg-[#1e1e26] rounded-2xl px-4 py-2 flex items-center gap-3 border border-gray-800/40 focus-within:border-[#0d9488]/50 transition">
          <FaSearch className="text-gray-500 text-xs" />
          <input
            type="text"
            placeholder="Search projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent w-full outline-none text-sm text-gray-200 placeholder-gray-500"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-500 hover:text-gray-300">
              <FaTimes className="text-xs" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {!query && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FaSearch className="text-5xl mb-3 opacity-20" />
            <p className="text-sm">Search projects by name or description</p>
          </div>
        )}
        {query && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
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
                  navigate(`/workspace/${workspaceId}/project/${project._id}`);
                }}
                className="flex items-center gap-4 px-4 py-3 bg-[#14141a] rounded-xl border border-gray-800/40 hover:border-[#0d9488]/40 hover:bg-[#1a1a24] transition cursor-pointer group"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
                >
                  <FaFolder className="text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 group-hover:text-white transition">
                    {project.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
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

export default YourWorkspaceProjects;
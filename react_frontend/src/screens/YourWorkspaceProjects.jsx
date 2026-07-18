// src/workspaceScreens/YourWorkspaceProjects.jsx
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetWorkspaceProjectsQuery, useDeleteProjectMutation } from '../slices/projectApiSlice';
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
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// ─── Search Projects Modal ────────────────────────────────────────────
const SearchProjectsModal = ({ isOpen, onClose, projects, brandColor, workspaceId }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  if (!isOpen) return null;

  const filtered = projects.filter(
    p =>
      p.name?.toLowerCase().includes(query.toLowerCase()) ||
      p.description?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-100">
        <button onClick={onClose} className="p-1">
          <FaArrowLeft className="text-gray-600" />
        </button>
        <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 flex items-center gap-2">
          <FaSearch className="text-gray-400 text-xs" />
          <input
            type="text"
            placeholder="Search projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent w-full outline-none text-sm"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')}>
              <FaTimes className="text-gray-400 text-xs" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {!query && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FaSearch className="text-4xl mb-2 opacity-30" />
            <p className="text-sm">Search projects by name or description</p>
          </div>
        )}
        {query && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-sm">No results for "{query}"</p>
          </div>
        )}
        {query && filtered.length > 0 && (
          <div className="divide-y divide-gray-100">
            {filtered.map((project) => (
              <div
                key={project._id}
                onClick={() => {
                  onClose();
                  navigate(`/workspace/${workspaceId}/project/${project._id}`);
                }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition cursor-pointer"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
                >
                  <FaFolder className="text-sm" />
                </div>
                <div>
                  <p className="text-sm font-medium">{project.name}</p>
                  <p className="text-xs text-gray-500">
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

// ─── Project Card (clickable, with manager actions) ──────────────────
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
  const statusColors = {
    planning: 'bg-blue-50 text-blue-600',
    'in-progress': 'bg-yellow-50 text-yellow-600',
    completed: 'bg-green-50 text-green-600',
    archived: 'bg-gray-50 text-gray-600',
  };
  const statusLabels = {
    planning: 'Planning',
    'in-progress': 'In Progress',
    completed: 'Completed',
    archived: 'Archived',
  };
  const progress = project.progress || 0;
  const canManage = isOwner || isManager;

  const handleDelete = () => {
    if (window.confirm(`Delete project "${project.name}"? This action cannot be undone.`)) {
      onDelete && onDelete(project._id);
    }
  };

  // Prevent dropdown actions from triggering navigation
  const stopProp = (e) => e.stopPropagation();

  return (
    <div className="relative bg-white rounded-2xl border border-gray-200/60 p-4 transition hover:border-gray-300 group">
      {/* Menu button – absolutely positioned and stops propagation */}
      {canManage && (
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={(e) => {
              stopProp(e);
              setShowMenu(!showMenu);
            }}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <FaEllipsisV className="text-xs" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 min-w-[120px] z-20 py-1">
              <button
                onClick={(e) => {
                  stopProp(e);
                  setShowMenu(false);
                  onEdit && onEdit(project._id);
                }}
                className="flex items-center gap-2 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition w-full"
              >
                <FaEdit className="text-xs" /> Edit
              </button>
              {isOwner && (
                <button
                  onClick={(e) => {
                    stopProp(e);
                    setShowMenu(false);
                    handleDelete();
                  }}
                  className="flex items-center gap-2 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 transition w-full"
                >
                  <FaTrashAlt className="text-xs" /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Clickable link wrapping the whole card */}
      <Link
        to={`/workspace/${workspaceId}/project/${project._id}`}
        className="block"
        onClick={(e) => {
          // If the menu is open, prevent navigation (optional)
          if (showMenu) e.preventDefault();
        }}
      >
        <div className="flex items-start justify-between mb-2 pr-8">
          <div className="flex items-center gap-3 min-w-0">
            {project.coverImage ? (
              <img
                src={project.coverImage}
                alt={project.name}
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${brandColor}15` }}
              >
                <FaFolder className="text-sm" style={{ color: brandColor }} />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {project.name}
              </h3>
              <p className="text-xs text-gray-500 truncate">
                {project.teamMembers?.length || 0} members ·{' '}
                {project.taskStats?.totalTasks || 0} tasks
              </p>
            </div>
          </div>
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
              statusColors[project.status] || statusColors.planning
            }`}
          >
            {statusLabels[project.status] || 'Planning'}
          </span>
        </div>

        {project.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">
            {project.description}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <FaCalendarAlt className="text-[10px]" />
            {project.startDate
              ? new Date(project.startDate).toLocaleDateString()
              : 'N/A'}
          </span>
          <span className="flex items-center gap-1">
            <FaChartLine className="text-[10px]" />
            {progress}%
          </span>
          <span className="flex items-center gap-1">
            <FaUserCheck className="text-[10px]" />
            {project.projectManagers?.length || 0}
          </span>
          {project.links?.length > 0 && (
            <span className="flex items-center gap-1 text-blue-500">
              <FaLink className="text-[10px]" />
            </span>
          )}
          {project.documents?.length > 0 && (
            <span className="flex items-center gap-1 text-orange-500">
              <FaFileAlt className="text-[10px]" />
            </span>
          )}
        </div>

        <div className="mt-3 w-full h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: brandColor }}
          />
        </div>
      </Link>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
const YourWorkspaceProjects = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [searchOpen, setSearchOpen] = useState(false);

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

  if (workspaceError || projectsError) {
    navigate(`/workspace/${workspaceId}`);
    return null;
  }

  if (workspaceLoading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: brandColor, borderTopColor: 'transparent' }}
          />
          <p className="mt-3 text-gray-500">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (!workspace) return null;

  const totalProjects = projects.length;
  const completedProjects = projects.filter(
    (p) => p.status === 'completed'
  ).length;
  const inProgressProjects = projects.filter(
    (p) => p.status === 'in-progress'
  ).length;
  const planningProjects = projects.filter(
    (p) => p.status === 'planning'
  ).length;

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

  return (
    <div className="h-dvh bg-gray-50 flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <YourWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Fixed Header */}
        <header className="sticky top-0 z-10 bg-teal-600 text-white flex-shrink-0 shadow-sm">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/workspace/${workspaceId}`)}
                className="p-1 lg:hidden"
              >
                <FaArrowLeft />
              </button>
              <h1 className="text-lg font-semibold">Projects</h1>
              <span className="text-xs text-white/70 ml-1">{totalProjects}</span>
            </div>
            <button onClick={() => setSearchOpen(true)} className="p-1">
              <FaSearch />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl px-4 py-3 border border-gray-200/60">
              <p className="text-lg font-bold text-gray-900">{totalProjects}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="bg-white rounded-xl px-4 py-3 border border-gray-200/60">
              <p className="text-lg font-bold text-gray-900">{planningProjects}</p>
              <p className="text-xs text-gray-500">Planning</p>
            </div>
            <div className="bg-white rounded-xl px-4 py-3 border border-gray-200/60">
              <p className="text-lg font-bold text-gray-900">
                {inProgressProjects}
              </p>
              <p className="text-xs text-gray-500">In Progress</p>
            </div>
            <div className="bg-white rounded-xl px-4 py-3 border border-gray-200/60">
              <p className="text-lg font-bold text-gray-900">
                {completedProjects}
              </p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
          </div>

          {/* Projects Grid */}
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <FaFolder className="text-2xl text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">No projects yet</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map((project) => {
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
      </div>

      {/* Bottom Navigation (mobile) */}
      <YourWorkspaceBottombar workspace={workspace} />

      {/* Search Modal */}
      <SearchProjectsModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        projects={projects}
        brandColor={brandColor}
        workspaceId={workspaceId}
      />
    </div>
  );
};

export default YourWorkspaceProjects;
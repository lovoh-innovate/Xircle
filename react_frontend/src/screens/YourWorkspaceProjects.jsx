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
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// ─── Project Card (with manager actions) ────────────────────────────
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
  const hasLinks = project.links && project.links.length > 0;
  const hasDocs = project.documents && project.documents.length > 0;
  const canManage = isOwner || isManager;

  const handleDelete = () => {
    if (window.confirm(`Delete project "${project.name}"? This action cannot be undone.`)) {
      onDelete && onDelete(project._id);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition p-5 group relative">
      {/* Management dropdown (top right) */}
      {canManage && (
        <div className="absolute top-3 right-3">
          <button
            onClick={(e) => {
              e.preventDefault();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <FaEllipsisV className="text-xs" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 min-w-[120px] z-10 py-1">
              <button
                onClick={(e) => {
                  e.preventDefault();
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
                    e.preventDefault();
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

      <Link
        to={`/workspace/${workspaceId}/project/${project._id}`}
        className="block"
      >
        <div className="flex items-start justify-between mb-2">
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
              <h3 className="text-sm font-semibold text-gray-900 truncate">{project.name}</h3>
              <p className="text-xs text-gray-500 truncate">
                {project.teamMembers?.length || 0} members · {project.taskStats?.totalTasks || 0} tasks
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
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{project.description}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <FaCalendarAlt className="text-[10px]" />
            {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}
          </span>
          <span className="flex items-center gap-1">
            <FaChartLine className="text-[10px]" />
            {progress}%
          </span>
          <span className="flex items-center gap-1">
            <FaUserCheck className="text-[10px]" />
            {project.projectManagers?.length || 0}
          </span>
          {hasLinks && (
            <span className="flex items-center gap-1 text-blue-500">
              <FaLink className="text-[10px]" />
            </span>
          )}
          {hasDocs && (
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

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

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
  const brandColor = workspace?.color || '#4F46E5';
  const isOwner = workspace?.owner?._id === userInfo?._id || workspace?.owner === userInfo?._id;

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

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalProjects = projects.length;
  const completedProjects = projects.filter((p) => p.status === 'completed').length;
  const inProgressProjects = projects.filter((p) => p.status === 'in-progress').length;
  const planningProjects = projects.filter((p) => p.status === 'planning').length;

  const statusFilters = [
    { value: 'all', label: 'All' },
    { value: 'planning', label: 'Planning' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ];

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
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <div className="hidden md:block md:w-64 md:min-h-screen md:flex-shrink-0 sticky top-0">
        <YourWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      <div className="flex-1 bg-white md:min-h-screen overflow-y-auto pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/workspace/${workspaceId}`)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <FaArrowLeft className="text-gray-500" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Projects</h1>
                <p className="text-sm text-gray-500">
                  {totalProjects} projects · {inProgressProjects} in progress
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <p className="text-lg font-bold text-gray-900">{totalProjects}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <p className="text-lg font-bold text-gray-900">{planningProjects}</p>
              <p className="text-xs text-gray-500">Planning</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <p className="text-lg font-bold text-gray-900">{inProgressProjects}</p>
              <p className="text-xs text-gray-500">In Progress</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <p className="text-lg font-bold text-gray-900">{completedProjects}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setFilterStatus(filter.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  filterStatus === filter.value
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={filterStatus === filter.value ? { backgroundColor: brandColor } : {}}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="relative mb-6">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              style={{ '--tw-ring-color': brandColor }}
              onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
            />
          </div>

          {filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <FaFolder className="text-2xl text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">No projects found</h3>
              <p className="text-sm text-gray-400 mt-1">
                {searchQuery ? 'Try a different search term' : 'No projects available in this workspace'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => {
                // Determine if the current user is a project manager for this project
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

      <YourWorkspaceBottombar workspace={workspace} />
    </div>
  );
};

export default YourWorkspaceProjects;
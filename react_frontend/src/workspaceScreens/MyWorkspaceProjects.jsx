// src/workspaceScreens/MyWorkspaceProjects.jsx
import React, { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useGetWorkspaceQuery } from "../slices/workspaceApiSlice";
import {
  useGetWorkspaceProjectsQuery,
  useDeleteProjectMutation,
  useCreateProjectMutation,
} from "../slices/projectApiSlice";
import MyWorkspaceSidebar from "../workspaceComponents/MyWorkspaceSidebar";
import MyWorkspaceBottombar from "../workspaceComponents/MyWorkspaceBottombar";
import {
  FaPlus,
  FaFolder,
  FaUsers,
  FaSearch,
  FaChartLine,
  FaTasks,
  FaTrashAlt,
  FaEdit,
  FaEllipsisV,
  FaTimes,
  FaArrowLeft,
} from "react-icons/fa";
import { toast } from "react-toastify";

/* ──────────────────────────────────────────────────
   ProjectCard – unchanged
   ────────────────────────────────────────────────── */
const ProjectCard = ({ project, brandColor, onDelete, onEdit }) => {
  const [showMenu, setShowMenu] = useState(false);
  const statusColors = {
    planning: "bg-blue-50 text-blue-600",
    "in-progress": "bg-yellow-50 text-yellow-600",
    completed: "bg-green-50 text-green-600",
    archived: "bg-gray-50 text-gray-600",
  };
  const statusLabels = {
    planning: "Planning",
    "in-progress": "In Progress",
    completed: "Completed",
    archived: "Archived",
  };
  const progress = project.progress || 0;

  const handleDelete = () => {
    if (
      window.confirm(
        `Delete project "${project.name}"? This action cannot be undone.`
      )
    ) {
      onDelete && onDelete(project._id);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 p-4 transition">
      <div className="flex items-start justify-between">
        <Link
          to={`/my-workspace/${project.workspace}/project/${project._id}`}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
              <FaFolder className="text-sm" style={{ color: brandColor }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {project.name}
                </h3>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                    statusColors[project.status] || statusColors.planning
                  }`}
                >
                  {statusLabels[project.status] || "Planning"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <FaUsers className="text-[10px]" />
                  {project.teamMembers?.length || 0}
                </span>
                <span className="flex items-center gap-1">
                  <FaTasks className="text-[10px]" />
                  {project.taskStats?.totalTasks || 0}
                </span>
                <span className="flex items-center gap-1">
                  <FaChartLine className="text-[10px]" />
                  {progress}%
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* Actions */}
        <div className="relative flex-shrink-0 ml-2">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <FaEllipsisV className="text-xs" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 min-w-[140px] z-10 py-1">
              <button
                onClick={() => {
                  setShowMenu(false);
                  onEdit && onEdit(project._id);
                }}
                className="flex items-center gap-2 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition w-full"
              >
                <FaEdit className="text-xs" /> Edit
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  handleDelete();
                }}
                className="flex items-center gap-2 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 transition w-full"
              >
                <FaTrashAlt className="text-xs" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {project.description && (
        <Link
          to={`/my-workspace/${project.workspace}/project/${project._id}`}
          className="block text-xs text-gray-500 line-clamp-1 mt-1 hover:text-gray-700"
        >
          {project.description}
        </Link>
      )}

      <div className="mt-2 w-full h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, backgroundColor: brandColor }}
        />
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────
   Search Projects Modal
   ────────────────────────────────────────────────── */
const SearchProjectsModal = ({ isOpen, onClose, projects, brandColor, workspaceId }) => {
  const [query, setQuery] = useState("");

  if (!isOpen) return null;

  const filtered = projects.filter(
    (p) =>
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
            <button onClick={() => setQuery("")}>
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
              <Link
                key={project._id}
                to={`/my-workspace/${workspaceId}/project/${project._id}`}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                  <FaFolder className="text-sm" style={{ color: brandColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{project.name}</p>
                  <p className="text-xs text-gray-500 truncate">{project.description || "No description"}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────
   Create Project Modal (FIXED API CALL)
   ────────────────────────────────────────────────── */
const CreateProjectModal = ({ workspace, isOpen, onClose, onCreated }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [createProject] = useCreateProjectMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("workspaceId", workspace._id);
      fd.append("name", name.trim());
      fd.append("description", description.trim());

      // FIX: pass workspaceId and data as separate keys as expected by the mutation
      await createProject({ workspaceId: workspace._id, data: fd }).unwrap();
      toast.success("Project created!");
      onCreated && onCreated();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            <FaPlus className="inline mr-2" /> New Project
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Project Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 text-white rounded-lg text-sm font-medium"
              style={{ backgroundColor: workspace?.color || "#0d9488" }}
            >
              {loading ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────────── */
const MyWorkspaceProjects = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const {
    data: workspaceData,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useGetWorkspaceQuery(workspaceId);
  const {
    data: projectsData,
    isLoading: projectsLoading,
    refetch: refetchProjects,
  } = useGetWorkspaceProjectsQuery({ workspaceId });
  const [deleteProject] = useDeleteProjectMutation();

  if (workspaceError) {
    navigate("/my-workspaces");
    return null;
  }

  if (workspaceLoading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{
              borderColor: workspaceData?.workspace?.color || "#0d9488",
              borderTopColor: "transparent",
            }}
          />
          <p className="mt-3 text-gray-500">Loading projects...</p>
        </div>
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  const projects = projectsData?.projects || [];
  if (!workspace) return null;

  const brandColor = workspace.color || "#0d9488";
  const isOwner =
    workspace.owner?._id === userInfo?._id || workspace.owner === userInfo?._id;

  const totalProjects = projects.length;
  const completedProjects = projects.filter((p) => p.status === "completed").length;
  const inProgressProjects = projects.filter((p) => p.status === "in-progress").length;
  const planningProjects = projects.filter((p) => p.status === "planning").length;

  const handleDeleteProject = async (projectId) => {
    try {
      await deleteProject(projectId).unwrap();
      toast.success("Project deleted!");
      refetchProjects();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to delete project");
    }
  };

  return (
    <div className="h-dvh bg-gray-50 flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Fixed Header */}
        <header className="sticky top-0 z-10 bg-teal-600 text-white flex-shrink-0 shadow-sm">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(`/my-workspace/${workspaceId}`)} className="p-1 lg:hidden">
                <FaArrowLeft />
              </button>
              <h1 className="text-lg font-semibold">Projects</h1>
              <span className="text-xs text-white/70 ml-1">{totalProjects}</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setSearchOpen(true)} className="p-1">
                <FaSearch className="text-white" />
              </button>
              {isOwner && (
                <button onClick={() => setShowCreateModal(true)} className="p-1">
                  <FaPlus className="text-white" />
                </button>
              )}
            </div>
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
              <p className="text-lg font-bold text-gray-900">{inProgressProjects}</p>
              <p className="text-xs text-gray-500">In Progress</p>
            </div>
            <div className="bg-white rounded-xl px-4 py-3 border border-gray-200/60">
              <p className="text-lg font-bold text-gray-900">{completedProjects}</p>
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
              {isOwner && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium"
                >
                  Create Project
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project._id}
                  project={project}
                  brandColor={brandColor}
                  onDelete={handleDeleteProject}
                  onEdit={(id) =>
                    navigate(`/my-workspace/${workspaceId}/projects/edit/${id}`)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation (mobile) */}
      <MyWorkspaceBottombar workspace={workspace} />

      {/* Search Modal */}
      <SearchProjectsModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        projects={projects}
        brandColor={brandColor}
        workspaceId={workspaceId}
      />

      {/* Create Project Modal */}
      {isOwner && (
        <CreateProjectModal
          workspace={workspace}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => refetchProjects()}
        />
      )}
    </div>
  );
};

export default MyWorkspaceProjects;
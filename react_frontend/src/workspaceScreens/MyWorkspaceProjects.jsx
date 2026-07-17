// src/workspaceScreens/MyWorkspaceProjects.jsx
import React, { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useGetWorkspaceQuery } from "../slices/workspaceApiSlice";
import {
  useGetWorkspaceProjectsQuery,
  useDeleteProjectMutation,
  useCreateProjectMutation, // ← new import
} from "../slices/projectApiSlice";
import MyWorkspaceSidebar from "../workspaceComponents/MyWorkspaceSidebar";
import MyWorkspaceBottombar from "../workspaceComponents/MyWorkspaceBottombar";
import {
  FaPlus,
  FaFolder,
  FaUsers,
  FaSearch,
  FaChevronRight,
  FaChartLine,
  FaCalendarAlt,
  FaUserCheck,
  FaTasks,
  FaTrashAlt,
  FaEdit,
  FaEllipsisV,
  FaTimes,
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
        `Delete project "${project.name}"? This action cannot be undone.`,
      )
    ) {
      onDelete && onDelete(project._id);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition p-4 group">
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
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[project.status] || statusColors.planning}`}
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
   Create Project Modal (Owner only)
   ────────────────────────────────────────────────── */
const CreateProjectModal = ({ workspace, isOpen, onClose, onCreated }) => {
  const [createProject, { isLoading }] = useCreateProjectMutation();
  const workspaceId = workspace._id;
  const brandColor = workspace.color || "#4F46E5";

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [detailedDescription, setDetailedDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [projectType, setProjectType] = useState("general");
  const [dailyReportTime, setDailyReportTime] = useState("17:00");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState("");
  const [links, setLinks] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedPMs, setSelectedPMs] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [coverImage, setCoverImage] = useState(null);

  // Active workspace members
  const activeMembers =
    workspace.members?.filter((m) => m.status === "active") || [];
  const ownerId = workspace.owner?._id || workspace.owner;

  // Toggle selection helpers
  const togglePM = (userId) => {
    setSelectedPMs((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };
  const toggleTeam = (userId) => {
    setSelectedTeam((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  // Dynamic field handlers
  const addLink = () => setLinks([...links, ""]);
  const removeLink = (index) => setLinks(links.filter((_, i) => i !== index));
  const updateLink = (index, value) => {
    const copy = [...links];
    copy[index] = value;
    setLinks(copy);
  };
  const addTag = () => setTags([...tags, ""]);
  const removeTag = (index) => setTags(tags.filter((_, i) => i !== index));
  const updateTag = (index, value) => {
    const copy = [...tags];
    copy[index] = value;
    setTags(copy);
  };

  // File handlers
  const handleDocumentsChange = (e) => {
    setDocuments(Array.from(e.target.files));
  };
  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    setCoverImage(file || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Project name is required.");
      return;
    }

    const formData = new FormData();
    formData.append("name", name.trim());
    if (description) formData.append("description", description);
    if (detailedDescription)
      formData.append("detailedDescription", detailedDescription);
    formData.append("priority", priority);
    formData.append("projectType", projectType);
    formData.append("dailyReportTime", dailyReportTime);
    formData.append("startDate", startDate);
    if (endDate) formData.append("endDate", endDate);

    links.forEach((link, idx) => {
      if (link.trim()) formData.append("links[]", link.trim());
    });
    tags.forEach((tag, idx) => {
      if (tag.trim()) formData.append("tags[]", tag.trim());
    });
    selectedPMs.forEach((pmId) => formData.append("projectManagerIds[]", pmId));
    selectedTeam.forEach((tmId) => formData.append("teamMemberIds[]", tmId));

    documents.forEach((file) => formData.append("documents", file));
    if (coverImage) formData.append("coverImage", coverImage);

    try {
      await createProject({ workspaceId, data: formData }).unwrap();
      toast.success("Project created!");
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to create project.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Create Project
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              placeholder="e.g., Website Redesign"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Short Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              placeholder="Brief overview..."
            />
          </div>

          {/* Detailed Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Detailed Description
            </label>
            <textarea
              value={detailedDescription}
              onChange={(e) => setDetailedDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              placeholder="Full project scope, requirements..."
            />
          </div>

          {/* Priority & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Type
              </label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
              >
                <option value="general">General</option>
                <option value="software">Software</option>
                <option value="design">Design</option>
                <option value="social_media">Social Media</option>
                <option value="marketing">Marketing</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
              />
            </div>
          </div>

          {/* Daily Report Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Daily Check‑in Deadline
            </label>
            <input
              type="time"
              value={dailyReportTime}
              onChange={(e) => setDailyReportTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
            />
          </div>

          {/* Links */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Links
            </label>
            {links.map((link, i) => (
              <div key={i} className="flex gap-2 mb-1">
                <input
                  type="url"
                  value={link}
                  onChange={(e) => updateLink(i, e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  placeholder="https://..."
                />
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  className="text-red-400 hover:text-red-600"
                >
                  <FaTimes />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLink}
              className="text-sm text-blue-600 hover:underline"
            >
              + Add link
            </button>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            {tags.map((tag, i) => (
              <div key={i} className="flex gap-2 mb-1">
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => updateTag(i, e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g., frontend"
                />
                <button
                  type="button"
                  onClick={() => removeTag(i)}
                  className="text-red-400 hover:text-red-600"
                >
                  <FaTimes />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addTag}
              className="text-sm text-blue-600 hover:underline"
            >
              + Add tag
            </button>
          </div>

          {/* Project Managers & Team Members */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Managers (at least one active member)
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2">
              {activeMembers.map((member) => {
                const userId = member.user._id || member.user;
                const isSelected = selectedPMs.includes(userId);
                return (
                  <button
                    key={userId}
                    type="button"
                    onClick={() => togglePM(userId)}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg text-sm ${
                      isSelected
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="pointer-events-none"
                    />
                    {member.user.name || member.user.email}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Team Members
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2">
              {activeMembers.map((member) => {
                const userId = member.user._id || member.user;
                const isSelected =
                  selectedTeam.includes(userId) || selectedPMs.includes(userId);
                return (
                  <button
                    key={userId}
                    type="button"
                    onClick={() => toggleTeam(userId)}
                    disabled={selectedPMs.includes(userId)}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg text-sm ${
                      selectedPMs.includes(userId)
                        ? "text-gray-300 cursor-not-allowed"
                        : isSelected
                          ? "bg-blue-50 text-blue-700"
                          : "hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      disabled={selectedPMs.includes(userId)}
                      className="pointer-events-none"
                    />
                    {member.user.name || member.user.email}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Documents */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Documents
            </label>
            <input
              type="file"
              multiple
              onChange={handleDocumentsChange}
              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {documents.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {documents.length} file(s) selected
              </p>
            )}
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cover Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-sm font-medium border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60 hover:opacity-90 transition"
              style={{ backgroundColor: brandColor }}
            >
              {isLoading ? "Creating..." : "Create Project"}
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
  const [searchQuery, setSearchQuery] = useState("");
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
              borderColor: workspaceData?.workspace?.color || "#4F46E5",
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

  const brandColor = workspace.color || "#4F46E5";
  const isOwner =
    workspace.owner?._id === userInfo?._id || workspace.owner === userInfo?._id;

  const filteredProjects = projects.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalProjects = projects.length;
  const completedProjects = projects.filter(
    (p) => p.status === "completed",
  ).length;
  const inProgressProjects = projects.filter(
    (p) => p.status === "in-progress",
  ).length;
  const planningProjects = projects.filter(
    (p) => p.status === "planning",
  ).length;

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
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="hidden md:block md:w-64 md:min-h-screen md:flex-shrink-0 sticky top-0">
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white md:min-h-screen overflow-y-auto pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Projects</h1>
              <p className="text-sm text-gray-500">
                {totalProjects} projects · {inProgressProjects} in progress
              </p>
            </div>
            {isOwner && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                <FaPlus className="text-xs" /> New Project
              </button>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <p className="text-lg font-bold text-gray-900">{totalProjects}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <p className="text-lg font-bold text-gray-900">
                {planningProjects}
              </p>
              <p className="text-xs text-gray-500">Planning</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <p className="text-lg font-bold text-gray-900">
                {inProgressProjects}
              </p>
              <p className="text-xs text-gray-500">In Progress</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <p className="text-lg font-bold text-gray-900">
                {completedProjects}
              </p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              style={{ "--tw-ring-color": brandColor }}
              onFocus={(e) =>
                e.target.style.setProperty("--tw-ring-color", brandColor)
              }
            />
          </div>

          {/* Projects Grid */}
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <FaFolder className="text-2xl text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                No projects found
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {searchQuery
                  ? "Try a different search term"
                  : "Create your first project"}
              </p>
              {!searchQuery && isOwner && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-4 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-90"
                  style={{ backgroundColor: brandColor }}
                >
                  Create Project
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProjects.map((project) => (
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

      {/* Bottom Navigation */}
      <MyWorkspaceBottombar workspace={workspace} />

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

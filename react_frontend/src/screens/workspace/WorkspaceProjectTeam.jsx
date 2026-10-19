// src/screens/workspace/WorkspaceProjectTeam.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  FaArrowLeft,
  FaFolder,
  FaCrown,
  FaUsers,
  FaUserMinus,
  FaUserPlus,
  FaTimes,
  FaCheck,
  FaUser,
  FaAngleDown,
  FaExclamationTriangle,
} from "react-icons/fa";
import { useGetWorkspaceQuery } from "../../slices/workspaceApiSlice";
import {
  useGetProjectByIdQuery,
  useManageProjectManagersMutation,
  useAddTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useGetProjectTeamWithTasksQuery,
} from "../../slices/projectApiSlice";
import WorkspaceSidebar from "../../components/WorkspaceSidebar";
import WorkspaceBottombar from "../../components/WorkspaceBottombar";

// ─── Base path (keep in sync with WorkspaceChatId / WorkspaceMembers / WorkspaceClockin / WorkspaceSidebar / WorkspaceBottombar / WorkspaceId / WorkspaceProjects / WorkspaceProjectId / WorkspaceChannels / WorkspaceDMs / WorkspaceNotes) ──
const WORKSPACE_BASE_PATH = "/workspace";

// ─── Custom Dropdown (inlined) ────────────────────────────────────────
const CustomDropdown = React.memo(({ options, value, onChange, placeholder, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div ref={dropdownRef} className="relative">
      {label && (
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-all focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none whitespace-nowrap"
      >
        {selectedOption?.icon && (
          <span className="text-[10px] flex-shrink-0">{selectedOption.icon}</span>
        )}
        <span className="truncate flex-1 text-left">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <FaAngleDown
          className={`text-[8px] text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-full w-max min-w-[140px] bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-50 max-h-48 overflow-y-auto">
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-500">
              No options
            </div>
          )}
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition whitespace-nowrap ${
                option.value === value
                  ? "bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"
              }`}
            >
              {option.icon && (
                <span className="text-[10px] flex-shrink-0">{option.icon}</span>
              )}
              <span>{option.label}</span>
              {option.value === value && (
                <FaCheck className="ml-auto text-[10px] text-teal-500 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── Confirm Modal (inlined) ──────────────────────────────────────────
const ConfirmModal = React.memo(
  ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    danger = false,
  }) => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            {danger && <FaExclamationTriangle className="text-red-500 text-xl" />}
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              {title}
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 ${
                danger
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-teal-600 dark:bg-[#0d9488] hover:bg-teal-700 dark:hover:bg-[#0f9e96]"
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

// ─── Add Member modal ──────────────────────────────────────────
const AddMemberModal = ({ isOpen, onClose, workspace, project, brandColor, onSuccess }) => {
  const [memberId, setMemberId] = useState("");
  const [loading, setLoading] = useState(false);
  const [addTeamMember] = useAddTeamMemberMutation();
  if (!isOpen) return null;

  const projectMemberIds =
    project.teamMembers
      ?.filter((m) => m.status === "active")
      .map((m) => m.user?._id || m._id) || [];
  const available =
    workspace.members?.filter(
      (m) => m.status === "active" && !projectMemberIds.includes(m.user?._id || m._id)
    ) || [];
  const options = available.map((m) => {
    const u = m.user || m;
    return {
      value: u._id,
      label: u.name || "Unknown",
      icon: u.profile ? (
        <img src={u.profile} className="w-4 h-4 rounded-full" alt="" />
      ) : (
        <FaUser className="text-gray-400" />
      ),
    };
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!memberId) return toast.error("Select a member");
    setLoading(true);
    try {
      await addTeamMember({ projectId: project._id, userId: memberId, role: "member" }).unwrap();
      toast.success("Member added");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            <FaUserPlus className="inline mr-1 text-[#0d9488]" /> Add Member
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"
          >
            <FaTimes />
          </button>
        </div>
        <form onSubmit={submit}>
          <CustomDropdown
            label="Select Member"
            options={options}
            value={memberId}
            onChange={setMemberId}
            placeholder="Select..."
            brandColor={brandColor}
          />
          {available.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">
              All workspace members are already on the project
            </p>
          )}
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || available.length === 0}
              className="flex-1 py-2 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: brandColor }}
            >
              {loading ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Add Manager modal ─────────────────────────────────────────
const AddManagerModal = ({ isOpen, onClose, workspace, project, brandColor, onConfirmAdd }) => {
  const [managerId, setManagerId] = useState("");
  if (!isOpen) return null;

  const projectManagerIds = (project.projectManagers || []).map((pm) => pm._id || pm);
  const available =
    workspace.members?.filter(
      (m) => m.status === "active" && !projectManagerIds.includes(m.user?._id || m._id)
    ) || [];
  const options = available.map((m) => {
    const u = m.user || m;
    return {
      value: u._id,
      label: u.name || "Unknown",
      icon: u.profile ? (
        <img src={u.profile} className="w-4 h-4 rounded-full" alt="" />
      ) : (
        <FaUser className="text-gray-400" />
      ),
    };
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            <FaCrown className="inline mr-1 text-yellow-500" /> Add Manager
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"
          >
            <FaTimes />
          </button>
        </div>
        <CustomDropdown
          label="Select Member"
          options={options}
          value={managerId}
          onChange={(v) => {
            setManagerId(v);
            const sel = available.find((m) => (m.user?._id || m._id) === v);
            if (sel) {
              onConfirmAdd(v, sel.user?.name || sel.name || "Unknown");
              onClose();
            }
          }}
          placeholder="Select..."
          brandColor={brandColor}
        />
        {available.length === 0 && (
          <p className="text-xs text-gray-500 mt-1">
            All workspace members are already managers
          </p>
        )}
        <button
          onClick={onClose}
          className="w-full mt-4 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Member card ───────────────────────────────────────────────
const MemberCard = ({ user, brandColor, isManager, summary, canRemove, onRemove }) => {
  const name = user?.name || "Unknown";
  const email = user?.email || "";
  return (
    <div className="group bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/40 hover:border-[#0d9488]/60 transition-all p-4 flex flex-col">
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base overflow-hidden shrink-0"
          style={{ backgroundColor: brandColor }}
        >
          {user?.profile ? (
            <img src={user.profile} className="w-full h-full object-cover" alt="" />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate flex items-center gap-1.5">
            {name}
            {isManager && <FaCrown className="text-yellow-500 text-[10px] shrink-0" />}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{email}</p>
        </div>
        {canRemove && (
          <button
            onClick={onRemove}
            title={isManager ? "Remove manager" : "Remove member"}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition lg:opacity-0 lg:group-hover:opacity-100"
          >
            <FaUserMinus className="text-sm" />
          </button>
        )}
      </div>

      {!isManager && summary && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/40">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-gray-500 dark:text-gray-500">Task progress</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {summary.completed}/{summary.total}
            </span>
          </div>
          <div className="w-full h-1 bg-gray-100 dark:bg-gray-800/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width:
                  summary.total > 0 ? `${(summary.completed / summary.total) * 100}%` : "0%",
                backgroundColor: brandColor,
              }}
            />
          </div>
          {summary.open > 0 && (
            <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1.5">
              {summary.open} open
            </p>
          )}
        </div>
      )}

      {isManager && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/40">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/40 px-2 py-0.5 rounded-full">
            <FaCrown className="text-[9px]" /> Manager
          </span>
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  MAIN
// ═════════════════════════════════════════════════════════════════════
const WorkspaceProjectTeam = () => {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((s) => s.auth);

  const { data: wData, isLoading: wLoad } = useGetWorkspaceQuery(workspaceId);
  const { data: pData, isLoading: pLoad, refetch: refetchProject } = useGetProjectByIdQuery(projectId);
  const workspace = wData?.workspace;
  const project = pData?.project;
  const brandColor = workspace?.color || "#0d9488";

  const isOwner = useMemo(() => {
    const oid = workspace?.owner?._id || workspace?.owner;
    return !!oid && oid === userInfo?._id;
  }, [workspace, userInfo]);

  const isManager = useMemo(
    () =>
      !!project?.projectManagers?.some(
        (pm) => (pm._id || pm)?.toString() === userInfo?._id?.toString()
      ),
    [project, userInfo]
  );

  // any positive signal wins — API flag OR owner OR manager
  const canManage = useMemo(
    () => !!project?.canManage || isOwner || isManager,
    [project, isOwner, isManager]
  );

  const { data: teamData } = useGetProjectTeamWithTasksQuery(projectId, {
    skip: !canManage,
  });

  const [removeTeamMember] = useRemoveTeamMemberMutation();
  const [manageProjectManagers] = useManageProjectManagersMutation();

  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false });
  const [addManagerConfirm, setAddManagerConfirm] = useState({
    isOpen: false,
    id: "",
    name: "",
  });

  const activeTeam = useMemo(
    () => (project?.teamMembers || []).filter((m) => m.status === "active"),
    [project]
  );
  const projectManagers = useMemo(() => project?.projectManagers || [], [project]);

  const taskSummaryByUser = useMemo(() => {
    const map = {};
    (teamData?.team || []).forEach((t) => {
      map[t.user._id] = t.taskSummary;
    });
    return map;
  }, [teamData]);

  // ─── Loading / guard ──────────────────────────────────────────
  if (wLoad || pLoad || !workspace || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderTopColor: brandColor }}
        />
      </div>
    );
  }

  // ─── Handlers ─────────────────────────────────────────────────
  const removeMember = (id) => {
    if (!id) return toast.error("Invalid member");
    setConfirmDialog({
      isOpen: true,
      title: "Remove Member",
      danger: true,
      message: "Remove this member from the project?",
      onConfirm: async () => {
        try {
          await removeTeamMember({ projectId, memberId: id }).unwrap();
          toast.success("Removed");
          refetchProject();
        } catch (e) {
          toast.error(e?.data?.message || "Failed");
        }
      },
    });
  };

  const removeManager = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: "Remove Manager",
      danger: true,
      message: "Remove this manager?",
      onConfirm: async () => {
        try {
          await manageProjectManagers({ projectId, action: "remove", managerId: id }).unwrap();
          toast.success("Manager removed");
          refetchProject();
        } catch (e) {
          toast.error(e?.data?.message || "Failed");
        }
      },
    });
  };

  const confirmAddManager = async () => {
    if (!addManagerConfirm.id) return;
    try {
      await manageProjectManagers({
        projectId,
        action: "add",
        managerId: addManagerConfirm.id,
      }).unwrap();
      toast.success("Manager added");
      refetchProject();
    } catch (e) {
      toast.error(e?.data?.message || "Failed");
    }
  };

  const goToTasks = () => navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/project/${projectId}`);
  const goToProjects = () => navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/projects`);

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      <div className="hidden md:block md:min-h-screen fixed top-0 left-0 z-20 workspace-shell-sidebar">
        <WorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden md:ml-[260px] workspace-shell-main">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 shrink-0">
          <div className="flex items-center justify-between px-3 md:px-4 h-14 lg:h-16">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={goToProjects}
                className="p-1 lg:hidden text-gray-500 dark:text-gray-400"
              >
                <FaArrowLeft className="text-sm" />
              </button>
              {project.coverImage ? (
                <img
                  src={project.coverImage}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-xl object-cover"
                  alt=""
                />
              ) : (
                <div
                  className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  <FaFolder />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[140px] md:max-w-xs">
                  {project.name}
                </h1>
                <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                  <span>{activeTeam.length} members</span>
                  <span className="w-0.5 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
                  <span>{projectManagers.length} managers</span>
                </div>
              </div>
            </div>
            {canManage && (
              <button
                onClick={() => setShowAddMember(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-white rounded-lg text-xs font-medium hover:opacity-90 transition"
                style={{ backgroundColor: brandColor }}
              >
                <FaUserPlus className="text-xs" /> Add member
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-3 md:px-4 border-t border-gray-200/60 dark:border-gray-800/30 py-1 overflow-x-auto scrollbar-hide">
            <button
              onClick={goToTasks}
              className="flex-shrink-0 text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition px-3 py-1.5 rounded-xl whitespace-nowrap"
            >
              Tasks
            </button>
            <button className="flex-shrink-0 text-xs md:text-sm font-medium bg-[#0d9488]/10 text-[#0d9488] px-3 py-1.5 rounded-xl whitespace-nowrap">
              Team ({activeTeam.length})
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 pb-24 lg:pb-8">
          {/* Managers */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <FaCrown className="text-yellow-500" /> Managers
                <span className="text-xs font-normal text-gray-500 dark:text-gray-500">
                  ({projectManagers.length})
                </span>
              </h2>
              {canManage && (
                <button
                  onClick={() => setShowAddManager(true)}
                  className="text-xs text-[#0d9488] hover:text-[#14b8a6] transition font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-[#0d9488]/10"
                >
                  <FaUserPlus className="text-[10px]" /> Add manager
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {projectManagers.map((m) => (
                <MemberCard
                  key={m._id}
                  user={m}
                  brandColor={brandColor}
                  isManager
                  canRemove={canManage && projectManagers.length > 1}
                  onRemove={() => removeManager(m._id)}
                />
              ))}
              {projectManagers.length === 0 && (
                <div className="col-span-full text-center py-8 bg-white dark:bg-[#14141a] rounded-2xl border border-dashed border-gray-300 dark:border-gray-800/60">
                  <FaCrown className="text-2xl mx-auto text-gray-300 dark:text-gray-700 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-500">No managers yet</p>
                </div>
              )}
            </div>
          </section>

          {/* Team Members */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <FaUsers className="text-[#0d9488]" /> Team members
                <span className="text-xs font-normal text-gray-500 dark:text-gray-500">
                  ({activeTeam.length})
                </span>
              </h2>
              {canManage && (
                <button
                  onClick={() => setShowAddMember(true)}
                  className="text-xs text-[#0d9488] hover:text-[#14b8a6] transition font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-[#0d9488]/10"
                >
                  <FaUserPlus className="text-[10px]" /> Add member
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {activeTeam.map((m) => {
                const user = m.user || m;
                const memberId = user._id;
                const summary = taskSummaryByUser[memberId];
                return (
                  <MemberCard
                    key={memberId}
                    user={user}
                    brandColor={brandColor}
                    summary={summary}
                    canRemove={canManage}
                    onRemove={() => removeMember(memberId)}
                  />
                );
              })}
              {activeTeam.length === 0 && (
                <div className="col-span-full text-center py-10 bg-white dark:bg-[#14141a] rounded-2xl border border-dashed border-gray-300 dark:border-gray-800/60">
                  <FaUsers className="text-2xl mx-auto text-gray-300 dark:text-gray-700 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-500">No team members yet</p>
                  {canManage && (
                    <button
                      onClick={() => setShowAddMember(true)}
                      className="text-xs text-[#0d9488] font-medium mt-2"
                    >
                      Add your first member
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <WorkspaceBottombar workspace={workspace} />

      <AddMemberModal
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        workspace={workspace}
        project={project}
        brandColor={brandColor}
        onSuccess={refetchProject}
      />
      <AddManagerModal
        isOpen={showAddManager}
        onClose={() => setShowAddManager(false)}
        workspace={workspace}
        project={project}
        brandColor={brandColor}
        onConfirmAdd={(id, name) => setAddManagerConfirm({ isOpen: true, id, name })}
      />
      <ConfirmModal
        isOpen={addManagerConfirm.isOpen}
        onClose={() => setAddManagerConfirm({ isOpen: false, id: "", name: "" })}
        onConfirm={confirmAddManager}
        title="Add Manager"
        message={`Add ${addManagerConfirm.name} as manager?`}
      />
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
      />
    </div>
  );
};

export default WorkspaceProjectTeam;
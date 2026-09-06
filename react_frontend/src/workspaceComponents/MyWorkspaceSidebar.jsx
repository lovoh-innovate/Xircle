// src/components/MyWorkspaceSidebar.jsx
import React, { useState, useMemo } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  FiHome,
  FiFolder,
  FiCheckSquare,
  FiMail,
  FiUser,
  FiUsers,
  FiSettings,
  FiClock,
  FiChevronDown,
  FiChevronRight,
  FiChevronLeft,
  FiSun,
  FiMoon,
  FiMonitor,
} from 'react-icons/fi';
import { FaSpinner } from 'react-icons/fa';
import { useGetUserChatsQuery } from '../slices/messagingApiSlice';
import { useGetWorkspaceProjectsQuery } from '../slices/projectApiSlice';
import { useGetProjectTasksQuery } from '../slices/taskApiSlice';
import { useTheme } from '../contexts/ThemeContext';
import useWorkspacePresence from '../services/useWorkspacePresence';

// ─── Custom WhatsApp‑style Chat Icon ──────────────────────────────
const ChatIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ width: '1.2rem', height: '1.2rem' }}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M8 10h8" />
    <path d="M8 14h6" />
  </svg>
);

// ─── FORCE DEDUPLICATION HELPER ─────────────────────────────────────
const forceUniqueById = (arr, getId = (item) => item?._id) => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    if (!item) continue;
    const id = getId(item);
    if (!id || seen.has(String(id))) continue;
    seen.add(String(id));
    out.push(item);
  }
  return out;
};

const MyWorkspaceSidebar = ({ workspace, chats: propChats }) => {
  const { workspaceId } = useParams();
  const location = useLocation();
  const { userInfo } = useSelector((state) => state.auth);
  const { theme, toggleTheme, isDarkMode } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const onlineUserIds = useWorkspacePresence(workspaceId);
  const onlineCount = onlineUserIds.size;

  const { data: chatsData, isLoading: chatsLoading } = useGetUserChatsQuery(workspaceId, {
    skip: !!propChats,
  });
  const chats = propChats || chatsData?.chats || [];

  const { data: projectsData, isLoading: projectsLoading } = useGetWorkspaceProjectsQuery({
    workspaceId,
  });
  const projects = projectsData?.projects || [];

  const [expandedSections, setExpandedSections] = useState({
    projects: true,
    channels: true,
    dms: true,
    admin: true,
  });

  const brandColor = workspace?.color || '#0d9488';

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  };

  // ─── Navigation ──────────────────────────────────────────────────
  const navOptions = [
    { id: 'home', label: 'Dashboard', icon: FiHome, path: `/my-workspace/${workspaceId}` },
    { id: 'projects', label: 'Projects', icon: FiFolder, path: `/my-workspace/${workspaceId}/projects` },
    { id: 'all-tasks', label: 'All Tasks', icon: FiCheckSquare, path: `/my-workspace/${workspaceId}/tasks` },
    { id: 'channels', label: 'Channels', icon: ChatIcon, path: `/my-workspace/${workspaceId}/channels` },
    { id: 'dms', label: 'Direct Messages', icon: FiMail, path: `/my-workspace/${workspaceId}/dms` },
    { id: 'members', label: 'Members', icon: FiUsers, path: `/my-workspace/${workspaceId}/members` },
    { id: 'clockin', label: 'Clock‑in', icon: FiClock, path: `/my-workspace/${workspaceId}/clockin` },
  ];

  const adminOptions = [
    { id: 'settings', label: 'Settings', icon: FiSettings, path: `/my-workspace/${workspaceId}/settings` },
  ];

  const members = workspace?.members || [];

  const channels = chats.filter((chat) => chat.type === 'group') || [];

  const myId = String(userInfo?._id);
  const rawDirectMessages = chats.filter((chat) => chat.type === 'direct') || [];
  const directMessages = useMemo(() => {
    const uniqueById = forceUniqueById(rawDirectMessages, (c) => c?._id);
    const byParticipant = new Map();

    for (const chat of uniqueById) {
      const other = chat.participants?.find(
        (p) => String(p.user?._id || p.user) !== myId
      );
      const participantId = String(other?.user?._id || other?.user);
      if (!participantId || participantId === 'undefined') continue;

      const existing = byParticipant.get(participantId);
      if (!existing || new Date(chat.updatedAt) > new Date(existing.updatedAt)) {
        byParticipant.set(participantId, chat);
      }
    }
    return Array.from(byParticipant.values());
  }, [rawDirectMessages, myId]);

  const isActive = (path) => {
    if (path === `/my-workspace/${workspaceId}`) {
      return location.pathname === path;
    }
    return location.pathname.includes(path.split('/').pop());
  };

  const getDMParticipant = (chat) => {
    const other = chat.participants.find(
      (p) => String(p.user?._id || p.user) !== myId
    );
    return other?.user || other;
  };

  const getDMUnread = (chat) => chat.unreadCount || 0;

  const userMembership = members.find(
    (m) => String(m.user?._id || m.user) === myId
  );
  const userRole = userMembership?.role || 'Member';

  // ─── Project Item ──────────────────────────────────────────────
  const ProjectItem = ({ project }) => {
    const progress = project.progress || 0;
    const statusColor =
      {
        planning: 'text-blue-400',
        'in-progress': 'text-yellow-400',
        completed: 'text-green-400',
        archived: 'text-gray-400',
      }[project.status] || 'text-gray-400';

    const { data: taskData, isLoading: taskLoading } = useGetProjectTasksQuery(
      { projectId: project._id }
    );
    const tasks = taskData?.tasks || [];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (t) => t.status === 'completed' || t.status === 'confirmed_completed'
    ).length;

    return (
      <Link
        to={`/my-workspace/${workspaceId}/project/${project._id}`}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
      >
        <FiFolder className="text-xs text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="truncate text-sm text-gray-700 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200">
              {project.name}
            </span>
            <span className={`text-[10px] font-medium ${statusColor}`}>
              {progress}%
            </span>
          </div>
          <div className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full mt-0.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: brandColor }}
            />
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-500 mt-0.5">
            {taskLoading ? (
              <span className="flex items-center gap-1">
                <FaSpinner className="animate-spin text-[8px]" />
                Loading tasks...
              </span>
            ) : (
              <>
                <span className="flex items-center gap-0.5">
                  <FiCheckSquare className="text-[8px]" />
                  {totalTasks} tasks
                </span>
                <span>·</span>
                <span className="text-green-500 dark:text-green-400">{completedTasks} done</span>
              </>
            )}
          </div>
        </div>
      </Link>
    );
  };

  // ─── Theme Toggle Icon ──────────────────────────────────────
  const ThemeToggleIcon = () => {
    const getIcon = () => {
      if (theme === 'light') return <FiSun className="text-yellow-500" />;
      if (theme === 'dark') return <FiMoon className="text-purple-400" />;
      return <FiMonitor className="text-blue-400" />;
    };
    return (
      <button
        onClick={toggleTheme}
        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        title={`Switch theme (current: ${theme})`}
      >
        {getIcon()}
      </button>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div
      className={`sticky top-0 h-screen bg-white dark:bg-[#18181b] border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* ── Header ── */}
      <div
        className={`flex items-center border-b border-gray-200 dark:border-gray-800 min-h-[56px] flex-shrink-0 ${
          isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'
        }`}
      >
        {workspace?.logo ? (
          <img
            src={workspace.logo}
            alt={workspace.name}
            className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: brandColor }}
          >
            {workspace?.initials || getInitials(workspace?.name)}
          </div>
        )}

        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 dark:text-gray-100 truncate text-sm">
              {workspace?.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
              {members.length} members · {onlineCount} online
            </p>
          </div>
        )}
      </div>

      {/* ─── Navigation ── */}
      <div
        className={`py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 ${
          isCollapsed ? 'px-2' : 'px-3'
        }`}
      >
        {navOptions.map((opt) => {
          const Icon = opt.icon;
          const active = isActive(opt.path);
          return (
            <Link
              key={opt.id}
              to={opt.path}
              title={isCollapsed ? opt.label : undefined}
              className={`flex items-center rounded-lg transition-all text-sm ${
                isCollapsed
                  ? 'justify-center p-2.5 mb-1'
                  : 'gap-3 px-3 py-1.5 mb-0.5'
              } ${
                active
                  ? 'text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
              style={active ? { backgroundColor: brandColor } : {}}
            >
              <Icon
                className={`${active ? 'text-white' : ''} ${
                  isCollapsed ? 'text-lg' : ''
                }`}
              />
              {!isCollapsed && <span className="font-medium">{opt.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* ─── Scrollable Content ─── */}
      {isCollapsed ? (
        <div className="flex-1 overflow-y-auto scrollbar-hide py-3 px-2 flex flex-col items-center gap-3">
          <Link
            to={`/my-workspace/${workspaceId}/projects`}
            title="Projects"
            className="relative p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <FiFolder className="text-lg" />
            {projects.some((p) => p.progress < 100) && (
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ backgroundColor: brandColor }}
              />
            )}
          </Link>

          <Link
            to={`/my-workspace/${workspaceId}/tasks`}
            title="All Tasks"
            className="relative p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <FiCheckSquare className="text-lg" />
          </Link>

          <Link
            to={`/my-workspace/${workspaceId}/channels`}
            title="Channels"
            className="relative p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <ChatIcon className="text-lg" />
            {channels.some((c) => c.unreadCount > 0) && (
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ backgroundColor: brandColor }}
              />
            )}
          </Link>

          <Link
            to={`/my-workspace/${workspaceId}/dms`}
            title="Direct Messages"
            className="relative p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <FiMail className="text-lg" />
            {directMessages.some((c) => c.unreadCount > 0) && (
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ backgroundColor: brandColor }}
              />
            )}
          </Link>

          <Link
            to={`/my-workspace/${workspaceId}/clockin`}
            title="Clock‑in"
            className="relative p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <FiClock className="text-lg" />
          </Link>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-2">
          {/* Projects Section */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800/50">
            <button
              onClick={() => toggleSection('projects')}
              className="flex items-center gap-2 px-2 py-1 w-full hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider"
            >
              {expandedSections.projects ? (
                <FiChevronDown className="text-[10px]" />
              ) : (
                <FiChevronRight className="text-[10px]" />
              )}
              <span>Projects</span>
              <span className="ml-auto text-xs text-gray-400 dark:text-gray-600">
                {projects.length}
              </span>
            </button>
            {expandedSections.projects && (
              <div className="mt-1 space-y-0.5">
                <Link
                  to={`/my-workspace/${workspaceId}/tasks`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group text-sm text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                >
                  <FiCheckSquare className="text-xs text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                  <span className="font-medium">All Tasks</span>
                </Link>

                {projectsLoading ? (
                  <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-500">
                    Loading projects...
                  </div>
                ) : projects.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-600">
                    No projects yet
                  </div>
                ) : (
                  projects.slice(0, 6).map((project) => (
                    <ProjectItem key={project._id} project={project} />
                  ))
                )}
                {projects.length > 6 && (
                  <Link
                    to={`/my-workspace/${workspaceId}/projects`}
                    className="block px-3 py-1 text-xs text-gray-500 dark:text-gray-600 hover:text-gray-800 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  >
                    +{projects.length - 6} more
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Channels */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800/50">
            <button
              onClick={() => toggleSection('channels')}
              className="flex items-center gap-2 px-2 py-1 w-full hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider"
            >
              {expandedSections.channels ? (
                <FiChevronDown className="text-[10px]" />
              ) : (
                <FiChevronRight className="text-[10px]" />
              )}
              <span>Channels</span>
              <span className="ml-auto text-xs text-gray-400 dark:text-gray-600">
                {channels.length}
              </span>
            </button>
            {expandedSections.channels && (
              <div className="mt-1 space-y-0.5">
                {chatsLoading ? (
                  <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-500">
                    Loading channels...
                  </div>
                ) : channels.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-600">No channels yet</p>
                ) : (
                  channels.slice(0, 6).map((chat) => (
                    <Link
                      key={chat._id}
                      to={`/my-workspace/${workspaceId}/chat/${chat._id}`}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChatIcon className="text-gray-400 dark:text-gray-500 text-xs" />
                        <span className="truncate text-gray-700 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200">
                          {chat.name || 'Unnamed'}
                        </span>
                      </div>
                      {chat.unreadCount > 0 && (
                        <span
                          className="text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center font-medium"
                          style={{ backgroundColor: brandColor }}
                        >
                          {chat.unreadCount}
                        </span>
                      )}
                    </Link>
                  ))
                )}
                {channels.length > 6 && (
                  <Link
                    to={`/my-workspace/${workspaceId}/channels`}
                    className="block px-3 py-1 text-xs text-gray-500 dark:text-gray-600 hover:text-gray-800 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  >
                    +{channels.length - 6} more
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Direct Messages */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800/50">
            <button
              onClick={() => toggleSection('dms')}
              className="flex items-center gap-2 px-2 py-1 w-full hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider"
            >
              {expandedSections.dms ? (
                <FiChevronDown className="text-[10px]" />
              ) : (
                <FiChevronRight className="text-[10px]" />
              )}
              <span>Direct Messages</span>
              <span className="ml-auto text-xs text-gray-400 dark:text-gray-600">
                {directMessages.length}
              </span>
            </button>
            {expandedSections.dms && (
              <div className="mt-1 space-y-0.5">
                {chatsLoading ? (
                  <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-500">
                    Loading DMs...
                  </div>
                ) : directMessages.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-600">No DMs</p>
                ) : (
                  directMessages.slice(0, 6).map((chat) => {
                    const participant = getDMParticipant(chat);
                    const unread = getDMUnread(chat);
                    const isOnline = onlineUserIds.has(participant?._id);
                    return (
                      <Link
                        key={chat._id}
                        to={`/my-workspace/${workspaceId}/chat/${chat._id}`}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative flex-shrink-0">
                            {participant?.profile ? (
                              <img
                                src={participant.profile}
                                alt={participant.name}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: brandColor }}
                              >
                                {getInitials(participant?.name)}
                              </div>
                            )}
                            {isOnline && (
                              <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-[#18181b]" />
                            )}
                          </div>
                          <span className="truncate text-gray-700 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 text-sm">
                            {participant?.name || 'Unknown'}
                          </span>
                        </div>
                        {unread > 0 && (
                          <span
                            className="text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center font-medium"
                            style={{ backgroundColor: brandColor }}
                          >
                            {unread}
                          </span>
                        )}
                      </Link>
                    );
                  })
                )}
                {directMessages.length > 6 && (
                  <Link
                    to={`/my-workspace/${workspaceId}/dms`}
                    className="block px-3 py-1 text-xs text-gray-500 dark:text-gray-600 hover:text-gray-800 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  >
                    +{directMessages.length - 6} more
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Admin Section */}
          <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800/50">
            <button
              onClick={() => toggleSection('admin')}
              className="flex items-center gap-2 px-2 py-1 w-full hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider"
            >
              {expandedSections.admin ? (
                <FiChevronDown className="text-[10px]" />
              ) : (
                <FiChevronRight className="text-[10px]" />
              )}
              <span>Admin</span>
            </button>
            {expandedSections.admin && (
              <div className="mt-1 space-y-0.5">
                {adminOptions.map((opt) => {
                  const Icon = opt.icon;
                  const active = isActive(opt.path);
                  return (
                    <Link
                      key={opt.id}
                      to={opt.path}
                      className={`flex items-center gap-3 px-3 py-1.5 rounded-lg transition text-sm ${
                        active
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      <Icon className="text-sm" />
                      <span>{opt.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Collapse Toggle ── */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 p-2 flex justify-center">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <FiChevronRight className="text-xs" />
          ) : (
            <FiChevronLeft className="text-xs" />
          )}
        </button>
      </div>

      {/* ── User Footer (profile + theme icon side‑by‑side) ── */}
      <div
        className={`border-t border-gray-200 dark:border-gray-800 flex-shrink-0 bg-white dark:bg-[#18181b] ${
          isCollapsed ? 'p-2 flex flex-col items-center gap-2' : 'p-3'
        }`}
      >
        {isCollapsed ? (
          <>
            <Link to="/profile" className="relative">
              {userInfo?.profile ? (
                <img
                  src={userInfo.profile}
                  alt={userInfo.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: brandColor }}
                >
                  {getInitials(userInfo?.name)}
                </div>
              )}
            </Link>
            <ThemeToggleIcon />
          </>
        ) : (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
            <Link to="/profile" className="flex items-center gap-3 flex-1 min-w-0">
              {userInfo?.profile ? (
                <img
                  src={userInfo.profile}
                  alt={userInfo.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: brandColor }}
                >
                  {getInitials(userInfo?.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                  {userInfo?.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{userRole}</p>
              </div>
            </Link>
            <ThemeToggleIcon />
          </div>
        )}
      </div>
    </div>
  );
};

export default MyWorkspaceSidebar;
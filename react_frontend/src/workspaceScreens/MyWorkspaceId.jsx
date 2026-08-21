// src/workspaceScreens/MyWorkspaceId.jsx
import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetWorkspaceProjectsQuery } from '../slices/projectApiSlice';
import { useGetUserChatsQuery } from '../slices/messagingApiSlice';
import { useGetProjectTasksQuery } from '../slices/taskApiSlice';
import { useWorkspacePresence } from '../services/useWorkspacePresence';
import {
  useGetClockInSettingsQuery,
  useClockInMutation,
  useClockOutMutation,
  useGetUserClockInHistoryQuery,
} from '../slices/clockInApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
import {
  FaUsers,
  FaHashtag,
  FaFolder,
  FaCircle,
  FaEye,
  FaEyeSlash,
  FaChartLine,
  FaUserPlus,
  FaCopy,
  FaTasks,
  FaCheckCircle,
  FaSpinner,
  FaCog,
  FaArrowLeft,
  FaClock,
  FaCheck,
  FaTimes,
} from 'react-icons/fa';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { toast } from 'react-hot-toast';

// ─── Helper: fetch task count for a single project ──
const TaskCounter = memo(({ projectId, onCount, onLoading }) => {
  const { data, isLoading } = useGetProjectTasksQuery({ projectId });
  const mounted = useRef(true);
  const lastCount = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (data && mounted.current) {
      const count = data.tasks.length;
      if (count !== lastCount.current) {
        lastCount.current = count;
        onCount(projectId, count);
      }
    }
    if (isLoading !== undefined && mounted.current) {
      onLoading(projectId, isLoading);
    }
  }, [data, isLoading, projectId, onCount, onLoading]);

  return null;
});

// ─── helper: pull a user id off either a populated user object or a raw id ──
const getMemberId = (member) => (member?.user?._id || member?.user)?.toString();

// ─── Clock‑in / out widget ──────────────────────────────────────────
const ClockInWidget = ({ workspaceId, brandColor }) => {
  const { data: settingsData, isLoading: settingsLoading } =
    useGetClockInSettingsQuery(workspaceId);
  const { data: historyData, refetch: refetchHistory } =
    useGetUserClockInHistoryQuery(
      { workspaceId, page: 1, limit: 1 },
      { skip: !settingsData?.settings?.clockInEnabled }
    );
  const [clockIn, { isLoading: isClockInLoading }] = useClockInMutation();
  const [clockOut, { isLoading: isClockOutLoading }] = useClockOutMutation();

  const isEnabled = settingsData?.settings?.clockInEnabled || false;
  const today = new Date().toISOString().split('T')[0];
  const latest = historyData?.history?.[0];
  const isClockedIn =
    latest &&
    new Date(latest.clockInTime).toISOString().split('T')[0] === today &&
    !latest.clockOutTime;
  const clockInTime = isClockedIn
    ? new Date(latest.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleClockIn = async () => {
    try {
      await clockIn(workspaceId).unwrap();
      toast.success('Clocked in successfully!');
      refetchHistory();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to clock in.');
    }
  };

  const handleClockOut = async () => {
    try {
      await clockOut(workspaceId).unwrap();
      toast.success('Clocked out successfully!');
      refetchHistory();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to clock out.');
    }
  };

  if (!isEnabled) return null;
  if (settingsLoading) return <FaSpinner className="animate-spin text-teal-500 text-sm" />;

  return (
    <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#14141a] px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-800/60 text-xs">
      <FaClock className="text-teal-600 dark:text-[#0d9488]" />
      {isClockedIn ? (
        <>
          <span className="text-gray-700 dark:text-gray-300">
            In at <span className="font-mono">{clockInTime}</span>
          </span>
          <button
            onClick={handleClockOut}
            disabled={isClockOutLoading}
            className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded-full hover:bg-red-500/20 transition disabled:opacity-50"
          >
            {isClockOutLoading ? <FaSpinner className="animate-spin text-xs" /> : <FaTimes className="text-[10px]" />}
            <span className="hidden sm:inline">Out</span>
          </button>
        </>
      ) : (
        <button
          onClick={handleClockIn}
          disabled={isClockInLoading}
          className="flex items-center gap-1 px-2 py-0.5 bg-teal-500/10 text-teal-600 dark:text-[#0d9488] rounded-full hover:bg-teal-500/20 transition disabled:opacity-50"
          style={{ color: brandColor }}
        >
          {isClockInLoading ? <FaSpinner className="animate-spin text-xs" /> : <FaCheck className="text-[10px]" />}
          <span className="hidden sm:inline">Clock In</span>
        </button>
      )}
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────
const MyWorkspaceId = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [hideStats, setHideStats] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const { data, isLoading, error } = useGetWorkspaceQuery(workspaceId);
  const { data: projectsData, isLoading: projectsLoading } = useGetWorkspaceProjectsQuery({ workspaceId });
  const { data: chatsData } = useGetUserChatsQuery(workspaceId);

  // ── real-time online presence for this workspace, driven by sockets ──
  const onlineUserIds = useWorkspacePresence(workspaceId);

  // ── Aggregated task counts ──────────────────────────────────
  const [totalTasks, setTotalTasks] = useState(0);
  const [taskCounts, setTaskCounts] = useState({});
  const [loadingTasks, setLoadingTasks] = useState({});

  const handleTaskCount = useCallback((projectId, count) => {
    setTaskCounts(prev => {
      if (prev[projectId] === count) return prev;
      return { ...prev, [projectId]: count };
    });
  }, []);

  const handleTaskLoading = useCallback((projectId, loading) => {
    setLoadingTasks(prev => {
      if (prev[projectId] === loading) return prev;
      return { ...prev, [projectId]: loading };
    });
  }, []);

  useEffect(() => {
    const sum = Object.values(taskCounts).reduce((a, b) => a + b, 0);
    setTotalTasks(sum);
  }, [taskCounts]);

  const isTasksLoading = projectsData?.projects?.some(p => loadingTasks[p._id] !== false) ?? false;

  useEffect(() => {
    if (error) navigate('/my-workspaces');
  }, [error, navigate]);

  const copyInviteCode = () => {
    if (workspace?.inviteCode) {
      navigator.clipboard.writeText(workspace.inviteCode);
      setCopySuccess(true);
      toast.success('Invite code copied!');
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="text-center">
          <div
            className="w-8 h-8 border-[3px] border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: '#0d9488', borderTopColor: 'transparent' }}
          />
          <p className="mt-3 text-gray-500 dark:text-gray-500 text-sm">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const workspace = data?.workspace;
  const chats = chatsData?.chats || [];
  const projects = projectsData?.projects || [];
  if (!workspace) return null;

  // ── membership status ("active" member) vs. real-time online status ──
  const activeMembers = workspace.members?.filter((m) => m.status === 'active') || [];
  const isMemberOnline = (member) => onlineUserIds.has(getMemberId(member));
  const onlineCount = activeMembers.filter(isMemberOnline).length;
  const onlineMembers = activeMembers.filter(isMemberOnline);

  const channelCount = chats.filter((c) => c.type === 'group').length || 0;
  const brandColor = workspace.color || '#0d9488';

  const avgProgress = projects.length > 0 
    ? Math.round(projects.reduce((sum, p) => sum + (p.progress || 0), 0) / projects.length) 
    : 0;

  // ─── Chart data ──────────────────────────────────────────────
  const chartProjects = [...projects]
    .sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      return 0;
    })
    .slice(0, 10)
    .map((p) => ({
      name: p.name.length > 10 ? p.name.slice(0, 10) + '…' : p.name,
      progress: p.progress || 0,
    }));

  // ─── Metric Card ─────────────────────────────────────────────
  const MetricCard = ({ icon: Icon, label, value, to, badge, badgeColor }) => (
    <Link
      to={to}
      className="group relative bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-4 flex flex-col items-start gap-1 hover:border-teal-500 dark:hover:border-transparent hover:shadow-[0_0_20px_rgba(13,148,136,0.2)] dark:hover:shadow-[0_0_20px_rgba(13,148,136,0.2)] active:scale-[0.97] transition-all duration-300 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/0 via-teal-500/0 to-transparent dark:group-hover:from-[#0d9488]/10 dark:group-hover:via-[#0d9488]/5 group-hover:from-teal-500/10 group-hover:via-teal-500/5 transition-all duration-500" />
      {badge && (
        <span
          className={`absolute -top-1 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full text-white ${badgeColor} shadow-[0_0_10px_rgba(34,197,94,0.4)]`}
        >
          {badge}
        </span>
      )}
      <div className="flex items-center justify-between w-full">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-50 dark:bg-[#0d9488]/10 text-teal-600 dark:text-[#0d9488] group-hover:scale-110 transition-transform"
          style={{ color: brandColor, backgroundColor: `${brandColor}15` }}
        >
          <Icon className="text-sm" />
        </div>
        <span className="text-xs font-mono text-gray-400 dark:text-gray-600 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition">
          {hideStats ? '••••' : '→'}
        </span>
      </div>
      <p className="text-lg font-bold text-gray-800 dark:text-gray-100 tracking-tight mt-1">
        {hideStats ? '••••' : value}
      </p>
      <p className="text-[11px] text-gray-500 dark:text-gray-500 uppercase tracking-wider">{label}</p>
    </Link>
  );

  // ─── Quick Action ─────────────────────────────────────────────
  const QuickAction = ({ icon: Icon, label, to, onClick }) => {
    const content = (
      <div className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-white dark:bg-[#14141a] border border-gray-200/60 dark:border-gray-800/60 hover:border-teal-500 dark:hover:border-[#0d9488]/40 hover:shadow-[0_0_15px_rgba(13,148,136,0.15)] dark:hover:shadow-[0_0_15px_rgba(13,148,136,0.15)] active:scale-[0.96] active:bg-teal-50 dark:active:bg-[#0d9488]/10 transition-all duration-300 group">
        <div className="text-gray-400 dark:text-gray-400 group-hover:text-teal-600 dark:group-hover:text-[#0d9488] transition-colors text-lg">
          <Icon />
        </div>
        <span className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider group-hover:text-gray-700 dark:group-hover:text-gray-300 transition">
          {label}
        </span>
      </div>
    );
    if (to) return <Link to={to}>{content}</Link>;
    return <button onClick={onClick} className="w-full">{content}</button>;
  };

  // ─── Hero Card ─────────────────────────────────────────────────
  const HeroCard = () => (
    <div className="relative bg-white dark:bg-[#14141a] border border-gray-200/60 dark:border-gray-800/60 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {workspace.logo ? (
            <img
              src={workspace.logo}
              alt={workspace.name}
              className="w-12 h-12 rounded-xl object-cover border border-gray-200 dark:border-gray-700/60 shadow-[0_0_15px_rgba(13,148,136,0.15)] flex-shrink-0"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg border border-gray-200 dark:border-gray-700/60 shadow-[0_0_15px_rgba(13,148,136,0.15)] flex-shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {workspace.initials || workspace.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <Link
              to="/my-workspaces"
              className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-widest hover:text-teal-600 dark:hover:text-[#0d9488] active:text-teal-700 dark:active:text-[#14b8a6] transition-colors inline-block"
            >
              Workspace
            </Link>
            <h1 className="text-lg font-bold leading-tight truncate text-gray-800 dark:text-gray-100">
              {workspace.name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Clock‑in widget on mobile hero card */}
          <ClockInWidget workspaceId={workspaceId} brandColor={brandColor} />
          <Link
            to={`/my-workspace/${workspaceId}/settings`}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#0b0b10] border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 active:scale-90 active:bg-gray-200 dark:active:bg-gray-800 transition flex-shrink-0"
            aria-label="Workspace settings"
          >
            <FaCog className="text-sm" />
          </Link>
        </div>
      </div>

      <div className="flex items-end justify-between mb-4">
        <div>
          <button
            onClick={() => setHideStats((v) => !v)}
            className="flex items-center gap-2 text-gray-500 dark:text-gray-500 text-xs mb-1.5 hover:text-gray-700 dark:hover:text-gray-300 active:text-gray-800 dark:active:text-gray-200 transition-colors"
          >
            <FaUsers className="text-[10px]" />
            Active members
            {hideStats ? <FaEyeSlash className="text-[11px]" /> : <FaEye className="text-[11px]" />}
          </button>
          <p className="text-3xl font-bold tracking-tight text-gray-800 dark:text-gray-100">
            {hideStats ? '••••' : activeMembers.length}
          </p>
        </div>
        <button
          onClick={copyInviteCode}
          className="flex items-center gap-1.5 bg-teal-600 dark:bg-[#0d9488] text-white px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold hover:bg-teal-700 dark:hover:bg-[#0f9e96] active:scale-95 active:bg-teal-800 dark:active:bg-[#0c857e] transition flex-shrink-0"
        >
          {copySuccess ? <FaCheckCircle className="text-xs" /> : <FaUserPlus className="text-xs" />}
          {copySuccess ? 'Copied' : 'Invite'}
        </button>
      </div>

      <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800/30 rounded-xl px-4 py-2.5 border border-gray-200 dark:border-gray-800/40">
        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <FaCircle className="text-[6px] text-green-500 dark:text-green-400" />
          {onlineCount} online now
        </span>
        <span className="text-xs font-mono tracking-wider text-gray-800 dark:text-gray-300">
          {hideStats ? '••••••••' : workspace.inviteCode || '—'}
        </span>
      </div>
    </div>
  );

  // ─── Project Item (uses aggregated counts) ────────────────────
  const ProjectItem = ({ project, taskCount, taskLoading }) => {
    const progress = project.progress || 0;
    const statusColor = {
      planning: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/40',
      'in-progress': 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700/40',
      completed: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/40',
      archived: 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/40',
    }[project.status] || 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/40';
    const statusLabel = {
      planning: 'Planning',
      'in-progress': 'In Progress',
      completed: 'Completed',
      archived: 'Archived',
    }[project.status] || 'Planning';

    return (
      <Link
        to={`/my-workspace/${workspaceId}/project/${project._id}`}
        className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-teal-50 dark:hover:bg-[#0d9488]/5 active:bg-teal-100 dark:active:bg-[#0d9488]/10 transition group border-b border-gray-100 dark:border-gray-800/30 last:border-0"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${brandColor}15` }}
        >
          <FaFolder className="text-xs" style={{ color: brandColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-gray-900 dark:group-hover:text-white transition">
              {project.name}
            </p>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-500">
            {taskLoading ? (
              <span className="flex items-center gap-1">
                <FaSpinner className="animate-spin text-[10px] text-teal-600 dark:text-[#0d9488]" />
                Loading tasks...
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1">
                  <FaTasks className="text-[10px]" />
                  {taskCount ?? 0} tasks
                </span>
                <span className="flex-1">
                  <div className="w-full h-1 bg-gray-200 dark:bg-gray-800/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%`, backgroundColor: brandColor }}
                    />
                  </div>
                </span>
                <span className="font-mono text-[10px] text-gray-400 dark:text-gray-400">{progress}%</span>
              </>
            )}
          </div>
        </div>
      </Link>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <div className="hidden md:block md:w-[260px] md:min-h-screen md:flex-shrink-0 fixed top-0 left-0 z-20">
        <MyWorkspaceSidebar workspace={workspace} chats={chats} />
      </div>

      {/* Main content – uses sticky header on mobile */}
      <div className="flex-1 flex flex-col md:ml-[260px] h-screen md:h-auto md:min-h-screen">
        {/* ── Mobile Sticky Header ── */}
        <header className="md:hidden sticky top-0 z-10 bg-white/80 dark:bg-[#0b0b10]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0 h-14 flex items-center px-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                onClick={() => navigate('/my-workspaces')}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white active:scale-90 transition flex-shrink-0"
                aria-label="Back to workspaces"
              >
                <FaArrowLeft className="text-sm" />
              </button>
              <Link
                to="/my-workspaces"
                className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-widest hover:text-teal-600 dark:hover:text-[#0d9488] transition-colors flex-shrink-0"
              >
                Workspace
              </Link>
              <span className="text-gray-300 dark:text-gray-700 flex-shrink-0">/</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate min-w-0">
                {workspace.name}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Clock‑in widget in mobile header */}
              <ClockInWidget workspaceId={workspaceId} brandColor={brandColor} />
              <button
                onClick={() => setHideStats((v) => !v)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#14141a] border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 active:scale-90 active:bg-gray-200 dark:active:bg-gray-800 transition flex-shrink-0"
              >
                {hideStats ? <FaEyeSlash className="text-xs" /> : <FaEye className="text-xs" />}
              </button>
            </div>
          </div>
        </header>

        {/* ── Scrollable Content ── */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 pb-24 md:pb-6 md:mt-0 mt-14">
          {/* TaskCounter aggregators */}
          {projects.map((p) => (
            <TaskCounter
              key={p._id}
              projectId={p._id}
              onCount={handleTaskCount}
              onLoading={handleTaskLoading}
            />
          ))}

          {/* Mobile Hero Card (only visible on mobile) */}
          <div className="md:hidden mb-4">
            <HeroCard />
          </div>

          {/* Desktop Hero Bar (hidden on mobile) */}
          <div className="hidden md:flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {workspace.logo ? (
                <img
                  src={workspace.logo}
                  alt={workspace.name}
                  className="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700/60 shadow-[0_0_15px_rgba(13,148,136,0.15)] flex-shrink-0"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm border border-gray-200 dark:border-gray-700/60 shadow-[0_0_15px_rgba(13,148,136,0.15)] flex-shrink-0"
                  style={{ backgroundColor: brandColor }}
                >
                  {workspace.initials || workspace.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link
                  to="/my-workspaces"
                  className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-widest hover:text-teal-600 dark:hover:text-[#0d9488] transition-colors inline-block"
                >
                  Workspace
                </Link>
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight truncate">
                  {workspace.name}
                </h1>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                  <span className="flex items-center gap-1">
                    <FaCircle className="text-[6px] text-green-500 dark:text-green-400" />
                    {onlineCount} online
                  </span>
                  <span className="w-px h-3 bg-gray-300 dark:bg-gray-700" />
                  <span>
                    {hideStats ? '••••' : `${activeMembers.length} members`}
                  </span>
                  <span className="w-px h-3 bg-gray-300 dark:bg-gray-700" />
                  <button
                    onClick={() => setHideStats((v) => !v)}
                    className="text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 transition"
                  >
                    {hideStats ? <FaEyeSlash className="text-[10px]" /> : <FaEye className="text-[10px]" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Clock‑in widget in desktop hero bar */}
              <ClockInWidget workspaceId={workspaceId} brandColor={brandColor} />
              <span className="text-[10px] font-mono text-gray-500 dark:text-gray-600 bg-gray-100 dark:bg-[#14141a] px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-800/60 flex items-center gap-2">
                {hideStats ? '••••••••' : workspace.inviteCode}
                {!hideStats && (
                  <button
                    onClick={copyInviteCode}
                    className="text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] transition-colors"
                    title="Copy invite code"
                  >
                    <FaCopy className="text-[10px]" />
                  </button>
                )}
                {copySuccess && (
                  <span className="text-[10px] text-green-500 dark:text-green-400 animate-pulse">Copied!</span>
                )}
              </span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="col-span-1">
              <MetricCard
                icon={FaUsers}
                label="Members"
                value={activeMembers.length}
                to={`/my-workspace/${workspaceId}/members`}
              />
            </div>
            <div className="col-span-1">
              <MetricCard
                icon={FaFolder}
                label="Projects"
                value={projects.length}
                to={`/my-workspace/${workspaceId}/projects`}
              />
            </div>
            <div className="hidden md:block">
              <MetricCard
                icon={FaHashtag}
                label="Channels"
                value={channelCount}
                to={`/my-workspace/${workspaceId}/channels`}
              />
            </div>
            <div className="hidden md:block">
              <MetricCard
                icon={FaCircle}
                label="Online Now"
                value={onlineCount}
                to={`/my-workspace/${workspaceId}/members`}
                badge={onlineCount > 0 ? 'LIVE' : null}
                badgeColor="bg-green-500"
              />
            </div>
          </div>

          {/* Chart + Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            <div className="lg:col-span-3 bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-4 sm:p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 dark:bg-[#0d9488]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-widest">Project Progress Trend</p>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                    {isTasksLoading && projects.length > 0 ? (
                      <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <FaSpinner className="animate-spin text-teal-600 dark:text-[#0d9488]" /> Loading tasks…
                      </span>
                    ) : (
                      <>
                        <span>{totalTasks} tasks</span>
                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                          Avg {avgProgress}% complete
                        </span>
                      </>
                    )}
                  </h2>
                </div>
                <Link
                  to={`/my-workspace/${workspaceId}/projects`}
                  className="text-xs font-medium text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] active:text-teal-800 dark:active:text-[#0c857e] transition flex items-center gap-1"
                  style={{ color: brandColor }}
                >
                  <FaChartLine />
                  <span className="hidden sm:inline">Projects</span>
                </Link>
              </div>
              <div className="h-28 sm:h-32 w-full">
                {chartProjects.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartProjects}>
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={brandColor} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={brandColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 9, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                        tickCount={6}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #e5e7eb',
                          fontSize: '11px',
                          backgroundColor: 'var(--bg-tooltip)',
                          color: 'var(--text-tooltip)',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                        }}
                        formatter={(value) => [`${value}%`, 'Progress']}
                      />
                      <Area
                        type="monotone"
                        dataKey="progress"
                        stroke={brandColor}
                        strokeWidth={2}
                        fill="url(#chartGradient)"
                        dot={{ r: 2, fill: brandColor }}
                        activeDot={{ r: 4, stroke: '#fff', strokeWidth: 1 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-500 text-sm">
                    {chartProjects.length === 1 ? 'Add more projects to see trends' : 'No project data'}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-1 gap-2">
              <QuickAction icon={FaFolder} label="Projects" to={`/my-workspace/${workspaceId}/projects`} />
              <QuickAction icon={FaHashtag} label="Channels" to={`/my-workspace/${workspaceId}/channels`} />
              <QuickAction icon={FaUserPlus} label="Invite" onClick={copyInviteCode} />
            </div>
          </div>

          {/* Two‑column feed */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Projects list */}
            <div className="lg:col-span-2 bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 overflow-hidden">
              <div className="px-4 sm:px-5 py-3 flex items-center justify-between border-b border-gray-200/60 dark:border-gray-800/40">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <FaFolder className="text-sm" style={{ color: brandColor }} />
                  Active Projects
                </h2>
                <Link
                  to={`/my-workspace/${workspaceId}/projects`}
                  className="text-[10px] font-medium uppercase tracking-wider hover:underline text-teal-600 dark:text-[#0d9488]"
                  style={{ color: brandColor }}
                >
                  View all
                </Link>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800/30">
                {projectsLoading ? (
                  <div className="px-4 py-8 text-center text-xs text-gray-500 dark:text-gray-500">
                    Loading projects...
                  </div>
                ) : projects.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-gray-500 dark:text-gray-500">
                    No projects yet. Create your first project!
                  </div>
                ) : (
                  projects.slice(0, 5).map((project) => (
                    <ProjectItem
                      key={project._id}
                      project={project}
                      taskCount={taskCounts[project._id]}
                      taskLoading={loadingTasks[project._id]}
                    />
                  ))
                )}
                {projects.length > 5 && (
                  <Link
                    to={`/my-workspace/${workspaceId}/projects`}
                    className="block text-[10px] font-medium uppercase tracking-wider px-4 sm:px-5 py-2.5 hover:bg-teal-50 dark:hover:bg-[#0d9488]/5 active:bg-teal-100 dark:active:bg-[#0d9488]/10 transition border-t border-gray-100 dark:border-gray-800/30 text-center text-teal-600 dark:text-[#0d9488]"
                    style={{ color: brandColor }}
                  >
                    +{projects.length - 5} more projects
                  </Link>
                )}
              </div>
            </div>

            {/* Right: Members online + About */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 overflow-hidden">
                <div className="px-4 sm:px-5 py-3 flex items-center justify-between border-b border-gray-200/60 dark:border-gray-800/40">
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <FaUsers className="text-sm" style={{ color: brandColor }} />
                    Online
                    <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">
                      ({onlineCount})
                    </span>
                  </h2>
                  <Link
                    to={`/my-workspace/${workspaceId}/members`}
                    className="text-[10px] font-medium uppercase tracking-wider hover:underline text-teal-600 dark:text-[#0d9488]"
                    style={{ color: brandColor }}
                  >
                    See all
                  </Link>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800/30">
                  {onlineMembers.length === 0 ? (
                    <p className="px-4 sm:px-5 py-4 text-xs text-gray-500 dark:text-gray-500">
                      No one online right now
                    </p>
                  ) : (
                    onlineMembers.slice(0, 5).map((member) => {
                      const memberUser = member.user || member;
                      const isOwner =
                        memberUser._id === workspace.owner?._id ||
                        memberUser._id === workspace.owner;
                      return (
                        <div
                          key={memberUser._id}
                          className="flex items-center gap-3 px-4 sm:px-5 py-2 hover:bg-teal-50 dark:hover:bg-[#0d9488]/5 transition"
                        >
                          {memberUser?.profile ? (
                            <img
                              src={memberUser.profile}
                              alt={memberUser.name}
                              className="w-7 h-7 rounded-xl object-cover border border-gray-200 dark:border-gray-700/50 flex-shrink-0"
                            />
                          ) : (
                            <div
                              className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                              style={{ backgroundColor: brandColor }}
                            >
                              {memberUser?.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 dark:text-gray-300 truncate flex items-center gap-1">
                              {memberUser?.name || 'Unknown'}
                              {isOwner && (
                                <span className="text-[10px]" title="Owner">
                                  👑
                                </span>
                              )}
                            </p>
                          </div>
                          {/* Real-time online dot, driven by useWorkspacePresence */}
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] flex-shrink-0" />
                        </div>
                      );
                    })
                  )}
                  {onlineMembers.length > 5 && (
                    <Link
                      to={`/my-workspace/${workspaceId}/members`}
                      className="block text-[10px] font-medium uppercase tracking-wider px-4 sm:px-5 py-2.5 hover:bg-teal-50 dark:hover:bg-[#0d9488]/5 active:bg-teal-100 dark:active:bg-[#0d9488]/10 transition border-t border-gray-100 dark:border-gray-800/30 text-center text-teal-600 dark:text-[#0d9488]"
                      style={{ color: brandColor }}
                    >
                      +{onlineMembers.length - 5} more
                    </Link>
                  )}
                </div>
              </div>

              {(workspace.description || workspace.industry || workspace.location || workspace.website) && (
                <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-4">
                  <h2 className="text-[10px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-widest mb-2">
                    About
                  </h2>
                  {workspace.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-3 leading-relaxed">
                      {workspace.description}
                    </p>
                  )}
                  <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {workspace.industry && (
                      <div className="flex items-center gap-2">
                        <span>🏢</span>
                        <span>{workspace.industry}</span>
                      </div>
                    )}
                    {workspace.location && (
                      <div className="flex items-center gap-2">
                        <span>📍</span>
                        <span>{workspace.location}</span>
                      </div>
                    )}
                    {workspace.website && (
                      <a
                        href={workspace.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 hover:underline text-teal-600 dark:text-[#0d9488]"
                        style={{ color: brandColor }}
                      >
                        <span>🌐</span>
                        <span>{workspace.website}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Bottom Bar (mobile only) */}
      <MyWorkspaceBottombar workspace={workspace} />
    </div>
  );
};

export default MyWorkspaceId;
// src/workspaceScreens/MyWorkspaceNotifications.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetUserChatsQuery } from '../slices/messagingApiSlice';
import {
  useGetUserNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
  useClearAllNotificationsMutation,
} from '../slices/notificationApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
import {
  FaArrowLeft,
  FaBell,
  FaCheckDouble,
  FaTrash,
  FaTrashAlt,
  FaHashtag,
  FaComments,
  FaTasks,
  FaFolder,
  FaPhoneAlt,
  FaSpinner,
  FaInbox,
  FaCircle,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';

// ─── Build the destination route for a notification ────────────────
// Uses the notification's OWN workspaceId when present (a notification
// can belong to a workspace other than the one this page was opened
// from), falling back to the current route's workspaceId.
const buildNotificationLink = (data = {}, fallbackWorkspaceId) => {
  const wsId = data.workspaceId || fallbackWorkspaceId;

  if (data.notificationType === 'call' && data.roomId) {
    return `/call/${data.roomId}?autoJoin=true`;
  }

  if (data.chatId && wsId) {
    const isGroup = data.notificationType === 'channel' || data.chatType === 'group';
    return isGroup
      ? `/my-workspace/${wsId}/channels/${data.chatId}`
      : `/my-workspace/${wsId}/chat/${data.chatId}`;
  }

  if (data.projectId && wsId) {
    return `/my-workspace/${wsId}/project/${data.projectId}`;
  }

  if (wsId) {
    return `/my-workspace/${wsId}`;
  }

  return '/my-workspaces';
};

const getNotificationIcon = (data = {}) => {
  if (data.notificationType === 'call') return FaPhoneAlt;
  if (data.notificationType === 'channel' || data.chatType === 'group') return FaHashtag;
  if (data.chatId) return FaComments;
  if (data.taskId) return FaTasks;
  if (data.projectId) return FaFolder;
  return FaBell;
};

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// ─── Single notification row ────────────────────────────────────────
const NotificationItem = ({ notification, brandColor, onClick, onDelete, deleting }) => {
  const Icon = getNotificationIcon(notification.data);
  const unread = !notification.read;

  return (
    <div
      onClick={() => onClick(notification)}
      className={`relative flex items-start gap-3 px-4 sm:px-5 py-3 cursor-pointer transition group border-b border-gray-100 dark:border-gray-800/30 last:border-0 ${
        unread
          ? 'bg-teal-50/50 dark:bg-[#0d9488]/5 hover:bg-teal-50 dark:hover:bg-[#0d9488]/10'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/20'
      }`}
    >
      {unread && (
        <span
          className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: brandColor }}
        />
      )}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
      >
        <Icon className="text-xs" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${unread ? 'font-semibold text-gray-800 dark:text-gray-100' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
          {notification.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 truncate mt-0.5">
          {notification.body}
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1 font-mono">
          {timeAgo(notification.createdAt)}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification._id);
        }}
        disabled={deleting}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-500/10 active:scale-90 transition flex-shrink-0 disabled:opacity-50"
        aria-label="Delete notification"
      >
        {deleting ? <FaSpinner className="animate-spin text-[10px]" /> : <FaTrashAlt className="text-[11px]" />}
      </button>
    </div>
  );
};

const MyWorkspaceNotifications = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();

  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState(null);
  const limit = 20;

  const { data: wsData, isLoading: wsLoading, error: wsError } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData } = useGetUserChatsQuery(workspaceId);

  const { data, isLoading, isFetching } = useGetUserNotificationsQuery({
    page,
    limit,
    unreadOnly: filter === 'unread' ? true : undefined,
  });

  const [markNotificationRead] = useMarkNotificationReadMutation();
  const [markAllNotificationsRead, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();
  const [deleteNotification] = useDeleteNotificationMutation();
  const [clearAllNotifications, { isLoading: clearingAll }] = useClearAllNotificationsMutation();

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    if (wsError) navigate('/my-workspaces');
  }, [wsError, navigate]);

  const workspace = wsData?.workspace;
  const chats = chatsData?.chats || [];
  const brandColor = workspace?.color || '#0d9488';
  const notifications = data?.notifications || [];
  const pagination = data?.pagination;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleItemClick = async (notification) => {
    if (!notification.read) {
      markNotificationRead(notification._id).catch((err) =>
        console.error('Mark read failed:', err?.data?.message || err.message)
      );
    }
    navigate(buildNotificationLink(notification.data, workspaceId));
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead().unwrap();
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to mark all as read');
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteNotification(id).unwrap();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete notification');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Clear all notifications? This cannot be undone.')) return;
    try {
      await clearAllNotifications().unwrap();
      toast.success('All notifications cleared');
      setPage(1);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to clear notifications');
    }
  };

  if (wsLoading) {
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

  if (!workspace) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col md:flex-row">
      <div className="hidden md:block md:w-[260px] md:min-h-screen md:flex-shrink-0 fixed top-0 left-0 z-20">
        <MyWorkspaceSidebar workspace={workspace} chats={chats} />
      </div>

      <div className="flex-1 flex flex-col md:ml-[260px] h-screen md:h-auto md:min-h-screen">
        {/* Mobile sticky header */}
        <header className="md:hidden sticky top-0 z-10 bg-white/80 dark:bg-[#0b0b10]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0 h-14 flex items-center px-4">
          <button
            onClick={() => navigate(`/my-workspace/${workspaceId}`)}
            className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white active:scale-90 transition flex-shrink-0"
            aria-label="Back"
          >
            <FaArrowLeft className="text-sm" />
          </button>
          <span className="ml-2 text-sm font-semibold text-gray-800 dark:text-gray-100">Notifications</span>
          {unreadCount > 0 && (
            <span
              className="ml-2 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: brandColor }}
            >
              {unreadCount}
            </span>
          )}
        </header>

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 pb-24 md:pb-6">
          {/* Desktop header */}
          <div className="hidden md:flex items-center justify-between mb-6">
            <div>
              <Link
                to={`/my-workspace/${workspaceId}`}
                className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-widest hover:text-teal-600 dark:hover:text-[#0d9488] transition-colors inline-block"
              >
                Workspace
              </Link>
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <span
                    className="text-xs font-bold text-white px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: brandColor }}
                  >
                    {unreadCount} new
                  </span>
                )}
              </h1>
            </div>
          </div>

          <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 overflow-hidden">
            {/* Toolbar */}
            <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/60 dark:border-gray-800/40">
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#0b0b10] rounded-full p-1">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    filter === 'all'
                      ? 'bg-white dark:bg-[#14141a] text-gray-800 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-500'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    filter === 'unread'
                      ? 'bg-white dark:bg-[#14141a] text-gray-800 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-500'
                  }`}
                >
                  Unread
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll || notifications.length === 0}
                  className="flex items-center gap-1.5 text-xs font-medium text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  style={{ color: brandColor }}
                >
                  {markingAll ? <FaSpinner className="animate-spin text-[10px]" /> : <FaCheckDouble className="text-[10px]" />}
                  Mark all read
                </button>
                <span className="w-px h-4 bg-gray-200 dark:bg-gray-800" />
                <button
                  onClick={handleClearAll}
                  disabled={clearingAll || notifications.length === 0}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-500 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {clearingAll ? <FaSpinner className="animate-spin text-[10px]" /> : <FaTrash className="text-[10px]" />}
                  Clear all
                </button>
              </div>
            </div>

            {/* List */}
            {isLoading ? (
              <div className="px-4 py-12 text-center">
                <FaSpinner className="animate-spin text-teal-600 dark:text-[#0d9488] text-lg mx-auto mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-500">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <FaInbox className="text-3xl text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  {filter === 'unread' ? "You're all caught up" : 'No notifications yet'}
                </p>
              </div>
            ) : (
              <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                {notifications.map((n) => (
                  <NotificationItem
                    key={n._id}
                    notification={n}
                    brandColor={brandColor}
                    onClick={handleItemClick}
                    onDelete={handleDelete}
                    deleting={deletingId === n._id}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="px-4 sm:px-5 py-3 flex items-center justify-between border-t border-gray-200/60 dark:border-gray-800/40">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:text-gray-800 dark:hover:text-gray-200 transition"
                >
                  <FaChevronLeft className="text-[10px]" /> Prev
                </button>
                <span className="text-[11px] font-mono text-gray-400 dark:text-gray-600">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page >= pagination.pages}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:text-gray-800 dark:hover:text-gray-200 transition"
                >
                  Next <FaChevronRight className="text-[10px]" />
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      <MyWorkspaceBottombar workspace={workspace} />
    </div>
  );
};

export default MyWorkspaceNotifications;
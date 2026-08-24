// src/screens/Notifications.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGetUserNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
  useClearAllNotificationsMutation,
} from '../slices/notificationApiSlice';
import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';
import {
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
  FaChevronLeft,
  FaChevronRight,
  FaDownload,
  FaExclamationTriangle,
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';

// ─── Build the destination route for a notification ────────────────
const buildNotificationLink = (data = {}) => {
  // ── App Update Notifications ──────────────────────────────────────
  if (data.type === 'app_update' || data.type === 'APP_UPDATE' || data.notificationType === 'app_update') {
    return '/app-versions';
  }

  if (data.type === 'version_updated' || data.type === 'upload_confirmation' || data.type === 'version_deleted') {
    return '/app-versions';
  }

  // ── Call Notifications ────────────────────────────────────────────
  if (data.notificationType === 'call' && data.roomId) {
    return `/call/${data.roomId}?autoJoin=true`;
  }

  // ── Chat/Channel Notifications ────────────────────────────────────
  if (data.chatId) {
    if (data.workspaceId) {
      return `/workspace/${data.workspaceId}/chat/${data.chatId}`;
    }
    const isGroup = data.notificationType === 'channel' || data.chatType === 'group';
    return isGroup ? `/channels/${data.chatId}` : `/chats/${data.chatId}`;
  }

  // ── Task Notifications ────────────────────────────────────────────
  if (data.taskId && data.projectId && data.workspaceId) {
    return `/workspace/${data.workspaceId}/project/${data.projectId}`;
  }

  // ── Project Notifications ─────────────────────────────────────────
  if (data.projectId && data.workspaceId) {
    return `/workspace/${data.workspaceId}/project/${data.projectId}`;
  }

  // ── Workspace Notifications ───────────────────────────────────────
  if (data.workspaceId) {
    return `/workspace/${data.workspaceId}`;
  }

  // ── Clock-in Notifications ────────────────────────────────────────
  if (data.type === 'clockin' || data.type === 'clockout' || 
      data.type === 'clockin-reminder' || data.type === 'auto-clockout' ||
      data.type === 'clockin-confirmation' || data.type === 'clockout-confirmation') {
    if (data.workspaceId) {
      return `/workspace/${data.workspaceId}/clockin`;
    }
  }

  return '/my-workspaces';
};

const getNotificationIcon = (data = {}) => {
  // ── App Update Notifications ──────────────────────────────────────
  if (data.type === 'app_update' || data.type === 'APP_UPDATE' || data.notificationType === 'app_update') {
    return FaDownload;
  }
  if (data.type === 'version_updated' || data.type === 'upload_confirmation' || data.type === 'version_deleted') {
    return FaDownload;
  }

  // ── Other Notifications ───────────────────────────────────────────
  if (data.notificationType === 'call') return FaPhoneAlt;
  if (data.notificationType === 'channel' || data.chatType === 'group') return FaHashtag;
  if (data.chatId) return FaComments;
  if (data.taskId) return FaTasks;
  if (data.projectId) return FaFolder;
  return FaBell;
};

const getNotificationBadge = (data = {}) => {
  // ── App Update Badge ──────────────────────────────────────────────
  if (data.type === 'app_update' || data.type === 'APP_UPDATE' || data.notificationType === 'app_update') {
    const isRequired = data.isRequired === 'true' || data.isRequired === true;
    return (
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
        isRequired 
          ? 'bg-red-500/20 text-red-400' 
          : 'bg-orange-400/20 text-orange-400'
      }`}>
        {isRequired ? 'Required' : 'Optional'}
      </span>
    );
  }
  return null;
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
const NotificationItem = ({ notification, onClick, onDelete, deleting }) => {
  const Icon = getNotificationIcon(notification.data);
  const Badge = getNotificationBadge(notification.data);
  const unread = !notification.read;
  const isAppUpdate = notification.data?.type === 'app_update' || 
                      notification.data?.type === 'APP_UPDATE' || 
                      notification.data?.notificationType === 'app_update';
  const isRequired = notification.data?.isRequired === 'true' || notification.data?.isRequired === true;

  return (
    <div
      onClick={() => onClick(notification)}
      className={`relative flex items-start gap-3 px-4 sm:px-6 py-3 cursor-pointer transition group border-b border-gray-100 dark:border-gray-800 ${
        unread
          ? 'bg-teal-50/50 dark:bg-teal-900/10 hover:bg-teal-50 dark:hover:bg-teal-900/20'
          : 'hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
      } ${isAppUpdate ? 'border-l-4 ' + (isRequired ? 'border-l-red-500' : 'border-l-orange-400') : ''}`}
    >
      {unread && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-teal-500" />
      )}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
        isAppUpdate 
          ? isRequired 
            ? 'bg-gradient-to-br from-red-400 to-red-600' 
            : 'bg-gradient-to-br from-orange-400 to-orange-600'
          : 'bg-gradient-to-br from-teal-400 to-cyan-400'
      } text-white`}>
        <Icon className="text-sm" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm truncate ${unread ? 'font-semibold text-gray-800 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
            {notification.title}
          </p>
          {Badge}
          {isAppUpdate && notification.data?.version && (
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
              v{notification.data.version}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {notification.body}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            {timeAgo(notification.createdAt)}
          </p>
          {isAppUpdate && (
            <span className="text-[10px] text-teal-400 flex items-center gap-0.5">
              <FaDownload className="text-[8px]" />
              Tap to download
            </span>
          )}
        </div>
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
        {deleting ? <FaSpinner className="animate-spin text-xs" /> : <FaTrashAlt className="text-xs" />}
      </button>
    </div>
  );
};

const Notifications = () => {
  const navigate = useNavigate();

  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState(null);
  const limit = 20;

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

  const notifications = data?.notifications || [];
  const pagination = data?.pagination;
  const unreadCount = notifications.filter((n) => !n.read).length;
  const appUpdateCount = notifications.filter((n) => 
    n.data?.type === 'app_update' || 
    n.data?.type === 'APP_UPDATE' || 
    n.data?.notificationType === 'app_update'
  ).length;

  const handleItemClick = async (notification) => {
    if (!notification.read) {
      markNotificationRead(notification._id).catch((err) =>
        console.error('Mark read failed:', err?.data?.message || err.message)
      );
    }
    navigate(buildNotificationLink(notification.data));
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

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>
        <div className="flex-1 flex items-center justify-center py-24">
          <FaSpinner className="animate-spin text-teal-500 text-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
      <div className="hidden md:block md:w-72 md:flex-shrink-0">
        <GeneralSidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white dark:bg-[#0f0f12] border-b border-gray-200 dark:border-gray-800">
          <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 whitespace-nowrap">
              Notifications
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full bg-teal-500">
                  {unreadCount}
                </span>
              )}
              {appUpdateCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-400/20 text-orange-400 flex items-center gap-0.5">
                  <FaDownload className="text-[8px]" />
                  {appUpdateCount} update{appUpdateCount > 1 ? 's' : ''}
                </span>
              )}
            </h1>
            <div className="flex items-center gap-3">
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll || notifications.length === 0}
                className="flex items-center gap-1.5 text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {markingAll ? <FaSpinner className="animate-spin text-xs" /> : <FaCheckDouble className="text-xs" />}
                <span className="hidden sm:inline">Mark all read</span>
              </button>
              <button
                onClick={handleClearAll}
                disabled={clearingAll || notifications.length === 0}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {clearingAll ? <FaSpinner className="animate-spin text-xs" /> : <FaTrash className="text-xs" />}
                <span className="hidden sm:inline">Clear all</span>
              </button>
            </div>
          </div>

          <div className="flex bg-gray-50 dark:bg-[#1a1a1a] border-t border-gray-200 dark:border-gray-800">
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`
                  flex-1 md:flex-none py-2.5 px-4 text-sm font-medium
                  transition border-b-2
                  ${
                    filter === id
                      ? 'text-teal-600 dark:text-teal-400 border-teal-600 dark:border-teal-400'
                      : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 bg-white dark:bg-[#0f0f12] pb-24 md:pb-6">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <FaInbox className="text-5xl mb-4 opacity-30" />
              <p className="text-lg font-medium">
                {filter === 'unread' ? "You're all caught up" : 'No notifications yet'}
              </p>
            </div>
          ) : (
            <div className={`divide-y divide-gray-100 dark:divide-gray-800 ${isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}`}>
              {notifications.map((n) => (
                <NotificationItem
                  key={n._id}
                  notification={n}
                  onClick={handleItemClick}
                  onDelete={handleDelete}
                  deleting={deletingId === n._id}
                />
              ))}
            </div>
          )}

          {pagination && pagination.pages > 1 && (
            <div className="px-4 sm:px-6 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:text-gray-800 dark:hover:text-gray-200 transition"
              >
                <FaChevronLeft className="text-[10px]" /> Prev
              </button>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
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
        </main>
      </div>

      <GeneralBottombar />
    </div>
  );
};

export default Notifications;
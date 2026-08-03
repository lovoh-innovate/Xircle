// pages/Profile.jsx
import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { useGetMyWorkspacesQuery } from '../slices/workspaceApiSlice';
import { useLogoutMutation } from '../slices/userApiSlice';
import { logout } from '../slices/authSlice';
import { apiSlice } from '../slices/apiSlice'; // 👈 import the base API slice
import { toast } from 'react-toastify';
import { persistor } from '../store';
import {
  FaArrowLeft,
  FaUserCircle,
  FaEdit,
  FaUsers,
  FaEnvelope,
  FaPhone,
  FaCalendarAlt,
  FaIndustry,
  FaChevronRight,
  FaSignOutAlt,
  FaBuilding,
  FaCog,
} from 'react-icons/fa';

const Profile = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  const [activeTab, setActiveTab] = useState('about');

  const { data, isLoading: workspacesLoading } = useGetMyWorkspacesQuery(undefined, {
    pollingInterval: 30000,
  });

  const [logoutUser, { isLoading: logoutLoading }] = useLogoutMutation();

  const myWorkspaces = data?.myBusinesses || [];
  const joinedWorkspaces = data?.joinedBusinesses || [];

  // ─── Nuclear Logout ────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      // 1. Attempt server logout (optional but good)
      await logoutUser().unwrap();
    } catch (err) {
      // Even if server logout fails, we still wipe local data
      console.warn('Server logout failed, continuing with local cleanup:', err);
    } finally {
      // 2. Clear Redux auth state
      dispatch(logout());

      // 3. Purge persisted store
      await persistor.purge();

      // 4. Reset all RTK Query cached data (queries, mutations, etc.)
      dispatch(apiSlice.util.resetApiState());

      // 5. Wipe localStorage
      localStorage.clear();

      // 6. Wipe sessionStorage
      sessionStorage.clear();

      // 7. Notify and redirect
      toast.success('Logged out successfully');
      navigate('/login');
    }
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

  const renderWorkspaceList = (workspaces, title, emptyMessage) => (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
        {title} ({workspaces.length})
      </h3>
      {workspaces.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-500 text-sm italic">{emptyMessage}</p>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800/30">
          {workspaces.map((ws) => (
            <Link
              key={ws._id}
              to={
                ws.owner === userInfo?._id || ws.owner?._id === userInfo?._id
                  ? `/my-workspace/${ws._id}`
                  : `/workspace/${ws._id}`
              }
              className="flex items-center justify-between py-3 px-1 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                {ws.logo ? (
                  <img src={ws.logo} alt={ws.name} className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700/60" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                    style={{ backgroundColor: ws.color || '#0d9488' }}
                  >
                    {ws.initials || getInitials(ws.name)}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200 text-sm group-hover:text-gray-900 dark:group-hover:text-white transition">
                    {ws.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {ws.industry || 'General'} · {ws.members?.length || 0} members
                  </p>
                </div>
              </div>
              <FaChevronRight className="text-gray-400 dark:text-gray-500 text-xs flex-shrink-0 ml-2" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  if (!userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="w-8 h-8 border-4 border-teal-600 dark:border-[#0d9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const brandColor = '#0d9488';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col">
      {/* Fixed Header – glass */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
              <FaArrowLeft />
            </button>
            <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Profile</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Settings button */}
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-700/50 rounded-full text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white transition"
            >
              <FaCog className="text-xs" />
              Settings
            </button>
            <button
              onClick={() => navigate('/profile/edit')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-100 dark:bg-[#0d9488]/20 hover:bg-teal-200 dark:hover:bg-[#0d9488]/30 rounded-full text-sm font-medium text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-white transition"
            >
              <FaEdit className="text-xs" />
              Edit
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 px-4 border-t border-gray-200/60 dark:border-gray-800/30">
          <button
            onClick={() => setActiveTab('about')}
            className={`pb-2 text-sm font-medium transition ${
              activeTab === 'about'
                ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            About
          </button>
          <button
            onClick={() => setActiveTab('workspaces')}
            className={`pb-2 text-sm font-medium transition ${
              activeTab === 'workspaces'
                ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Workspaces
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-2 text-sm font-medium transition ${
              activeTab === 'activity'
                ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Activity
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 pb-24 md:pb-6">
        {/* Profile Card */}
        <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-5 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              {userInfo.profile ? (
                <img
                  src={userInfo.profile}
                  alt={userInfo.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700/60"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
                  style={{ backgroundColor: brandColor }}
                >
                  {getInitials(userInfo.name)}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">{userInfo.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">@{userInfo.username || 'user'}</p>
              {userInfo.bio && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{userInfo.bio}</p>}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200/60 dark:border-gray-800/40 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <FaEnvelope className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <span className="truncate">{userInfo.email}</span>
            </div>
            {userInfo.phone && (
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                <FaPhone className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <span>{userInfo.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <FaCalendarAlt className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <span>Joined {new Date(userInfo.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <FaBuilding className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <span>{myWorkspaces.length + joinedWorkspaces.length} workspaces</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 pt-4 border-t border-gray-200/60 dark:border-gray-800/40 flex flex-wrap justify-between items-center gap-2">
            <Link
              to="/settings"
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700/40 transition text-sm font-medium"
            >
              <FaCog className="text-xs" />
              Notification Settings
            </Link>
            <button
              onClick={handleLogout}
              disabled={logoutLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition text-sm font-medium disabled:opacity-50"
            >
              <FaSignOutAlt />
              {logoutLoading ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'about' && (
          <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-5">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">About Me</h3>
            <p className="text-gray-600 dark:text-gray-400">{userInfo.bio || 'No bio yet.'}</p>
          </div>
        )}

        {activeTab === 'workspaces' && (
          <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-5">
            {workspacesLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: brandColor }} />
              </div>
            ) : (
              <>
                {renderWorkspaceList(myWorkspaces, 'Owned Workspaces', 'You do not own any workspaces yet.')}
                {renderWorkspaceList(joinedWorkspaces, 'Joined Workspaces', 'You have not joined any workspaces yet.')}
              </>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-5">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Recent Activity</h3>
            <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
              <FaCalendarAlt className="text-4xl mb-2 opacity-30" />
              <p>No recent activity yet.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Profile;
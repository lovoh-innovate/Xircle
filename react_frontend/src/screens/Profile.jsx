// pages/Profile.jsx
import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  useGetMyWorkspacesQuery,
} from '../slices/workspaceApiSlice';
import { useLogoutMutation } from '../slices/userApiSlice';
import { logout } from '../slices/authSlice';
import { toast } from 'react-toastify';
import {
  FaUserCircle,
  FaEdit,
  FaUsers,
  FaEnvelope,
  FaPhone,
  FaCalendarAlt,
  FaIndustry,
  FaChevronRight,
  FaSignOutAlt,
} from 'react-icons/fa';

const Profile = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  const [activeTab, setActiveTab] = useState('about');

  // Fetch workspaces
  const { data, isLoading: workspacesLoading } = useGetMyWorkspacesQuery(undefined, {
    pollingInterval: 30000,
  });

  const [logoutUser, { isLoading: logoutLoading }] = useLogoutMutation();

  const myWorkspaces = data?.myBusinesses || [];
  const joinedWorkspaces = data?.joinedBusinesses || [];

  // ── Logout handler ──
  const handleLogout = async () => {
    try {
      await logoutUser().unwrap();
      dispatch(logout());
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (err) {
      toast.error(err?.data?.message || 'Logout failed');
    }
  };

  // ── Helper to get initials ──
  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  };

  // ── Cover photo (use a gradient if no cover) ──
  const coverGradient = 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)';

  // ── Render Workspace List ──
  const renderWorkspaceList = (workspaces, title, emptyMessage) => (
    <div>
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
        {title} ({workspaces.length})
      </h3>
      {workspaces.length === 0 ? (
        <p className="text-gray-400 text-sm">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {workspaces.map((ws) => (
            <li key={ws._id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">{ws.name}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <FaIndustry className="text-xs" /> {ws.industry || 'General'} · {ws.members?.length || 0} members
                </p>
              </div>
              <Link
                to={`/workspace/${ws._id}`}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View <FaChevronRight className="inline text-xs" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // ── Loading state ──
  if (!userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Cover & Profile Header ── */}
      <div className="relative">
        {/* Cover Photo – gradient fallback */}
        <div
          className="h-48 md:h-64 w-full bg-cover bg-center"
          style={{ backgroundImage: coverGradient }}
        >
          <div className="h-full w-full bg-gradient-to-t from-black/50 to-transparent" />
        </div>

        {/* Profile Picture & Name – positioned below cover */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-end -mt-12 sm:-mt-16 gap-4">
            {/* Avatar */}
            <div className="relative">
              {userInfo.profile ? (
                <img
                  src={userInfo.profile}
                  alt={userInfo.name}
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-lg object-cover"
                />
              ) : (
                <div
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white text-2xl font-bold"
                  style={{ backgroundColor: '#1877f2' }}
                >
                  {getInitials(userInfo.name)}
                </div>
              )}
            </div>

            {/* Name & Edit button */}
            <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{userInfo.name}</h1>
                <p className="text-sm text-gray-500">@{userInfo.username}</p>
              </div>
              <button
                onClick={() => navigate('/profile/edit')}
                className="flex items-center gap-2 px-4 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-full text-sm font-medium text-gray-700 transition"
              >
                <FaEdit className="text-sm" /> Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="border-b border-gray-200 bg-white shadow-sm mt-2">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto space-x-6 -mb-px">
            <button
              onClick={() => setActiveTab('about')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === 'about'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              About
            </button>
            <button
              onClick={() => setActiveTab('workspaces')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === 'workspaces'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Workspaces
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === 'activity'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Activity
            </button>
          </div>
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'about' && (
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">About</h2>
              {/* Logout button inside About tab */}
              <button
                onClick={handleLogout}
                disabled={logoutLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-medium"
              >
                <FaSignOutAlt />
                {logoutLoading ? 'Logging out...' : 'Logout'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-gray-700">
                <FaUserCircle className="text-gray-400" />
                <span>Name: <strong>{userInfo.name}</strong></span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <FaEnvelope className="text-gray-400" />
                <span>Email: <strong>{userInfo.email}</strong></span>
              </div>
              {userInfo.phone && (
                <div className="flex items-center gap-3 text-gray-700">
                  <FaPhone className="text-gray-400" />
                  <span>Phone: <strong>{userInfo.phone}</strong></span>
                </div>
              )}
              <div className="flex items-center gap-3 text-gray-700">
                <FaCalendarAlt className="text-gray-400" />
                <span>Joined: <strong>{new Date(userInfo.createdAt).toLocaleDateString()}</strong></span>
              </div>
              {userInfo.role && (
                <div className="flex items-center gap-3 text-gray-700">
                  <FaUsers className="text-gray-400" />
                  <span>Role: <strong className="capitalize">{userInfo.role}</strong></span>
                </div>
              )}
              <div className="flex items-center gap-3 text-gray-700">
                <FaIndustry className="text-gray-400" />
                <span>Workspaces: <strong>{myWorkspaces.length + joinedWorkspaces.length}</strong></span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="font-medium text-gray-700">Bio</h3>
              <p className="text-gray-500 mt-1">{userInfo.bio || 'No bio yet.'}</p>
            </div>
          </div>
        )}

        {activeTab === 'workspaces' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Workspaces</h2>

            {workspacesLoading ? (
              <div className="text-center py-8 text-gray-400">Loading workspaces...</div>
            ) : (
              <>
                <div className="mb-6">
                  {renderWorkspaceList(
                    myWorkspaces,
                    'Owned',
                    'You don’t own any workspaces yet.'
                  )}
                </div>
                <div>
                  {renderWorkspaceList(
                    joinedWorkspaces,
                    'Joined',
                    'You haven’t joined any workspaces yet.'
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
            <div className="text-center py-8 text-gray-400">
              <FaCalendarAlt className="mx-auto text-3xl mb-2" />
              <p>No recent activity yet.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
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
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
        {title} ({workspaces.length})
      </h3>
      {workspaces.length === 0 ? (
        <p className="text-gray-400 text-sm italic">{emptyMessage}</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {workspaces.map((ws) => (
            <Link
              key={ws._id}
              to={ws.owner === userInfo?._id || ws.owner?._id === userInfo?._id
                ? `/my-workspace/${ws._id}`
                : `/workspace/${ws._id}`}
              className="flex items-center justify-between py-3 px-1 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                {ws.logo ? (
                  <img src={ws.logo} alt={ws.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                    style={{ backgroundColor: ws.color || '#0d9488' }}
                  >
                    {ws.initials || getInitials(ws.name)}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-800 text-sm">{ws.name}</p>
                  <p className="text-xs text-gray-500">
                    {ws.industry || 'General'} · {ws.members?.length || 0} members
                  </p>
                </div>
              </div>
              <FaChevronRight className="text-gray-300 text-xs flex-shrink-0 ml-2" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  if (!userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const brandColor = '#0d9488'; // consistent teal

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Fixed Header */}
      <header className="sticky top-0 z-10 bg-teal-600 text-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1">
              <FaArrowLeft />
            </button>
            <h1 className="text-lg font-semibold">Profile</h1>
          </div>
          <button
            onClick={() => navigate('/profile/edit')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-full text-sm font-medium transition"
          >
            <FaEdit className="text-xs" />
            Edit
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 px-4 border-t border-white/20">
          <button
            onClick={() => setActiveTab('about')}
            className={`pb-2 text-sm font-medium transition ${
              activeTab === 'about' ? 'border-b-2 border-white text-white' : 'text-white/70 hover:text-white'
            }`}
          >
            About
          </button>
          <button
            onClick={() => setActiveTab('workspaces')}
            className={`pb-2 text-sm font-medium transition ${
              activeTab === 'workspaces' ? 'border-b-2 border-white text-white' : 'text-white/70 hover:text-white'
            }`}
          >
            Workspaces
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-2 text-sm font-medium transition ${
              activeTab === 'activity' ? 'border-b-2 border-white text-white' : 'text-white/70 hover:text-white'
            }`}
          >
            Activity
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 pb-24 md:pb-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-gray-200/60 p-5 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              {userInfo.profile ? (
                <img
                  src={userInfo.profile}
                  alt={userInfo.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-100"
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
              <h2 className="text-xl font-bold text-gray-900">{userInfo.name}</h2>
              <p className="text-sm text-gray-500">@{userInfo.username || 'user'}</p>
              {userInfo.bio && <p className="text-sm text-gray-600 mt-1">{userInfo.bio}</p>}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <FaEnvelope className="text-gray-400 flex-shrink-0" />
              <span className="truncate">{userInfo.email}</span>
            </div>
            {userInfo.phone && (
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <FaPhone className="text-gray-400 flex-shrink-0" />
                <span>{userInfo.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <FaCalendarAlt className="text-gray-400 flex-shrink-0" />
              <span>Joined {new Date(userInfo.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <FaBuilding className="text-gray-400 flex-shrink-0" />
              <span>{myWorkspaces.length + joinedWorkspaces.length} workspaces</span>
            </div>
          </div>

          {/* Logout button – inline, subtle */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
            <button
              onClick={handleLogout}
              disabled={logoutLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition text-sm font-medium"
            >
              <FaSignOutAlt />
              {logoutLoading ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'about' && (
          <div className="bg-white rounded-2xl border border-gray-200/60 p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">About Me</h3>
            <p className="text-gray-600">{userInfo.bio || 'No bio yet.'}</p>
          </div>
        )}

        {activeTab === 'workspaces' && (
          <div className="bg-white rounded-2xl border border-gray-200/60 p-5">
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
          <div className="bg-white rounded-2xl border border-gray-200/60 p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h3>
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
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
// pages/Profile.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { useGetMyWorkspacesQuery } from '../slices/workspaceApiSlice';
import {
  useLogoutMutation,
  useUpdateProfileMutation,
  useGetUserByIdQuery,
} from '../slices/userApiSlice';
import { logout, setCredentials } from '../slices/authSlice';
import { apiSlice } from '../slices/apiSlice';
import { toast } from 'react-hot-toast';
import {
  FaArrowLeft,
  FaEdit,
  FaEnvelope,
  FaPhone,
  FaCalendarAlt,
  FaBuilding,
  FaChevronRight,
  FaSignOutAlt,
  FaCog,
  FaSave,
  FaTimes,
  FaCamera,
} from 'react-icons/fa';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

const Profile = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  const [activeTab, setActiveTab] = useState('about');
  const [editMode, setEditMode] = useState(false);

  // ── Fetch fresh user data ──
  const {
    data: freshUser,
    isLoading: userLoading,
    refetch,
  } = useGetUserByIdQuery(userInfo?._id, {
    skip: !userInfo?._id,
  });

  useEffect(() => {
    if (freshUser) {
      dispatch(
        setCredentials({
          ...freshUser,
          token: userInfo?.token,
        })
      );
    }
  }, [freshUser, userInfo?.token, dispatch]);

  // ── Local state for editing ──
  const [formData, setFormData] = useState({
    name: userInfo?.name || '',
    phone: userInfo?.phone || '',
    profile: null, // will hold the File or base64 string
  });
  const [previewUrl, setPreviewUrl] = useState(userInfo?.profile || '');
  const fileInputRef = useRef(null);

  // ── Workspaces ──
  const { data, isLoading: workspacesLoading } = useGetMyWorkspacesQuery(undefined, {
    pollingInterval: 30000,
  });

  const [logoutUser, { isLoading: logoutLoading }] = useLogoutMutation();
  const [updateProfile, { isLoading: updateLoading }] = useUpdateProfileMutation();

  const myWorkspaces = data?.myBusinesses || [];
  const joinedWorkspaces = data?.joinedBusinesses || [];

  // ─── Handlers ─────────────────────────────────────────────────────

  const handleEditToggle = () => {
    if (editMode) {
      // Cancel: reset to current userInfo
      setFormData({
        name: userInfo?.name || '',
        phone: userInfo?.phone || '',
        profile: null,
      });
      setPreviewUrl(userInfo?.profile || '');
      setEditMode(false);
    } else {
      setEditMode(true);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ─── Capacitor Camera / Gallery ──────────────────────────────────

  const handleProfileImagePick = async () => {
    try {
      let image;
      // On native (iOS/Android), use Capacitor Camera
      if (Capacitor.isNativePlatform()) {
        image = await Camera.getPhoto({
          quality: 90,
          allowEditing: true,
          resultType: CameraResultType.Uri,
          source: CameraSource.Prompt, // allows user to choose camera or gallery
        });
      } else {
        // Fallback for web: use file input
        fileInputRef.current?.click();
        return;
      }

      // For Capacitor, we get a webPath or base64 string
      if (image && image.webPath) {
        setPreviewUrl(image.webPath);
        // Convert to File or Blob to send via FormData
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        const file = new File([blob], 'profile.jpg', { type: blob.type });
        setFormData((prev) => ({ ...prev, profile: file }));
        toast.success('Image selected!');
      }
    } catch (error) {
      if (error.message !== 'User cancelled photos app') {
        console.error('Camera error:', error);
        toast.error('Failed to pick image');
      }
    }
  };

  // ─── Handle file input change (web fallback) ────────────────────

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, profile: file }));
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // ─── Save Profile ──────────────────────────────────────────────────

  const handleSave = async () => {
    const formDataToSend = new FormData();
    formDataToSend.append('name', formData.name);
    formDataToSend.append('phone', formData.phone);
    if (formData.profile) {
      formDataToSend.append('profile', formData.profile);
    }

    try {
      const updatedUser = await updateProfile(formDataToSend).unwrap();
      dispatch(setCredentials(updatedUser));
      refetch();
      toast.success('Profile updated successfully!');
      setEditMode(false);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update profile');
    }
  };

  // ─── Logout ────────────────────────────────────────────────────────

  const handleLogout = async () => {
    try {
      await logoutUser().unwrap();
    } catch (err) {
      console.warn('Server logout failed, continuing with local cleanup:', err);
    } finally {
      dispatch(logout());
      dispatch(apiSlice.util.resetApiState());
      localStorage.clear();
      sessionStorage.clear();
      toast.success('Logged out successfully');
      navigate('/login');
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  };

  const formatJoinDate = (dateString) => {
    if (!dateString) return 'Recently joined';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Recently joined' : date.toLocaleDateString();
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
                  <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{ws.name}</p>
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

  if (!userInfo || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="w-8 h-8 border-4 border-teal-600 dark:border-[#0d9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const brandColor = '#0d9488';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col">
      {/* Fixed Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
              <FaArrowLeft />
            </button>
            <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Profile</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-700/50 rounded-full text-sm font-medium text-gray-700 dark:text-gray-200 transition"
            >
              <FaCog className="text-xs" />
              <span className="hidden sm:inline">Settings</span>
            </button>
            {editMode ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={updateLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 dark:bg-[#0d9488] hover:bg-teal-700 dark:hover:bg-[#0f9d90] rounded-full text-sm font-medium text-white transition disabled:opacity-50"
                >
                  <FaSave className="text-xs" />
                  {updateLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleEditToggle}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 dark:bg-gray-700/50 hover:bg-gray-300 dark:hover:bg-gray-600/50 rounded-full text-sm font-medium text-gray-700 dark:text-gray-200 transition"
                >
                  <FaTimes className="text-xs" />
                  <span className="hidden xs:inline">Cancel</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleEditToggle}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-100 dark:bg-[#0d9488]/20 hover:bg-teal-200 dark:hover:bg-[#0d9488]/30 rounded-full text-sm font-medium text-teal-600 dark:text-[#0d9488] transition"
              >
                <FaEdit className="text-xs" />
                <span className="hidden xs:inline">Edit</span>
              </button>
            )}
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
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            {/* Profile Picture */}
            <div className="relative flex-shrink-0 group">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={userInfo.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700/60"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                  style={{ backgroundColor: brandColor }}
                >
                  {getInitials(userInfo.name)}
                </div>
              )}
              {/* Camera overlay – visible when editMode is true */}
              {editMode && (
                <button
                  onClick={handleProfileImagePick}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full transition hover:bg-black/60"
                  type="button"
                >
                  <FaCamera className="text-white text-xl" />
                </button>
              )}
              {/* Hidden file input as fallback for web */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>

            <div className="flex-1 w-full min-w-0">
              {editMode ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1e1e24] text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="Full Name"
                  />
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1e1e24] text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="Phone Number"
                  />
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 text-center sm:text-left">{userInfo.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left">@{userInfo.username || 'user'}</p>
                  {userInfo.bio && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 text-center sm:text-left">{userInfo.bio}</p>}
                </>
              )}
            </div>
          </div>

          {/* Info rows */}
          <div className="mt-4 pt-4 border-t border-gray-200/60 dark:border-gray-800/40 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <FaEnvelope className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <span className="truncate">{userInfo.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <FaPhone className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <span>{userInfo.phone || 'Not provided'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <FaCalendarAlt className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <span>{formatJoinDate(userInfo.createdAt)}</span>
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
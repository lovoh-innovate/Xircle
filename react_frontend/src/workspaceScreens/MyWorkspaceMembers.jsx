// src/workspaceScreens/MyWorkspaceMembers.jsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import {
  useGetMembersQuery,
  useGetPendingRequestsQuery,
  useApproveMemberMutation,
  useRejectMemberMutation,
  useUpdateMemberMutation,
  useRemoveMemberMutation,
} from '../slices/teamApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
import {
  FaUsers,
  FaUserPlus,
  FaUserCheck,
  FaUserCog,
  FaTrashAlt,
  FaCheck,
  FaTimes,
  FaEdit,
  FaSearch,
  FaArrowLeft,
  FaSpinner,
  FaCrown,
  FaEllipsisV,
  FaCircle,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// ─── Helper: get initials ──────────────────────────────────────────────
const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
};

// ─── Search Members Modal ──────────────────────────────────────
const SearchMembersModal = ({ isOpen, onClose, members, brandColor, workspaceId, userInfo }) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filtered = members.filter((member) => {
    const user = member.user || member;
    const name = user?.name?.toLowerCase() || '';
    const email = user?.email?.toLowerCase() || '';
    const q = query.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-[#0b0b10]/90 backdrop-blur-xl flex flex-col">
      {/* Modal Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200/60 dark:border-gray-800/60 bg-gray-50 dark:bg-[#14141a]/80">
        <button onClick={onClose} className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
          <FaArrowLeft />
        </button>
        <div className="flex-1 bg-gray-100 dark:bg-[#1e1e26] rounded-2xl px-4 py-2 flex items-center gap-3 border border-gray-200 dark:border-gray-800/40 focus-within:border-teal-500 dark:focus-within:border-[#0d9488]/50 transition">
          <FaSearch className="text-gray-400 dark:text-gray-500 text-xs" />
          <input
            type="text"
            placeholder="Search members..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent w-full outline-none text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <FaTimes className="text-xs" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {!query && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <FaSearch className="text-5xl mb-3 opacity-20" />
            <p className="text-sm">Search members by name or email</p>
          </div>
        )}

        {query && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <p className="text-sm">No members found for "{query}"</p>
          </div>
        )}

        {query && filtered.length > 0 && (
          <div className="space-y-1">
            {filtered.map((member) => {
              const user = member.user || member;
              const isOnline = member.status === 'active';
              return (
                <div
                  key={user._id}
                  className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/40 hover:border-teal-500 dark:hover:border-[#0d9488]/40 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition cursor-pointer group"
                >
                  <div className="relative flex-shrink-0">
                    {user?.profile ? (
                      <img src={user.profile} alt={user.name} className="w-12 h-12 rounded-2xl object-cover" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: brandColor }}
                      >
                        {getInitials(user.name)}
                      </div>
                    )}
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-[#0b0b10]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-gray-900 dark:group-hover:text-white transition">
                      {user?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">{user?.email || 'No email'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Update Member Modal ──────────────────────────────────────
const UpdateMemberModal = ({ isOpen, onClose, member, brandColor, onSuccess }) => {
  const [role, setRole] = useState(member?.role || 'Staff');
  const [department, setDepartment] = useState(member?.department || 'General');
  const [isLoading, setIsLoading] = useState(false);
  const [updateMember] = useUpdateMemberMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await updateMember({
        workspaceId: member?.workspaceId,
        memberId: member?.user?._id || member?._id,
        role,
        department,
      }).unwrap();
      toast.success('Member updated!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update member');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <FaUserCog className="text-sm text-teal-600 dark:text-[#0d9488]" /> Update Member
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Role</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Developer, Manager"
              className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Engineering, Design"
              className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/30 transition text-sm font-medium text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 text-white rounded-xl transition hover:opacity-80 disabled:opacity-50 text-sm font-medium"
              style={{ backgroundColor: brandColor }}
            >
              {isLoading ? 'Updating...' : 'Update Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Approve Member Modal ────────────────────────────────────
const ApproveMemberModal = ({ isOpen, onClose, memberId, workspaceId, brandColor, onSuccess }) => {
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('Staff');
  const [isLoading, setIsLoading] = useState(false);
  const [approveMember] = useApproveMemberMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!department.trim()) {
      toast.error('Department is required');
      return;
    }
    try {
      setIsLoading(true);
      await approveMember({
        workspaceId,
        memberId,
        department: department.trim(),
        role: role.trim(),
      }).unwrap();
      toast.success('Member approved!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to approve member');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <FaUserCheck className="text-sm text-teal-600 dark:text-[#0d9488]" /> Approve Member
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Department *</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Engineering, Design"
              className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Role</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Developer, Manager"
              className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Default: Staff</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/30 transition text-sm font-medium text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 text-white rounded-xl transition hover:opacity-80 disabled:opacity-50 text-sm font-medium"
              style={{ backgroundColor: brandColor }}
            >
              {isLoading ? 'Approving...' : 'Approve Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────
const MyWorkspaceMembers = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState('active');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveMemberId, setApproveMemberId] = useState(null);

  const { data: workspaceData, isLoading: workspaceLoading, error: workspaceError } = useGetWorkspaceQuery(workspaceId);
  const { data: membersData, isLoading: membersLoading, refetch: refetchMembers } = useGetMembersQuery(workspaceId);
  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useGetPendingRequestsQuery(workspaceId);

  const [rejectMember] = useRejectMemberMutation();
  const [removeMember] = useRemoveMemberMutation();

  const handleReject = async (memberId) => {
    if (!window.confirm('Reject this join request?')) return;
    try {
      await rejectMember({ workspaceId, memberId }).unwrap();
      toast.success('Request rejected');
      refetchPending();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to reject');
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      await removeMember({ workspaceId, memberId }).unwrap();
      toast.success('Member removed');
      refetchMembers();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to remove');
    }
  };

  const handleApproveClick = (memberId) => {
    setApproveMemberId(memberId);
    setShowApproveModal(true);
  };

  const handleApproveSuccess = () => {
    refetchMembers();
    refetchPending();
  };

  if (workspaceLoading || membersLoading || pendingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="text-center">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: workspaceData?.workspace?.color || '#0d9488', borderTopColor: 'transparent' }}
          />
          <p className="mt-3 text-gray-500 dark:text-gray-500 text-sm">Loading members...</p>
        </div>
      </div>
    );
  }

  if (workspaceError) {
    navigate(`/my-workspace/${workspaceId}`);
    return null;
  }

  const workspace = workspaceData?.workspace;
  const members = membersData?.members || [];
  const pendingRequests = pendingData?.pending || [];
  const isOwner = workspace?.owner?._id === userInfo?._id || workspace?.owner === userInfo?._id;
  const brandColor = workspace?.color || '#0d9488';

  // ── Member List Component (reused for both active & pending) ──
  const renderMemberList = (list, type = 'active') => {
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <FaUsers className="text-4xl mb-2 opacity-30" />
          <p className="text-sm">{type === 'active' ? 'No members found' : 'No pending requests'}</p>
        </div>
      );
    }

    return list.map((item) => {
      const user = item.user || item;
      const member = item;
      const isPending = type === 'pending';

      return (
        <div
          key={user._id || item._id}
          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition-colors border-b border-gray-100 dark:border-gray-800/30 last:border-0"
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {user?.profile ? (
              <img src={user.profile} alt={user.name} className="w-12 h-12 rounded-2xl object-cover" />
            ) : (
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: brandColor }}
              >
                {getInitials(user?.name)}
              </div>
            )}
            {!isPending && member.status === 'active' && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-[#0f0f12]" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-gray-900 dark:group-hover:text-white transition">
                {user?.name || 'Unknown'}
              </p>
              {isPending && (
                <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-200 dark:border-yellow-700/40">
                  Pending
                </span>
              )}
              {!isPending && user._id === workspace?.owner?._id && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-700/40">
                  Owner
                </span>
              )}
              {!isPending && member.role && member.role !== 'Staff' && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-700/40">
                  {member.role}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              <span>{user?.email || 'No email'}</span>
              {member.department && <span>· {member.department}</span>}
            </div>
          </div>

          {/* Actions */}
          {isPending && isOwner && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleApproveClick(user._id)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white rounded-full hover:opacity-80 transition"
                style={{ backgroundColor: brandColor }}
              >
                <FaCheck className="text-xs" /> Approve
              </button>
              <button
                onClick={() => handleReject(user._id)}
                className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-full transition"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>
          )}

          {!isPending && isOwner && user._id !== workspace?.owner?._id && (
            <div className="relative">
              <button
                onClick={(e) => {
                  const menu = e.currentTarget.nextSibling;
                  menu.classList.toggle('hidden');
                }}
                className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"
              >
                <FaEllipsisV className="text-xs" />
              </button>
              <div className="hidden absolute right-0 top-10 bg-white dark:bg-[#1e1e26] rounded-xl shadow-lg border border-gray-200 dark:border-gray-800/60 min-w-[160px] z-10 py-1">
                <button
                  onClick={() => {
                    setSelectedMember({ ...member, workspaceId });
                    setShowUpdateModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 hover:text-gray-900 dark:hover:text-white transition w-full"
                >
                  <FaEdit className="text-xs text-teal-600 dark:text-[#0d9488]" /> Edit Role/Dept
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Remove ${user?.name || 'this member'}?`)) {
                      handleRemoveMember(user._id);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 transition w-full"
                >
                  <FaTrashAlt className="text-xs" /> Remove
                </button>
              </div>
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      {/* ── Search Members Modal ── */}
      <SearchMembersModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        members={members}
        brandColor={brandColor}
        workspaceId={workspaceId}
        userInfo={userInfo}
      />

      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header (fixed on mobile) */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate(`/my-workspace/${workspaceId}`)}
                className="p-1 lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
              >
                <FaArrowLeft />
              </button>
              <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Members</h1>
              <span className="text-xs font-normal text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-[#1a1a24] px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-800/40">
                {members.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"
              >
                <FaSearch className="text-sm" />
              </button>
              {isOwner && pendingRequests.length > 0 && (
                <button
                  onClick={() => setActiveTab('pending')}
                  className="text-xs text-white font-medium px-2 py-1 rounded-full flex items-center gap-1"
                  style={{ backgroundColor: brandColor }}
                >
                  <FaUserPlus className="text-xs" /> {pendingRequests.length}
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 px-4 border-t border-gray-200/60 dark:border-gray-800/30">
            <button
              onClick={() => setActiveTab('active')}
              className={`pb-2 text-sm font-medium transition ${
                activeTab === 'active'
                  ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Active ({members.length})
            </button>
            {isOwner && (
              <button
                onClick={() => setActiveTab('pending')}
                className={`pb-2 text-sm font-medium transition ${
                  activeTab === 'pending'
                    ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Pending ({pendingRequests.length})
              </button>
            )}
          </div>
        </header>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f12] divide-y divide-gray-100 dark:divide-gray-800/30">
          {activeTab === 'active' && renderMemberList(members, 'active')}
          {activeTab === 'pending' && isOwner && renderMemberList(pendingRequests, 'pending')}
        </div>
      </div>

      {/* Bottom Navigation (mobile) */}
      <MyWorkspaceBottombar workspace={workspace} />

      {/* Update Member Modal */}
      <UpdateMemberModal
        isOpen={showUpdateModal}
        onClose={() => {
          setShowUpdateModal(false);
          setSelectedMember(null);
        }}
        member={selectedMember}
        brandColor={brandColor}
        onSuccess={() => {
          refetchMembers();
          setShowUpdateModal(false);
          setSelectedMember(null);
        }}
      />

      {/* Approve Member Modal */}
      <ApproveMemberModal
        isOpen={showApproveModal}
        onClose={() => {
          setShowApproveModal(false);
          setApproveMemberId(null);
        }}
        memberId={approveMemberId}
        workspaceId={workspaceId}
        brandColor={brandColor}
        onSuccess={handleApproveSuccess}
      />
    </div>
  );
};

export default MyWorkspaceMembers;
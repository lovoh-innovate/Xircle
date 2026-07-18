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

// ─── Search Members Modal (full-screen overlay) ────────────────────────
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
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Modal Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-100">
        <button onClick={onClose} className="p-1">
          <FaArrowLeft className="text-gray-600" />
        </button>
        <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 flex items-center gap-2">
          <FaSearch className="text-gray-400 text-xs" />
          <input
            type="text"
            placeholder="Search members..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent w-full outline-none text-sm"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')}>
              <FaTimes className="text-gray-400 text-xs" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!query && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FaSearch className="text-4xl mb-2 opacity-30" />
            <p className="text-sm">Search members by name or email</p>
          </div>
        )}

        {query && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-sm">No members found for "{query}"</p>
          </div>
        )}

        {query && filtered.length > 0 && (
          <div className="divide-y divide-gray-100">
            {filtered.map((member) => {
              const user = member.user || member;
              const isOnline = member.status === 'active';
              return (
                <div key={user._id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
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
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{user?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{user?.email || 'No email'}</p>
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

// ─── Update Member Modal ──────────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FaUserCog className="text-sm" style={{ color: brandColor }} /> Update Member
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Developer, Manager"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              style={{ '--tw-ring-color': brandColor }}
              onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Engineering, Design"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              style={{ '--tw-ring-color': brandColor }}
              onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium text-gray-700">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 text-white rounded-lg transition hover:opacity-90 disabled:opacity-70 text-sm font-medium"
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

// ─── Approve Member Modal ────────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FaUserCheck className="text-sm" style={{ color: brandColor }} /> Approve Member
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Department *</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Engineering, Design"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              style={{ '--tw-ring-color': brandColor }}
              onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Developer, Manager"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              style={{ '--tw-ring-color': brandColor }}
              onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
            />
            <p className="text-xs text-gray-400 mt-1">Default: Staff</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium text-gray-700">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 text-white rounded-lg transition hover:opacity-90 disabled:opacity-70 text-sm font-medium"
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto"
               style={{ borderColor: workspaceData?.workspace?.color || '#4F46E5', borderTopColor: 'transparent' }} />
          <p className="mt-4 text-gray-500">Loading members...</p>
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
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
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
        <div key={user._id || item._id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
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
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-800 truncate">{user?.name || 'Unknown'}</p>
              {isPending && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Pending</span>
              )}
              {!isPending && user._id === workspace?.owner?._id && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Owner</span>
              )}
              {!isPending && member.role && member.role !== 'Staff' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{member.role}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
              <span>{user?.email || 'No email'}</span>
              {member.department && <span>· {member.department}</span>}
            </div>
          </div>

          {/* Actions */}
          {isPending && isOwner && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleApproveClick(user._id)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white rounded-full hover:opacity-90 transition"
                style={{ backgroundColor: brandColor }}
              >
                <FaCheck className="text-xs" /> Approve
              </button>
              <button
                onClick={() => handleReject(user._id)}
                className="p-1.5 text-gray-400 hover:text-red-500 rounded-full transition"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>
          )}

          {!isPending && isOwner && user._id !== workspace?.owner?._id && (
            <div className="relative">
              <button
                onClick={(e) => {
                  // Toggle menu
                  const menu = e.currentTarget.nextSibling;
                  menu.classList.toggle('hidden');
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <FaEllipsisV className="text-xs" />
              </button>
              <div className="hidden absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[160px] z-10 py-1">
                <button
                  onClick={() => {
                    setSelectedMember({ ...member, workspaceId });
                    setShowUpdateModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition w-full"
                >
                  <FaEdit className="text-xs" /> Edit Role/Dept
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Remove ${user?.name || 'this member'}?`)) {
                      handleRemoveMember(user._id);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition w-full"
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
    <div className="h-dvh bg-gray-50 flex flex-col lg:flex-row overflow-hidden">
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
        <header className="sticky top-0 z-10 bg-teal-600 text-white flex-shrink-0 shadow-sm">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => navigate(`/my-workspace/${workspaceId}`)} className="p-1 lg:hidden">
                <FaArrowLeft />
              </button>
              <h1 className="text-lg font-semibold">Members</h1>
              <span className="text-xs text-white/70 ml-1">{members.length}</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setSearchOpen(true)} className="p-1">
                <FaSearch className="text-white" />
              </button>
              {isOwner && pendingRequests.length > 0 && (
                <button
                  onClick={() => setActiveTab('pending')}
                  className="text-xs bg-white/20 px-2 py-1 rounded-full flex items-center gap-1"
                >
                  <FaUserPlus className="text-xs" /> {pendingRequests.length}
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 px-4 border-t border-white/20">
            <button
              onClick={() => setActiveTab('active')}
              className={`pb-2 text-sm font-medium transition ${
                activeTab === 'active'
                  ? 'border-b-2 border-white text-white'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Active ({members.length})
            </button>
            {isOwner && (
              <button
                onClick={() => setActiveTab('pending')}
                className={`pb-2 text-sm font-medium transition ${
                  activeTab === 'pending'
                    ? 'border-b-2 border-white text-white'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Pending ({pendingRequests.length})
              </button>
            )}
          </div>
        </header>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto bg-white">
          {activeTab === 'active' && (
            <div className="divide-y divide-gray-100">
              {renderMemberList(members, 'active')}
            </div>
          )}
          {activeTab === 'pending' && isOwner && (
            <div className="divide-y divide-gray-100">
              {renderMemberList(pendingRequests, 'pending')}
            </div>
          )}
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
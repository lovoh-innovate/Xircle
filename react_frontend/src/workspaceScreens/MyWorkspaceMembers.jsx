// src/workspaceScreens/MyWorkspaceMembers.jsx
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  FaUserTimes,
  FaUserCog,
  FaTrashAlt,
  FaCheck,
  FaTimes,
  FaEdit,
  FaSearch,
  FaArrowLeft,
  FaUserCircle,
  FaSpinner,
  FaCrown,
  FaUser,
  FaEnvelope,
  FaBriefcase,
  FaBuilding,
  FaChevronRight,
  FaEllipsisV,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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

// ─── Member Card ──────────────────────────────────────────────────────
const MemberCard = ({ member, workspaceId, isOwner, brandColor, onUpdate, onRemove }) => {
  const user = member.user || member;
  const [showMenu, setShowMenu] = useState(false);

  const handleRemove = () => {
    if (window.confirm(`Remove ${user?.name || 'this member'} from the workspace?`)) {
      onRemove && onRemove(user._id);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl transition border border-gray-100">
      {/* Avatar */}
      {user?.profile ? (
        <img src={user.profile} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: brandColor }}>
          {getInitials(user?.name)}
        </div>
      )}
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'Unknown'}</p>
          {user?._id === workspaceId?.owner && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Owner</span>
          )}
          {member.role && member.role !== 'Staff' && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{member.role}</span>
          )}
        </div>
        <div className="flex items-center flex-wrap gap-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <FaEnvelope className="text-[10px]" /> {user?.email || 'No email'}
          </span>
          {member.department && (
            <span className="flex items-center gap-1">
              <FaBuilding className="text-[10px]" /> {member.department}
            </span>
          )}
          {member.status === 'active' && (
            <span className="flex items-center gap-1 text-green-500">
              <FaUserCheck className="text-[10px]" /> Active
            </span>
          )}
        </div>
      </div>
      {/* Actions */}
      {isOwner && user?._id !== workspaceId?.owner && (
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <FaEllipsisV className="text-xs" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[160px] z-10 py-1">
              <button
                onClick={() => { setShowMenu(false); onUpdate && onUpdate(member); }}
                className="flex items-center gap-2 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition w-full"
              >
                <FaEdit className="text-xs" /> Edit Role/Dept
              </button>
              <button
                onClick={() => { setShowMenu(false); handleRemove(); }}
                className="flex items-center gap-2 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 transition w-full"
              >
                <FaTrashAlt className="text-xs" /> Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Pending Request Card ────────────────────────────────────────────
const PendingRequestCard = ({ request, onApproveClick }) => {
  const user = request.user || request;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl transition border border-gray-100">
      {user?.profile ? (
        <img src={user.profile} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: '#4F46E5' }}>
          {getInitials(user?.name)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'Unknown'}</p>
        <p className="text-xs text-gray-400 truncate">{user?.email || 'No email'}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onApproveClick && onApproveClick(user._id)}
          className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white rounded-lg hover:opacity-90 transition"
          style={{ backgroundColor: '#4F46E5' }}
        >
          <FaCheck className="text-xs" /> Approve
        </button>
        <button
          onClick={() => onRejectClick && onRejectClick(user._id)}
          className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
        >
          <FaTimes className="text-xs" /> Reject
        </button>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveMemberId, setApproveMemberId] = useState(null);

  // ── Fetch data ──
  const { data: workspaceData, isLoading: workspaceLoading, error: workspaceError } = useGetWorkspaceQuery(workspaceId);
  const { data: membersData, isLoading: membersLoading, refetch: refetchMembers } = useGetMembersQuery(workspaceId);
  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useGetPendingRequestsQuery(workspaceId);

  // ── Mutations ──
  const [rejectMember] = useRejectMemberMutation();
  const [updateMember] = useUpdateMemberMutation();
  const [removeMember] = useRemoveMemberMutation();

  // ── Handlers ──
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

  const handleUpdateMember = async (memberId, role, department) => {
    try {
      await updateMember({ workspaceId, memberId, role, department }).unwrap();
      toast.success('Member updated');
      refetchMembers();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update');
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

  // ── Derive data ──
  const workspace = workspaceData?.workspace;
  const members = membersData?.members || [];
  const pendingRequests = pendingData?.pending || [];

  const isOwner = workspace?.owner?._id === userInfo?._id || workspace?.owner === userInfo?._id;

  // ── Filter members ──
  const filteredMembers = members.filter((member) => {
    const user = member.user || member;
    const name = user?.name?.toLowerCase() || '';
    const email = user?.email?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  // ── Loading state ──
  if (workspaceLoading || membersLoading || pendingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
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

  if (!workspace) return null;

  const brandColor = workspace.color || '#4F46E5';

  return (
    <div className="h-screen bg-gray-100 flex flex-col md:flex-row overflow-hidden">
      {/* ── Left Sidebar ── */}
      <div className="hidden md:block md:w-64 md:h-screen md:flex-shrink-0 md:sticky md:top-0">
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 bg-white md:min-h-screen overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 md:py-6">
          
          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/my-workspace/${workspaceId}`)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <FaArrowLeft className="text-gray-500" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <FaUsers className="text-sm" style={{ color: brandColor }} /> Members
                </h1>
                <p className="text-sm text-gray-500">
                  {members.length} active members
                </p>
              </div>
            </div>
            {isOwner && pendingRequests.length > 0 && (
              <button
                onClick={() => setActiveTab('pending')}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                <FaUserPlus className="text-xs" /> {pendingRequests.length} Pending
              </button>
            )}
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-6 border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('active')}
              className={`pb-2 text-sm font-medium transition ${
                activeTab === 'active'
                  ? 'border-b-2 text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              style={activeTab === 'active' ? { borderColor: brandColor } : {}}
            >
              Active Members ({members.length})
            </button>
            {isOwner && (
              <button
                onClick={() => setActiveTab('pending')}
                className={`pb-2 text-sm font-medium transition ${
                  activeTab === 'pending'
                    ? 'border-b-2 text-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                style={activeTab === 'pending' ? { borderColor: brandColor } : {}}
              >
                Pending ({pendingRequests.length})
              </button>
            )}
          </div>

          {/* ── Search ── */}
          <div className="relative mb-6">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search members by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              style={{ '--tw-ring-color': brandColor }}
              onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
            />
          </div>

          {/* ── Active Members Tab ── */}
          {activeTab === 'active' && (
            <div className="space-y-1">
              {filteredMembers.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FaUsers className="text-3xl mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No members found</p>
                  {searchQuery && <p className="text-xs mt-1">Try a different search term</p>}
                </div>
              ) : (
                filteredMembers.map((member) => (
                  <MemberCard
                    key={member.user?._id || member._id}
                    member={member}
                    workspaceId={{ _id: workspaceId, owner: workspace.owner }}
                    isOwner={isOwner}
                    brandColor={brandColor}
                    onUpdate={(m) => {
                      setSelectedMember({ ...m, workspaceId });
                      setShowUpdateModal(true);
                    }}
                    onRemove={handleRemoveMember}
                  />
                ))
              )}
            </div>
          )}

          {/* ── Pending Requests Tab ── */}
          {activeTab === 'pending' && isOwner && (
            <div className="space-y-1">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FaUserPlus className="text-3xl mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No pending requests</p>
                </div>
              ) : (
                pendingRequests.map((request) => (
                  <PendingRequestCard
                    key={request.user?._id || request._id}
                    request={request}
                    onApproveClick={handleApproveClick}
                    onRejectClick={handleReject}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Navigation ── */}
      <MyWorkspaceBottombar workspace={workspace} />

      {/* ── Update Modal ── */}
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

      {/* ── Approve Modal ── */}
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
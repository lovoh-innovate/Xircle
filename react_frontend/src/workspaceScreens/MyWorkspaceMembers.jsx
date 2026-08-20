// src/workspaceScreens/MyWorkspaceMembers.jsx
import React, { useState, useRef, useEffect } from 'react';
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
import { useCreateDirectChatMutation } from '../slices/messagingApiSlice';
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
  FaEllipsisV,
  FaChevronDown,
  FaComment,
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';

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

// ─── Custom Dropdown ─────────────────────────────────────────────────────
const CustomDropdown = ({ options, value, onChange, placeholder, label, brandColor }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600 transition"
      >
        <span className={selected ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
          {selected ? selected.label : placeholder || 'Select...'}
        </span>
        <FaChevronDown className={`text-gray-500 dark:text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#1e1e26] border border-gray-300 dark:border-gray-700/60 rounded-xl overflow-hidden max-h-60 overflow-y-auto shadow-lg">
          {options.map(o => (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 transition text-left text-gray-700 dark:text-gray-300 ${o.value === value ? 'bg-teal-50 dark:bg-[#0d9488]/10' : ''}`}
            >
              <span>{o.label}</span>
              {o.value === value && <FaCheck className="ml-auto text-xs" style={{ color: brandColor }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Confirm Modal ──────────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, onConfirm, onCancel, title, message, confirmLabel = 'Confirm', confirmColor = 'bg-red-600 hover:bg-red-700' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-sm w-full p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
            Cancel
          </button>
          <button onClick={onConfirm} className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition ${confirmColor}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Member Action Bottom Sheet (mobile) ──────────────────────────────
const MemberActionSheet = ({ isOpen, onClose, member, canManage, isOwner, onMakeAdmin, onRemoveAdmin, onRemoveMember, onDirectMessage, onEditRole, brandColor }) => {
  if (!isOpen || !member) return null;
  const user = member.user || {};
  const memberName = user.name || 'Unknown';
  const isSelf = user._id === member.currentUserId;
  const isWorkspaceOwner = user._id === member.workspaceOwnerId;

  const showMakeAdmin = canManage && member.role !== 'admin' && !isSelf && !isWorkspaceOwner;
  const showRemoveAdmin = canManage && member.role === 'admin' && !isSelf && !isWorkspaceOwner;
  const showRemoveMember = canManage && !isSelf && !isWorkspaceOwner;
  const showEditRole = canManage && !isSelf && !isWorkspaceOwner;
  const showDirectMessage = !isSelf;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#14141a] rounded-t-2xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700/60">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 text-sm font-medium">
            {memberName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{memberName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{member.role === 'admin' ? 'Admin' : 'Member'}</p>
          </div>
        </div>
        <div className="space-y-1">
          {showDirectMessage && (
            <button
              onClick={() => { onClose(); onDirectMessage(user._id); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
            >
              <FaComment className="text-sm" /> <span className="text-sm font-medium">Direct Message</span>
            </button>
          )}
          {showEditRole && (
            <button
              onClick={() => { onClose(); onEditRole(member); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition"
            >
              <FaEdit className="text-sm" /> <span className="text-sm font-medium">Edit Role/Dept</span>
            </button>
          )}
          {showMakeAdmin && (
            <button
              onClick={() => { onClose(); onMakeAdmin(user._id); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition"
            >
              <FaUserCog className="text-sm" /> <span className="text-sm font-medium">Make Admin</span>
            </button>
          )}
          {showRemoveAdmin && (
            <button
              onClick={() => { onClose(); onRemoveAdmin(user._id); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition"
            >
              <FaUserCog className="text-sm" /> <span className="text-sm font-medium">Remove Admin</span>
            </button>
          )}
          {showRemoveMember && (
            <button
              onClick={() => { onClose(); onRemoveMember(user._id); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
            >
              <FaTrashAlt className="text-sm" /> <span className="text-sm font-medium">Remove Member</span>
            </button>
          )}
        </div>
        <button onClick={onClose} className="w-full mt-3 py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/60 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Search Members Modal ──────────────────────────────────────────────
const SearchMembersModal = ({ isOpen, onClose, members, brandColor }) => {
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
    <div className="fixed inset-0 z-50 bg-white dark:bg-[#0b0b10] flex flex-col">
      <div className="flex items-center gap-2 px-3 h-14 border-b border-gray-200/60 dark:border-gray-800/60 bg-gray-50/80 dark:bg-[#14141a]/80 backdrop-blur-sm flex-shrink-0">
        <button onClick={onClose} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
          <FaArrowLeft className="text-sm" />
        </button>
        <div className="flex-1 bg-gray-100 dark:bg-[#1e1e26] rounded-2xl px-3 py-1.5 flex items-center gap-2 border border-gray-200 dark:border-gray-800/40 focus-within:border-teal-500 dark:focus-within:border-[#0d9488]/50 transition">
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
      <div className="flex-1 overflow-y-auto p-3">
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
          <div className="space-y-1.5">
            {filtered.map((member) => {
              const user = member.user || member;
              const isOnline = member.status === 'active';
              return (
                <div
                  key={user._id}
                  className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/40 hover:border-teal-500 dark:hover:border-[#0d9488]/40 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition cursor-pointer group"
                >
                  <div className="relative flex-shrink-0">
                    {user?.profile ? (
                      <img src={user.profile} alt={user.name} className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: brandColor }}
                      >
                        {getInitials(user.name)}
                      </div>
                    )}
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-[#0b0b10]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 dark:text-gray-200 truncate">
                      {user?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{user?.email || 'No email'}</p>
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

  const roleOptions = [
    { value: 'Admin', label: 'Admin' },
    { value: 'Member', label: 'Member' },
    { value: 'Staff', label: 'Staff' },
  ];

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
            <CustomDropdown
              label="Role"
              options={roleOptions}
              value={role}
              onChange={setRole}
              brandColor={brandColor}
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

// ─── Approve Member Modal ──────────────────────────────────────────────
const ApproveMemberModal = ({ isOpen, onClose, memberId, workspaceId, brandColor, onSuccess }) => {
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('Member');
  const [isLoading, setIsLoading] = useState(false);
  const [approveMember] = useApproveMemberMutation();

  const roleOptions = [
    { value: 'Admin', label: 'Admin' },
    { value: 'Member', label: 'Member' },
    { value: 'Staff', label: 'Staff' },
  ];

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
        role,
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
            <CustomDropdown
              label="Role"
              options={roleOptions}
              value={role}
              onChange={setRole}
              brandColor={brandColor}
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
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, confirmLabel: 'Confirm' });

  const { data: workspaceData, isLoading: workspaceLoading, error: workspaceError } = useGetWorkspaceQuery(workspaceId);
  const { data: membersData, isLoading: membersLoading, refetch: refetchMembers } = useGetMembersQuery(workspaceId, { pollingInterval: 3000 });
  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useGetPendingRequestsQuery(workspaceId, { pollingInterval: 3000 });

  const [rejectMember] = useRejectMemberMutation();
  const [removeMember] = useRemoveMemberMutation();
  const [updateMember] = useUpdateMemberMutation();
  const [createDirectChat] = useCreateDirectChatMutation();

  const handleReject = async (memberId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reject Join Request',
      message: 'Are you sure you want to reject this join request?',
      confirmLabel: 'Reject',
      onConfirm: async () => {
        try {
          await rejectMember({ workspaceId, memberId }).unwrap();
          toast.success('Request rejected');
          refetchPending();
          setConfirmModal({ isOpen: false });
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to reject');
          setConfirmModal({ isOpen: false });
        }
      },
    });
  };

  const handleRemoveMember = async (memberId, memberName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Member',
      message: `Are you sure you want to remove ${memberName || 'this member'}?`,
      confirmLabel: 'Remove',
      onConfirm: async () => {
        try {
          await removeMember({ workspaceId, memberId }).unwrap();
          toast.success('Member removed');
          refetchMembers();
          setConfirmModal({ isOpen: false });
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to remove');
          setConfirmModal({ isOpen: false });
        }
      },
    });
  };

  const handleApproveClick = (memberId) => {
    setApproveMemberId(memberId);
    setShowApproveModal(true);
  };

  const handleApproveSuccess = () => {
    refetchMembers();
    refetchPending();
  };

  const handleDirectMessage = async (userId) => {
    if (!userId) return;
    try {
      const result = await createDirectChat({ workspaceId, targetUserId: userId }).unwrap();
      navigate(`/workspace/${workspaceId}/chat/${result.chat._id}`);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to start direct chat');
    }
  };

  const handleMakeAdmin = async (userId) => {
    try {
      await updateMember({
        workspaceId,
        memberId: userId,
        role: 'Admin',
        department: selectedMember?.department || 'General',
      }).unwrap();
      toast.success('Member promoted to Admin');
      refetchMembers();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to make admin');
    }
  };

  const handleRemoveAdmin = async (userId) => {
    try {
      await updateMember({
        workspaceId,
        memberId: userId,
        role: 'Member',
        department: selectedMember?.department || 'General',
      }).unwrap();
      toast.success('Admin rights removed');
      refetchMembers();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to remove admin');
    }
  };

  const handleEditRole = (member) => {
    setSelectedMember({ ...member, workspaceId });
    setShowUpdateModal(true);
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

  // ─── MemberItem component for each row ──────────────────────────────
  const MemberItem = ({ member, isPending, user, memberId, isWorkspaceOwner, isCurrentUser, canAct }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (menuRef.current && !menuRef.current.contains(event.target)) {
          setMenuOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const memberForAction = {
      ...member,
      user,
      currentUserId: userInfo?._id,
      workspaceOwnerId: workspace?.owner?._id,
      role: member.role,
    };

    const handleRowClick = () => {
      if (isPending || isCurrentUser) return;
      setSelectedMember(memberForAction);
      setActionSheetOpen(true);
    };

    const toggleMenu = (e) => {
      e.stopPropagation();
      setMenuOpen(!menuOpen);
    };

    return (
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition-colors border-b border-gray-100 dark:border-gray-800/30 last:border-0">
        <div className="relative flex-shrink-0">
          {user?.profile ? (
            <img src={user.profile} alt={user.name} className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: brandColor }}
            >
              {getInitials(user?.name)}
            </div>
          )}
          {!isPending && member.status === 'active' && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-[#0f0f12]" />
          )}
        </div>

        <div
          className="flex-1 min-w-0 cursor-pointer md:cursor-default"
          onClick={window.innerWidth < 768 ? handleRowClick : undefined}
        >
          <div className="flex items-center flex-wrap gap-1">
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">
              {user?.name || 'Unknown'}
              {isCurrentUser && ' (You)'}
            </p>
            <div className="flex flex-wrap gap-1">
              {isPending && (
                <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded-full border border-yellow-200 dark:border-yellow-700/40">
                  Pending
                </span>
              )}
              {!isPending && isWorkspaceOwner && (
                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-700/40">
                  Owner
                </span>
              )}
              {!isPending && member.role && (
                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-700/40">
                  {member.role}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            <span className="truncate">{user?.email || 'No email'}</span>
            {member.department && <span className="hidden sm:inline">· {member.department}</span>}
          </div>
        </div>

        {!isPending && canAct && (
          <div className="relative flex-shrink-0 hidden md:block" ref={menuRef}>
            <button
              onClick={toggleMenu}
              className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"
            >
              <FaEllipsisV className="text-xs" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 bg-white dark:bg-[#1e1e26] rounded-xl shadow-lg border border-gray-200 dark:border-gray-800/60 min-w-[180px] z-10 py-1.5">
                <button
                  onClick={() => {
                    setSelectedMember({ ...member, workspaceId });
                    setShowUpdateModal(true);
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 hover:text-gray-900 dark:hover:text-white transition w-full"
                >
                  <FaEdit className="text-xs text-teal-600 dark:text-[#0d9488]" /> Edit Role/Dept
                </button>
                <button
                  onClick={() => { handleDirectMessage(user._id); setMenuOpen(false); }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition w-full"
                >
                  <FaComment className="text-xs" /> Direct Message
                </button>
                <button
                  onClick={() => { handleMakeAdmin(user._id); setMenuOpen(false); }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition w-full"
                >
                  <FaUserCog className="text-xs" /> Make Admin
                </button>
                <button
                  onClick={() => { handleRemoveAdmin(user._id); setMenuOpen(false); }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition w-full"
                >
                  <FaUserCog className="text-xs" /> Remove Admin
                </button>
                <button
                  onClick={() => { handleRemoveMember(user._id, user?.name); setMenuOpen(false); }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 transition w-full"
                >
                  <FaTrashAlt className="text-xs" /> Remove
                </button>
              </div>
            )}
          </div>
        )}

        {!isPending && !isCurrentUser && isOwner && (
          <div className="md:hidden flex-shrink-0 text-gray-400 dark:text-gray-500">
            <FaChevronDown className="text-xs" />
          </div>
        )}

        {isPending && isOwner && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => handleApproveClick(user._id)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white rounded-full hover:opacity-80 transition"
              style={{ backgroundColor: brandColor }}
            >
              <FaCheck className="text-[9px]" /> <span className="hidden xs:inline">Approve</span>
            </button>
            <button
              onClick={() => handleReject(user._id)}
              className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-full transition"
            >
              <FaTimes className="text-xs" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderMemberList = (list, type = 'active') => {
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
          <FaUsers className="text-4xl mb-2 opacity-30" />
          <p className="text-sm">{type === 'active' ? 'No members found' : 'No pending requests'}</p>
        </div>
      );
    }

    return list.map((item) => {
      const user = item.user || item;
      const member = item;
      const isPending = type === 'pending';
      const memberId = user._id || item._id;
      const isWorkspaceOwner = user._id === workspace?.owner?._id;
      const isCurrentUser = user._id === userInfo?._id;

      const canAct = isOwner && !isCurrentUser && !isWorkspaceOwner;

      return (
        <MemberItem
          key={memberId}
          member={member}
          isPending={isPending}
          user={user}
          memberId={memberId}
          isWorkspaceOwner={isWorkspaceOwner}
          isCurrentUser={isCurrentUser}
          canAct={canAct}
        />
      );
    });
  };

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      <SearchMembersModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        members={members}
        brandColor={brandColor}
      />

      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f0f12]/95 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-3 sm:px-4 h-12 sm:h-14">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => navigate(`/my-workspace/${workspaceId}`)}
                className="p-1.5 lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
              >
                <FaArrowLeft className="text-sm" />
              </button>
              <h1 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
                Members
              </h1>
              <span className="text-xs font-normal text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-[#1a1a24] px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-800/40 flex-shrink-0">
                {members.length}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"
              >
                <FaSearch className="text-sm" />
              </button>
              {isOwner && pendingRequests.length > 0 && (
                <button
                  onClick={() => setActiveTab('pending')}
                  className="text-xs text-white font-medium px-2 py-1 rounded-full flex items-center gap-1"
                  style={{ backgroundColor: brandColor }}
                >
                  <FaUserPlus className="text-[10px]" /> {pendingRequests.length}
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-4 px-3 sm:px-4 border-t border-gray-200/60 dark:border-gray-800/30">
            <button
              onClick={() => setActiveTab('active')}
              className={`pb-2 text-xs sm:text-sm font-medium transition ${
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
                className={`pb-2 text-xs sm:text-sm font-medium transition ${
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

        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f12] divide-y divide-gray-100 dark:divide-gray-800/30">
          {activeTab === 'active' && renderMemberList(members, 'active')}
          {activeTab === 'pending' && isOwner && renderMemberList(pendingRequests, 'pending')}
        </div>
      </div>

      <MyWorkspaceBottombar workspace={workspace} />

      <MemberActionSheet
        isOpen={actionSheetOpen}
        onClose={() => {
          setActionSheetOpen(false);
          setSelectedMember(null);
        }}
        member={selectedMember}
        canManage={isOwner}
        isOwner={isOwner}
        onMakeAdmin={handleMakeAdmin}
        onRemoveAdmin={handleRemoveAdmin}
        onRemoveMember={handleRemoveMember}
        onDirectMessage={handleDirectMessage}
        onEditRole={handleEditRole}
        brandColor={brandColor}
      />

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

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onConfirm={confirmModal.onConfirm || (() => {})}
        onCancel={() => setConfirmModal({ isOpen: false })}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel || 'Confirm'}
        confirmColor="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
};

export default MyWorkspaceMembers;
// src/components/GeneralBottombar.jsx
import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  FaHome,
  FaTasks,
  FaCommentDots,
  FaHashtag,
  FaPlus,
  FaTimes,
  FaBars,
  FaCog,
  FaUser,
  FaUpload,
} from 'react-icons/fa';
import { useCreatePersonalTaskMutation } from '../slices/personalTaskApiSlice';
import { toast } from 'react-toastify';

const GeneralBottombar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const isAdmin = userInfo?.role === 'admin' || userInfo?.role === 'super_admin';

  const [showModal, setShowModal] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  const [createPersonalTask] = useCreatePersonalTaskMutation();

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setLoading(true);
    try {
      await createPersonalTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: dueDate || undefined,
      }).unwrap();
      toast.success('✨ Personal task created!');
      setShowModal(false);
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  // Home active only on /my-workspaces
  const isHomeActive = () => location.pathname === '/my-workspaces';

  // ─── Drawer items ──────────────────────────────────────────────
  const drawerItems = [
    { to: '/channels', icon: FaHashtag, label: 'Channels' },
    ...(isAdmin ? [{ to: '/admin/upload', icon: FaUpload, label: 'Upload App' }] : []),
    // Add more items here later (e.g. Settings, Profile)
  ];

  return (
    <>
      {/* ─── Bottom Bar ───────────────────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f0f12]/80 backdrop-blur-2xl border-t border-white/10 flex items-center justify-around h-16 px-2 z-50">
        {/* Home */}
        <NavLink
          to="/my-workspaces"
          className={() =>
            `flex flex-col items-center justify-center text-xs font-medium transition-all duration-300 ${
              isHomeActive() ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
            }`
          }
        >
          <FaHome className="text-xl" />
          <span>Home</span>
        </NavLink>

        {/* Tasks */}
        <NavLink
          to="/personal-tasks"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center text-xs font-medium transition-all duration-300 ${
              isActive ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
            }`
          }
        >
          <FaTasks className="text-xl" />
          <span>Tasks</span>
        </NavLink>

        {/* + Button */}
        <div className="relative -mt-8">
          <div className="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping" />
          <button
            onClick={() => setShowModal(true)}
            className="relative w-14 h-14 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:shadow-[0_0_50px_rgba(6,182,212,0.8)] transition-all duration-300 text-white"
          >
            <FaPlus className="text-2xl" />
          </button>
        </div>

        {/* Chats */}
        <NavLink
          to="/chat"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center text-xs font-medium transition-all duration-300 ${
              isActive ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
            }`
          }
        >
          <FaCommentDots className="text-xl" />
          <span>Chats</span>
        </NavLink>

        {/* More (hamburger) */}
        <button
          onClick={() => setShowDrawer(true)}
          className="flex flex-col items-center justify-center text-xs font-medium text-gray-400 hover:text-white transition-all duration-300"
        >
          <FaBars className="text-xl" />
          <span>More</span>
        </button>
      </div>

      {/* ─── Bottom Drawer ────────────────────────────────────────── */}
      {showDrawer && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowDrawer(false)}
        >
          <div className="w-full max-w-md rounded-t-2xl bg-[#14141a]/95 backdrop-blur-2xl border-t border-white/10 shadow-2xl shadow-cyan-500/10 p-4 pb-8 transition-transform duration-300 ease-out">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-gray-300">Menu</h3>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition"
              >
                <FaTimes className="text-lg" />
              </button>
            </div>

            <div className="space-y-1">
              {drawerItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setShowDrawer(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <Icon className="text-lg" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>

            {/* Divider + extra links (optional) */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <NavLink
                to="/settings"
                onClick={() => setShowDrawer(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <FaCog className="text-lg" />
                <span>Settings</span>
              </NavLink>
              <NavLink
                to="/profile"
                onClick={() => setShowDrawer(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <FaUser className="text-lg" />
                <span>Profile</span>
              </NavLink>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create Task Modal ────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-[#14141a]/90 backdrop-blur-2xl border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl shadow-cyan-500/20">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
                <FaTasks className="text-cyan-400" />
                New Personal Task
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition"
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-xl focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none text-sm text-white placeholder-gray-500 transition"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-xl focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none text-sm text-white placeholder-gray-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-xl focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none text-sm text-white transition"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Due Date</label>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-xl focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none text-sm text-white transition"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 border border-white/10 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl text-sm font-medium transition hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default GeneralBottombar;
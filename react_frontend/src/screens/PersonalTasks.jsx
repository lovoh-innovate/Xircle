// pages/PersonalTasks.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  useGetPersonalTasksQuery,
  useGetPersonalFoldersQuery,
  useCreatePersonalTaskMutation,
  useUpdatePersonalTaskMutation,
  useArchivePersonalTaskMutation,
  useRestorePersonalTaskMutation,
  useDeletePersonalTaskMutation,
  useCreatePersonalFolderMutation,
  useUpdatePersonalFolderMutation,
  useDeletePersonalFolderMutation,
  // we'll add a reorder mutation later; for now we assume it exists
  // useReorderPersonalTasksMutation,
} from '../slices/personalTaskApiSlice';
import {
  useAddPersonalSubTaskMutation,
  useTogglePersonalSubTaskMutation,
  useDeletePersonalSubTaskMutation,
} from '../slices/taskApiSlice';
import toast from 'react-hot-toast';
import {
  FaPlus,
  FaSpinner,
  FaTasks,
  FaFolder,
  FaFolderOpen,
  FaTrashAlt,
  FaArchive,
  FaUndo,
  FaEdit,
  FaTimes,
  FaCheck,
  FaExclamationCircle,
  FaRedo,
  FaCalendarAlt,
  FaChevronDown,
  FaChevronUp,
  FaSortAmountDown,
  FaSortAmountUp,
  FaAngleDown,
  FaGripVertical,
} from 'react-icons/fa';
import { motion } from 'framer-motion';
import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';

// ─── Custom Select Dropdown ──────────────────────────────────────────
const CustomSelect = ({
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-all focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none whitespace-nowrap"
      >
        {Icon && <Icon className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0" />}
        <span className="truncate flex-1 text-left">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <FaAngleDown className={`text-[8px] text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-full w-max min-w-[140px] bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-50 max-h-48 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition whitespace-nowrap ${
                option.value === value
                  ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'
              }`}
            >
              {option.icon && <span className="text-[10px] flex-shrink-0">{option.icon}</span>}
              <span>{option.label}</span>
              {option.value === value && (
                <FaCheck className="ml-auto text-[10px] text-teal-500 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Bottom Sheet ──────────────────────────────────────────────────
const BottomSheet = ({ isOpen, onClose, children }) => {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else if (visible) {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: animating ? 0 : '100%', opacity: animating ? 1 : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full md:max-w-md md:rounded-2xl rounded-t-2xl bg-white dark:bg-[#1a1a1a] shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
};

// ─── Confirm Modal ──────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, danger = false }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'}`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Task Form Component ──────────────────────────────────────────
const TaskForm = ({ task, folders, onSave, onCancel, isEditing, isLoading }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');
  const [dailyReminderTime, setDailyReminderTime] = useState(task?.dailyReminderTime || '');
  const [folderId, setFolderId] = useState(task?.folder?._id || task?.folder || '');
  const [recurrenceType, setRecurrenceType] = useState(task?.recurrenceType || 'none');
  const [recurrenceDays, setRecurrenceDays] = useState(task?.recurrenceDays || []);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    task?.recurrenceEndDate ? new Date(task.recurrenceEndDate).toISOString().slice(0, 16) : ''
  );

  // ── Collapsible details state ──────────────────────────────────────
  const [showDetails, setShowDetails] = useState(isEditing); // editing shows all, creation hides

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDay = (day) => {
    if (recurrenceDays.includes(day)) {
      setRecurrenceDays(recurrenceDays.filter(d => d !== day));
    } else {
      setRecurrenceDays([...recurrenceDays, day].sort());
    }
  };

  const setDueDatePreset = (preset) => {
    const now = new Date();
    let target = new Date(now);
    switch (preset) {
      case '1 hour': target.setHours(now.getHours() + 1); break;
      case 'Today': break;
      case '2 days': target.setDate(now.getDate() + 2); break;
      case '1 month': target.setMonth(now.getMonth() + 1); break;
      case '2 months': target.setMonth(now.getMonth() + 2); break;
      case '6 months': target.setMonth(now.getMonth() + 6); break;
      default: return;
    }
    setDueDate(target.toISOString().slice(0, 16));
  };

  const setEndDatePreset = (preset) => {
    const now = new Date();
    let target = new Date(now);
    switch (preset) {
      case '1 hour': target.setHours(now.getHours() + 1); break;
      case 'Today': break;
      case '2 days': target.setDate(now.getDate() + 2); break;
      case '1 month': target.setMonth(now.getMonth() + 1); break;
      case '2 months': target.setMonth(now.getMonth() + 2); break;
      case '6 months': target.setMonth(now.getMonth() + 6); break;
      default: return;
    }
    setRecurrenceEndDate(target.toISOString().slice(0, 16));
  };

  const handleRecurrenceChange = (type) => {
    setRecurrenceType(type);
    if (type !== 'weekly') setRecurrenceDays([]);
    if (type !== 'none') setDueDate('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    const payload = {
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: dueDate || null,
      dailyReminderTime: dailyReminderTime || null,
      folderId: folderId || null,
      recurrenceType,
      recurrenceDays: recurrenceType === 'weekly' ? recurrenceDays : [],
      recurrenceEndDate: recurrenceEndDate || null,
    };
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          {isEditing ? 'Edit Task' : 'New Personal Task'}
        </h2>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
          <FaTimes />
        </button>
      </div>

      {/* ── Title (always visible) ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white placeholder-gray-400"
          required
        />
      </div>

      {/* ── Toggle Details ── */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition"
      >
        <FaAngleDown className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        {showDetails ? 'Hide details' : 'Add more details'}
      </button>

      {/* ── Details (collapsible) ── */}
      {showDetails && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white placeholder-gray-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Folder</label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
              >
                <option value="">No Folder</option>
                {folders.map((f) => (
                  <option key={f._id} value={f._id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
            {recurrenceType === 'none' ? (
              <>
                <div className="flex flex-wrap gap-2 mb-2">
                  {['1 hour', 'Today', '2 days', '1 month', '2 months', '6 months'].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setDueDatePreset(label)}
                      className="px-3 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition"
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDueDate('')}
                    className="px-3 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/40 transition"
                  >
                    Clear
                  </button>
                </div>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
                />
              </>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 p-2 bg-gray-50 dark:bg-[#2a2a2a] rounded-xl">
                Due date is determined by recurrence pattern
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Daily Reminder Time (HH:MM)</label>
            <input
              type="time"
              value={dailyReminderTime}
              onChange={(e) => setDailyReminderTime(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
            />
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recurrence</label>
            <select
              value={recurrenceType}
              onChange={(e) => handleRecurrenceChange(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
            >
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          {recurrenceType === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Repeat on</label>
              <div className="flex flex-wrap gap-2">
                {weekDays.map((day, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      recurrenceDays.includes(idx)
                        ? 'bg-teal-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(recurrenceType === 'daily' || recurrenceType === 'weekly') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date (optional)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {['1 hour', 'Today', '2 days', '1 month', '2 months', '6 months'].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setEndDatePreset(label)}
                    className="px-3 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition"
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRecurrenceEndDate('')}
                  className="px-3 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/40 transition"
                >
                  Clear
                </button>
              </div>
              <input
                type="datetime-local"
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
              />
            </div>
          )}
        </>
      )}

      {/* ── Action Buttons (always visible) ── */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 py-2 bg-teal-600 dark:bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition"
        >
          {isLoading ? <FaSpinner className="animate-spin mx-auto" /> : (isEditing ? 'Update' : 'Create')}
        </button>
      </div>
    </form>
  );
};

// ─── Folder Management Modal ──────────────────────────────────────
const FolderModal = ({ isOpen, onClose, folders, onSave, onDelete, isLoading }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4f46e5');
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  const reset = () => {
    setName('');
    setColor('#4f46e5');
    setEditingId(null);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Folder name is required');
      return;
    }
    onSave({ name: name.trim(), color }, editingId);
    reset();
  };

  const handleEdit = (folder) => {
    setName(folder.name);
    setColor(folder.color || '#4f46e5');
    setEditingId(folder._id);
  };

  const handleDelete = (folderId) => {
    setShowDeleteConfirm(folderId);
  };

  const confirmDelete = () => {
    onDelete(showDeleteConfirm);
    setShowDeleteConfirm(null);
    reset();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={() => { onClose(); reset(); }}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <FaFolder className="text-teal-500" /> Folders
          </h2>
          <button onClick={() => { onClose(); reset(); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
            <FaTimes />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Folder name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-12 h-12 rounded-xl cursor-pointer border border-gray-200 dark:border-gray-700"
          />
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 bg-teal-600 dark:bg-teal-500 text-white rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition"
          >
            {isLoading ? <FaSpinner className="animate-spin" /> : (editingId ? 'Update' : 'Add')}
          </button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {folders.map((folder) => (
            <div key={folder._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#2a2a2a] rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: folder.color || '#4f46e5' }} />
                <span className="text-gray-800 dark:text-white font-medium">{folder.name}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(folder)} className="text-gray-400 hover:text-teal-500 transition">
                  <FaEdit />
                </button>
                <button onClick={() => handleDelete(folder._id)} className="text-gray-400 hover:text-red-500 transition">
                  <FaTrashAlt />
                </button>
              </div>
            </div>
          ))}
          {folders.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No folders yet</p>
          )}
        </div>

        <ConfirmModal
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={confirmDelete}
          title="Delete Folder"
          message="All tasks in this folder will be unlinked. Are you sure?"
          danger
        />
      </div>
    </BottomSheet>
  );
};

// ─── Task Card ────────────────────────────────────────────────────
// Collapsed by default: only drag handle, checkbox, title row, chevron.
// Everything else — description, dates, subtasks, action icons — lives
// behind the chevron so only one card's worth of info shows at a time.
const TaskCard = React.memo(({
  task,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  onStatusToggle,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');

  const priorityDots = {
    low: 'bg-blue-400',
    medium: 'bg-yellow-400',
    high: 'bg-orange-400',
    urgent: 'bg-red-400',
  };

  const statusColors = {
    pending: 'text-gray-500 dark:text-gray-400',
    'in-progress': 'text-blue-500 dark:text-blue-400',
    completed: 'text-green-500 dark:text-green-400',
    archived: 'text-purple-500 dark:text-purple-400',
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
  const subtasks = task.subtasks || [];

  const handleAddSubtaskSubmit = (e) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    onAddSubtask(task._id, newSubtask.trim());
    setNewSubtask('');
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task._id)}
      onDragOver={(e) => onDragOver(e, task._id)}
      onDrop={(e) => onDrop(e, task._id)}
      onDragEnd={onDragEnd}
      className={`bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition-colors ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="px-3 sm:px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Drag handle */}
          <div className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition p-0.5 flex-shrink-0">
            <FaGripVertical className="text-sm" />
          </div>

          {/* Status checkbox — checked when the task is done */}
          <button
            onClick={() => onStatusToggle(task._id, task.status === 'completed' ? 'pending' : 'completed')}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
              task.status === 'completed'
                ? 'bg-teal-500 border-teal-500 text-white'
                : 'border-gray-300 dark:border-gray-600 hover:border-teal-500'
            }`}
          >
            {task.status === 'completed' && <FaCheck className="text-[10px]" />}
          </button>

          {/* Title row — collapsed default view */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 min-w-0 flex items-center gap-2 text-left"
          >
            <span className={`font-medium text-sm text-gray-800 dark:text-white truncate ${task.status === 'completed' ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
              {task.title}
            </span>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityDots[task.priority] || 'bg-gray-400'}`} />
            {task.recurrenceType && task.recurrenceType !== 'none' && (
              <FaRedo className="flex-shrink-0 text-[9px] text-teal-500 dark:text-teal-400" />
            )}
            {isOverdue && (
              <FaExclamationCircle className="flex-shrink-0 text-[9px] text-red-500" />
            )}
            {subtasks.length > 0 && (
              <span className="flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
                {subtasks.filter((st) => st.done).length}/{subtasks.length}
              </span>
            )}
          </button>

          {/* Chevron — reveals everything else */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
          >
            {expanded ? <FaChevronUp className="text-xs" /> : <FaChevronDown className="text-xs" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3 pl-8">
            {/* ── Basic details ── */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-medium ${statusColors[task.status] || 'text-gray-500'}`}>
                {task.status === 'in-progress' ? 'In Progress' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
              </span>
              {task.folder && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <FaFolder className="text-[9px] text-teal-500" /> {task.folder.name}
                </span>
              )}
              {task.dueDate && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <FaCalendarAlt className="text-[9px]" /> {formatDate(task.dueDate)}
                </span>
              )}
            </div>

            {task.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{task.description}</p>
            )}

            {task.dailyReminderTime && (
              <div className="text-xs">
                <span className="font-medium text-gray-600 dark:text-gray-400">Daily reminder:</span>{' '}
                <span className="text-gray-500 dark:text-gray-400">{task.dailyReminderTime}</span>
              </div>
            )}

            {task.recurrenceType !== 'none' && (
              <div className="text-xs">
                <span className="font-medium text-gray-600 dark:text-gray-400">Recurrence:</span>{' '}
                <span className="text-gray-500 dark:text-gray-400">
                  {task.recurrenceType === 'daily' ? 'Daily' : `Weekly on ${task.recurrenceDays?.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}`}
                </span>
                {task.recurrenceEndDate && (
                  <span className="text-gray-400 dark:text-gray-500 ml-1">until {formatDate(task.recurrenceEndDate)}</span>
                )}
              </div>
            )}

            {/* ── Subtasks ── */}
            <div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Subtasks</span>
              <ul className="mt-1 space-y-1">
                {subtasks.map((st, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleSubtask(task._id, idx, st.done)}
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                        st.done
                          ? 'bg-teal-500 border-teal-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 hover:border-teal-500'
                      }`}
                    >
                      {st.done && <FaCheck className="text-[8px]" />}
                    </button>
                    <span className={`text-xs flex-1 truncate ${st.done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                      {st.title}
                    </span>
                    <button
                      onClick={() => onDeleteSubtask(task._id, idx)}
                      className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition flex-shrink-0"
                    >
                      <FaTimes className="text-[10px]" />
                    </button>
                  </li>
                ))}
                {subtasks.length === 0 && (
                  <li className="text-xs text-gray-400 dark:text-gray-500">No subtasks yet</li>
                )}
              </ul>
              <form onSubmit={handleAddSubtaskSubmit} className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  placeholder="Add subtask..."
                  className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-800 dark:text-white placeholder-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 bg-teal-600 dark:bg-teal-500 text-white rounded-lg hover:bg-teal-700 dark:hover:bg-teal-600 transition flex-shrink-0"
                >
                  <FaPlus className="text-[10px]" />
                </button>
              </form>
            </div>

            {/* ── Actions ── */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onEdit(task)}
                className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Edit"
              >
                <FaEdit className="text-xs" />
              </button>
              {task.isArchived ? (
                <button
                  onClick={() => onRestore(task._id)}
                  className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Restore"
                >
                  <FaUndo className="text-xs" />
                </button>
              ) : (
                <button
                  onClick={() => onArchive(task._id)}
                  className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Archive"
                >
                  <FaArchive className="text-xs" />
                </button>
              )}
              <button
                onClick={() => onDelete(task._id)}
                className="p-1.5 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Delete"
              >
                <FaTrashAlt className="text-xs" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Main Component ──────────────────────────────────────────────
const PersonalTasks = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filters, setFilters] = useState({
    folderId: '',
    status: '',
    priority: '',
    archived: false,
  });
  const [sortOrder, setSortOrder] = useState('desc');

  // ─── Query / Mutations ──────────────────────────────────────────────
  const {
    data: tasksData,
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useGetPersonalTasksQuery({
    folderId: filters.folderId || undefined,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    archived: filters.archived ? 'true' : undefined,
  });

  const {
    data: foldersData,
    isLoading: foldersLoading,
    refetch: refetchFolders,
  } = useGetPersonalFoldersQuery();

  const tasks = tasksData?.tasks || [];
  const folders = foldersData?.folders || [];

  const [createTask, { isLoading: isCreating }] = useCreatePersonalTaskMutation();
  const [updateTask, { isLoading: isUpdating }] = useUpdatePersonalTaskMutation();
  const [archiveTask, { isLoading: isArchiving }] = useArchivePersonalTaskMutation();
  const [restoreTask, { isLoading: isRestoring }] = useRestorePersonalTaskMutation();
  const [deleteTask, { isLoading: isDeleting }] = useDeletePersonalTaskMutation();
  const [createFolder, { isLoading: isCreatingFolder }] = useCreatePersonalFolderMutation();
  const [updateFolder, { isLoading: isUpdatingFolder }] = useUpdatePersonalFolderMutation();
  const [deleteFolder, { isLoading: isDeletingFolder }] = useDeletePersonalFolderMutation();

  // ─── Subtask mutations ──────────────────────────────────────────────
  const [addSubtask] = useAddPersonalSubTaskMutation();
  const [toggleSubtask] = useTogglePersonalSubTaskMutation();
  const [deleteSubtaskMutation] = useDeletePersonalSubTaskMutation();

  const [confirmDelete, setConfirmDelete] = useState(null);

  // ─── Local state for optimistic reordering ──────────────────────────
  const [localTasks, setLocalTasks] = useState([]);

  // ─── Drag state ─────────────────────────────────────────────────────
  const [draggedId, setDraggedId] = useState(null);

  // ─── Update local tasks when server data arrives ──────────────────
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  // ─── Handlers (stabilised with useCallback) ──────────────────────

  const handleCreateTask = useCallback(async (payload) => {
    try {
      await createTask(payload).unwrap();
      toast.success('Task created!');
      setShowCreateModal(false);
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create task');
    }
  }, [createTask, refetchTasks]);

  const handleUpdateTask = useCallback(async (payload) => {
    try {
      await updateTask({ taskId: editingTask._id, data: payload }).unwrap();
      toast.success('Task updated!');
      setShowCreateModal(false);
      setEditingTask(null);
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update task');
    }
  }, [updateTask, editingTask, refetchTasks]);

  const handleArchive = useCallback(async (taskId) => {
    try {
      await archiveTask(taskId).unwrap();
      toast.success('Task archived');
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to archive');
    }
  }, [archiveTask, refetchTasks]);

  const handleRestore = useCallback(async (taskId) => {
    try {
      await restoreTask(taskId).unwrap();
      toast.success('Task restored');
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to restore');
    }
  }, [restoreTask, refetchTasks]);

  const handleDelete = useCallback((taskId) => {
    setConfirmDelete(taskId);
  }, []);

  const confirmDeleteTask = useCallback(async () => {
    try {
      await deleteTask(confirmDelete).unwrap();
      toast.success('Task moved to trash');
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete');
    } finally {
      setConfirmDelete(null);
    }
  }, [deleteTask, confirmDelete, refetchTasks]);

  const handleStatusToggle = useCallback(async (taskId, newStatus) => {
    try {
      await updateTask({ taskId, data: { status: newStatus } }).unwrap();
      toast.success(`Task ${newStatus === 'completed' ? 'completed' : 'reopened'}`);
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update status');
    }
  }, [updateTask, refetchTasks]);

  const handleSaveFolder = useCallback(async (data, folderId) => {
    try {
      if (folderId) {
        await updateFolder({ folderId, data }).unwrap();
        toast.success('Folder updated');
      } else {
        await createFolder(data).unwrap();
        toast.success('Folder created');
      }
      refetchFolders();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to save folder');
    }
  }, [updateFolder, createFolder, refetchFolders]);

  const handleDeleteFolder = useCallback(async (folderId) => {
    try {
      await deleteFolder(folderId).unwrap();
      toast.success('Folder deleted');
      refetchFolders();
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete folder');
    }
  }, [deleteFolder, refetchFolders, refetchTasks]);

  // ─── Subtask handlers ────────────────────────────────────────────
  const handleAddSubtask = useCallback(async (taskId, title) => {
    try {
      await addSubtask({ taskId, data: { title } }).unwrap();
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to add subtask');
    }
  }, [addSubtask, refetchTasks]);

  const handleToggleSubtask = useCallback(async (taskId, subTaskIndex, currentDone) => {
    try {
      await toggleSubtask({ taskId, subTaskIndex, done: !currentDone }).unwrap();
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update subtask');
    }
  }, [toggleSubtask, refetchTasks]);

  const handleDeleteSubtask = useCallback(async (taskId, subTaskIndex) => {
    try {
      await deleteSubtaskMutation({ taskId, subTaskIndex }).unwrap();
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete subtask');
    }
  }, [deleteSubtaskMutation, refetchTasks]);

  // ─── Drag‑and‑drop handlers ────────────────────────────────────────
  const handleDragStart = useCallback((e, taskId) => {
    setDraggedId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(async (e, targetId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedId;
    setDraggedId(null);

    if (!sourceId || sourceId === targetId) return;

    const sourceIndex = localTasks.findIndex(t => t._id === sourceId);
    const targetIndex = localTasks.findIndex(t => t._id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const newOrder = [...localTasks];
    const [moved] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, moved);
    const orderedIds = newOrder.map(t => t._id);

    setLocalTasks(newOrder);

    try {
      const updatePromises = orderedIds.map((id, index) =>
        updateTask({ taskId: id, data: { order: index } }).unwrap()
      );
      await Promise.all(updatePromises);
      toast.success('Tasks reordered');
      refetchTasks();
    } catch (err) {
      toast.error('Failed to reorder tasks');
      setLocalTasks(tasks);
    }
  }, [draggedId, localTasks, tasks, updateTask, refetchTasks]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
  }, []);

  // ─── Memoised filtered and sorted tasks ────────────────────────────
  const displayedTasks = useMemo(() => {
    let filtered = localTasks.filter(task => {
      if (filters.folderId && task.folder?._id !== filters.folderId) return false;
      if (filters.status && task.status !== filters.status) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.archived && !task.isArchived) return false;
      if (!filters.archived && task.isArchived) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 0;
      const orderB = b.order !== undefined ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      const dateA = a.dueDate ? new Date(a.dueDate) : new Date(8640000000000000);
      const dateB = b.dueDate ? new Date(b.dueDate) : new Date(8640000000000000);
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    return filtered;
  }, [localTasks, filters, sortOrder]);

  // ─── Folder tab selection ──────────────────────────────────────────
  const handleTabClick = useCallback((folderId) => {
    setFilters(prev => ({ ...prev, folderId, archived: false }));
  }, []);

  const handleArchivedTabClick = useCallback(() => {
    setFilters(prev => ({ ...prev, archived: true, folderId: '' }));
  }, []);

  const handleAllTabClick = useCallback(() => {
    setFilters(prev => ({ ...prev, folderId: '', archived: false }));
  }, []);

  if (tasksLoading || foldersLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <FaSpinner className="animate-spin text-teal-500 text-3xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>

        <div className="flex-1 flex flex-col min-h-screen relative">
          {/* ─── Header ──────────────────────────────────────────── */}
          <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
            <div className="px-3 sm:px-6 h-12 flex items-center justify-between gap-2">
              <h1 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <FaTasks className="text-teal-500 text-sm" /> Personal Tasks
              </h1>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowFolderModal(true)}
                  className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <FaFolderOpen className="text-sm" />
                </button>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {sortOrder === 'asc' ? <FaSortAmountUp className="text-sm" /> : <FaSortAmountDown className="text-sm" />}
                </button>
              </div>
            </div>

            {/* ─── Folder Tabs (Chrome-style) ───────────────────── */}
            <div className="px-3 pb-1 flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
              <div
                onClick={handleAllTabClick}
                className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-t-lg cursor-pointer transition ${
                  !filters.archived && !filters.folderId
                    ? 'bg-gray-100 dark:bg-[#2a2a2a] text-teal-600 dark:text-teal-400 border-b-2 border-teal-500'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
                }`}
              >
                All
              </div>

              {folders.map((folder) => (
                <div
                  key={folder._id}
                  onClick={() => handleTabClick(folder._id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg cursor-pointer transition ${
                    filters.folderId === folder._id && !filters.archived
                      ? 'bg-gray-100 dark:bg-[#2a2a2a] text-teal-600 dark:text-teal-400 border-b-2 border-teal-500'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: folder.color || '#4f46e5' }}
                  />
                  {folder.name}
                </div>
              ))}

              <button
                onClick={() => setShowFolderModal(true)}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-teal-500 transition rounded-full hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"
              >
                <FaPlus className="text-xs" />
              </button>

              <div
                onClick={handleArchivedTabClick}
                className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-t-lg cursor-pointer transition ${
                  filters.archived
                    ? 'bg-gray-100 dark:bg-[#2a2a2a] text-purple-600 dark:text-purple-400 border-b-2 border-purple-500'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
                }`}
              >
                <FaArchive className="inline mr-1 text-[10px]" /> Archived
              </div>
            </div>
          </header>

          {/* ─── Task List ────────────────────────────────────────── */}
          <main className="flex-1 overflow-y-auto">
            {displayedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8">
                <FaTasks className="text-4xl mb-2 opacity-30" />
                <p className="text-sm font-medium">No tasks found</p>
                <p className="text-xs">Create a new task to get started.</p>
              </div>
            ) : (
              displayedTasks.map((task) => (
                <TaskCard
                  key={task._id}
                  task={task}
                  onEdit={(t) => {
                    setEditingTask(t);
                    setShowCreateModal(true);
                  }}
                  onArchive={handleArchive}
                  onRestore={handleRestore}
                  onDelete={handleDelete}
                  onStatusToggle={handleStatusToggle}
                  onAddSubtask={handleAddSubtask}
                  onToggleSubtask={handleToggleSubtask}
                  onDeleteSubtask={handleDeleteSubtask}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedId === task._id}
                />
              ))
            )}
          </main>

          <GeneralBottombar />

          {/* FAB */}
          <button
            onClick={() => {
              setEditingTask(null);
              setShowCreateModal(true);
            }}
            className="fixed right-4 sm:right-6 bottom-20 md:bottom-6 z-20 w-12 h-12 bg-teal-600 dark:bg-teal-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-teal-700 dark:hover:bg-teal-600 transition active:scale-95"
          >
            <FaPlus className="text-xl" />
          </button>
        </div>
      </div>

      {/* ─── Create/Edit Modal ───────────────────────────────────── */}
      <BottomSheet isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); setEditingTask(null); }}>
        <TaskForm
          task={editingTask}
          folders={folders}
          onSave={editingTask ? handleUpdateTask : handleCreateTask}
          onCancel={() => { setShowCreateModal(false); setEditingTask(null); }}
          isEditing={!!editingTask}
          isLoading={isCreating || isUpdating}
        />
      </BottomSheet>

      {/* ─── Folder Modal ────────────────────────────────────────── */}
      <FolderModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        folders={folders}
        onSave={handleSaveFolder}
        onDelete={handleDeleteFolder}
        isLoading={isCreatingFolder || isUpdatingFolder || isDeletingFolder}
      />

      {/* ─── Confirm Delete Modal ────────────────────────────────── */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteTask}
        title="Delete Task"
        message="This task will be moved to trash. It will be permanently deleted after 30 days."
        danger
      />
    </>
  );
};

export default PersonalTasks;
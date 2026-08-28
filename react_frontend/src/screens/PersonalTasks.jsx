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
} from '../slices/personalTaskApiSlice';
import {
  useAddPersonalSubTaskMutation,
  useTogglePersonalSubTaskMutation,
  useDeletePersonalSubTaskMutation,
  useUpdatePersonalSubTaskMutation,
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
  FaArrowLeft,
  FaClock,
  FaRegClock,
  FaTag,
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';

// ─── Custom Select Dropdown ──────────────────────────────────────────
const CustomSelect = ({ value, onChange, options, placeholder, icon: Icon, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const selected = options.find(opt => opt.value === value);
  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
      >
        {Icon && <Icon className="text-xs text-gray-400" />}
        <span className="flex-1 text-left truncate">{selected ? selected.label : placeholder}</span>
        <FaAngleDown className={`text-xs text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-full w-max bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-50 max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition ${
                opt.value === value ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'
              }`}
            >
              {opt.icon && <span className="text-xs">{opt.icon}</span>}
              <span>{opt.label}</span>
              {opt.value === value && <FaCheck className="ml-auto text-teal-500 text-xs" />}
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
    if (isOpen) { setVisible(true); requestAnimationFrame(() => setAnimating(true)); }
    else if (visible) { setAnimating(false); const t = setTimeout(() => setVisible(false), 300); return () => clearTimeout(t); }
  }, [isOpen, visible]);
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
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
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'}`}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

// ─── Task Detail View (full‑screen dedicated page look) ──────────
const TaskDetailView = ({ task, onBack, onUpdateTask, onAddSubtask, onToggleSubtask, onDeleteSubtask, onArchive, onRestore, onDelete, folders }) => {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingSubtaskIndex, setEditingSubtaskIndex] = useState(null);
  const [editSubtaskTitle, setEditSubtaskTitle] = useState('');
  const [editSubtaskDue, setEditSubtaskDue] = useState('');
  const [editSubtaskRecurrenceType, setEditSubtaskRecurrenceType] = useState('none');
  const [editSubtaskRecurrenceDays, setEditSubtaskRecurrenceDays] = useState([]);
  const [editSubtaskRecurrenceEnd, setEditSubtaskRecurrenceEnd] = useState('');
  const [updateSubTask] = useUpdatePersonalSubTaskMutation();

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return toast.error('Title required');
    setIsAdding(true);
    try {
      await onAddSubtask(task._id, { title: newSubtaskTitle.trim() });
      setNewSubtaskTitle('');
    } catch (err) { /* toast already */ }
    finally { setIsAdding(false); }
  };

  const handleToggle = (idx, currentDone) => {
    onToggleSubtask(task._id, idx, !currentDone);
  };

  const handleDeleteSubtask = (idx) => {
    if (window.confirm('Delete this subtask?')) onDeleteSubtask(task._id, idx);
  };

  const startEditing = (idx) => {
    const st = task.subtasks[idx];
    setEditingSubtaskIndex(idx);
    setEditSubtaskTitle(st.title);
    setEditSubtaskDue(st.dueDate ? new Date(st.dueDate).toISOString().slice(0, 16) : '');
    setEditSubtaskRecurrenceType(st.recurrenceType || 'none');
    setEditSubtaskRecurrenceDays(st.recurrenceDays || []);
    setEditSubtaskRecurrenceEnd(st.recurrenceEndDate ? new Date(st.recurrenceEndDate).toISOString().slice(0, 16) : '');
  };

  const saveEdit = async () => {
    if (!editSubtaskTitle.trim()) return toast.error('Title required');
    try {
      await updateSubTask({
        taskId: task._id,
        subTaskIndex: editingSubtaskIndex,
        data: {
          title: editSubtaskTitle.trim(),
          dueDate: editSubtaskDue || null,
          recurrenceType: editSubtaskRecurrenceType,
          recurrenceDays: editSubtaskRecurrenceType === 'weekly' ? editSubtaskRecurrenceDays : [],
          recurrenceEndDate: editSubtaskRecurrenceEnd || null,
        },
      }).unwrap();
      toast.success('Subtask updated');
      setEditingSubtaskIndex(null);
      onUpdateTask(task._id);
    } catch (err) {
      toast.error(err?.data?.message || 'Update failed');
    }
  };

  const cancelEdit = () => setEditingSubtaskIndex(null);

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const isOverdue = (due) => due && new Date(due) < new Date();

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0f0f12] overflow-hidden">
      {/* Header with back button */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f0f12] flex-shrink-0">
        <button onClick={onBack} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition">
          <FaArrowLeft className="text-lg" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white truncate">{task.title}</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            <span className="capitalize">{task.status}</span>
            {task.priority && <span className="capitalize">· {task.priority}</span>}
            {task.dueDate && (
              <span className={`flex items-center gap-1 ${isOverdue(task.dueDate) ? 'text-red-500' : ''}`}>
                <FaCalendarAlt className="text-[10px]" /> {formatDate(task.dueDate)}
              </span>
            )}
            {task.folder && <span className="flex items-center gap-1"><FaFolder className="text-[10px]" /> {task.folder.name}</span>}
            {task.recurrenceType && task.recurrenceType !== 'none' && (
              <span className="flex items-center gap-0.5 text-teal-600 dark:text-teal-400">
                <FaRedo className="text-[10px]" /> {task.recurrenceType === 'daily' ? 'Daily' : 'Weekly'}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {task.isArchived ? (
            <button onClick={() => onRestore(task._id)} className="p-2 text-gray-400 hover:text-teal-500 transition rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800" title="Restore"><FaUndo /></button>
          ) : (
            <button onClick={() => onArchive(task._id)} className="p-2 text-gray-400 hover:text-teal-500 transition rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800" title="Archive"><FaArchive /></button>
          )}
          <button onClick={() => onDelete(task._id)} className="p-2 text-gray-400 hover:text-red-500 transition rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800" title="Delete"><FaTrashAlt /></button>
        </div>
      </div>

      {/* Subtasks list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Subtasks</h3>
          <span className="text-xs text-gray-400 dark:text-gray-500">{task.subtasks?.length || 0}</span>
        </div>

        {(!task.subtasks || task.subtasks.length === 0) && (
          <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
            No subtasks yet. Add one below.
          </div>
        )}

        <div className="space-y-3">
          {task.subtasks?.map((st, idx) => {
            const isEditing = editingSubtaskIndex === idx;
            return (
              <div key={idx} className="border-b border-gray-100 dark:border-gray-800 pb-3 last:border-0">
                {!isEditing ? (
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggle(idx, st.done)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                        st.done ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-300 dark:border-gray-600 hover:border-teal-500'
                      }`}
                    >
                      {st.done && <FaCheck className="text-[10px]" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <span className={`text-sm text-gray-800 dark:text-white ${st.done ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                          {st.title}
                        </span>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <button onClick={() => startEditing(idx)} className="p-1 text-gray-400 hover:text-teal-500 transition rounded-lg" title="Edit">
                            <FaEdit className="text-xs" />
                          </button>
                          <button onClick={() => handleDeleteSubtask(idx)} className="p-1 text-gray-400 hover:text-red-500 transition rounded-lg" title="Delete">
                            <FaTrashAlt className="text-xs" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {st.dueDate && (
                          <span className={`flex items-center gap-1 ${isOverdue(st.dueDate) ? 'text-red-500' : ''}`}>
                            <FaRegClock className="text-[10px]" /> {formatDate(st.dueDate)}
                          </span>
                        )}
                        {st.recurrenceType && st.recurrenceType !== 'none' && (
                          <span className="flex items-center gap-0.5 text-teal-600 dark:text-teal-400">
                            <FaRedo className="text-[10px]" /> {st.recurrenceType === 'daily' ? 'Daily' : 'Weekly'}
                            {st.recurrenceDays?.length > 0 && ` (${st.recurrenceDays.map(d => weekDays[d]).join(', ')})`}
                          </span>
                        )}
                        {st.recurrenceEndDate && (
                          <span className="text-gray-400 dark:text-gray-500">until {formatDate(st.recurrenceEndDate)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editSubtaskTitle}
                      onChange={(e) => setEditSubtaskTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-white focus:border-teal-500 outline-none"
                      placeholder="Title"
                    />
                    <input
                      type="datetime-local"
                      value={editSubtaskDue}
                      onChange={(e) => setEditSubtaskDue(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-white focus:border-teal-500 outline-none"
                    />
                    <select
                      value={editSubtaskRecurrenceType}
                      onChange={(e) => { setEditSubtaskRecurrenceType(e.target.value); if (e.target.value !== 'weekly') setEditSubtaskRecurrenceDays([]); }}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-white focus:border-teal-500 outline-none"
                    >
                      <option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
                    </select>
                    {editSubtaskRecurrenceType === 'weekly' && (
                      <div className="flex flex-wrap gap-2">
                        {weekDays.map((d, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              if (editSubtaskRecurrenceDays.includes(i)) setEditSubtaskRecurrenceDays(editSubtaskRecurrenceDays.filter(x => x !== i));
                              else setEditSubtaskRecurrenceDays([...editSubtaskRecurrenceDays, i].sort());
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                              editSubtaskRecurrenceDays.includes(i) ? 'bg-teal-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    )}
                    {(editSubtaskRecurrenceType === 'daily' || editSubtaskRecurrenceType === 'weekly') && (
                      <input
                        type="datetime-local"
                        value={editSubtaskRecurrenceEnd}
                        onChange={(e) => setEditSubtaskRecurrenceEnd(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-white focus:border-teal-500 outline-none"
                        placeholder="End date"
                      />
                    )}
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="px-4 py-1.5 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition">Save</button>
                      <button onClick={cancelEdit} className="px-4 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add subtask form */}
        <form onSubmit={handleAddSubtask} className="mt-4 flex gap-2">
          <input
            type="text"
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            placeholder="Add subtask..."
            className="flex-1 px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
          />
          <button type="submit" disabled={isAdding} className="px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition disabled:opacity-50 flex items-center gap-1">
            {isAdding ? <FaSpinner className="animate-spin" /> : <FaPlus className="text-xs" />}
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Task Card (compact, used in list) ────────────────────────────
const TaskCard = React.memo(({ task, onClick }) => {
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric' });
  };
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
  const subtaskCount = task.subtasks?.length || 0;
  const doneCount = task.subtasks?.filter(st => st.done).length || 0;

  return (
    <div
      onClick={() => onClick(task)}
      className="bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800 dark:text-white truncate">{task.title}</span>
            {task.recurrenceType && task.recurrenceType !== 'none' && (
              <FaRedo className="text-[10px] text-teal-500 dark:text-teal-400 flex-shrink-0" />
            )}
            {isOverdue && <FaExclamationCircle className="text-xs text-red-500 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            <span className="capitalize">{task.status}</span>
            {task.dueDate && <span>{formatDate(task.dueDate)}</span>}
            {subtaskCount > 0 && <span>{doneCount}/{subtaskCount}</span>}
          </div>
        </div>
        <div className="flex-shrink-0 text-gray-300 dark:text-gray-600">
          <FaChevronDown className="text-xs" />
        </div>
      </div>
    </div>
  );
});

// ─── Folder Management Modal ──────────────────────────────────────
const FolderModal = ({ isOpen, onClose, folders, onSave, onDelete, isLoading }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4f46e5');
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  const reset = () => { setName(''); setColor('#4f46e5'); setEditingId(null); };
  const handleSave = () => {
    if (!name.trim()) { toast.error('Folder name required'); return; }
    onSave({ name: name.trim(), color }, editingId);
    reset();
  };
  const handleEdit = (folder) => { setName(folder.name); setColor(folder.color || '#4f46e5'); setEditingId(folder._id); };
  const handleDelete = (folderId) => setShowDeleteConfirm(folderId);
  const confirmDelete = () => { onDelete(showDeleteConfirm); setShowDeleteConfirm(null); reset(); };

  return (
    <BottomSheet isOpen={isOpen} onClose={() => { onClose(); reset(); }}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2"><FaFolder className="text-teal-500" /> Folders</h2>
          <button onClick={() => { onClose(); reset(); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"><FaTimes /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <input type="text" placeholder="Folder name..." value={name} onChange={(e) => setName(e.target.value)} className="flex-1 px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white" />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-12 rounded-xl cursor-pointer border border-gray-200 dark:border-gray-700" />
          <button onClick={handleSave} disabled={isLoading} className="px-4 py-2 bg-teal-600 dark:bg-teal-500 text-white rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition">{isLoading ? <FaSpinner className="animate-spin" /> : (editingId ? 'Update' : 'Add')}</button>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {folders.map((folder) => (
            <div key={folder._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#2a2a2a] rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: folder.color || '#4f46e5' }} />
                <span className="text-gray-800 dark:text-white font-medium">{folder.name}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(folder)} className="text-gray-400 hover:text-teal-500 transition"><FaEdit /></button>
                <button onClick={() => handleDelete(folder._id)} className="text-gray-400 hover:text-red-500 transition"><FaTrashAlt /></button>
              </div>
            </div>
          ))}
          {folders.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No folders yet</p>}
        </div>
        <ConfirmModal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} onConfirm={confirmDelete} title="Delete Folder" message="All tasks in this folder will be unlinked. Are you sure?" danger />
      </div>
    </BottomSheet>
  );
};

// ─── Task Form (used in bottom sheet for create/edit) ────────────
const TaskForm = ({ task, folders, onSave, onCancel, isEditing, isLoading }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');
  const [dailyReminderTime, setDailyReminderTime] = useState(task?.dailyReminderTime || '');
  const [folderId, setFolderId] = useState(task?.folder?._id || task?.folder || '');
  const [recurrenceType, setRecurrenceType] = useState(task?.recurrenceType || 'none');
  const [recurrenceDays, setRecurrenceDays] = useState(task?.recurrenceDays || []);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(task?.recurrenceEndDate ? new Date(task.recurrenceEndDate).toISOString().slice(0, 16) : '');
  const [showDetails, setShowDetails] = useState(isEditing);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDay = (day) => {
    if (recurrenceDays.includes(day)) setRecurrenceDays(recurrenceDays.filter(d => d !== day));
    else setRecurrenceDays([...recurrenceDays, day].sort());
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required'); return; }
    onSave({
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: dueDate || null,
      dailyReminderTime: dailyReminderTime || null,
      folderId: folderId || null,
      recurrenceType,
      recurrenceDays: recurrenceType === 'weekly' ? recurrenceDays : [],
      recurrenceEndDate: recurrenceEndDate || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">{isEditing ? 'Edit Task' : 'New Personal Task'}</h2>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"><FaTimes /></button>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white placeholder-gray-400" required />
      </div>
      <button type="button" onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition">
        <FaAngleDown className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        {showDetails ? 'Hide details' : 'Add more details'}
      </button>
      {showDetails && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white placeholder-gray-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white">
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Folder</label>
              <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white">
                <option value="">No Folder</option>
                {folders.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
            <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Daily Reminder Time (HH:MM)</label>
            <input type="time" value={dailyReminderTime} onChange={(e) => setDailyReminderTime(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recurrence</label>
            <select value={recurrenceType} onChange={(e) => { setRecurrenceType(e.target.value); if (e.target.value !== 'weekly') setRecurrenceDays([]); }} className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white">
              <option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
            </select>
          </div>
          {recurrenceType === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Repeat on</label>
              <div className="flex flex-wrap gap-2">
                {weekDays.map((day, idx) => (
                  <button key={idx} type="button" onClick={() => toggleDay(idx)} className={`px-3 py-1 rounded-full text-xs font-medium transition ${recurrenceDays.includes(idx) ? 'bg-teal-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>{day}</button>
                ))}
              </div>
            </div>
          )}
          {(recurrenceType === 'daily' || recurrenceType === 'weekly') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date (optional)</label>
              <input type="datetime-local" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white" />
            </div>
          )}
        </>
      )}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition">Cancel</button>
        <button type="submit" disabled={isLoading} className="flex-1 py-2 bg-teal-600 dark:bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition">{isLoading ? <FaSpinner className="animate-spin mx-auto" /> : (isEditing ? 'Update' : 'Create')}</button>
      </div>
    </form>
  );
};

// ─── Main Component ──────────────────────────────────────────────
const PersonalTasks = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filters, setFilters] = useState({ folderId: '', status: '', priority: '', archived: false });
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTaskId, setSelectedTaskId] = useState(null); // for detail view

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

  const [addSubtask] = useAddPersonalSubTaskMutation();
  const [toggleSubtask] = useTogglePersonalSubTaskMutation();
  const [deleteSubtaskMutation] = useDeletePersonalSubTaskMutation();

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [localTasks, setLocalTasks] = useState([]);
  useEffect(() => setLocalTasks(tasks), [tasks]);

  // ─── Handlers ──────────────────────────────────────────────────
  const handleCreateTask = async (payload) => {
    try {
      await createTask(payload).unwrap();
      toast.success('Task created!');
      setShowCreateModal(false);
      refetchTasks();
    } catch (err) { toast.error(err?.data?.message || 'Failed to create task'); }
  };
  const handleUpdateTask = async (payload) => {
    try {
      await updateTask({ taskId: editingTask._id, data: payload }).unwrap();
      toast.success('Task updated!');
      setShowCreateModal(false);
      setEditingTask(null);
      refetchTasks();
    } catch (err) { toast.error(err?.data?.message || 'Failed to update task'); }
  };
  const handleArchive = async (taskId) => {
    try { await archiveTask(taskId).unwrap(); toast.success('Archived'); refetchTasks(); if (selectedTaskId === taskId) setSelectedTaskId(null); } 
    catch (err) { toast.error(err?.data?.message || 'Failed to archive'); }
  };
  const handleRestore = async (taskId) => {
    try { await restoreTask(taskId).unwrap(); toast.success('Restored'); refetchTasks(); } 
    catch (err) { toast.error(err?.data?.message || 'Failed to restore'); }
  };
  const handleDelete = (taskId) => setConfirmDelete(taskId);
  const confirmDeleteTask = async () => {
    try { await deleteTask(confirmDelete).unwrap(); toast.success('Moved to trash'); refetchTasks(); setConfirmDelete(null); if (selectedTaskId === confirmDelete) setSelectedTaskId(null); } 
    catch (err) { toast.error(err?.data?.message || 'Failed to delete'); }
  };

  const handleStatusToggle = async (taskId, newStatus) => {
    try { await updateTask({ taskId, data: { status: newStatus } }).unwrap(); toast.success(`Task ${newStatus === 'completed' ? 'completed' : 'reopened'}`); refetchTasks(); } 
    catch (err) { toast.error(err?.data?.message || 'Failed to update status'); }
  };

  const handleSaveFolder = async (data, folderId) => {
    try {
      if (folderId) { await updateFolder({ folderId, data }).unwrap(); toast.success('Folder updated'); }
      else { await createFolder(data).unwrap(); toast.success('Folder created'); }
      refetchFolders();
    } catch (err) { toast.error(err?.data?.message || 'Failed to save folder'); }
  };
  const handleDeleteFolder = async (folderId) => {
    try { await deleteFolder(folderId).unwrap(); toast.success('Folder deleted'); refetchFolders(); refetchTasks(); } 
    catch (err) { toast.error(err?.data?.message || 'Failed to delete folder'); }
  };

  // Subtask handlers
  const handleAddSubtask = async (taskId, data) => {
    try { await addSubtask({ taskId, data }).unwrap(); refetchTasks(); } 
    catch (err) { toast.error(err?.data?.message || 'Failed to add subtask'); }
  };
  const handleToggleSubtask = async (taskId, subTaskIndex, done) => {
    try { await toggleSubtask({ taskId, subTaskIndex, done }).unwrap(); refetchTasks(); } 
    catch (err) { toast.error(err?.data?.message || 'Failed to toggle subtask'); }
  };
  const handleDeleteSubtask = async (taskId, subTaskIndex) => {
    try { await deleteSubtaskMutation({ taskId, subTaskIndex }).unwrap(); refetchTasks(); } 
    catch (err) { toast.error(err?.data?.message || 'Failed to delete subtask'); }
  };

  const handleTaskClick = (task) => setSelectedTaskId(task._id);
  const handleBackToList = () => setSelectedTaskId(null);

  const selectedTask = useMemo(() => tasks.find(t => t._id === selectedTaskId), [tasks, selectedTaskId]);

  // ─── Filtered tasks ────────────────────────────────────────────
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

  const handleTabClick = (folderId) => setFilters(prev => ({ ...prev, folderId, archived: false }));
  const handleArchivedTabClick = () => setFilters(prev => ({ ...prev, archived: true, folderId: '' }));
  const handleAllTabClick = () => setFilters(prev => ({ ...prev, folderId: '', archived: false }));

  if (tasksLoading || foldersLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0"><GeneralSidebar /></div>
        <div className="flex-1 flex items-center justify-center"><FaSpinner className="animate-spin text-teal-500 text-3xl" /></div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0"><GeneralSidebar /></div>

        <div className="flex-1 flex flex-col min-h-screen relative">
          {selectedTask ? (
            // ─── DETAIL VIEW (full‑screen, no header/tabs) ──────
            <TaskDetailView
              task={selectedTask}
              onBack={handleBackToList}
              onUpdateTask={refetchTasks}
              onAddSubtask={handleAddSubtask}
              onToggleSubtask={handleToggleSubtask}
              onDeleteSubtask={handleDeleteSubtask}
              onArchive={handleArchive}
              onRestore={handleRestore}
              onDelete={handleDelete}
              folders={folders}
            />
          ) : (
            // ─── LIST VIEW (header, tabs, list, bottom bar) ──────
            <>
              <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
                <div className="px-3 sm:px-6 h-12 flex items-center justify-between gap-2">
                  <h1 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                    <FaTasks className="text-teal-500 text-sm" /> Personal Tasks
                  </h1>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setShowFolderModal(true)} className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                      <FaFolderOpen className="text-sm" />
                    </button>
                    <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                      {sortOrder === 'asc' ? <FaSortAmountUp className="text-sm" /> : <FaSortAmountDown className="text-sm" />}
                    </button>
                  </div>
                </div>

                {/* Folder Tabs */}
                <div className="px-3 pb-1 flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
                  <div onClick={handleAllTabClick} className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-t-lg cursor-pointer transition ${!filters.archived && !filters.folderId ? 'bg-gray-100 dark:bg-[#2a2a2a] text-teal-600 dark:text-teal-400 border-b-2 border-teal-500' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'}`}>All</div>
                  {folders.map((folder) => (
                    <div key={folder._id} onClick={() => handleTabClick(folder._id)} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg cursor-pointer transition ${filters.folderId === folder._id && !filters.archived ? 'bg-gray-100 dark:bg-[#2a2a2a] text-teal-600 dark:text-teal-400 border-b-2 border-teal-500' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'}`}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: folder.color || '#4f46e5' }} />
                      {folder.name}
                    </div>
                  ))}
                  <button onClick={() => setShowFolderModal(true)} className="flex-shrink-0 p-1 text-gray-400 hover:text-teal-500 transition rounded-full hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"><FaPlus className="text-xs" /></button>
                  <div onClick={handleArchivedTabClick} className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-t-lg cursor-pointer transition ${filters.archived ? 'bg-gray-100 dark:bg-[#2a2a2a] text-purple-600 dark:text-purple-400 border-b-2 border-purple-500' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'}`}><FaArchive className="inline mr-1 text-[10px]" /> Archived</div>
                </div>
              </header>

              <main className="flex-1 overflow-y-auto">
                {displayedTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8">
                    <FaTasks className="text-4xl mb-2 opacity-30" />
                    <p className="text-sm font-medium">No tasks found</p>
                    <p className="text-xs">Create a new task to get started.</p>
                  </div>
                ) : (
                  displayedTasks.map((task) => (
                    <TaskCard key={task._id} task={task} onClick={handleTaskClick} />
                  ))
                )}
              </main>

              <GeneralBottombar />
            </>
          )}
        </div>
      </div>

      {/* ─── Modals (always rendered) ───────────────────────────── */}
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

      <FolderModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        folders={folders}
        onSave={handleSaveFolder}
        onDelete={handleDeleteFolder}
        isLoading={isCreatingFolder || isUpdatingFolder || isDeletingFolder}
      />

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteTask}
        title="Delete Task"
        message="This task will be moved to trash. It will be permanently deleted after 30 days."
        danger
      />

      {/* FAB (only visible when list view is active) */}
      {!selectedTask && (
        <button
          onClick={() => { setEditingTask(null); setShowCreateModal(true); }}
          className="fixed right-4 sm:right-6 bottom-20 md:bottom-6 z-20 w-12 h-12 bg-teal-600 dark:bg-teal-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-teal-700 dark:hover:bg-teal-600 transition active:scale-95"
        >
          <FaPlus className="text-xl" />
        </button>
      )}
    </>
  );
};

export default PersonalTasks;
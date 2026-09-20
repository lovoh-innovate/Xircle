  // src/components/MessageReferences.jsx
  import React from 'react';
  import { useNavigate } from 'react-router-dom';
  import {
    FaTasks,
    FaFolderOpen,
    FaStickyNote,
    FaClock,
    FaArrowRight,
  } from 'react-icons/fa';

  const ACCENT = {
    task: {
      icon: FaTasks,
      ring: 'border-teal-300/60 dark:border-teal-700/50',
      bg: 'bg-teal-50 dark:bg-teal-900/20',
      text: 'text-teal-700 dark:text-teal-300',
    },
    project: {
      icon: FaFolderOpen,
      ring: 'border-purple-300/60 dark:border-purple-700/50',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      text: 'text-purple-700 dark:text-purple-300',
    },
    note: {
      icon: FaStickyNote,
      ring: 'border-amber-300/60 dark:border-amber-700/50',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-700 dark:text-amber-300',
    },
    clockin: {
      icon: FaClock,
      ring: 'border-indigo-300/60 dark:border-indigo-700/50',
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
      text: 'text-indigo-700 dark:text-indigo-300',
    },
  };

  // ─────────────────────────────────────────────────────────────────────
  // MessageReferences
  //
  // Renders the tagged tasks / projects / notes / clock-ins attached to
  // a chat message. Each chip shows the label (task title, project name,
  // etc.) and, when available, a sublabel (project name for tasks).
  //
  // Tapping a chip navigates to the referenced entity. Read-only.
  // ─────────────────────────────────────────────────────────────────────
  const MessageReferences = ({ references, isOwn }) => {
    const navigate = useNavigate();

    if (!Array.isArray(references) || references.length === 0) return null;

    const handleClick = (ref) => (e) => {
      e.stopPropagation();
      if (ref.url) navigate(ref.url);
    };

    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {references.map((ref, i) => {
          const a = ACCENT[ref.type] || ACCENT.task;
          const Icon = a.icon;

          return (
            <button
              key={`${ref.type}-${ref.refId}-${i}`}
              type="button"
              onClick={handleClick(ref)}
              className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-md border ${a.ring} ${a.bg} ${a.text} text-[11px] font-medium hover:brightness-95 dark:hover:brightness-110 transition max-w-[240px] group`}
              title={ref.label}
            >
              <span className="w-5 h-5 rounded-sm flex items-center justify-center flex-shrink-0 bg-white/60 dark:bg-black/20">
                <Icon className="text-[9px]" />
              </span>

              <span className="min-w-0 text-left">
                <span className="block truncate leading-tight">
                  {ref.label}
                </span>
                {ref.sublabel && (
                  <span className="block truncate leading-tight opacity-75 text-[10px]">
                    {ref.sublabel}
                  </span>
                )}
              </span>

              <FaArrowRight className="text-[8px] opacity-0 group-hover:opacity-60 transition flex-shrink-0 ml-0.5" />
            </button>
          );
        })}
      </div>
    );
  };

  export default MessageReferences;
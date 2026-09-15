// src/workspaceScreens/MyWorkspaceProjectId.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  FaArrowLeft, FaSearch, FaPlus, FaFolder, FaTasks, FaUsers,
  FaEllipsisV, FaTimes, FaPen, FaLockOpen, FaArchive, FaTrashAlt,
  FaCopy, FaUndo, FaGripVertical, FaChevronRight, FaSpinner,
  FaMagic, FaRobot, FaFileAlt, FaHeartbeat, FaLightbulb, FaDownload,
  FaExclamationCircle, FaCheckCircle, FaExclamationTriangle, FaCheck,
  FaAngleDown,
} from 'react-icons/fa';
import { jsPDF } from 'jspdf';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetProjectByIdQuery } from '../slices/projectApiSlice';
import {
  useGetProjectTasksQuery,
  useGetProjectFoldersQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useMoveTaskMutation,
  useCopyTaskMutation,
  useArchiveTaskMutation,
  useRestoreTaskMutation,
  usePermanentlyDeleteTaskMutation,
  useCreateFolderMutation,
  useUpdateFolderMutation,
  useDeleteFolderMutation,
  useReorderTasksMutation,
} from '../slices/taskApiSlice';
import {
  usePlanWithAIMutation,
  useExecuteAIPlanMutation,
  useReviewProjectMutation,
  useSummarizeProjectMutation,
  useGenerateProjectDocsMutation,
} from '../slices/aiApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
import {
  ConfirmModal,
  DeleteTaskConfirmModal,
  FolderSelectModal,
  TaskCard,
  CreateTaskForm,
} from '../workspaceComponents/ProjectHelpers';

// ─── Media query hook ─────────────────────────────────────────────
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  return matches;
};

// ─── Search overlay ──────────────────────────────────────────────
const SearchOverlay = ({ isOpen, onClose, tasks, brandColor, onSelect }) => {
  const [q, setQ] = useState('');
  if (!isOpen) return null;
  const filtered = tasks.filter((t) => t.title?.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-[60] bg-white dark:bg-[#0b0b10]/95 backdrop-blur-xl flex flex-col">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200/60 dark:border-gray-800/60">
        <button onClick={onClose} className="p-1 text-gray-500"><FaArrowLeft /></button>
        <div className="flex-1 bg-gray-100 dark:bg-[#1e1e26] rounded-2xl px-4 py-2 flex items-center gap-3 border border-gray-200 dark:border-gray-800/40">
          <FaSearch className="text-gray-400 text-xs" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks..." autoFocus className="bg-transparent w-full outline-none text-sm text-gray-800 dark:text-gray-200" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {!q ? (
          <div className="text-center text-gray-400 mt-10">Search tasks</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">No results</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <div key={t._id} onClick={() => { onSelect(t._id); onClose(); }} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/40 cursor-pointer">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold" style={{ backgroundColor: brandColor }}>{t.title.charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{t.title}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// Professional PDF generator — Times, 12pt, justified body.
// ══════════════════════════════════════════════════════════════
const downloadDocsPDF = (doc) => {
  if (!doc) return;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  const PAGE_W = pdf.internal.pageSize.getWidth();
  const PAGE_H = pdf.internal.pageSize.getHeight();
  const MARGIN_X = 60;
  const MARGIN_TOP = 72;
  const MARGIN_BOTTOM = 72;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  const BODY_SIZE = 12;
  const BODY_LINE_H = 18;
  const TITLE_SIZE = 26;
  const SUB_SIZE = 13;
  const H1_SIZE = 16;
  const TABLE_SIZE = 10;
  const TABLE_LINE_H = 13;
  const FOOTER_SIZE = 10;

  const ACCENT = [13, 148, 136];
  const TEXT_DARK = [17, 17, 17];
  const TEXT_MUTED = [110, 110, 110];

  let y = MARGIN_TOP;
  let pageNum = 0;
  let onCover = true;

  const setFont = (style = 'normal', size = BODY_SIZE, color = TEXT_DARK) => {
    pdf.setFont('times', style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
  };

  const justifyLine = (line, xPos, yPos, width) => {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 2) { pdf.text(line, xPos, yPos); return; }
    const spaceW = pdf.getTextWidth(' ');
    const wordsW = words.reduce((s, w) => s + pdf.getTextWidth(w), 0);
    const natural = wordsW + spaceW * (words.length - 1);
    const extra = Math.max(0, width - natural);
    const add = extra / (words.length - 1);
    let cx = xPos;
    for (let i = 0; i < words.length; i++) {
      pdf.text(words[i], cx, yPos);
      cx += pdf.getTextWidth(words[i]);
      if (i < words.length - 1) cx += spaceW + add;
    }
  };

  const drawFooter = () => {
    if (onCover) return;
    setFont('normal', FOOTER_SIZE, TEXT_MUTED);
    pdf.text(String(pageNum), PAGE_W / 2, PAGE_H - 38, { align: 'center' });
    pdf.setDrawColor(...ACCENT);
    pdf.setLineWidth(0.8);
    pdf.line(PAGE_W / 2 - 8, PAGE_H - 50, PAGE_W / 2 + 8, PAGE_H - 50);
  };

  const newPage = () => {
    drawFooter();
    pdf.addPage();
    pageNum += 1;
    onCover = false;
    y = MARGIN_TOP;
  };

  const ensure = (h) => { if (y + h > PAGE_H - MARGIN_BOTTOM) newPage(); };

  const writeParagraph = (text, opts = {}) => {
    const { size = BODY_SIZE, style = 'normal', color = TEXT_DARK, align = 'left', lineH = size * 1.5, gap = 10, indent = 0 } = opts;
    setFont(style, size, color);
    const usableW = CONTENT_W - indent;
    const lines = pdf.splitTextToSize(String(text ?? ''), usableW);
    if (!lines.length) { y += gap; return; }
    for (let i = 0; i < lines.length; i++) {
      ensure(lineH);
      const line = lines[i];
      const isLast = i === lines.length - 1;
      const trimmed = line.trim();
      if (align === 'justify' && !isLast && trimmed.includes(' ')) {
        justifyLine(line, MARGIN_X + indent, y, usableW);
      } else if (align === 'center') {
        pdf.text(line, MARGIN_X + CONTENT_W / 2, y, { align: 'center' });
      } else if (align === 'right') {
        pdf.text(line, MARGIN_X + CONTENT_W, y, { align: 'right' });
      } else {
        pdf.text(line, MARGIN_X + indent, y);
      }
      y += lineH;
    }
    y += gap;
  };

  const writeHeading = (text, level = 1) => {
    const size = level === 1 ? H1_SIZE : 14;
    const lineH = size * 1.35;
    setFont('bold', size, TEXT_DARK);
    const lines = pdf.splitTextToSize(String(text ?? ''), CONTENT_W);
    lines.forEach((ln) => {
      ensure(lineH + 10);
      pdf.text(ln, MARGIN_X, y);
      y += lineH;
    });
    y += 2;
    pdf.setDrawColor(...ACCENT);
    pdf.setLineWidth(level === 1 ? 1.2 : 0.8);
    pdf.line(MARGIN_X, y, MARGIN_X + (level === 1 ? 70 : 42), y);
    y += level === 1 ? 14 : 10;
  };

  const writeBullets = (items) => {
    items.forEach((item) => {
      setFont('normal', BODY_SIZE, TEXT_DARK);
      const usableW = CONTENT_W - 22;
      const lines = pdf.splitTextToSize(String(item ?? ''), usableW);
      ensure(BODY_LINE_H);
      pdf.text('•', MARGIN_X + 4, y);
      lines.forEach((ln, i) => {
        ensure(BODY_LINE_H);
        const isLast = i === lines.length - 1;
        if (!isLast && ln.trim().includes(' ')) justifyLine(ln, MARGIN_X + 22, y, usableW);
        else pdf.text(ln, MARGIN_X + 22, y);
        y += BODY_LINE_H;
      });
      y += 4;
    });
    y += 6;
  };

  const writeTable = (headers, rows) => {
    if (!headers?.length || !rows?.length) return;
    const cols = headers.length;
    const colW = CONTENT_W / cols;
    const padX = 8;
    const padY = 7;
    const headerH = TABLE_SIZE + padY * 2 + 2;

    const drawHeader = () => {
      pdf.setFillColor(238, 243, 245);
      pdf.rect(MARGIN_X, y, CONTENT_W, headerH, 'F');
      setFont('bold', TABLE_SIZE, TEXT_DARK);
      headers.forEach((h, i) => {
        const lines = pdf.splitTextToSize(String(h ?? ''), colW - padX * 2);
        pdf.text(lines, MARGIN_X + i * colW + padX, y + padY + TABLE_SIZE);
      });
      y += headerH;
    };

    ensure(headerH + 4);
    drawHeader();

    rows.forEach((row, rowIdx) => {
      const cells = [...row];
      while (cells.length < cols) cells.push('');
      const cellLines = cells.map((c) => pdf.splitTextToSize(String(c ?? '').replace(/\s*\n\s*/g, ' '), colW - padX * 2));
      const maxLines = Math.max(1, ...cellLines.map((l) => l.length));
      const rowH = maxLines * TABLE_LINE_H + padY * 2;

      if (y + rowH > PAGE_H - MARGIN_BOTTOM) { newPage(); drawHeader(); }

      if (rowIdx % 2 === 1) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(MARGIN_X, y, CONTENT_W, rowH, 'F');
      }

      setFont('normal', TABLE_SIZE, TEXT_DARK);
      cellLines.forEach((lines, i) => {
        let cy = y + padY + TABLE_SIZE;
        lines.forEach((ln) => { pdf.text(ln, MARGIN_X + i * colW + padX, cy); cy += TABLE_LINE_H; });
      });

      pdf.setDrawColor(225, 228, 232);
      pdf.setLineWidth(0.5);
      pdf.line(MARGIN_X, y + rowH, MARGIN_X + CONTENT_W, y + rowH);
      y += rowH;
    });

    y += 12;
  };

  // Cover page
  pdf.setFillColor(238, 243, 245);
  pdf.rect(0, 0, PAGE_W, 8, 'F');
  pdf.setFillColor(...ACCENT);
  pdf.rect(0, 0, 170, 8, 'F');

  setFont('normal', 11, TEXT_MUTED);
  pdf.text('PROJECT DOCUMENTATION', MARGIN_X, 148);

  const title = doc.meta?.title || 'Untitled Project';
  setFont('bold', TITLE_SIZE, TEXT_DARK);
  let ty = 210;
  const titleLines = pdf.splitTextToSize(title, CONTENT_W);
  titleLines.forEach((ln) => { pdf.text(ln, MARGIN_X, ty); ty += TITLE_SIZE * 1.25; });

  if (doc.meta?.subtitle) {
    ty += 12;
    setFont('italic', SUB_SIZE, TEXT_MUTED);
    const subLines = pdf.splitTextToSize(doc.meta.subtitle, CONTENT_W);
    subLines.forEach((ln) => { pdf.text(ln, MARGIN_X, ty); ty += SUB_SIZE * 1.5; });
  }

  ty += 18;
  pdf.setDrawColor(...ACCENT);
  pdf.setLineWidth(3);
  pdf.line(MARGIN_X, ty, MARGIN_X + 90, ty);

  const metaY = PAGE_H - 200;
  setFont('normal', 10, TEXT_MUTED);
  pdf.text('PROJECT', MARGIN_X, metaY);
  setFont('bold', 13, TEXT_DARK);
  pdf.text(doc.meta?.projectName || '—', MARGIN_X, metaY + 20);

  setFont('normal', 10, TEXT_MUTED);
  pdf.text('VERSION', MARGIN_X, metaY + 52);
  setFont('bold', 13, TEXT_DARK);
  pdf.text(doc.meta?.version || '1.0', MARGIN_X, metaY + 72);

  setFont('normal', 10, TEXT_MUTED);
  pdf.text('GENERATED', MARGIN_X, metaY + 104);
  setFont('bold', 13, TEXT_DARK);
  pdf.text(new Date(doc.meta?.generatedAt || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), MARGIN_X, metaY + 124);

  if (doc.meta?.generatedBy) {
    setFont('normal', 10, TEXT_MUTED);
    pdf.text('BY', MARGIN_X, metaY + 156);
    setFont('bold', 13, TEXT_DARK);
    pdf.text(doc.meta.generatedBy, MARGIN_X, metaY + 176);
  }

  newPage();

  (doc.sections || []).forEach((section, sIdx) => {
    if (sIdx > 0) y += 8;
    ensure(34);
    writeHeading(section.heading, 1);
    (section.paragraphs || []).forEach((p) => {
      writeParagraph(p, { size: BODY_SIZE, style: 'normal', align: 'justify', lineH: BODY_LINE_H, gap: 10 });
    });
    if (section.bullets?.length) writeBullets(section.bullets);
    if (section.table?.headers?.length && section.table?.rows?.length) {
      writeTable(section.table.headers, section.table.rows);
    }
  });

  drawFooter();

  const safeName = (doc.meta?.projectName || 'project').replace(/[^\w\-]+/g, '_');
  pdf.save(`${safeName}_docs.pdf`);
};

// ══════════════════════════════════════════════════════════════
// AI Menu / Modals
// ══════════════════════════════════════════════════════════════
const AIMenu = ({ isOpen, onClose, canManage, brandColor, onPlan, onSummary, onReview, onDocs }) => {
  if (!isOpen) return null;
  const Item = ({ icon, label, sub, onClick, disabled }) => (
    <button onClick={() => { if (!disabled) { onClick(); onClose(); } }} disabled={disabled}
      className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800/40'}`}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: brandColor }}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">{sub}</p>
      </div>
    </button>
  );
  return (
    <div className="fixed inset-0 z-[65] flex items-end md:items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-0 md:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-2xl md:rounded-2xl w-full md:max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <FaMagic className="text-[#0d9488]" /> AI Assistant
            </h3>
            <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
          </div>
          <div className="space-y-1">
            <Item icon={<FaRobot className="text-sm" />} label="Plan a new project" sub="Describe it in plain English — get a full plan" onClick={onPlan} disabled={!canManage} />
            <Item icon={<FaLightbulb className="text-sm" />} label="Summarize this project" sub="Headline, highlights, risks, next steps" onClick={onSummary} />
            <Item icon={<FaHeartbeat className="text-sm" />} label="Review this project" sub="Audit workload, deadlines, and blockers" onClick={onReview} disabled={!canManage} />
            <Item icon={<FaFileAlt className="text-sm" />} label="Generate documentation" sub="Formal project doc, downloadable as PDF" onClick={onDocs} />
          </div>
        </div>
      </div>
    </div>
  );
};

const EXAMPLE_PROMPTS = [
  'Build a marketing website in 3 weeks with design, dev and QA phases.',
  'Launch a new mobile app feature. Need a designer, backend dev and tester.',
  'Plan a 2-day team offsite with logistics and activities.',
  'Create a content calendar for our social media for the next month.',
];

const AIPlanModal = ({ isOpen, onClose, workspaceId, workspaceMembers, brandColor, onExecuted }) => {
  const [stage, setStage] = useState('prompt');
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [busy, setBusy] = useState(false);
  const [planWithAI] = usePlanWithAIMutation();
  const [executeAIPlan] = useExecuteAIPlanMutation();

  const reset = () => { setStage('prompt'); setPrompt(''); setPlan(null); setExpandedTask(null); };
  useEffect(() => { if (!isOpen) reset(); }, [isOpen]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error('Describe your project first');
    setBusy(true);
    try {
      const res = await planWithAI({ workspaceId, prompt: prompt.trim() }).unwrap();
      setPlan(res.plan); setStage('edit');
    } catch (err) { toast.error(err?.data?.message || 'Failed to generate plan'); }
    finally { setBusy(false); }
  };

  const handleExecute = async () => {
    if (!plan) return;
    if (!plan.project.name?.trim()) return toast.error('Project name required');
    if (!plan.tasks?.length) return toast.error('Add at least one task');
    setBusy(true);
    try {
      const cleanPlan = {
        project: {
          name: plan.project.name.trim(),
          description: plan.project.description || '',
          detailedDescription: plan.project.detailedDescription || '',
          priority: plan.project.priority,
          projectType: plan.project.projectType,
          tags: plan.project.tags || [],
          teamMemberIds: plan.project.teamMemberIds || [],
        },
        tasks: plan.tasks.map((t) => ({
          title: t.title.trim(),
          description: t.description || '',
          priority: t.priority,
          assigneeIds: t.assigneeIds || [],
          dueDateOffsetDays: Number.isFinite(t.dueDateOffsetDays) ? t.dueDateOffsetDays : null,
          subtasks: (t.subtasks || []).map((s) => ({
            title: s.title.trim(),
            description: s.description || '',
            dueDateOffsetDays: Number.isFinite(s.dueDateOffsetDays) ? s.dueDateOffsetDays : null,
          })),
        })),
      };
      const res = await executeAIPlan({ workspaceId, plan: cleanPlan }).unwrap();
      toast.success(`Created ${res.taskCount} tasks`);
      onExecuted?.(res.project);
      onClose();
    } catch (err) { toast.error(err?.data?.message || 'Failed to create project'); }
    finally { setBusy(false); }
  };

  const updateProject = (patch) => setPlan((p) => ({ ...p, project: { ...p.project, ...patch } }));
  const updateTask = (i, patch) => setPlan((p) => { const tasks = [...p.tasks]; tasks[i] = { ...tasks[i], ...patch }; return { ...p, tasks }; });
  const removeTask = (i) => setPlan((p) => ({ ...p, tasks: p.tasks.filter((_, k) => k !== i) }));
  const addTask = () => setPlan((p) => ({ ...p, tasks: [...p.tasks, { title: 'New task', description: '', priority: 'medium', assigneeIds: [], dueDateOffsetDays: 7, subtasks: [] }] }));
  const toggleAssignee = (i, uid) => {
    const t = plan.tasks[i];
    const has = t.assigneeIds.includes(uid);
    updateTask(i, { assigneeIds: has ? t.assigneeIds.filter((x) => x !== uid) : [...t.assigneeIds, uid] });
  };
  const toggleTeamMember = (uid) => {
    const has = (plan.project.teamMemberIds || []).includes(uid);
    updateProject({ teamMemberIds: has ? plan.project.teamMemberIds.filter((x) => x !== uid) : [...(plan.project.teamMemberIds || []), uid] });
  };
  const addSubtask = (i) => { const t = plan.tasks[i]; updateTask(i, { subtasks: [...(t.subtasks || []), { title: 'New subtask', description: '', dueDateOffsetDays: 3 }] }); };
  const updateSubtask = (i, si, patch) => { const t = plan.tasks[i]; const subs = [...(t.subtasks || [])]; subs[si] = { ...subs[si], ...patch }; updateTask(i, { subtasks: subs }); };
  const removeSubtask = (i, si) => { const t = plan.tasks[i]; updateTask(i, { subtasks: (t.subtasks || []).filter((_, k) => k !== si) }); };

  if (!isOpen) return null;
  const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
  const PROJECT_TYPES = ['general', 'client', 'internal', 'marketing', 'product'];
  const totalSubtasks = plan?.tasks?.reduce((n, t) => n + (t.subtasks || []).length, 0) || 0;

  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-4xl shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[92vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <FaMagic className="text-[#0d9488]" />
              {stage === 'prompt' ? 'Plan with AI' : 'Review AI Plan'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
              {stage === 'prompt' ? 'Describe your project — the AI will draft the plan' : `Edit anything · ${plan?.tasks?.length || 0} tasks · ${totalSubtasks} subtasks`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {stage === 'prompt' && (
            <div className="space-y-4">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6}
                placeholder="e.g. Plan a 3-week launch for our new mobile app. We have Sarah (designer), Marcus (backend), and Priya (marketer). Include QA and a soft-launch milestone."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-2xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#0d9488] resize-none" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-2">Try an example</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_PROMPTS.map((ex, i) => (
                    <button key={i} type="button" onClick={() => setPrompt(ex)} className="text-[10px] px-2.5 py-1 rounded-full bg-gray-100 dark:bg-[#1a1a24] hover:bg-[#0d9488]/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800/40 hover:border-[#0d9488]/40 transition text-left max-w-full truncate">
                      {ex.length > 45 ? `${ex.slice(0, 45)}…` : ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {stage === 'edit' && plan && (
            <div className="space-y-5">
              {plan.warnings?.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3 flex gap-2">
                  <FaExclamationTriangle className="text-amber-600 dark:text-amber-400 text-sm mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
                    {plan.warnings.map((w, i) => <div key={i}>{w}</div>)}
                  </div>
                </div>
              )}

              <section>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Project</h3>
                <div className="space-y-2">
                  <input value={plan.project.name} onChange={(e) => updateProject({ name: e.target.value })} placeholder="Project name"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-100 outline-none focus:border-[#0d9488]" />
                  <input value={plan.project.description || ''} onChange={(e) => updateProject({ description: e.target.value })} placeholder="Short description"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#0d9488]" />
                  <textarea value={plan.project.detailedDescription || ''} onChange={(e) => updateProject({ detailedDescription: e.target.value })} rows={3} placeholder="Detailed description"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#0d9488] resize-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={plan.project.priority} onChange={(e) => updateProject({ priority: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none">
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select value={plan.project.projectType} onChange={(e) => updateProject({ projectType: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none">
                      {PROJECT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  {workspaceMembers.length > 0 && (
                    <div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-500 mb-1.5">Team members</div>
                      <div className="flex flex-wrap gap-1.5">
                        {workspaceMembers.map((u) => {
                          const selected = (plan.project.teamMemberIds || []).includes(u._id);
                          return (
                            <button key={u._id} type="button" onClick={() => toggleTeamMember(u._id)}
                              className={`flex items-center gap-1.5 text-[11px] pl-0.5 pr-2.5 py-0.5 rounded-full border transition ${selected ? 'bg-teal-50 dark:bg-[#0d9488]/15 border-teal-500/50 dark:border-[#0d9488]/50 text-teal-700 dark:text-[#14b8a6]' : 'bg-gray-50 dark:bg-[#1a1a24] border-gray-200 dark:border-gray-800/40 text-gray-600 dark:text-gray-400 hover:border-gray-300'}`}>
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold overflow-hidden shrink-0" style={{ backgroundColor: brandColor }}>
                                {u.profile ? <img src={u.profile} alt="" className="w-full h-full object-cover" /> : (u.name || '?').charAt(0).toUpperCase()}
                              </span>
                              {u.name || 'Unknown'}
                              {selected && <FaCheck className="text-[8px]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">Tasks ({plan.tasks.length})</h3>
                  <button onClick={addTask} className="text-xs text-[#0d9488] font-medium flex items-center gap-1 hover:underline">
                    <FaPlus className="text-[10px]" /> Add task
                  </button>
                </div>
                <div className="space-y-2">
                  {plan.tasks.map((t, idx) => {
                    const expanded = expandedTask === idx;
                    return (
                      <div key={idx} className="bg-gray-50 dark:bg-[#1a1a24] rounded-xl border border-gray-200/60 dark:border-gray-800/40 overflow-hidden">
                        <div className="flex items-start gap-2 p-3">
                          <div className="flex-1 min-w-0 space-y-2">
                            <input value={t.title} onChange={(e) => updateTask(idx, { title: e.target.value })}
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-100 outline-none focus:border-[#0d9488]" />
                            <div className="flex flex-wrap gap-1.5">
                              <select value={t.priority} onChange={(e) => updateTask(idx, { priority: e.target.value })}
                                className="px-2 py-1 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-md text-[11px] text-gray-700 dark:text-gray-300 outline-none">
                                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                              </select>
                              <input type="number" min={0} value={t.dueDateOffsetDays ?? ''}
                                onChange={(e) => updateTask(idx, { dueDateOffsetDays: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                                placeholder="due in N days"
                                className="w-32 px-2 py-1 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-md text-[11px] text-gray-700 dark:text-gray-300 outline-none" />
                              <span className="px-2 py-1 text-[11px] text-gray-500 dark:text-gray-500">{(t.subtasks || []).length} subtask{(t.subtasks || []).length !== 1 ? 's' : ''}</span>
                            </div>
                            {workspaceMembers.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {workspaceMembers.map((u) => {
                                  const sel = (t.assigneeIds || []).includes(u._id);
                                  return (
                                    <button key={u._id} type="button" onClick={() => toggleAssignee(idx, u._id)} title={u.name}
                                      className={`flex items-center gap-1 text-[10px] pl-0.5 pr-1.5 py-0.5 rounded-full border transition ${sel ? 'bg-teal-50 dark:bg-[#0d9488]/15 border-teal-500/50 text-teal-700 dark:text-[#14b8a6]' : 'bg-white dark:bg-[#0f0f12] border-gray-200 dark:border-gray-800/40 text-gray-500 dark:text-gray-500 hover:border-gray-300'}`}>
                                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold overflow-hidden" style={{ backgroundColor: brandColor }}>
                                        {u.profile ? <img src={u.profile} alt="" className="w-full h-full object-cover" /> : (u.name || '?').charAt(0).toUpperCase()}
                                      </span>
                                      {(u.name || '').split(' ')[0] || 'Unknown'}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            <button onClick={() => setExpandedTask(expanded ? null : idx)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded">
                              <FaAngleDown className={`text-xs transition-transform ${expanded ? 'rotate-180' : ''}`} />
                            </button>
                            <button onClick={() => removeTask(idx)} className="p-1 text-gray-400 hover:text-red-500 rounded">
                              <FaTrashAlt className="text-xs" />
                            </button>
                          </div>
                        </div>
                        {expanded && (
                          <div className="px-3 pb-3 space-y-3 border-t border-gray-200/60 dark:border-gray-800/40 pt-3">
                            <textarea value={t.description || ''} onChange={(e) => updateTask(idx, { description: e.target.value })} rows={2} placeholder="Task description"
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none resize-none" />
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-500">Subtasks ({(t.subtasks || []).length})</span>
                              <button onClick={() => addSubtask(idx)} className="text-[11px] text-[#0d9488] font-medium flex items-center gap-1 hover:underline">
                                <FaPlus className="text-[9px]" /> Add
                              </button>
                            </div>
                            <div className="space-y-1.5">
                              {(t.subtasks || []).map((s, sidx) => (
                                <div key={sidx} className="flex items-start gap-2">
                                  <input value={s.title} onChange={(e) => updateSubtask(idx, sidx, { title: e.target.value })}
                                    className="flex-1 px-2.5 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none" />
                                  <input type="number" min={0} value={s.dueDateOffsetDays ?? ''}
                                    onChange={(e) => updateSubtask(idx, sidx, { dueDateOffsetDays: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                                    placeholder="N"
                                    className="w-14 px-2 py-1.5 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800/60 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none" />
                                  <button onClick={() => removeSubtask(idx, sidx)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                                    <FaTrashAlt className="text-[11px]" />
                                  </button>
                                </div>
                              ))}
                              {(t.subtasks || []).length === 0 && <p className="text-[11px] text-gray-400 dark:text-gray-600 italic">No subtasks</p>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
          {stage === 'prompt' ? (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={handleGenerate} disabled={busy || !prompt.trim()}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: brandColor }}>
                {busy ? <><FaSpinner className="animate-spin text-xs" /> Generating…</> : <><FaMagic className="text-xs" /> Generate plan</>}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStage('prompt')} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Back</button>
              <button onClick={handleExecute} disabled={busy}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: brandColor }}>
                {busy ? <><FaSpinner className="animate-spin text-xs" /> Creating…</> : <><FaCheck className="text-xs" /> Create project</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const AISummaryModal = ({ isOpen, onClose, projectId, brandColor }) => {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [summarizeProject] = useSummarizeProjectMutation();

  useEffect(() => { if (!isOpen) setResult(null); }, [isOpen]);
  useEffect(() => {
    if (isOpen && !result && !busy) {
      setBusy(true);
      summarizeProject({ projectId }).unwrap()
        .then((r) => setResult(r.summary))
        .catch((e) => toast.error(e?.data?.message || 'Summarize failed'))
        .finally(() => setBusy(false));
    }
  }, [isOpen]); // eslint-disable-line

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FaLightbulb className="text-[#0d9488]" /> Project Summary
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {busy && !result && (
            <div className="flex flex-col items-center justify-center py-16">
              <FaSpinner className="animate-spin text-2xl text-[#0d9488] mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-500">Thinking…</p>
            </div>
          )}
          {result && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 break-words">{result.headline}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 break-words leading-relaxed whitespace-pre-wrap">{result.summary}</p>
              </div>
              {result.currentState && (
                <div className="bg-gray-50 dark:bg-[#1a1a24] rounded-xl p-3 border border-gray-200/60 dark:border-gray-800/40">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-1">Current state</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{result.currentState}</p>
                </div>
              )}
              {result.highlights?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Highlights</h4>
                  <div className="space-y-1.5">
                    {result.highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <FaCheckCircle className="text-green-500 text-xs mt-1 shrink-0" />
                        <span className="break-words">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.risks?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Risks</h4>
                  <div className="space-y-1.5">
                    {result.risks.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <FaExclamationTriangle className="text-amber-500 text-xs mt-1 shrink-0" />
                        <span className="break-words">{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.nextSteps?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Next steps</h4>
                  <div className="space-y-1.5">
                    {result.nextSteps.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: brandColor }}>{i + 1}</span>
                        <span className="break-words">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
          <button onClick={onClose} className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 transition" style={{ backgroundColor: brandColor }}>Done</button>
        </div>
      </div>
    </div>
  );
};

const AIReviewModal = ({ isOpen, onClose, projectId, brandColor }) => {
  const [focus, setFocus] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reviewProject] = useReviewProjectMutation();

  useEffect(() => { if (!isOpen) { setResult(null); setFocus(''); } }, [isOpen]);

  const run = async () => {
    setBusy(true);
    try {
      const res = await reviewProject({ projectId, focus: focus.trim() || undefined }).unwrap();
      setResult(res.review);
    } catch (err) { toast.error(err?.data?.message || 'Review failed'); }
    finally { setBusy(false); }
  };

  if (!isOpen) return null;
  const scoreColor = !result ? brandColor : result.healthScore >= 75 ? '#16a34a' : result.healthScore >= 50 ? '#eab308' : '#dc2626';
  const sevColor = { low: 'text-blue-600 dark:text-blue-400', medium: 'text-yellow-600 dark:text-yellow-400', high: 'text-orange-600 dark:text-orange-400', critical: 'text-red-600 dark:text-red-400' };

  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FaHeartbeat className="text-[#0d9488]" /> Project Review
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {!result && (
            <div className="space-y-3">
              <input value={focus} onChange={(e) => setFocus(e.target.value)}
                placeholder="Optional focus — e.g. 'deadlines' or 'team balance'"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#0d9488]" />
              <p className="text-[11px] text-gray-500 dark:text-gray-500">The AI audits workload, priorities, deadlines, and gaps.</p>
            </div>
          )}
          {result && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-2xl text-white shrink-0" style={{ backgroundColor: scoreColor }}>{result.healthScore}</div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-500 uppercase font-semibold tracking-wide">Health Score</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 break-words">{result.overallAssessment}</p>
                </div>
              </div>
              {result.strengths?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Strengths</h4>
                  <div className="space-y-1.5">
                    {result.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <FaCheckCircle className="text-green-500 text-xs mt-1 shrink-0" />
                        <span className="break-words">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.issues?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Issues ({result.issues.length})</h4>
                  <div className="space-y-2">
                    {result.issues.map((it, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-[#1a1a24] rounded-xl p-3 border border-gray-200/60 dark:border-gray-800/40">
                        <div className="flex items-start gap-2">
                          <FaExclamationCircle className={`text-xs mt-1 shrink-0 ${sevColor[it.severity] || 'text-gray-400'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">
                              {it.title}
                              <span className={`ml-2 text-[10px] uppercase font-semibold ${sevColor[it.severity] || ''}`}>{it.severity}</span>
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">{it.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.recommendations?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Recommendations</h4>
                  <div className="space-y-2">
                    {result.recommendations.map((r, i) => (
                      <div key={i} className="bg-teal-50/60 dark:bg-[#0d9488]/10 rounded-xl p-3 border border-teal-200/60 dark:border-[#0d9488]/20">
                        <div className="flex items-start gap-2">
                          <FaLightbulb className="text-[#0d9488] text-xs mt-1 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">
                              {r.title}
                              <span className="ml-2 text-[10px] uppercase font-semibold text-teal-700 dark:text-[#0d9488]">{r.impact}</span>
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">{r.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
          {!result ? (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Cancel</button>
              <button onClick={run} disabled={busy}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: brandColor }}>
                {busy ? <><FaSpinner className="animate-spin text-xs" /> Analyzing…</> : <><FaHeartbeat className="text-xs" /> Run review</>}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setResult(null)} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Run again</button>
              <button onClick={onClose} className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 transition" style={{ backgroundColor: brandColor }}>Done</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const AIDocsModal = ({ isOpen, onClose, projectId, brandColor }) => {
  const [doc, setDoc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [generate] = useGenerateProjectDocsMutation();

  useEffect(() => { if (!isOpen) setDoc(null); }, [isOpen]);
  useEffect(() => {
    if (isOpen && !doc && !busy) {
      setBusy(true);
      generate({ projectId }).unwrap()
        .then((r) => setDoc(r.doc))
        .catch((e) => toast.error(e?.data?.message || 'Doc generation failed'))
        .finally(() => setBusy(false));
    }
  }, [isOpen]); // eslint-disable-line

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-3xl shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FaFileAlt className="text-[#0d9488]" /> Project Documentation
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition"><FaTimes /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {busy && !doc && (
            <div className="flex flex-col items-center justify-center py-16">
              <FaSpinner className="animate-spin text-2xl text-[#0d9488] mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-500">Writing documentation…</p>
            </div>
          )}
          {doc && (
            <article className="space-y-6">
              <header>
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 break-words">{doc.meta?.title}</h1>
                {doc.meta?.subtitle && <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 break-words">{doc.meta.subtitle}</p>}
                <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-2">
                  Version {doc.meta?.version || '1.0'} · Generated {new Date(doc.meta?.generatedAt || Date.now()).toLocaleString()}
                </p>
              </header>
              {(doc.sections || []).map((s, i) => (
                <section key={i} className="space-y-2">
                  <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200/60 dark:border-gray-800/40 pb-1">{s.heading}</h2>
                  {(s.paragraphs || []).map((p, j) => (
                    <p key={j} className="text-sm text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap leading-relaxed">{p}</p>
                  ))}
                  {(s.bullets || []).length > 0 && (
                    <ul className="list-disc pl-5 space-y-1">
                      {s.bullets.map((b, j) => <li key={j} className="text-sm text-gray-700 dark:text-gray-300 break-words">{b}</li>)}
                    </ul>
                  )}
                  {s.table?.headers?.length > 0 && s.table?.rows?.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-gray-200/60 dark:border-gray-800/40">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-[#1a1a24]">
                          <tr>{s.table.headers.map((h, j) => (<th key={j} className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{h}</th>))}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/30">
                          {s.table.rows.map((row, j) => (
                            <tr key={j}>{row.map((c, k) => <td key={k} className="px-3 py-2 text-gray-700 dark:text-gray-300 align-top">{c}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </article>
          )}
        </div>
        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">Close</button>
          <button onClick={() => doc && downloadDocsPDF(doc)} disabled={!doc || busy}
            className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
            style={{ backgroundColor: brandColor }}>
            <FaDownload className="text-xs" /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Screen ─────────────────────────────────────────────────────
const MyWorkspaceProjectId = () => {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((s) => s.auth);
  const isMd = useMediaQuery('(min-width: 768px)');

  const { data: wData, isLoading: wLoad, error: wErr } = useGetWorkspaceQuery(workspaceId);
  const { data: pData, isLoading: pLoad, error: pErr, refetch: refetchProject } = useGetProjectByIdQuery(projectId);
  const { data: foldersData, isLoading: foldersLoading, refetch: refetchFolders } = useGetProjectFoldersQuery(projectId, { skip: !projectId });

  const [activeFolderId, setActiveFolderId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const { data: tData, isLoading: tLoad, refetch: refetchTasks } = useGetProjectTasksQuery(
    { projectId, ...(activeFolderId ? { folderId: activeFolderId } : {}), archived: showArchived ? true : undefined },
    { skip: !projectId }
  );

  const [createTask] = useCreateTaskMutation();
  const [updateTask] = useUpdateTaskMutation();
  const [moveTask] = useMoveTaskMutation();
  const [copyTask] = useCopyTaskMutation();
  const [archiveTask] = useArchiveTaskMutation();
  const [restoreTask] = useRestoreTaskMutation();
  const [permanentlyDeleteTask] = usePermanentlyDeleteTaskMutation();
  const [createFolder] = useCreateFolderMutation();
  const [updateFolder] = useUpdateFolderMutation();
  const [deleteFolder] = useDeleteFolderMutation();
  const [reorderTasks] = useReorderTasksMutation();

  const [localTasks, setLocalTasks] = useState([]);
  const [localFolders, setLocalFolders] = useState([]);
  useEffect(() => setLocalTasks(tData?.tasks || []), [tData]);
  useEffect(() => setLocalFolders(foldersData?.folders || []), [foldersData]);

  const tasks = localTasks;
  const folders = localFolders;

  const [searchOpen, setSearchOpen] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRenameFolder, setShowRenameFolder] = useState(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [folderActionModal, setFolderActionModal] = useState({ isOpen: false, mode: 'copy', task: null });
  const [folderMenuOpen, setFolderMenuOpen] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, danger: false });
  const [deleteTaskModal, setDeleteTaskModal] = useState({ isOpen: false, taskName: '', onConfirm: () => {} });
  const longPressTimer = useRef(null);

  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);

  // AI state
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiPlanOpen, setAiPlanOpen] = useState(false);
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [aiDocsOpen, setAiDocsOpen] = useState(false);

  const workspace = wData?.workspace;
  const project = pData?.project;
  const brandColor = workspace?.color || '#0d9488';

  const isOwner = useMemo(() => {
    const oid = workspace?.owner?._id || workspace?.owner;
    return !!oid && oid === userInfo?._id;
  }, [workspace, userInfo]);
  const isManager = useMemo(() => project?.projectManagers?.some((pm) => (pm._id || pm)?.toString() === userInfo?._id), [project, userInfo]);
  const canManage = isOwner || isManager;

  const activeTeam = useMemo(() => (project?.teamMembers || []).filter((m) => m.status === 'active'), [project?.teamMembers]);
  const assignableMembers = useMemo(() => {
    if (!project) return [];
    const mgrs = project.projectManagers || [];
    const all = [...activeTeam, ...mgrs.map((pm) => ({ user: pm }))];
    const seen = new Set();
    return all.filter((item) => {
      const id = item.user?._id || item.user;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [activeTeam, project?.projectManagers]);

  const workspaceMembers = useMemo(() => {
    if (!workspace) return [];
    return (workspace.members || []).filter((m) => m.status === 'active').map((m) => m.user || m).filter(Boolean);
  }, [workspace]);

  const isFolderReadOnly = useCallback((folderId) => {
    if (canManage) return false;
    const hasAssigned = tasks.some((t) => {
      const fid = t.folder?._id || t.folder;
      const inArr = (t.assignees || []).some((a) => (a._id || a) === userInfo?._id);
      return fid === folderId && inArr;
    });
    if (hasAssigned) return false;
    return folders.some((f) => f._id === folderId);
  }, [canManage, tasks, userInfo, folders]);

  const refreshAll = useCallback(() => { refetchTasks(); refetchProject(); }, [refetchTasks, refetchProject]);

  const handleCreateTaskOptimistic = useCallback(async (formData) => {
    const assigneeIds = Array.isArray(formData.assigneeIds) && formData.assigneeIds.length > 0
      ? formData.assigneeIds
      : (formData.assigneeId ? [formData.assigneeId] : []);
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      _id: tempId,
      title: formData.title,
      description: formData.description || '',
      taskType: formData.taskType || 'general',
      priority: formData.priority || 'medium',
      status: assigneeIds.length > 0 ? 'ready_for_completion' : 'pending',
      progress: 0,
      assignees: assigneeIds.map((id) => ({ _id: id, name: 'Loading...' })),
      folder: formData.folderId ? { _id: formData.folderId, name: folders.find((f) => f._id === formData.folderId)?.name || 'Folder' } : null,
      startDate: formData.startDate || null,
      dueDate: formData.dueDate || null,
      estimatedHours: formData.estimatedHours || 0,
      bufferTime: parseFloat(formData.bufferTime) || 0,
      allowAssigneeEditSubtasks: !!formData.allowAssigneeEditSubtasks,
      recurrenceType: formData.recurrenceType || 'none',
      links: formData.links || [],
      attachments: [],
      subTasks: [],
      isArchived: false,
      isTrash: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setLocalTasks((prev) => [optimistic, ...prev]);
    try {
      const fd = new FormData();
      fd.append('projectId', formData.projectId);
      fd.append('title', formData.title);
      fd.append('description', formData.description);
      fd.append('taskType', formData.taskType);
      if (assigneeIds.length > 0) { fd.append('assigneeIds', JSON.stringify(assigneeIds)); fd.append('assigneeId', assigneeIds[0]); }
      fd.append('priority', formData.priority);
      if (formData.startDate) fd.append('startDate', new Date(formData.startDate).toISOString());
      if (formData.dueDate) fd.append('dueDate', new Date(formData.dueDate).toISOString());
      if (formData.estimatedHours) fd.append('estimatedHours', formData.estimatedHours);
      fd.append('bufferTime', formData.bufferTime);
      fd.append('links', JSON.stringify(formData.links || []));
      fd.append('allowAssigneeEditSubtasks', formData.allowAssigneeEditSubtasks);
      if (formData.folderId) fd.append('folderId', formData.folderId);
      if (formData.dailyReminderTime) fd.append('dailyReminderTime', formData.dailyReminderTime);
      fd.append('recurrenceType', formData.recurrenceType);
      if (formData.recurrenceType === 'weekly') fd.append('recurrenceDays', JSON.stringify(formData.recurrenceDays));
      if (formData.recurrenceEndDate) fd.append('recurrenceEndDate', formData.recurrenceEndDate);
      formData.attachments?.forEach((file) => fd.append('attachments', file));
      const result = await createTask(fd).unwrap();
      setLocalTasks((prev) => prev.map((t) => (t._id === tempId ? result.task : t)));
      refetchTasks();
    } catch (err) {
      setLocalTasks((prev) => prev.filter((t) => t._id !== tempId));
      toast.error(err?.data?.message || 'Failed to create task');
      throw err;
    }
  }, [createTask, refetchTasks, folders]);

  const handleDeleteFolder = useCallback((folderId) => {
    setConfirmModal({
      isOpen: true, title: 'Delete Folder', confirmText: 'Delete', danger: true,
      message: 'Deleting this folder will unlink its tasks. Are you sure?',
      onConfirm: async () => {
        const prev = folders.find((f) => f._id === folderId);
        setLocalFolders((p) => p.filter((f) => f._id !== folderId));
        if (activeFolderId === folderId) setActiveFolderId(null);
        try { await deleteFolder(folderId).unwrap(); toast.success('Folder deleted'); refetchFolders(); refetchTasks(); }
        catch (e) { if (prev) setLocalFolders((p) => [...p, prev]); toast.error(e?.data?.message || 'Failed'); }
      },
    });
  }, [folders, deleteFolder, refetchFolders, refetchTasks, activeFolderId]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return toast.error('Folder name required');
    try {
      const result = await createFolder({ projectId, name: newFolderName.trim() }).unwrap();
      setLocalFolders((prev) => [...prev, result.folder]);
      toast.success('Folder created');
      setNewFolderName('');
      setShowCreateFolder(false);
      refetchFolders();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };

  const handleRenameFolder = async (folderId) => {
    if (!renameFolderName.trim()) return toast.error('Name required');
    try {
      await updateFolder({ folderId, name: renameFolderName.trim() }).unwrap();
      toast.success('Folder renamed');
      setShowRenameFolder(null);
      setRenameFolderName('');
      refetchFolders();
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  };

  const handleDeleteTask = useCallback((task) => {
    setDeleteTaskModal({
      isOpen: true, taskName: task.title,
      onConfirm: async () => {
        try { await archiveTask(task._id).unwrap(); toast.success('Task archived'); refetchTasks(); refetchProject(); }
        catch (e) { toast.error(e?.data?.message || 'Failed'); }
      },
    });
  }, [archiveTask, refetchTasks, refetchProject]);

  const handleArchiveTask = useCallback(async (taskId) => {
    try { await archiveTask(taskId).unwrap(); toast.success('Archived'); refetchTasks(); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [archiveTask, refetchTasks]);

  const handleUnarchiveTask = useCallback(async (taskId) => {
    try { await restoreTask(taskId).unwrap(); toast.success('Restored'); refetchTasks(); } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [restoreTask, refetchTasks]);

  const handlePermanentDeleteTask = useCallback((taskId) => {
    setConfirmModal({
      isOpen: true, title: 'Permanently Delete Task', confirmText: 'Delete Permanently', danger: true,
      message: 'This action cannot be undone. Are you sure?',
      onConfirm: async () => { try { await permanentlyDeleteTask(taskId).unwrap(); toast.success('Permanently deleted'); refetchTasks(); refetchProject(); } catch (e) { toast.error(e?.data?.message || 'Failed'); } },
    });
  }, [permanentlyDeleteTask, refetchTasks, refetchProject]);

  const handleFolderActionConfirm = useCallback(async (taskId, targetFolderId) => {
    try {
      if (folderActionModal.mode === 'copy') { await copyTask({ taskId, targetFolderId }).unwrap(); toast.success('Task copied'); }
      else { await moveTask({ taskId, targetFolderId }).unwrap(); toast.success('Task moved'); }
      refetchTasks();
      setFolderActionModal({ isOpen: false, mode: 'copy', task: null });
    } catch (e) { toast.error(e?.data?.message || 'Failed'); }
  }, [folderActionModal.mode, copyTask, moveTask, refetchTasks]);

  // Drag reorder
  const canReorderTasks = canManage && !showArchived;
  const onTaskDragStart = (e, task) => {
    if (!canReorderTasks) { e.preventDefault(); return; }
    setDraggedTaskId(task._id);
    e.dataTransfer.setData('text/plain', task._id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onTaskDragEnd = () => { setDraggedTaskId(null); setDragOverTaskId(null); };
  const onTaskDragOver = (e, task) => { e.preventDefault(); if (draggedTaskId && draggedTaskId !== task._id) setDragOverTaskId(task._id); };
  const onTaskDrop = async (e, target) => {
    e.preventDefault(); e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDragOverTaskId(null);
    if (!draggedId || draggedId === target._id) return;
    const prev = tasks;
    const di = prev.findIndex((t) => t._id === draggedId);
    const ti = prev.findIndex((t) => t._id === target._id);
    if (di === -1 || ti === -1) return;
    const next = [...prev];
    const [moved] = next.splice(di, 1);
    next.splice(ti, 0, moved);
    setLocalTasks(next);
    try { await reorderTasks({ projectId, orderedTaskIds: next.map((t) => t._id) }).unwrap(); refetchTasks(); }
    catch (err) { toast.error(err?.data?.message || 'Failed to reorder'); setLocalTasks(prev); }
  };

  const handleTouchStart = (id) => { longPressTimer.current = setTimeout(() => { setFolderMenuOpen(id); if (navigator.vibrate) navigator.vibrate(50); }, 600); };
  const clearTouch = () => clearTimeout(longPressTimer.current);

  const toggleArchived = () => { setShowArchived((p) => !p); setActiveFolderId(null); };

  useEffect(() => {
    if (wErr || pErr) navigate(`/my-workspace/${workspaceId}/projects`, { replace: true });
  }, [wErr, pErr, navigate, workspaceId]);

  if (wErr || pErr) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]"><div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (wLoad || pLoad || tLoad || foldersLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]"><div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: brandColor }} /></div>;
  }
  if (!workspace || !project) return null;

  const goToProject = () => navigate(`/my-workspace/${workspaceId}/projects`);
  const goToTask = (taskId) => navigate(`/my-workspace/${workspaceId}/project/${projectId}/task/${taskId}`);
  const goToTeam = () => navigate(`/my-workspace/${workspaceId}/project/${projectId}/team`);

  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      {/* ─── Sidebar (desktop) ───────────────────────────────── */}
      <div className="hidden lg:block lg:w-64 lg:h-full shrink-0">
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 shrink-0">
          <div className="flex items-center justify-between px-3 md:px-4 h-14 lg:h-16">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={goToProject} className="p-1 lg:hidden text-gray-500 dark:text-gray-400"><FaArrowLeft className="text-sm" /></button>
              {project.coverImage ? (
                <img src={project.coverImage} className="w-8 h-8 md:w-10 md:h-10 rounded-xl object-cover" alt="" />
              ) : (
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: brandColor }}><FaFolder /></div>
              )}
              <div className="min-w-0">
                <h1 className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[140px] md:max-w-xs">{project.name}</h1>
                <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                  <span>{activeTeam.length} members</span>
                  <span className="w-0.5 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
                  <span>{project.progress || 0}% done</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <button onClick={() => setSearchOpen(true)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl"><FaSearch className="text-xs md:text-sm" /></button>
              {!showArchived && (
                <button onClick={() => setAiMenuOpen(true)} className="p-1.5 text-[#0d9488] hover:bg-[#0d9488]/10 rounded-xl" title="AI Assistant">
                  <FaMagic className="text-xs md:text-sm" />
                </button>
              )}
              {canManage && !showArchived && (
                <button onClick={() => setShowCreateTask(true)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl"><FaPlus className="text-xs md:text-sm" /></button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-3 md:px-4 border-t border-gray-200/60 dark:border-gray-800/30 py-1 overflow-x-auto scrollbar-hide">
            <button className="flex-shrink-0 text-xs md:text-sm font-medium bg-[#0d9488]/10 text-[#0d9488] px-3 py-1.5 rounded-xl whitespace-nowrap">
              Tasks ({tasks.length})
            </button>
            <button onClick={goToTeam} className="flex-shrink-0 text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition px-3 py-1.5 rounded-xl whitespace-nowrap">
              Team ({activeTeam.length})
            </button>
          </div>
        </header>

        {/* Folder tabs bar */}
        <div className="flex items-center gap-1 px-3 md:px-4 border-b border-gray-200/60 dark:border-gray-800/30 overflow-x-auto scrollbar-hide py-1 shrink-0">
          <button
            onClick={() => { setActiveFolderId(null); setShowArchived(false); }}
            className={`flex-shrink-0 text-xs md:text-sm font-medium transition px-3 py-1.5 rounded-xl whitespace-nowrap ${!showArchived && activeFolderId === null ? 'bg-[#0d9488]/10 text-[#0d9488]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            All Tasks
          </button>
          <button
            onClick={toggleArchived}
            className={`flex-shrink-0 text-xs md:text-sm font-medium transition px-3 py-1.5 rounded-xl whitespace-nowrap flex items-center gap-1 ${showArchived ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            <FaArchive className="text-[10px]" /> Archived
          </button>
          {!showArchived && folders.map((folder) => {
            const readOnly = isFolderReadOnly(folder._id);
            return (
              <div key={folder._id} className="relative flex-shrink-0 group">
                <div
                  onClick={() => setActiveFolderId(folder._id)}
                  onTouchStart={() => handleTouchStart(folder._id)}
                  onTouchEnd={clearTouch}
                  onTouchMove={clearTouch}
                  className={`flex items-center gap-1 cursor-pointer text-xs md:text-sm font-medium transition px-3 py-1.5 rounded-xl whitespace-nowrap ${activeFolderId === folder._id ? 'bg-[#0d9488]/10 text-[#0d9488]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  <span className="truncate max-w-[80px] md:max-w-[120px]">{folder.name}</span>
                  {readOnly && <FaLockOpen className="text-[10px] text-blue-400" />}
                  {canManage && (
                    <span className="opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5 ml-0.5">
                      <button onClick={(e) => { e.stopPropagation(); setShowRenameFolder(folder._id); setRenameFolderName(folder.name); }} className="p-0.5 text-blue-400 hover:text-blue-600 rounded"><FaPen className="text-[10px]" /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder._id); }} className="p-0.5 text-red-400 hover:text-red-600 rounded"><FaTimes className="text-[10px]" /></button>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {canManage && !showArchived && (
            <button onClick={() => setShowCreateFolder(true)} className="flex-shrink-0 p-1.5 text-[#0d9488] hover:bg-[#0d9488]/10 rounded-lg transition"><FaPlus className="text-sm" /></button>
          )}
        </div>

        {/* Task grid */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-24 md:pb-4">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FaTasks className="text-3xl md:text-4xl mb-2 opacity-30" />
              <p className="text-xs md:text-sm">{showArchived ? 'No archived tasks' : 'No tasks in this view'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {tasks.map((task) => {
                const folderId = task.folder?._id || task.folder;
                const readOnly = !canManage && folderId && isFolderReadOnly(folderId);
                return (
                  <TaskCard
                    key={task._id}
                    task={task}
                    onClick={() => goToTask(task._id)}
                    brandColor={brandColor}
                    isActive={false}
                    draggable={canReorderTasks && !readOnly}
                    onDragStart={onTaskDragStart}
                    onDragEnd={onTaskDragEnd}
                    onDragOver={onTaskDragOver}
                    onDragLeave={() => setDragOverTaskId(null)}
                    onDrop={onTaskDrop}
                    dragOver={dragOverTaskId === task._id}
                    readOnly={readOnly}
                    showArchived={showArchived}
                    onCopyClick={(t) => setFolderActionModal({ isOpen: true, mode: 'copy', task: t })}
                    onMoveClick={(t) => setFolderActionModal({ isOpen: true, mode: 'move', task: t })}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Bottombar (mobile) ──────────────────────────────── */}
      {!isMd && <MyWorkspaceBottombar workspace={workspace} />}

      {/* Modals */}
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} tasks={tasks} brandColor={brandColor} onSelect={goToTask} />

      {showCreateTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaTasks className="inline mr-1 text-[#0d9488]" /> New Task</h2>
              <button onClick={() => setShowCreateTask(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <CreateTaskForm
              projectId={projectId}
              brandColor={brandColor}
              assignableMembers={assignableMembers}
              folders={folders}
              onSuccess={() => { setShowCreateTask(false); refreshAll(); }}
              onCancel={() => setShowCreateTask(false)}
            />
          </div>
        </div>
      )}

      {showCreateFolder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaFolder className="inline mr-1 text-[#0d9488]" /> New Folder</h2>
              <button onClick={() => setShowCreateFolder(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name" className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none mb-4" onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setShowCreateFolder(false)} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400">Cancel</button>
              <button onClick={handleCreateFolder} className="flex-1 py-2 text-white rounded-xl text-sm font-medium" style={{ backgroundColor: brandColor }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {showRenameFolder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200"><FaPen className="inline mr-1 text-[#0d9488]" /> Rename Folder</h2>
              <button onClick={() => setShowRenameFolder(null)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"><FaTimes /></button>
            </div>
            <input type="text" value={renameFolderName} onChange={(e) => setRenameFolderName(e.target.value)} placeholder="New folder name" className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-[#0d9488] outline-none mb-4" onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder(showRenameFolder)} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setShowRenameFolder(null)} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400">Cancel</button>
              <button onClick={() => handleRenameFolder(showRenameFolder)} className="flex-1 py-2 text-white rounded-xl text-sm font-medium" style={{ backgroundColor: brandColor }}>Rename</button>
            </div>
          </div>
        </div>
      )}

      <FolderSelectModal
        isOpen={folderActionModal.isOpen}
        onClose={() => setFolderActionModal({ isOpen: false, mode: 'copy', task: null })}
        folders={folders}
        mode={folderActionModal.mode}
        task={folderActionModal.task}
        onConfirm={handleFolderActionConfirm}
        brandColor={brandColor}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((m) => ({ ...m, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
        confirmText={confirmModal.confirmText || 'Confirm'}
      />

      <DeleteTaskConfirmModal
        isOpen={deleteTaskModal.isOpen}
        onClose={() => setDeleteTaskModal({ isOpen: false, taskName: '', onConfirm: () => {} })}
        onConfirm={deleteTaskModal.onConfirm}
        taskName={deleteTaskModal.taskName}
      />

      {/* ─── AI ─────────────────────────────────────────────────── */}
      <AIMenu
        isOpen={aiMenuOpen}
        onClose={() => setAiMenuOpen(false)}
        canManage={canManage}
        brandColor={brandColor}
        onPlan={() => setAiPlanOpen(true)}
        onSummary={() => setAiSummaryOpen(true)}
        onReview={() => setAiReviewOpen(true)}
        onDocs={() => setAiDocsOpen(true)}
      />
      <AIPlanModal
        isOpen={aiPlanOpen}
        onClose={() => setAiPlanOpen(false)}
        workspaceId={workspaceId}
        workspaceMembers={workspaceMembers}
        brandColor={brandColor}
        onExecuted={(proj) => { refreshAll(); if (proj?._id) navigate(`/my-workspace/${workspaceId}/project/${proj._id}`); }}
      />
      <AISummaryModal isOpen={aiSummaryOpen} onClose={() => setAiSummaryOpen(false)} projectId={projectId} brandColor={brandColor} />
      <AIReviewModal isOpen={aiReviewOpen} onClose={() => setAiReviewOpen(false)} projectId={projectId} brandColor={brandColor} />
      <AIDocsModal isOpen={aiDocsOpen} onClose={() => setAiDocsOpen(false)} projectId={projectId} brandColor={brandColor} />
    </div>
  );
};

export default MyWorkspaceProjectId;
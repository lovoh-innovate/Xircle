// src/workspaceScreens/MyWorkspaceId.jsx
import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetWorkspaceProjectsQuery } from '../slices/projectApiSlice';
import { useGetUserChatsQuery } from '../slices/messagingApiSlice';
import { useGetProjectTasksQuery } from '../slices/taskApiSlice';
import { useChatWithAIMutation } from '../slices/aiApiSlice';
import { useWorkspacePresence } from '../services/useWorkspacePresence';
import {
  useGetClockInSettingsQuery,
  useGetUserClockInHistoryQuery,
} from '../slices/clockinApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
import {
  FaUsers,
  FaHashtag,
  FaFolder,
  FaEye,
  FaEyeSlash,
  FaUserPlus,
  FaCopy,
  FaClock,
  FaSpinner,
  FaArrowLeft,
  FaCheck,
  FaTimes,
  FaExclamationTriangle,
  FaRobot,
  FaPaperPlane,
  FaPlus,
  FaCog,
} from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'react-hot-toast';

// ─── Format "HH:MM" (24h) into friendly 12-hour time ──────────────
const formatTime = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

// ─── Global styles ─────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    .skeleton {
      position: relative;
      overflow: hidden;
      background-color: rgb(229 231 235);
    }
    .dark .skeleton { background-color: rgba(255, 255, 255, 0.07); }
    .skeleton::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
      animation: skeletonShimmer 1.5s ease-in-out infinite;
    }
    .dark .skeleton::after {
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
    }
    @keyframes skeletonShimmer { 100% { transform: translateX(100%); } }
    @media (prefers-reduced-motion: reduce) { .skeleton::after { animation: none; } }

    .ai-chat-scroll::-webkit-scrollbar { width: 6px; }
    .ai-chat-scroll::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.3);
      border-radius: 999px;
    }
    .ai-chat-scroll::-webkit-scrollbar-track { background: transparent; }

    .ai-markdown { line-height: 1.55; }
    .ai-markdown > *:last-child { margin-bottom: 0 !important; }
    .ai-markdown table { font-size: 12px; }
  `}</style>
);

// ─── Skeleton primitives ───────────────────────────────────────────
const Skeleton = ({ className = '', style }) => (
  <div className={`skeleton rounded-lg ${className}`} style={style} />
);

const MetricCardSkeleton = () => (
  <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-2.5 sm:p-3 md:p-4 flex flex-col items-start gap-1">
    <Skeleton className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl" />
    <Skeleton className="h-5 md:h-6 w-10 md:w-14 mt-1" />
    <Skeleton className="h-2.5 w-14 md:w-20" />
  </div>
);

// ─── Loading shell ─────────────────────────────────────────────────
const WorkspaceLoadingShell = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col">
    <div className="hidden md:block md:w-[260px] md:min-h-screen md:flex-shrink-0 fixed top-0 left-0 z-20">
      <MyWorkspaceSidebar />
    </div>

    <div className="flex-1 md:ml-[260px]">
      <div className="md:hidden fixed top-0 left-0 right-0 z-10 bg-white/80 dark:bg-[#0b0b10]/80 backdrop-blur-md px-4 pt-4 pb-2 border-b border-gray-200/60 dark:border-gray-800/40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6 mt-16 md:mt-0">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="hidden lg:flex lg:col-span-3 bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-4 sm:p-5 h-[480px]">
            <div className="w-full space-y-3">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="lg:col-span-1 bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-2">
            <div className="flex lg:flex-col gap-1">
              <Skeleton className="flex-1 lg:flex-none h-14 lg:h-9 rounded-xl" />
              <Skeleton className="flex-1 lg:flex-none h-14 lg:h-9 rounded-xl" />
              <Skeleton className="flex-1 lg:flex-none h-14 lg:h-9 rounded-xl" />
            </div>
          </div>
        </div>
      </main>
    </div>

    <MyWorkspaceBottombar />
  </div>
);

// ─── Helper: task counter per project ────────────────────────────
const TaskCounter = memo(({ projectId, onCount, onLoading }) => {
  const { data, isLoading } = useGetProjectTasksQuery({ projectId });
  const mounted = useRef(true);
  const lastCount = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (data && mounted.current) {
      const count = data.tasks.length;
      if (count !== lastCount.current) {
        lastCount.current = count;
        onCount(projectId, count);
      }
    }
    if (isLoading !== undefined && mounted.current) {
      onLoading(projectId, isLoading);
    }
  }, [data, isLoading, projectId, onCount, onLoading]);

  return null;
});

const getMemberId = (member) => (member?.user?._id || member?.user)?.toString();

// ═════════════════════════════════════════════════════════════════════
// ── AI CHAT PANEL ────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════

const MarkdownMessage = ({ content, brandColor }) => (
  <div className="ai-markdown text-sm break-words">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-gray-700 dark:text-gray-300">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h1: ({ children }) => (
          <h1 className="text-base font-bold mt-2 mb-1 text-gray-900 dark:text-white">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold mt-2 mb-1 text-gray-900 dark:text-white">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold mt-2 mb-1 text-gray-900 dark:text-white">
            {children}
          </h3>
        ),
        code: ({ inline, children }) =>
          inline ? (
            <code className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-[12px] font-mono">
              {children}
            </code>
          ) : (
            <pre className="p-2 rounded-lg bg-gray-900 dark:bg-black text-gray-100 text-[12px] overflow-x-auto mb-2">
              <code>{children}</code>
            </pre>
          ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-80"
            style={{ color: brandColor }}
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2 -mx-1 rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="min-w-full text-[12px] border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-gray-50 dark:bg-[#0b0b10]">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-2.5 py-1.5 text-left font-semibold border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2.5 py-1.5 border-b border-gray-100 dark:border-gray-800/60 align-top">
            {children}
          </td>
        ),
        blockquote: ({ children }) => (
          <blockquote
            className="pl-3 border-l-2 my-2 italic text-gray-600 dark:text-gray-400"
            style={{ borderColor: brandColor }}
          >
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 border-gray-200 dark:border-gray-800" />,
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

const MessageBubble = ({ message, brandColor }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isUser ? '' : 'w-full'}`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 ${
            isUser
              ? 'text-white rounded-br-md'
              : 'bg-gray-100 dark:bg-[#1a1a22] text-gray-800 dark:text-gray-200 rounded-bl-md'
          }`}
          style={isUser ? { backgroundColor: brandColor } : undefined}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <MarkdownMessage content={message.content} brandColor={brandColor} />
          )}
        </div>

        {!isUser && Array.isArray(message.actions) && message.actions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {message.actions.map((a, i) => (
              <div
                key={i}
                className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full ${
                  a.ok
                    ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                }`}
              >
                {a.ok ? <FaCheck className="text-[9px]" /> : <FaTimes className="text-[9px]" />}
                <span>{a.summary || (a.ok ? `Ran ${a.tool}` : `Failed ${a.tool}`)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AIChatPanel = ({ workspaceId, brandColor, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [chatWithAI, { isLoading }] = useChatWithAIMutation();
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const handleSend = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || isLoading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text, id: `u-${Date.now()}` }]);

    try {
      const res = await chatWithAI({
        message: text,
        conversationId,
        workspaceId,
      }).unwrap();

      if (res.conversationId && res.conversationId !== conversationId) {
        setConversationId(res.conversationId);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.answer || "I didn't get a response.",
          actions: res.actions || [],
          id: `a-${Date.now()}`,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry — I couldn't reach the server. Please try again.",
          error: true,
          id: `e-${Date.now()}`,
        },
      ]);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setInput('');
  };

  const suggestions = [
    'What are we working on?',
    "What's on my plate today?",
    'Clock me in',
    'Summarize this workspace',
  ];

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
          >
            <FaRobot className="text-sm" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-500">
              Xircle AI
            </p>
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">
              Ask me anything
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="text-[11px] px-2 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition flex items-center gap-1"
              title="New chat"
            >
              <FaPlus className="text-[9px]" />
              <span className="hidden sm:inline">New</span>
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition flex items-center justify-center"
            >
              <FaTimes className="text-xs" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="ai-chat-scroll flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-3 min-h-0"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-2">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
            >
              <FaRobot className="text-xl" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Hi! I&apos;m your workspace AI.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 max-w-xs">
                Ask me anything — workspace stuff, general questions, or tell me to
                do something (clock in, schedule a call, message a teammate).
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-800/60 bg-white dark:bg-[#14141a] hover:border-teal-500 dark:hover:border-[#0d9488]/40 text-gray-600 dark:text-gray-300 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} brandColor={brandColor} />
          ))
        )}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 px-2">
            <FaSpinner className="animate-spin" />
            Thinking…
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200/60 dark:border-gray-800/40 p-3 flex-shrink-0">
        <div className="flex items-end gap-2 bg-gray-50 dark:bg-[#0b0b10] rounded-2xl border border-gray-200 dark:border-gray-800/60 p-1.5 focus-within:border-teal-500 dark:focus-within:border-[#0d9488] transition">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask anything or tell me what to do…"
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 px-2 py-1.5 outline-none max-h-32"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition flex-shrink-0"
            style={{ backgroundColor: brandColor }}
          >
            <FaPaperPlane className="text-[11px]" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// ── Clock‑in widget ─────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════

const ClockInWidget = ({ workspaceId, brandColor }) => {
  const navigate = useNavigate();
  const { data: settingsData, isLoading: settingsLoading } =
    useGetClockInSettingsQuery(workspaceId);
  const { data: historyData } = useGetUserClockInHistoryQuery(
    { workspaceId, page: 1, limit: 1 },
    { skip: !settingsData?.settings?.clockInEnabled }
  );

  const isEnabled = settingsData?.settings?.clockInEnabled || false;
  const today = new Date().toISOString().split('T')[0];
  const latest = historyData?.history?.[0];
  const isClockedIn =
    latest &&
    new Date(latest.clockInTime).toISOString().split('T')[0] === today &&
    !latest.clockOutTime;
  const clockInTime = isClockedIn
    ? new Date(latest.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  if (!isEnabled) return null;
  if (settingsLoading) return <FaSpinner className="animate-spin text-teal-500 text-sm" />;

  const handleNavigate = () => navigate(`/my-workspace/${workspaceId}/clockin`);

  return (
    <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#14141a] px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-800/60 text-xs">
      <FaClock className="text-teal-600 dark:text-[#0d9488]" />
      {isClockedIn ? (
        <>
          <span className="text-gray-700 dark:text-gray-300">
            In at <span className="font-mono">{clockInTime}</span>
          </span>
          <button
            onClick={handleNavigate}
            className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded-full hover:bg-red-500/20 transition"
          >
            <FaTimes className="text-[10px]" />
            <span className="hidden sm:inline">Out</span>
          </button>
        </>
      ) : (
        <button
          onClick={handleNavigate}
          className="flex items-center gap-1 px-2 py-0.5 bg-teal-500/10 rounded-full hover:bg-teal-500/20 transition"
          style={{ color: brandColor }}
        >
          <FaCheck className="text-[10px]" />
          <span className="hidden sm:inline">Clock In</span>
        </button>
      )}
    </div>
  );
};

const ClockInBanner = ({ workspaceId, brandColor }) => {
  const { data: settingsData } = useGetClockInSettingsQuery(workspaceId);
  const { data: historyData } = useGetUserClockInHistoryQuery(
    { workspaceId, page: 1, limit: 1 },
    { skip: !settingsData?.settings?.clockInEnabled }
  );

  const [countdown, setCountdown] = useState('');

  const isEnabled = settingsData?.settings?.clockInEnabled || false;
  const clockInStart = settingsData?.settings?.clockInStart || null;
  const clockInEnd = settingsData?.settings?.clockInEnd || null;
  const hasScheduledTime = clockInStart !== null;
  const closingTime = settingsData?.settings?.closingTime || null;

  const today = new Date().toISOString().split('T')[0];
  const latest = historyData?.history?.[0];
  const isClockedIn =
    latest &&
    new Date(latest.clockInTime).toISOString().split('T')[0] === today &&
    !latest.clockOutTime;

  useEffect(() => {
    if (!isEnabled || !hasScheduledTime || isClockedIn) {
      setCountdown('');
      return;
    }
    const updateCountdown = () => {
      const now = new Date();
      const [startHours, startMinutes] = clockInStart.split(':').map(Number);
      const startDate = new Date(now);
      startDate.setHours(startHours, startMinutes, 0, 0);
      const diffMs = startDate - now;
      if (diffMs < 0) {
        if (clockInEnd) {
          const [endHours, endMinutes] = clockInEnd.split(':').map(Number);
          const endDate = new Date(now);
          endDate.setHours(endHours, endMinutes, 0, 0);
          if (now > endDate) {
            setCountdown('⛔ Closed');
            return;
          }
        }
        const lateMinutes = Math.floor(Math.abs(diffMs) / 60000);
        const lateSeconds = Math.floor((Math.abs(diffMs) % 60000) / 1000);
        setCountdown(`-${String(lateMinutes).padStart(2, '0')}:${String(lateSeconds).padStart(2, '0')}`);
        return;
      }
      const minutes = Math.floor(diffMs / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      setCountdown(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isEnabled, hasScheduledTime, clockInStart, clockInEnd, isClockedIn]);

  if (!isEnabled) return null;

  if (!hasScheduledTime) {
    return (
      <div className="px-3 sm:px-6 py-2 border-t border-gray-200/60 dark:border-gray-800/30 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm bg-yellow-50/50 dark:bg-yellow-900/10">
        <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
          <FaExclamationTriangle className="text-yellow-500 text-[11px] sm:text-xs" />
          No schedule set —{' '}
          <Link
            to={`/my-workspace/${workspaceId}/clockin`}
            className="underline font-medium hover:opacity-80 transition"
            style={{ color: brandColor }}
          >
            set it now
          </Link>
        </span>
        <ClockInWidget workspaceId={workspaceId} brandColor={brandColor} />
      </div>
    );
  }

  if (isClockedIn) {
    const clockInTimeFormatted = latest
      ? new Date(latest.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    return (
      <div
        className="px-3 sm:px-6 py-2 border-t border-gray-200/60 dark:border-gray-800/30 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm"
        style={{ backgroundColor: `${brandColor}0d` }}
      >
        <span className="flex items-center gap-1.5 font-medium text-green-600 dark:text-green-400 whitespace-nowrap">
          <FaCheck className="text-[11px] sm:text-xs" />
          ✓ In {clockInTimeFormatted}
          {closingTime && (
            <span className="text-gray-600 dark:text-gray-400 font-normal whitespace-nowrap">
              · Closes {formatTime(closingTime)}
            </span>
          )}
        </span>
        <ClockInWidget workspaceId={workspaceId} brandColor={brandColor} />
      </div>
    );
  }

  const isLate = countdown.startsWith('-');
  const windowClosed = countdown.includes('Closed');

  return (
    <div
      className={`px-3 sm:px-6 py-2 border-t border-gray-200/60 dark:border-gray-800/30 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm transition-colors ${
        isLate && !windowClosed
          ? 'bg-red-50/80 dark:bg-red-950/20 border-red-200 dark:border-red-800/30'
          : isLate && windowClosed
          ? 'bg-red-100 dark:bg-red-950/30 border-red-300 dark:border-red-800/50'
          : 'bg-teal-50/50 dark:bg-teal-950/10'
      }`}
    >
      <span
        className="flex items-center gap-1.5 font-medium whitespace-nowrap"
        style={{ color: isLate ? '#dc2626' : brandColor }}
      >
        <FaClock className="text-[11px] sm:text-xs" />
        {windowClosed ? (
          <>⛔ <span className="font-semibold text-red-700 dark:text-red-300">Closed</span></>
        ) : isLate ? (
          <>
            <span className="text-red-700 dark:text-red-300">⏰ Late</span>
            <span className="font-mono font-bold text-red-700 dark:text-red-300">{countdown}</span>
          </>
        ) : (
          <>In <span className="font-mono font-bold" style={{ color: brandColor }}>{countdown}</span></>
        )}
        {!windowClosed && (
          <span className="text-gray-600 dark:text-gray-400 font-normal whitespace-nowrap">
            · {formatTime(clockInStart)}{clockInEnd ? `–${formatTime(clockInEnd)}` : ''}
          </span>
        )}
      </span>
      <ClockInWidget workspaceId={workspaceId} brandColor={brandColor} />
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// ── MAIN ─────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════

const MyWorkspaceId = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [hideStats, setHideStats] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const { data, isLoading, error } = useGetWorkspaceQuery(workspaceId);
  const { data: projectsData } = useGetWorkspaceProjectsQuery({ workspaceId });
  const { data: chatsData } = useGetUserChatsQuery(workspaceId);

  const onlineUserIds = useWorkspacePresence(workspaceId);

  const [totalTasks, setTotalTasks] = useState(0);
  const [taskCounts, setTaskCounts] = useState({});
  const [loadingTasks, setLoadingTasks] = useState({});

  const handleTaskCount = useCallback((projectId, count) => {
    setTaskCounts((prev) => (prev[projectId] === count ? prev : { ...prev, [projectId]: count }));
  }, []);

  const handleTaskLoading = useCallback((projectId, loading) => {
    setLoadingTasks((prev) => (prev[projectId] === loading ? prev : { ...prev, [projectId]: loading }));
  }, []);

  useEffect(() => {
    const sum = Object.values(taskCounts).reduce((a, b) => a + b, 0);
    setTotalTasks(sum);
  }, [taskCounts]);

  useEffect(() => {
    if (error) navigate('/my-workspaces');
  }, [error, navigate]);

  if (isLoading) {
    return (
      <>
        <GlobalStyles />
        <WorkspaceLoadingShell />
      </>
    );
  }

  const workspace = data?.workspace;
  const chats = chatsData?.chats || [];
  const projects = projectsData?.projects || [];
  if (!workspace) return null;

  const copyInviteCode = () => {
    if (workspace?.inviteCode) {
      navigator.clipboard.writeText(workspace.inviteCode);
      setCopySuccess(true);
      toast.success('Invite code copied!');
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const activeMembers = workspace.members?.filter((m) => m.status === 'active') || [];
  const isMemberOnline = (member) => onlineUserIds.has(getMemberId(member));
  const onlineCount = activeMembers.filter(isMemberOnline).length;
  const onlineMembers = activeMembers.filter(isMemberOnline);

  const channelCount = chats.filter((c) => c.type === 'group').length || 0;
  const brandColor = workspace.color || '#0d9488';

  // ─── Metric card ─────────────────────────────────────────────────
  const MetricCard = ({ icon: Icon, label, value, subtitle, subtitleColor, to, badge, badgeColor }) => (
    <Link
      to={to}
      className="group relative bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-2.5 sm:p-3 md:p-4 flex flex-col items-start gap-0.5 sm:gap-1 hover:border-teal-500 dark:hover:border-[#0d9488]/40 hover:shadow-[0_0_20px_rgba(13,148,136,0.12)] active:scale-[0.97] transition-all duration-300 overflow-hidden"
    >
      {badge && (
        <span
          className={`absolute top-1.5 right-1.5 md:top-2 md:right-2 text-[7px] md:text-[9px] font-bold px-1.5 md:px-2 py-0.5 rounded-full text-white ${badgeColor}`}
        >
          {badge}
        </span>
      )}

      <div className="flex items-center justify-between w-full">
        <div
          className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"
          style={{ color: brandColor, backgroundColor: `${brandColor}15` }}
        >
          <Icon className="text-[11px] md:text-sm" />
        </div>
        <span className="hidden md:inline text-xs font-mono text-gray-400 dark:text-gray-600 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition">
          {hideStats ? '••' : '→'}
        </span>
      </div>

      <p className="text-base sm:text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight mt-0.5 md:mt-1 leading-none">
        {hideStats ? '••' : value}
      </p>

      <p className="text-[9px] sm:text-[10px] md:text-[11px] text-gray-500 dark:text-gray-500 uppercase tracking-wider leading-tight">
        {label}
      </p>

      {subtitle && (
        <p
          className={`text-[9px] md:text-[10px] font-medium leading-tight truncate w-full ${
            subtitleColor || 'text-gray-500 dark:text-gray-500'
          }`}
        >
          {subtitle}
        </p>
      )}
    </Link>
  );

  // ─── Quick action ────────────────────────────────────────────────
  const QuickActionRow = ({ icon: Icon, label, to, onClick }) => {
    const inner = (
      <div className="flex flex-col lg:flex-row items-center gap-1.5 lg:gap-3 px-2 lg:px-3 py-2.5 rounded-xl hover:bg-teal-50 dark:hover:bg-[#0d9488]/8 active:bg-teal-100 dark:active:bg-[#0d9488]/10 transition group cursor-pointer w-full">
        <div
          className="w-8 h-8 lg:w-7 lg:h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${brandColor}12`, color: brandColor }}
        >
          <Icon className="text-xs" />
        </div>
        <span className="text-[10px] lg:text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition text-center lg:text-left whitespace-nowrap">
          {label}
        </span>
      </div>
    );
    if (to) return <Link to={to} className="flex-1 lg:flex-none">{inner}</Link>;
    return <button onClick={onClick} className="flex-1 lg:flex-none">{inner}</button>;
  };

  // ─── Hero Card (mobile) ──────────────────────────────────────────
  const HeroCard = () => (
    <div className="relative bg-white dark:bg-[#14141a] border border-gray-200/60 dark:border-gray-800/60 rounded-2xl p-4 sm:p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => navigate('/my-workspaces')}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0 flex-1"
        >
          {workspace.logo ? (
            <img
              src={workspace.logo}
              alt={workspace.name}
              className="w-11 h-11 rounded-xl object-cover border border-gray-200 dark:border-gray-700/60 shadow-[0_0_15px_rgba(13,148,136,0.15)] flex-shrink-0"
            />
          ) : (
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base border border-gray-200 dark:border-gray-700/60 shadow-[0_0_15px_rgba(13,148,136,0.15)] flex-shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {workspace.initials || workspace.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1 text-left">
            <span className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <FaArrowLeft className="text-[8px]" />
              Workspace
            </span>
            <h1 className="text-base sm:text-lg font-bold leading-tight truncate w-full text-gray-800 dark:text-gray-100">
              {workspace.name}
            </h1>
          </div>
        </button>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setHideStats((v) => !v)}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#0b0b10] border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition flex-shrink-0"
            aria-label="Toggle stats"
          >
            {hideStats ? <FaEyeSlash className="text-xs" /> : <FaEye className="text-xs" />}
          </button>
          <Link
            to={`/my-workspace/${workspaceId}/settings`}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#0b0b10] border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition flex-shrink-0"
            aria-label="Workspace settings"
          >
            <FaCog className="text-xs" />
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800/30 rounded-xl px-3 sm:px-4 py-2 border border-gray-200 dark:border-gray-800/40">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">Invite code</span>
        <span className="text-[11px] font-mono tracking-wider text-gray-800 dark:text-gray-300 flex items-center gap-2">
          {hideStats ? '••••••••' : workspace.inviteCode || '—'}
          {!hideStats && (
            <button
              onClick={copyInviteCode}
              className="text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] transition-colors"
              title="Copy invite code"
            >
              <FaCopy className="text-xs" />
            </button>
          )}
        </span>
        {copySuccess && (
          <span className="text-[10px] text-green-500 dark:text-green-400 animate-pulse">Copied!</span>
        )}
      </div>
    </div>
  );

  // ─── Online member card ──────────────────────────────────────────
  const OnlineMemberCard = ({ member, workspace }) => {
    const memberUser = member.user || member;
    const isOwner =
      memberUser._id === workspace.owner?._id ||
      memberUser._id === workspace.owner;

    return (
      <div className="relative flex flex-col items-center text-center gap-1.5 p-2.5 sm:p-3 rounded-xl bg-gray-50 dark:bg-[#0b0b10]/60 border border-gray-200/60 dark:border-gray-800/40 hover:border-teal-500 dark:hover:border-[#0d9488]/40 transition">
        <div className="relative">
          {memberUser?.profile ? (
            <img
              src={memberUser.profile}
              alt={memberUser.name}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-white dark:border-[#14141a]"
            />
          ) : (
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold border-2 border-white dark:border-[#14141a]"
              style={{ backgroundColor: brandColor }}
            >
              {memberUser?.name?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
          <span className="absolute -bottom-0 -right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-[#14141a] shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
        </div>
        <div className="w-full min-w-0">
          <p className="text-[11px] sm:text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex items-center justify-center gap-1">
            <span className="truncate">{memberUser?.name || 'Unknown'}</span>
            {isOwner && <span className="text-[9px] flex-shrink-0">👑</span>}
          </p>
          {member?.role && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
              {member.role}
            </p>
          )}
        </div>
      </div>
    );
  };

  // ─── Main render ────────────────────────────────────────────────
  return (
    <>
      <GlobalStyles />

      <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col">
        {/* Desktop sidebar */}
        <div className="hidden md:block md:min-h-screen fixed top-0 left-0 z-20 workspace-shell-sidebar">
          <MyWorkspaceSidebar workspace={workspace} chats={chats} />
        </div>

        <div className="flex-1 md:ml-[260px] workspace-shell-main">
          {/* Mobile header */}
          <div className="md:hidden fixed top-0 left-0 right-0 z-10 bg-white/80 dark:bg-[#0b0b10]/80 backdrop-blur-md px-3 pt-4 pb-2 border-b border-gray-200/60 dark:border-gray-800/40">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigate('/my-workspaces')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1 min-w-0"
              >
                <span className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5 flex-shrink-0">
                  <FaArrowLeft className="text-[8px]" />
                  Workspace
                </span>
                <span className="text-gray-300 dark:text-gray-700 flex-shrink-0">/</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate min-w-0">
                  {workspace.name}
                </span>
              </button>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setHideStats((v) => !v)}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#14141a] border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition flex-shrink-0"
                >
                  {hideStats ? <FaEyeSlash className="text-xs" /> : <FaEye className="text-xs" />}
                </button>
                <Link
                  to={`/my-workspace/${workspaceId}/settings`}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#14141a] border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition flex-shrink-0"
                  aria-label="Workspace settings"
                >
                  <FaCog className="text-xs" />
                </Link>
              </div>
            </div>
          </div>

          <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6 mt-16 md:mt-0">
            {/* Hidden task counters */}
            {projects.map((p) => (
              <TaskCounter
                key={p._id}
                projectId={p._id}
                onCount={handleTaskCount}
                onLoading={handleTaskLoading}
              />
            ))}

            {/* Mobile hero card */}
            <div className="md:hidden">
              <HeroCard />
            </div>

            {/* Clock-in banner */}
            <div className="mb-3 sm:mb-4">
              <ClockInBanner workspaceId={workspaceId} brandColor={brandColor} />
            </div>

            {/* Desktop hero bar */}
            <div className="hidden md:flex flex-wrap items-center justify-between gap-3 mb-6">
              <button
                onClick={() => navigate('/my-workspaces')}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                {workspace.logo ? (
                  <img
                    src={workspace.logo}
                    alt={workspace.name}
                    className="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700/60 shadow-[0_0_15px_rgba(13,148,136,0.15)]"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm border border-gray-200 dark:border-gray-700/60 shadow-[0_0_15px_rgba(13,148,136,0.15)]"
                    style={{ backgroundColor: brandColor }}
                  >
                    {workspace.initials || workspace.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <FaArrowLeft className="text-[8px]" />
                    Workspace
                  </span>
                  <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">
                    {workspace.name}
                  </h1>
                </div>
              </button>

              <div className="flex items-center gap-2">
                <ClockInWidget workspaceId={workspaceId} brandColor={brandColor} />
                <span className="text-[10px] font-mono text-gray-500 dark:text-gray-600 bg-gray-100 dark:bg-[#14141a] px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-800/60 flex items-center gap-2">
                  {hideStats ? '••••••••' : workspace.inviteCode}
                  {!hideStats && (
                    <button
                      onClick={copyInviteCode}
                      className="text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] transition-colors"
                      title="Copy invite code"
                    >
                      <FaCopy className="text-[10px]" />
                    </button>
                  )}
                  {copySuccess && (
                    <span className="text-[10px] text-green-500 dark:text-green-400 animate-pulse">Copied!</span>
                  )}
                </span>
                <Link
                  to={`/my-workspace/${workspaceId}/settings`}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#14141a] border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition flex-shrink-0"
                  aria-label="Workspace settings"
                >
                  <FaCog className="text-xs" />
                </Link>
              </div>
            </div>

            {/* ─── Metrics (3 compact cards) ──────────────────────── */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-6">
              <MetricCard
                icon={FaUsers}
                label="Members"
                value={activeMembers.length}
                subtitle={onlineCount > 0 ? `● ${onlineCount} online` : 'Offline'}
                subtitleColor={
                  onlineCount > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-500'
                }
                to={`/my-workspace/${workspaceId}/members`}
                badge={onlineCount > 0 ? 'LIVE' : null}
                badgeColor="bg-green-500"
              />
              <MetricCard
                icon={FaFolder}
                label="Projects"
                value={projects.length}
                subtitle={`${totalTasks} ${totalTasks === 1 ? 'task' : 'tasks'}`}
                subtitleColor="text-gray-500 dark:text-gray-500"
                to={`/my-workspace/${workspaceId}/projects`}
              />
              <MetricCard
                icon={FaHashtag}
                label="Channels"
                value={channelCount}
                to={`/my-workspace/${workspaceId}/channels`}
              />
            </div>

            {/* ─── AI Chat (desktop) + Quick Actions ──────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4 mb-3 sm:mb-6">
              {/* Chat — desktop only. Mobile uses floating button. */}
              <div className="hidden lg:flex lg:col-span-3 bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 overflow-hidden h-[480px]">
                <AIChatPanel workspaceId={workspaceId} brandColor={brandColor} />
              </div>

              <div className="lg:col-span-1 bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-1.5 sm:p-2">
                <p className="hidden lg:block text-[10px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-widest px-2 pt-1.5 pb-1">
                  Quick actions
                </p>
                <div className="flex lg:flex-col gap-1">
                  <QuickActionRow
                    icon={FaFolder}
                    label="Projects"
                    to={`/my-workspace/${workspaceId}/projects`}
                  />
                  <QuickActionRow
                    icon={FaHashtag}
                    label="Channels"
                    to={`/my-workspace/${workspaceId}/channels`}
                  />
                  <QuickActionRow
                    icon={FaUserPlus}
                    label="Invite"
                    onClick={copyInviteCode}
                  />
                </div>
              </div>
            </div>

            {/* ─── Online team (full width) ───────────────────────── */}
            <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 overflow-hidden">
              <div className="px-3 sm:px-5 py-3 flex items-center justify-between border-b border-gray-200/60 dark:border-gray-800/40">
                <h2 className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  Online now
                  <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">
                    ({onlineCount})
                  </span>
                </h2>
                <Link
                  to={`/my-workspace/${workspaceId}/members`}
                  className="text-[10px] font-medium uppercase tracking-wider hover:underline"
                  style={{ color: brandColor }}
                >
                  See all
                </Link>
              </div>

              {onlineMembers.length === 0 ? (
                <p className="px-3 sm:px-5 py-6 sm:py-8 text-xs text-gray-500 dark:text-gray-500 text-center">
                  No one online right now. Check back later.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 p-2.5 sm:p-4">
                  {onlineMembers.slice(0, 12).map((member) => (
                    <OnlineMemberCard
                      key={getMemberId(member)}
                      member={member}
                      workspace={workspace}
                    />
                  ))}
                </div>
              )}

              {onlineMembers.length > 12 && (
                <Link
                  to={`/my-workspace/${workspaceId}/members`}
                  className="block text-[10px] font-medium uppercase tracking-wider px-3 sm:px-5 py-2.5 hover:bg-teal-50 dark:hover:bg-[#0d9488]/5 transition border-t border-gray-100 dark:border-gray-800/30 text-center"
                  style={{ color: brandColor }}
                >
                  +{onlineMembers.length - 12} more online
                </Link>
              )}
            </div>
          </main>
        </div>

        <MyWorkspaceBottombar workspace={workspace} />
      </div>

      {/* ─── Mobile + tablet: floating chat button ──────────────── */}
      {!mobileChatOpen && (
        <button
          onClick={() => setMobileChatOpen(true)}
          className="lg:hidden fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white active:scale-95 transition-transform"
          style={{
            backgroundColor: brandColor,
            boxShadow: `0 8px 24px ${brandColor}55`,
          }}
          aria-label="Open AI chat"
        >
          <FaRobot className="text-xl" />
        </button>
      )}

      {/* ─── Mobile + tablet: chat drawer ───────────────────────── */}
      {mobileChatOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileChatOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 top-10 bg-white dark:bg-[#0b0b10] rounded-t-3xl shadow-2xl overflow-hidden flex flex-col">
            <AIChatPanel
              workspaceId={workspaceId}
              brandColor={brandColor}
              onClose={() => setMobileChatOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default MyWorkspaceId;
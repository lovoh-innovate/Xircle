// src/workspaceScreens/MyWorkspaceChatId.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useGetWorkspaceQuery } from "../slices/workspaceApiSlice";
import {
  useGetUserChatsQuery,
  useGetChatMessagesQuery,
  useSendMessageMutation,
  useDeleteMessageMutation,
  useArchiveMessageMutation,
  useUnarchiveMessageMutation,
  useStarMessageMutation,
  useUnstarMessageMutation,
} from "../slices/messagingApiSlice";
import { useInitiateCallMutation } from "../slices/callApiSlice";
import MyWorkspaceSidebar from "../workspaceComponents/MyWorkspaceSidebar";
import { useSocket } from "../components/SocketContext.jsx";
import {
  FaArrowLeft,
  FaPhone,
  FaVideo,
  FaComment,
  FaPaperPlane,
  FaPaperclip,
  FaImage,
  FaMicrophone,
  FaStop,
  FaTimes,
  FaPlay,
  FaPause,
  FaCheckCircle,
  FaEllipsisV,
  FaTrashAlt,
  FaReply,
  FaCheck,
  FaRegClock,
  FaDownload,
  FaExclamationTriangle,
  FaSpinner,
  FaStar,
  FaRegStar,
  FaArchive,
  FaUndo,
  FaFile,
  FaCamera,
  FaUser,
  FaChevronDown,
  FaSmile,
  FaCopy,
  FaPencilAlt,
  FaCrop,
  FaArrowRight,
  FaUndoAlt,
  FaSave,
  FaLink,
} from "react-icons/fa";
import { toast } from "react-hot-toast";

// ─── Capacitor Imports ──────────────────────────────────────────────
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { VoiceRecorder } from 'capacitor-voice-recorder';

// ─── Helper: base64 to File ─────────────────────────────────────────
const base64ToFile = (base64Data, fileName, mimeType) => {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return new File([blob], fileName, { type: mimeType });
};

// ─── Helpers ──────────────────────────────────────────────────────────
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const SEEN_TICK_COLOR = "#34B7F1";
const SWIPE_REPLY_THRESHOLD = 60;
const SWIPE_REPLY_MAX = 72;

const safeFormatTime = (dateString) => {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const formatDateDivider = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [matches, query]);
  return matches;
};

// ─── Link detection / preview helpers ──────────────────────────────
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const extractFirstUrl = (text) => {
  if (!text) return null;
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
};

const isUrlPart = (part) => /^https?:\/\//.test(part);

const LinkifiedText = ({ text, isOwn }) => {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        isUrlPart(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`underline break-all ${isOwn ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`}
          >
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
};

const linkPreviewCache = new Map();

const LinkPreviewCard = ({ url, isOwn, brandColor }) => {
  const [data, setData] = useState(() => linkPreviewCache.get(url) || null);
  const [loading, setLoading] = useState(!linkPreviewCache.has(url));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (linkPreviewCache.has(url)) {
      setData(linkPreviewCache.get(url));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.status === 'success' && json?.data) {
          linkPreviewCache.set(url, json.data);
          setData(json.data);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed) return null;

  let domain = '';
  try {
    domain = new URL(url).hostname.replace('www.', '');
  } catch {
    domain = url;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`block mt-1.5 rounded-xl overflow-hidden border ${isOwn
          ? 'border-white/20 bg-black/10 hover:bg-black/20'
          : 'border-gray-200 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800/60'
        } transition`}
    >
      {loading ? (
        <div className="p-3 animate-pulse">
          <div className={`h-3 w-2/3 rounded-full mb-2 ${isOwn ? 'bg-white/20' : 'bg-gray-300 dark:bg-gray-700'}`} />
          <div className={`h-2 w-1/3 rounded-full ${isOwn ? 'bg-white/20' : 'bg-gray-300 dark:bg-gray-700'}`} />
        </div>
      ) : data ? (
        <>
          {data.image?.url && (
            <img src={data.image.url} alt={data.title || 'Link preview'} className="w-full max-h-40 object-cover" />
          )}
          <div className="p-2.5">
            {data.title && (
              <p className={`text-xs font-semibold line-clamp-1 ${isOwn ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                {data.title}
              </p>
            )}
            {data.description && (
              <p className={`text-[11px] line-clamp-2 mt-0.5 ${isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                {data.description}
              </p>
            )}
            <p className={`text-[10px] mt-1 flex items-center gap-1 ${isOwn ? 'text-white/50' : 'text-gray-400 dark:text-gray-500'}`}>
              <FaLink className="text-[9px]" /> {domain}
            </p>
          </div>
        </>
      ) : null}
    </a>
  );
};

// ─── Emoji list ─────────────────────────────────────────────────────
const EMOJI_LIST = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😜", "🤔", "😎",
  "😢", "😭", "😡", "🥳", "👍", "👎", "🙏", "👏", "💪", "🔥",
  "❤️", "💔", "💯", "✨", "🎉", "😴", "🤗", "😇", "🙄", "😅",
  "🤝", "👋", "🤞", "🫶", "😏", "🥺", "😱", "😳", "🤩", "🫡",
  "💀", "👀", "😤", "🤦", "🤷", "🙈", "🙉", "🙊", "💃", "🕺",
  "🍕", "☕", "🎂", "🌹", "⚽", "🏆", "💰", "📌", "✅", "❌",
  "☺️", "🥰", "😌", "😉", "💋", "😙", "😚", "💑", "💏",
  "💞", "💕", "💗", "💖", "💘", "😻", "🌙", "🌛", "🌜", "⭐",
  "🌝", "🤭", "🌚",
];

// ─── Skeleton Message Component ─────────────────────────────────────
const SkeletonMessage = ({ isOwn }) => {
  const randomWidth = useCallback(() => {
    const widths = ["w-32", "w-40", "w-48", "w-52", "w-56", "w-36", "w-44", "w-60"];
    return widths[Math.floor(Math.random() * widths.length)];
  }, []);
  const randomHeight = useCallback(() => {
    const heights = ["h-8", "h-10", "h-12", "h-9", "h-11"];
    return heights[Math.floor(Math.random() * heights.length)];
  }, []);

  return (
    <div className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""} animate-pulse`}>
      {!isOwn && (
        <div className="w-8 h-8 rounded-full flex-shrink-0 bg-gray-200 dark:bg-gray-700" />
      )}
      <div className={`max-w-[75%] sm:max-w-[85%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        {!isOwn && (
          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded-full mb-0.5" />
        )}
        <div className={`px-4 py-2.5 rounded-2xl ${isOwn ? "bg-teal-200/60 dark:bg-teal-700/40" : "bg-gray-200 dark:bg-gray-700/60"}`}>
          <div className={`${randomWidth()} ${randomHeight()} rounded-lg`} />
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <div className="w-8 h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="w-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      </div>
    </div>
  );
};

const SkeletonMessages = ({ count = 6 }) => {
  return (
    <div className="space-y-4 pt-4">
      <div className="flex justify-center my-3">
        <div className="w-24 h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      </div>
      {Array.from({ length: count }).map((_, i) => {
        const isOwn = i % 2 === 0;
        if (i === 3) {
          return (
            <React.Fragment key={i}>
              <div className="flex justify-center my-3">
                <div className="w-20 h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
              </div>
              <SkeletonMessage isOwn={isOwn} />
            </React.Fragment>
          );
        }
        return <SkeletonMessage key={i} isOwn={isOwn} />;
      })}
    </div>
  );
};

// ─── Media Picker Modal ──────────────────────────────────────────────
const MediaPickerModal = ({ isOpen, onClose, onTakePhoto, onChooseFromGallery, brandColor }) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#14141a] rounded-t-2xl w-full max-w-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Choose Media
        </h3>
        <div className="space-y-2">
          <button
            onClick={onTakePhoto}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            <FaCamera className="text-sm" />
            <span className="text-sm font-medium">Take Photo</span>
          </button>
          <button
            onClick={onChooseFromGallery}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            <FaImage className="text-sm" />
            <span className="text-sm font-medium">Choose from Gallery</span>
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full mt-3 py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/60 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/30 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Media Preview Component (with edit button always visible) ──────
const MediaPreview = ({ mediaFile, onRemove, onSend, brandColor, isSending, onEdit }) => {
  const [preview, setPreview] = useState(null);
  const [type, setType] = useState(null);

  useEffect(() => {
    if (mediaFile) {
      const url = URL.createObjectURL(mediaFile);
      setPreview(url);
      setType(mediaFile.type.startsWith('image/') ? 'image' : 'file');
      return () => URL.revokeObjectURL(url);
    }
  }, [mediaFile]);

  if (!mediaFile || !preview) return null;

  return (
    <div className="flex items-center gap-3 p-3 mb-2 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-200 dark:border-gray-700/60">
      <div className="relative flex-shrink-0">
        {type === 'image' ? (
          <img src={preview} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-2xl">
            📄
          </div>
        )}
        {type === 'image' && (
          <button
            onClick={onEdit}
            className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg text-white text-sm"
          >
            <FaPencilAlt className="text-lg" />
          </button>
        )}
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition text-xs"
        >
          <FaTimes />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{mediaFile.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {(mediaFile.size / 1024).toFixed(1)} KB
        </p>
      </div>
      <button
        onClick={() => onSend(mediaFile)}
        disabled={isSending}
        className="px-4 py-2 text-white rounded-lg hover:opacity-80 transition text-sm font-medium flex-shrink-0 disabled:opacity-50"
        style={{ backgroundColor: brandColor }}
      >
        <FaPaperPlane className="inline mr-1 text-xs" /> Send
      </button>
    </div>
  );
};

// ─── Image Editor Full‑Screen (cleaned header, same as GeneralChatId) ──
const MIN_CROP_SIZE = 40;

const ImageEditorScreen = ({ file, onSave, onCancel, brandColor }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [image, setImage] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [drawMode, setDrawMode] = useState("pencil");
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [drawings, setDrawings] = useState([]);
  const [cropBox, setCropBox] = useState(null);
  const [cropTouched, setCropTouched] = useState(false);

  const currentPathRef = useRef(null);
  const arrowStartRef = useRef(null);
  const arrowPreviewRef = useRef(null);
  const isPointerDownRef = useRef(false);
  const pointerIdRef = useRef(null);
  const cropDragRef = useRef(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setImage(img);
        setImageLoaded(true);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    return () => {
      cancelled = true;
    };
  }, [file]);

  const recomputeLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container || !image) return;
    const availW = Math.max(container.clientWidth - 24, 50);
    const availH = Math.max(container.clientHeight - 24, 50);
    const ratio = image.width / image.height;
    let w = availW;
    let h = w / ratio;
    if (h > availH) {
      h = availH;
      w = h * ratio;
    }
    w = Math.max(1, Math.floor(w));
    h = Math.max(1, Math.floor(h));

    setDisplaySize((prev) =>
      prev.width === w && prev.height === h ? prev : { width: w, height: h }
    );

    const canvas = canvasRef.current;
    if (canvas) {
      if (canvas.width !== image.width || canvas.height !== image.height) {
        canvas.width = image.width;
        canvas.height = image.height;
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    setCropBox((prev) => (cropTouched && prev ? prev : { x: 0, y: 0, w, h }));
  }, [image, cropTouched]);

  useEffect(() => {
    if (imageLoaded) recomputeLayout();
  }, [imageLoaded, recomputeLayout]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => recomputeLayout());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [recomputeLayout]);

  const drawArrowOnCtx = (ctx, from, to, lineWidth) => {
    const headlen = Math.max(10, lineWidth * 3.5);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = "#ff3b30";
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - headlen * Math.cos(angle - Math.PI / 6),
      to.y - headlen * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - headlen * Math.cos(angle + Math.PI / 6),
      to.y - headlen * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const scale = displaySize.width ? canvas.width / displaySize.width : 1;
    const lineWidth = 3 * scale;

    drawings.forEach((d) => {
      if (d.type === "pencil" && d.points?.length > 1) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(d.points[0].x, d.points[0].y);
        for (let i = 1; i < d.points.length; i++) {
          ctx.lineTo(d.points[i].x, d.points[i].y);
        }
        ctx.strokeStyle = "#ff3b30";
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      } else if (d.type === "arrow") {
        drawArrowOnCtx(ctx, d.from, d.to, lineWidth);
      }
    });

    if (currentPathRef.current && currentPathRef.current.length > 1) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(currentPathRef.current[0].x, currentPathRef.current[0].y);
      for (let i = 1; i < currentPathRef.current.length; i++) {
        ctx.lineTo(currentPathRef.current[i].x, currentPathRef.current[i].y);
      }
      ctx.strokeStyle = "#ff3b30";
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    if (arrowPreviewRef.current) {
      drawArrowOnCtx(
        ctx,
        arrowPreviewRef.current.from,
        arrowPreviewRef.current.to,
        lineWidth
      );
    }
  }, [image, drawings, displaySize]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getNaturalCoords = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return {
      x: Math.min(Math.max(x, 0), canvas.width),
      y: Math.min(Math.max(y, 0), canvas.height),
    };
  };

  const handleCanvasPointerDown = (e) => {
    if (drawMode === "crop") return;
    e.preventDefault();
    const canvas = canvasRef.current;
    canvas?.setPointerCapture?.(e.pointerId);
    isPointerDownRef.current = true;
    pointerIdRef.current = e.pointerId;
    const coords = getNaturalCoords(e.clientX, e.clientY);
    if (drawMode === "pencil") {
      currentPathRef.current = [coords];
    } else if (drawMode === "arrow") {
      arrowStartRef.current = coords;
      arrowPreviewRef.current = { from: coords, to: coords };
    }
    redraw();
  };

  const handleCanvasPointerMove = (e) => {
    if (!isPointerDownRef.current) return;
    e.preventDefault();
    const coords = getNaturalCoords(e.clientX, e.clientY);
    if (drawMode === "pencil" && currentPathRef.current) {
      currentPathRef.current = [...currentPathRef.current, coords];
      redraw();
    } else if (drawMode === "arrow" && arrowStartRef.current) {
      arrowPreviewRef.current = { from: arrowStartRef.current, to: coords };
      redraw();
    }
  };

  const handleCanvasPointerUp = (e) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    const canvas = canvasRef.current;
    canvas?.releasePointerCapture?.(pointerIdRef.current);
    pointerIdRef.current = null;

    if (
      drawMode === "pencil" &&
      currentPathRef.current &&
      currentPathRef.current.length > 1
    ) {
      const path = currentPathRef.current;
      setDrawings((prev) => [...prev, { type: "pencil", points: path }]);
    }
    currentPathRef.current = null;

    if (drawMode === "arrow" && arrowStartRef.current && arrowPreviewRef.current) {
      const { from, to } = arrowPreviewRef.current;
      const canvasEl = canvasRef.current;
      const scale =
        displaySize.width && canvasEl ? canvasEl.width / displaySize.width : 1;
      const minDist = 10 * scale;
      if (Math.hypot(to.x - from.x, to.y - from.y) >= minDist) {
        setDrawings((prev) => [...prev, { type: "arrow", from, to }]);
      }
    }
    arrowStartRef.current = null;
    arrowPreviewRef.current = null;
    redraw();
  };

  const handleUndoLast = () => {
    setDrawings((prev) => prev.slice(0, -1));
  };

  const handleReset = () => {
    setDrawings([]);
    setCropTouched(false);
    if (displaySize.width) {
      setCropBox({ x: 0, y: 0, w: displaySize.width, h: displaySize.height });
    }
  };

  const startCropDrag = (mode) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    cropDragRef.current = {
      mode,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startBox: { ...cropBox },
    };
  };

  const handleCropOverlayPointerMove = (e) => {
    const drag = cropDragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const { x, y, w, h } = drag.startBox;
    const maxW = displaySize.width;
    const maxH = displaySize.height;
    let next = { x, y, w, h };

    if (drag.mode === "move") {
      next.x = Math.min(Math.max(x + dx, 0), Math.max(maxW - w, 0));
      next.y = Math.min(Math.max(y + dy, 0), Math.max(maxH - h, 0));
    } else {
      if (drag.mode.includes("l")) {
        const newX = Math.min(Math.max(x + dx, 0), x + w - MIN_CROP_SIZE);
        next.w = x + w - newX;
        next.x = newX;
      }
      if (drag.mode.includes("r")) {
        next.w = Math.min(Math.max(w + dx, MIN_CROP_SIZE), maxW - x);
      }
      if (drag.mode.includes("t")) {
        const newY = Math.min(Math.max(y + dy, 0), y + h - MIN_CROP_SIZE);
        next.h = y + h - newY;
        next.y = newY;
      }
      if (drag.mode.includes("b")) {
        next.h = Math.min(Math.max(h + dy, MIN_CROP_SIZE), maxH - y);
      }
    }
    setCropBox(next);
    setCropTouched(true);
  };

  const handleCropOverlayPointerUp = (e) => {
    if (cropDragRef.current && e.pointerId === cropDragRef.current.pointerId) {
      cropDragRef.current = null;
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let finalCanvas = canvas;

    if (cropBox && displaySize.width && displaySize.height) {
      const scaleX = canvas.width / displaySize.width;
      const scaleY = canvas.height / displaySize.height;
      const sx = Math.round(cropBox.x * scaleX);
      const sy = Math.round(cropBox.y * scaleY);
      const sw = Math.round(cropBox.w * scaleX);
      const sh = Math.round(cropBox.h * scaleY);
      const isFullFrame =
        sx <= 1 &&
        sy <= 1 &&
        Math.abs(sw - canvas.width) <= 2 &&
        Math.abs(sh - canvas.height) <= 2;
      if (!isFullFrame && sw > 0 && sh > 0) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = sw;
        tempCanvas.height = sh;
        const ctx = tempCanvas.getContext("2d");
        ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        finalCanvas = tempCanvas;
      }
    }

    const mimeType =
      file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
    const quality = mimeType === "image/jpeg" ? 0.95 : undefined;
    finalCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const newFile = new File([blob], file.name, { type: mimeType });
        onSave(newFile);
      },
      mimeType,
      quality
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-[#0f0f12] flex flex-col">
      {/* Header - Responsive layout for mobile */}
      <div className="flex items-center justify-between flex-wrap gap-1 sm:gap-2 p-2 sm:p-4 border-b border-gray-200 dark:border-gray-800/60 flex-shrink-0">
        <button
          onClick={onCancel}
          className="p-1 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition"
        >
          <FaArrowLeft className="text-lg sm:text-xl" />
        </button>

        <h3 className="font-semibold text-gray-800 dark:text-gray-200 hidden sm:block">
          Edit Image
        </h3>

        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
          <button
            onClick={() => setDrawMode("pencil")}
            className={`p-1.5 sm:p-2 rounded-lg transition ${drawMode === "pencil"
                ? "bg-teal-100 dark:bg-teal-800/40 text-teal-600 dark:text-teal-400"
                : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/30"
              }`}
          >
            <FaPencilAlt className="text-sm sm:text-base" />
          </button>
          <button
            onClick={() => setDrawMode("arrow")}
            className={`relative p-1.5 sm:p-2 rounded-lg transition ${drawMode === "arrow"
                ? "bg-teal-100 dark:bg-teal-800/40 text-teal-600 dark:text-teal-400"
                : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/30"
              }`}
          >
            <FaArrowRight className="text-sm sm:text-base" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-teal-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold leading-none">
              +
            </span>
          </button>
          <button
            onClick={() => setDrawMode("crop")}
            className={`p-1.5 sm:p-2 rounded-lg transition ${drawMode === "crop"
                ? "bg-teal-100 dark:bg-teal-800/40 text-teal-600 dark:text-teal-400"
                : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/30"
              }`}
          >
            <FaCrop className="text-sm sm:text-base" />
          </button>
          <button
            onClick={handleUndoLast}
            disabled={drawings.length === 0}
            title="Undo last stroke"
            className="p-1.5 sm:p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition disabled:opacity-30"
          >
            <FaUndoAlt className="text-sm sm:text-base" />
          </button>
        </div>

        <button
          onClick={handleSave}
          className="px-3 py-1.5 sm:px-4 sm:py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-xs sm:text-sm font-medium flex items-center gap-2"
        >
          <FaSave className="text-xs sm:text-sm" />
          <span className="hidden sm:inline">Apply</span>
        </button>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-1.5 flex-shrink-0">
        {drawMode === "crop"
          ? "Drag the corners or box to crop"
          : drawMode === "arrow"
            ? "Drag on the photo to draw an arrow"
            : "Draw freehand on the photo"}
      </p>

      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-3 overflow-hidden"
      >
        <div
          className="relative touch-none select-none"
          style={{
            width: displaySize.width || undefined,
            height: displaySize.height || undefined,
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            className="block rounded-lg touch-none max-w-full max-h-full"
            style={{ cursor: drawMode === "crop" ? "default" : "crosshair" }}
          />

          {drawMode === "crop" && cropBox && displaySize.width > 0 && (
            <div
              className="absolute inset-0 touch-none"
              onPointerMove={handleCropOverlayPointerMove}
              onPointerUp={handleCropOverlayPointerUp}
              onPointerCancel={handleCropOverlayPointerUp}
            >
              {/* dark mask */}
              <div
                className="absolute bg-black/50 pointer-events-none"
                style={{ left: 0, top: 0, right: 0, height: cropBox.y }}
              />
              <div
                className="absolute bg-black/50 pointer-events-none"
                style={{
                  left: 0,
                  top: cropBox.y + cropBox.h,
                  right: 0,
                  bottom: 0,
                }}
              />
              <div
                className="absolute bg-black/50 pointer-events-none"
                style={{
                  left: 0,
                  top: cropBox.y,
                  width: cropBox.x,
                  height: cropBox.h,
                }}
              />
              <div
                className="absolute bg-black/50 pointer-events-none"
                style={{
                  left: cropBox.x + cropBox.w,
                  top: cropBox.y,
                  right: 0,
                  height: cropBox.h,
                }}
              />

              {/* crop box body */}
              <div
                onPointerDown={startCropDrag("move")}
                className="absolute border-2 border-teal-400 touch-none"
                style={{
                  left: cropBox.x,
                  top: cropBox.y,
                  width: cropBox.w,
                  height: cropBox.h,
                  cursor: "move",
                }}
              >
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="border border-white/25" />
                  ))}
                </div>
              </div>

              {/* four corner handles */}
              {[
                { key: "tl", x: cropBox.x, y: cropBox.y, cursor: "nwse-resize" },
                { key: "tr", x: cropBox.x + cropBox.w, y: cropBox.y, cursor: "nesw-resize" },
                { key: "bl", x: cropBox.x, y: cropBox.y + cropBox.h, cursor: "nesw-resize" },
                { key: "br", x: cropBox.x + cropBox.w, y: cropBox.y + cropBox.h, cursor: "nwse-resize" },
              ].map((c) => (
                <div
                  key={c.key}
                  onPointerDown={startCropDrag(c.key)}
                  className="absolute w-7 h-7 -ml-3.5 -mt-3.5 flex items-center justify-center touch-none"
                  style={{ left: c.x, top: c.y, cursor: c.cursor }}
                >
                  <div className="w-4 h-4 bg-teal-400 border-2 border-white rounded-sm shadow" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
            className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-teal-600 dark:bg-[#0d9488] hover:bg-teal-700 dark:hover:bg-[#0f9e96]"}`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Message Action Modal (with Copy) ──────────────────────────────
const MessageActionModal = ({
  isOpen,
  onClose,
  message,
  isOwn,
  isStarred,
  isArchived,
  onDelete,
  onArchive,
  onUnarchive,
  onStar,
  onUnstar,
  onReply,
  onCopy,
  brandColor,
}) => {
  if (!isOpen || !message) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#14141a] rounded-t-2xl w-full max-w-lg p-5"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "70vh", overflowY: "auto" }}
      >
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700/60">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
            {message.messageType === "image" ? <FaImage className="text-sm" /> : <FaComment className="text-sm" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {message.content ? message.content.substring(0, 60) : message.mediaName || "Media"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(message.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="space-y-1">
          <button
            onClick={() => { onReply(message); onClose(); }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            <FaReply className="text-sm" /> <span className="text-sm font-medium">Reply</span>
          </button>
          <button
            onClick={() => { onCopy(message); onClose(); }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            <FaCopy className="text-sm" /> <span className="text-sm font-medium">Copy</span>
          </button>
          {isOwn && (
            <button
              onClick={() => { onDelete(message._id); onClose(); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
            >
              <FaTrashAlt className="text-sm" /> <span className="text-sm font-medium">Delete for everyone</span>
            </button>
          )}
          {isStarred ? (
            <button
              onClick={() => { onUnstar(message._id); onClose(); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 transition"
            >
              <FaStar className="text-sm" /> <span className="text-sm font-medium">Unstar</span>
            </button>
          ) : (
            <button
              onClick={() => { onStar(message._id); onClose(); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
            >
              <FaRegStar className="text-sm" /> <span className="text-sm font-medium">Star</span>
            </button>
          )}
          {isArchived ? (
            <button
              onClick={() => { onUnarchive(message._id); onClose(); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition"
            >
              <FaUndo className="text-sm" /> <span className="text-sm font-medium">Unarchive</span>
            </button>
          ) : (
            <button
              onClick={() => { onArchive(message._id); onClose(); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
            >
              <FaArchive className="text-sm" /> <span className="text-sm font-medium">Archive</span>
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-3 py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/60 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/30 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Message Ticks ──────────────────────────────────────────────────
const MessageTicks = ({ message, isOwn }) => {
  if (!isOwn) return null;

  if (message._pending) {
    return <FaRegClock className="text-[10px] text-gray-400 dark:text-gray-500" />;
  }
  if (message._failed) {
    return <FaTimes className="text-[10px] text-red-500" />;
  }
  if (!message._sent) {
    return <FaRegClock className="text-[10px] text-gray-400 dark:text-gray-500" />;
  }
  if (!message._delivered && !message._read) {
    return <FaCheck className="text-[10px] text-gray-400 dark:text-gray-500" />;
  }
  if (message._delivered && !message._read) {
    return (
      <span className="inline-flex items-center -space-x-[5px] text-gray-400 dark:text-gray-500">
        <FaCheck className="text-[10px]" />
        <FaCheck className="text-[10px]" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center -space-x-[5px]">
      <FaCheck className="text-[10px]" style={{ color: SEEN_TICK_COLOR }} />
      <FaCheck className="text-[10px]" style={{ color: SEEN_TICK_COLOR }} />
    </span>
  );
};

// ─── Full AudioPlayer (unchanged) ──────────────────────────────────
const AudioPlayer = ({
  src,
  isOwn,
  duration: initialDuration,
  onDurationReady,
  brandColor,
}) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);

  const WAVEFORM_BARS = [
    6, 11, 15, 9, 17, 12, 7, 14, 18, 10, 6, 13, 16, 11, 8, 15, 12, 7, 13, 9, 6, 10,
  ];

  const waveformContainerRef = useRef(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isDraggingRef.current) {
        setCurrentTime(audio.currentTime);
      }
    };
    const handleLoadedMetadata = () => {
      const dur = audio.duration;
      if (dur && !isNaN(dur)) {
        setDuration(dur);
        onDurationReady?.(dur);
      }
    };
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onDurationReady]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const getSeekPosition = (clientX) => {
    const container = waveformContainerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.min(Math.max(x / rect.width, 0), 1);
    return percent * duration;
  };

  const handleSeekStart = (e) => {
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    if (clientX == null) return;
    isDraggingRef.current = true;
    const newTime = getSeekPosition(clientX);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSeekMove = (e) => {
    if (!isDraggingRef.current) return;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    if (clientX == null) return;
    const newTime = getSeekPosition(clientX);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSeekEnd = () => {
    isDraggingRef.current = false;
  };

  const handleWaveformClick = (e) => {
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    if (clientX == null) return;
    const newTime = getSeekPosition(clientX);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2.5 min-w-[220px] py-0.5">
      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : brandColor,
        }}
      >
        {isPlaying ? (
          <FaPause className="text-xs text-white" />
        ) : (
          <FaPlay className="text-xs text-white ml-0.5" />
        )}
      </button>

      <div
        ref={waveformContainerRef}
        className="flex-1 flex items-center h-6 relative cursor-pointer"
        onClick={handleWaveformClick}
        onMouseDown={handleSeekStart}
        onMouseMove={handleSeekMove}
        onMouseUp={handleSeekEnd}
        onMouseLeave={handleSeekEnd}
        onTouchStart={handleSeekStart}
        onTouchMove={handleSeekMove}
        onTouchEnd={handleSeekEnd}
      >
        <div className="flex items-center gap-[2px] h-full w-full">
          {WAVEFORM_BARS.map((h, i) => {
            const barIndex = i / WAVEFORM_BARS.length;
            const isFilled = barIndex <= progressPercent / 100;
            return (
              <span
                key={i}
                className="w-[2.5px] rounded-full transition-all"
                style={{
                  height: `${h * 2}px`,
                  backgroundColor: isOwn
                    ? isFilled
                      ? 'rgba(255,255,255,0.9)'
                      : 'rgba(255,255,255,0.3)'
                    : isFilled
                      ? brandColor
                      : '#d1d5db',
                  opacity: isFilled ? 1 : 0.4,
                }}
              />
            );
          })}
        </div>
      </div>

      <span
        className={`text-[10px] flex-shrink-0 ${isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}
      >
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      <audio ref={audioRef} src={src} className="hidden" />
    </div>
  );
};

// ─── Image Preview Modal ────────────────────────────────────────────
const ImagePreviewModal = ({ imageUrl, onClose, senderName, time }) => {
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleDownload = () => {
    if (imageUrl) {
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = "image";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  useEffect(() => {
    setImageError(false);
    setLoading(true);
  }, [imageUrl]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 bg-black/70 text-white flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition">
            <FaArrowLeft />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{senderName || "Photo"}</p>
            {time && <p className="text-[11px] text-white/60">{time}</p>}
          </div>
        </div>
        {imageUrl && (
          <button onClick={handleDownload} className="p-2 hover:bg-white/10 rounded-lg transition">
            <FaDownload />
          </button>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        {loading && (
          <div className="flex flex-col items-center text-white/60">
            <FaSpinner className="animate-spin text-4xl mb-2" />
            <span className="text-sm">Loading...</span>
          </div>
        )}
        {imageError || !imageUrl ? (
          <div className="flex flex-col items-center text-white/60">
            <FaExclamationTriangle className="text-4xl mb-2" />
            <span className="text-sm">Image not available</span>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setImageError(true); }}
          />
        )}
      </div>
    </div>
  );
};

// ─── Quoted Reply Block ─────────────────────────────────────────────
const QuotedReplyBlock = ({ replyData, isOwn, brandColor, onJump }) => {
  if (!replyData) return null;
  const name = replyData.senderName || "Unknown";
  const text = replyData.content
    ? replyData.content
    : replyData.mediaName
    ? `📎 ${replyData.mediaName}`
    : replyData.messageType === "image"
    ? "📷 Photo"
    : replyData.messageType === "audio"
    ? "🎤 Voice note"
    : "Media";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onJump && onJump(replyData.id);
      }}
      className={`block w-full text-left mb-1.5 px-2.5 py-1.5 rounded-lg border-l-2 text-xs cursor-pointer transition ${
        isOwn
          ? "bg-black/10 border-white/60 hover:bg-black/20"
          : "bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.1]"
      }`}
      style={!isOwn ? { borderLeftColor: brandColor } : {}}
    >
      <p className={`font-semibold truncate ${isOwn ? "text-white/90" : ""}`} style={isOwn ? {} : { color: brandColor }}>
        {name}
      </p>
      <p className={`truncate ${isOwn ? "text-white/70" : "text-gray-500 dark:text-gray-400"}`}>{text}</p>
    </button>
  );
};

// ─── Reply Preview Bar ──────────────────────────────────────────────
const ReplyPreview = ({ replyTo, onCancel, brandColor, resolveSender }) => {
  if (!replyTo) return null;
  const sender = resolveSender ? resolveSender(replyTo.sender) : replyTo.sender;
  const senderName = sender?.name || "Unknown";
  const content = replyTo.content || (replyTo.mediaName ? `📎 ${replyTo.mediaName}` : "Media");
  return (
    <div className="flex items-center justify-between px-3 py-2 mb-2 bg-gray-100 dark:bg-gray-800/60 rounded-lg border-l-4 border-teal-500 dark:border-[#0d9488]">
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">Replying to {senderName}</span>
        <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{content}</p>
      </div>
      <button onClick={onCancel} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition">
        <FaTimes className="text-sm" />
      </button>
    </div>
  );
};

// ─── Media Message Component (with link previews and copy) ──────────
const MediaMessage = ({
  message,
  isOwn,
  isDM,
  senderName,
  senderProfile,
  brandColor,
  onImageClick,
  onDelete,
  onArchive,
  onUnarchive,
  onStar,
  onUnstar,
  onReply,
  onCopy,
  userId,
  isMobile,
  onLongPress,
  allMessages,
  onJumpToMessage,
  resolveSender,
}) => {
  // ── Deleted state ──
  if (message.isDeleted) {
    return (
      <div className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
        {!isOwn && (
          <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <FaUser className="text-gray-400 dark:text-gray-500" />
          </div>
        )}
        <div className="bg-gray-100 dark:bg-gray-800/40 px-4 py-2 rounded-2xl text-gray-400 dark:text-gray-500 italic text-sm flex items-center gap-1">
          <span>Message deleted</span>
          <span className="text-[10px] ml-1 opacity-60">{safeFormatTime(message.createdAt)}</span>
        </div>
      </div>
    );
  }

  const time = safeFormatTime(message.createdAt);
  const [showMenu, setShowMenu] = useState(false);
  const longPressTimer = useRef(null);
  const isLongPress = useRef(false);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const [swipeX, setSwipeX] = useState(0);
  const swipeTriggered = useRef(false);
  const swipeActive = useRef(false);

  const isArchived = message.archivedBy?.some((id) => id === userId) || false;
  const isStarred = message.starredBy?.some((id) => id === userId) || false;

  const replyPreview = (() => {
    const replyTo = message?.replyTo;
    if (!replyTo) return null;
    if (typeof replyTo === "object") {
      const resolvedSender = resolveSender ? resolveSender(replyTo.sender) : replyTo.sender;
      return {
        id: replyTo._id,
        senderName: resolvedSender?.name || replyTo.senderName || "Unknown",
        content: replyTo.content,
        mediaName: replyTo.mediaName,
        messageType: replyTo.messageType,
      };
    }
    const original = allMessages?.find((m) => m._id === replyTo);
    if (!original) return null;
    const resolvedSender = resolveSender ? resolveSender(original.sender) : original.sender;
    return {
      id: original._id,
      senderName: resolvedSender?.name || "Unknown",
      content: original.content,
      mediaName: original.mediaName,
      messageType: original.messageType,
    };
  })();

  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleTouchStart = (e) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPress.current = false;
    swipeTriggered.current = false;
    swipeActive.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress(message);
    }, 500);
  };

  const handleTouchMove = (e) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
    if (deltaX > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
      swipeActive.current = true;
      const capped = Math.min(deltaX, SWIPE_REPLY_MAX);
      setSwipeX(capped);
      if (capped >= SWIPE_REPLY_THRESHOLD && !swipeTriggered.current) {
        swipeTriggered.current = true;
        if (navigator.vibrate) navigator.vibrate(10);
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (!isMobile) return;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (swipeTriggered.current) {
      onReply(message);
    }
    setSwipeX(0);
    swipeTriggered.current = false;
    if (isLongPress.current || swipeActive.current) {
      e.preventDefault();
      isLongPress.current = false;
      swipeActive.current = false;
    }
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    if (message.mediaUrl) {
      const link = document.createElement("a");
      link.href = message.mediaUrl;
      link.download = message.mediaName || "file";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderMediaContent = () => {
    if (!message.mediaUrl) return null;
    switch (message.messageType) {
      case "image":
        return null;
      case "video":
        return <video src={message.mediaUrl} controls className="max-w-full rounded-lg max-h-80" />;
      case "audio":
        return (
          <AudioPlayer
            src={message.mediaUrl}
            isOwn={isOwn}
            duration={message.mediaDuration}
            brandColor={brandColor}
            onDurationReady={(dur) => {
              // optionally update message.mediaDuration if needed
            }}
          />
        );
      case "file":
        return (
          <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800/60 rounded-lg p-3 min-w-[200px]">
            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
              📄
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{message.mediaName || "File"}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{message.mediaSize ? `${(message.mediaSize / 1024).toFixed(1)} KB` : "File"}</div>
            </div>
            <button onClick={handleDownload} className="text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
              <FaDownload className="text-sm" />
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const swipeStyle = {
    transform: `translateX(${swipeX}px)`,
    transition: swipeX === 0 ? "transform 0.2s ease" : "none",
  };
  const swipeIconOpacity = Math.min(swipeX / SWIPE_REPLY_THRESHOLD, 1);

  const maxWidthClass = isMobile ? "max-w-[75%]" : "max-w-[85%]";

  // ─── Link preview ──────────────────────────────────────────────────
  const firstUrl = extractFirstUrl(message.content);

  // ─── Image messages ────────────────────────────────────────────────
  if (message.messageType === "image") {
    return (
      <div
        data-message-id={message._id}
        className="relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        {isMobile && swipeX > 0 && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" style={{ opacity: swipeIconOpacity }}>
            <FaReply className="text-sm" />
          </div>
        )}
        <div className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`} style={isMobile ? swipeStyle : undefined}>
          {!isOwn && (
            <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
              {senderProfile ? (
                <img src={senderProfile} alt={senderName} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: brandColor }}
                >
                  {senderName?.charAt(0).toUpperCase() || "?"}
                </div>
              )}
            </div>
          )}
          <div className={`${maxWidthClass} ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
            {!isOwn && <span className="text-xs font-medium text-gray-600 dark:text-gray-300 ml-1 mb-0.5">{senderName}</span>}
            {replyPreview && (
              <div className="w-full mb-1">
                <QuotedReplyBlock replyData={replyPreview} isOwn={isOwn} brandColor={brandColor} onJump={onJumpToMessage} />
              </div>
            )}
            <div
              className="relative rounded-2xl overflow-hidden cursor-pointer group"
              onClick={() =>
                onImageClick &&
                onImageClick({ url: message.mediaUrl, senderName: isOwn ? "You" : senderName, time })
              }
            >
              <img src={message.mediaUrl} alt={message.mediaName || "Image"} className="max-w-full max-h-80 object-cover w-full" />
              <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 text-[10px] text-white bg-black/50 px-2 py-0.5 rounded-full">
                <span>{time}</span>
                <MessageTicks message={message} isOwn={isOwn} />
              </div>
              {!isMobile && (
                <div
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition"
                  ref={menuRef}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(!showMenu);
                    }}
                    className="text-white bg-black/40 p-1 rounded-full hover:bg-black/60"
                  >
                    <FaEllipsisV className="text-xs" />
                  </button>
                  {showMenu && (
                    <div
                      className="absolute right-0 top-8 bg-white dark:bg-[#1e1e26] rounded-lg shadow-lg border border-gray-200 dark:border-gray-800/60 min-w-[160px] z-10 py-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onReply(message);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                      >
                        <FaReply className="text-xs" /> Reply
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onCopy && onCopy(message);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                      >
                        <FaCopy className="text-xs" /> Copy
                      </button>
                      {isOwn && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            onDelete(message._id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition w-full"
                        >
                          <FaTrashAlt className="text-xs" /> Delete
                        </button>
                      )}
                      {isStarred ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            onUnstar(message._id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition w-full"
                        >
                          <FaStar className="text-xs" /> Unstar
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            onStar(message._id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                        >
                          <FaRegStar className="text-xs" /> Star
                        </button>
                      )}
                      {isArchived ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            onUnarchive(message._id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg transition w-full"
                        >
                          <FaUndo className="text-xs" /> Unarchive
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            onArchive(message._id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                        >
                          <FaArchive className="text-xs" /> Archive
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Text / other messages ──────────────────────────────────────────
  return (
    <div
      data-message-id={message._id}
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {isMobile && swipeX > 0 && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" style={{ opacity: swipeIconOpacity }}>
          <FaReply className="text-sm" />
        </div>
      )}
      <div className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`} style={isMobile ? swipeStyle : undefined}>
        {!isOwn && (
          <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
            {senderProfile ? (
              <img src={senderProfile} alt={senderName} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: brandColor }}
              >
                {senderName?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
          </div>
        )}
        <div className={`${maxWidthClass} ${isOwn ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
          {!isOwn && <span className="text-xs font-medium text-gray-600 dark:text-gray-300 ml-1">{senderName}</span>}
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm break-words w-full ${
              isOwn ? "text-white" : "bg-gray-100 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200"
            }`}
            style={isOwn ? { backgroundColor: brandColor } : {}}
          >
            {replyPreview && (
              <QuotedReplyBlock replyData={replyPreview} isOwn={isOwn} brandColor={brandColor} onJump={onJumpToMessage} />
            )}
            {message.content && (
              <p className="mb-2 whitespace-pre-wrap break-words">
                <LinkifiedText text={message.content} isOwn={isOwn} />
              </p>
            )}
            {firstUrl && <LinkPreviewCard url={firstUrl} isOwn={isOwn} brandColor={brandColor} />}
            {renderMediaContent()}
          </div>
          <div className={`flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 ${isOwn ? "flex-row-reverse" : ""}`}>
            <span>{time}</span>
            <MessageTicks message={message} isOwn={isOwn} />
            {!isMobile && (
              <div className="relative ml-2" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-0.5"
                >
                  <FaEllipsisV className="text-xs" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 bottom-6 bg-white dark:bg-[#1e1e26] rounded-lg shadow-lg border border-gray-200 dark:border-gray-800/60 min-w-[160px] z-10 py-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onReply(message);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                    >
                      <FaReply className="text-xs" /> Reply
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onCopy && onCopy(message);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                    >
                      <FaCopy className="text-xs" /> Copy
                    </button>
                    {isOwn && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onDelete(message._id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition w-full"
                      >
                        <FaTrashAlt className="text-xs" /> Delete
                      </button>
                    )}
                    {isStarred ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onUnstar(message._id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition w-full"
                      >
                        <FaStar className="text-xs" /> Unstar
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onStar(message._id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                      >
                        <FaRegStar className="text-xs" /> Star
                      </button>
                    )}
                    {isArchived ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onUnarchive(message._id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg transition w-full"
                      >
                        <FaUndo className="text-xs" /> Unarchive
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onArchive(message._id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                      >
                        <FaArchive className="text-xs" /> Archive
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
const MyWorkspaceChatId = () => {
  const { workspaceId, chatId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userInfo } = useSelector((state) => state.auth);

  // ─── All hooks ──────────────────────────────────────────────────────
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const inputAreaRef = useRef(null); // for dynamic padding
  const [previewImage, setPreviewImage] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [localMessages, setLocalMessages] = useState([]);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [pendingMedia, setPendingMedia] = useState(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  // ── Image editor states ──────────────────────────────────────────
  const [imageToEdit, setImageToEdit] = useState(null);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);

  // ── Emoji panel ──────────────────────────────────────────────────
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const [inputHeight, setInputHeight] = useState(0);

  const [otherUserOnline, setOtherUserOnline] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    danger: false,
  });
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    message: null,
  });

  // ─── Sending lock ──────────────────────────────────────────────────
  const isSendingRef = useRef(false);
  const [isSending, setIsSending] = useState(false);

  const { socket, isConnected } = useSocket();
  const [initiateCall] = useInitiateCallMutation();

  // API hooks
  const {
    data: workspaceData,
    error: workspaceError,
    isLoading: workspaceLoading,
  } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData, isLoading: chatsLoading, refetch: refetchChats } = useGetUserChatsQuery(workspaceId);
  const {
    data: messagesData,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useGetChatMessagesQuery(
    { chatId, page: 1, limit: 50 },
    { skip: !chatId }
  );
  const [sendMessageApi] = useSendMessageMutation();
  const [deleteMessageApi] = useDeleteMessageMutation();
  const [archiveMessage] = useArchiveMessageMutation();
  const [unarchiveMessage] = useUnarchiveMessageMutation();
  const [starMessage] = useStarMessageMutation();
  const [unstarMessage] = useUnstarMessageMutation();

  // ─── Voice recording states ──────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [showRecordedPreview, setShowRecordedPreview] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const isRecordingRef = useRef(false);
  const isNative = Capacitor.isNativePlatform();

  // ─── Scroll state ──────────────────────────────────────────────────
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // ─── Memoized data ────────────────────────────────────────────────
  const workspace = useMemo(() => workspaceData?.workspace, [workspaceData]);
  const chats = useMemo(() => chatsData?.chats || [], [chatsData]);
  const chat = useMemo(() => {
    if (!chats.length || !chatId) return null;
    return chats.find((c) => c._id === chatId) || null;
  }, [chats, chatId]);

  const otherParticipant = useMemo(() => {
    if (!chat || chat.type !== "direct") return null;
    return chat.participants?.find(
      (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
    )?.user || null;
  }, [chat, userInfo]);

  const brandColor = workspace?.color || "#0d9488";
  const displayName = otherParticipant?.name || "Unknown";
  const displayAvatar = otherParticipant?.profile || null;

  // ─── Resolve sender ──────────────────────────────────────────────
  const userMapRef = useRef(new Map());

  const resolveSender = useCallback((senderField) => {
    if (!senderField) return { name: "Unknown", profile: null };
    if (typeof senderField === "string") {
      const found = userMapRef.current.get(senderField);
      if (found) {
        const name = found.name || found.username || found.email || "Unknown";
        return { ...found, name };
      }
      return { _id: senderField, name: "Unknown", profile: null };
    }
    if (senderField.name) return senderField;
    const found = senderField._id ? userMapRef.current.get(senderField._id) : null;
    if (found) {
      const name = found.name || found.username || found.email || "Unknown";
      return {
        ...senderField,
        name: found.name || found.username || found.email || "Unknown",
        profile: found.profile ?? senderField.profile,
      };
    }
    const name = senderField.username || senderField.email || "Unknown";
    return { ...senderField, name };
  }, []);

  // ─── Populate user map ────────────────────────────────────────────
  useEffect(() => {
    if (workspace?.members) {
      const map = new Map();
      workspace.members.forEach((m) => {
        const user = m.user || m;
        if (user._id) map.set(user._id, user);
      });
      if (otherParticipant?._id) map.set(otherParticipant._id, otherParticipant);
      if (userInfo?._id) map.set(userInfo._id, userInfo);
      userMapRef.current = map;
    }
  }, [workspace, otherParticipant, userInfo]);

  // ─── Duplicate detection ──────────────────────────────────────────
  const isRecentDuplicateMedia = useCallback(
    (signature) => {
      const now = Date.now();
      return localMessages.some((m) => {
        const isOwnMsg =
          m.sender?._id === userInfo?._id || m.sender === userInfo?._id;
        if (!isOwnMsg) return false;
        if (!m.mediaSignature) return false;
        if (m.mediaSignature !== signature) return false;
        const msgTime = new Date(m.createdAt).getTime();
        return now - msgTime < 4000;
      });
    },
    [localMessages, userInfo]
  );

  // ─── Merge messages into state (unchanged) ─────────────────────────
  const mergeMessagesIntoState = useCallback(
    (incomingList) => {
      if (!incomingList || incomingList.length === 0) return;
      setLocalMessages((prev) => {
        let next = prev;
        let mutated = false;

        incomingList.forEach((incoming) => {
          const isOwn = incoming.sender?._id === userInfo?._id || incoming.sender === userInfo?._id;

          // 1. Already exists by real _id?
          const existingIdx = next.findIndex((m) => m._id === incoming._id);
          if (existingIdx > -1) {
            if (!mutated) next = [...next];
            mutated = true;
            const existing = next[existingIdx];
            const updated = {
              ...incoming,
              _sent: existing._sent || false,
              _pending: existing._pending || false,
              _failed: existing._failed || false,
              _delivered: true,
              _read: false,
            };
            if (isOwn) {
              const otherId = otherParticipant?._id;
              if (otherId && incoming.readBy?.some((r) => r.user === otherId || r.user?._id === otherId)) {
                updated._read = true;
              }
            } else {
              if (incoming.readBy?.some((r) => r.user === userInfo?._id || r.user?._id === userInfo?._id)) {
                updated._read = true;
              }
            }
            next[existingIdx] = updated;
            return;
          }

          // 2. Try to replace a temporary message (ours)
          if (isOwn) {
            let tempIdx = -1;
            // Primary: match by clientMsgId
            if (incoming.clientMsgId) {
              tempIdx = next.findIndex((m) => m._tempId === incoming.clientMsgId);
            }
            // Fallback: _tempId equals incoming._id (legacy)
            if (tempIdx === -1) {
              tempIdx = next.findIndex((m) => m._tempId === incoming._id);
            }
            // Last-resort: content + timestamp
            if (tempIdx === -1) {
              const incomingContent = incoming.content || '';
              const incomingTime = new Date(incoming.createdAt).getTime();
              tempIdx = next.findIndex((m) => {
                if (!m._temp) return false;
                if (m.content !== undefined && m.content === incomingContent) {
                  const mTime = new Date(m.createdAt).getTime();
                  return Math.abs(mTime - incomingTime) < 10000;
                }
                if (m.mediaName && m.mediaName === incoming.mediaName) {
                  const mTime = new Date(m.createdAt).getTime();
                  return Math.abs(mTime - incomingTime) < 20000;
                }
                return false;
              });
            }
            if (tempIdx > -1) {
              if (!mutated) next = [...next];
              mutated = true;
              const realMsg = {
                ...incoming,
                _temp: false,
                _tempId: undefined,
                _pending: false,
                _failed: false,
                _sent: true,
                _delivered: true,
                _read: false,
              };
              const otherId = otherParticipant?._id;
              if (otherId && incoming.readBy?.some((r) => r.user === otherId || r.user?._id === otherId)) {
                realMsg._read = true;
              }
              next[tempIdx] = realMsg;
              return;
            }
          }

          // 3. New message (not temporary)
          const msg = {
            ...incoming,
            _sent: true,
            _pending: false,
            _failed: false,
            _delivered: true,
            _read: false,
          };
          if (isOwn) {
            const otherId = otherParticipant?._id;
            if (otherId && incoming.readBy?.some((r) => r.user === otherId || r.user?._id === otherId)) {
              msg._read = true;
            }
          } else {
            if (incoming.readBy?.some((r) => r.user === userInfo?._id || r.user?._id === userInfo?._id)) {
              msg._read = true;
            }
          }
          if (!mutated) next = [...next];
          mutated = true;
          next.push(msg);
        });

        return mutated ? next : prev;
      });
    },
    [userInfo?._id, otherParticipant?._id]
  );

  // ─── Initial messages ─────────────────────────────────────────────
  useEffect(() => {
    if (messagesData?.messages) {
      mergeMessagesIntoState(messagesData.messages);
    }
  }, [messagesData, mergeMessagesIntoState]);

  // ─── Socket events (unchanged) ──────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected || !chatId) return;
    socket.emit("join-chat", chatId);

    if (otherParticipant?._id) {
      socket.emit("request-presence", { userId: otherParticipant._id }, (response) => {
        if (response && typeof response.online === "boolean") {
          setOtherUserOnline(response.online);
        }
      });
    }

    const handleNewMessage = (incoming) => {
      const incomingChatId = typeof incoming.chat === "string" ? incoming.chat : incoming.chat?._id;
      if (incomingChatId && incomingChatId !== chatId) return;
      mergeMessagesIntoState([incoming]);
    };

    const handleMessageDeleted = ({ messageId }) => {
      setLocalMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, isDeleted: true } : m))
      );
    };

    const handleMessageRead = ({ chatId: readChatId, messageId, readBy }) => {
      if (readChatId !== chatId) return;
      setLocalMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, _read: true } : msg
        )
      );
    };

    const handleUserStatusChange = ({ userId, online, chatId: statusChatId }) => {
      if (statusChatId !== chatId) return;
      if (userId === otherParticipant?._id) {
        setOtherUserOnline(online);
      }
    };

    socket.on("new-message", handleNewMessage);
    socket.on("message-deleted", handleMessageDeleted);
    socket.on("message-read", handleMessageRead);
    socket.on("user-status-changed", handleUserStatusChange);

    return () => {
      socket.emit("leave-chat", chatId);
      socket.off("new-message", handleNewMessage);
      socket.off("message-deleted", handleMessageDeleted);
      socket.off("message-read", handleMessageRead);
      socket.off("user-status-changed", handleUserStatusChange);
    };
  }, [socket, isConnected, chatId, mergeMessagesIntoState, otherParticipant?._id]);

  // ─── Polling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatId) return;
    const interval = setInterval(() => {
      if (!isConnected) {
        refetchMessages();
        refetchChats();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [chatId, isConnected, refetchMessages, refetchChats]);

  // ─── Focus input on reply ─────────────────────────────────────────
  useEffect(() => {
    if (searchParams.get("focusInput") === "true") {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [searchParams]);

  // ─── Scroll behavior ──────────────────────────────────────────────
  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 50;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
    if (atBottom) setShowScrollDown(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollDown(false);
  };

  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      setShowScrollDown(true);
    }
  }, [localMessages.length, isAtBottom]);

  // ─── Auto-resize textarea ─────────────────────────────────────────
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = inputRef.current.scrollHeight + "px";
    }
  }, [message]);

  // ─── ResizeObserver for input height (for padding) ──────────────
  useEffect(() => {
    if (!inputAreaRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setInputHeight(entry.contentRect.height);
      }
    });
    observer.observe(inputAreaRef.current);
    return () => observer.disconnect();
  }, []);

  // ─── Emoji toggle ──────────────────────────────────────────────────
  const toggleEmoji = useCallback(() => {
    setShowEmojiPicker((prev) => {
      if (!prev) {
        inputRef.current?.blur();
      } else {
        inputRef.current?.focus();
      }
      return !prev;
    });
  }, []);

 const handleEmojiSelect = (emoji) => {
  setMessage((prev) => prev + emoji);
};

  // ─── Mark message as read ──────────────────────────────────────────
  const markMessageAsRead = useCallback((messageId) => {
    if (!socket || !isConnected) return;
    const msg = localMessages.find((m) => m._id === messageId);
    if (!msg || msg._read || msg.sender?._id === userInfo?._id) return;
    socket.emit("mark-read", { chatId, messageIds: [messageId] });
  }, [socket, isConnected, chatId, localMessages, userInfo]);

  // ─── Intersection Observer for auto‑read ─────────────────────────
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.dataset.messageId;
            if (messageId) {
              const msg = localMessages.find((m) => m._id === messageId);
              if (msg && !msg._read && msg.sender?._id !== userInfo?._id) {
                markMessageAsRead(messageId);
              }
            }
          }
        });
      },
      { threshold: 0.5 }
    );
    const elements = messagesContainerRef.current.querySelectorAll('[data-message-id]');
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [localMessages, markMessageAsRead, userInfo]);

  // ─── Native / Web voice recording (unchanged) ────────────────────
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecordingRef.current) {
        if (isNative) {
          VoiceRecorder.stopRecording().catch(() => {});
        } else {
          mediaRecorderRef.current.stop();
        }
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isNative]);

  const startTimer = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
  };
  const stopTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const startNativeRecording = async () => {
    try {
      const { value: hasPermission } = await VoiceRecorder.hasAudioRecordingPermission();
      if (!hasPermission) {
        const { value: granted } = await VoiceRecorder.requestAudioRecordingPermission();
        if (!granted) {
          toast.error('Microphone permission is required.');
          return;
        }
      }
      await VoiceRecorder.startRecording();
      setIsRecording(true);
      setRecordingPaused(false);
      setRecordingTime(0);
      setShowRecordedPreview(false);
      startTimer();
    } catch (err) {
      console.error('Native recording error:', err);
      toast.error('Failed to start recording: ' + (err.message || ''));
      setIsRecording(false);
    }
  };

  const pauseNativeRecording = async () => {
    try {
      if (recordingPaused) {
        await VoiceRecorder.resumeRecording();
        setRecordingPaused(false);
        startTimer();
      } else {
        await VoiceRecorder.pauseRecording();
        setRecordingPaused(true);
        stopTimer();
      }
    } catch (err) {
      toast.error('Failed to pause/resume recording');
    }
  };

  const stopNativeRecording = async () => {
    try {
      const result = await VoiceRecorder.stopRecording();
      const base64 = result.value.recordDataBase64;
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const audioBlob = new Blob([byteArray], { type: 'audio/m4a' });
      setRecordingBlob(audioBlob);
      setShowRecordedPreview(true);
      stopTimer();
      setIsRecording(false);
    } catch (err) {
      console.error('Stop recording error:', err);
      toast.error('Failed to stop recording');
      setIsRecording(false);
    }
  };

  const cancelNativeRecording = async () => {
    try {
      await VoiceRecorder.stopRecording();
    } catch (_) {}
    setRecordingBlob(null);
    setShowRecordedPreview(false);
    setRecordingTime(0);
    setIsRecording(false);
    stopTimer();
  };

  const startWebRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setRecordingBlob(audioBlob);
        setShowRecordedPreview(true);
        stopTimer();
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingPaused(false);
      setRecordingTime(0);
      setShowRecordedPreview(false);
      startTimer();
    } catch (err) {
      console.error("Web recording error:", err);
      let msg = "Microphone access denied";
      if (err.name === "NotAllowedError") msg = "Microphone permission denied. Please grant it in system settings.";
      else if (err.name === "NotFoundError") msg = "No microphone found.";
      else if (err.name === "NotReadableError") msg = "Microphone busy — please try again.";
      else if (err.name === "AbortError") msg = "User canceled the permission prompt.";
      toast.error(msg);
      mediaRecorderRef.current = null;
    }
  };

  const pauseWebRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (recordingPaused) {
        mediaRecorderRef.current.resume();
        setRecordingPaused(false);
        startTimer();
      } else {
        mediaRecorderRef.current.pause();
        setRecordingPaused(true);
        stopTimer();
      }
    }
  };

  const stopWebRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelWebRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setRecordingBlob(null);
    setShowRecordedPreview(false);
    setRecordingTime(0);
    setIsRecording(false);
    stopTimer();
  };

  const startRecording = () => {
    if (isRecording) return;
    if (isNative) {
      startNativeRecording();
    } else {
      startWebRecording();
    }
  };

  const pauseRecording = () => {
    if (isNative) {
      pauseNativeRecording();
    } else {
      pauseWebRecording();
    }
  };

  const stopRecording = () => {
    if (isNative) {
      stopNativeRecording();
    } else {
      stopWebRecording();
    }
  };

  const cancelRecording = () => {
    if (isNative) {
      cancelNativeRecording();
    } else {
      cancelWebRecording();
    }
  };

  // ─── Quick send: stop and send immediately ──────────────────────
  const quickSendRef = useRef(false);
  const quickSendRecording = () => {
    if (!isRecordingRef.current) return;

    if (recordingBlob) {
      sendAudioMessage(recordingBlob);
      return;
    }

    // ✅ Set the flag so the useEffect will send when the blob arrives
    quickSendRef.current = true;

    // Stop recording; the onstop handler will set recordingBlob,
    // then the useEffect below will see quickSendRef.current === true
    // and call sendAudioMessage(recordingBlob).
    if (isNative) {
      stopNativeRecording();
    } else {
      stopWebRecording();
    }
  };

  // ─── Auto‑send after quick send ──────────────────────────────────
  useEffect(() => {
    if (quickSendRef.current && recordingBlob) {
      quickSendRef.current = false;
      sendAudioMessage(recordingBlob);
    }
  }, [recordingBlob]);

  // ─── Optimistic sendAudioMessage (unchanged) ──────────────────────
  const sendAudioMessage = async (audioBlob) => {
    if (!audioBlob) return;
    if (isSendingRef.current) return;

    const signature = `${audioBlob.size}-${recordingTime}`;
    if (isRecentDuplicateMedia(signature)) {
      console.warn("Blocked duplicate voice note send");
      return;
    }

    isSendingRef.current = true;
    setIsSending(true);

    const formData = new FormData();
    const mimeType = isNative ? 'audio/m4a' : 'audio/webm';
    const extension = isNative ? 'm4a' : 'webm';
    const audioFile = new File([audioBlob], `voice-note.${extension}`, { type: mimeType });
    formData.append("media", audioFile);
    formData.append("messageType", "audio");
    formData.append("mediaDuration", recordingTime.toString());
    if (replyToMessage) formData.append("replyToId", replyToMessage._id);

    const senderWithName = {
      ...userInfo,
      name: userInfo?.name || userInfo?.username || userInfo?.email || "Unknown",
    };

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    formData.append("clientMsgId", tempId);

    const optimisticMsg = {
      _id: tempId,
      _tempId: tempId,
      _temp: true,
      _pending: false,
      _sent: false,
      _failed: false,
      _delivered: false,
      _read: false,
      content: '',
      sender: senderWithName,
      createdAt: new Date().toISOString(),
      messageType: 'audio',
      chat: chatId,
      replyTo: replyToMessage ? {
        _id: replyToMessage._id,
        sender: replyToMessage.sender,
        content: replyToMessage.content,
        mediaName: replyToMessage.mediaName,
        messageType: replyToMessage.messageType,
      } : null,
      mediaUrl: URL.createObjectURL(audioBlob),
      mediaName: 'Voice note',
      mediaSize: audioBlob.size,
      mediaDuration: recordingTime,
      mediaSignature: signature,
    };
    setLocalMessages(prev => [...prev, optimisticMsg]);
    setRecordingBlob(null);
    setShowRecordedPreview(false);
    setRecordingTime(0);
    setReplyToMessage(null);

    try {
      const res = await sendMessageApi({ chatId, data: formData }).unwrap();
      const realMsg = res.message;

      setLocalMessages((prev) => {
        if (prev.some((m) => m._id === realMsg._id)) {
          return prev.filter((m) => m._tempId !== tempId);
        }
        return prev.map((m) =>
          m._tempId === tempId
            ? {
                ...realMsg,
                createdAt: m.createdAt,
                _sent: true,
                _pending: false,
                _failed: false,
                _delivered: true,
                _read: false,
                _temp: false,
                _tempId: undefined,
              }
            : m
        );
      });
    } catch (err) {
      setLocalMessages(prev => prev.filter((m) => m._tempId !== tempId));
      toast.error(err?.data?.message || 'Failed to send voice note');
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  // ─── Native / Web file & image pickers (now set pendingMedia, not editor) ──
  const handleTakePhoto = useCallback(async () => {
    setShowMediaPicker(false);
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      });
      if (photo?.base64String) {
        const mimeType = `image/${photo.format || 'jpeg'}`;
        const fileName = `photo-${Date.now()}.${photo.format || 'jpg'}`;
        const file = base64ToFile(photo.base64String, fileName, mimeType);
        setPendingMedia(file); // show preview, don't open editor directly
      }
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      if (!msg.includes('cancel')) {
        console.error('Camera error:', err);
        toast.error('Failed to take photo');
      }
    }
  }, []);

  const handleChooseFromGallery = useCallback(async () => {
    setShowMediaPicker(false);
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
      });
      if (photo?.base64String) {
        const mimeType = `image/${photo.format || 'jpeg'}`;
        const fileName = `photo-${Date.now()}.${photo.format || 'jpg'}`;
        const file = base64ToFile(photo.base64String, fileName, mimeType);
        setPendingMedia(file);
      }
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      if (!msg.includes('cancel')) {
        console.error('Gallery error:', err);
        toast.error('Failed to pick from gallery');
      }
    }
  }, []);

  const handlePickFile = useCallback(async () => {
    try {
      const result = await FilePicker.pickFiles({ readData: true });
      const picked = result?.files?.[0];
      if (!picked) return;
      const mimeType = picked.mimeType || 'application/octet-stream';
      const fileName = picked.name || `file-${Date.now()}`;

      let file;
      if (picked.data) {
        file = base64ToFile(picked.data, fileName, mimeType);
      } else if (picked.path) {
        const readResult = await Filesystem.readFile({ path: picked.path });
        file = base64ToFile(readResult.data, fileName, mimeType);
      } else {
        toast.error('Could not read selected file');
        return;
      }
      // For images, we show preview, not editor
      setPendingMedia(file);
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      if (!msg.includes('cancel')) {
        console.error('File picker error:', err);
        toast.error('Failed to pick file');
      }
    }
  }, []);

  const handleFileUpload = useCallback(
    (type) => {
      if (isNative) {
        if (type === "image") {
          setShowMediaPicker(true);
        } else {
          handlePickFile();
        }
        return;
      }
      if (type === "file") {
        fileInputRef.current?.click();
      } else {
        imageInputRef.current?.click();
      }
    },
    [handlePickFile]
  );

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) {
      toast.error('No file selected');
      return;
    }
    // For any file (including images) just set pendingMedia
    setPendingMedia(file);
    e.target.value = '';
  }, []);

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setPendingMedia(file);
        }
        return;
      }
    }
    const text = e.clipboardData?.getData('text');
    if (text) {
      const urlPattern = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
      if (urlPattern.test(text.trim())) {
        e.preventDefault();
      }
    }
  }, []);

  // ─── Image editor callbacks ──────────────────────────────────────
  const handleImageEditorSave = (editedFile) => {
    setPendingMedia(editedFile);
    setImageEditorOpen(false);
    setImageToEdit(null);
  };

  const handleImageEditorCancel = () => {
    setImageEditorOpen(false);
    setImageToEdit(null);
  };

  const handleImageEdit = () => {
    if (pendingMedia && pendingMedia.type.startsWith('image/')) {
      setImageToEdit(pendingMedia);
      setImageEditorOpen(true);
    }
  };

  // ─── Send media from pendingMedia ──────────────────────────────
  const handleSendMedia = async (file) => {
    if (!file) return;
    if (isSendingRef.current) return;

    const signature = `${file.name}-${file.size}-${file.lastModified}`;
    if (isRecentDuplicateMedia(signature)) {
      console.warn("Blocked duplicate media send:", file.name);
      return;
    }

    isSendingRef.current = true;
    setIsSending(true);

    const formData = new FormData();
    formData.append("media", file);
    const messageType = file.type.startsWith('image/') ? 'image' : 'file';
    formData.append("messageType", messageType);
    if (replyToMessage) formData.append("replyToId", replyToMessage._id);

    const senderWithName = {
      ...userInfo,
      name: userInfo?.name || userInfo?.username || userInfo?.email || "Unknown",
    };

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    formData.append("clientMsgId", tempId);

    const optimisticMsg = {
      _id: tempId,
      _tempId: tempId,
      _temp: true,
      _pending: false,
      _sent: false,
      _failed: false,
      _delivered: false,
      _read: false,
      content: '',
      sender: senderWithName,
      createdAt: new Date().toISOString(),
      messageType: messageType,
      chat: chatId,
      replyTo: replyToMessage ? {
        _id: replyToMessage._id,
        sender: replyToMessage.sender,
        content: replyToMessage.content,
        mediaName: replyToMessage.mediaName,
        messageType: replyToMessage.messageType,
      } : null,
      mediaUrl: URL.createObjectURL(file),
      mediaName: file.name,
      mediaSize: file.size,
      mediaDuration: null,
      mediaSignature: signature,
    };
    setLocalMessages(prev => [...prev, optimisticMsg]);
    setReplyToMessage(null);
    setPendingMedia(null);

    try {
      await sendMessageApi({ chatId, data: formData }).unwrap();
    } catch (err) {
      setLocalMessages(prev => prev.filter((m) => m._tempId !== tempId));
      toast.error(err?.data?.message || 'Failed to send media');
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  const clearPendingMedia = () => setPendingMedia(null);

  // ─── Copy message ──────────────────────────────────────────────────
  const handleCopyMessage = useCallback((msg) => {
    const textToCopy = msg?.content || msg?.mediaName || '';
    if (!textToCopy) {
      toast.error('Nothing to copy');
      return;
    }
    navigator.clipboard.writeText(textToCopy)
      .then(() => toast.success('Copied to clipboard'))
      .catch(() => toast.error('Failed to copy'));
  }, []);

  // ─── Message action handlers ──────────────────────────────────────
  const handleDeleteMessage = async (messageId) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Message",
      message: "Are you sure you want to delete this message?",
      onConfirm: async () => {
        setLocalMessages(prev => prev.map(m => m._id === messageId ? { ...m, isDeleted: true } : m));
        try {
          await deleteMessageApi(messageId).unwrap();
          toast.success("Message deleted");
        } catch (err) {
          setLocalMessages(prev => prev.map(m => m._id === messageId ? { ...m, isDeleted: false } : m));
          toast.error(err?.data?.message || "Failed to delete message");
        }
      },
      danger: true,
    });
  };

  const handleArchiveMessage = async (messageId) => {
    try {
      await archiveMessage(messageId).unwrap();
      toast.success("Message archived");
      refetchMessages();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to archive message");
    }
  };

  const handleUnarchiveMessage = async (messageId) => {
    try {
      await unarchiveMessage(messageId).unwrap();
      toast.success("Message unarchived");
      refetchMessages();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to unarchive message");
    }
  };

  const handleStarMessage = async (messageId) => {
    try {
      await starMessage(messageId).unwrap();
      toast.success("Message starred");
      refetchMessages();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to star message");
    }
  };

  const handleUnstarMessage = async (messageId) => {
    try {
      await unstarMessage(messageId).unwrap();
      toast.success("Message unstarred");
      refetchMessages();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to unstar message");
    }
  };

  const handleReply = (msg) => {
    setReplyToMessage(msg);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const cancelReply = () => setReplyToMessage(null);

  const handleLongPress = (msg) => {
    setActionModal({ isOpen: true, message: msg });
  };

  const handleJumpToMessage = useCallback((messageId) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-message-id="${messageId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("ring-2", "ring-teal-400", "rounded-2xl");
    setTimeout(() => target.classList.remove("ring-2", "ring-teal-400", "rounded-2xl"), 1200);
  }, []);

  const handleCall = async (type) => {
    if (!workspace || !chat) {
      toast.error("Missing workspace or chat data");
      return;
    }
    const otherId = otherParticipant?._id;
    if (!otherId) {
      toast.error("No other participant in this DM");
      return;
    }
    try {
      const response = await initiateCall({
        workspaceId,
        type,
        participantIds: [otherId],
      }).unwrap();
      navigate(`/call/${response.call.roomId}`, {
        state: {
          callData: {
            ...response.call,
            status: "ringing",
            isInitiator: true,
            workspaceColor: brandColor,
          },
        },
      });
    } catch (err) {
      toast.error(err?.data?.message || "Failed to initiate call");
    }
  };

  // ─── Optimistic text send (unchanged) ──────────────────────────────
  const handleSendMessage = (e) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || !socket) return;
    if (isSendingRef.current) return;

    const now = Date.now();
    const isDuplicate = localMessages.some((m) => {
      if (m.messageType !== 'text') return false;
      if (m.content !== trimmed) return false;
      const isOwnMsg =
        m.sender?._id === userInfo?._id || m.sender === userInfo?._id;
      if (!isOwnMsg) return false;
      const msgTime = new Date(m.createdAt).getTime();
      return now - msgTime < 4000;
    });
    if (isDuplicate) {
      console.warn('Blocked duplicate send:', trimmed);
      return;
    }

    isSendingRef.current = true;
    setIsSending(true);

    const senderWithName = {
      ...userInfo,
      name: userInfo?.name || userInfo?.username || userInfo?.email || "Unknown",
    };

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMsg = {
      _id: tempId,
      _tempId: tempId,
      _temp: true,
      _pending: false,
      _sent: false,
      _failed: false,
      _delivered: false,
      _read: false,
      content: trimmed,
      sender: senderWithName,
      createdAt: new Date().toISOString(),
      messageType: "text",
      chat: chatId,
      replyTo: replyToMessage
        ? {
            _id: replyToMessage._id,
            sender: replyToMessage.sender,
            content: replyToMessage.content,
            mediaName: replyToMessage.mediaName,
            messageType: replyToMessage.messageType,
          }
        : null,
    };
    setLocalMessages((prev) => [...prev, optimisticMsg]);
    setMessage("");
    const replyToId = replyToMessage?._id || null;
    setReplyToMessage(null);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    socket.emit(
      "send-message",
      {
        chatId,
        content: trimmed,
        messageType: "text",
        mentions: [],
        replyToId,
        clientMsgId: tempId,
      },
      (response) => {
        isSendingRef.current = false;
        setIsSending(false);
        if (response?.error) {
          setLocalMessages((prev) => prev.filter((m) => m._id !== tempId));
          toast.error(response.error);
        } else {
          setLocalMessages((prev) =>
            prev.map((m) =>
              m._id === tempId ? { ...m, _sent: true, _delivered: true } : m
            )
          );
        }
      }
    );
  };

  // ─── Render messages with dividers ──────────────────────────────
  const renderMessagesWithDividers = () => {
    if (messagesLoading) {
      return <SkeletonMessages count={6} />;
    }

    if (localMessages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
          <FaComment className="text-4xl mb-2 opacity-30" />
          <p className="text-sm">No messages yet</p>
          <p className="text-xs mt-1 opacity-60">Paste images or screenshots here</p>
        </div>
      );
    }

    const sorted = [...localMessages].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    let lastDate = null;
    const elements = [];

    sorted.forEach((msg) => {
      const msgDate = new Date(msg.createdAt);
      const dateKey = msgDate.toDateString();
      if (dateKey !== lastDate) {
        const dividerText = formatDateDivider(msg.createdAt);
        elements.push(
          <div key={`divider-${dateKey}`} className="flex justify-center my-3">
            <div className="bg-gray-200/70 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs px-3 py-1 rounded-full">
              {dividerText}
            </div>
          </div>
        );
        lastDate = dateKey;
      }

      const sender = resolveSender(msg.sender);
      const isOwn = msg.sender?._id === userInfo?._id || msg.sender === userInfo?._id;
      elements.push(
        <MediaMessage
          key={msg._id}
          message={msg}
          isOwn={isOwn}
          isDM={true}
          senderName={sender?.name || "Unknown"}
          senderProfile={sender?.profile}
          brandColor={brandColor}
          onImageClick={(payload) => setPreviewImage(payload)}
          onDelete={handleDeleteMessage}
          onArchive={handleArchiveMessage}
          onUnarchive={handleUnarchiveMessage}
          onStar={handleStarMessage}
          onUnstar={handleUnstarMessage}
          onReply={handleReply}
          onCopy={handleCopyMessage}
          userId={userInfo?._id}
          isMobile={isMobile}
          onLongPress={handleLongPress}
          allMessages={sorted}
          onJumpToMessage={handleJumpToMessage}
          resolveSender={resolveSender}
        />
      );
    });
    return elements;
  };

  // ─── Early returns ────────────────────────────────────────────────
  if (workspaceError) {
    navigate("/my-workspaces");
    return null;
  }

  if (workspaceLoading || chatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="w-8 h-8 border-4 border-teal-500 dark:border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage.url}
          senderName={previewImage.senderName}
          time={previewImage.time}
          onClose={() => setPreviewImage(null)}
        />
      )}

      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <MyWorkspaceSidebar workspace={workspace} chats={chats} />
      </div>

      <div className="flex-1 flex flex-col bg-white dark:bg-[#0f0f12] h-full overflow-hidden">
        {/* Header */}
        <header className="fixed lg:sticky top-0 left-0 right-0 lg:left-auto lg:right-auto z-20 flex items-center justify-between px-4 py-3 border-b border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl text-gray-800 dark:text-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => navigate(-1)} // ✅ go back to previous page
              className="p-1 lg:hidden flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
            >
              <FaArrowLeft />
            </button>
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt=""
                className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-200 dark:border-gray-700/60"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-base text-gray-800 dark:text-gray-100 truncate">{displayName}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {otherUserOnline === true ? "Online" : otherUserOnline === false ? "Offline" : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => handleCall("voice")} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
              <FaPhone />
            </button>
            <button onClick={() => handleCall("video")} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
              <FaVideo />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="h-full overflow-y-auto px-4 py-3 space-y-4 pt-20 lg:pt-3 pb-24 lg:pb-3"
            style={{
              paddingBottom: isMobile ? `${inputHeight + 60}px` : undefined, // ✅ huge bottom margin
            }}
          >
            {renderMessagesWithDividers()}
            <div ref={messagesEndRef} />
          </div>
          {showScrollDown && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 z-30 w-10 h-10 rounded-full bg-white dark:bg-[#14141a] shadow-lg border border-gray-200 dark:border-gray-700/60 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-all"
            >
              <FaChevronDown className="text-sm" />
            </button>
          )}
        </div>

        {/* Input area */}
        <div
          ref={inputAreaRef}
          className="fixed lg:sticky bottom-0 left-0 right-0 lg:left-auto lg:right-auto z-20 border-t border-gray-200/60 dark:border-gray-800/60 bg-white/90 dark:bg-[#0f0f12]/90 backdrop-blur-xl flex-shrink-0 px-3 sm:px-4"
          style={{
            paddingTop: '0.5rem',
            paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <ReplyPreview
            replyTo={replyToMessage}
            onCancel={cancelReply}
            brandColor={brandColor}
            resolveSender={resolveSender}
          />

          {pendingMedia && (
            <MediaPreview
              mediaFile={pendingMedia}
              onRemove={clearPendingMedia}
              onSend={handleSendMedia}
              brandColor={brandColor}
              isSending={isSending}
              onEdit={handleImageEdit}
            />
          )}

          {showRecordedPreview && recordingBlob && (
            <div className="flex items-center justify-between px-3 py-2 mb-2 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700/40">
              <div className="flex items-center gap-2">
                <FaCheckCircle className="text-green-500 dark:text-green-400" />
                <span className="text-sm text-gray-700 dark:text-gray-200">Voice note ready</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{formatTime(recordingTime)}</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    const audio = new Audio(URL.createObjectURL(recordingBlob));
                    audio.play();
                  }}
                  className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
                >
                  <FaPlay className="text-xs" />
                </button>
                <button
                  onClick={() => sendAudioMessage(recordingBlob)}
                  disabled={isSending}
                  className="px-3 py-1 bg-green-600 dark:bg-green-700 text-white rounded text-xs hover:bg-green-700 dark:hover:bg-green-800 transition disabled:opacity-50"
                >
                  Send
                </button>
                <button
                  onClick={() => { setRecordingBlob(null); setShowRecordedPreview(false); setRecordingTime(0); }}
                  className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>
            </div>
          )}

          {isRecording && (
            <div className="flex items-center justify-between px-3 py-2 mb-2 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700/40">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-600 dark:text-red-300">
                  {recordingPaused ? "Paused" : "Recording..."} {formatTime(recordingTime)}
                </span>
                <button
                  onClick={pauseRecording}
                  className="text-xs text-red-600 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200"
                >
                  {recordingPaused ? "Resume" : "Pause"}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={cancelRecording}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white"
                >
                  <FaTrashAlt className="text-xs" />
                </button>
                <button
                  onClick={stopRecording}
                  className="bg-red-500 text-white px-2 py-1 rounded-full hover:bg-red-600 transition text-xs"
                >
                  Stop
                </button>
              </div>
            </div>
          )}

          {/* ─── New WhatsApp‑style input bar ─── */}
          <form onSubmit={handleSendMessage} className="flex items-end gap-2 py-2">
            {/* Emoji button – extreme left */}
            <div className="relative flex-shrink-0 mb-1" ref={emojiPickerRef}>
              <button
                type="button"
                onClick={toggleEmoji}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition"
              >
                <FaSmile className="text-xl" />
              </button>
              {/* Desktop floating popup */}
              {showEmojiPicker && !isMobile && (
                <div className="absolute bottom-12 left-0 z-30 w-72 max-h-56 overflow-y-auto bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl shadow-xl p-3 grid grid-cols-8 gap-1">
                  {EMOJI_LIST.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleEmojiSelect(emoji)}
                      className="text-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg p-1 transition"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input pill – with paperclip & camera inside */}
            <div className="flex-1 min-w-0 relative flex items-end">
              <textarea
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onPaste={handlePaste}
                onFocus={() => setShowEmojiPicker(false)}
                onKeyDown={(e) => {
                  if (isMobile) return;
                  if (isSendingRef.current) return;
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="Message"
                rows={1}
                className="w-full min-w-0 pl-4 pr-20 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl bg-white dark:bg-[#0b0b10] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-[#0d9488] resize-none max-h-32 overflow-y-auto"
                style={{ minHeight: '42px', lineHeight: '1.5' }}
              />
              <div className="absolute right-3 bottom-0 h-[42px] flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleFileUpload('file')}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition"
                >
                  <FaPaperclip className="text-base" />
                </button>
                <button
                  type="button"
                  onClick={() => handleFileUpload('image')}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition"
                >
                  <FaCamera className="text-base" />
                </button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <input type="file" ref={imageInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
            </div>

            {/* Mic / Send button – extreme right */}
            {message.trim() ? (
              <button
                type="submit"
                disabled={!isConnected || isSending}
                className="p-3 rounded-full text-white disabled:opacity-50 flex-shrink-0 transition hover:opacity-80 mb-1"
                style={{ backgroundColor: brandColor }}
              >
                <FaPaperPlane className="text-sm" />
              </button>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => {
                  if (message.trim()) return;
                  if (isRecording || mediaRecorderRef.current) return;
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  startRecording();
                }}
                onPointerUp={(e) => {
                  e.currentTarget.releasePointerCapture?.(e.pointerId);
                  if (isRecording && !recordingPaused) {
                    quickSendRecording();
                  }
                }}
                onPointerCancel={(e) => {
                  if (isRecording && !recordingPaused) quickSendRecording();
                }}
                className="p-3 rounded-full text-white flex-shrink-0 transition hover:opacity-80 mb-1 touch-none select-none"
                style={{ backgroundColor: brandColor }}
              >
                {isRecording ? <FaPaperPlane className="text-sm" /> : <FaMicrophone className="text-sm" />}
              </button>
            )}
          </form>

          {/* Mobile emoji panel – docks under input */}
          {showEmojiPicker && isMobile && (
            <div
              className="w-full mt-2 overflow-y-auto bg-white dark:bg-[#14141a] border-t border-gray-200 dark:border-gray-800/60 rounded-t-xl grid grid-cols-8 gap-1 p-3"
              style={{ height: '260px' }}
            >
              {EMOJI_LIST.map((emoji, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleEmojiSelect(emoji)}
                  className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg p-1 transition"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
      />
      <MessageActionModal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, message: null })}
        message={actionModal.message}
        isOwn={
          actionModal.message?.sender?._id === userInfo?._id ||
          actionModal.message?.sender === userInfo?._id
        }
        isStarred={actionModal.message?.starredBy?.some((id) => id === userInfo?._id) || false}
        isArchived={actionModal.message?.archivedBy?.some((id) => id === userInfo?._id) || false}
        onDelete={handleDeleteMessage}
        onArchive={handleArchiveMessage}
        onUnarchive={handleUnarchiveMessage}
        onStar={handleStarMessage}
        onUnstar={handleUnstarMessage}
        onReply={handleReply}
        onCopy={handleCopyMessage}
        brandColor={brandColor}
      />

      <MediaPickerModal
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onTakePhoto={handleTakePhoto}
        onChooseFromGallery={handleChooseFromGallery}
        brandColor={brandColor}
      />

      {/* Image Editor Full‑Screen */}
      {imageEditorOpen && imageToEdit && (
        <ImageEditorScreen
          file={imageToEdit}
          onSave={handleImageEditorSave}
          onCancel={handleImageEditorCancel}
          brandColor={brandColor}
        />
      )}
    </div>
  );
};

export default MyWorkspaceChatId;
// src/screens/CallScreen.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useTracks,
  useLocalParticipant,
  useParticipants,
  useSpeakingParticipants,
  useIsSpeaking,
  useIsMuted,
} from '@livekit/components-react';
import {
  Track,
  DisconnectReason,
  MediaDeviceFailure,
  VideoQuality,
} from 'livekit-client';
import {
  FaPhoneSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaSpinner,
  FaExclamationTriangle,
  FaLink,
  FaPhone,
  FaArrowLeft,
  FaCheck,
  FaSignOutAlt,
  FaCopy,
  FaCircle,
  // ── AI additions ──
  FaRobot,
  FaBrain,
  FaPaperPlane,
  FaHandPaper,
  FaSmile,
  FaWifi,
  FaQuestionCircle,
  FaCommentDots,
  FaLightbulb,
  FaBookOpen,
  FaTimes,
} from 'react-icons/fa';

import { useSocket } from '../components/SocketContext.jsx';
import { ensureCallPermissions } from '../utils/callPermissions';
import {
  useGetCallByIdQuery,
  useGetCallTokenMutation,
  useJoinCallMutation,
  useLeaveCallMutation,
  useEndCallMutation,
  useRejectCallMutation,
  // ── AI + live notes ──
  useStartCallAIMutation,
  useStopCallAIMutation,
  useFinalizeCallNotesMutation,
  usePushCallTranscriptMutation,
  useAskCallAITextMutation,
  useAskCallAIVoiceMutation,
  useSendInCallMessageMutation,
  useSetRaisedHandMutation,
  useSendCallReactionMutation,
  useUpdateCallDataSaverMutation,
} from '../slices/callApiSlice';

// ─────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────
const BRAND = '#06b6d4'; // cyan-500 — matches GeneralSidebar accent
const POLL_MS = 20_000;

const ROOM_OPTIONS = {
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
const formatClock = (total) => {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
};

const getInfo = (participant) => {
  let meta = {};
  try {
    meta = participant?.metadata ? JSON.parse(participant.metadata) : {};
  } catch {
    meta = {};
  }
  return {
    name: participant?.name || 'Participant',
    username: meta.username || '',
    profile: meta.profile || '',
  };
};

const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
};

const getUserId = (p) => String(p?.user?._id || p?.user || p?._id || '');

const deviceFailureMessage = (failure) => {
  switch (failure) {
    case MediaDeviceFailure.PermissionDenied:
      return 'Microphone/camera permission was denied.';
    case MediaDeviceFailure.NotFound:
      return 'No microphone or camera was found.';
    case MediaDeviceFailure.DeviceInUse:
      return 'Your microphone or camera is being used by another app.';
    default:
      return 'Could not start your microphone or camera.';
  }
};

// ─────────────────────────────────────────────────────────────────────
// AI helpers — audio playback, voice recorder, live transcript
// ─────────────────────────────────────────────────────────────────────

/** Play base64-encoded TTS audio; returns the HTMLAudioElement. */
const playAudioDataUrl = (base64, format = 'wav', onEnded) => {
  try {
    const audio = new Audio(`data:audio/${format};base64,${base64}`);
    audio.play().catch((e) => console.error('[audio] play failed:', e));
    audio.onended = () => onEnded?.();
    return audio;
  } catch (err) {
    console.error('[audio] failed:', err);
    return null;
  }
};

/** Record a push-to-talk clip and resolve to a Blob. */
const useVoiceRecorder = () => {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const start = useCallback(async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      console.error('[voice] start failed:', err);
      toast.error('Could not access microphone.');
    }
  }, [recording]);

  const stop = useCallback(
    () =>
      new Promise((resolve) => {
        const mr = mediaRecorderRef.current;
        if (!mr) {
          resolve(null);
          return;
        }
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          chunksRef.current = [];
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          mediaRecorderRef.current = null;
          setRecording(false);
          resolve(blob);
        };
        try {
          mr.stop();
        } catch {
          resolve(null);
        }
      }),
    []
  );

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        mediaRecorderRef.current?.stop();
      } catch {}
    },
    []
  );

  return { recording, start, stop };
};

/** Browser STT — fires `onFinal(text)` for each completed phrase. */
const useLiveTranscript = ({ enabled, onFinal }) => {
  const recognitionRef = useRef(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    const SR =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return;

    setSupported(true);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim();
        if (!text) continue;
        if (result.isFinal) onFinalRef.current?.(text);
      }
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('[SR] error:', e.error);
      }
    };

    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (enabled && !listening) {
      try {
        rec.start();
        setListening(true);
      } catch {}
    } else if (!enabled && listening) {
      try {
        rec.stop();
      } catch {}
      setListening(false);
    }
  }, [enabled, listening]);

  return { supported, listening };
};

// ─────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────
const Avatar = ({ info, size, brandColor = BRAND }) => {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (info.profile) {
    return (
      <img
        src={info.profile}
        alt={info.name}
        style={style}
        className="rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div
      style={{ ...style, backgroundColor: brandColor }}
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
    >
      {info.name.charAt(0).toUpperCase()}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Participant tile
// ─────────────────────────────────────────────────────────────────────
const ParticipantCard = ({
  participant,
  cameraRef,
  variant,
  brandColor = BRAND,
  active,
  onClick,
}) => {
  const isSpeaking = useIsSpeaking(participant);
  const micMuted = useIsMuted(Track.Source.Microphone, { participant });
  const info = getInfo(participant);
  const isMain = variant === 'main';
  const camOn = !!cameraRef && !cameraRef.publication?.isMuted;

  const ringStyle = isSpeaking
    ? { boxShadow: `0 0 0 3px ${brandColor}` }
    : active
    ? { boxShadow: '0 0 0 2px rgba(255,255,255,0.35)' }
    : {};

  return (
    <div
      onClick={onClick}
      style={ringStyle}
      className={`relative overflow-hidden bg-[#1a1a24] transition-shadow ${
        isMain
          ? 'w-full h-full rounded-3xl'
          : 'w-28 h-20 sm:w-36 sm:h-24 rounded-xl flex-shrink-0 cursor-pointer'
      }`}
    >
      {camOn ? (
        <VideoTrack
          trackRef={cameraRef}
          className="w-full h-full object-cover"
          style={participant.isLocal ? { transform: 'scaleX(-1)' } : undefined}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-2">
          <Avatar info={info} size={isMain ? 112 : 36} brandColor={brandColor} />
          {isMain && (
            <div className="text-center">
              <p className="text-xl font-semibold">
                {info.name}
                {participant.isLocal ? ' (You)' : ''}
              </p>
              {info.username && (
                <p className="text-sm text-gray-400">@{info.username}</p>
              )}
            </div>
          )}
        </div>
      )}

      {(!isMain || camOn) && (
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1 bg-black/55 rounded-full px-2 py-0.5 text-[11px] sm:text-xs">
          {micMuted && <FaMicrophoneSlash className="text-red-400 flex-shrink-0" />}
          <span className="truncate">{participant.isLocal ? 'You' : info.name}</span>
        </div>
      )}

      {isMain && (
        <>
          {micMuted && (
            <div className="absolute top-3 right-3 bg-black/55 rounded-full p-2">
              <FaMicrophoneSlash className="text-red-400" />
            </div>
          )}
          {isSpeaking && (
            <div className="absolute top-3 left-3 flex items-end gap-[3px] h-5 bg-black/55 rounded-full px-3 py-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full call-bar"
                  style={{
                    backgroundColor: brandColor,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// ── NEW: AI + meeting UI components ─────────────────────────────────
// ═════════════════════════════════════════════════════════════════════
const FloatingReactions = ({ reactions }) => (
  <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
    {reactions.map((r) => (
      <div
        key={r._id}
        className="absolute text-4xl"
        style={{
          left: `${10 + Math.random() * 80}%`,
          bottom: '15%',
          animation: 'float-up 3s ease-out forwards',
        }}
      >
        {r.emoji}
      </div>
    ))}
    <style>{`
      @keyframes float-up {
        0%   { transform: translateY(0)    scale(1);   opacity: 1; }
        100% { transform: translateY(-60vh) scale(1.6); opacity: 0; }
      }
    `}</style>
  </div>
);

const ReactionPicker = ({ open, onClose, onPick }) => {
  if (!open) return null;
  const emojis = ['👍', '❤️', '😂', '😮', '👏', '🎉', '🔥', '👎'];
  return (
    <>
      <div className="fixed inset-0 z-[68]" onClick={onClose} />
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[69] bg-[#1a1a24] border border-white/10 rounded-2xl shadow-2xl p-2 flex gap-1">
        {emojis.map((e) => (
          <button
            key={e}
            onClick={() => {
              onPick(e);
              onClose();
            }}
            className="w-10 h-10 rounded-xl hover:bg-white/10 text-2xl transition"
          >
            {e}
          </button>
        ))}
      </div>
    </>
  );
};

const DataSaverMenu = ({ open, onClose, dataSaver, onChange }) => {
  if (!open) return null;
  const qualities = [
    { v: 'auto', label: 'Auto' },
    { v: 'low', label: 'Low (data saver)' },
    { v: 'medium', label: 'Medium' },
    { v: 'high', label: 'High' },
  ];
  return (
    <>
      <div className="fixed inset-0 z-[68]" onClick={onClose} />
      <div className="absolute bottom-24 right-4 z-[69] bg-[#1a1a24] border border-white/10 rounded-2xl shadow-2xl p-3 w-64">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Data saver</p>
          <FaWifi className="text-xs text-gray-400" />
        </div>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={!!dataSaver.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          <span className="text-sm">Enable data saver</span>
        </label>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={!!dataSaver.audioOnly}
            onChange={(e) => onChange({ audioOnly: e.target.checked })}
          />
          <span className="text-sm">Audio only (no video)</span>
        </label>
        <div className="mt-2">
          <p className="text-xs text-gray-400 mb-1">Video quality</p>
          <div className="grid grid-cols-2 gap-1">
            {qualities.map((q) => (
              <button
                key={q.v}
                onClick={() => onChange({ videoQuality: q.v })}
                className={`text-xs py-1.5 rounded-lg transition ${
                  dataSaver.videoQuality === q.v
                    ? 'bg-teal-600 text-white'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────
// AI Panel — right drawer / bottom sheet
// ─────────────────────────────────────────────────────────────────────
const AIPanel = ({
  open,
  onClose,
  tab,
  setTab,
  brandColor,
  aiEnabled,
  transcriptSupported,
  transcript,
  liveSummary,
  exchanges,
  chatMessages,
  noteReady,
  askText,
  setAskText,
  onAskText,
  askingText,
  onAskVoiceStart,
  onAskVoiceStop,
  voiceRecording,
  askingVoice,
  chatText,
  setChatText,
  onSendChat,
  meId,
}) => {
  if (!open) return null;

  const tabs = [
    { id: 'summary', label: 'Summary', icon: <FaBrain /> },
    { id: 'transcript', label: 'Transcript', icon: <FaCommentDots /> },
    { id: 'ask', label: 'Ask AI', icon: <FaQuestionCircle /> },
    { id: 'chat', label: 'Chat', icon: <FaLightbulb /> },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex sm:items-stretch sm:justify-end">
      <div className="flex-1 bg-black/40" onClick={onClose} />

      <div className="w-full sm:w-[420px] h-[85dvh] sm:h-full bg-[#0f0f15] border-l border-white/10 flex flex-col sm:rounded-none rounded-t-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center gap-2">
            <FaRobot style={{ color: brandColor }} />
            <h3 className="text-base font-semibold">Xircle AI</h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                aiEnabled
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {aiEnabled ? 'LIVE' : 'OFF'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg"
          >
            <FaTimes />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 flex-shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-medium flex flex-col items-center gap-1 transition ${
                tab === t.id
                  ? 'text-white border-b-2'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              style={tab === t.id ? { borderBottomColor: brandColor } : undefined}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {tab === 'summary' && (
            <div className="space-y-4">
              {!aiEnabled && (
                <div className="text-sm text-gray-400">
                  Turn on AI to start recording notes. The summary will update
                  live as people speak.
                </div>
              )}
              {aiEnabled && !liveSummary && (
                <div className="text-sm text-gray-400 flex items-center gap-2">
                  <FaSpinner className="animate-spin" />
                  Listening for context…
                </div>
              )}
              {liveSummary && (
                <>
                  {liveSummary.text && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                        Live summary
                      </p>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">
                        {liveSummary.text}
                      </p>
                    </div>
                  )}
                  {liveSummary.keyPoints?.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                        Key points
                      </p>
                      <ul className="text-sm text-gray-200 list-disc pl-5 space-y-1">
                        {liveSummary.keyPoints.map((k, i) => (
                          <li key={i}>{k}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {liveSummary.actionItems?.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                        Action items
                      </p>
                      <ul className="text-sm text-gray-200 space-y-1">
                        {liveSummary.actionItems.map((a, i) => (
                          <li key={i} className="flex gap-2">
                            <span style={{ color: brandColor }}>•</span>
                            <span>
                              {a.text}
                              {a.assignee && (
                                <span className="text-gray-400">
                                  {' '}
                                  — {a.assignee}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              {noteReady?.noteId && (
                <div className="rounded-xl bg-teal-500/10 border border-teal-500/30 px-3 py-2 text-xs text-teal-200">
                  <FaBookOpen className="inline mr-1" />
                  Notes saved — see the ended screen to open them.
                </div>
              )}
            </div>
          )}

          {tab === 'transcript' && (
            <div className="space-y-2">
              {!transcriptSupported && aiEnabled && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-300">
                  Live transcription isn't supported in this browser. Use text
                  Ask-AI or in-call chat instead — both still work.
                </div>
              )}
              {!aiEnabled && (
                <div className="text-sm text-gray-400">
                  Turn on AI to start the transcript.
                </div>
              )}
              {aiEnabled && transcript.length === 0 && (
                <div className="text-sm text-gray-400">
                  Waiting for the first words…
                </div>
              )}
              {transcript.map((s, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium" style={{ color: brandColor }}>
                    {s.speakerName || 'Someone'}:
                  </span>{' '}
                  <span className="text-gray-200">{s.text}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'ask' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Ask about anything in the call. Voice answers play out loud —
                speaking over them stops the playback.
              </p>

              <div className="flex items-center gap-2">
                <input
                  value={askText}
                  onChange={(e) => setAskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onAskText();
                    }
                  }}
                  placeholder="What did we decide?"
                  className="flex-1 px-3 py-2.5 bg-[#0b0b10] border border-white/10 rounded-xl text-sm text-white outline-none focus:border-teal-500"
                />
                <button
                  onClick={onAskText}
                  disabled={askingText || !askText.trim()}
                  className="w-11 h-11 rounded-xl flex items-center justify-center disabled:opacity-60"
                  style={{ backgroundColor: brandColor }}
                >
                  {askingText ? (
                    <FaSpinner className="animate-spin" />
                  ) : (
                    <FaPaperPlane />
                  )}
                </button>
              </div>

              <button
                onMouseDown={onAskVoiceStart}
                onMouseUp={onAskVoiceStop}
                onTouchStart={onAskVoiceStart}
                onTouchEnd={onAskVoiceStop}
                disabled={askingVoice}
                className={`w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${
                  voiceRecording
                    ? 'bg-red-600 text-white'
                    : 'bg-white/10 hover:bg-white/15 text-white'
                } disabled:opacity-60`}
              >
                {askingVoice ? (
                  <>
                    <FaSpinner className="animate-spin" /> Thinking…
                  </>
                ) : voiceRecording ? (
                  <>
                    <FaCircle className="text-xs animate-pulse" /> Release to
                    ask
                  </>
                ) : (
                  <>
                    <FaMicrophone /> Hold to ask by voice
                  </>
                )}
              </button>

              <div className="space-y-3 pt-2">
                {exchanges.length === 0 && (
                  <p className="text-xs text-gray-500">
                    Your questions and answers will appear here.
                  </p>
                )}
                {exchanges.map((x, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-xs text-gray-400">{x.question}</p>
                    <div
                      className="rounded-xl px-3 py-2 text-sm text-gray-100"
                      style={{ backgroundColor: `${brandColor}22` }}
                    >
                      {x.answer}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'chat' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Send a message if your mic is noisy or your network is slow.
              </p>
              <div className="space-y-2">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-gray-500">No messages yet.</p>
                )}
                {chatMessages.map((m, i) => {
                  const mine = String(m.sender) === String(meId);
                  return (
                    <div
                      key={i}
                      className={`text-sm flex ${
                        mine ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-1.5 rounded-2xl ${
                          mine
                            ? 'text-white rounded-br-sm'
                            : 'bg-white/10 text-gray-100 rounded-bl-sm'
                        }`}
                        style={mine ? { backgroundColor: brandColor } : undefined}
                      >
                        {!mine && m.senderName && (
                          <p className="text-[10px] text-gray-400 mb-0.5">
                            {m.senderName}
                          </p>
                        )}
                        {m.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {tab === 'chat' && (
          <div className="border-t border-white/10 p-3 flex items-center gap-2 flex-shrink-0">
            <input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSendChat();
                }
              }}
              placeholder="Type a message…"
              className="flex-1 px-3 py-2 bg-[#0b0b10] border border-white/10 rounded-xl text-sm text-white outline-none"
            />
            <button
              onClick={onSendChat}
              disabled={!chatText.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-60"
              style={{ backgroundColor: brandColor }}
            >
              <FaPaperPlane />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// In-call stage (must live INSIDE <LiveKitRoom>)
// ─────────────────────────────────────────────────────────────────────
const CallStage = ({
  isVideo,
  brandColor,
  onHangUp,
  onEndForAll,
  isCreator,
  deviceError,
  call,
  onCopyLink,
  // ── NEW: AI + meeting ──
  aiEnabled,
  aiStarting,
  onStartAI,
  onStopAI,
  transcriptSupported,
  onTranscriptSegment,
  onOpenAIPanel,
  transcriptCount,
  handRaised,
  onToggleHand,
  onReact,
  raisedHands,
  dataSaver,
  onDataSaverChange,
  reactions,
}) => {
  const participants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const speaking = useSpeakingParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } =
    useLocalParticipant();

  const [pinned, setPinned] = useState(null);
  const [lastSpeaker, setLastSpeaker] = useState(null);
  const [secs, setSecs] = useState(0);
  const [endMenuOpen, setEndMenuOpen] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [dataSaverOpen, setDataSaverOpen] = useState(false);

  // ── AI STT (inside LiveKit) — pauses on mute ──
  useLiveTranscript({
    enabled: aiEnabled && isMicrophoneEnabled && transcriptSupported,
    onFinal: onTranscriptSegment,
  });

  // ── Apply data saver to local publishing ──
  useEffect(() => {
    if (!localParticipant) return;
    try {
      if (dataSaver?.audioOnly && isCameraEnabled) {
        localParticipant.setCameraEnabled(false).catch(() => {});
      }
      if (dataSaver?.videoQuality === 'low') {
        localParticipant.setVideoQuality?.(VideoQuality.LOW);
      } else if (dataSaver?.videoQuality === 'medium') {
        localParticipant.setVideoQuality?.(VideoQuality.MEDIUM);
      } else if (dataSaver?.videoQuality === 'high') {
        localParticipant.setVideoQuality?.(VideoQuality.HIGH);
      }
    } catch (err) {
      console.warn('[dataSaver] apply failed:', err);
    }
  }, [dataSaver, localParticipant, isCameraEnabled]);

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const remote = speaking.find((p) => !p.isLocal);
    if (remote) setLastSpeaker(remote.identity);
  }, [speaking]);

  const remotes = participants.filter((p) => !p.isLocal);
  const mainP =
    participants.find((p) => p.identity === pinned) ||
    remotes.find((p) => p.identity === lastSpeaker) ||
    remotes[0] ||
    localParticipant;

  const camRefFor = (p) =>
    cameraTracks.find((t) => t.participant.identity === p.identity);

  const toggleMic = async () => {
    try {
      await localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      console.error('[call] toggle mic failed:', err);
    }
  };

  const toggleCam = async () => {
    try {
      await localParticipant?.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      console.error('[call] toggle camera failed:', err);
    }
  };

  const showEndMenu =
    isCreator &&
    remotes.length > 0 &&
    (call?.isMeeting || (call?.participants || []).length > 2);

  const handsUpCount = raisedHands?.length || 0;

  return (
    <div className="h-dvh bg-[#0b0b10] text-white flex flex-col">
      <style>{`
        @keyframes call-bar-anim { 0%,100% { height: 4px } 50% { height: 16px } }
        .call-bar { height: 4px; animation: call-bar-anim 0.8s ease-in-out infinite; }
      `}</style>

      <FloatingReactions reactions={reactions} />

      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b border-white/10 gap-2"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="min-w-0">
          <h3 className="text-base font-semibold truncate flex items-center gap-2">
            {call?.isMeeting
              ? 'Meeting'
              : isVideo
              ? 'Video Call'
              : 'Voice Call'}
            {aiEnabled && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1">
                <FaRobot /> AI
              </span>
            )}
            {handsUpCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 flex items-center gap-1">
                <FaHandPaper /> {handsUpCount}
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-400">
            {participants.length} participant{participants.length === 1 ? '' : 's'}
            {call?.isMeeting && call?.meetingCode && (
              <span className="ml-2 text-gray-500">· {call.meetingCode}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* AI toggle */}
          <button
            onClick={aiEnabled ? onStopAI : onStartAI}
            disabled={aiStarting}
            title={aiEnabled ? 'Stop AI notes' : 'Start AI notes'}
            className={`h-9 px-3 rounded-full flex items-center justify-center gap-1.5 text-xs font-medium transition ${
              aiEnabled
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-white/10 hover:bg-white/20'
            } disabled:opacity-60`}
          >
            {aiStarting ? (
              <FaSpinner className="animate-spin text-[10px]" />
            ) : (
              <FaRobot className="text-sm" />
            )}
            <span className="hidden sm:inline">
              {aiEnabled ? 'Stop AI' : 'Start AI'}
            </span>
          </button>

          {call?.isMeeting && call?.meetingLink && (
            <button
              onClick={onCopyLink}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              title="Copy meeting link"
            >
              <FaLink className="text-sm" />
            </button>
          )}
          <span className="text-sm tabular-nums text-gray-300 ml-1">
            {formatClock(secs)}
          </span>
        </div>
      </div>

      {deviceError && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-sm text-red-300">
          <FaExclamationTriangle className="flex-shrink-0" />
          <span>{deviceError}</span>
        </div>
      )}

      {/* Thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto px-3 py-3 flex-shrink-0">
        {participants.map((p) => (
          <ParticipantCard
            key={p.identity}
            participant={p}
            cameraRef={camRefFor(p)}
            variant="thumb"
            brandColor={brandColor}
            active={p.identity === mainP?.identity}
            onClick={() => setPinned(p.identity)}
          />
        ))}
      </div>

      {/* Main tile */}
      <div className="flex-1 min-h-0 px-3 pb-3">
        {mainP && (
          <ParticipantCard
            participant={mainP}
            cameraRef={camRefFor(mainP)}
            variant="main"
            brandColor={brandColor}
          />
        )}
      </div>

      <RoomAudioRenderer />
      <StartAudio
        label="Tap to enable audio"
        className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-white text-gray-900 font-medium shadow-lg"
      />

      {/* Floating AI panel button */}
      <button
        onClick={onOpenAIPanel}
        className="fixed bottom-28 right-4 z-[65] w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition"
        style={{ backgroundColor: brandColor }}
        title="Open AI panel"
      >
        <FaRobot className="text-xl" />
        {transcriptCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
            {transcriptCount > 99 ? '99+' : transcriptCount}
          </span>
        )}
      </button>

      {/* Controls */}
      <div
        className="px-4 py-4 bg-white/5 border-t border-white/10 flex items-center justify-center gap-3 relative"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          onClick={toggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
            isMicrophoneEnabled ? 'bg-gray-600 hover:bg-gray-500' : 'bg-red-600'
          }`}
          aria-label={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
        >
          {isMicrophoneEnabled ? (
            <FaMicrophone className="text-lg" />
          ) : (
            <FaMicrophoneSlash className="text-lg" />
          )}
        </button>

        {isVideo && (
          <button
            onClick={toggleCam}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
              isCameraEnabled ? 'bg-gray-600 hover:bg-gray-500' : 'bg-red-600'
            }`}
            aria-label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
          >
            {isCameraEnabled ? (
              <FaVideo className="text-lg" />
            ) : (
              <FaVideoSlash className="text-lg" />
            )}
          </button>
        )}

        {/* Raise hand */}
        <button
          onClick={onToggleHand}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
            handRaised ? 'bg-amber-500 text-black' : 'bg-gray-600 hover:bg-gray-500'
          }`}
          aria-label={handRaised ? 'Lower hand' : 'Raise hand'}
          title={handRaised ? 'Lower hand' : 'Raise hand'}
        >
          <FaHandPaper className="text-lg" />
        </button>

        {/* Reactions */}
        <button
          onClick={() => setReactionPickerOpen((v) => !v)}
          className="w-12 h-12 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center transition"
          aria-label="Send reaction"
          title="React"
        >
          <FaSmile className="text-lg" />
        </button>

        {/* Data saver */}
        <button
          onClick={() => setDataSaverOpen((v) => !v)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
            dataSaver?.enabled
              ? 'bg-yellow-500 text-black'
              : 'bg-gray-600 hover:bg-gray-500'
          }`}
          aria-label="Data saver"
          title="Data saver"
        >
          <FaWifi className="text-lg" />
        </button>

        <button
          onClick={() => (showEndMenu ? setEndMenuOpen((v) => !v) : onHangUp())}
          onContextMenu={(e) => {
            if (showEndMenu) {
              e.preventDefault();
              setEndMenuOpen(true);
            }
          }}
          className="w-14 h-14 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition shadow-lg"
          aria-label="Leave / End call"
        >
          <FaPhoneSlash className="text-xl" />
        </button>

        <ReactionPicker
          open={reactionPickerOpen}
          onClose={() => setReactionPickerOpen(false)}
          onPick={onReact}
        />

        <DataSaverMenu
          open={dataSaverOpen}
          onClose={() => setDataSaverOpen(false)}
          dataSaver={dataSaver}
          onChange={onDataSaverChange}
        />

        {endMenuOpen && showEndMenu && (
          <>
            <div
              className="fixed inset-0 z-[60]"
              onClick={() => setEndMenuOpen(false)}
            />
            <div className="absolute bottom-24 z-[70] bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden w-52">
              <button
                onClick={() => {
                  setEndMenuOpen(false);
                  onHangUp();
                }}
                className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/5 flex items-center gap-2"
              >
                <FaSignOutAlt className="text-xs" /> Leave only
              </button>
              <button
                onClick={() => {
                  setEndMenuOpen(false);
                  onEndForAll();
                }}
                className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 border-t border-white/5"
              >
                <FaPhoneSlash className="text-xs" /> End for everyone
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Full-screen wrapper
// ─────────────────────────────────────────────────────────────────────
const FullScreen = ({ children }) => (
  <div
    className="min-h-dvh bg-[#0b0b10] text-white flex flex-col items-center justify-center p-6"
    style={{
      paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',
      paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
    }}
  >
    {children}
  </div>
);

// ═════════════════════════════════════════════════════════════════════
// MAIN — CallScreen
// ═════════════════════════════════════════════════════════════════════
const CallScreen = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { userInfo } = useSelector((s) => s.auth);
  const socketContext = useSocket();
  const socket = socketContext?.socket;

  const callId = params.callId || params.roomId;
  const myId = String(userInfo?._id || '');

  // ─── Queries ───────────────────────────────────────────────
  const {
    data: callData,
    isLoading: callLoading,
    error: callError,
    refetch: refetchCall,
  } = useGetCallByIdQuery(callId, {
    skip: !callId || !userInfo,
    pollingInterval: POLL_MS,
    refetchOnFocus: true,
  });
  const call = callData?.call;

  // ─── Mutations ─────────────────────────────────────────────
  const [getCallToken] = useGetCallTokenMutation();
  const [joinCall] = useJoinCallMutation();
  const [leaveCall] = useLeaveCallMutation();
  const [endCall] = useEndCallMutation();
  const [rejectCall] = useRejectCallMutation();

  // ─── AI mutations ──────────────────────────────────────────
  const [startCallAI] = useStartCallAIMutation();
  const [stopCallAI] = useStopCallAIMutation();
  const [finalizeCallNotes] = useFinalizeCallNotesMutation();
  const [pushCallTranscript] = usePushCallTranscriptMutation();
  const [askCallAIText] = useAskCallAITextMutation();
  const [askCallAIVoice] = useAskCallAIVoiceMutation();
  const [sendInCallMessage] = useSendInCallMessageMutation();
  const [setRaisedHand] = useSetRaisedHandMutation();
  const [sendCallReaction] = useSendCallReactionMutation();
  const [updateCallDataSaver] = useUpdateCallDataSaverMutation();

  // ─── Local state ───────────────────────────────────────────
  const [phase, setPhase] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [tokenData, setTokenData] = useState(null);
  const [permState, setPermState] = useState('idle');
  const [permError, setPermError] = useState('');
  const [deviceError, setDeviceError] = useState('');
  const [connectionLost, setConnectionLost] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);

  // ─── AI state ──────────────────────────────────────────────
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiTab, setAiTab] = useState('summary');
  const [aiStarting, setAiStarting] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [liveSummary, setLiveSummary] = useState(null);
  const [aiExchanges, setAiExchanges] = useState([]);
  const [inCallMessages, setInCallMessages] = useState([]);
  const [raisedHands, setRaisedHands] = useState([]);
  const [handRaised, setHandRaised] = useState(false);
  const [dataSaver, setDataSaver] = useState({
    enabled: false,
    audioOnly: false,
    videoQuality: 'auto',
  });
  const [reactions, setReactions] = useState([]);
  const [noteReady, setNoteReady] = useState(null);

  // Ask-AI state
  const [askText, setAskText] = useState('');
  const [askingText, setAskingText] = useState(false);
  const [askingVoice, setAskingVoice] = useState(false);
  const audioRef = useRef(null);

  // Chat state
  const [chatText, setChatText] = useState('');

  // Voice recorder for ask-AI
  const voiceRec = useVoiceRecorder();

  const leavingRef = useRef(false);
  const hasJoinedRef = useRef(false);

  // ─── My participant ────────────────────────────────────────
  const myParticipant = useMemo(
    () => call?.participants?.find((p) => getUserId(p) === myId),
    [call, myId]
  );
  const isCreator = String(call?.creator?._id || call?.creator || '') === myId;
  const wantsVideo = call?.type === 'video';
  const aiEnabled = !!call?.ai?.enabled;

  // Only the creator can view a PersonalNote (the note goes to the
  // initiator). WorkspaceNote is visible to every workspace member.
  const canViewNote =
    !!noteReady &&
    (noteReady.kind === 'WorkspaceNote' || isCreator);

  // ─── Navigation helper ─────────────────────────────────────
  const goBack = useCallback(() => {
    if (location.key && location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/calls', { replace: true });
    }
  }, [location.key, navigate]);

  // ─── Auth guard ────────────────────────────────────────────
  useEffect(() => {
    if (!userInfo) navigate('/login', { replace: true });
  }, [userInfo, navigate]);

  // ─── Phase resolution ──────────────────────────────────────
  useEffect(() => {
    if (!call) return;
    if (!myParticipant) {
      setPhase('error');
      setErrorMsg("You're not a participant in this call.");
      return;
    }

    const callIsOver = ['ended', 'missed', 'cancelled'].includes(call.status);
    const myStatus = myParticipant.status;

    if (myStatus === 'rejected' || myStatus === 'left') {
      setPhase('ended-for-you');
      return;
    }

    if (callIsOver) {
      setPhase('ended');
      return;
    }

    if (myStatus === 'accepted') {
      if (phase !== 'in-call' && phase !== 'joining') setPhase('joining');
      return;
    }

    if (['ringing', 'missed', 'pending'].includes(myStatus)) {
      if (phase !== 'in-call' && phase !== 'joining') setPhase('can-join');
      return;
    }
  }, [call, myParticipant, phase]);

  // ─── Permission pre-flight ─────────────────────────────────
  const runPermissionCheck = useCallback(async () => {
    setPermState('checking');
    setPermError('');
    const res = await ensureCallPermissions(wantsVideo);
    if (res.ok) {
      setPermState('granted');
      return true;
    }
    setPermState('denied');
    setPermError(res.message || 'Microphone permission is required.');
    return false;
  }, [wantsVideo]);

  // ─── Join: permission → joinCall (if needed) → token ───────
  const doJoin = useCallback(
    async ({ markAccepted = false } = {}) => {
      if (hasJoinedRef.current) return;
      hasJoinedRef.current = true;
      setPhase('joining');

      if (permState !== 'granted') {
        const ok = await runPermissionCheck();
        if (!ok) {
          hasJoinedRef.current = false;
          setPhase('can-join');
          return;
        }
      }

      if (markAccepted || myParticipant?.status !== 'accepted') {
        try {
          await joinCall(callId).unwrap();
        } catch (err) {
          const msg = err?.data?.message || 'Failed to join call';
          setErrorMsg(msg);
          setPhase('can-join');
          hasJoinedRef.current = false;
          toast.error(msg);
          return;
        }
      }

      try {
        const res = await getCallToken(callId).unwrap();

        // Hydrate AI + meeting state
        if (Array.isArray(res.recentTranscript)) setTranscript(res.recentTranscript);
        if (res.liveSummary) setLiveSummary(res.liveSummary);
        if (Array.isArray(res.recentMessages)) setInCallMessages(res.recentMessages);
        if (Array.isArray(res.raisedHands)) {
          setRaisedHands(res.raisedHands);
          setHandRaised(res.raisedHands.some((h) => String(h.userId) === myId));
        }
        if (res.dataSaver) setDataSaver(res.dataSaver);

        setTokenData(res);
        setPhase('in-call');
      } catch (err) {
        const msg = err?.data?.message || 'Failed to get media token';
        setErrorMsg(msg);
        setPhase('can-join');
        hasJoinedRef.current = false;
        toast.error(msg);
      }
    },
    [
      callId,
      joinCall,
      getCallToken,
      myParticipant,
      permState,
      runPermissionCheck,
      myId,
    ]
  );

  // Auto-join if already accepted (creator, or user accepted via Calls page)
  useEffect(() => {
    if (phase === 'joining' && !tokenData && myParticipant?.status === 'accepted') {
      doJoin({ markAccepted: false });
    }
  }, [phase, tokenData, myParticipant, doJoin]);

  // ─── Socket: room + call-events + AI events ────────────────
  useEffect(() => {
    if (!socket || !call?.roomId) return;
    const room = call.roomId;
    socket.emit('join-call-room', room, () => {});

    const onEnded = () => {
      if (leavingRef.current) return;
      setPhase('ended');
      refetchCall?.();
    };
    const onTranscript = ({ callId: cid, segments }) => {
      if (String(cid) !== String(callId)) return;
      setTranscript((prev) => [...prev, ...segments].slice(-500));
    };
    const onSummary = ({ callId: cid, summary }) => {
      if (String(cid) !== String(callId)) return;
      setLiveSummary(summary);
    };
    const onExchange = (p) => {
      if (String(p.callId) !== String(callId)) return;
      setAiExchanges((prev) => [
        ...prev,
        { question: p.question, answer: p.answer, sources: p.sources },
      ]);
    };
    const onChat = (p) => {
      if (String(p.callId) !== String(callId)) return;
      setInCallMessages((prev) => [...prev, p.message]);
    };
    const onHand = (p) => {
      if (String(p.callId) !== String(callId)) return;
      setRaisedHands(p.raisedHands || []);
    };
    const onReaction = (p) => {
      if (String(p.callId) !== String(callId)) return;
      const id = Math.random().toString(36).slice(2);
      setReactions((prev) => [...prev, { ...p, _id: id }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r._id !== id));
      }, 3000);
    };
    const onNoteReady = (p) => {
      if (String(p.callId) !== String(callId)) return;
      setNoteReady({
        noteId: p.noteId,
        kind: p.kind,
        title: p.title,
      });
      toast.success('AI notes are ready!');
    };

    socket.on('call-ended', onEnded);
    socket.on('call-transcript-update', onTranscript);
    socket.on('call-summary-update', onSummary);
    socket.on('call-ai-exchange', onExchange);
    socket.on('call-chat-message', onChat);
    socket.on('call-hand-update', onHand);
    socket.on('call-reaction', onReaction);
    socket.on('call-note-ready', onNoteReady);

    return () => {
      socket.off('call-ended', onEnded);
      socket.off('call-transcript-update', onTranscript);
      socket.off('call-summary-update', onSummary);
      socket.off('call-ai-exchange', onExchange);
      socket.off('call-chat-message', onChat);
      socket.off('call-hand-update', onHand);
      socket.off('call-reaction', onReaction);
      socket.off('call-note-ready', onNoteReady);
      socket.emit('leave-call-room', room);
    };
  }, [socket, call?.roomId, callId, refetchCall]);

  // ─── Actions ───────────────────────────────────────────────
  const handleAnswer = () => doJoin({ markAccepted: true });

  const handleDecline = async () => {
    try {
      await rejectCall(callId).unwrap();
    } catch {
      /* ignore */
    }
    goBack();
  };

  const handleHangUp = useCallback(async () => {
    leavingRef.current = true;
    try {
      await leaveCall(callId).unwrap();
    } catch {
      /* ignore */
    }
    goBack();
  }, [callId, leaveCall, goBack]);

  const handleEndForAll = useCallback(async () => {
    leavingRef.current = true;
    try {
      await endCall(callId).unwrap();
    } catch {
      /* ignore */
    }
    goBack();
  }, [callId, endCall, goBack]);

  const handleDisconnected = useCallback(
    async (reason) => {
      if (leavingRef.current) return;
      if (reason === DisconnectReason.CLIENT_INITIATED) return;
      try {
        const result = await refetchCall().unwrap();
        if (['ended', 'missed', 'cancelled'].includes(result?.call?.status)) {
          setPhase('ended');
          return;
        }
      } catch {
        /* ignore */
      }
      setConnectionLost(true);
    },
    [refetchCall]
  );

  const handleDeviceFailure = useCallback((failure) => {
    console.error('[call] media device failure:', failure);
    setDeviceError(deviceFailureMessage(failure));
  }, []);

  const handleCopyLink = () => {
    if (!call?.meetingLink) return;
    navigator.clipboard.writeText(call.meetingLink);
    toast.success('Link copied — share it to invite guests');
  };

  // ─── AI handlers ───────────────────────────────────────────
  const handleStartAI = useCallback(async () => {
    if (aiStarting) return;
    setAiStarting(true);
    try {
      // For direct calls & non-workspace meetings, backend defaults
      // to 'personal' (goes to the initiator's notes). For workspace
      // meetings, defaults to 'workspace'. We pass nothing to use the
      // server's smart default.
      await startCallAI({ callId }).unwrap();
      toast.success('AI notes started');
    } catch (err) {
      toast.error(err?.data?.message || 'Could not start AI');
    } finally {
      setAiStarting(false);
    }
  }, [aiStarting, callId, startCallAI]);

  const handleStopAI = useCallback(async () => {
    if (aiStarting) return;
    if (!window.confirm('Stop AI and generate the final notes?')) return;
    setAiStarting(true);
    try {
      const res = await stopCallAI(callId).unwrap();
      if (res?.created) {
        setNoteReady({
          noteId: res.noteId,
          kind: res.kind,
          title: res.title,
        });
        toast.success('Final notes saved!');
      } else if (res?.reason) {
        toast.info(res.reason);
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Could not stop AI');
    } finally {
      setAiStarting(false);
    }
  }, [aiStarting, callId, stopCallAI]);

  const handleTranscriptSegment = useCallback(
    (text) => {
      // Barge-in — user speech stops any playing TTS
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {}
        audioRef.current = null;
      }
      if (!aiEnabled || !callId || !text?.trim()) return;
      pushCallTranscript({
        callId,
        segments: [{ text: text.trim(), isFinal: true, at: new Date() }],
      }).catch(() => {});
    },
    [aiEnabled, callId, pushCallTranscript]
  );

  const handleAskText = useCallback(async () => {
    const q = askText.trim();
    if (!q || askingText) return;
    setAskingText(true);
    try {
      const res = await askCallAIText({
        callId,
        question: q,
        wantAudio: true,
      }).unwrap();
      setAskText('');
      setAiExchanges((prev) => [
        ...prev,
        { question: q, answer: res.answer, sources: res.sources },
      ]);
      if (res.audio?.base64) {
        audioRef.current = playAudioDataUrl(
          res.audio.base64,
          res.audio.format,
          () => {
            audioRef.current = null;
          }
        );
      }
    } catch (err) {
      toast.error(err?.data?.message || 'AI could not answer.');
    } finally {
      setAskingText(false);
    }
  }, [askText, askingText, callId, askCallAIText]);

  const handleAskVoiceStart = useCallback(async () => {
    if (askingVoice) return;
    await voiceRec.start();
  }, [askingVoice, voiceRec]);

  const handleAskVoiceStop = useCallback(async () => {
    const blob = await voiceRec.stop();
    if (!blob || blob.size === 0) return;
    setAskingVoice(true);
    try {
      const res = await askCallAIVoice({
        callId,
        audio: blob,
        filename: 'question.webm',
      }).unwrap();
      if (res.empty) {
        toast.info("Didn't catch that — try again.");
        return;
      }
      setAiExchanges((prev) => [
        ...prev,
        { question: res.question, answer: res.answer, sources: res.sources },
      ]);
      if (res.audio?.base64) {
        audioRef.current = playAudioDataUrl(
          res.audio.base64,
          res.audio.format,
          () => {
            audioRef.current = null;
          }
        );
      }
    } catch (err) {
      toast.error(err?.data?.message || 'AI could not answer.');
    } finally {
      setAskingVoice(false);
    }
  }, [callId, askCallAIVoice, voiceRec]);

  const handleSendChat = useCallback(async () => {
    const c = chatText.trim();
    if (!c) return;
    setChatText('');
    setInCallMessages((prev) => [
      ...prev,
      {
        sender: myId,
        senderName: userInfo?.name || 'You',
        content: c,
        kind: 'text',
        createdAt: new Date(),
      },
    ]);
    try {
      await sendInCallMessage({ callId, content: c }).unwrap();
    } catch (err) {
      toast.error(err?.data?.message || 'Message failed.');
    }
  }, [chatText, callId, myId, userInfo?.name, sendInCallMessage]);

  const handleToggleHand = useCallback(async () => {
    const next = !handRaised;
    setHandRaised(next);
    try {
      await setRaisedHand({ callId, raised: next }).unwrap();
    } catch (err) {
      setHandRaised(!next);
      toast.error(err?.data?.message || 'Could not update hand.');
    }
  }, [handRaised, callId, setRaisedHand]);

  const handleReact = useCallback(
    async (emoji) => {
      try {
        await sendCallReaction({ callId, emoji }).unwrap();
      } catch {
        toast.error('Could not send reaction.');
      }
    },
    [callId, sendCallReaction]
  );

  const handleDataSaverChange = useCallback(
    async (patch) => {
      const next = { ...dataSaver, ...patch };
      setDataSaver(next);
      try {
        await updateCallDataSaver({ callId, ...patch }).unwrap();
      } catch (err) {
        toast.error(err?.data?.message || 'Could not update.');
      }
    },
    [callId, dataSaver, updateCallDataSaver]
  );

  const handleOpenNote = useCallback(() => {
    if (!noteReady?.noteId) return;
    if (noteReady.kind === 'WorkspaceNote') {
      const wsId = call?.workspace?._id || call?.workspace || tokenData?.workspaceId;
      navigate(`/workspace/${wsId}/notes/${noteReady.noteId}`);
    } else {
      navigate(`/notes/${noteReady.noteId}`);
    }
  }, [noteReady, call?.workspace, tokenData?.workspaceId, navigate]);

  // ─── Early returns ─────────────────────────────────────────
  if (!callId || !userInfo) {
    return (
      <FullScreen>
        <FaExclamationTriangle className="text-3xl text-amber-400 mb-3" />
        <p className="text-white text-base mb-4">Invalid call link.</p>
        <button
          onClick={goBack}
          className="px-6 py-3 rounded-full text-white font-semibold"
          style={{ backgroundColor: BRAND }}
        >
          Go back
        </button>
      </FullScreen>
    );
  }

  if (callLoading && !call) {
    return (
      <FullScreen>
        <FaSpinner className="animate-spin text-3xl text-white/70" />
        <p className="text-gray-400 text-sm mt-4">Loading call…</p>
      </FullScreen>
    );
  }

  if (callError) {
    return (
      <FullScreen>
        <FaExclamationTriangle className="text-3xl text-red-400 mb-3" />
        <p className="text-white text-base mb-4">
          {callError?.data?.message || "We couldn't load this call."}
        </p>
        <button
          onClick={goBack}
          className="px-6 py-3 rounded-full text-white font-semibold"
          style={{ backgroundColor: BRAND }}
        >
          Go back
        </button>
      </FullScreen>
    );
  }

  if (phase === 'error') {
    return (
      <FullScreen>
        <FaExclamationTriangle className="text-3xl text-red-400 mb-3" />
        <p className="text-white text-base mb-4">{errorMsg}</p>
        <button
          onClick={goBack}
          className="px-6 py-3 rounded-full text-white font-semibold"
          style={{ backgroundColor: BRAND }}
        >
          Go back
        </button>
      </FullScreen>
    );
  }

  if (phase === 'ended-for-you') {
    const wasLeft = myParticipant?.status === 'left';
    return (
      <FullScreen>
        <div className="text-6xl mb-6">📞</div>
        <h2 className="text-2xl font-bold mb-2">
          {wasLeft ? 'You left this call' : 'You rejected this call'}
        </h2>
        <p className="text-gray-400 mb-6 text-sm max-w-sm mx-auto text-center">
          {call?.status === 'ongoing'
            ? 'The call is still going on for other participants.'
            : 'The call has ended.'}
        </p>
        {canViewNote && (
          <button
            onClick={handleOpenNote}
            className="mb-3 px-6 py-3 rounded-full font-semibold text-white flex items-center gap-2 mx-auto"
            style={{ backgroundColor: BRAND }}
          >
            <FaBookOpen /> View AI notes
          </button>
        )}
        <button
          onClick={goBack}
          className="px-6 py-3 rounded-full font-semibold text-white transition"
          style={{ backgroundColor: BRAND }}
        >
          Back to calls
        </button>
      </FullScreen>
    );
  }

  if (phase === 'ended') {
    return (
      <FullScreen>
        <div className="text-6xl mb-6">📞</div>
        <h2 className="text-2xl font-bold mb-2">Call Ended</h2>
        <p className="text-gray-400 mb-6 text-sm">
          {call?.type === 'video'
            ? 'Your video call has ended.'
            : 'Your voice call has ended.'}
        </p>

        {canViewNote && (
          <button
            onClick={handleOpenNote}
            className="mb-3 px-6 py-3 rounded-full font-semibold text-white flex items-center gap-2 mx-auto"
            style={{ backgroundColor: BRAND }}
          >
            <FaBookOpen /> View AI notes
          </button>
        )}

        {noteReady && !canViewNote && (
          <div className="mb-4 max-w-sm text-center rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-xs text-gray-300">
            AI notes were saved to{' '}
            <strong>{call?.creator?.name || 'the initiator'}'s</strong> personal
            notes. Ask them to share if you need a copy.
          </div>
        )}

        <button
          onClick={goBack}
          className="px-6 py-3 rounded-full font-semibold text-white transition"
          style={{ backgroundColor: BRAND }}
        >
          Back to calls
        </button>
      </FullScreen>
    );
  }

  if (phase === 'can-join' || phase === 'joining') {
    const myStatus = myParticipant?.status;
    const isRinging = myStatus === 'ringing';
    const isLateJoin = myStatus === 'missed' || myStatus === 'pending';
    const others = (call.participants || []).filter(
      (p) => getUserId(p) !== myId && p.status === 'accepted'
    );

    const title = isRinging
      ? 'Incoming call'
      : isLateJoin
      ? 'Call in progress'
      : 'Join call';

    const subtitle = isRinging
      ? call?.creator?.name
        ? `${call.creator.name} is calling…`
        : 'You have an incoming call'
      : isLateJoin
      ? 'You missed this call — you can still join while it’s ongoing.'
      : 'Ready to jump in?';

    return (
      <div
        className="min-h-dvh bg-[#0b0b10] text-white flex flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <FaArrowLeft className="text-sm" />
          </button>
          <div className="text-right">
            <h3 className="text-sm font-semibold">
              {call.type === 'video' ? 'Video Call' : 'Voice Call'}
              {call.isMeeting && (
                <span className="text-[10px] font-normal text-cyan-400 ml-2 uppercase tracking-wide">
                  Meeting
                </span>
              )}
            </h3>
            <p className="text-[11px] text-gray-400">
              {call.participants?.length || 0} invited
            </p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-sm w-full">
            <div className="flex justify-center gap-3 mb-6 flex-wrap">
              {others.slice(0, 4).map((p) => (
                <Avatar
                  key={getUserId(p)}
                  info={{ name: p.user?.name || '?', profile: p.user?.profile }}
                  size={72}
                />
              ))}
              {others.length === 0 && (
                <Avatar
                  info={{
                    name: call.creator?.name || '?',
                    profile: call.creator?.profile,
                  }}
                  size={72}
                />
              )}
            </div>

            <h2 className="text-xl font-bold mb-1">{title}</h2>
            <p className="text-sm text-gray-400 mb-6">{subtitle}</p>

            {permState === 'checking' && (
              <p className="text-xs text-gray-400 mb-4 flex items-center justify-center gap-2">
                <FaSpinner className="animate-spin" /> Allow mic access…
              </p>
            )}

            {permState === 'denied' && (
              <div className="mb-4 rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-sm text-red-300">
                {permError}
              </div>
            )}

            {errorMsg && (
              <div className="mb-4 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-sm text-amber-300">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              {isRinging && (
                <button
                  onClick={handleDecline}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition shadow-lg"
                  aria-label="Decline"
                >
                  <FaPhoneSlash className="text-xl" />
                </button>
              )}
              <button
                onClick={handleAnswer}
                disabled={phase === 'joining'}
                className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#16a34a' }}
                aria-label={isLateJoin ? 'Join' : 'Answer'}
              >
                {phase === 'joining' ? (
                  <FaSpinner className="animate-spin text-2xl" />
                ) : (
                  <FaPhone className="text-2xl" />
                )}
              </button>
            </div>

            {call.isMeeting && call.meetingLink && (
              <button
                onClick={handleCopyLink}
                className="mt-6 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition"
              >
                <FaLink className="text-[10px]" /> Copy meeting link
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'in-call' && tokenData && !connectionLost) {
    return (
      <>
        <LiveKitRoom
          serverUrl={tokenData.url}
          token={tokenData.token}
          connect
          audio
          video={wantsVideo}
          options={ROOM_OPTIONS}
          onDisconnected={handleDisconnected}
          onMediaDeviceFailure={handleDeviceFailure}
        >
          <CallStage
            isVideo={wantsVideo}
            brandColor={BRAND}
            call={call}
            isCreator={isCreator}
            deviceError={deviceError}
            onHangUp={handleHangUp}
            onEndForAll={() => setEndConfirmOpen(true)}
            onCopyLink={handleCopyLink}
            // AI + meeting
            aiEnabled={aiEnabled}
            aiStarting={aiStarting}
            onStartAI={handleStartAI}
            onStopAI={handleStopAI}
            transcriptSupported={
              typeof window !== 'undefined' &&
              !!(window.SpeechRecognition || window.webkitSpeechRecognition)
            }
            onTranscriptSegment={handleTranscriptSegment}
            onOpenAIPanel={() => setAiPanelOpen(true)}
            transcriptCount={transcript.length}
            handRaised={handRaised}
            onToggleHand={handleToggleHand}
            onReact={handleReact}
            raisedHands={raisedHands}
            dataSaver={dataSaver}
            onDataSaverChange={handleDataSaverChange}
            reactions={reactions}
          />
        </LiveKitRoom>

        <AIPanel
          open={aiPanelOpen}
          onClose={() => setAiPanelOpen(false)}
          tab={aiTab}
          setTab={setAiTab}
          brandColor={BRAND}
          aiEnabled={aiEnabled}
          transcriptSupported={
            typeof window !== 'undefined' &&
            !!(window.SpeechRecognition || window.webkitSpeechRecognition)
          }
          transcript={transcript}
          liveSummary={liveSummary}
          exchanges={aiExchanges}
          chatMessages={inCallMessages}
          noteReady={noteReady}
          askText={askText}
          setAskText={setAskText}
          onAskText={handleAskText}
          askingText={askingText}
          onAskVoiceStart={handleAskVoiceStart}
          onAskVoiceStop={handleAskVoiceStop}
          voiceRecording={voiceRec.recording}
          askingVoice={askingVoice}
          chatText={chatText}
          setChatText={setChatText}
          onSendChat={handleSendChat}
          meId={myId}
        />

        {endConfirmOpen && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setEndConfirmOpen(false)}
          >
            <div
              className="bg-[#14141a] border border-white/10 rounded-2xl max-w-sm w-full p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold text-white mb-2">End for everyone?</h3>
              <p className="text-xs text-gray-400 mb-5">
                This will disconnect all participants. It cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setEndConfirmOpen(false)}
                  className="py-2.5 border border-white/15 rounded-xl text-sm text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setEndConfirmOpen(false);
                    handleEndForAll();
                  }}
                  className="py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium"
                >
                  End call
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (connectionLost) {
    return (
      <FullScreen>
        <FaExclamationTriangle className="text-3xl text-amber-400 mb-3" />
        <h2 className="text-xl font-bold mb-2">Connection lost</h2>
        <p className="text-sm text-gray-400 mb-6 max-w-sm text-center">
          We couldn’t reconnect to the call. Try again or leave.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setConnectionLost(false);
              leavingRef.current = false;
              hasJoinedRef.current = false;
              doJoin({ markAccepted: false });
            }}
            className="px-6 py-3 rounded-full font-semibold text-white"
            style={{ backgroundColor: BRAND }}
          >
            Reconnect
          </button>
          <button
            onClick={handleHangUp}
            className="px-6 py-3 rounded-full font-semibold bg-red-600 hover:bg-red-700 text-white"
          >
            Leave
          </button>
        </div>
      </FullScreen>
    );
  }

  return (
    <FullScreen>
      <FaSpinner className="animate-spin text-3xl text-white/70" />
      <p className="text-gray-400 text-sm mt-4">Preparing your call…</p>
    </FullScreen>
  );
};

export default CallScreen;
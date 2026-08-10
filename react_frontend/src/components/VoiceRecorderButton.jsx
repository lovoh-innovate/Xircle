// src/components/VoiceRecorderButton.jsx
import React, { useState, useRef, useEffect } from 'react';
import { FaMicrophone, FaStop, FaTimes, FaPlay, FaPause, FaCheckCircle, FaTrashAlt  } from 'react-icons/fa';
import { toast } from 'react-hot-toast';

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const VoiceRecorderButton = ({
  onSendAudio, // function that receives the audio Blob and duration
  isDisabled = false, // whether to disable recording (e.g., when replying)
  brandColor = '#0d9488',
  size = 'text-sm',
  className = '',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);
  const isRecordingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecordingRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordingBlob(blob);
        setShowPreview(true);
        stopTimer();
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingPaused(false);
      setRecordingTime(0);
      setShowPreview(false);
      startTimer();
    } catch (err) {
      toast.error('Microphone access denied');
    }
  };

  const pauseRecording = () => {
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

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setRecordingBlob(null);
    setShowPreview(false);
    setRecordingTime(0);
    setIsRecording(false);
    stopTimer();
  };

  const sendAudio = async () => {
    if (recordingBlob) {
      await onSendAudio(recordingBlob, recordingTime);
      setRecordingBlob(null);
      setShowPreview(false);
      setRecordingTime(0);
    }
  };

  // ─── Pointer handlers for press‑and‑hold ────────────────────────
  const handlePointerDown = (e) => {
    if (isDisabled) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    startRecording();
  };

  const handlePointerUp = (e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (isRecording && !recordingPaused) {
      stopRecording();
    }
  };

  // ─── Render preview UI when recording is finished ──────────────
  if (showPreview && recordingBlob) {
    return (
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
            onClick={sendAudio}
            className="px-3 py-1 bg-green-600 dark:bg-green-700 text-white rounded text-xs hover:bg-green-700 dark:hover:bg-green-800 transition"
          >
            Send
          </button>
          <button
            onClick={cancelRecording}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white"
          >
            <FaTimes className="text-xs" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Render recording indicator ──────────────────────────────────
  if (isRecording) {
    return (
      <div className="flex items-center justify-between px-3 py-2 mb-2 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700/40">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-red-600 dark:text-red-300">
            {recordingPaused ? 'Paused' : 'Recording...'} {formatTime(recordingTime)}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={pauseRecording}
            className="text-xs text-red-600 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200"
          >
            {recordingPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={cancelRecording}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white"
          >
            <FaTrashAlt className="text-xs" />
          </button>
          <button
            onClick={stopRecording}
            className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition"
          >
            <FaStop className="text-xs" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Default: microphone button ──────────────────────────────────
  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      disabled={isDisabled}
      className={`p-2 rounded-full text-white flex-shrink-0 transition hover:opacity-80 ${className}`}
      style={{ backgroundColor: brandColor }}
      aria-label="Record voice note"
    >
      <FaMicrophone className={size} />
    </button>
  );
};

export default VoiceRecorderButton;
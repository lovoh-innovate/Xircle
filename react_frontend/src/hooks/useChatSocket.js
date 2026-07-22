// src/hooks/useChatSocket.js
import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../components/SocketContext.jsx';

export const useChatSocket = (chatId, userId) => {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});

  useEffect(() => {
    if (!socket || !chatId || !isConnected) return;

    socket.emit('join-chat', chatId);

    const handleNewMessage = (msg) => setMessages(prev => [...prev, msg]);
    const handleTyping = ({ user }) => setTypingUsers(prev => [...prev, user._id]);
    const handleStopTyping = ({ userId }) => setTypingUsers(prev => prev.filter(id => id !== userId));
    const handleStatus = ({ userId, online, lastSeen }) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: { online, lastSeen } }));
    };
    const handleDeleted = ({ messageId }) => setMessages(prev => prev.filter(m => m._id !== messageId));

    socket.on('new-message', handleNewMessage);
    socket.on('user-typing', handleTyping);
    socket.on('user-stopped-typing', handleStopTyping);
    socket.on('user-status-changed', handleStatus);
    socket.on('message-deleted', handleDeleted);

    return () => {
      socket.emit('leave-chat', chatId);
      socket.off('new-message', handleNewMessage);
      socket.off('user-typing', handleTyping);
      socket.off('user-stopped-typing', handleStopTyping);
      socket.off('user-status-changed', handleStatus);
      socket.off('message-deleted', handleDeleted);
    };
  }, [socket, chatId, isConnected]);

  const sendMessage = useCallback((content, opts = {}) => {
    socket?.emit('send-message', {
      chatId,
      content,
      messageType: opts.messageType || 'text',
      mentions: opts.mentions || [],
      replyToId: opts.replyToId || null,
      mediaUrl: opts.mediaUrl || null,
      mediaName: opts.mediaName || null,
      mediaSize: opts.mediaSize || null,
      mediaDuration: opts.mediaDuration || null,
    }, (res) => {
      if (res?.error) console.error('Message failed:', res.error);
    });
  }, [socket, chatId]);

  const startTyping = useCallback(() => socket?.emit('start-typing', { chatId }), [socket, chatId]);
  const stopTyping = useCallback(() => socket?.emit('stop-typing', { chatId }), [socket, chatId]);
  const markRead = useCallback((messageIds) => socket?.emit('mark-read', { chatId, messageIds }), [socket, chatId]);
  const deleteMessage = useCallback((messageId) => socket?.emit('delete-message', { messageId }, (res) => {
    if (res?.error) console.error('Delete failed:', res.error);
  }), [socket]);

  return {
    messages,
    typingUsers,
    onlineUsers,
    sendMessage,
    startTyping,
    stopTyping,
    markRead,
    deleteMessage,
    isConnected
  };
};
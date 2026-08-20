// src/context/SocketContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { connectSocket, disconnectSocket } from '../services/socket';
import { messagingApiSlice } from '../slices/messagingApiSlice';

const SocketContext = createContext(null);

export const SocketProvider = ({ children, token }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const dispatch = useDispatch();

  console.log('🔍 SocketProvider rendered, token:', token ? 'present' : 'MISSING');

  useEffect(() => {
    console.log('🔍 SocketProvider effect, token:', token ? 'present' : 'MISSING');

    if (!token) {
      console.warn('⚠️ No token – cannot connect socket');
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
      return;
    }

    console.log('🔌 Attempting to connect socket with token');
    const newSocket = connectSocket(token);
    setSocket(newSocket);

    const onConnect = () => {
      console.log('✅ Socket connected from context');
      setIsConnected(true);
    };
    const onDisconnect = () => {
      console.log('🔌 Socket disconnected from context');
      setIsConnected(false);
    };

    // 🔔 Listen for incoming calls from WebSocket
    const onIncomingCall = (callData) => {
      console.log('📞 Incoming call received via socket:', callData);
      setIncomingCall(callData);
    };

    // 🆕 Patch the message straight into the RTK Query cache the moment
    // it arrives — don't wait for a refetch, don't rely on localStorage.
    const onNewMessage = (message) => {
      console.log('📩 new-message received via socket:', message);

      const chatId = message.chat?._id || message.chat; // backend sends chat as an id string on Message.create, but populate elsewhere might expand it — handle both

      if (!chatId) {
        console.warn('⚠️ new-message payload missing chat id, skipping cache patch', message);
        return;
      }

      // Patch every cached getChatMessages entry for this chat, regardless
      // of what page/limit args it was originally fetched with.
      dispatch(
        messagingApiSlice.util.updateQueryData(
          'getChatMessages',
          { chatId, page: 1, limit: 50 }, // must match the args your chat screen actually calls the hook with
          (draft) => {
            if (!draft?.messages) return;
            const exists = draft.messages.some((m) => m._id === message._id);
            if (!exists) draft.messages.push(message);
          }
        )
      );

      // Also bump the chat list so lastMessage/lastMessageAt/unread counts
      // reflect the new message without a full refetch.
      dispatch(
        messagingApiSlice.util.invalidateTags([{ type: 'Chat', id: chatId }])
      );
    };

    newSocket.on('connect', onConnect);
    newSocket.on('disconnect', onDisconnect);
    newSocket.on('incoming-call', onIncomingCall);
    newSocket.on('new-message', onNewMessage); // 🆕

    if (newSocket.connected) setIsConnected(true);

    return () => {
      newSocket.off('connect', onConnect);
      newSocket.off('disconnect', onDisconnect);
      newSocket.off('incoming-call', onIncomingCall);
      newSocket.off('new-message', onNewMessage); // 🆕
    };
  }, [token, dispatch]);

  useEffect(() => {
    return () => {
      console.log('🧹 SocketProvider unmounting – disconnecting');
      disconnectSocket();
    };
  }, []);

  const clearIncomingCall = () => setIncomingCall(null);

  const setIncomingCallFromPush = (callData) => {
    console.log('📞 Incoming call set from push:', callData);
    setIncomingCall(callData);
  };

  const contextValue = {
    socket,
    isConnected,
    incomingCall,
    clearIncomingCall,
    setIncomingCallFromPush,
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
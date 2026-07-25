// src/context/SocketContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { connectSocket, disconnectSocket } from '../services/socket';

const SocketContext = createContext(null);

export const SocketProvider = ({ children, token }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);

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

    newSocket.on('connect', onConnect);
    newSocket.on('disconnect', onDisconnect);
    newSocket.on('incoming-call', onIncomingCall);

    if (newSocket.connected) setIsConnected(true);

    return () => {
      newSocket.off('connect', onConnect);
      newSocket.off('disconnect', onDisconnect);
      newSocket.off('incoming-call', onIncomingCall);
    };
  }, [token]);

  useEffect(() => {
    return () => {
      console.log('🧹 SocketProvider unmounting – disconnecting');
      disconnectSocket();
    };
  }, []);

  // ── Functions to manage incoming call ──────────────────────────

  const clearIncomingCall = () => setIncomingCall(null);

  // Allow external triggers (like push notifications) to set the incoming call
  const setIncomingCallFromPush = (callData) => {
    console.log('📞 Incoming call set from push:', callData);
    setIncomingCall(callData);
  };

  const contextValue = {
    socket,
    isConnected,
    incomingCall,
    clearIncomingCall,
    setIncomingCallFromPush, // ← new
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
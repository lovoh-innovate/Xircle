// src/context/SocketContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { connectSocket, disconnectSocket } from '../services/socket';

const SocketContext = createContext(null);

export const SocketProvider = ({ children, token }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null); // new

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

    // 🔔 Listen for incoming calls globally
    const onIncomingCall = (callData) => {
      console.log('📞 Incoming call received:', callData);
      setIncomingCall(callData);
    };

    newSocket.on('connect', onConnect);
    newSocket.on('disconnect', onDisconnect);
    newSocket.on('incoming-call', onIncomingCall); // new

    if (newSocket.connected) setIsConnected(true);

    return () => {
      newSocket.off('connect', onConnect);
      newSocket.off('disconnect', onDisconnect);
      newSocket.off('incoming-call', onIncomingCall); // new
    };
  }, [token]);

  useEffect(() => {
    return () => {
      console.log('🧹 SocketProvider unmounting – disconnecting');
      disconnectSocket();
    };
  }, []);

  // Function to clear incoming call after it's handled
  const clearIncomingCall = () => setIncomingCall(null);

  return (
    <SocketContext.Provider value={{ socket, isConnected, incomingCall, clearIncomingCall }}>
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
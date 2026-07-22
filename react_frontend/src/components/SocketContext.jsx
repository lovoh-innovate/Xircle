// src/context/SocketContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { connectSocket, disconnectSocket } from '../services/socket';

const SocketContext = createContext(null);

export const SocketProvider = ({ children, token }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

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

    newSocket.on('connect', onConnect);
    newSocket.on('disconnect', onDisconnect);

    if (newSocket.connected) setIsConnected(true);

    return () => {
      newSocket.off('connect', onConnect);
      newSocket.off('disconnect', onDisconnect);
    };
  }, [token]);

  useEffect(() => {
    return () => {
      console.log('🧹 SocketProvider unmounting – disconnecting');
      disconnectSocket();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
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
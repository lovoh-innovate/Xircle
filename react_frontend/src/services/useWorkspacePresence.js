// src/hooks/useWorkspacePresence.js
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { getSocket, connectSocket } from './socket';

/**
 * Tracks real-time online status of workspace members.
 *
 * - Joins the `workspace:<id>` socket room.
 * - Gets an immediate snapshot of who's online (via ack callback).
 * - Stays in sync afterwards through `member-status-changed` events.
 *
 * Returns a Set<string> of user IDs currently online in this workspace.
 */
export const useWorkspacePresence = (workspaceId) => {
  const { userInfo } = useSelector((state) => state.auth);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

  useEffect(() => {
    if (!workspaceId || !userInfo?.token) return undefined;

    // Reuse the app-wide socket if one already exists/connected;
    // otherwise establish it here.
    let socket = getSocket();
    if (!socket) {
      socket = connectSocket(userInfo.token);
    }

    const requestSnapshot = () => {
      socket.emit('join-workspace', workspaceId, (res) => {
        if (res?.online) {
          setOnlineUserIds(new Set(res.online));
        }
      });
    };

    const handleStatusChange = ({ userId, online }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    socket.on('member-status-changed', handleStatusChange);

    if (socket.connected) {
      requestSnapshot();
    }
    // In case the socket wasn't connected yet when this hook mounted,
    // re-request the snapshot once it actually connects.
    socket.on('connect', requestSnapshot);

    return () => {
      socket.off('member-status-changed', handleStatusChange);
      socket.off('connect', requestSnapshot);
    };
  }, [workspaceId, userInfo?.token]);

  return onlineUserIds;
};

export default useWorkspacePresence;
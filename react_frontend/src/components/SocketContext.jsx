import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import { useDispatch } from 'react-redux';

import {
  connectSocket,
  disconnectSocket,
} from '../services/socket';

import { messagingApiSlice } from '../slices/messagingApiSlice';

import { messagesRepository } from '../database/repositories/messagesRepository';

import { chatsRepository } from '../database/repositories/chatsRepository';

const SocketContext = createContext(null);

export const SocketProvider = ({ children, token }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);

  const dispatch = useDispatch();

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const newSocket = connectSocket(token);

    setSocket(newSocket);

    const onConnect = () => {
      console.log('✅ SocketContext: connected');
      setIsConnected(true);
    };

    const onDisconnect = () => {
      console.log('🔌 SocketContext: disconnected');
      setIsConnected(false);
    };

    const onIncomingCall = (callData) => {
      setIncomingCall(callData);
    };

    const onNewMessage = (message) => {
      console.log('📨 SocketContext: new-message received', message);

      /*
       * Support all possible server/client formats:
       *
       * message.chat._id
       * message.chat.id
       * message.chatId
       * message.chat_id
       * message.chat
       */
      const chatId =
        message?.chat?._id ||
        message?.chat?.id ||
        message?.chatId ||
        message?.chat_id ||
        (typeof message?.chat === 'string'
          ? message.chat
          : null);

      if (!chatId) {
        console.warn(
          '⚠️ new-message payload missing chat id, skipping:',
          message
        );
        return;
      }

      const messageId =
        message?._id ||
        message?.id;

      if (!messageId) {
        console.warn(
          '⚠️ new-message payload missing message id, skipping:',
          message
        );
        return;
      }

      /*
       * 1. Persist incoming message to SQLite.
       *
       * We intentionally use camelCase here because that is
       * the application's normal message format.
       *
       * messagesRepository._serialize() converts it to the
       * snake_case SQLite format.
       */
      messagesRepository
        .saveMessage({
          id: messageId,

          workspaceId:
            message.workspace?._id ||
            message.workspace?.id ||
            message.workspaceId ||
            message.workspace_id ||
            (typeof message.workspace === 'string'
              ? message.workspace
              : null),

          chatId,

          senderId:
            message.sender?._id ||
            message.sender?.id ||
            message.senderId ||
            message.sender_id ||
            (typeof message.sender === 'string'
              ? message.sender
              : null),

          content: message.content,

          messageType:
            message.messageType ||
            message.message_type ||
            'text',

          mediaUrl:
            message.mediaUrl ||
            message.media_url,

          mediaName:
            message.mediaName ||
            message.media_name,

          mediaSize:
            message.mediaSize ??
            message.media_size,

          mediaDuration:
            message.mediaDuration ??
            message.media_duration,

          mentions: message.mentions,

          replyTo:
            message.replyTo ||
            message.reply_to,

          createdAt:
            message.createdAt ||
            message.created_at,

          updatedAt:
            message.updatedAt ||
            message.updated_at,

          status: 'delivered',

          syncStatus: 'synced',
        })
        .then(() => {
          console.log(
            '💾 Incoming message persisted to SQLite:',
            messageId
          );
        })
        .catch((err) => {
          console.error(
            '❌ Failed to persist incoming message to SQLite:',
            err
          );
        });

      /*
       * 2. Update the local chat's latest message.
       */
      chatsRepository
        .updateLastMessage(
          chatId,
          messageId,
          message.createdAt ||
            message.created_at
        )
        .catch((err) => {
          console.error(
            '❌ Failed to update chat lastMessage in SQLite:',
            err
          );
        });

      /*
       * 3. Patch every cached getChatMessages query
       *    for this chat.
       */
      dispatch((dispatch, getState) => {
        const state = getState();

        const apiState =
          state[messagingApiSlice.reducerPath];

        if (!apiState?.queries) {
          return;
        }

        Object.values(apiState.queries).forEach(
          (queryEntry) => {
            if (
              !queryEntry ||
              queryEntry.endpointName !==
                'getChatMessages'
            ) {
              return;
            }

            const args = queryEntry.originalArgs;

            if (!args || args.chatId !== chatId) {
              return;
            }

            dispatch(
              messagingApiSlice.util.updateQueryData(
                'getChatMessages',
                args,
                (draft) => {
                  if (!draft?.messages) {
                    return;
                  }

                  const exists =
                    draft.messages.some(
                      (m) =>
                        m._id === messageId
                    );

                  if (!exists) {
                    draft.messages.push(message);
                  }
                }
              )
            );
          }
        );
      });

      /*
       * 4. Invalidate the chat cache so the chat list
       *    reflects the new message.
       */
      dispatch(
        messagingApiSlice.util.invalidateTags([
          {
            type: 'Chat',
            id: chatId,
          },
        ])
      );
    };

    newSocket.on('connect', onConnect);
    newSocket.on('disconnect', onDisconnect);
    newSocket.on(
      'incoming-call',
      onIncomingCall
    );
    newSocket.on(
      'new-message',
      onNewMessage
    );

    if (newSocket.connected) {
      setIsConnected(true);
    }

    return () => {
      newSocket.off('connect', onConnect);
      newSocket.off(
        'disconnect',
        onDisconnect
      );
      newSocket.off(
        'incoming-call',
        onIncomingCall
      );
      newSocket.off(
        'new-message',
        onNewMessage
      );
    };
  }, [token, dispatch]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  const clearIncomingCall = () => {
    setIncomingCall(null);
  };

  const setIncomingCallFromPush = (callData) => {
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
    throw new Error(
      'useSocket must be used within a SocketProvider'
    );
  }

  return context;
};
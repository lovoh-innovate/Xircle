// src/components/PreloadAppData.jsx
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { personalTaskApiSlice } from '../slices/personalTaskApiSlice';
import { messagingApiSlice } from '../slices/messagingApiSlice';

const PreloadAppData = () => {
  const dispatch = useDispatch();
  const { userInfo } = useSelector((state) => state.auth);
  const hasPreloaded = useRef(false);

  useEffect(() => {
    if (!userInfo?.token || hasPreloaded.current) return;
    hasPreloaded.current = true;

    // ── Chat list — args must match exactly what GeneralChatId.jsx,
    // GeneralChats.jsx, and GeneralSidebar.jsx all pass to
    // useGetUserChatsQuery, so all three read from this one cache entry
    // instead of each firing their own fetch.
    dispatch(
      messagingApiSlice.endpoints.getUserChats.initiate(
        { archived: false },
        { subscribe: true }
      )
    );

    // ── Personal tasks (sidebar's trimmed view + full tasks page) ──
    dispatch(
      personalTaskApiSlice.endpoints.getPersonalTasks.initiate(
        { status: 'pending', limit: 3 },
        { subscribe: true }
      )
    );
    dispatch(
      personalTaskApiSlice.endpoints.getPersonalTasks.initiate(
        {},
        { subscribe: true }
      )
    );

    // 👇 add one line per remaining core query (workspaces, channels, etc.)
    // once you confirm the exact args each screen uses.

  }, [userInfo?.token, dispatch]);

  return null;
};

export default PreloadAppData;
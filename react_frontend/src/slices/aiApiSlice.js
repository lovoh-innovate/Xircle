// src/slices/aiApiSlice.js
import { apiSlice } from './apiSlice';

const AI_URL = '/ai';

export const aiApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ═══════════════════════════════════════════════════════════════════
    // ── CHAT (the flexible one) ──────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════

    // ─── Send a turn to the AI ──────────────────────────────────────
    // body: {
    //   message:         string   (required)
    //   conversationId?: string   (omit for a new chat)
    //   workspaceId?:    string   (scope + active workspace hint)
    // }
    //
    // returns: {
    //   success: true,
    //   conversationId: string,
    //   answer:  string,
    //   actions: [{ tool, args, ok, summary }],
    //   generatedAt: Date
    // }
    //
    // The AI can chain multiple tool calls in one turn (clock you in AND
    // message a colleague, etc.). `actions` lists what it actually did.
    //
    // Invalidates anything the tools might have touched, so the rest of
    // the app refreshes when the AI does something.
    chatWithAI: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/chat`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result) => {
        // If the AI took no actions, nothing to invalidate.
        if (!result?.actions || result.actions.length === 0) return [];

        const tags = new Set();
        for (const action of result.actions) {
          if (!action?.ok) continue;
          switch (action.tool) {
            case 'clock_in':
            case 'clock_out':
              tags.add('ClockIn');
              break;
            case 'schedule_call':
            case 'start_call_now':
              tags.add('Call');
              break;
            case 'send_chat_message':
              tags.add('Chat');
              tags.add('Message');
              break;
            case 'create_task':
            case 'update_task_status':
              tags.add('Task');
              tags.add('Project');
              break;
            default:
              // Read-only tools — no invalidation.
              break;
          }
        }
        // Only invalidate the conversation list if a chat actually changed
        // shape — cheap enough to always add when there are actions.
        if (tags.size > 0) tags.add('AIConversation');
        return Array.from(tags);
      },
    }),

    // ─── List the caller's AI conversations ─────────────────────────
    // args: { workspaceId?, archived?: 'true' | 'false' }
    // returns: {
    //   success,
    //   conversations: [{
    //     _id, title, workspaceId, lastMessageAt, archived, createdAt,
    //     messageCount, preview
    //   }]
    // }
    getAIConversations: builder.query({
      query: ({ workspaceId, archived } = {}) => {
        const params = new URLSearchParams();
        if (workspaceId) params.set('workspaceId', workspaceId);
        if (archived !== undefined) params.set('archived', archived);
        const qs = params.toString();
        return `${AI_URL}/conversations${qs ? `?${qs}` : ''}`;
      },
      providesTags: (result) =>
        result?.conversations
          ? [
              ...result.conversations.map((c) => ({ type: 'AIConversation', id: c._id })),
              { type: 'AIConversation', id: 'LIST' },
            ]
          : [{ type: 'AIConversation', id: 'LIST' }],
    }),

    // ─── Fetch one full conversation (with all messages) ────────────
    // args: conversationId
    // returns: { success, conversation: { _id, title, messages: [...], ... } }
    getAIConversation: builder.query({
      query: (conversationId) => `${AI_URL}/conversations/${conversationId}`,
      providesTags: (result, error, conversationId) => [
        { type: 'AIConversation', id: conversationId },
      ],
    }),

    // ─── Create an empty conversation up front ──────────────────────
    // body: { title?, workspaceId? }
    // returns: { success, conversation }
    //
    // Rarely needed — POST /chat creates one automatically when
    // conversationId is omitted. Use this if you want an empty chat
    // to show up in the sidebar before the first message.
    createAIConversation: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/conversations`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'AIConversation', id: 'LIST' }],
    }),

    // ─── Rename or archive a conversation ───────────────────────────
    // body: { title?, archived? }
    // returns: { success, conversation }
    updateAIConversation: builder.mutation({
      query: ({ conversationId, ...body }) => ({
        url: `${AI_URL}/conversations/${conversationId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { conversationId }) => [
        { type: 'AIConversation', id: conversationId },
        { type: 'AIConversation', id: 'LIST' },
      ],
    }),

    // ─── Delete a conversation ──────────────────────────────────────
    deleteAIConversation: builder.mutation({
      query: (conversationId) => ({
        url: `${AI_URL}/conversations/${conversationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, conversationId) => [
        { type: 'AIConversation', id: conversationId },
        { type: 'AIConversation', id: 'LIST' },
      ],
    }),

    // ═══════════════════════════════════════════════════════════════════
    // ── PLANNING ─────────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════

    // ─── Preview a plan — NOTHING hits the DB ────────────────────────
    // body: { workspaceId, prompt }
    // returns: { success, plan: { project, tasks, warnings } }
    planWithAI: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/plan`,
        method: 'POST',
        body: data,
      }),
    }),

    // ─── Iterate on a plan preview — NOTHING hits the DB ────────────
    // body: { workspaceId, plan, prompt }
    // returns: { success, plan, summary, changes, warnings }
    editPlanPreview: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/plan/edit`,
        method: 'POST',
        body: data,
      }),
    }),

    // ─── Commit a plan — creates project + members + tasks ──────────
    // body: { workspaceId, plan }
    // returns: { success, project, taskCount, subtaskCount, memberCount, warnings }
    executeAIPlan: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/execute`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Project', 'Task', 'Workspace'],
    }),

    // ═══════════════════════════════════════════════════════════════════
    // ── PROJECT INTELLIGENCE ─────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════

    // ─── Review an existing project ─────────────────────────────────
    // body: { projectId, focus? }
    reviewProject: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/review`,
        method: 'POST',
        body: data,
      }),
    }),

    // ─── Summary snapshot of a project ──────────────────────────────
    // body: { projectId }
    summarizeProject: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/summarize`,
        method: 'POST',
        body: data,
      }),
    }),

    // ─── Explain a task or the project ──────────────────────────────
    // body: { projectId, taskId?, question?, audience? }
    explainContext: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/explain`,
        method: 'POST',
        body: data,
      }),
    }),

    // ─── Structured project documentation (for PDF export) ──────────
    // body: { projectId }
    generateProjectDocs: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/document`,
        method: 'POST',
        body: data,
      }),
    }),

    // ═══════════════════════════════════════════════════════════════════
    // ── ASK XIRCLE (legacy single-shot Q&A) ──────────────────────────
    // ═══════════════════════════════════════════════════════════════════
    //
    // Kept for backwards compat. New code should prefer `chatWithAI`.
    // Body: { question: string, history? }
    askXircle: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/ask`,
        method: 'POST',
        body: data,
      }),
    }),

    // ═══════════════════════════════════════════════════════════════════
    // ── TASK-LEVEL AI EDITING (propose → apply) ──────────────────────
    // ═══════════════════════════════════════════════════════════════════

    // ─── Preview an AI-driven edit to one task — NO writes ──────────
    // body: { taskId, prompt }
    editTaskWithAI: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/task/edit`,
        method: 'POST',
        body: data,
      }),
    }),

    // ─── Commit a task edit — saves the proposed state ──────────────
    // body: { taskId, proposed }
    applyTaskEdits: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/task/apply`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    // ═══════════════════════════════════════════════════════════════════
    // ── PROJECT-LEVEL AI EDITING (propose → apply) ───────────────────
    // ═══════════════════════════════════════════════════════════════════

    // ─── Preview an AI-driven edit to a project AND its tasks — NO writes ─
    // body: { projectId, prompt }
    editProjectWithAI: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/project/edit`,
        method: 'POST',
        body: data,
      }),
    }),

    // ─── Commit a project edit — creates / updates / deletes tasks ──
    // body: { projectId, proposed }
    applyProjectEdits: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/project/apply`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { projectId }) => [
        { type: 'Project', id: projectId },
        'Project',
        'Task',
        'Workspace',
      ],
    }),
  }),
});

export const {
  // ── Chat ──────────────────────────────────────────────────────────
  useChatWithAIMutation,
  useGetAIConversationsQuery,
  useGetAIConversationQuery,
  useCreateAIConversationMutation,
  useUpdateAIConversationMutation,
  useDeleteAIConversationMutation,

  // ── Planning ──────────────────────────────────────────────────────
  usePlanWithAIMutation,
  useEditPlanPreviewMutation,
  useExecuteAIPlanMutation,

  // ── Project intelligence ──────────────────────────────────────────
  useReviewProjectMutation,
  useSummarizeProjectMutation,
  useExplainContextMutation,
  useGenerateProjectDocsMutation,

  // ── Ask Xircle (legacy) ───────────────────────────────────────────
  useAskXircleMutation,

  // ── Task-level editing ────────────────────────────────────────────
  useEditTaskWithAIMutation,
  useApplyTaskEditsMutation,

  // ── Project-level editing ─────────────────────────────────────────
  useEditProjectWithAIMutation,
  useApplyProjectEditsMutation,
} = aiApiSlice;
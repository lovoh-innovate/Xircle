// src/slices/aiApiSlice.js
import { apiSlice } from './apiSlice';

const AI_URL = '/ai';

export const aiApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Preview a plan — NOTHING hits the DB ────────────────────────
    // body: { workspaceId, prompt }
    // returns: { success, plan: { project, tasks, warnings } }
    planWithAI: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/plan`,
        method: 'POST',
        body: data,
      }),
      // No invalidatesTags — plan creation doesn't change server data.
    }),

    // ─── Iterate on a plan preview — NOTHING hits the DB ────────────
    // body: { workspaceId, plan, prompt }
    // returns: { success, plan, summary, changes, warnings }
    //
    // Same shape as planWithAI so the client can swap the plan object
    // in place. Read-only on the server.
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

    // ─── Review an existing project ─────────────────────────────────
    // body: { projectId, focus? }
    // returns: { success, review: { healthScore, overallAssessment, strengths, issues, recommendations } }
    // Managers only (owner / admin / PM).
    reviewProject: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/review`,
        method: 'POST',
        body: data,
      }),
      // No invalidation — this is analysis, not mutation of data.
    }),

    // ─── Summary snapshot of a project ──────────────────────────────
    // body: { projectId }
    // returns: { success, summary: { headline, summary, currentState, highlights, risks, nextSteps } }
    summarizeProject: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/summarize`,
        method: 'POST',
        body: data,
      }),
    }),

    // ─── Explain a task or the project ──────────────────────────────
    // body: { projectId, taskId?, question?, audience? }
    // returns: { success, explanation: { tlDr, explanation, whyItMatters, whatYouActuallyDo, commonPitfalls } }
    explainContext: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/explain`,
        method: 'POST',
        body: data,
      }),
    }),

    // ─── Structured project documentation (for PDF export) ──────────
    // body: { projectId }
    // returns: { success, doc: { meta, sections } }
    generateProjectDocs: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/document`,
        method: 'POST',
        body: data,
      }),
    }),

    // ─── Ask Xircle — conversational lens over the user's own data ──
    // body: { question: string, history?: [{ role: 'user'|'assistant', content: string }] }
    // returns: {
    //   success,
    //   answer: string,
    //   followUps: string[],
    //   generatedAt,
    //   timezone,
    //   contextCounts: { openPersonalTasks, openProjectTasks, activeProjects, ... }
    // }
    //
    // READ-ONLY. Does not change any server data, so no invalidatesTags.
    // No providesTags either — this is a one-shot query, not cached state.
    askXircle: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/ask`,
        method: 'POST',
        body: data,
      }),
    }),

    // ═══════════════════════════════════════════════════════════════════
    // Task-level AI editing  (propose → apply)
    // ═══════════════════════════════════════════════════════════════════

    // ─── Preview an AI-driven edit to one task — NO writes ──────────
    // body: { taskId, prompt }
    // returns: {
    //   success,
    //   current:  { _id, title, description, priority, status, startDate, dueDate,
    //               estimatedHours, bufferTime, assigneeIds, assigneeNames,
    //               allowAssigneeEditSubtasks, subTasks: [...] },
    //   proposed: { ...same shape, plus hydrated `assignees` array },
    //   summary:  string,
    //   changes:  [{ field, from, to }],
    //   warnings: string[]
    // }
    //
    // The client shows `current` vs `proposed` as a diff. No server state
    // changes until the user calls applyTaskEdits.
    editTaskWithAI: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/task/edit`,
        method: 'POST',
        body: data,
      }),
    }),

    // ─── Commit a task edit — saves the proposed state ──────────────
    // body: { taskId, proposed }
    // returns: { success, task, warnings }
    //
    // Invalidates the single task tag plus the whole Task list so any
    // open task list / detail view refreshes.
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
    // Project-level AI editing  (propose → apply)
    // ═══════════════════════════════════════════════════════════════════

    // ─── Preview an AI-driven edit to a project AND its tasks — NO writes ─
    // body: { projectId, prompt }
    // returns: {
    //   success,
    //   current:  { project, tasks: [...] },
    //   proposed: { project, tasks: [...] },
    //   summary:  string,
    //   changes:  [{ field, from, to }],
    //   warnings: string[]
    // }
    //
    // The proposed tasks array can include:
    //   • existing tasks with their _id (updates)
    //   • new tasks without an _id (creates)
    //   • existing tasks with _deleted: true (soft-deletes)
    editProjectWithAI: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/project/edit`,
        method: 'POST',
        body: data,
      }),
    }),

    // ─── Commit a project edit — creates / updates / deletes tasks ──
    // body: { projectId, proposed }
    // returns: {
    //   success,
    //   project,
    //   tasks,
    //   created: number,
    //   updated: number,
    //   deleted: number,
    //   warnings: string[]
    // }
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
  usePlanWithAIMutation,
  useEditPlanPreviewMutation,              // 👈 NEW
  useExecuteAIPlanMutation,
  useReviewProjectMutation,
  useSummarizeProjectMutation,
  useExplainContextMutation,
  useGenerateProjectDocsMutation,
  useAskXircleMutation,
  useEditTaskWithAIMutation,               // 👈 NEW
  useApplyTaskEditsMutation,               // 👈 NEW
  useEditProjectWithAIMutation,            // 👈 NEW
  useApplyProjectEditsMutation,            // 👈 NEW
} = aiApiSlice;
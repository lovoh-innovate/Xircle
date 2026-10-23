// services/geminiService.js
//
// Groq-backed AI service.
// Hardened agent loop with automatic retry on 429 and an honest
// fallback summary when iterations run out mid-task.

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ─────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────
const stripCodeFences = (text) =>
  text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────
// Fetch with automatic retry on 429 (rate limit)
// ─────────────────────────────────────────────────────────────────────
async function fetchWithRetry(body, maxAttempts = 3) {
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;

    let response;
    try {
      response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(`Groq request failed: ${err.message}`);
    }

    if (response.ok) return response;

    if (response.status === 429) {
      const errBody = await response.text().catch(() => '');
      const match = errBody.match(/in\s+([\d.]+)s/);
      const waitSec = match ? Math.ceil(parseFloat(match[1])) + 1 : 18;

      if (attempt < maxAttempts) {
        console.warn(`⏳ Groq 429 — retrying in ${waitSec}s (attempt ${attempt}/${maxAttempts})`);
        await sleep(waitSec * 1000);
        continue;
      }

      throw new Error(
        'Groq rate limit reached. The assistant will retry shortly — please try again in a moment.'
      );
    }

    const errBody = await response.text().catch(() => '');
    throw new Error(
      `Groq API error (${response.status}): ${errBody.slice(0, 300) || response.statusText}`
    );
  }

  throw new Error('Groq request failed after retries.');
}

// ─────────────────────────────────────────────────────────────────────
// Single-shot caller (used by plan/review/docs/note endpoints)
// ─────────────────────────────────────────────────────────────────────
async function callGroq({ system, user, jsonMode = true, temperature = 0.5 }) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set.');

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    ...(jsonMode && { response_format: { type: 'json_object' } }),
    temperature,
    max_tokens: 4096,
  };

  const response = await fetchWithRetry(body);
  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Groq returned an empty response.');

  if (!jsonMode) return raw;

  try {
    return JSON.parse(stripCodeFences(raw));
  } catch {
    console.error('❌ Groq returned non-JSON:', raw.slice(0, 500));
    throw new Error('Groq returned an invalid plan. Try again.');
  }
}

// ─────────────────────────────────────────────────────────────────────
// AGENT LOOP
// ─────────────────────────────────────────────────────────────────────
export async function runAgent({
  system,
  history = [],
  userMessage,
  tools = [],
  toolExecutor,
  temperature = 0.4,
  maxIterations = 5,
}) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set.');
  if (!system || !userMessage) {
    throw new Error('runAgent requires both system and userMessage.');
  }

  const trimmedHistory = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-6)
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 4000),
    }));

  const messages = [
    { role: 'system', content: system },
    ...trimmedHistory,
    { role: 'user', content: userMessage },
  ];

  const executedTools = [];

  for (let i = 0; i < maxIterations; i++) {
    const body = {
      model: MODEL,
      messages,
      temperature,
      max_tokens: 2048,
    };

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const response = await fetchWithRetry(body);
    const data = await response.json();
    const choice = data?.choices?.[0];
    if (!choice) throw new Error('Groq returned no choices.');

    const message = choice.message || {};
    messages.push(message);

    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];

    // No tool call → final answer
    if (calls.length === 0) {
      return {
        content: (message.content || '').trim(),
        toolCalls: executedTools,
        messages,
      };
    }

    if (typeof toolExecutor !== 'function') {
      throw new Error('Groq asked for a tool but no toolExecutor was provided.');
    }

    for (const call of calls) {
      let args = {};
      try {
        args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }

      let result;
      try {
        result = await toolExecutor(call.function?.name, args);
      } catch (err) {
        result = { error: err.message || 'Tool execution failed.' };
      }

      executedTools.push({
        name: call.function?.name,
        args,
        result,
      });

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result ?? null).slice(0, 4000),
      });
    }
  }

  // ─── Iterations exhausted — compose an HONEST summary of what ran ──
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastAssistantText =
    lastAssistant && typeof lastAssistant.content === 'string' && lastAssistant.content.trim()
      ? lastAssistant.content.trim()
      : '';

  if (lastAssistantText) {
    return { content: lastAssistantText, toolCalls: executedTools, messages };
  }

  const successful = executedTools.filter((t) => !(t.result && t.result.error));
  const failed = executedTools.filter((t) => t.result && t.result.error);

  if (successful.length === 0) {
    return {
      content:
        "I wasn't able to finish that request. Try rephrasing or asking again.",
      toolCalls: executedTools,
      messages,
    };
  }

  const lines = successful
    .map((t) => {
      if (t.result?.message && typeof t.result.message === 'string') {
        return `• ${t.result.message}`;
      }
      if (typeof t.result?.sentCount === 'number') {
        return `• Sent ${t.result.sentCount} message${t.result.sentCount === 1 ? '' : 's'}`;
      }
      return `• Ran ${t.name}`;
    })
    .slice(0, 20);

  const failedLines = failed.map(
    (t) => `• ${t.name}: ${t.result?.error || 'failed'}`
  );

  const summary =
    `Here's what I got done:\n${lines.join('\n')}` +
    (failedLines.length ? `\n\nCouldn't complete:\n${failedLines.join('\n')}` : '') +
    `\n\nWant me to continue?`;

  return {
    content: summary,
    toolCalls: executedTools,
    messages,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 1. PLAN
// ─────────────────────────────────────────────────────────────────────
const PLAN_SYSTEM = `
You are an expert project-planning assistant for a workspace collaboration app.

The user will describe a project in plain English. You will produce a
structured JSON plan that a backend can execute.

STRICT RULES:
1. ONLY use member IDs from the provided workspace member list.
   - NEVER invent, guess, or modify an ID.
   - If nobody fits a task, return an empty assigneeIds array.
2. Prefer assigning tasks to members whose role, title, or skills
   best match the task. If two members are equally good, pick the one
   with fewer tasks in this plan.
3. Do NOT assign the same task to more than 2 people unless explicitly
   requested.
4. Every task must have a priority from: low, medium, high, urgent.
5. Every task should have 2-6 concrete subtasks when it makes sense.
   If the task is trivial, return an empty subtasks array.
6. Use relative day offsets (dueDateOffsetDays) — 0 = today, 1 = tomorrow.
   A project should typically span 3-60 days depending on scope.
7. Keep project name short (< 60 chars). Description is one sentence.
   detailedDescription can be a paragraph.
8. projectType must be one of: general, client, internal, marketing, product.
9. Team should include everyone who will actually work on tasks.
10. Return ONLY valid JSON matching this exact shape. No prose, no markdown,
    no code fences — just the raw JSON object:

{
  "project": {
    "name": "string",
    "description": "string",
    "detailedDescription": "string",
    "priority": "low" | "medium" | "high" | "urgent",
    "projectType": "general" | "client" | "internal" | "marketing" | "product",
    "tags": ["string"],
    "teamMemberIds": ["string"]
  },
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "priority": "low" | "medium" | "high" | "urgent",
      "assigneeIds": ["string"],
      "dueDateOffsetDays": number,
      "subtasks": [
        {
          "title": "string",
          "description": "string",
          "dueDateOffsetDays": number
        }
      ]
    }
  ]
}
`;

export async function planProject({ prompt, members, workspaceName }) {
  const memberContext = members.map((m) => ({
    id: String(m._id),
    name: m.name || 'Unknown',
    email: m.email || '',
    workspaceRole: m.workspaceRole || 'Member',
    title: m.title || null,
    skills: Array.isArray(m.skills) ? m.skills : [],
  }));

  const user = `
Workspace: ${workspaceName}

Available members (ONLY use these IDs):
${JSON.stringify(memberContext, null, 2)}

User request:
${prompt}
`;

  return callGroq({ system: PLAN_SYSTEM, user, temperature: 0.6 });
}

// ─────────────────────────────────────────────────────────────────────
// 2. REVIEW
// ─────────────────────────────────────────────────────────────────────
const REVIEW_SYSTEM = `
You are a senior project auditor. Analyze the project, its tasks, and its team.
Return STRICT JSON only (no prose, no code fences):

{
  "healthScore": number (0-100),
  "overallAssessment": "string (2-3 sentences)",
  "strengths": ["string"],
  "issues": [
    {
      "severity": "low" | "medium" | "high" | "critical",
      "title": "string",
      "detail": "string",
      "affectedTaskIds": ["string"]
    }
  ],
  "recommendations": [
    {
      "title": "string",
      "detail": "string",
      "impact": "low" | "medium" | "high"
    }
  ]
}

Focus on: task overload, missing assignees, unclear scope, unrealistic
deadlines, bottlenecks, unbalanced workload, missing subtasks on complex work.
`;

export async function reviewProject({ project, tasks, members, focus }) {
  const taskDigest = tasks.map((t) => ({
    id: t._id.toString(),
    title: t.title,
    status: t.status,
    priority: t.priority,
    assignees: (t.assignees || []).map((a) => a._id?.toString() || a.toString()),
    dueDate: t.dueDate,
    subtaskCount: (t.subTasks || []).length,
    progress: t.progress || 0,
  }));

  const memberDigest = members.map((m) => ({
    id: m._id.toString(),
    name: m.name,
    title: m.title || null,
    skills: m.skills || [],
    role: m.workspaceRole || 'Member',
  }));

  const user = `
Project: ${project.name}
Description: ${project.description || '(none)'}
Status: ${project.status}
Priority: ${project.priority}
Progress: ${project.progress || 0}%
Team: ${JSON.stringify(memberDigest)}

Tasks (${tasks.length}):
${JSON.stringify(taskDigest, null, 2)}

${focus ? `User focus for this review: ${focus}` : ''}
`;

  return callGroq({ system: REVIEW_SYSTEM, user });
}

// ─────────────────────────────────────────────────────────────────────
// 3. SUMMARY
// ─────────────────────────────────────────────────────────────────────
const SUMMARY_SYSTEM = `
You summarize projects for busy team members.
Return STRICT JSON only:

{
  "headline": "string (short, catchy, < 80 chars)",
  "summary": "string (1 paragraph, plain English, ~3-5 sentences)",
  "currentState": "string (1-2 sentences on where things stand)",
  "highlights": ["string (3-5 bullet points of notable progress or facts)"],
  "risks": ["string (0-4 items — blockers, overdue items, overloaded people)"],
  "nextSteps": ["string (3-5 concrete next actions, ordered)"]
}
`;

export async function summarizeProject({ project, tasks, members }) {
  const taskDigest = tasks.map((t) => ({
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    progress: t.progress || 0,
    assigneeNames: (t.assignees || []).map((a) => a.name || 'Unnamed').filter(Boolean),
    subtaskCount: (t.subTasks || []).length,
    confirmedSubtasks: (t.subTasks || []).filter((s) => s.status === 'confirmed').length,
  }));

  const user = `
Project: ${project.name}
Description: ${project.description || ''}
Detailed: ${project.detailedDescription || ''}
Status: ${project.status}
Progress: ${project.progress || 0}%
Team: ${members.map((m) => m.name).join(', ') || '(none)'}

Tasks:
${JSON.stringify(taskDigest, null, 2)}
`;

  return callGroq({ system: SUMMARY_SYSTEM, user });
}

// ─────────────────────────────────────────────────────────────────────
// 4. EXPLAIN
// ─────────────────────────────────────────────────────────────────────
const EXPLAIN_SYSTEM = `
You are a patient mentor. Explain technical or ambiguous work clearly
to someone who may not understand the project or their task. Avoid jargon.
Use analogies when helpful. Be warm and concrete.

Return STRICT JSON only:

{
  "tlDr": "string (one-sentence answer)",
  "explanation": "string (2-4 paragraphs, conversational)",
  "whyItMatters": "string (1-2 sentences)",
  "whatYouActuallyDo": ["string (3-6 concrete steps or bullets)"],
  "commonPitfalls": ["string (0-4 things to watch out for)"]
}
`;

export async function explainContext({ project, task, question, audience }) {
  const user = `
${task ? `TASK the user is asking about:
Title: ${task.title}
Description: ${task.description || ''}
Status: ${task.status}
Priority: ${task.priority}
Assignees: ${(task.assignees || []).map((a) => a.name).join(', ') || '(none)'}
Subtasks: ${(task.subTasks || []).map((s) => s.title).join(' | ') || '(none)'}
` : ''}
PROJECT CONTEXT:
Name: ${project.name}
Description: ${project.description || ''}
Detailed: ${project.detailedDescription || ''}

${audience ? `Explain it for a: ${audience}` : ''}
${question ? `User's specific question: "${question}"` : ''}
`;

  return callGroq({ system: EXPLAIN_SYSTEM, user });
}

// ─────────────────────────────────────────────────────────────────────
// 5. DOCS
// ─────────────────────────────────────────────────────────────────────
const DOCS_SYSTEM = `
You produce formal project documentation, ready to export to PDF.
Return STRICT JSON only, matching this shape exactly:

{
  "meta": {
    "title": "string",
    "subtitle": "string (short tagline)",
    "generatedFor": "string (project name)",
    "version": "string (e.g. 1.0)"
  },
  "sections": [
    {
      "heading": "string",
      "paragraphs": ["string (each a paragraph of body text)"],
      "bullets": ["string (optional, may be empty array)"],
      "table": {
        "headers": ["string"],
        "rows": [["string"]]
      }
    }
  ]
}

Sections MUST include (in this order):
1. "Overview"
2. "Objectives & Scope"
3. "Team & Responsibilities" — table: Name | Role | Responsibilities
4. "Task Breakdown" — table: Task | Priority | Status | Assignee(s) | Due
5. "Timeline & Milestones"
6. "Risks & Mitigations"
7. "Deliverables & Acceptance Criteria"
8. "Appendix: Detailed Task List"

Keep paragraphs concise. Do not invent facts.
Omit the "table" key for sections that don't need one.
`;

export async function generateProjectDocs({ project, tasks, members }) {
  const taskDigest = tasks.map((t) => ({
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    progress: t.progress || 0,
    assignees: (t.assignees || []).map((a) => a.name).filter(Boolean),
    subtasks: (t.subTasks || []).map((s) => ({ title: s.title, status: s.status })),
  }));

  const memberDigest = members.map((m) => ({
    name: m.name,
    email: m.email,
    title: m.title || '',
    skills: m.skills || [],
  }));

  const user = `
PROJECT:
${JSON.stringify({
    name: project.name,
    description: project.description,
    detailedDescription: project.detailedDescription,
    status: project.status,
    priority: project.priority,
    progress: project.progress,
    startDate: project.startDate,
    endDate: project.endDate,
    tags: project.tags || [],
  }, null, 2)}

TEAM:
${JSON.stringify(memberDigest, null, 2)}

TASKS (${tasks.length}):
${JSON.stringify(taskDigest, null, 2)}
`;

  return callGroq({ system: DOCS_SYSTEM, user });
}

// ─────────────────────────────────────────────────────────────────────
// 6. ASK XIRCLE (legacy)
// ─────────────────────────────────────────────────────────────────────
const ASK_SYSTEM = `
You are the assistant inside Xircle, a simple team delivery app.

Xircle is organized around four contexts:
  Today      → the user's personal work
  Projects   → the team's work
  Chat       → conversations
  Workspace  → the team

You answer questions about the user's own work inside Xircle.

ABSOLUTE RULES:
1. Answer ONLY from the CONTEXT JSON below. If something is not in the
   context, say so plainly.
2. Numbers must be exact.
3. Use the user's real names.
4. Be direct. No filler.
5. When listing items, one line each:
   Title — Project/Folder — due date or status
6. Today's date and timezone are in the context.
7. If the user asks something outside Xircle work, politely redirect:
   "I can only answer questions about your Xircle work."

OUTPUT FORMAT — return STRICT JSON only:

{
  "answer": "string (using \\n for line breaks)",
  "followUps": ["string (0-3 short follow-up questions)"]
}
`.trim();

export async function askXircle({ context, question, history = [] }) {
  const recentHistory = Array.isArray(history) ? history.slice(-6) : [];

  const historyBlock = recentHistory.length
    ? `\nRECENT CONVERSATION:\n${recentHistory
        .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
        .join('\n')}\n`
    : '';

  const user = `
--- CONTEXT START ---
${JSON.stringify(context)}
--- CONTEXT END ---
${historyBlock}
USER QUESTION:
${question}
`.trim();

  const result = await callGroq({
    system: ASK_SYSTEM,
    user,
    jsonMode: true,
    temperature: 0.3,
  });

  const answer =
    typeof result?.answer === 'string' && result.answer.trim()
      ? result.answer.trim()
      : "I couldn't find an answer in your Xircle data for that.";

  const followUps = Array.isArray(result?.followUps)
    ? result.followUps.filter((f) => typeof f === 'string' && f.trim()).slice(0, 3)
    : [];

  return { answer, followUps };
}

// ═════════════════════════════════════════════════════════════════════
// PERSONAL-NOTE AI
// ═════════════════════════════════════════════════════════════════════

const SCRIPTURE_SYSTEM = `
You classify highlighted text from a personal note. Decide whether it is:
  A) a Bible reference or quote
  B) a Quran reference or quote
  C) neither (ordinary text).

STRICT RULES:
- If scripture, extract a PARSED reference. Never quote the verse text back.
- If not confident, return type "general".
- Return ONLY valid JSON.

Shape:
{
  "type": "bible" | "quran" | "general",
  "confidence": 0.0-1.0,
  "bible": { "book": "string", "chapter": number, "verseStart": number|null, "verseEnd": number|null, "rawReference": "string" },
  "quran": { "surah": number, "ayahStart": number|null, "ayahEnd": number|null, "rawReference": "string" }
}
`;

export async function detectScripture({ text }) {
  const user = `Highlighted text:\n"""\n${text}\n"""`;
  return callGroq({ system: SCRIPTURE_SYSTEM, user, temperature: 0.1 });
}

const SEARCH_SYSTEM = `
You are a concise, accurate explainer.

Return STRICT JSON only:
{
  "summary": "string (2-4 sentences, plain English)",
  "definitions": [{ "term": "string", "meaning": "string" }],
  "relatedTopics": ["string"],
  "suggestedSearches": [{ "label": "string", "query": "string" }]
}
`;

export async function searchTopic({ text, context }) {
  const user = `
Highlighted word/phrase:
"""${text}"""

${context ? `Surrounding note context:\n"""${context}"""` : ''}
`;
  return callGroq({ system: SEARCH_SYSTEM, user, temperature: 0.4 });
}

const PROOFREAD_SYSTEM = `
You are an editor for personal notes. Return corrected HTML in the
Tiptap dialect. Fix mechanical issues AND format for readability.
Never change the author's words. Only fix spelling, punctuation, grammar,
capitalization, and structure (paragraphs, lists, headings, emphasis).

Return STRICT JSON only:
{
  "correctedContent": "string (full corrected note, Tiptap HTML)",
  "summary": "string (1-2 sentences)",
  "changes": [
    { "type": "spelling|punctuation|grammar|capitalization|structure|list|heading|emphasis|alignment",
      "original": "string", "corrected": "string", "reason": "string" }
  ]
}
`.trim();

export async function proofreadNote({ title, content }) {
  const user = `
${title ? `Note title: ${title}\n` : ''}Note content (Tiptap HTML):
"""
${content}
"""
`;
  return callGroq({ system: PROOFREAD_SYSTEM, user, temperature: 0.2 });
}

const COMPLETE_SYSTEM = `
You help someone develop a personal note into a richer version of itself.

STYLES:
- explanatory : define terms, add background, give a concrete example
- concise     : sharpen and clarify, tighter phrasing only
- devotional   : reflective, warm, scripture-aware
- academic    : precise, structured, cite-style reasoning
- journal     : first-person reflective

HARD RULES:
- NEVER delete or contradict what the author wrote.
- NEVER invent facts, quotes, dates, statistics, or scripture text.
- Return the FULL note — original plus additions.
- Structure additions with clear headings.

Return STRICT JSON only:
{
  "completedContent": "string (the full expanded note)",
  "rationale": "string (1-2 sentences)",
  "addedSections": [
    { "type": "explanation|example|context|elaboration|reflection|application",
      "heading": "string", "content": "string" }
  ]
}
`;

export async function completeNote({ title, content, style = 'explanatory' }) {
  const user = `
STYLE: ${style}

${title ? `Note title: ${title}\n` : ''}Note content:
"""
${content}
"""
`;
  return callGroq({ system: COMPLETE_SYSTEM, user, temperature: 0.6 });
}

// ═════════════════════════════════════════════════════════════════════
// LIVE CALL AI
// ═════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────
// 7. GENERATE CALL NOTES  (rolling + final)
// ─────────────────────────────────────────────────────────────────────
const CALL_NOTES_SYSTEM = `
You are a professional AI meeting scribe.

Given a transcript, produce STRUCTURED notes.

RULES:
1. Only use facts present in the transcript. NEVER invent.
2. Attribute statements to real speakers when possible — use their names.
3. Do not include filler, small talk, or repeated lines.
4. If mode is "rolling", prioritize what is NEW or CHANGED in the recent
   transcript window. Keep it compact so the UI can update live.
5. If mode is "final", produce a polished, complete summary of the call.
6. "summary": 2-4 short paragraphs, plain English, no fluff. Separate with
   \\n\\n. Never use markdown headings.
7. "keyPoints": 3-10 bullets, one line each.
8. "actionItems": only clear commitments (someone explicitly said they
   would do something). If nobody committed, return [].
9. "decisions": only explicit decisions the group agreed on.
10. "topics": 3-8 short keywords.
11. "title": short (< 70 chars), descriptive of what was discussed.
    Not "Team meeting" — something like "Cassia launch blockers & QA".

Return STRICT JSON only:

{
  "title": "string",
  "summary": "string",
  "keyPoints": ["string"],
  "actionItems": [
    { "text": "string", "assignee": "string|null", "due": "string|null" }
  ],
  "decisions": ["string"],
  "topics": ["string"]
}
`.trim();

/**
 * Generate notes from a call transcript.
 *
 * @param {Object}   opts
 * @param {Array}    opts.transcript      Array of { speakerName, text, at? }
 * @param {string}   opts.callType        'voice' | 'video'
 * @param {Array}    opts.participants    Array of { user: { name } } or { name }
 * @param {'rolling'|'final'} [opts.mode]
 * @returns {Promise<{
 *   title: string,
 *   summary: string,
 *   keyPoints: string[],
 *   actionItems: { text: string, assignee: string|null, due: string|null }[],
 *   decisions: string[],
 *   topics: string[]
 * }>}
 */
export async function generateCallNotes({
  transcript,
  callType,
  participants,
  mode = 'final',
}) {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return {
      title: '',
      summary: '',
      keyPoints: [],
      actionItems: [],
      decisions: [],
      topics: [],
    };
  }

  // ── Shape transcript to a compact text block ──
  // Rolling = last 100 turns (fresh context only)
  // Final   = last 600 turns, capped at 40k chars
  const window =
    mode === 'rolling' ? transcript.slice(-100) : transcript.slice(-600);

  const lines = window
    .map((s) => {
      const who = String(s.speakerName || s.speaker || 'Speaker').slice(0, 60);
      const what = String(s.text || '').trim();
      return what ? `${who}: ${what}` : '';
    })
    .filter(Boolean)
    .join('\n')
    .slice(0, 40000);

  const names = (participants || [])
    .map((p) => p?.user?.name || p?.name)
    .filter(Boolean)
    .slice(0, 30)
    .join(', ');

  const user = `
CALL TYPE: ${callType}
MODE: ${mode}
PARTICIPANTS: ${names || '(unknown)'}

TRANSCRIPT:
${lines}
`.trim();

  const result = await callGroq({
    system: CALL_NOTES_SYSTEM,
    user,
    temperature: mode === 'rolling' ? 0.4 : 0.3,
  });

  // ── Sanitize output ──
  return {
    title: String(result?.title || '').slice(0, 200).trim(),
    summary: String(result?.summary || '').slice(0, 6000).trim(),
    keyPoints: Array.isArray(result?.keyPoints)
      ? result.keyPoints
          .filter((x) => typeof x === 'string' && x.trim())
          .slice(0, 12)
          .map((x) => x.trim())
      : [],
    actionItems: Array.isArray(result?.actionItems)
      ? result.actionItems
          .filter((a) => a && typeof a === 'object')
          .map((a) => ({
            text: String(a.text || '').slice(0, 500).trim(),
            assignee: a.assignee ? String(a.assignee).slice(0, 100).trim() : null,
            due: a.due ? String(a.due).slice(0, 100).trim() : null,
          }))
          .filter((a) => a.text)
          .slice(0, 20)
      : [],
    decisions: Array.isArray(result?.decisions)
      ? result.decisions
          .filter((x) => typeof x === 'string' && x.trim())
          .slice(0, 10)
          .map((x) => x.trim())
      : [],
    topics: Array.isArray(result?.topics)
      ? result.topics
          .filter((x) => typeof x === 'string' && x.trim())
          .slice(0, 8)
          .map((x) => x.trim())
      : [],
  };
}

// ─────────────────────────────────────────────────────────────────────
// 8. ANSWER CALL QUESTION  (voice or text, mid-call)
// ─────────────────────────────────────────────────────────────────────
const CALL_Q_SYSTEM = `
You are Xircle AI, embedded in a LIVE call. The user just asked a question
by voice or text. Your answer will likely be spoken aloud, so:

RULES:
1. Keep it SHORT — 1-3 short sentences (max ~60 words).
2. No markdown, no bullets, no emoji. Plain spoken English.
3. Only answer from the transcript context and call metadata.
   If the answer is not in the transcript, say so plainly.
4. Use first names of speakers when referring to what was said.
5. If the user asks a general knowledge question unrelated to the call,
   you may answer briefly — but stay concise.
6. Do not repeat the user's question back to them.

Return STRICT JSON only:
{ "answer": "string", "sources": ["string"] }

"sources" = 0-3 short identifiers of where the answer came from,
e.g. "Amaka, 4 min ago" or "Live summary" or "Transcript (recent)".
`.trim();

/**
 * Answer a live mid-call question using recent transcript + metadata.
 *
 * @param {Object} opts
 * @param {string} opts.question
 * @param {Array}  opts.transcript   Recent transcript entries
 * @param {Object} [opts.callMeta]   { type, isMeeting, participants, durationSec, liveSummary }
 * @returns {Promise<{ answer: string, sources: string[] }>}
 */
export async function answerCallQuestion({ question, transcript, callMeta }) {
  const q = String(question || '').trim().slice(0, 1000);
  if (!q) {
    return { answer: 'I need a question to answer.', sources: [] };
  }

  // Last 200 turns, capped at 24k chars
  const recentTranscript = (transcript || [])
    .slice(-200)
    .map((s) => {
      const who = String(s.speakerName || s.speaker || 'Speaker').slice(0, 60);
      const what = String(s.text || '').trim();
      return what ? `${who}: ${what}` : '';
    })
    .filter(Boolean)
    .join('\n')
    .slice(0, 24000);

  const metaBlock = JSON.stringify({
    callType: callMeta?.type || 'voice',
    isMeeting: !!callMeta?.isMeeting,
    participants: (callMeta?.participants || []).slice(0, 30),
    durationSec: callMeta?.durationSec || 0,
    liveSummaryText: callMeta?.liveSummary?.text || null,
    liveSummaryKeyPoints: callMeta?.liveSummary?.keyPoints || [],
  });

  const user = `
CALL META:
${metaBlock}

RECENT TRANSCRIPT:
${recentTranscript || '(empty)'}

USER QUESTION:
${q}
`.trim();

  const result = await callGroq({
    system: CALL_Q_SYSTEM,
    user,
    temperature: 0.3,
  });

  const answer =
    typeof result?.answer === 'string' && result.answer.trim()
      ? result.answer.trim().slice(0, 2000)
      : "I couldn't find that in the transcript. Could you rephrase?";

  const sources = Array.isArray(result?.sources)
    ? result.sources
        .filter((s) => typeof s === 'string' && s.trim())
        .slice(0, 5)
        .map((s) => s.trim())
    : [];

  return { answer, sources };
}

export { callGroq };
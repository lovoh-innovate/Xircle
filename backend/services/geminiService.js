// services/geminiService.js
//
// Groq-backed AI service (free tier — console.groq.com/keys).
// Uses Node's built-in fetch, so no new npm package is needed.
// Every export returns the shape the calling controller expects.

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ─────────────────────────────────────────────────────────────────────
// Shared helper — one place for the fetch, error handling, JSON parse.
// ─────────────────────────────────────────────────────────────────────
const stripCodeFences = (text) =>
  text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');

async function callGroq({ system, user, jsonMode = true, temperature = 0.5 }) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set.');

  let response;
  try {
    response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        ...(jsonMode && { response_format: { type: 'json_object' } }),
        temperature,
        max_tokens: 8192,
      }),
    });
  } catch (err) {
    throw new Error(`Groq request failed: ${err.message}`);
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(
      `Groq API error (${response.status}): ${errBody.slice(0, 500) || response.statusText}`
    );
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Groq returned an empty response.');

  if (!jsonMode) return raw;

  try {
    return JSON.parse(stripCodeFences(raw));
  } catch (err) {
    console.error('❌ Groq returned non-JSON:', raw.slice(0, 500));
    throw new Error('Groq returned an invalid plan. Try again.');
  }
}

// ─────────────────────────────────────────────────────────────────────
// 1. PLAN — turn a plain-English prompt into a structured project plan
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
// 2. REVIEW — audit an existing project and suggest improvements
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
deadlines, bottlenecks, unbalanced workload across members, missing subtasks
on complex work.
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
// 3. SUMMARY — human-friendly snapshot of a project
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
// 4. EXPLAIN — explain a task or project to someone who doesn't get it
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
// 5. DOCUMENTATION — structured project doc for PDF export
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
1. "Overview" — what the project is and why it exists
2. "Objectives & Scope" — goals and out-of-scope items
3. "Team & Responsibilities" — table: Name | Role | Responsibilities
4. "Task Breakdown" — table: Task | Priority | Status | Assignee(s) | Due
5. "Timeline & Milestones" — phase-based summary
6. "Risks & Mitigations" — bullets
7. "Deliverables & Acceptance Criteria" — bullets
8. "Appendix: Detailed Task List" — table with subtasks

Keep paragraphs concise. Do not invent facts not present in the data.
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
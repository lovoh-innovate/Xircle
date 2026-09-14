// services/geminiService.js
//
// Swapped from Gemini to Groq (free, no billing required — see
// console.groq.com/keys). Uses Node's built-in fetch, so no new
// npm package is needed. Same export (planProject) and same return
// shape as before, so aiController.js needs zero changes.

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'; // free-tier, supports structured JSON output
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ─────────────────────────────────────────────────────────────────────
// System instruction — tells the model exactly what to output. Since
// we're relying on JSON *mode* (valid JSON) rather than a hard schema
// like Gemini's responseSchema, the shape is spelled out explicitly
// here. aiController.js's sanitizePlan() still clamps/validates
// everything afterward, same as before.
// ─────────────────────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `
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

// Strip ```json fences if the model adds them despite instructions.
const stripCodeFences = (text) =>
  text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');

// ─────────────────────────────────────────────────────────────────────
// planProject({ prompt, members, workspaceName }) → plan object
// ─────────────────────────────────────────────────────────────────────
export async function planProject({ prompt, members, workspaceName }) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set.');
  }

  // Give the model ONLY what it needs — id, name, and role hints.
  const memberContext = members.map((m) => ({
    id: String(m._id),
    name: m.name || 'Unknown',
    email: m.email || '',
    workspaceRole: m.workspaceRole || 'Member',
    title: m.title || null,
    skills: Array.isArray(m.skills) ? m.skills : [],
  }));

  const userMessage = `
Workspace: ${workspaceName}

Available members (ONLY use these IDs):
${JSON.stringify(memberContext, null, 2)}

User request:
${prompt}
`;

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
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.6,
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

  try {
    return JSON.parse(stripCodeFences(raw));
  } catch (err) {
    console.error('❌ Groq returned non-JSON:', raw.slice(0, 500));
    throw new Error('Groq returned an invalid plan. Try again.');
  }
}
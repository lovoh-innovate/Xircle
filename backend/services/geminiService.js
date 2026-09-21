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

// ─────────────────────────────────────────────────────────────────────
// 6. ASK XIRCLE — conversational Q&A over the user's own Xircle data
// ─────────────────────────────────────────────────────────────────────
//
// This is the "lens" function. It reads the whole user context built by
// xircleContextService.buildUserContext() and answers natural-language
// questions about the user's work.
//
// It does NOT write anything. It does NOT invent numbers. It answers
// only from the CONTEXT block.
//
// Returns: { answer: string, followUps: string[] }
// ─────────────────────────────────────────────────────────────────────

const ASK_SYSTEM = `
You are the assistant inside Xircle, a simple team delivery app.

Xircle is organized around four contexts:
  Today      → the user's personal work
  Projects   → the team's work
  Chat       → conversations
  Workspace  → the team

You answer questions about the user's own work inside Xircle: what they've
done, what's open, what's overdue, what's waiting on them, what's happening
in their projects, their chats, their notes, and their stats.

ABSOLUTE RULES:

1. Answer ONLY from the CONTEXT JSON below. If something is not in the
   context, say so plainly: "I don't have that in your Xircle data."
   Never guess. Never invent tasks, people, projects, numbers, or dates.

2. Numbers must be exact. If you say "3 overdue," there must be exactly
   3 overdue items in the context. Count them.

3. Use the user's real names — real task titles, real project names, real
   people, real folder names, real chat names. Never generic placeholders.

4. Be direct. No filler. Short answers unless the user asks for detail.
   If they ask "what's overdue?", list them — don't write an essay.

5. When listing items, one line each, formatted as:
   Title — Project/Folder — due date or status

6. Today's date and timezone are in the context. Use them when reasoning
   about "today", "this week", "overdue", "coming up", "recently".

7. If the user asks something outside Xircle work (general coding help,
   life advice, world facts), politely redirect:
   "I can only answer questions about your Xircle work."

8. Never suggest new Xircle features. You are a lens on the user's work,
   not a product manager.

9. If you see a pattern the user should know about (overload, repeated
   rejections, stalled projects, unanswered mentions), you may briefly
   point it out — but only when the user asked about that area.

OUTPUT FORMAT — return STRICT JSON only, no prose, no code fences:

{
  "answer": "string (your answer, using \\n for line breaks)",
  "followUps": ["string (0-3 short follow-up questions the user might ask next)"]
}

The followUps should be short, natural, and directly useful — things like
"Which project is furthest behind?" or "What's due tomorrow?". Never more
than 3. Return an empty array if nothing useful comes to mind.
`.trim();

export async function askXircle({ context, question, history = [] }) {
  // Keep the last few turns so follow-ups feel natural, but don't let the
  // history balloon the prompt. The full context is the source of truth.
  const recentHistory = Array.isArray(history) ? history.slice(-6) : [];

  const historyBlock = recentHistory.length
    ? `\nRECENT CONVERSATION (for context on follow-ups — the CONTEXT below is still the only source of truth):\n${recentHistory
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
    jsonMode: true,      // we want { answer, followUps }
    temperature: 0.3,    // low — this is a factual/grounded task
  });

  // Defensive shape check — never trust the model's output blindly.
  const answer =
    typeof result?.answer === 'string' && result.answer.trim()
      ? result.answer.trim()
      : "I couldn't find an answer in your Xircle data for that.";

  const followUps = Array.isArray(result?.followUps)
    ? result.followUps
        .filter((f) => typeof f === 'string' && f.trim())
        .slice(0, 3)
    : [];

  return { answer, followUps };
}

// ═════════════════════════════════════════════════════════════════════
// PERSONAL-NOTE AI
// ═════════════════════════════════════════════════════════════════════
//
// The four functions below back controllers/noteAiController.js.
//
// They all follow the same contract as the six above:
//   • take a plain object of already-validated inputs
//   • return a plain object with the exact shape the controller expects
//   • never write to the database
//
// Two of them (detectScripture, searchTopic) are used to drive external
// API calls in the controller — they classify and parse, they do NOT
// fabricate scripture text or fetch web content themselves.
//
// Two of them (proofreadNote, completeNote) return SUGGESTED content.
// The controller passes those suggestions back to the client, which
// then decides whether to persist them via the normal updateNote path.
// ═════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────
// 7. DETECT SCRIPTURE — classify a highlighted string
// ─────────────────────────────────────────────────────────────────────
//
// Returns one of:
//   { type: 'bible',   bible:  { book, chapter, verseStart, verseEnd, rawReference }, confidence }
//   { type: 'quran',   quran:  { surah, ayahStart, ayahEnd, rawReference },          confidence }
//   { type: 'general', confidence }
//
// The model only CLASSIFIES and PARSES. It never fabricates verse text —
// the controller pulls the actual scripture from bible-api.com / alquran.cloud.
// ─────────────────────────────────────────────────────────────────────

const SCRIPTURE_SYSTEM = `
You classify highlighted text from a personal note. Decide whether it is:

  A) a Bible reference or quote — e.g. "John 3:16", "For God so loved the world...",
     "Genesis 1:1-5", "Psalm 23", "the Lord is my shepherd".
  B) a Quran reference or quote — e.g. "2:255", "Surah Al-Baqarah 255",
     "Ayat al-Kursi", "Allah — there is no deity except Him".
  C) neither (ordinary text).

STRICT RULES:
- If it is scripture, extract a PARSED reference. Never quote the verse text back.
- For Bible, always give: book (canonical English name), chapter, verseStart,
  verseEnd (same as verseStart if single verse), and rawReference.
- For Quran, give: surah (number), ayahStart, ayahEnd, rawReference.
- If you are not confident, return type "general". Do not guess.
- Return ONLY valid JSON. No prose, no code fences.

Shape:

{
  "type": "bible" | "quran" | "general",
  "confidence": 0.0-1.0,
  "bible": { "book": "string", "chapter": number, "verseStart": number|null, "verseEnd": number|null, "rawReference": "string" },
  "quran": { "surah": number, "ayahStart": number|null, "ayahEnd": number|null, "rawReference": "string" }
}

Only include the "bible" key when type is "bible", only "quran" when type is "quran".
`;

export async function detectScripture({ text }) {
  const user = `Highlighted text:\n"""\n${text}\n"""`;
  return callGroq({ system: SCRIPTURE_SYSTEM, user, temperature: 0.1 });
}

// ─────────────────────────────────────────────────────────────────────
// 8. SEARCH TOPIC — plain-English context for a highlighted word/phrase
// ─────────────────────────────────────────────────────────────────────
const SEARCH_SYSTEM = `
You are a concise, accurate explainer. The user has highlighted a word or
phrase inside a personal note and wants to know more about it.

Return STRICT JSON only, matching this shape exactly:

{
  "summary": "string (2-4 sentences, plain English, no filler)",
  "definitions": [
    { "term": "string", "meaning": "string (1 sentence)" }
  ],
  "relatedTopics": ["string (3-6 short phrases the user might want next)"],
  "suggestedSearches": [
    { "label": "string (short, clickable, < 40 chars)", "query": "string (the actual search query)" }
  ]
}

Rules:
- Ground the summary in what the word/phrase actually means. Do not invent facts.
- If it is a technical term, define it plainly.
- If it is a person or place, give one line of who/what and one line of significance.
- If it is ambiguous, pick the most likely meaning given the surrounding note
  context (provided separately) and mention the alternative briefly.
- suggestedSearches must be 3-5 items. They should be things a curious reader
  would actually click — not generic ("what is X", "history of X", "examples of X").
`;

export async function searchTopic({ text, context }) {
  const user = `
Highlighted word/phrase:
"""${text}"""

${context ? `Surrounding note context:\n"""${context}"""` : ''}
`;
  return callGroq({ system: SEARCH_SYSTEM, user, temperature: 0.4 });
}

// ─────────────────────────────────────────────────────────────────────
// 9. PROOFREAD NOTE — spelling, punctuation, grammar, AND formatting
// ─────────────────────────────────────────────────────────────────────
//
// Two responsibilities, in order:
//   1. Mechanical fixes — spelling, punctuation, grammar, capitalization
//   2. Structural formatting — paragraph breaks, bullet/numbered lists,
//      headings, bold emphasis, centered titles, emphasis marks
//
// The author's WORDS are sacred. Their LAYOUT is fair game.
//
// The note comes in as Tiptap HTML. The corrected note must come back
// as the same subset of HTML so setContent can parse it: <p>, <h1-3>,
// <ul>, <ol>, <li>, <strong>, <em>, <u>, <s>, <a>, and
// <p style="text-align: center">. No other tags. No classes. No CSS
// beyond text-align.
// ─────────────────────────────────────────────────────────────────────

const PROOFREAD_SYSTEM = `
You are an editor for personal notes. The note arrives as HTML (Tiptap
output) and you return a corrected version in the SAME HTML dialect.

You have TWO jobs, and BOTH are required:

  A) MECHANICAL FIXES — spelling, punctuation, grammar, capitalization.
  B) FORMATTING — structure the note so it reads cleanly and looks
     intentional. This is not optional. If a note is a wall of text,
     an unformatted list, or has no visual hierarchy, fix that too.

═══════════════════════════════════════════════════════════════════
WHAT TO FIX (A) — mechanical
═══════════════════════════════════════════════════════════════════
- Misspelled words
- Missing or wrong punctuation (missing periods, stray commas,
  apostrophes in contractions and possessives)
- Grammar slips: subject-verb agreement, its/it's, your/you're,
  their/there/they're, then/than, to/too/two
- Capitalization at sentence starts and for proper nouns
- Double spaces, stray whitespace, non-breaking space junk
- Run-on sentences ONLY when a simple comma or period fixes them

═══════════════════════════════════════════════════════════════════
WHAT TO FIX (B) — formatting
═══════════════════════════════════════════════════════════════════

PARAGRAPHS
- A single paragraph over ~5 sentences becomes 2-3 shorter paragraphs
- Every distinct idea gets its own <p>
- Don't merge paragraphs the author intentionally separated

LISTS  ← do this aggressively when the content is clearly a list
- Three or more items that are parallel in structure → <ul>
- Items that are sequential steps or ranked → <ol>
- Items separated by commas, dashes, or line breaks that read as a list
  → convert to a real list
- Existing <ul>/<ol> that are correct: leave alone
- One item alone: leave as prose
- Keep the items' words intact. Do not reword to fit a list pattern.

HEADINGS
- A short standalone line (< ~8 words) with no ending punctuation,
  sitting above a block of related text, is a heading
- Promote it to <h2> or <h3> based on depth (top-level → <h2>,
  sub-section → <h3>)
- Never invent headings. Only promote text that already exists.

EMPHASIS (bold / italic / underline)
- Bold key terms on first mention, section labels, and short phrases
  the author clearly meant as labels ("Goal:", "Deadline:", a date,
  a person's name in a bio, a project name)
- Italicize foreign words, titles of works, and quoted inner thoughts
- Underline only when the author already did, or for a headline label
- Do NOT bold whole sentences. Do NOT bold ordinary prose.
  Bold is for labels and single key terms, not decoration.
- Never bold more than ~15% of the words in the note.

ALIGNMENT
- The note's main title (if the first line reads as a title — short,
  no period, stands alone) gets style="text-align: center"
- A standalone opening quote or dedication gets center alignment
- Never center body paragraphs. Left-align body text always.

TITLES vs HEADINGS
- If the first line is clearly the note's title, wrap in <h1> and
  center it
- If there is no title line, do NOT invent one. Leave the first <p>
  as-is.

═══════════════════════════════════════════════════════════════════
HARD RULES — what you must never do
═══════════════════════════════════════════════════════════════════
1. NEVER change the author's words except for the mechanical fixes
   listed in section A. Reordering, substituting synonyms, rewriting
   sentences for style — all forbidden.
2. NEVER add content. No new sentences, no new facts, no summaries,
   no conclusions. If the author didn't write it, it doesn't appear.
3. NEVER delete content. Every word the author wrote survives into
   the corrected version.
4. NEVER change scripture references, code snippets, URLs, email
   addresses, or literal quoted material.
5. NEVER use any HTML tag outside this set:
     <p>, <h1>, <h2>, <h3>, <ul>, <ol>, <li>,
     <strong>, <em>, <u>, <s>, <a href="...">, <br>
   NEVER use: <div>, <span>, <table>, <blockquote>, <code>, classes,
   ids, inline CSS except text-align, or any attribute other than
   href on <a> and style on <p>/<h1>/<h2>/<h3> (only for text-align).
6. NEVER wrap the entire output in a container. Return sibling
   block elements, exactly like Tiptap emits.
7. If a fix would be debatable, skip it. Silent correctness beats
   loud wrongness.

═══════════════════════════════════════════════════════════════════
OUTPUT
═══════════════════════════════════════════════════════════════════
Return STRICT JSON only, matching this shape exactly:

{
  "correctedContent": "string (full corrected note, Tiptap-compatible HTML)",
  "summary": "string (1-2 sentences describing what was fixed overall)",
  "changes": [
    {
      "type": "spelling" | "punctuation" | "grammar" | "capitalization"
            | "structure" | "list" | "heading" | "emphasis" | "alignment",
      "original": "string (see rules below)",
      "corrected": "string (see rules below)",
      "reason": "string (short, e.g. 'its → it\\'s (contraction)')"
    }
  ]
}

RULES FOR original / corrected FIELDS:
- For spelling/punctuation/grammar/capitalization: put the exact text
  fragment (plain text, no HTML tags) before and after the fix.
- For structure/list/heading/emphasis/alignment: DO NOT paste HTML
  fragments here. Instead describe the change in plain English:
    original: "wall of text (14 sentences, one <p>)"
    corrected: "split into 4 paragraphs"
    reason: "Long unbroken block split for readability"
  or:
    original: "grocery list as a single comma-run"
    corrected: "converted to a 6-item bullet list"
    reason: "Parallel items grouped as a list"
  The user reads these inline. HTML tags would clutter the display.

Order the changes array in the order they appear in the note.
If nothing needs fixing at all, return the original content and an
empty changes array. Do not fabricate changes to look busy.
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

// ─────────────────────────────────────────────────────────────────────
// 10. COMPLETE NOTE — add explanation, depth, and context
// ─────────────────────────────────────────────────────────────────────
const COMPLETE_SYSTEM = `
You help someone develop a personal note into a richer version of itself.

You will receive a note and a STYLE. You will return an EXPANDED version
that keeps the author's original text intact (or lightly tightened) and
adds useful new material around it.

STYLES:
- explanatory : define terms, add background, give a concrete example
- concise     : sharpen and clarify, no new topics, tighter phrasing only
- devotional   : reflective, warm, scripture-aware (Bible/Quran friendly)
- academic    : precise, structured, cite-style reasoning, no fluff
- journal     : first-person reflective, meandering is fine, feels human

HARD RULES:
- NEVER delete or contradict what the author wrote.
- NEVER invent facts, quotes, dates, statistics, or scripture text.
- If you reference scripture, reference the reference ("see John 3:16"),
  do not quote it.
- Keep the author's voice. If they wrote casually, stay casual.
- Return the FULL note — original plus additions — not a diff.
- Structure additions with clear headings or as natural continuations.

Return STRICT JSON only:

{
  "completedContent": "string (the full expanded note)",
  "rationale": "string (1-2 sentences explaining what you added and why)",
  "addedSections": [
    {
      "type": "explanation" | "example" | "context" | "elaboration" | "reflection" | "application",
      "heading": "string (empty if the addition is inline)",
      "content": "string (the actual added text)"
    }
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
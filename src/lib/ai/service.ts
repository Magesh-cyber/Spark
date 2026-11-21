"use server";

export interface AIChatSummaryResult {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  questions: string[];
  providerUsed: "gemini" | "openai" | "groq" | "heuristic";
}

export interface AISmartRepliesResult {
  replies: string[];
  providerUsed: "gemini" | "openai" | "groq" | "heuristic";
}

export interface AICopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/**
 * Resolves the active AI provider credentials from environment variables.
 * Priority: GEMINI_API_KEY -> OPENAI_API_KEY -> GROQ_API_KEY.
 */
function getActiveAIConfig(): {
  provider: "gemini" | "openai" | "groq" | "none";
  apiKey: string | null;
} {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey && geminiKey !== "your-gemini-api-key") {
    return { provider: "gemini", apiKey: geminiKey };
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey && openaiKey !== "sk-your-openai-api-key" && openaiKey.startsWith("sk-")) {
    return { provider: "openai", apiKey: openaiKey };
  }

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey && groqKey.startsWith("gsk_")) {
    return { provider: "groq", apiKey: groqKey };
  }

  return { provider: "none", apiKey: null };
}

/**
 * Unified LLM completion caller across Google Gemini, OpenAI, and Groq.
 */
async function callLLM(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const { provider, apiKey } = getActiveAIConfig();
  if (!apiKey || provider === "none") return null;

  try {
    if (provider === "gemini") {
      // Google Gemini REST API with multi-model auto-negotiation
      const geminiModels = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];

      for (const model of geminiModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemPrompt }],
              },
              contents: [
                {
                  role: "user",
                  parts: [{ text: userPrompt }],
                },
              ],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1024,
              },
            }),
            cache: "no-store",
          });

          if (res.ok) {
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text && text.trim().length > 0) {
              return text.trim();
            }
          } else {
            console.warn(`[SPARK AI] Gemini model ${model} returned status ${res.status}`);
          }
        } catch (mErr) {
          console.warn(`[SPARK AI] Error calling Gemini model ${model}:`, mErr);
        }
      }

      return null;
    }

    if (provider === "openai" || provider === "groq") {
      const baseUrl =
        provider === "groq"
          ? "https://api.groq.com/openai/v1/chat/completions"
          : "https://api.openai.com/v1/chat/completions";

      const model = provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini";

      const res = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 1024,
        }),
        cache: "no-store",
      });

      if (!res.ok) {
        console.warn(`[SPARK AI] ${provider} API returned status ${res.status}`);
        return null;
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      return content ? content.trim() : null;
    }
  } catch (err) {
    console.error("[SPARK AI Call Error]:", err);
  }

  return null;
}

/**
 * Built-in Smart Heuristic Summarizer (Runs when no external API key is configured).
 * Extracts key topics, sender actions, deadlines, and questions deterministically.
 */
function heuristicChatSummary(
  messages: Array<{ senderName: string; text: string; time?: string }>,
  conversationName: string
): AIChatSummaryResult {
  const cleanMsgs = messages.filter((m) => m.text && m.text.trim().length > 0);
  if (cleanMsgs.length === 0) {
    return {
      summary: `No unread messages to summarize in ${conversationName}.`,
      keyPoints: ["The conversation is up to date."],
      actionItems: [],
      questions: [],
      providerUsed: "heuristic",
    };
  }

  const senders = Array.from(new Set(cleanMsgs.map((m) => m.senderName)));
  const actionItems: string[] = [];
  const questions: string[] = [];
  const keyPoints: string[] = [];

  for (const msg of cleanMsgs) {
    const text = msg.text.trim();
    const lower = text.toLowerCase();

    // Detect action items or commitments
    if (
      lower.includes("will ") ||
      lower.includes("need to") ||
      lower.includes("please ") ||
      lower.includes("can you") ||
      lower.includes("assigned") ||
      lower.includes("todo") ||
      lower.includes("deadline") ||
      lower.includes("by tomorrow") ||
      lower.includes("by 5pm") ||
      lower.includes("fix")
    ) {
      actionItems.push(`${msg.senderName}: "${text}"`);
    }

    // Detect questions
    if (text.includes("?") || lower.startsWith("how") || lower.startsWith("when") || lower.startsWith("what")) {
      questions.push(`${msg.senderName}: "${text}"`);
    }

    // Key points from substantive messages (> 25 chars)
    if (text.length > 20 && !text.includes("?")) {
      keyPoints.push(`${msg.senderName}: ${text}`);
    }
  }

  const summary =
    cleanMsgs.length === 1
      ? `${cleanMsgs[0].senderName} sent an update regarding "${cleanMsgs[0].text.slice(0, 80)}${cleanMsgs[0].text.length > 80 ? "..." : ""}".`
      : `${senders.join(", ")} exchanged ${cleanMsgs.length} messages in ${conversationName} covering updates and team coordination.`;

  return {
    summary,
    keyPoints: keyPoints.slice(0, 4).length > 0 ? keyPoints.slice(0, 4) : [cleanMsgs[cleanMsgs.length - 1].text],
    actionItems: actionItems.slice(0, 3),
    questions: questions.slice(0, 3),
    providerUsed: "heuristic",
  };
}

/**
 * 1. Generates Instagram-style Unread Messages Catch-Up Summary
 */
export async function summarizeConversationMessages(params: {
  messages: Array<{ senderName: string; text: string; time?: string; isMe?: boolean }>;
  currentUserName: string;
  conversationName: string;
  conversationType: "channel" | "direct";
}): Promise<AIChatSummaryResult> {
  const { messages, currentUserName, conversationName, conversationType } = params;
  const cleanMsgs = messages.filter((m) => m.text && m.text.trim().length > 0);

  if (cleanMsgs.length === 0) {
    return {
      summary: `All messages are caught up in ${conversationName}.`,
      keyPoints: ["No new updates."],
      actionItems: [],
      questions: [],
      providerUsed: "heuristic",
    };
  }

  const systemPrompt = `You are SPARK AI, an executive workplace assistant. Summarize recent unread chat messages for ${currentUserName} in ${
    conversationType === "channel" ? `#${conversationName}` : `conversation with ${conversationName}`
  }.
Return strict JSON with the following schema:
{
  "summary": "1-2 sentence executive summary of what was discussed while user was away.",
  "keyPoints": ["bullet 1", "bullet 2"],
  "actionItems": ["action item with owner if any"],
  "questions": ["unresolved questions asked by colleagues"]
}
Do not include markdown code fences or backticks. Return valid JSON only.`;

  const transcript = cleanMsgs
    .map((m) => `${m.senderName} (${m.time || "recent"}): ${m.text}`)
    .join("\n");

  const llmResponse = await callLLM(systemPrompt, `Here is the conversation transcript:\n\n${transcript}`);

  if (llmResponse) {
    try {
      const cleanJson = llmResponse.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleanJson);
      const config = getActiveAIConfig();
      return {
        summary: parsed.summary || "Summary generated for unread messages.",
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
        providerUsed: config.provider !== "none" ? (config.provider as any) : "heuristic",
      };
    } catch {
      // Fall through to heuristic if JSON parsing fails
    }
  }

  // Fallback heuristic engine
  return heuristicChatSummary(cleanMsgs, conversationName);
}

/**
 * 2. Generates Contextual Smart Replies for Chat
 */
export async function generateSmartReplies(params: {
  recentMessages: Array<{ senderName: string; text: string; isMe?: boolean }>;
  currentUserName: string;
}): Promise<AISmartRepliesResult> {
  const { recentMessages, currentUserName } = params;
  const latestIncoming = [...recentMessages].reverse().find((m) => !m.isMe && m.text?.trim());

  if (!latestIncoming) {
    return {
      replies: ["Sounds good! 👍", "Thanks for the update", "I will look into this"],
      providerUsed: "heuristic",
    };
  }

  const systemPrompt = `You are SPARK AI. Suggest 3 concise, natural workplace quick replies for ${currentUserName} replying to: "${latestIncoming.senderName}: ${latestIncoming.text}".
Return JSON array of 3 short phrases (under 6 words each), e.g. ["Looking into it now", "Looks great to me 👍", "Can you share the link?"]
Return valid JSON array only. No code fences.`;

  const llmResponse = await callLLM(systemPrompt, `Latest message: "${latestIncoming.text}"`);
  if (llmResponse) {
    try {
      const cleanJson = llmResponse.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        const config = getActiveAIConfig();
        return {
          replies: parsed.slice(0, 3).map((r) => String(r).replace(/^"|"$/g, "")),
          providerUsed: config.provider !== "none" ? (config.provider as any) : "heuristic",
        };
      }
    } catch {}
  }

  // Fallback smart replies based on keywords
  const text = latestIncoming.text.toLowerCase();
  let defaultReplies = ["On it! 👍", "Thanks for sharing", "I'll review this shortly"];

  if (text.includes("?")) {
    defaultReplies = ["Let me check that", "Yes, absolutely", "I'll get back to you shortly"];
  } else if (text.includes("thank")) {
    defaultReplies = ["You're welcome! 😊", "Glad to help", "Anytime!"];
  } else if (text.includes("done") || text.includes("fixed") || text.includes("completed")) {
    defaultReplies = ["Awesome, thanks! 🚀", "Great job team", "Verified on my end"];
  }

  return { replies: defaultReplies, providerUsed: "heuristic" };
}

/**
 * 3. SPARK AI Workplace Assistant (Copilot Chat)
 */
export async function askWorkspaceAssistant(params: {
  prompt: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  workspaceContext: {
    workspaceName: string;
    currentUser: { name: string; role: string; email: string };
    projectsSummary?: string;
    tasksSummary?: string;
  };
}): Promise<{ response: string; providerUsed: "gemini" | "openai" | "groq" | "heuristic" }> {
  const { prompt, history, workspaceContext } = params;

  const systemPrompt = `You are SPARK AI, the workplace assistant for ${workspaceContext.workspaceName}.
You assist ${workspaceContext.currentUser.name} (${workspaceContext.currentUser.role}) with project coordination, task tracking, communications, and summaries.

WORKSPACE CONTEXT:
- Organization: ${workspaceContext.workspaceName}
- Active User: ${workspaceContext.currentUser.name} (${workspaceContext.currentUser.email})
- Active Projects: ${workspaceContext.projectsSummary || "Projects directory active"}
- Tasks & Deliverables: ${workspaceContext.tasksSummary || "Task boards active"}

GUIDELINES:
- Be concise, direct, professional, and actionable.
- Avoid unnecessary markdown symbols, asterisks, or emoji clutter.
- Format cleanly with structured lists when appropriate.
- Reference workspace projects and tasks directly when relevant.`;

  const formattedHistory = history
    .slice(-4)
    .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`)
    .join("\n\n");

  const fullPrompt = formattedHistory
    ? `Conversation history:\n${formattedHistory}\n\nUser request: ${prompt}`
    : `User request: ${prompt}`;

  const llmResponse = await callLLM(systemPrompt, fullPrompt);
  const config = getActiveAIConfig();

  if (llmResponse) {
    return {
      response: llmResponse,
      providerUsed: config.provider !== "none" ? (config.provider as any) : "heuristic",
    };
  }

  // Intelligent Fallback Assistant response
  const lower = prompt.toLowerCase();
  let fallbackReply = `Here is the current status for ${workspaceContext.workspaceName}:\n\n`;

  if (lower.includes("task") || lower.includes("todo") || lower.includes("priority")) {
    fallbackReply += `Task Deliverables\n`;
    fallbackReply += `• All active tasks and deliverables are synced on your Tasks board.\n`;
    fallbackReply += `• Filter by My Tasks to review items assigned directly to you.\n`;
    fallbackReply += `• High and Urgent priority issues should be addressed first.\n`;
  } else if (lower.includes("project") || lower.includes("initiative")) {
    fallbackReply += `Workspace Initiatives\n`;
    fallbackReply += `• Projects are tracked in the Projects directory.\n`;
    fallbackReply += `• View completion progress, lead owners, and target milestones.\n`;
    fallbackReply += `• Select any project board to view its Kanban cards.\n`;
  } else if (lower.includes("handover") || lower.includes("shift")) {
    fallbackReply += `Shift Handover Protocol\n`;
    fallbackReply += `• Post handover summaries directly in your shift channel.\n`;
    fallbackReply += `• Summarize completed tasks, pending work items, and blockers.\n`;
    fallbackReply += `• Team members can acknowledge receipt directly in the channel.\n`;
  } else if (lower.includes("announce") || lower.includes("draft") || lower.includes("message")) {
    fallbackReply += `Draft Team Update — ${workspaceContext.workspaceName}\n\n`;
    fallbackReply += `Hello Team,\n\n`;
    fallbackReply += `Here is our progress update for the current sprint. Please ensure open work items are updated on the board before our next sync.\n\n`;
    fallbackReply += `Best regards,\n${workspaceContext.currentUser.name}\n`;
  } else {
    fallbackReply += `Here are quick actions you can take in this workspace:\n\n`;
    fallbackReply += `• Review Deliverables: Open the Tasks board to view open work items.\n`;
    fallbackReply += `• Team Communication: Use Workspace Chat for channels and direct messages.\n`;
    fallbackReply += `• Track Initiatives: Monitor project milestones in the Projects section.\n`;
  }

  return {
    response: fallbackReply,
    providerUsed: "heuristic",
  };
}

/**
 * 4. Auto-generates Checklist Items for a Task
 */
export async function generateTaskSubtasks(
  taskTitle: string,
  taskDescription?: string | null
): Promise<{ subtasks: string[]; providerUsed: "gemini" | "openai" | "groq" | "heuristic" }> {
  const systemPrompt = `You are an agile technical lead. Given a task title and description, generate 3 to 5 clear, concrete subtask checklist items to complete it.
Return strict JSON array of strings, e.g. ["Analyze requirements", "Implement core logic", "Write unit tests", "Deploy to staging"].
No code fences or markdown.`;

  const userPrompt = `Task Title: "${taskTitle}"\nDescription: "${taskDescription || "No description provided."}"`;
  const llmResponse = await callLLM(systemPrompt, userPrompt);
  const config = getActiveAIConfig();

  if (llmResponse) {
    try {
      const cleanJson = llmResponse.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          subtasks: parsed.map((s) => String(s)),
          providerUsed: config.provider !== "none" ? (config.provider as any) : "heuristic",
        };
      }
    } catch {}
  }

  // Deterministic fallback checklist items
  return {
    subtasks: [
      `Review technical scope for "${taskTitle}"`,
      `Implement core changes and verify edge cases`,
      `Perform peer review & update documentation`,
      `Verify deployment in workspace environment`,
    ],
    providerUsed: "heuristic",
  };
}

/**
 * 5. Enhances Task Description with Structured Acceptance Criteria
 */
export async function enhanceTaskDescription(
  taskTitle: string,
  currentDescription?: string | null
): Promise<{ enhanced: string; providerUsed: "gemini" | "openai" | "groq" | "heuristic" }> {
  const systemPrompt = `You are a Senior Product Manager. Given a task title and brief description, expand it into a professional, structured specification with:
- Objective & Background
- Acceptance Criteria (numbered list)
- Definition of Done

Keep it concise and ready to paste. Markdown format.`;

  const userPrompt = `Title: "${taskTitle}"\nCurrent Notes: "${currentDescription || "None"}"`;
  const llmResponse = await callLLM(systemPrompt, userPrompt);
  const config = getActiveAIConfig();

  if (llmResponse) {
    return {
      enhanced: llmResponse,
      providerUsed: config.provider !== "none" ? (config.provider as any) : "heuristic",
    };
  }

  // Fallback enhanced template
  const enhanced = `### Objective\nDeliver robust implementation for **${taskTitle}** matching team quality standards.\n\n### Acceptance Criteria\n1. Functional requirements are verified without regressions.\n2. User permissions and workspace access controls are enforced.\n3. Changes pass automated tests and build verification.\n\n### Definition of Done\n- [ ] Code reviewed and tested\n- [ ] Documentation updated\n- [ ] Delivered to active sprint`;

  return { enhanced, providerUsed: "heuristic" };
}

/**
 * Returns current AI Configuration Status (Safe for UI display, never exposes API keys).
 */
export async function getAIStatus(): Promise<{
  isConfigured: boolean;
  provider: "gemini" | "openai" | "groq" | "heuristic";
  modelName: string;
}> {
  const { provider } = getActiveAIConfig();
  if (provider === "gemini") {
    return { isConfigured: true, provider: "gemini", modelName: "Google Gemini 3.5 Flash" };
  }
  if (provider === "openai") {
    return { isConfigured: true, provider: "openai", modelName: "OpenAI GPT-4o mini" };
  }
  if (provider === "groq") {
    return { isConfigured: true, provider: "groq", modelName: "Groq LLaMA 3.3 70B" };
  }
  return { isConfigured: false, provider: "heuristic", modelName: "SPARK Semantic Engine (Fallback)" };
}

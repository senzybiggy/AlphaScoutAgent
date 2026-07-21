import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages, insertConversationSchema } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/anthropic/conversations
router.get("/", async (req, res) => {
  const rows = await db
    .select()
    .from(conversations)
    .orderBy(conversations.createdAt);
  res.json(rows);
});

// POST /api/anthropic/conversations
router.post("/", async (req, res) => {
  const parsed = insertConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [created] = await db
    .insert(conversations)
    .values(parsed.data)
    .returning();
  res.status(201).json(created);
});

// GET /api/anthropic/conversations/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);
  res.json({ ...conv, messages: msgs });
});

// DELETE /api/anthropic/conversations/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [deleted] = await db
    .delete(conversations)
    .where(eq(conversations.id, id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.status(204).send();
});

// GET /api/anthropic/conversations/:id/messages
router.get("/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);
  res.json(msgs);
});

// POST /api/anthropic/conversations/:id/messages  (SSE stream)
router.post("/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  const { content } = req.body as { content: string };

  if (!content?.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  // Save user message
  await db.insert(messages).values({
    conversationId: id,
    role: "user",
    content: content.trim(),
  });

  // Fetch all messages for context
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);

  const chatMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system:
      "You are AlphaScout AI, an expert blockchain and crypto intelligence agent. You help users analyze wallets, tokens, smart contracts, and projects. You provide sharp, data-driven insights about on-chain activity, risk profiles, market dynamics, and project fundamentals. Be concise, professional, and insightful.",
    messages: chatMessages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullResponse += event.delta.text;
      res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
    }
  }

  // Save assistant message
  await db.insert(messages).values({
    conversationId: id,
    role: "assistant",
    content: fullResponse,
  });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;

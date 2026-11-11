import { db } from '../index.ts';
import { aiConversations, aiMessages } from '../schema.ts';
import { eq, desc, asc } from 'drizzle-orm';

export interface SaveAIMessageInput {
  conversationId?: string;
  localityId?: string;
  comparisonIds?: string[];
  language?: string;
  prompt: string;
  answer: string;
  spokenScript?: string;
  citations?: any;
  warningNote?: string;
}

export async function saveAIConversationAndMessages(input: SaveAIMessageInput): Promise<{
  conversationId: string;
  userMessageId: number;
  assistantMessageId: number;
}> {
  const convId = input.conversationId || `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  return await db.transaction(async (tx) => {
    // 1. Ensure conversation exists
    await tx.insert(aiConversations)
      .values({
        id: convId,
        localityId: input.localityId?.toLowerCase() || null,
        comparisonIds: input.comparisonIds || null,
        language: input.language || 'en',
      })
      .onConflictDoNothing();

    // 2. Insert user message
    const userMsg = await tx.insert(aiMessages)
      .values({
        conversationId: convId,
        role: 'user',
        content: input.prompt,
      })
      .returning({ id: aiMessages.id });

    // 3. Insert assistant response
    const assistantMsg = await tx.insert(aiMessages)
      .values({
        conversationId: convId,
        role: 'assistant',
        content: input.answer,
        spokenScript: input.spokenScript || null,
        citations: input.citations || null,
        warningNote: input.warningNote || null,
      })
      .returning({ id: aiMessages.id });

    return {
      conversationId: convId,
      userMessageId: userMsg[0].id,
      assistantMessageId: assistantMsg[0].id,
    };
  });
}

export async function getAIConversationHistory(conversationId: string) {
  return await db.select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.createdAt));
}

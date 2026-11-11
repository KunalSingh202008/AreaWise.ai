import { db } from '../index.ts';
import { scoreMethodologies, auditLogs } from '../schema.ts';
import { eq } from 'drizzle-orm';
import { CategoryWeights, METHODOLOGY_VERSION, updateWeights as updateLocalWeights, activeWeights } from '../../../server/scoring.ts';

export async function getActiveScoringWeightsFromDb(): Promise<CategoryWeights> {
  try {
    const rows = await db.select()
      .from(scoreMethodologies)
      .where(eq(scoreMethodologies.version, METHODOLOGY_VERSION))
      .limit(1);

    if (rows && rows.length > 0 && rows[0].weights) {
      const dbWeights = rows[0].weights as unknown as CategoryWeights;
      // Sync in-memory cache as well
      updateLocalWeights(dbWeights);
      return dbWeights;
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    console.warn('getActiveScoringWeightsFromDb fallback to local activeWeights:', error);
  }

  return activeWeights;
}

export async function updateScoringWeightsInDb(
  newWeights: Partial<CategoryWeights>,
  moderator: string = 'Admin System'
): Promise<CategoryWeights> {
  const normalized = updateLocalWeights(newWeights);

  await db.transaction(async (tx) => {
    // 1. Update score_methodologies table
    await tx.update(scoreMethodologies)
      .set({
        weights: normalized,
      })
      .where(eq(scoreMethodologies.version, METHODOLOGY_VERSION));

    // 2. Insert audit log
    await tx.insert(auditLogs)
      .values({
        action: 'SCORING_WEIGHTS_UPDATED',
        actor: moderator,
        entityType: 'SCORING_METHODOLOGY',
        entityId: METHODOLOGY_VERSION,
        details: {
          weights: normalized,
        },
      });
  });

  return normalized;
}

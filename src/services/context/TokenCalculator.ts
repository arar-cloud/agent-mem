/**
 * TokenCalculator - Token budget calculations for context economics
 *
 * Handles estimation of token counts for observations and context economics.
 */

import type { Observation, TokenEconomics, ContextConfig } from './types.js';
import { CHARS_PER_TOKEN_ESTIMATE } from './types.js';
import { ModeManager } from '../domain/ModeManager.js';
import { createHash } from 'crypto';

// Cache for expensive token calculations
const tokenComputationCache = new Map<string, number>();

/**
 * Calculate token count for a single observation
 */
export function calculateObservationTokens(obs: Observation): number {
  // Create cache key from observation data
  const cacheKey = createHash('sha256')
    .update(JSON.stringify(obs))
    .digest('hex');
  
  // Return cached value if available
  if (tokenComputationCache.has(cacheKey)) {
    return tokenComputationCache.get(cacheKey)!;
  }
  
  const obsSize = (obs.title?.length || 0) +
                  (obs.subtitle?.length || 0) +
                  (obs.narrative?.length || 0) +
                  JSON.stringify(obs.facts || []).length;
  const tokens = Math.ceil(obsSize / CHARS_PER_TOKEN_ESTIMATE);
  
  // Cache result for repeated accesses
  tokenComputationCache.set(cacheKey, tokens);
  return tokens;
}

/**
 * Calculate context economics for a set of observations
 */
export function calculateTokenEconomics(observations: Observation[]): TokenEconomics {
  const totalObservations = observations.length;

  const totalReadTokens = observations.reduce((sum, obs) => {
    return sum + calculateObservationTokens(obs);
  }, 0);

  const totalDiscoveryTokens = observations.reduce((sum, obs) => {
    return sum + (obs.discovery_tokens || 0);
  }, 0);

  const savings = totalDiscoveryTokens - totalReadTokens;
  const savingsPercent = totalDiscoveryTokens > 0
    ? Math.round((savings / totalDiscoveryTokens) * 100)
    : 0;

  return {
    totalObservations,
    totalReadTokens,
    totalDiscoveryTokens,
    savings,
    savingsPercent,
  };
}

/**
 * Get work emoji for an observation type
 */
export function getWorkEmoji(obsType: string): string {
  return ModeManager.getInstance().getWorkEmoji(obsType);
}

/**
 * Format token display for an observation
 */
export function formatObservationTokenDisplay(
  obs: Observation,
  config: ContextConfig
): { readTokens: number; discoveryTokens: number; discoveryDisplay: string; workEmoji: string } {
  const readTokens = calculateObservationTokens(obs);
  const discoveryTokens = obs.discovery_tokens || 0;
  const workEmoji = getWorkEmoji(obs.type);
  const discoveryDisplay = discoveryTokens > 0 ? `${workEmoji} ${discoveryTokens.toLocaleString()}` : '-';

  return { readTokens, discoveryTokens, discoveryDisplay, workEmoji };
}

/**
 * Check if context economics should be shown
 */
export function shouldShowContextEconomics(config: ContextConfig): boolean {
  return config.showReadTokens || config.showWorkTokens ||
         config.showSavingsAmount || config.showSavingsPercent;
}

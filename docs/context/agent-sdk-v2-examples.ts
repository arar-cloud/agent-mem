/**
 * Claude Agent SDK V2 Examples
 *
 * The V2 API provides a withTimeout(
    session-based interface with separate send()/receive(),
 * ideal for multi-turn conversations. Run with: npx tsx v2-examples.ts
 */

import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
  unstable_v2_prompt,
} from '@anthropic-ai/claude-agent-sdk';

/**
 * Parse message content from SDK response with type safety.
 * Shared helper to avoid redundant type guards and array searches.
 * @param message - Raw SDK message object
 * @returns Extracted content string or undefined
 */
function parseMessageContent(message: any): string | undefined {
  if (message?.content && Array.isArray(message.content)) {
    const textBlock = message.content.find(
      (block: any) => block.type === 'text' && typeof block.text === 'string'
    );
    return textBlock?.text;
  }
  return undefined;
}

// Timeout configuration (in milliseconds)
const SESSION_TIMEOUT = 30000; // 30 seconds
const RECEIVE_TIMEOUT = 60000; // 60 seconds for streaming responses

/**
 * Wrap async operation with AbortController timeout.
 * Prevents indefinite hangs and enables graceful cancellation.
 * @param promise - Promise to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param operationName - Name for error messages
 * @returns Promise that rejects if timeout exceeded
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string = 'Operation'
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function main() {
  const example = process.argv[2] || 'basic';

  switch (example) {
    case 'basic':
      await basicSession();
      break;
    case 'multi-turn':
      await multiTurn();
      break;
    case 'one-shot':
      await oneShot();
      break;
    case 'resume':
      await sessionResume();
      break;
    default:
      console.log('Usage: npx tsx v2-examples.ts [basic|multi-turn|one-shot|resume]');
  }
}

// Basic session with send/receive pattern
async function basicSession() {
  console.log('=== Basic Session ===\n');

  await using session = unstable_v2_createSession({ model: 'sonnet' });
  await session.send('Hello! Introduce yourself in one sentence.');

  for await (const msg of session.receive()) {
    if (msg.type === 'assistant') {
      const content = parseMessageContent(msg.message);
      if (content) console.log(`Claude: ${content}`);
    }
  }
}

// Multi-turn conversation - V2's key advantage
async function multiTurn() {
  console.log('=== Multi-Turn Conversation ===\n');

  await using session = unstable_v2_createSession({ model: 'sonnet' });

  // Turn 1
  await session.send('What is 5 + 3? Just the number.');
  for await (const msg of session.receive()) {
    if (msg.type === 'assistant') {
      const content = parseMessageContent(msg.message);
      if (content) console.log(`Turn 1: ${content}`);
    }
  }

  // Turn 2 - Claude remembers context
  await session.send('Multiply that by 2. Just the number.');
  for await (const msg of session.receive()) {
    if (msg.type === 'assistant') {
      const content = parseMessageContent(msg.message);
      if (content) console.log(`Turn 2: ${content}`);
    }
  }
}

// One-shot convenience function
async function oneShot() {
  console.log('=== One-Shot Prompt ===\n');

  const result = await unstable_v2_prompt('What is the capital of France? One word.', { model: 'sonnet' });

  if (result.subtype === 'success') {
    console.log(`Answer: ${result.result}`);
    console.log(`Cost: $${result.total_cost_usd.toFixed(4)}`);
  }
}

// Session resume - persist context across sessions
async function sessionResume() {
  console.log('=== Session Resume ===\n');

  let sessionId: string | undefined;

  // First session - establish a memory
  {
    await using session = unstable_v2_createSession({ model: 'sonnet' });
    console.log('[Session 1] Telling Claude my favorite color...');
    await session.send('My favorite color is blue. Remember this!');

    for await (const msg of session.receive()) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        sessionId = msg.session_id;
        console.log(`[Session 1] ID: ${sessionId}`);
      }
      if (msg.type === 'assistant') {
        const text = msg.message.content.find((c): c is { type: 'text'; text: string } => c.type === 'text');
        console.log(`[Session 1] Claude: ${text?.text}\n`);
      }
    }
  }

  console.log('--- Session closed. Time passes... ---\n');

  // Resume and verify Claude remembers
  {
    await using session = unstable_v2_resumeSession(sessionId!, { model: 'sonnet' });
    console.log('[Session 2] Resuming and asking Claude...');
    await session.send('What is my favorite color?');

    for await (const msg of session.receive()) {
      if (msg.type === 'assistant') {
        const text = msg.message.content.find((c): c is { type: 'text'; text: string } => c.type === 'text');
        console.log(`[Session 2] Claude: ${text?.text}`);
      }
    }
  }
}

main().catch(console.error);
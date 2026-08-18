/**
 * Claude Agent SDK V2 Examples
 *
 * The V2 API provides a session-based interface with separate send()/receive(),
 * ideal for multi-turn conversations. Run with: npx tsx v2-examples.ts
 */

import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
  unstable_v2_prompt,
} from '@anthropic-ai/claude-agent-sdk';

/**
 * Utility function to extract text content from a message.
 * Eliminates redundant filtering and type checking in receive loops.
 */
function extractTextContent(message: any): string | null {
  const textContent = message.message.content.find(
    (c: any): c is { type: 'text'; text: string } => c.type === 'text'
  );
  return textContent?.text || null;
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
      const text = extractTextContent(msg);
      console.log(`Claude: ${text}`);
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
      const text = extractTextContent(msg);
      console.log(`Turn 1: ${text}`);
      break; // Exit loop after handling assistant message
    }
  }

  // Turn 2 - Claude remembers context
  await session.send('Multiply that by 2. Just the number.');
  for await (const msg of session.receive()) {
    if (msg.type === 'assistant') {
      const text = extractTextContent(msg);
      console.log(`Turn 2: ${text}`);
      break; // Exit loop after handling assistant message
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
        const text = extractTextContent(msg);
        console.log(`[Session 1] Claude: ${text}\n`);
        break; // Exit loop after handling assistant message
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
        const text = extractTextContent(msg);
        console.log(`[Session 2] Claude: ${text}`);
        break; // Exit loop after handling assistant message
      }
    }
  }
}

main().catch(console.error);
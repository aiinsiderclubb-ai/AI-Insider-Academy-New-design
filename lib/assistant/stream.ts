/*
 * Reading the assistant's reply as it is written.
 *
 * The API answers with server-sent events, one JSON object per `data:` line.
 * EventSource cannot POST, so the stream is read off a fetch body instead and
 * split here.
 */

export type AssistantEvent =
  | { type: "delta"; text: string }
  | { type: "done"; truncated?: boolean }
  | { type: "error"; code: string };

/**
 * Splits whatever has arrived into complete events and the unfinished rest.
 * Pure, so the framing can be tested without a network.
 */
export function takeEvents(buffer: string): { events: AssistantEvent[]; rest: string } {
  const events: AssistantEvent[] = [];
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        const event = JSON.parse(line.slice(5).trim()) as AssistantEvent;
        if (event && typeof event.type === "string") events.push(event);
      } catch {
        // A malformed line is dropped; the rest of the reply still arrives.
      }
    }
  }
  return { events, rest };
}

export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AssistantEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = takeEvents(buffer);
      buffer = rest;
      yield* events;
    }
    yield* takeEvents(`${buffer}\n\n`).events;
  } finally {
    reader.releaseLock();
  }
}

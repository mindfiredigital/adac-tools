/**
 * Layout-engine warnings in a generation log: "<engine> ignores declarative
 * layout properties". Log lines look like `[2026-01-01T00:00:00.000Z] Warning: …`.
 * `logs` is absent on responses from older backends.
 */
const ENGINE_WARNING = /^\[[^\]]*\] Warning: (Layout engine ".*)$/s;
// the CLI hint is meaningless in the browser, so the banner leaves it out
const CLI_HINT = / Use --layout elk or set layoutOptions\.engine: elk\.$/;

export function layoutEngineWarnings(logs: string[] | undefined): string[] {
  const messages: string[] = [];
  for (const line of logs ?? []) {
    const match = ENGINE_WARNING.exec(line);
    if (!match) continue;
    const message = match[1].replace(CLI_HINT, '');
    if (!messages.includes(message)) messages.push(message);
  }
  return messages;
}

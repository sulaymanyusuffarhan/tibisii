import crypto from 'node:crypto';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const rank: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
function configuredLevel(): LogLevel {
  const value = process.env.LOG_LEVEL?.toLowerCase();
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error'
    ? value
    : process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}
function safeFields(input: Record<string, unknown> = {}): Record<string, unknown> {
  const blocked = /(password|secret|token|authorization|cookie|email|ip|message|body|query|sql|user.?agent)/i;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (blocked.test(key)) continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      output[key] = typeof value === 'string' ? value.slice(0, 240) : value;
    }
  }
  return output;
}
function write(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  if (rank[level] < rank[configuredLevel()]) return;
  const record = { timestamp: new Date().toISOString(), level, event: event.slice(0, 120), ...safeFields(fields) };
  const line = JSON.stringify(record);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
export const logger = {
  debug: (event: string, fields?: Record<string, unknown>) => write('debug', event, fields),
  info: (event: string, fields?: Record<string, unknown>) => write('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write('warn', event, fields),
  error: (event: string, error?: unknown, fields?: Record<string, unknown>) => {
    const err = error instanceof Error ? error : undefined;
    write('error', event, {
      ...fields,
      errorType: err?.name || 'UnknownError',
      errorCode: err && 'code' in err && typeof err.code === 'string' ? err.code : undefined,
      incidentId: crypto.randomUUID(),
    });
  },
};

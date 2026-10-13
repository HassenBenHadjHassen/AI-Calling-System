import fs from 'fs';
import path from 'path';
import { db } from './db';
import { LogLevel } from '@prisma/client';

export type LogLevelName = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVEL_SEVERITY: Record<LogLevelName, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

export interface LogContext {
  module?: string;
  correlationId?: string;
  businessId?: string;
  businessSlug?: string;
  durationMs?: number;
  payload?: unknown;
  error?: unknown;
  ip?: string;
  url?: string;
  method?: string;
  status?: number | string;
  httpStatus?: number;
  isWebhook?: boolean;
  [key: string]: unknown;
}

export interface LoggerOptions {
  module?: string;
  correlationId?: string;
  businessId?: string;
}

// Log directory setup
const LOGS_DIR = path.resolve(process.cwd(), 'logs');
const COMBINED_LOG_PATH = path.join(LOGS_DIR, 'combined.log');
const WEBHOOKS_LOG_PATH = path.join(LOGS_DIR, 'webhooks.log');
const ERROR_LOG_PATH = path.join(LOGS_DIR, 'error.log');

// Ensure logs directory exists safely
try {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
} catch {
  // Directory might already exist or running in restricted environment
}

// Format date in ISO Europe/Paris or standard ISO
function getTimestamp(): string {
  return new Date().toISOString();
}

// ANSI colors for clean terminal & PM2 readability
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  purple: '\x1b[35m',// Magenta
};

// Comprehensive string sanitizer redacting credentials, tokens, PII, and medical details
export function sanitizeLogString(str: string): string {
  if (!str || typeof str !== 'string') return str;

  let sanitized = str;

  // 1. Redact Authorization Bearer tokens & JWTs
  sanitized = sanitized.replace(/Bearer[\s:=]+[A-Za-z0-9_\-\.]+/gi, 'Bearer: [REDACTED_TOKEN]');
  sanitized = sanitized.replace(/\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g, '[REDACTED_JWT]');

  // 2. Redact passwords, secrets, api keys, auth tokens, credentials, bearer tokens
  sanitized = sanitized.replace(
    /(?:api[_-]?key|secret|token|bearer|password|auth|credential|vapi_secret)\s*[:=]\s*['"]?[^\s,'";&]+['"]?/gi,
    (match) => {
      const parts = match.split(/[:=]/);
      return `${parts[0]}: [REDACTED_CREDENTIAL]`;
    }
  );

  // 3. Redact cookies
  sanitized = sanitized.replace(/(?:cookie|set-cookie)\s*[:=]\s*['"]?[^\r\n;,]+['"]?/gi, 'cookie: [REDACTED_COOKIE]');

  // 4. Redact French and international phone numbers (masks digits)
  sanitized = sanitized.replace(/(?:\+33|0033|0)[1-9](?:[\s.-]?\d{2}){4}\b/g, '+336****78');
  sanitized = sanitized.replace(/(?:\+|00)[1-9]\d{6,14}\b/g, '+336****78');

  // 5. Redact French postal codes in addresses/text (e.g. 75008, 13001)
  sanitized = sanitized.replace(/\b(?:0[1-9]|[1-8]\d|9[0-8])\d{3}\b/g, '[REDACTED_POSTAL_CODE]');

  // 6. Redact explicit patient email fields in text (e.g. email: patient@test.com)
  sanitized = sanitized.replace(/(?:email|mail)\s*[:=]\s*['"]?[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+['"]?/gi, (match) => {
    const parts = match.split(/[:=]/);
    return `${parts[0]}: [REDACTED_EMAIL]`;
  });

  return sanitized;
}

// Safe error serializer ensuring message and stack are sanitized across all sinks
export function serializeError(err: unknown): { message: string; stack?: string; name?: string } | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: sanitizeLogString(err.message),
      stack: err.stack ? sanitizeLogString(err.stack) : undefined,
    };
  }
  return { message: sanitizeLogString(String(err)) };
}

// Safe payload sanitizer (strips sensitive tokens, PII, medical data, large blobs)
export function sanitizeLogData(data: unknown, maxDepth = 4): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      return sanitizeLogString(data);
    }
    return data;
  }
  if (maxDepth <= 0) return '[Truncated Depth]';

  if (Array.isArray(data)) {
    return data.slice(0, 50).map((item) => sanitizeLogData(item, maxDepth - 1));
  }

  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = [
    // Secrets & Auth
    'password',
    'secret',
    'token',
    'authorization',
    'apikey',
    'api_key',
    'authtoken',
    'credential',
    'privatekey',
    'signature',
    'xtwiliosignature',
    'xvapisecret',
    'cookie',
    'cookies',
    'setcookie',
    'bearer',
    'accesstoken',
    'refreshtoken',
    'idtoken',
    'sessiontoken',
    // PII (Names, Phone Numbers, Addresses, Emails)
    'patientname',
    'contactname',
    'name',
    'nom',
    'prenom',
    'caller',
    'callernumber',
    'phonenumber',
    'recipient',
    'from',
    'to',
    'phone',
    'postalcode',
    'codepostal',
    'address',
    'adresse',
    'email',
    'useremail',
    // Medical & Symptoms
    'medicalnotes',
    'clinicalnotes',
    'symptom',
    'symptoms',
    'prescription',
    'treatment',
    'maladie',
    'pathologie',
    'caredescription',
    'soin',
    'soins',
    'motif',
    // Content & Transcripts
    'transcript',
    'transcription',
    'body',
    'message',
    'summary',
    'artifact',
    'payload',
    'bodydata',
    'structureddata',
    'formsubmissiondata',
  ];

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
    if (
      sensitiveKeys.some(
        (s) => key.toLowerCase() === s || normalizedKey === s || normalizedKey.includes(s)
      )
    ) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value, maxDepth - 1);
    } else if (typeof value === 'string') {
      const masked = sanitizeLogString(value);
      if (masked.length > 2000) {
        sanitized[key] = masked.substring(0, 2000) + '... [truncated]';
      } else {
        sanitized[key] = masked;
      }
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// Configurable log rotation settings
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const DEFAULT_MAX_FILES = 5;

export async function rotateLogFile(filePath: string, maxFiles: number): Promise<void> {
  try {
    for (let i = maxFiles - 1; i >= 1; i--) {
      const older = `${filePath}.${i}`;
      const newer = `${filePath}.${i + 1}`;
      if (fs.existsSync(/*turbopackIgnore: true*/ older)) {
        if (i === maxFiles - 1) {
          await fs.promises.unlink(older).catch(() => {});
        } else {
          await fs.promises.rename(older, newer).catch(() => {});
        }
      }
    }
    if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
      await fs.promises.rename(filePath, `${filePath}.1`).catch(() => {});
    }
  } catch (rotErr) {
    console.error('[LogRotation Error]:', rotErr instanceof Error ? sanitizeLogString(rotErr.message) : '[unknown error]');
  }
}

async function writeWithRotation(filePath: string, logLine: string): Promise<void> {
  const maxBytes = parseInt(process.env.LOG_MAX_FILE_SIZE_BYTES || String(DEFAULT_MAX_FILE_SIZE), 10);
  const maxFiles = parseInt(process.env.LOG_MAX_FILES_COUNT || String(DEFAULT_MAX_FILES), 10);

  try {
    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.size >= maxBytes) {
        await rotateLogFile(filePath, maxFiles);
      }
    } catch {
      // File does not exist yet, continue to write
    }
    await fs.promises.appendFile(filePath, logLine, 'utf8');
  } catch (err) {
    console.error(`[Logger File Fallback: ${filePath}]`, err instanceof Error ? sanitizeLogString(err.message) : '[unknown error]');
  }
}

export class Logger {
  private defaultModule: string;
  private defaultCorrelationId?: string;
  private defaultBusinessId?: string;
  private minLevel: LogLevelName;

  constructor(options: LoggerOptions = {}) {
    this.defaultModule = options.module || 'SYSTEM';
    this.defaultCorrelationId = options.correlationId;
    this.defaultBusinessId = options.businessId;

    const envLevel = (process.env.LOG_LEVEL || '').toUpperCase();
    if (envLevel in LOG_LEVEL_SEVERITY) {
      this.minLevel = envLevel as LogLevelName;
    } else {
      this.minLevel = process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG';
    }
  }

  /**
   * Spawns a child logger with bound module, correlationId or businessId
   */
  child(options: LoggerOptions): Logger {
    return new Logger({
      module: options.module || this.defaultModule,
      correlationId: options.correlationId || this.defaultCorrelationId,
      businessId: options.businessId || this.defaultBusinessId,
    });
  }

  /**
   * Generates a unique correlation ID for end-to-end request tracing
   */
  static generateCorrelationId(prefix = 'req'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Safely prunes old system logs from PostgreSQL.
   * Only deletes records from SystemLog table, strictly preserving business records.
   */
  static async pruneDatabaseLogs(retentionDays = 14): Promise<number> {
    try {
      if (!db.systemLog?.deleteMany) return 0;
      const days = parseInt(process.env.LOG_RETENTION_DAYS || String(retentionDays), 10);
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = await db.systemLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });
      return result.count;
    } catch (err) {
      console.error('[Logger pruneDatabaseLogs Fallback]', err instanceof Error ? sanitizeLogString(err.message) : '[unknown error]');
      return 0;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('DEBUG', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('WARN', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('ERROR', message, context);
  }

  /**
   * Core logging function
   */
  private log(level: LogLevelName, message: string, context: LogContext = {}): void {
    if (LOG_LEVEL_SEVERITY[level] < LOG_LEVEL_SEVERITY[this.minLevel]) {
      return;
    }

    const timestamp = getTimestamp();
    const moduleName = context.module || this.defaultModule;
    const correlationId = context.correlationId || this.defaultCorrelationId;
    const businessId = context.businessId || this.defaultBusinessId;
    const isWebhook =
      context.isWebhook ||
      moduleName.toUpperCase().includes('WEBHOOK') ||
      moduleName.toUpperCase().includes('VAPI') ||
      moduleName.toUpperCase().includes('TWILIO');

    const safeMessage = sanitizeLogString(message);
    const errObj = serializeError(context.error);

    // Build structured log record with sanitized message, error, and metadata
    const record = {
      timestamp,
      level,
      module: moduleName,
      message: safeMessage,
      correlationId: correlationId || undefined,
      businessId: businessId || undefined,
      durationMs: context.durationMs,
      error: errObj,
      metadata: sanitizeLogData({
        ...context,
        module: undefined,
        correlationId: undefined,
        businessId: undefined,
        error: undefined,
      }),
    };

    // 1. Output to Console (Colorized & PM2 friendly)
    this.writeToConsole(level, moduleName, correlationId, safeMessage, context, errObj);

    // 2. Output to Files asynchronously with rotation
    this.writeToFile(record, isWebhook);

    // 3. Persist to PostgreSQL asynchronously (fire and forget)
    this.writeToDatabase(record);
  }

  private writeToConsole(
    level: LogLevelName,
    moduleName: string,
    correlationId: string | undefined,
    message: string,
    context: LogContext,
    errObj?: { message: string; stack?: string }
  ): void {
    const color =
      level === 'ERROR'
        ? COLORS.error
        : level === 'WARN'
        ? COLORS.warn
        : level === 'INFO'
        ? COLORS.info
        : COLORS.debug;

    const timeStr = `${COLORS.dim}${new Date().toLocaleTimeString('fr-FR', { hour12: false })}${COLORS.reset}`;
    const levelStr = `${color}${COLORS.bold}[${level.padEnd(5)}]${COLORS.reset}`;
    const moduleStr = `${COLORS.purple}[${moduleName}]${COLORS.reset}`;
    const corrStr = correlationId ? `${COLORS.dim}[${correlationId}]${COLORS.reset}` : '';
    const durationStr = context.durationMs !== undefined ? `${COLORS.dim}(${context.durationMs}ms)${COLORS.reset}` : '';

    const prefix = [timeStr, levelStr, moduleStr, corrStr, durationStr].filter(Boolean).join(' ');

    if (level === 'ERROR') {
      console.error(`${prefix} ${message}`);
      if (errObj?.stack) {
        console.error(`${COLORS.error}${errObj.stack}${COLORS.reset}`);
      }
    } else if (level === 'WARN') {
      console.warn(`${prefix} ${message}`);
      if (errObj?.message) {
        console.warn(`${COLORS.warn}${errObj.message}${COLORS.reset}`);
      }
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  private writeToFile(
    record: {
      timestamp: string;
      level: LogLevelName;
      module: string;
      message: string;
      correlationId?: string;
      businessId?: string;
      durationMs?: number;
      error?: unknown;
      metadata: unknown;
    },
    isWebhook: boolean
  ): void {
    const logLine = JSON.stringify(record) + '\n';

    // File appending in background with file size rotation
    Promise.resolve().then(async () => {
      try {
        await writeWithRotation(COMBINED_LOG_PATH, logLine);

        if (isWebhook) {
          await writeWithRotation(WEBHOOKS_LOG_PATH, logLine);
        }

        if (record.level === 'WARN' || record.level === 'ERROR') {
          await writeWithRotation(ERROR_LOG_PATH, logLine);
        }
      } catch (err) {
        console.error('[Logger writeToFile Fallback]', err instanceof Error ? sanitizeLogString(err.message) : '[unknown error]');
      }
    });
  }

  private writeToDatabase(record: {
    level: LogLevelName;
    module: string;
    message: string;
    correlationId?: string;
    businessId?: string;
    error?: unknown;
    metadata: unknown;
  }): void {
    // Only persist INFO, WARN, ERROR to avoid bloating DB with raw DEBUG
    if (record.level === 'DEBUG') return;

    // Fire-and-forget save to Postgres SystemLog table with safe fallback
    Promise.resolve().then(async () => {
      try {
        if (!db.systemLog?.create) return;
        const prismaLevel = record.level as LogLevel;
        await db.systemLog.create({
          data: {
            level: prismaLevel,
            module: record.module,
            message: record.message,
            correlationId: record.correlationId || null,
            businessId: record.businessId || null,
            metadata: {
              ...(record.metadata as object),
              error: record.error || undefined,
            },
          },
        });
      } catch (dbErr) {
        console.error('[Logger writeToDatabase Fallback]', dbErr instanceof Error ? sanitizeLogString(dbErr.message) : '[unknown error]');
      }
    });
  }
}

// Global default logger instance
export const logger = new Logger({ module: 'APP' });

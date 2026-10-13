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

// Safe error serializer
function serializeError(err: unknown): { message: string; stack?: string; name?: string } | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  return { message: String(err) };
}

// Safe payload sanitizer (strips sensitive tokens, large blobs)
export function sanitizeLogData(data: unknown, maxDepth = 4): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (maxDepth <= 0) return '[Truncated Depth]';

  if (Array.isArray(data)) {
    return data.slice(0, 50).map((item) => sanitizeLogData(item, maxDepth - 1));
  }

  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = [
    'password',
    'secret',
    'token',
    'authorization',
    'apikey',
    'api_key',
    'authtoken',
    'credential',
    'privatekey',
  ];

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
    if (
      sensitiveKeys.some((s) => key.toLowerCase().includes(s) || normalizedKey.includes(s.replace(/[-_]/g, '')))
    ) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value, maxDepth - 1);
    } else if (typeof value === 'string' && value.length > 2000) {
      sanitized[key] = value.substring(0, 2000) + '... [truncated]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
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

    const errObj = serializeError(context.error);

    // Build structured log record
    const record = {
      timestamp,
      level,
      module: moduleName,
      message,
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
    this.writeToConsole(level, moduleName, correlationId, message, context, errObj);

    // 2. Output to Files asynchronously
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

    // File appending in background
    Promise.resolve().then(async () => {
      try {
        await fs.promises.appendFile(COMBINED_LOG_PATH, logLine, 'utf8');

        if (isWebhook) {
          await fs.promises.appendFile(WEBHOOKS_LOG_PATH, logLine, 'utf8');
        }

        if (record.level === 'WARN' || record.level === 'ERROR') {
          await fs.promises.appendFile(ERROR_LOG_PATH, logLine, 'utf8');
        }
      } catch {
        // Silently catch file writing failures so requests are never interrupted
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

    // Fire-and-forget save to Postgres SystemLog table
    Promise.resolve().then(async () => {
      try {
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
      } catch {
        // Silently catch DB logging failures to guarantee zero disruption to core operations
      }
    });
  }
}

// Global default logger instance
export const logger = new Logger({ module: 'APP' });

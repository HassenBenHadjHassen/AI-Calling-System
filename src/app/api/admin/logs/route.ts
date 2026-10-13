import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { LogLevel, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role or permissions check
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, allowedSections: true },
    });

    const isAuthorized =
      dbUser?.role === 'ADMIN' ||
      dbUser?.allowedSections === 'ALL' ||
      dbUser?.allowedSections?.includes('logs');

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const levelParam = searchParams.get('level')?.toUpperCase();
    const moduleParam = searchParams.get('module');
    const searchParam = searchParams.get('search');
    const businessIdParam = searchParams.get('businessId');

    const where: Prisma.SystemLogWhereInput = {};

    if (levelParam && levelParam !== 'ALL') {
      if (['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(levelParam)) {
        where.level = levelParam as LogLevel;
      }
    }

    if (moduleParam && moduleParam !== 'ALL') {
      where.module = {
        contains: moduleParam,
        mode: 'insensitive',
      };
    }

    if (businessIdParam && businessIdParam !== 'ALL') {
      where.businessId = businessIdParam;
    }

    if (searchParam && searchParam.trim()) {
      const term = searchParam.trim();
      where.OR = [
        { message: { contains: term, mode: 'insensitive' } },
        { correlationId: { contains: term, mode: 'insensitive' } },
        { module: { contains: term, mode: 'insensitive' } },
      ];
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [logs, total, total24h, errors24h, warnings24h, webhooks24h] = await Promise.all([
      db.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          business: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      db.systemLog.count({ where }),
      db.systemLog.count({
        where: { createdAt: { gte: twentyFourHoursAgo } },
      }),
      db.systemLog.count({
        where: {
          level: LogLevel.ERROR,
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
      db.systemLog.count({
        where: {
          level: LogLevel.WARN,
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
      db.systemLog.count({
        where: {
          module: { contains: 'WEBHOOK', mode: 'insensitive' },
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        total24h,
        errors24h,
        warnings24h,
        webhooks24h,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to retrieve system logs', { error: err });
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (dbUser?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can clear logs' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const retentionDays = parseInt(searchParams.get('days') || '7', 10);
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const deleted = await db.systemLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    logger.info(`Admin purged ${deleted.count} old system logs (older than ${retentionDays} days)`);

    return NextResponse.json({
      success: true,
      deletedCount: deleted.count,
      cutoffDate,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

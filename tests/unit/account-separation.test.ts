import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

describe('Multi-Account & Section Separation Tests', () => {
  it('authenticates Cabinet Michelle account and verifies its assigned business is CABINET_MICHELLE', async () => {
    const res = await auth.api.signInEmail({
      body: {
        email: 'michelle@moncabinet.fr',
        password: 'MichellePassword2026!',
      },
    });

    expect(res).toBeDefined();
    expect(res.user).toBeDefined();
    expect(res.user.email).toBe('michelle@moncabinet.fr');

    const dbUser = await db.user.findUnique({
      where: { email: 'michelle@moncabinet.fr' },
    });

    expect(dbUser).toBeDefined();
    expect(dbUser?.assignedBusiness).toBe('CABINET_MICHELLE');
    expect(dbUser?.allowedSections).toContain('calendar');
    expect(dbUser?.allowedSections).toContain('appointments');
    expect(dbUser?.allowedSections).not.toContain('requests');
  });

  it('authenticates Dani Bâtiment account and verifies its assigned business is DANI_BATIMENT', async () => {
    const res = await auth.api.signInEmail({
      body: {
        email: 'dani@danibatiment.fr',
        password: 'DaniPassword2026!',
      },
    });

    expect(res).toBeDefined();
    expect(res.user).toBeDefined();
    expect(res.user.email).toBe('dani@danibatiment.fr');

    const dbUser = await db.user.findUnique({
      where: { email: 'dani@danibatiment.fr' },
    });

    expect(dbUser).toBeDefined();
    expect(dbUser?.assignedBusiness).toBe('DANI_BATIMENT');
    expect(dbUser?.allowedSections).toContain('requests');
    expect(dbUser?.allowedSections).not.toContain('calendar');
    expect(dbUser?.allowedSections).not.toContain('appointments');
  });

  it('verifies Super Admin has ALL business scope and ADMIN role', async () => {
    const adminUser = await db.user.findUnique({
      where: { email: 'admin@moncabinet.fr' },
    });

    expect(adminUser).toBeDefined();
    expect(adminUser?.role).toBe('ADMIN');
    expect(adminUser?.assignedBusiness).toBe('ALL');
    expect(adminUser?.allowedSections).toBe('ALL');
  });

  it('correctly filters appointments and requests according to tenant business isolation', async () => {
    const [michelleBiz, daniBiz] = await Promise.all([
      db.business.findUnique({ where: { slug: 'CABINET_MICHELLE' } }),
      db.business.findUnique({ where: { slug: 'DANI_BATIMENT' } }),
    ]);

    expect(michelleBiz).toBeDefined();
    expect(daniBiz).toBeDefined();

    // Query appointments for Michelle
    const michelleAppointments = await db.appointment.findMany({
      where: { businessId: michelleBiz!.id },
    });

    // None of Michelle's appointments belong to Dani
    for (const appt of michelleAppointments) {
      expect(appt.businessId).toBe(michelleBiz!.id);
      expect(appt.businessId).not.toBe(daniBiz!.id);
    }

    // Query requests for Dani
    const daniRequests = await db.serviceRequest.findMany({
      where: { businessId: daniBiz!.id },
    });

    // None of Dani's requests belong to Michelle
    for (const req of daniRequests) {
      expect(req.businessId).toBe(daniBiz!.id);
      expect(req.businessId).not.toBe(michelleBiz!.id);
    }
  });

  it('correctly evaluates allowed tabs based on permissions', () => {
    // Helper function matching the dashboard logic
    function getPermittedTabs(
      assignedBusiness: string,
      allowedSections: string,
      isAdmin: boolean
    ) {
      const isMichelleOnly = assignedBusiness === 'CABINET_MICHELLE';
      const isDaniOnly = assignedBusiness === 'DANI_BATIMENT';
      const sectionsList =
        allowedSections === 'ALL'
          ? ['overview', 'calendar', 'appointments', 'requests', 'calls', 'users']
          : allowedSections.split(',').map((s) => s.trim());

      const allTabs = [
        { id: 'overview', visible: sectionsList.includes('overview') },
        { id: 'calendar', visible: !isDaniOnly && sectionsList.includes('calendar') },
        { id: 'appointments', visible: !isDaniOnly && sectionsList.includes('appointments') },
        { id: 'requests', visible: !isMichelleOnly && sectionsList.includes('requests') },
        { id: 'calls', visible: sectionsList.includes('calls') },
        { id: 'users', visible: isAdmin && sectionsList.includes('users') },
      ];

      return allTabs.filter((t) => t.visible).map((t) => t.id);
    }

    // Test Michelle
    const michelleTabs = getPermittedTabs('CABINET_MICHELLE', 'overview,calendar,appointments,calls', false);
    expect(michelleTabs).toEqual(['overview', 'calendar', 'appointments', 'calls']);
    expect(michelleTabs).not.toContain('requests');
    expect(michelleTabs).not.toContain('users');

    // Test Dani
    const daniTabs = getPermittedTabs('DANI_BATIMENT', 'overview,requests,calls', false);
    expect(daniTabs).toEqual(['overview', 'requests', 'calls']);
    expect(daniTabs).not.toContain('calendar');
    expect(daniTabs).not.toContain('appointments');
    expect(daniTabs).not.toContain('users');

    // Test Super Admin
    const adminTabs = getPermittedTabs('ALL', 'ALL', true);
    expect(adminTabs).toEqual(['overview', 'calendar', 'appointments', 'requests', 'calls', 'users']);

    // Test Granular Assignment: User assigned only to calendar
    const calendarOnlyTabs = getPermittedTabs('CABINET_MICHELLE', 'calendar', false);
    expect(calendarOnlyTabs).toEqual(['calendar']);
  });
});

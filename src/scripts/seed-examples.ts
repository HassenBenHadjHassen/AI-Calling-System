import { db } from '../lib/db';
import { TenantService } from '../lib/services/tenant.service';
import {
  BusinessType,
  ServiceRequestCategory,
  ServiceRequestStatus,
  AppointmentStatus,
  LineType,
} from '@prisma/client';
import { DateTime } from 'luxon';

async function seedExamples() {
  console.log('🌱 Seeding realistic examples for Devis and Calendar...');

  // 1. Ensure businesses exist
  const michelle = await TenantService.ensureTenant('CABINET_MICHELLE');
  const batiment = await TenantService.ensureTenant('DANI_BATIMENT');

  console.log(`✓ Tenants verified: ${michelle.name} (${michelle.id}), ${batiment.name} (${batiment.id})`);

  // ==============================================================================
  // 2. SEED DANI BÂTIMENT DEVIS EXAMPLES
  // ==============================================================================

  // Example 1: Pending Devis ready for client to fill out
  const contactDevisPending = await db.contact.upsert({
    where: {
      businessId_phoneNumber: {
        businessId: batiment.id,
        phoneNumber: '+33642189073',
      },
    },
    update: {
      name: 'Jean-Luc Moreau',
    },
    create: {
      businessId: batiment.id,
      name: 'Jean-Luc Moreau',
      phoneNumber: '+33642189073',
      lineType: LineType.MOBILE,
    },
  });

  const callRecord1 = await db.callRecord.upsert({
    where: { vapiCallId: 'call_demo_devis_001' },
    update: {},
    create: {
      businessId: batiment.id,
      vapiCallId: 'call_demo_devis_001',
      assistantId: '38a56410-a3b6-49d5-96f1-8cd572b3f81c',
      contactId: contactDevisPending.id,
      callerNumber: '+33642189073',
      summary: 'Appel entrant de M. Moreau demandant un devis pour la rénovation complète de sa salle de bain et cuisine (carrelage et plomberie). Appartement de 75m².',
      structuredData: {
        name: 'Jean-Luc Moreau',
        motif: 'Devis Rénovation',
        service_type: 'Rénovation Salle de Bain & Cuisine',
      },
    },
  });

  await db.serviceRequest.upsert({
    where: { id: 'req_demo_pending_01' },
    update: {
      status: ServiceRequestStatus.NOT_COMPLETED,
    },
    create: {
      id: 'req_demo_pending_01',
      businessId: batiment.id,
      contactId: contactDevisPending.id,
      callRecordId: callRecord1.id,
      vapiCallId: 'call_demo_devis_001',
      category: ServiceRequestCategory.DEVIS,
      status: ServiceRequestStatus.NOT_COMPLETED,
      serviceType: 'Rénovation Salle de Bain & Cuisine',
      message: 'Souhaite refaire le carrelage et la plomberie d’un appartement ancien de 75m². Chantier souhaité début novembre.',
    },
  });

  // Example 2: Already Completed Devis (Showcases the success / completed state)
  const contactDevisCompleted = await db.contact.upsert({
    where: {
      businessId_phoneNumber: {
        businessId: batiment.id,
        phoneNumber: '+33688442211',
      },
    },
    update: {
      name: 'Sophie Bernard',
      email: 'sophie.bernard@example.fr',
      address: '42 Avenue de la République',
      postalCode: '75011',
      city: 'Paris',
    },
    create: {
      businessId: batiment.id,
      name: 'Sophie Bernard',
      phoneNumber: '+33688442211',
      email: 'sophie.bernard@example.fr',
      address: '42 Avenue de la République',
      postalCode: '75011',
      city: 'Paris',
      lineType: LineType.MOBILE,
    },
  });

  const callRecord2 = await db.callRecord.upsert({
    where: { vapiCallId: 'call_demo_completed_002' },
    update: {},
    create: {
      businessId: batiment.id,
      vapiCallId: 'call_demo_completed_002',
      assistantId: '38a56410-a3b6-49d5-96f1-8cd572b3f81c',
      contactId: contactDevisCompleted.id,
      callerNumber: '+33688442211',
      summary: 'Mme Bernard souhaite un devis pour peinture et vitrification parquet sur 60m².',
    },
  });

  await db.serviceRequest.upsert({
    where: { id: 'req_demo_completed_02' },
    update: {
      status: ServiceRequestStatus.COMPLETED,
      address: '42 Avenue de la République',
      postalCode: '75011',
      email: 'sophie.bernard@example.fr',
    },
    create: {
      id: 'req_demo_completed_02',
      businessId: batiment.id,
      contactId: contactDevisCompleted.id,
      callRecordId: callRecord2.id,
      vapiCallId: 'call_demo_completed_002',
      category: ServiceRequestCategory.DEVIS,
      status: ServiceRequestStatus.COMPLETED,
      serviceType: 'Peinture Intérieure & Parquet',
      address: '42 Avenue de la République',
      postalCode: '75011',
      email: 'sophie.bernard@example.fr',
      message: 'Surface 60m² environ. Accès facile, 2ème étage avec ascenseur.',
    },
  });

  console.log('✓ Dani Bâtiment devis examples seeded:');
  console.log('  -> Pending:   /devis/call_demo_devis_001');
  console.log('  -> Completed: /devis/call_demo_completed_002');

  // ==============================================================================
  // 3. SEED CABINET MICHELLE APPOINTMENTS & CALENDAR PLANNING
  // ==============================================================================

  // Patient 1: Confirmed Morning appointment
  const contactPatient1 = await db.contact.upsert({
    where: {
      businessId_phoneNumber: {
        businessId: michelle.id,
        phoneNumber: '+33612850101',
      },
    },
    update: { name: 'Marie Curie' },
    create: {
      businessId: michelle.id,
      name: 'Marie Curie',
      phoneNumber: '+33612850101',
      lineType: LineType.MOBILE,
    },
  });

  const today = DateTime.now().setZone('Europe/Paris');
  const dateStr = today.toFormat('yyyy-MM-dd');

  const appt1Start = today.set({ hour: 9, minute: 30, second: 0, millisecond: 0 }).toJSDate();
  const appt1End = today.set({ hour: 10, minute: 30, second: 0, millisecond: 0 }).toJSDate();

  await db.appointment.upsert({
    where: { id: 'appt_demo_01' },
    update: {},
    create: {
      id: 'appt_demo_01',
      businessId: michelle.id,
      contactId: contactPatient1.id,
      serviceType: 'Pansement lourd et complexe',
      date: dateStr,
      time: '09h30',
      startTime: appt1Start,
      endTime: appt1End,
      status: AppointmentStatus.CONFIRMED,
      urgency: false,
      googleCalendarEventId: 'cal_internal_demo_01',
      notes: 'Changement de pansement post-chirurgie. Ordonnance ALD présente.',
    },
  });

  // Patient 2: Confirmed Routine
  const contactPatient2 = await db.contact.upsert({
    where: {
      businessId_phoneNumber: {
        businessId: michelle.id,
        phoneNumber: '+33612850202',
      },
    },
    update: { name: 'Robert Desnos' },
    create: {
      businessId: michelle.id,
      name: 'Robert Desnos',
      phoneNumber: '+33612850202',
      lineType: LineType.MOBILE,
    },
  });

  const appt2Start = today.set({ hour: 11, minute: 0, second: 0, millisecond: 0 }).toJSDate();
  const appt2End = today.set({ hour: 11, minute: 45, second: 0, millisecond: 0 }).toJSDate();

  await db.appointment.upsert({
    where: { id: 'appt_demo_02' },
    update: {},
    create: {
      id: 'appt_demo_02',
      businessId: michelle.id,
      contactId: contactPatient2.id,
      serviceType: 'Injection d’insuline & surveillance glycémie',
      date: dateStr,
      time: '11h00',
      startTime: appt2Start,
      endTime: appt2End,
      status: AppointmentStatus.CONFIRMED,
      urgency: false,
      googleCalendarEventId: 'cal_internal_demo_02',
      notes: 'Passage quotidien 11h.',
    },
  });

  // Blocked Slot: Lunch & Pharmacy break
  const staffContact = await db.contact.upsert({
    where: {
      businessId_phoneNumber: {
        businessId: michelle.id,
        phoneNumber: '+33939033663',
      },
    },
    update: { name: 'Cabinet Michelle (Interne)' },
    create: {
      businessId: michelle.id,
      name: 'Cabinet Michelle (Interne)',
      phoneNumber: '+33939033663',
      lineType: LineType.LANDLINE,
    },
  });

  const block1Start = today.set({ hour: 12, minute: 30, second: 0, millisecond: 0 }).toJSDate();
  const block1End = today.set({ hour: 13, minute: 30, second: 0, millisecond: 0 }).toJSDate();

  await db.appointment.upsert({
    where: { id: 'block_demo_01' },
    update: {},
    create: {
      id: 'block_demo_01',
      businessId: michelle.id,
      contactId: staffContact.id,
      serviceType: 'INDISPONIBLE: Pause Déjeuner & Pharmacie',
      date: dateStr,
      time: '12h30',
      startTime: block1Start,
      endTime: block1End,
      status: AppointmentStatus.CONFIRMED,
      urgency: false,
      googleCalendarEventId: 'block_evt_lunch',
      notes: 'Créneau bloqué pour réapprovisionnement matériel et repas.',
    },
  });

  // Patient 3: URGENT CONFIRMED
  const contactPatient3 = await db.contact.upsert({
    where: {
      businessId_phoneNumber: {
        businessId: michelle.id,
        phoneNumber: '+33612850303',
      },
    },
    update: { name: 'Camille Claudel' },
    create: {
      businessId: michelle.id,
      name: 'Camille Claudel',
      phoneNumber: '+33612850303',
      lineType: LineType.MOBILE,
    },
  });

  const appt3Start = today.set({ hour: 14, minute: 0, second: 0, millisecond: 0 }).toJSDate();
  const appt3End = today.set({ hour: 14, minute: 45, second: 0, millisecond: 0 }).toJSDate();

  await db.appointment.upsert({
    where: { id: 'appt_demo_03' },
    update: {},
    create: {
      id: 'appt_demo_03',
      businessId: michelle.id,
      contactId: contactPatient3.id,
      serviceType: 'Urgence: Perfusion antibiotique',
      date: dateStr,
      time: '14h00',
      startTime: appt3Start,
      endTime: appt3End,
      status: AppointmentStatus.CONFIRMED_URGENT,
      urgency: true,
      googleCalendarEventId: 'cal_internal_demo_03',
      notes: 'Patient sorti de clinique ce matin. Perfusion à poser sans délai.',
    },
  });

  // Blocked Slot: Home visits driving tour
  const block2Start = today.set({ hour: 15, minute: 0, second: 0, millisecond: 0 }).toJSDate();
  const block2End = today.set({ hour: 16, minute: 0, second: 0, millisecond: 0 }).toJSDate();

  await db.appointment.upsert({
    where: { id: 'block_demo_02' },
    update: {},
    create: {
      id: 'block_demo_02',
      businessId: michelle.id,
      contactId: staffContact.id,
      serviceType: 'INDISPONIBLE: Tournée Secteur Nord',
      date: dateStr,
      time: '15h00',
      startTime: block2Start,
      endTime: block2End,
      status: AppointmentStatus.CONFIRMED,
      urgency: false,
      googleCalendarEventId: 'block_evt_tournee',
      notes: 'Déplacements secteur excentré.',
    },
  });

  // Patient 4: PENDING SMS REPLY
  const contactPatient4 = await db.contact.upsert({
    where: {
      businessId_phoneNumber: {
        businessId: michelle.id,
        phoneNumber: '+33612850404',
      },
    },
    update: { name: 'Antoine de Saint-Exupéry' },
    create: {
      businessId: michelle.id,
      name: 'Antoine de Saint-Exupéry',
      phoneNumber: '+33612850404',
      lineType: LineType.MOBILE,
    },
  });

  const appt4Start = today.set({ hour: 16, minute: 30, second: 0, millisecond: 0 }).toJSDate();
  const appt4End = today.set({ hour: 17, minute: 15, second: 0, millisecond: 0 }).toJSDate();

  await db.appointment.upsert({
    where: { id: 'appt_demo_04' },
    update: {},
    create: {
      id: 'appt_demo_04',
      businessId: michelle.id,
      contactId: contactPatient4.id,
      serviceType: 'Bilan tensionnel et prise de sang',
      date: dateStr,
      time: '16h30',
      startTime: appt4Start,
      endTime: appt4End,
      status: AppointmentStatus.PENDING,
      urgency: false,
      notes: 'SMS de confirmation envoyé à l’infirmière. En attente de réponse OUI/NON.',
    },
  });

  console.log('✓ Cabinet Michelle calendar planning seeded with 6 appointments & blocks:');
  console.log('  -> Planning URL: /dashboard?tab=calendar');
  console.log('  -> iCal Feed:    /api/calendar/michelle.ics');
  console.log('🎉 Seed completed successfully!');
}

seedExamples()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seed error:', err);
    process.exit(1);
  });

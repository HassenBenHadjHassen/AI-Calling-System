import { db } from '../lib/db';
import { TenantService } from '../lib/services/tenant.service';
import { hashPassword } from 'better-auth/crypto';
import {
  ServiceRequestCategory,
  ServiceRequestStatus,
  AppointmentStatus,
  LineType,
  Prisma,
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

  const batimentAssistantId = process.env.BATIMENT_ASSISTANT_ID || '38a56410-a3b6-49d5-96f1-8cd572b3f81c';

  const callRecord1 = await db.callRecord.upsert({
    where: { vapiCallId: 'call_demo_devis_001' },
    update: {
      assistantId: batimentAssistantId,
      callerNumber: '+33642189073',
    },
    create: {
      businessId: batiment.id,
      vapiCallId: 'call_demo_devis_001',
      assistantId: batimentAssistantId,
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
      address: null,
      postalCode: null,
      email: null,
      formSubmissionData: Prisma.DbNull,
      serviceType: 'Rénovation Salle de Bain & Cuisine',
      message: 'Souhaite refaire le carrelage et la plomberie d’un appartement ancien de 75m². Chantier souhaité début novembre.',
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
    update: {
      assistantId: batimentAssistantId,
      callerNumber: '+33688442211',
    },
    create: {
      businessId: batiment.id,
      vapiCallId: 'call_demo_completed_002',
      assistantId: batimentAssistantId,
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
      serviceType: 'Peinture Intérieure & Parquet',
      message: 'Surface 60m² environ. Accès facile, 2ème étage avec ascenseur.',
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
  // 3. SEED CABINET MICHELLE APPOINTMENTS, PATIENTS, CALLS & PLANNING
  // ==============================================================================

  const michelleAssistantId = process.env.CABINET_ASSISTANT_ID || '97808c43-384a-4f40-a8dd-9149ba4988f5';
  const today = DateTime.now().setZone('Europe/Paris');
  const dateStr = today.toFormat('yyyy-MM-dd');

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

  const patient1 = await db.patient.upsert({
    where: { contactId: contactPatient1.id },
    update: { medicalNotes: 'Suivi post-opératoire (ALD). Pansements réguliers.' },
    create: {
      businessId: michelle.id,
      contactId: contactPatient1.id,
      medicalNotes: 'Suivi post-opératoire (ALD). Pansements réguliers.',
      isAllowlisted: false,
    },
  });

  const callRecordM1 = await db.callRecord.upsert({
    where: { vapiCallId: 'call_demo_michelle_001' },
    update: {
      assistantId: michelleAssistantId,
      callerNumber: '+33612850101',
    },
    create: {
      businessId: michelle.id,
      vapiCallId: 'call_demo_michelle_001',
      assistantId: michelleAssistantId,
      contactId: contactPatient1.id,
      callerNumber: '+33612850101',
      summary: 'Appel entrant de Mme Curie pour réfection de pansement complexe prescrit post-chirurgie.',
      structuredData: {
        name: 'Marie Curie',
        motif: 'Pansement lourd et complexe',
      },
    },
  });

  const appt1Start = today.set({ hour: 9, minute: 30, second: 0, millisecond: 0 }).toJSDate();
  const appt1End = today.set({ hour: 10, minute: 30, second: 0, millisecond: 0 }).toJSDate();

  await db.appointment.upsert({
    where: { id: 'appt_demo_01' },
    update: {
      date: dateStr,
      time: '09h30',
      startTime: appt1Start,
      endTime: appt1End,
      serviceType: 'Pansement lourd et complexe',
      status: AppointmentStatus.CONFIRMED,
      urgency: false,
      patientId: patient1.id,
      callRecordId: callRecordM1.id,
      notes: 'Changement de pansement post-chirurgie. Ordonnance ALD présente.',
    },
    create: {
      id: 'appt_demo_01',
      businessId: michelle.id,
      contactId: contactPatient1.id,
      patientId: patient1.id,
      callRecordId: callRecordM1.id,
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

  const patient2 = await db.patient.upsert({
    where: { contactId: contactPatient2.id },
    update: { medicalNotes: 'Diabète de type 2. Injection et glycémie capillaire quotidiennes.' },
    create: {
      businessId: michelle.id,
      contactId: contactPatient2.id,
      medicalNotes: 'Diabète de type 2. Injection et glycémie capillaire quotidiennes.',
      isAllowlisted: false,
    },
  });

  const callRecordM2 = await db.callRecord.upsert({
    where: { vapiCallId: 'call_demo_michelle_002' },
    update: {
      assistantId: michelleAssistantId,
      callerNumber: '+33612850202',
    },
    create: {
      businessId: michelle.id,
      vapiCallId: 'call_demo_michelle_002',
      assistantId: michelleAssistantId,
      contactId: contactPatient2.id,
      callerNumber: '+33612850202',
      summary: 'Passage quotidien pour surveillance glycémie et injection insuline rapide.',
      structuredData: {
        name: 'Robert Desnos',
        motif: 'Injection d’insuline',
      },
    },
  });

  const appt2Start = today.set({ hour: 11, minute: 0, second: 0, millisecond: 0 }).toJSDate();
  const appt2End = today.set({ hour: 11, minute: 45, second: 0, millisecond: 0 }).toJSDate();

  await db.appointment.upsert({
    where: { id: 'appt_demo_02' },
    update: {
      date: dateStr,
      time: '11h00',
      startTime: appt2Start,
      endTime: appt2End,
      serviceType: 'Injection d’insuline & surveillance glycémie',
      status: AppointmentStatus.CONFIRMED,
      urgency: false,
      patientId: patient2.id,
      callRecordId: callRecordM2.id,
      notes: 'Passage quotidien 11h.',
    },
    create: {
      id: 'appt_demo_02',
      businessId: michelle.id,
      contactId: contactPatient2.id,
      patientId: patient2.id,
      callRecordId: callRecordM2.id,
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
    update: {
      date: dateStr,
      time: '12h30',
      startTime: block1Start,
      endTime: block1End,
      serviceType: 'INDISPONIBLE: Pause Déjeuner & Pharmacie',
      status: AppointmentStatus.CONFIRMED,
      urgency: false,
      notes: 'Créneau bloqué pour réapprovisionnement matériel et repas.',
    },
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

  const patient3 = await db.patient.upsert({
    where: { contactId: contactPatient3.id },
    update: { medicalNotes: 'Perfusion IV d’antibiotiques post-sortie de clinique.' },
    create: {
      businessId: michelle.id,
      contactId: contactPatient3.id,
      medicalNotes: 'Perfusion IV d’antibiotiques post-sortie de clinique.',
      isAllowlisted: false,
    },
  });

  const callRecordM3 = await db.callRecord.upsert({
    where: { vapiCallId: 'call_demo_michelle_003' },
    update: {
      assistantId: michelleAssistantId,
      callerNumber: '+33612850303',
    },
    create: {
      businessId: michelle.id,
      vapiCallId: 'call_demo_michelle_003',
      assistantId: michelleAssistantId,
      contactId: contactPatient3.id,
      callerNumber: '+33612850303',
      summary: 'Sortie de clinique ce matin. Prescription urgente de pose de perfusion sous 2h.',
      structuredData: {
        name: 'Camille Claudel',
        motif: 'Urgence Perfusion',
      },
    },
  });

  const appt3Start = today.set({ hour: 14, minute: 0, second: 0, millisecond: 0 }).toJSDate();
  const appt3End = today.set({ hour: 14, minute: 45, second: 0, millisecond: 0 }).toJSDate();

  await db.appointment.upsert({
    where: { id: 'appt_demo_03' },
    update: {
      date: dateStr,
      time: '14h00',
      startTime: appt3Start,
      endTime: appt3End,
      serviceType: 'Urgence: Perfusion antibiotique',
      status: AppointmentStatus.CONFIRMED_URGENT,
      urgency: true,
      patientId: patient3.id,
      callRecordId: callRecordM3.id,
      notes: 'Patient sorti de clinique ce matin. Perfusion à poser sans délai.',
    },
    create: {
      id: 'appt_demo_03',
      businessId: michelle.id,
      contactId: contactPatient3.id,
      patientId: patient3.id,
      callRecordId: callRecordM3.id,
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
    update: {
      date: dateStr,
      time: '15h00',
      startTime: block2Start,
      endTime: block2End,
      serviceType: 'INDISPONIBLE: Tournée Secteur Nord',
      status: AppointmentStatus.CONFIRMED,
      urgency: false,
      notes: 'Déplacements secteur excentré.',
    },
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

  const patient4 = await db.patient.upsert({
    where: { contactId: contactPatient4.id },
    update: { medicalNotes: 'Contrôle tensionnel semestriel et ordonnance bilan sanguin.' },
    create: {
      businessId: michelle.id,
      contactId: contactPatient4.id,
      medicalNotes: 'Contrôle tensionnel semestriel et ordonnance bilan sanguin.',
      isAllowlisted: false,
    },
  });

  const callRecordM4 = await db.callRecord.upsert({
    where: { vapiCallId: 'call_demo_michelle_004' },
    update: {
      assistantId: michelleAssistantId,
      callerNumber: '+33612850404',
    },
    create: {
      businessId: michelle.id,
      vapiCallId: 'call_demo_michelle_004',
      assistantId: michelleAssistantId,
      contactId: contactPatient4.id,
      callerNumber: '+33612850404',
      summary: 'Prise de rendez-vous pour prise de sang à jeun. SMS de confirmation envoyé.',
      structuredData: {
        name: 'Antoine de Saint-Exupéry',
        motif: 'Prise de sang',
      },
    },
  });

  const appt4Start = today.set({ hour: 16, minute: 30, second: 0, millisecond: 0 }).toJSDate();
  const appt4End = today.set({ hour: 17, minute: 15, second: 0, millisecond: 0 }).toJSDate();

  await db.appointment.upsert({
    where: { id: 'appt_demo_04' },
    update: {
      date: dateStr,
      time: '16h30',
      startTime: appt4Start,
      endTime: appt4End,
      serviceType: 'Bilan tensionnel et prise de sang',
      status: AppointmentStatus.PENDING,
      urgency: false,
      patientId: patient4.id,
      callRecordId: callRecordM4.id,
      notes: 'SMS de confirmation envoyé à l’infirmière. En attente de réponse OUI/NON.',
    },
    create: {
      id: 'appt_demo_04',
      businessId: michelle.id,
      contactId: contactPatient4.id,
      patientId: patient4.id,
      callRecordId: callRecordM4.id,
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

  // ==============================================================================
  // 4. SEED BETTER AUTH USERS & CREDENTIAL ACCOUNTS (NATIVE SCRYPT HASHING)
  // ==============================================================================

  const usersToSeed = [
    {
      name: 'Super Administrateur',
      email: 'admin@moncabinet.fr',
      password: 'AdminPassword2026!',
      role: 'ADMIN',
      assignedBusiness: 'ALL',
      allowedSections: 'ALL',
    },
    {
      name: 'Cabinet Michelle',
      email: 'michelle@moncabinet.fr',
      password: 'MichellePassword2026!',
      role: 'USER',
      assignedBusiness: 'CABINET_MICHELLE',
      allowedSections: 'overview,calendar,appointments,calls',
    },
    {
      name: 'Dani Bâtiment',
      email: 'dani@danibatiment.fr',
      password: 'DaniPassword2026!',
      role: 'USER',
      assignedBusiness: 'DANI_BATIMENT',
      allowedSections: 'overview,requests,calls',
    },
  ];

  for (const u of usersToSeed) {
    // Generate native Better Auth scrypt hash
    const hashedPassword = await hashPassword(u.password);

    // Upsert User model
    const user = await db.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        emailVerified: true,
        role: u.role,
        assignedBusiness: u.assignedBusiness,
        allowedSections: u.allowedSections,
      },
      create: {
        name: u.name,
        email: u.email,
        emailVerified: true,
        role: u.role,
        assignedBusiness: u.assignedBusiness,
        allowedSections: u.allowedSections,
      },
    });

    // Upsert Better Auth credential Account model linked to this User
    const existingAccount = await db.account.findFirst({
      where: {
        userId: user.id,
        providerId: 'credential',
      },
    });

    if (existingAccount) {
      await db.account.update({
        where: { id: existingAccount.id },
        data: {
          password: hashedPassword,
          accountId: user.id,
        },
      });
    } else {
      await db.account.create({
        data: {
          userId: user.id,
          providerId: 'credential',
          accountId: user.id,
          password: hashedPassword,
        },
      });
    }

    console.log(`✓ Account configured: ${u.email} -> Business: [${u.assignedBusiness}], Sections: [${u.allowedSections}]`);
  }

  console.log('✓ Cabinet Michelle calendar planning seeded with 6 appointments & blocks:');
  console.log('  -> Planning URL: /dashboard?tab=calendar');
  console.log('  -> iCal Feed:    /api/calendar/michelle.ics');
  console.log('  -> Login URL:    /login');
  console.log('🎉 Seed completed successfully!');
}

seedExamples()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seed error:', err);
    process.exit(1);
  });

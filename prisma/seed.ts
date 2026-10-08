import { db } from '../src/lib/db';

async function seed() {
  console.log('🌱 Starting database seed...');

  // 1. Business: Cabinet Michelle
  const cabinetMichelle = await db.business.upsert({
    where: { slug: 'CABINET_MICHELLE' },
    update: {
      name: 'Cabinet Michelle',
      businessType: 'HEALTHCARE',
      timezone: 'Europe/Paris',
      inboundPhoneNumber: process.env.CABINET_INBOUND_PHONE || '+33939033663',
      alertPhoneNumber: process.env.NURSE_ALERT_PHONE_NUMBER || '+33612857915',
      calendarId: process.env.CABINET_CALENDAR_ID || 'monaldi2b@gmail.com',
    },
    create: {
      slug: 'CABINET_MICHELLE',
      name: 'Cabinet Michelle',
      businessType: 'HEALTHCARE',
      timezone: 'Europe/Paris',
      inboundPhoneNumber: process.env.CABINET_INBOUND_PHONE || '+33939033663',
      alertPhoneNumber: process.env.NURSE_ALERT_PHONE_NUMBER || '+33612857915',
      calendarId: process.env.CABINET_CALENDAR_ID || 'monaldi2b@gmail.com',
    },
  });

  // Assistant Cabinet Michelle
  await db.assistantConfig.upsert({
    where: { assistantId: '97808c43-384a-4f40-a8dd-9149ba4988f5' },
    update: {
      businessId: cabinetMichelle.id,
      name: 'Assistant Cabinet Michelle',
      workflowType: 'PATIENT_CARE',
    },
    create: {
      assistantId: '97808c43-384a-4f40-a8dd-9149ba4988f5',
      businessId: cabinetMichelle.id,
      name: 'Assistant Cabinet Michelle',
      workflowType: 'PATIENT_CARE',
    },
  });

  // Whitelist for Cabinet Michelle
  await db.callerAllowlist.upsert({
    where: {
      businessId_phoneNumber: {
        businessId: cabinetMichelle.id,
        phoneNumber: '+33612857915',
      },
    },
    update: { active: true, label: 'Infirmière Michelle (Whitelist)' },
    create: {
      businessId: cabinetMichelle.id,
      phoneNumber: '+33612857915',
      label: 'Infirmière Michelle (Whitelist)',
      active: true,
    },
  });

  // Sample existing patient
  const contactJean = await db.contact.upsert({
    where: {
      businessId_phoneNumber: {
        businessId: cabinetMichelle.id,
        phoneNumber: '+33601020304',
      },
    },
    update: {
      name: 'Jean Dupont',
      address: '12 rue de la Paix',
      postalCode: '75001',
      city: 'Paris',
      lineType: 'MOBILE',
    },
    create: {
      businessId: cabinetMichelle.id,
      name: 'Jean Dupont',
      phoneNumber: '+33601020304',
      address: '12 rue de la Paix',
      postalCode: '75001',
      city: 'Paris',
      lineType: 'MOBILE',
    },
  });

  const patientJean = await db.patient.upsert({
    where: { contactId: contactJean.id },
    update: { medicalNotes: 'Prise de sang régulière' },
    create: {
      businessId: cabinetMichelle.id,
      contactId: contactJean.id,
      medicalNotes: 'Prise de sang régulière',
    },
  });

  // Sample past appointment for Jean
  const existingAppt = await db.appointment.findFirst({
    where: {
      businessId: cabinetMichelle.id,
      contactId: contactJean.id,
    },
  });

  if (!existingAppt) {
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + 1);
    startTime.setHours(10, 0, 0, 0);
    const endTime = new Date(startTime);
    endTime.setHours(11, 0, 0, 0);

    await db.appointment.create({
      data: {
        businessId: cabinetMichelle.id,
        contactId: contactJean.id,
        patientId: patientJean.id,
        serviceType: 'Prise de sang',
        date: startTime.toISOString().split('T')[0],
        time: '10h00',
        startTime,
        endTime,
        status: 'CONFIRMED',
      },
    });
  }

  // 2. Business: Dani Bâtiment
  const daniBatiment = await db.business.upsert({
    where: { slug: 'DANI_BATIMENT' },
    update: {
      name: 'Dani Bâtiment',
      businessType: 'BUILDING_SERVICES',
      timezone: 'Europe/Paris',
      outboundPhoneNumber: process.env.BATIMENT_OUTBOUND_PHONE || '+33939036462',
      alertPhoneNumber: process.env.BATIMENT_ALERT_PHONE_NUMBER || '+33612857915',
      formUrl:
        process.env.JOTFORM_FORM_URL ||
        'https://form.jotform.com/260901590611047?callId={callId}',
    },
    create: {
      slug: 'DANI_BATIMENT',
      name: 'Dani Bâtiment',
      businessType: 'BUILDING_SERVICES',
      timezone: 'Europe/Paris',
      outboundPhoneNumber: process.env.BATIMENT_OUTBOUND_PHONE || '+33939036462',
      alertPhoneNumber: process.env.BATIMENT_ALERT_PHONE_NUMBER || '+33612857915',
      formUrl:
        process.env.JOTFORM_FORM_URL ||
        'https://form.jotform.com/260901590611047?callId={callId}',
    },
  });

  // Assistant Dani Bâtiment
  await db.assistantConfig.upsert({
    where: { assistantId: '38a56410-a3b6-49d5-96f1-8cd572b3f81c' },
    update: {
      businessId: daniBatiment.id,
      name: 'Assistant Dani Bâtiment',
      workflowType: 'BUILDING_SERVICES',
    },
    create: {
      assistantId: '38a56410-a3b6-49d5-96f1-8cd572b3f81c',
      businessId: daniBatiment.id,
      name: 'Assistant Dani Bâtiment',
      workflowType: 'BUILDING_SERVICES',
    },
  });

  // Sample existing contact for Dani Bâtiment
  const contactMarc = await db.contact.upsert({
    where: {
      businessId_phoneNumber: {
        businessId: daniBatiment.id,
        phoneNumber: '+33698765432',
      },
    },
    update: {
      name: 'Marc Martin',
      address: '45 Avenue de la République',
      postalCode: '69001',
      city: 'Lyon',
    },
    create: {
      businessId: daniBatiment.id,
      name: 'Marc Martin',
      phoneNumber: '+33698765432',
      address: '45 Avenue de la République',
      postalCode: '69001',
      city: 'Lyon',
    },
  });

  // Sample service request for Marc
  const existingReq = await db.serviceRequest.findFirst({
    where: {
      businessId: daniBatiment.id,
      contactId: contactMarc.id,
    },
  });

  if (!existingReq) {
    await db.serviceRequest.create({
      data: {
        businessId: daniBatiment.id,
        contactId: contactMarc.id,
        vapiCallId: 'seed-call-marc-001',
        category: 'DEVIS',
        status: 'NOT_COMPLETED',
        serviceType: 'Rénovation Salle de Bain',
        message: 'Demande de devis pour carrelage et plomberie',
        address: '45 Avenue de la République',
        postalCode: '69001',
      },
    });
  }

  console.log('✅ Seed completed successfully!');
}

seed()
  .catch((err) => {
    console.error('❌ Error during database seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

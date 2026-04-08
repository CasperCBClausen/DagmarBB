import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Users ──────────────────────────────────────────────────────────────────

  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dagmarbb.dk' },
    update: { name: 'Administrator', role: UserRole.ADMIN, phone: '+45 12 34 56 78' },
    create: {
      email: 'admin@dagmarbb.dk',
      passwordHash: adminPassword,
      name: 'Administrator',
      role: UserRole.ADMIN,
      phone: '+45 12 34 56 78',
    },
  });
  console.log('Upserted user:', admin.email);

  const cleanerPassword = await bcrypt.hash('cleaner123', 12);
  const cleaner = await prisma.user.upsert({
    where: { email: 'cleaning@dagmarbb.dk' },
    update: { name: 'Rengøringspersonale', role: UserRole.CLEANER },
    create: {
      email: 'cleaning@dagmarbb.dk',
      passwordHash: cleanerPassword,
      name: 'Rengøringspersonale',
      role: UserRole.CLEANER,
    },
  });
  console.log('Upserted user:', cleaner.email);

  // ── Site settings ──────────────────────────────────────────────────────────

  await prisma.siteSettings.upsert({
    where: { key: 'bookingMode' },
    update: {},
    create: { key: 'bookingMode', value: 'manual' },
  });
  console.log('Upserted setting: bookingMode = manual');

  // ── House rules ────────────────────────────────────────────────────────────

  const houseRules = [
    {
      text: 'Rygning forbudt',
      sortOrder: 0,
      translations: {
        da: 'Rygning forbudt',
        en: 'No smoking',
        de: 'Rauchen verboten',
        es: 'Prohibido fumar',
        fr: 'Interdiction de fumer',
        nl: 'Roken verboden',
        it: 'Vietato fumare',
      },
    },
    {
      text: 'Ingen børn under 10 år',
      sortOrder: 1,
      translations: {
        da: 'Ingen børn under 10 år',
        en: 'No children under 10',
        de: 'Keine Kinder unter 10 Jahren',
        es: 'No se admiten niños menores de 10 años',
        fr: 'Aucun enfant de moins de 10 ans',
        nl: 'Geen kinderen onder de 10 jaar',
        it: 'Vietato ai bambini sotto i 10 anni',
      },
    },
    {
      text: 'Stille mellem kl. 22:00 og kl. 06:00',
      sortOrder: 2,
      translations: {
        da: 'Stille mellem kl. 22:00 og kl. 06:00',
        en: 'Silence between 22:00 and 06:00',
        de: 'Stille zwischen 22:00 und 06:00 Uhr',
        es: 'Silencio entre las 22:00 y las 06:00',
        fr: 'Silencieux entre 22h00 et 06h00',
        nl: 'Stilte tussen 22:00 en 06:00',
        it: 'Silenzio tra le 22:00 e le 06:00',
      },
    },
  ];

  for (const rule of houseRules) {
    const existing = await prisma.houseRule.findFirst({ where: { text: rule.text } });
    if (!existing) {
      await prisma.houseRule.create({ data: rule });
    } else {
      await prisma.houseRule.update({ where: { id: existing.id }, data: rule });
    }
  }
  console.log('Upserted house rules');

  // ── Room categories ────────────────────────────────────────────────────────

  const dobbeltTranslations = {
    da: 'Dobbelt værelse',
    en: 'Double room',
    de: 'Doppelzimmer',
    es: 'Habitación doble',
    fr: 'Chambre double',
    nl: 'Tweepersoonskamer',
    it: 'Camera doppia',
  };
  const enkeltTranslations = {
    da: 'Enkelt værelse',
    en: 'Single room',
    de: 'Einzelzimmer',
    es: 'Habitación individual',
    fr: 'Chambre individuelle',
    nl: 'Eenpersoonskamer',
    it: 'Camera singola',
  };

  const dobbeltCat = await prisma.roomCategory.upsert({
    where: { name: 'Dobbelt værelse' },
    update: { translations: dobbeltTranslations },
    create: { name: 'Dobbelt værelse', translations: dobbeltTranslations },
  });
  const enkeltCat = await prisma.roomCategory.upsert({
    where: { name: 'Enkelt værelse' },
    update: { translations: enkeltTranslations },
    create: { name: 'Enkelt værelse', translations: enkeltTranslations },
  });
  console.log('Upserted room categories');

  // ── Rooms ──────────────────────────────────────────────────────────────────

  const rooms: Array<{
    slug: string;
    name: string;
    description: string;
    maxGuests: number;
    amenities: string[];
    images: string[];
    isActive: boolean;
    categoryIds: string[];
  }> = [
    {
      slug: 'dagmar-suite',
      name: 'Dagmar Suite',
      description:
        'Dette er en hel lejlighed med eget køkken og altan, med værelse med udsigt både til Sortebrødre gade og Sct. Catharinæ Kirke Og Kloster. Opkaldt efter den elskede Dronning Dagmar, byder denne lejlighed på en autentisk oplevelse med antikke møbler og moderne bekvemmeligheder.',
      maxGuests: 2,
      amenities: [
        'Kingsize seng',
        'Badeværelse en-suite',
        'Minibar',
        'Smart TV',
        'Gratis WiFi',
        'Udsigt over gamlebyen',
        'Klimaanlæg',
        'Skrivebord',
      ],
      images: ['dagmar-suite-1.jpg', 'dagmar-suite-2.jpg', 'dagmar-suite-3.jpg'],
      isActive: true,
      categoryIds: [dobbeltCat.id],
    },
    {
      slug: 'ribehaus-room',
      name: 'Vægter værelset',
      description:
        'Et hyggeligt og charmerende værelse beliggende i det historiske hus fra 1600-tallet. Originale bjælker og med kig ud i Sortebrødre gade skabes der en autentisk atmosfære midt i Danmarks ældste by.',
      maxGuests: 2,
      amenities: [
        'Dobbeltseng',
        'Badeværelse en-suite',
        'Smart TV',
        'Gratis WiFi',
        'Historisk interiør',
        'Klimaanlæg',
      ],
      images: ['ribehaus-1.jpg', 'ribehaus-2.jpg'],
      isActive: true,
      categoryIds: [dobbeltCat.id],
    },
    {
      slug: 'storke-kammer',
      name: 'Storkekammeret',
      description:
        'Lyst og venligt værelse med udsigt til gårdhaven og det berømte Ribe-storkerede. Perfekt for naturelskere og dem der ønsker en rolig retraite nær Ribe Å.',
      maxGuests: 2,
      amenities: [
        'Dobbeltseng',
        'Badeværelse en-suite',
        'Smart TV',
        'Gratis WiFi',
        'Haveudsigt',
        'Te/kaffefaciliteter',
      ],
      images: ['storke-1.jpg', 'storke-2.jpg'],
      isActive: true,
      categoryIds: [dobbeltCat.id],
    },
    {
      slug: 'catharinvrelset',
      name: 'Catharinæværelset',
      description:
        'Flot lyst værelse, med store vinduer som giver værelset et dejligt lys indfald, med kig ud til den brostensbelagte gade samt Sct. Catharinæ Kirke Og Kloster.',
      maxGuests: 2,
      amenities: ['WiFi', 'Bad', 'Toilet', 'Tekøkken'],
      images: [],
      isActive: true,
      categoryIds: [dobbeltCat.id],
    },
    {
      slug: 'brødre-værelset',
      name: 'Brødre værelset',
      description:
        'Et hyggeligt og charmerende værelse beliggende i det historiske hus fra 1600-tallet. Originale bjælker og teglstensvægge skaber en autentisk atmosfære midt i Danmarks ældste by.',
      maxGuests: 2,
      amenities: ['WiFi', 'Toilet', 'Bad', 'Tekøkken'],
      images: [],
      isActive: true,
      categoryIds: [enkeltCat.id, dobbeltCat.id],
    },
  ];

  for (const { categoryIds, ...roomData } of rooms) {
    const room = await prisma.room.upsert({
      where: { slug: roomData.slug },
      update: roomData,
      create: roomData,
    });

    for (const catId of categoryIds) {
      await prisma.roomRoomCategory.upsert({
        where: { roomId_roomCategoryId: { roomId: room.id, roomCategoryId: catId } },
        update: {},
        create: { roomId: room.id, roomCategoryId: catId },
      });
    }

    await prisma.cleaningStatus.upsert({
      where: { roomId: room.id },
      update: { state: 'CLEAN' },
      create: { roomId: room.id, state: 'CLEAN' },
    });

    console.log('Upserted room:', room.name);
  }

  // ── Charges ────────────────────────────────────────────────────────────────

  const chargeRengoring =
    (await prisma.charge.findFirst({ where: { name: 'standard rengøring' } })) ??
    (await prisma.charge.create({ data: { name: 'standard rengøring', amountDKK: 100 } }));
  const chargeMiljø =
    (await prisma.charge.findFirst({ where: { name: 'miljøafgift' } })) ??
    (await prisma.charge.create({ data: { name: 'miljøafgift', amountDKK: 50 } }));
  console.log('Upserted charges');

  // ── Price categories + days ────────────────────────────────────────────────
  // Dobbelt: standard 500 DKK/night (2026, cancellation 7d)
  //          norefund 5% → 475 DKK/night (2026, no cancellation, min stay 2, min advance 1)
  // Enkelt:  standard 400 DKK/night (2026+2027-01-01, cancellation 7d)
  //          norefund 5% → 380 DKK/night (same range, no cancellation, min stay 2, min advance 1)

  async function upsertPriceCatWithDays(opts: {
    name: string;
    roomCategoryId: string;
    parentId?: string;
    savingsPercent?: number;
    chargeIds?: string[];
    startDate: string;
    endDate: string; // exclusive (last night = endDate - 1)
    pricePerNight: number;
    cancellationDays: number;
    minStayNights: number;
    minAdvanceBookingDays: number;
  }) {
    let cat = await prisma.priceCategory.findFirst({
      where: { name: opts.name, roomCategoryId: opts.roomCategoryId },
    });
    if (!cat) {
      cat = await prisma.priceCategory.create({
        data: {
          name: opts.name,
          roomCategoryId: opts.roomCategoryId,
          parentId: opts.parentId ?? null,
          savingsPercent: opts.savingsPercent ?? null,
        },
      });
    }

    // Attach charges
    if (opts.chargeIds) {
      for (const chargeId of opts.chargeIds) {
        await prisma.priceCategoryCharge.upsert({
          where: { priceCategoryId_chargeId: { priceCategoryId: cat.id, chargeId } },
          update: {},
          create: { priceCategoryId: cat.id, chargeId },
        });
      }
    }

    // Generate day records
    const days: Array<{
      categoryId: string;
      date: Date;
      pricePerNight: number;
      cancellationDays: number;
      minStayNights: number;
      minAdvanceBookingDays: number;
    }> = [];
    const end = new Date(opts.endDate + 'T00:00:00Z');
    for (
      let d = new Date(opts.startDate + 'T00:00:00Z');
      d < end;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      days.push({
        categoryId: cat.id,
        date: new Date(d),
        pricePerNight: opts.pricePerNight,
        cancellationDays: opts.cancellationDays,
        minStayNights: opts.minStayNights,
        minAdvanceBookingDays: opts.minAdvanceBookingDays,
      });
    }
    await prisma.priceCategoryDay.createMany({ data: days, skipDuplicates: true });

    return cat;
  }

  // Dobbelt værelse — standard
  const dobbeltStd = await upsertPriceCatWithDays({
    name: 'standard',
    roomCategoryId: dobbeltCat.id,
    chargeIds: [chargeRengoring.id, chargeMiljø.id],
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    pricePerNight: 500,
    cancellationDays: 7,
    minStayNights: 1,
    minAdvanceBookingDays: 0,
  });

  // Dobbelt værelse — norefund 5%
  await upsertPriceCatWithDays({
    name: 'norefund 5%',
    roomCategoryId: dobbeltCat.id,
    parentId: dobbeltStd.id,
    savingsPercent: 5,
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    pricePerNight: 475,
    cancellationDays: 0,
    minStayNights: 2,
    minAdvanceBookingDays: 1,
  });

  // Enkelt værelse — standard
  const enkeltStd = await upsertPriceCatWithDays({
    name: 'standard',
    roomCategoryId: enkeltCat.id,
    startDate: '2026-01-01',
    endDate: '2027-01-02', // stored last night is 2027-01-01
    pricePerNight: 400,
    cancellationDays: 7,
    minStayNights: 1,
    minAdvanceBookingDays: 0,
  });

  // Enkelt værelse — norefund 5%
  await upsertPriceCatWithDays({
    name: 'norefund 5%',
    roomCategoryId: enkeltCat.id,
    parentId: enkeltStd.id,
    savingsPercent: 5,
    startDate: '2026-01-01',
    endDate: '2027-01-02',
    pricePerNight: 380,
    cancellationDays: 0,
    minStayNights: 2,
    minAdvanceBookingDays: 1,
  });

  console.log('Upserted price categories and days');
  console.log('Seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

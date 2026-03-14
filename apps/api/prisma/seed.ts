import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Users
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

  // Rooms
  const rooms = [
    {
      slug: 'dagmar-suite',
      name: 'Dagmar Suite',
      description: 'Dette er en hel lejlighed med eget køkken og altan, med værelse med udsigt både til Sortebrødre gade og Sct. Catharinæ Kirke Og Kloster. Opkaldt efter den elskede Dronning Dagmar, byder denne lejlighed på en autentisk oplevelse med antikke møbler og moderne bekvemmeligheder.',
      pricePerNight: 1595,
      maxGuests: 2,
      amenities: ['Kingsize seng', 'Badeværelse en-suite', 'Minibar', 'Smart TV', 'Gratis WiFi', 'Udsigt over gamlebyen', 'Klimaanlæg', 'Skrivebord'],
      images: ['dagmar-suite-1.jpg', 'dagmar-suite-2.jpg', 'dagmar-suite-3.jpg'],
      isActive: true,
    },
    {
      slug: 'ribehaus-room',
      name: 'Vægter værelset',
      description: 'Et hyggeligt og charmerende værelse beliggende i det historiske hus fra 1600-tallet. Originale bjælker og med kig ud i Sortebrødre gade skabes der en autentisk atmosfære midt i Danmarks ældste by.',
      pricePerNight: 895,
      maxGuests: 2,
      amenities: ['Dobbeltseng', 'Badeværelse en-suite', 'Smart TV', 'Gratis WiFi', 'Historisk interiør', 'Klimaanlæg'],
      images: ['ribehaus-1.jpg', 'ribehaus-2.jpg'],
      isActive: true,
    },
    {
      slug: 'storke-kammer',
      name: 'Storkekammeret',
      description: 'Lyst og venligt værelse med udsigt til gårdhaven og det berømte Ribe-storkerede. Perfekt for naturelskere og dem der ønsker en rolig retraite nær Ribe Å.',
      pricePerNight: 795,
      maxGuests: 2,
      amenities: ['Dobbeltseng', 'Badeværelse en-suite', 'Smart TV', 'Gratis WiFi', 'Haveudsigt', 'Te/kaffefaciliteter'],
      images: ['storke-1.jpg', 'storke-2.jpg'],
      isActive: true,
    },
    {
      slug: 'catharinvrelset',
      name: 'Catharinæværelset',
      description: 'Flot lyst værelse, med store vinduer som giver værelset et dejligt lys indfald, med kig ud til den brostensbelagte gade samt Sct. Catharinæ Kirke Og Kloster.',
      pricePerNight: 1000,
      maxGuests: 2,
      amenities: ['WiFi', 'Bad', 'Toilet', 'Tekøkken'],
      images: [],
      isActive: true,
    },
    {
      slug: 'brødre-værelset',
      name: 'Brødre værelset',
      description: 'Et hyggeligt og charmerende værelse beliggende i det historiske hus fra 1600-tallet. Originale bjælker og teglstensvægge skaber en autentisk atmosfære midt i Danmarks ældste by.',
      pricePerNight: 800,
      maxGuests: 2,
      amenities: ['WiFi', 'Toilet', 'Bad', 'Tekøkken'],
      images: [],
      isActive: true,
    },
  ];

  for (const roomData of rooms) {
    const room = await prisma.room.upsert({
      where: { slug: roomData.slug },
      update: roomData,
      create: roomData,
    });

    await prisma.cleaningStatus.upsert({
      where: { roomId: room.id },
      update: { state: 'CLEAN' },
      create: { roomId: room.id, state: 'CLEAN' },
    });

    console.log('Upserted room:', room.name);
  }

  console.log('Seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

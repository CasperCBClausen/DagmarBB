import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dagmarbb.dk' },
    update: {},
    create: {
      email: 'admin@dagmarbb.dk',
      passwordHash: adminPassword,
      name: 'Administrator',
      role: UserRole.ADMIN,
      phone: '+45 12 34 56 78',
    },
  });
  console.log('Created admin user:', admin.email);

  // Create cleaner user
  const cleanerPassword = await bcrypt.hash('cleaner123', 12);
  const cleaner = await prisma.user.upsert({
    where: { email: 'cleaning@dagmarbb.dk' },
    update: {},
    create: {
      email: 'cleaning@dagmarbb.dk',
      passwordHash: cleanerPassword,
      name: 'Rengøringspersonale',
      role: UserRole.CLEANER,
    },
  });
  console.log('Created cleaner user:', cleaner.email);

  // Create rooms
  const rooms = [
    {
      slug: 'dagmar-suite',
      name: 'Dagmar Suite',
      description: 'Vores mest luksuriøse værelse med udsigt over den historiske gamle by. Opkaldt efter den elskede Dronning Dagmar, byder dette suite på en kongelig oplevelse med antikke møbler og moderne bekvemmeligheder.',
      pricePerNight: 1295,
      maxGuests: 2,
      amenities: ['Kingsize seng', 'Badeværelse en-suite', 'Minibar', 'Smart TV', 'Gratis WiFi', 'Udsigt over gamlebyen', 'Klimaanlæg', 'Skrivebord'],
      images: ['dagmar-suite-1.jpg', 'dagmar-suite-2.jpg', 'dagmar-suite-3.jpg'],
    },
    {
      slug: 'ribehaus-room',
      name: 'Ribehaus Værelse',
      description: 'Et hyggeligt og charmerende værelse beliggende i det historiske hus fra 1600-tallet. Originale bjælker og teglstensvægge skaber en autentisk atmosfære midt i Danmarks ældste by.',
      pricePerNight: 895,
      maxGuests: 2,
      amenities: ['Dobbeltseng', 'Badeværelse en-suite', 'Smart TV', 'Gratis WiFi', 'Historisk interiør', 'Klimaanlæg'],
      images: ['ribehaus-1.jpg', 'ribehaus-2.jpg'],
    },
    {
      slug: 'storke-kammer',
      name: 'Storkekammeret',
      description: 'Lyst og venligt værelse med udsigt til gårdhaven og det berømte Ribe-storkerede. Perfekt for naturelskere og dem der ønsker en rolig retraite nær Ribe Å.',
      pricePerNight: 795,
      maxGuests: 2,
      amenities: ['Dobbeltseng', 'Badeværelse en-suite', 'Smart TV', 'Gratis WiFi', 'Haveudsigt', 'Te/kaffefaciliteter'],
      images: ['storke-1.jpg', 'storke-2.jpg'],
    },
  ];

  for (const roomData of rooms) {
    const room = await prisma.room.upsert({
      where: { slug: roomData.slug },
      update: {},
      create: roomData,
    });

    // Create initial cleaning status
    await prisma.cleaningStatus.upsert({
      where: { roomId: room.id },
      update: {},
      create: {
        roomId: room.id,
        state: 'CLEAN',
      },
    });

    console.log('Created room:', room.name);
  }

  console.log('Seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

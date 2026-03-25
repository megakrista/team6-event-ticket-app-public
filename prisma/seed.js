require("dotenv/config");

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("../app/generated/prisma");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const venues = [
  {
    id: "a1b2c3d4-0001-4000-8000-000000000001",
    name: "Saku Suurhall",
    address: "Paldiski mnt 104b, Tallinn",
    latitude: 59.422,
    longitude: 24.659,
    timezone: "Europe/Tallinn",
  },
  {
    id: "a1b2c3d4-0002-4000-8000-000000000002",
    name: "Alexela Kontserdimaja",
    address: "Estonia pst 9, Tallinn",
    latitude: 59.4398,
    longitude: 24.7534,
    timezone: "Europe/Tallinn",
  },
  {
    id: "a1b2c3d4-0003-4000-8000-000000000003",
    name: "Vanemuine Teater",
    address: "Vanemuise 6, Tartu",
    latitude: 58.378,
    longitude: 26.7227,
    timezone: "Europe/Tallinn",
  },
  {
    id: "a1b2c3d4-0004-4000-8000-000000000004",
    name: "Noblessner Foundry",
    address: "Peetri 12, Tallinn",
    latitude: 59.4512,
    longitude: 24.7388,
    timezone: "Europe/Tallinn",
  },
];

const adminUser = {
  id: "b1b2c3d4-0001-4000-8000-000000000001",
  email: "admin@ticketmaster.ee",
  passwordHash: "$2b$10$K8jT5xK5xK5xK5xK5xK5xOqP0P0P0P0P0P0P0P0P0P0P0P0P0P0",
  firstName: "Admin",
  lastName: "User",
  role: "ADMIN",
};

const events = [
  {
    id: "c1b2c3d4-0001-4000-8000-000000000001",
    title: "Estonian Philharmonic Chamber Choir",
    description: "Experience the world-renowned Estonian Philharmonic Chamber Choir performing classical masterpieces in an intimate setting.",
    startsAt: new Date("2026-04-15T19:00:00Z"),
    endsAt: new Date("2026-04-15T21:30:00Z"),
    capacity: 500,
    price: 35.00,
    imageUrl: "https://example.com/choir.jpg",
    category: "Classical",
    status: "PUBLISHED",
    venueId: "a1b2c3d4-0002-4000-8000-000000000002",
    createdById: "b1b2c3d4-0001-4000-8000-000000000001",
  },
  {
    id: "c1b2c3d4-0002-4000-8000-000000000002",
    title: "Rock Summer Festival 2026",
    description: "The biggest rock festival in the Baltics featuring international and local rock bands. Three days of non-stop music!",
    startsAt: new Date("2026-06-20T14:00:00Z"),
    endsAt: new Date("2026-06-22T23:00:00Z"),
    capacity: 15000,
    price: 89.99,
    imageUrl: "https://example.com/rock-festival.jpg",
    category: "Rock",
    status: "PUBLISHED",
    venueId: "a1b2c3d4-0001-4000-8000-000000000001",
    createdById: "b1b2c3d4-0001-4000-8000-000000000001",
  },
  {
    id: "c1b2c3d4-0003-4000-8000-000000000003",
    title: "Comedy Night with Local Talent",
    description: "Laugh out loud with Estonia's best stand-up comedians. An evening of humor and entertainment for the whole family.",
    startsAt: new Date("2026-05-10T20:00:00Z"),
    endsAt: new Date("2026-05-10T22:30:00Z"),
    capacity: 300,
    price: 25.00,
    imageUrl: "https://example.com/comedy.jpg",
    category: "Comedy",
    status: "PUBLISHED",
    venueId: "a1b2c3d4-0003-4000-8000-000000000003",
    createdById: "b1b2c3d4-0001-4000-8000-000000000001",
  },
  {
    id: "c1b2c3d4-0004-4000-8000-000000000004",
    title: "Electronic Music Night",
    description: "Underground electronic music event featuring local and international DJs in a unique industrial setting.",
    startsAt: new Date("2026-07-05T22:00:00Z"),
    endsAt: new Date("2026-07-06T04:00:00Z"),
    capacity: 800,
    price: 45.00,
    imageUrl: "https://example.com/electronic.jpg",
    category: "Electronic",
    status: "PUBLISHED",
    venueId: "a1b2c3d4-0004-4000-8000-000000000004",
    createdById: "b1b2c3d4-0001-4000-8000-000000000001",
  },
  {
    id: "c1b2c3d4-0005-4000-8000-000000000005",
    title: "Jazz & Wine Evening",
    description: "Smooth jazz performances paired with fine Estonian wines. A sophisticated evening for music and wine lovers.",
    startsAt: new Date("2026-08-12T18:30:00Z"),
    endsAt: new Date("2026-08-12T23:00:00Z"),
    capacity: 200,
    price: 55.00,
    imageUrl: null,
    category: "Jazz",
    status: "PUBLISHED",
    venueId: "a1b2c3d4-0002-4000-8000-000000000002",
    createdById: "b1b2c3d4-0001-4000-8000-000000000001",
  },
  {
    id: "c1b2c3d4-0006-4000-8000-000000000006",
    title: "Children's Musical Theater",
    description: "A magical musical performance for children featuring beloved fairy tale characters. Perfect for ages 4-10.",
    startsAt: new Date("2026-09-15T15:00:00Z"),
    endsAt: new Date("2026-09-15T16:30:00Z"),
    capacity: 250,
    price: 15.00,
    imageUrl: "https://example.com/kids-theater.jpg",
    category: "Theater",
    status: "DRAFT",
    venueId: "a1b2c3d4-0003-4000-8000-000000000003",
    createdById: "b1b2c3d4-0001-4000-8000-000000000001",
  },
];

async function main() {
  // Seed venues
  for (const venue of venues) {
    await prisma.venue.upsert({
      where: { id: venue.id },
      update: {},
      create: venue,
    });
  }
  console.log(`Seeded ${venues.length} venues.`);

  // Seed admin user
  await prisma.user.upsert({
    where: { id: adminUser.id },
    update: {},
    create: adminUser,
  });
  console.log(`Seeded admin user.`);

  // Seed events
  for (const event of events) {
    await prisma.event.upsert({
      where: { id: event.id },
      update: {},
      create: event,
    });
  }
  console.log(`Seeded ${events.length} events.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

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

async function main() {
  for (const venue of venues) {
    await prisma.venue.upsert({
      where: { id: venue.id },
      update: {},
      create: venue,
    });
  }

  console.log(`Seeded ${venues.length} venues.`);
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

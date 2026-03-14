import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/client";

const adapter = new PrismaPg({ connectionString: "postgresql://postgres:password@localhost:5432/elector" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create a sample election
  const election = await prisma.election.upsert({
    where: { id: "sample-election-1" },
    update: {},
    create: {
      id: "sample-election-1",
      title: "Sample Election 2024",
      description: "A demonstration election for the blockchain voting system",
      startTime: new Date("2024-01-01T00:00:00Z"),
      endTime: new Date("2025-12-31T23:59:59Z"),
      isActive: true,
    },
  });

  console.log("Created election:", election.title);

  // Create sample candidates
  const candidates = [
    {
      id: "candidate-1",
      name: "Alice Johnson",
      description: "Experienced leader with focus on technology and innovation",
    },
    {
      id: "candidate-2",
      name: "Bob Smith",
      description: "Community advocate with strong environmental policies",
    },
    {
      id: "candidate-3",
      name: "Carol Williams",
      description: "Education reformer and economic development expert",
    },
  ];

  for (const candidate of candidates) {
    await prisma.candidate.upsert({
      where: { id: candidate.id },
      update: {},
      create: {
        ...candidate,
        electionId: election.id,
      },
    });
  }

  console.log("Created candidates:", candidates.map(c => c.name));

  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
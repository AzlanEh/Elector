import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/client";

const adapter = new PrismaPg({ connectionString: "postgresql://postgres:password@localhost:5432/elector" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const now = new Date();

  // ── Election 1: Live (General Election) ────────────────────────────────────
  const election1 = await prisma.election.upsert({
    where: { id: "election-general-2026" },
    update: {},
    create: {
      id: "election-general-2026",
      title: "General Assembly Election 2026",
      description:
        "Choose your representative for the 2026 General Assembly. Voting is open to all verified citizens.",
      startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      endTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  });
  console.log("Created:", election1.title);

  const candidates1 = [
    { id: "c1-priya", name: "Priya Sharma", party: "Progressive Alliance", description: "Healthcare and education reform advocate" },
    { id: "c1-rahul", name: "Rahul Mehta", party: "National Development Party", description: "Infrastructure and economic growth champion" },
    { id: "c1-anita", name: "Anita Desai", party: "Green Future Party", description: "Environmental sustainability and clean energy" },
    { id: "c1-suresh", name: "Suresh Patel", party: "Independent", description: "Local governance and anti-corruption" },
  ];
  for (const c of candidates1) {
    await prisma.candidate.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, electionId: election1.id },
    });
  }
  console.log("  Candidates:", candidates1.map((c) => c.name).join(", "));

  // ── Election 2: Live (Municipal) ───────────────────────────────────────────
  const election2 = await prisma.election.upsert({
    where: { id: "election-municipal-2026" },
    update: {},
    create: {
      id: "election-municipal-2026",
      title: "Municipal Corporation Election",
      description:
        "Elect the ward councilor for your district. Results determine local infrastructure budget allocation.",
      startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
      endTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
  });
  console.log("Created:", election2.title);

  const candidates2 = [
    { id: "c2-kumar", name: "Vikram Kumar", party: "Citizens Forum", description: "Road and water supply focus" },
    { id: "c2-nisha", name: "Nisha Joshi", party: "Welfare Party", description: "Women and youth empowerment" },
    { id: "c2-arun", name: "Arun Krishnan", party: "Independent", description: "Digital governance and transparency" },
  ];
  for (const c of candidates2) {
    await prisma.candidate.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, electionId: election2.id },
    });
  }
  console.log("  Candidates:", candidates2.map((c) => c.name).join(", "));

  // ── Election 3: Upcoming ───────────────────────────────────────────────────
  const election3 = await prisma.election.upsert({
    where: { id: "election-state-2026" },
    update: {},
    create: {
      id: "election-state-2026",
      title: "State Legislative Assembly 2026",
      description: "Upcoming state assembly election. Registration is now open.",
      startTime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
      endTime: new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000), // 2 days of voting
    },
  });
  console.log("Created:", election3.title);

  const candidates3 = [
    { id: "c3-deepa", name: "Deepa Nair", party: "Democratic Front", description: "Former IAS officer" },
    { id: "c3-mohan", name: "Mohan Reddy", party: "People's Power Party", description: "Farmer rights activist" },
    { id: "c3-kavya", name: "Kavya Iyer", party: "Reform India", description: "Tech entrepreneur turned politician" },
  ];
  for (const c of candidates3) {
    await prisma.candidate.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, electionId: election3.id },
    });
  }
  console.log("  Candidates:", candidates3.map((c) => c.name).join(", "));

  // ── Election 4: Past ───────────────────────────────────────────────────────
  const election4 = await prisma.election.upsert({
    where: { id: "election-panchayat-2025" },
    update: {},
    create: {
      id: "election-panchayat-2025",
      title: "Gram Panchayat Election 2025",
      description: "Completed village council election. Results are final.",
      startTime: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      endTime: new Date(now.getTime() - 58 * 24 * 60 * 60 * 1000),   // 58 days ago
    },
  });
  console.log("Created:", election4.title);

  const candidates4 = [
    { id: "c4-ravi", name: "Ravi Shankar", party: "Village Progress Party", description: null },
    { id: "c4-meena", name: "Meena Kumari", party: "Independent", description: null },
  ];
  for (const c of candidates4) {
    await prisma.candidate.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, electionId: election4.id },
    });
  }
  console.log("  Candidates:", candidates4.map((c) => c.name).join(", "));

  console.log("\nSeeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

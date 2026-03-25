import { env } from "@elector/env/server";

import { PrismaClient } from "../prisma/generated/client";

const prisma = new PrismaClient();

export default prisma;

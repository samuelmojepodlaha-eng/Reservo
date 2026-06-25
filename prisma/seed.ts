import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await hash("heslo123", 12);

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "demo-restauracia" },
    update: { password: hashedPassword },
    create: {
      slug: "demo-restauracia",
      name: "Demo Reštaurácia",
      address: "Václavské náměstí 1, Praha",
      phone: "+420 777 123 456",
      email: "demo@rezervo.cz",
      password: hashedPassword,
      depositAmount: 100000,
      cancellationHours: 24,
      tables: {
        create: [
          { name: "Stôl 1", capacity: 2 },
          { name: "Stôl 2", capacity: 4 },
          { name: "Stôl 3", capacity: 4 },
          { name: "Terasa A", capacity: 6 },
          { name: "Salónik", capacity: 8 },
        ],
      },
    },
  });

  console.log(`Reštaurácia: ${restaurant.slug}`);
  console.log(`Login: demo@rezervo.cz / heslo123`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import { db } from '@/database/db';
import { universities } from '@/database/schema';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  console.log('Resolved URL in script:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
  const univs = await db.select().from(universities);
  console.log('Universities:', univs);
}

main().catch(console.error);









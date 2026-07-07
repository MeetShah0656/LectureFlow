import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/database/db';
import { users } from '@/database/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    console.log('Exchanging auth code for session...');
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Supabase code exchange error:', error);
    }
    if (!error && data.user) {
      try {
        // Query database to see if onboarding is completed
        const profile = await db.query.users.findFirst({
          where: eq(users.id, data.user.id),
        });

        if (!profile || !profile.onboardingCompleted) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
        return NextResponse.redirect(`${origin}${next}`);
      } catch (dbError) {
        console.error('Database check error during login callback:', dbError);
        // Fall back to onboarding if database is not reachable (or before table creations)
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth-failed`);
}

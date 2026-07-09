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
          const redirectResponse = NextResponse.redirect(`${origin}/onboarding`);
          redirectResponse.cookies.set('onboarding_completed', 'false', { path: '/' });
          return redirectResponse;
        }
        const redirectResponse = NextResponse.redirect(`${origin}${next}`);
        redirectResponse.cookies.set('onboarding_completed', 'true', {
          maxAge: 60 * 60 * 24 * 365,
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
        return redirectResponse;
      } catch (dbError) {
        console.error('Database check error during login callback:', dbError);
        // Fall back to onboarding if database is not reachable (or before table creations)
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth-failed`);
}

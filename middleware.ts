import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase config is missing (e.g. during build or before setup), bypass middleware check
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthPage = request.nextUrl.pathname.startsWith('/auth');
  const isOnboardingPage = request.nextUrl.pathname.startsWith('/onboarding');
  const isDashboardPage = request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname === '/';

  // Bypass checks for api routes that are not protected
  if (request.nextUrl.pathname.startsWith('/api/public')) {
    return response;
  }

  if (!user) {
    if (isDashboardPage || isOnboardingPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      const redirectResponse = NextResponse.redirect(url);
      // Clear onboarding status cookie on logout/unauthenticated
      redirectResponse.cookies.delete('onboarding_completed');
      return redirectResponse;
    }
    return response;
  }

  // ─── Performance Cache Check ───────────────────────────────────────────────
  // We check a cookie to see if onboarding is completed.
  // This completely eliminates one database query per page navigation!
  let onboardingCompleted = request.cookies.get('onboarding_completed')?.value === 'true';

  if (user && !onboardingCompleted) {
    const { data: profile } = await supabase
      .from('users')
      .select('onboarding_completed')
      .eq('id', user.id)
      .maybeSingle();

    onboardingCompleted = profile?.onboarding_completed ?? false;

    if (onboardingCompleted) {
      // Cache this value in a cookie so subsequent page navigations bypass the DB query
      response.cookies.set('onboarding_completed', 'true', {
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }
  }

  if (!onboardingCompleted) {
    if (isDashboardPage && !isOnboardingPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      const redirectResponse = NextResponse.redirect(url);
      redirectResponse.cookies.set('onboarding_completed', 'false', { path: '/' });
      return redirectResponse;
    }
  } else {
    if (isAuthPage || isOnboardingPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      const redirectResponse = NextResponse.redirect(url);
      redirectResponse.cookies.set('onboarding_completed', 'true', {
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
      return redirectResponse;
    }
  }

  // Redirect root path to dashboard if logged in and onboarded
  if (request.nextUrl.pathname === '/' && user && onboardingCompleted) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.cookies.set('onboarding_completed', 'true', {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (optional, adjust depending on needs)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

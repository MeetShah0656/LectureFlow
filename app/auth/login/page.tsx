'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Sparkles, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err) {
      const error = err as Error;
      console.error(error);
      setErrorMsg(error.message || 'Failed to initialize Google login');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-neutral-50 to-neutral-200 dark:from-neutral-950 dark:to-neutral-900 p-4 transition-colors duration-300">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="border-border/80 bg-card/60 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="text-center pt-8">
            <div className="mx-auto p-3 bg-primary/10 rounded-2xl w-fit text-primary mb-3">
              <Sparkles className="h-6 w-6" />
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight select-none">
              LectureFlow
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground select-none mt-1">
              Your Apple-inspired native academic companion
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 px-8 pb-6">
            <p className="text-center text-xs text-muted-foreground select-none">
              Track attendance, navigate your schedules, and manage your course syllabus. No password needed.
            </p>

            {errorMsg && (
              <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-center">
                {errorMsg}
              </div>
            )}

            <Button
              variant="default"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-11 flex items-center justify-center space-x-2 text-sm font-semibold rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Redirecting to Google...</span>
                </>
              ) : (
                <>
                  {/* Google SVG Icon */}
                  <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                </>
              )}
            </Button>
          </CardContent>

          <CardFooter className="bg-muted/30 border-t border-border/50 py-4 px-8 text-center">
            <span className="text-[10px] text-muted-foreground w-full select-none">
              By signing in, you agree to our Terms of Service and Academic Regulations.
            </span>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

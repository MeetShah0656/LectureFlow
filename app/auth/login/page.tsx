'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, CheckCircle2, Calendar, BookOpen, Clock } from 'lucide-react';

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

  const features = [
    {
      icon: Clock,
      title: 'Smart Attendance Tracker',
      desc: 'Mark presence with a single tap, track history, and monitor safety margins.',
    },
    {
      icon: Calendar,
      title: 'Substitute Lecture Sync',
      desc: 'Easily update schedules when faculty changes. Overrides apply date-wise.',
    },
    {
      icon: BookOpen,
      title: 'Syllabus Companion',
      desc: 'Keep track of topics covered and follow academic course progress.',
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-neutral-50 via-neutral-100 to-neutral-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 transition-colors duration-300 relative overflow-hidden">
      {/* Background grid pattern & blur meshes */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800b_1px,transparent_1px),linear-gradient(to_bottom,#8080800b_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_80%,transparent_100%)] pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-xl relative z-10"
      >
        <Card className="border-border/60 bg-card/75 dark:bg-card/40 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="text-center pt-8 pb-4">
            <div className="mx-auto p-3.5 bg-primary/10 rounded-2xl w-fit text-primary mb-4 shadow-inner">
              <Sparkles className="h-6 w-6" />
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight select-none">
              LectureFlow
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground select-none mt-1.5 max-w-md mx-auto">
              Your Apple-inspired native academic companion for attendance & timetable scheduling.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-6 sm:px-10 pb-6">
            {/* Features List */}
            <div className="space-y-4 py-2 border-y border-border/30">
              {features.map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <div key={idx} className="flex items-start space-x-3.5">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0 mt-0.5">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-semibold text-foreground/90">{feat.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{feat.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {errorMsg && (
              <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-center font-medium animate-in fade-in">
                {errorMsg}
              </div>
            )}

            <Button
              variant="default"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-12 flex items-center justify-center space-x-2.5 text-sm font-bold rounded-2xl shadow-lg shadow-primary/10"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Redirecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="h-4.5 w-4.5 mr-1" viewBox="0 0 24 24">
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

          <CardFooter className="bg-muted/20 border-t border-border/30 py-4 px-6 text-center">
            <span className="text-[10px] text-muted-foreground w-full select-none leading-normal">
              Protected by Supabase Auth. By signing in, you agree to our Terms of Service and Academic Regulations.
            </span>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

'use client';

import * as React from 'react';
import { HTMLMotionProps, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ' +
      'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
      'focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer';

    const variants: Record<string, string> = {
      default:     'bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90',
      destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
      outline:     'border border-border bg-background hover:bg-muted hover:text-foreground',
      secondary:   'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      ghost:       'hover:bg-muted hover:text-foreground',
      link:        'text-primary underline-offset-4 hover:underline p-0 h-auto',
    };

    const sizes: Record<string, string> = {
      default: 'h-10 px-4 py-2.5',
      sm:      'h-8 px-3 text-xs rounded-lg',
      lg:      'h-12 px-6 text-base rounded-2xl',
      icon:    'h-9 w-9 rounded-xl',
    };

    return (
      <motion.button
        ref={ref}
        type={type}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };

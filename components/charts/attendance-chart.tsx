'use client';

import * as React from 'react';
import { ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts';

interface AttendanceChartProps {
  percentage: number;
}

export function AttendanceChart({ percentage }: AttendanceChartProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return (
      <div className="h-40 w-full flex items-center justify-center">
        <div className="animate-pulse bg-muted/50 rounded-full h-28 w-28" />
      </div>
    );
  }

  // Map to chart values
  const data = [
    {
      name: 'Attendance',
      value: percentage,
      fill: percentage >= 75 ? '#007aff' : '#ff9500', // Apple blue vs warning orange
    },
  ];

  return (
    <div className="h-40 w-full flex items-center justify-center relative">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="65%"
          outerRadius="85%"
          barSize={12}
          data={data}
          startAngle={90}
          endAngle={90 - (360 * Math.min(percentage, 100) / 100)}
        >
          <RadialBar
            background={{ fill: 'rgba(128,128,128,0.1)' }}
            dataKey="value"
            cornerRadius={6}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute flex flex-col items-center justify-center select-none">
        <span className="text-3xl font-extrabold tracking-tight">{percentage}%</span>
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mt-0.5">Overall</span>
      </div>
    </div>
  );
}

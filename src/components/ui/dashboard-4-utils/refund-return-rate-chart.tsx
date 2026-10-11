"use client";

import React, { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { Transaction } from "@/types/library";

const chartConfig: ChartConfig = {
  onTime: {
    label: "On-Time Returns",
    color: "#0EA5E9", // sky-500
  },
  overdue: {
    label: "Overdue Notices",
    color: "#F43F5E", // rose-500
  },
};

interface RefundReturnRateChartProps {
  transactions?: Transaction[];
}

export function RefundReturnRateChart({ transactions = [] }: RefundReturnRateChartProps) {
  const { returnData, onTimeCount, overdueCount, complianceRate } = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayMs = new Date().getTime();

    const buckets = [
      { bucket: "1-7 Days", onTime: 0, overdue: 0 },
      { bucket: "8-14 Days", onTime: 0, overdue: 0 },
      { bucket: "15-21 Days", onTime: 0, overdue: 0 },
      { bucket: "22-30 Days", onTime: 0, overdue: 0 },
      { bucket: ">30 Days", onTime: 0, overdue: 0 },
    ];

    let totalOnTime = 0;
    let totalOverdue = 0;

    transactions.forEach(t => {
      const issueMs = new Date(t.issue_date || todayStr).getTime();
      const endMs = t.return_date ? new Date(t.return_date).getTime() : todayMs;
      const daysElapsed = Math.max(1, Math.round((endMs - issueMs) / (1000 * 3600 * 24)));

      const isOverdue = 
        t.status === "OVERDUE" || 
        (t.status === "ACTIVE" && t.due_date < todayStr) || 
        (t.return_date !== null && t.return_date > t.due_date);

      let bucketIdx = 0;
      if (daysElapsed <= 7) bucketIdx = 0;
      else if (daysElapsed <= 14) bucketIdx = 1;
      else if (daysElapsed <= 21) bucketIdx = 2;
      else if (daysElapsed <= 30) bucketIdx = 3;
      else bucketIdx = 4;

      if (isOverdue) {
        buckets[bucketIdx].overdue += 1;
        totalOverdue += 1;
      } else {
        buckets[bucketIdx].onTime += 1;
        totalOnTime += 1;
      }
    });

    const totalLoans = totalOnTime + totalOverdue;
    const rate = totalLoans > 0 
      ? ((totalOnTime / totalLoans) * 100).toFixed(1)
      : "100.0";

    return {
      returnData: buckets,
      onTimeCount: totalOnTime,
      overdueCount: totalOverdue,
      complianceRate: rate,
    };
  }, [transactions]);

  return (
    <Card className="col-span-1 md:col-span-1 lg:col-span-1 border-border/60 bg-card/80 backdrop-blur-xs shadow-2xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-sky-500" />
            <span>Loan Compliance & Due Rates</span>
          </CardTitle>
          <Badge 
            variant="outline" 
            className={`font-mono text-[10.5px] ${
              parseFloat(complianceRate) >= 80 
                ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : 'border-rose-500/30 text-rose-600 dark:text-rose-400'
            }`}
          >
            {complianceRate}% On-Time
          </Badge>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Distribution of loan durations before return or fine accrual
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
          <BarChart data={returnData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis
              dataKey="bucket"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-[10px] font-mono"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              allowDecimals={false}
              className="text-[10px] font-mono"
            />
            <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} />
            <Bar dataKey="onTime" fill="#0EA5E9" radius={[4, 4, 0, 0]} stackId="a" isAnimationActive={true} animationDuration={600} animationEasing="ease-out" />
            <Bar dataKey="overdue" fill="#F43F5E" radius={[4, 4, 0, 0]} stackId="a" isAnimationActive={true} animationDuration={600} animationEasing="ease-out" />
          </BarChart>
        </ChartContainer>

        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/50 text-xs">
          <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-center">
            <span className="text-[10.5px] text-muted-foreground block font-medium">On-Time Returns</span>
            <span className="text-base font-bold font-mono text-sky-600 dark:text-sky-400">
              {onTimeCount} items
            </span>
          </div>
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center">
            <span className="text-[10.5px] text-muted-foreground block font-medium">Overdue Loans</span>
            <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-400">
              {overdueCount} items
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

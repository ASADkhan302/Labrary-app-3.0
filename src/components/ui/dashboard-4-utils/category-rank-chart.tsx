"use client";

import React, { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Award } from "lucide-react";
import { Book, Transaction } from "@/types/library";

const chartConfig: ChartConfig = {
  borrowings: {
    label: "Circulation Volume",
    color: "#8B5CF6", // purple-500
  },
};

interface CategoryRankChartProps {
  books?: Book[];
  transactions?: Transaction[];
}

export function CategoryRankChart({ books = [], transactions = [] }: CategoryRankChartProps) {
  const activeBooks = useMemo(() => books.filter(b => b.is_active), [books]);

  const { categoryData, topCategoryName, topCategoryBorrowings, totalCirculation } = useMemo(() => {
    const map = new Map<string, { category: string; borrowings: number; titles: number; copies: number }>();

    // Index all active book categories
    activeBooks.forEach(b => {
      const cat = b.category || "General";
      const cur = map.get(cat) || { category: cat, borrowings: 0, titles: 0, copies: 0 };
      cur.titles += 1;
      cur.copies += b.total_quantity;
      map.set(cat, cur);
    });

    // Map loans to book categories
    const bookCatMap = new Map<string, string>();
    activeBooks.forEach(b => bookCatMap.set(b.id, b.category || "General"));

    let circCount = 0;
    transactions.forEach(t => {
      circCount += 1;
      const cat = bookCatMap.get(t.book_id) || "General";
      const cur = map.get(cat);
      if (cur) {
        cur.borrowings += 1;
      }
    });

    // Sort by borrowings first, then physical copies
    const sorted = Array.from(map.values())
      .sort((a, b) => b.borrowings - a.borrowings || b.copies - a.copies)
      .slice(0, 6);

    const fallback = sorted.length > 0 
      ? sorted 
      : [{ category: "No Data", borrowings: 0, titles: 0, copies: 0 }];

    const top = sorted[0];

    return {
      categoryData: fallback,
      topCategoryName: top ? top.category : "No Active Holdings",
      topCategoryBorrowings: top ? top.borrowings : 0,
      totalCirculation: circCount,
    };
  }, [activeBooks, transactions]);

  const displayedCount = categoryData.filter(c => c.category !== "No Data").length;

  return (
    <Card className="col-span-1 md:col-span-1 lg:col-span-1 border-border/60 bg-card/80 backdrop-blur-xs shadow-2xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-purple-500" />
            <span>Category Demand Ranking</span>
          </CardTitle>
          <Badge variant="outline" className="font-mono text-[10.5px] border-purple-500/30 text-purple-600 dark:text-purple-400">
            {displayedCount > 0 ? `Top ${displayedCount} Disciplines` : "Live Audit"}
          </Badge>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Most circulated academic genres across Lakki Marwat campus
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
          <BarChart 
            layout="vertical" 
            data={categoryData} 
            margin={{ top: 10, right: 10, left: 15, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis type="number" hide />
            <YAxis
              dataKey="category"
              type="category"
              tickLine={false}
              axisLine={false}
              className="text-[10px] font-medium"
              width={85}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Bar dataKey="borrowings" fill="#8B5CF6" radius={[0, 4, 4, 0]} isAnimationActive={true} animationDuration={600} animationEasing="ease-out" />
          </BarChart>
        </ChartContainer>

        <div className="space-y-1.5 mt-3 pt-3 border-t border-border/50 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>Highest Velocity</span>
            </span>
            <span className="font-semibold text-foreground truncate max-w-[170px]" title={topCategoryName}>
              {topCategoryName} ({topCategoryBorrowings} loans)
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Total Logged Circulations</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
              {totalCirculation} total issues
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

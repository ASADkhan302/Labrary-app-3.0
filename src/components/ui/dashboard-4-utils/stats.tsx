import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Layers, Users, AlertTriangle, ArrowUpRight, TrendingUp } from "lucide-react";
import { CountUp } from "@/components/ui/count-up";

interface StatsProps {
  totalBooks?: number;
  totalCopies?: number;
  activeLoans?: number;
  overdueLoans?: number;
}

export function DashboardStats({
  totalBooks = 48,
  totalCopies = 186,
  activeLoans = 24,
  overdueLoans = 3,
}: StatsProps) {
  const stats = [
    {
      title: "Total Catalog Titles",
      num: totalBooks,
      change: "+12.4%",
      trend: "up",
      description: "Active bibliographic records in SQLite",
      icon: BookOpen,
      badge: "In Stock",
    },
    {
      title: "Volumes in Circulation",
      num: totalCopies,
      change: "+8.2%",
      trend: "up",
      description: "Total physical tagged copies",
      icon: Layers,
      badge: "Cataloged",
    },
    {
      title: "Active Borrowers",
      num: activeLoans,
      change: "+18.6%",
      trend: "up",
      description: "Students & faculty with active loans",
      icon: Users,
      badge: "Circulation",
    },
    {
      title: "Overdue Rate",
      num: overdueLoans,
      change: overdueLoans > 0 ? "Action Required" : "Zero Overdue",
      trend: overdueLoans > 0 ? "alert" : "good",
      description: "Items pending immediate return",
      icon: AlertTriangle,
      badge: overdueLoans > 0 ? "Attention" : "All Clear",
    },
  ];

  return (
    <div className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="overflow-hidden border-border/60 bg-card/80 backdrop-blur-xs shadow-2xs hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {stat.title}
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <Icon className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  <CountUp end={stat.num} durationMs={800} />
                </div>
                <Badge
                  variant={stat.trend === "alert" ? "destructive" : "secondary"}
                  className="text-[10.5px] font-medium gap-1"
                >
                  {stat.trend === "up" && <TrendingUp className="w-3 h-3 text-emerald-500" />}
                  {stat.change}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <span>{stat.description}</span>
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

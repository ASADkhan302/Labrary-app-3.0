import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions, ItemGroup, ItemSeparator } from "@/components/ui/item";
import { ArrowRightLeft, UserPlus, QrCode, FileSpreadsheet, Printer, ShieldCheck } from "lucide-react";

interface QuickActionsProps {
  onIssueBook?: () => void;
  onEnrollMember?: () => void;
  onScanBarcode?: () => void;
  onExportCsv?: () => void;
  onPrintAudit?: () => void;
}

export function QuickActions({
  onIssueBook,
  onEnrollMember,
  onScanBarcode,
  onExportCsv,
  onPrintAudit,
}: QuickActionsProps) {
  const actions = [
    {
      title: "Circulation Desk",
      desc: "Fast checkout and return barcode processing station",
      icon: ArrowRightLeft,
      color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
      action: onIssueBook || (() => {}),
      badge: "Hotkey ⌘1",
    },
    {
      title: "Register New Member",
      desc: "Enroll student roll number or faculty library card",
      icon: UserPlus,
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
      action: onEnrollMember || (() => {}),
      badge: "Instant ID",
    },
    {
      title: "Native Barcode Station",
      desc: "High-speed camera and hardware laser scanner testbed",
      icon: QrCode,
      color: "text-sky-500 bg-sky-500/10 border-sky-500/20",
      action: onScanBarcode || (() => {}),
      badge: "C++ Engine",
    },
    {
      title: "Audit & CSV Export",
      desc: "Generate full SQLite inventory ledger and loan records",
      icon: FileSpreadsheet,
      color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
      action: onExportCsv || (() => {}),
      badge: "Excel .CSV",
    },
  ];

  return (
    <Card className="col-span-full border-border/60 bg-card/80 backdrop-blur-xs shadow-2xs">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <span>Library Operations & Station Quick Actions</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Direct operational shortcuts to high-frequency circulation, inventory, and audit tools
          </CardDescription>
        </div>
        <Badge variant="outline" className="font-mono text-[11px] gap-1.5 text-amber-600 dark:text-amber-400 border-amber-500/30">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>ULM Automated Desk</span>
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {actions.map((act, index) => {
            const Icon = act.icon;
            return (
              <div
                key={index}
                onClick={act.action}
                className="group p-3.5 rounded-xl border border-border/70 hover:border-amber-500/50 bg-background/50 hover:bg-amber-500/5 transition-all cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${act.color}`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {act.badge}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground group-hover:text-amber-500 transition-colors">
                    {act.title}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {act.desc}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-xs font-semibold h-8 group-hover:border-amber-500/40 group-hover:bg-amber-500/10 group-hover:text-amber-600 dark:group-hover:text-amber-400"
                >
                  Launch Task
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

import { CategoryRankChart } from "@/components/ui/dashboard-4-utils/category-rank-chart";
import { RefundReturnRateChart } from "@/components/ui/dashboard-4-utils/refund-return-rate-chart";
import { RevenueChart } from "@/components/ui/dashboard-4-utils/revenue-chart";
import { DashboardStats } from "@/components/ui/dashboard-4-utils/stats";
import { Book, Borrower, Transaction } from "@/types/library";

export interface DashboardProps {
  totalBooks?: number;
  totalCopies?: number;
  activeLoans?: number;
  overdueLoans?: number;
  books?: Book[];
  borrowers?: Borrower[];
  transactions?: Transaction[];
  onIssueBook?: () => void;
  onEnrollMember?: () => void;
  onScanBarcode?: () => void;
  onExportCsv?: () => void;
  onPrintAudit?: () => void;
}

export function Dashboard({
  totalBooks,
  totalCopies,
  activeLoans,
  overdueLoans,
  books = [],
  transactions = [],
}: DashboardProps = {}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <DashboardStats 
        totalBooks={totalBooks}
        totalCopies={totalCopies}
        activeLoans={activeLoans}
        overdueLoans={overdueLoans}
      />
      <RevenueChart transactions={transactions} />
      <RefundReturnRateChart transactions={transactions} />
      <CategoryRankChart books={books} transactions={transactions} />
    </div>
  );
}

export default Dashboard;

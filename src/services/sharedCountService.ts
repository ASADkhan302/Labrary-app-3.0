import { Book, Borrower, Transaction } from '../types/library';

export interface LibraryCounts {
  totalTitles: number;
  totalCopies: number;
  copiesOnShelf: number;
  copiesOnLoan: number;
  activeLoans: number;
  overdueLoans: number;
  activeBorrowers: number;
  totalRegisteredBorrowers: number;
  returnedOnTime: number;
  totalReturned: number;
  finesDue: number;
  overdueRatePercent: number;
}

export class SharedCountService {
  /**
   * Computes standardized SQL-aggregate counts across the entire library system.
   * Feeds Sidebar badges, Circulation Desk, Borrowers Directory, Catalog, and Reports.
   */
  static computeCounts(
    books: Book[],
    borrowers: Borrower[],
    transactions: Transaction[],
    currentDate?: string
  ): LibraryCounts {
    const todayStr = currentDate || new Date().toISOString().split('T')[0];

    // 1. Titles & Copies (Active bibliographic records)
    const activeBooks = books.filter(b => b.is_active);
    const totalTitles = activeBooks.length;
    
    let totalCopies = 0;
    let copiesOnShelf = 0;
    for (const b of activeBooks) {
      totalCopies += (b.total_quantity || 0);
      copiesOnShelf += Math.min(b.available_quantity || 0, b.total_quantity || 0);
    }
    const copiesOnLoan = Math.max(0, totalCopies - copiesOnShelf);

    // 2. Loans & Circulation
    let activeLoans = 0;
    let overdueLoans = 0;
    let returnedOnTime = 0;
    let totalReturned = 0;
    let finesDue = 0;

    // Distinct borrowers holding active loans
    const borrowersWithActiveLoans = new Set<string>();

    for (const t of transactions) {
      const isReturned = t.status === 'RETURNED' || Boolean(t.return_date);

      if (isReturned) {
        totalReturned += 1;
        if (t.return_date && t.due_date && t.return_date <= t.due_date) {
          returnedOnTime += 1;
        } else if (!t.return_date) {
          // If marked returned without explicit date
          returnedOnTime += 1;
        }
      } else {
        // Active unreturned loan
        activeLoans += 1;
        if (t.borrower_id) {
          borrowersWithActiveLoans.add(t.borrower_id);
        }

        const isOverdue = t.status === 'OVERDUE' || (t.due_date && t.due_date < todayStr);
        if (isOverdue) {
          overdueLoans += 1;
          // Calculate fine if overdue (Standard campus policy: Rs 10 per day overdue beyond grace)
          if (t.due_date) {
            const daysOver = Math.max(0, Math.floor((new Date(todayStr).getTime() - new Date(t.due_date).getTime()) / (1000 * 3600 * 24)));
            if (daysOver > 0) {
              finesDue += daysOver * 10;
            }
          }
        }
      }
    }

    // 3. Borrowers
    const activeRegisteredBorrowers = borrowers.filter(b => b.is_active).length;
    const activeBorrowersWithLoans = borrowersWithActiveLoans.size;

    // 4. Overdue rate (Overdue loans / Active loans percentage)
    const overdueRatePercent = activeLoans > 0 
      ? Math.round((overdueLoans / activeLoans) * 100) 
      : 0;

    return {
      totalTitles,
      totalCopies,
      copiesOnShelf,
      copiesOnLoan,
      activeLoans,
      overdueLoans,
      activeBorrowers: activeRegisteredBorrowers, // Total active registered library members
      totalRegisteredBorrowers: activeRegisteredBorrowers,
      returnedOnTime,
      totalReturned,
      finesDue,
      overdueRatePercent,
    };
  }
}

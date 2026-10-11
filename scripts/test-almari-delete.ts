import './setup-env';
import { AlmariService } from '../src/services/almariService';
import { LibraryStorage } from '../src/services/storage';
import { Almari, Book } from '../src/types/library';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ ${msg}`);
  }
}

console.log('====================================================');
console.log('🧪 TESTING ALMARI DELETION, BLOCKED MESSAGES & UNDO');
console.log('====================================================\n');

// Initialize storage
LibraryStorage.clearBooksCache();
const initialAlmaris = AlmariService.getAlmaris();
const initialBooks = LibraryStorage.getBooks();

console.log(`Initial active almaris: ${initialAlmaris.filter(a => a.is_active).length}`);
console.log(`Initial books count: ${initialBooks.length}\n`);

// ----------------------------------------------------
// SCENARIO 1: Delete an empty almari & Undo
// ----------------------------------------------------
console.log('--- SCENARIO 1: Delete Empty Almari & Undo ---');
const emptyAlmari = AlmariService.addAlmari({
  code: 'TEST-EMPTY-01',
  name_en: 'Empty Test Cupboard',
  name_ur: 'خالی الماری',
  shelf_count: 4,
  books_per_shelf: 25,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const activeBeforeEmpty = AlmariService.getAlmaris().filter(a => a.is_active).length;
console.log(`Created empty almari: ${emptyAlmari.code} (id: ${emptyAlmari.id})`);
console.log(`Active almaris before delete: ${activeBeforeEmpty}`);

// Delete the empty almari
const delEmptyRes = AlmariService.softDeleteAlmari(emptyAlmari.id, 'unassign', undefined, LibraryStorage.getBooks());
assert(delEmptyRes.success, 'Empty almari softDeleteAlmari returned success');
assert(delEmptyRes.affectedBooksCount === 0, 'Empty almari affectedBooksCount is 0');

const activeAfterEmpty = AlmariService.getAlmaris().filter(a => a.is_active).length;
assert(activeAfterEmpty === activeBeforeEmpty - 1, `Active almaris decreased by 1 (${activeBeforeEmpty} -> ${activeAfterEmpty})`);
const emptyAlmariAfterDel = AlmariService.getAlmaris().find(a => a.id === emptyAlmari.id);
assert(emptyAlmariAfterDel?.is_active === false, 'Empty almari is marked inactive');

// Undo the empty almari deletion
const undoEmptyRes = AlmariService.undoAlmariDeletion(delEmptyRes.batchId, LibraryStorage.getBooks());
assert(undoEmptyRes.success, 'undoAlmariDeletion returned success for empty almari');
const activeAfterUndoEmpty = AlmariService.getAlmaris().filter(a => a.is_active).length;
assert(activeAfterUndoEmpty === activeBeforeEmpty, `Active almaris restored to ${activeBeforeEmpty}`);
const restoredEmptyAlmari = AlmariService.getAlmaris().find(a => a.id === emptyAlmari.id);
assert(restoredEmptyAlmari?.is_active === true, 'Empty almari restored to is_active: true');
console.log('Scenario 1 passed!\n');

// ----------------------------------------------------
// SCENARIO 2: Delete Almari with books MOVED to another Almari & Undo
// ----------------------------------------------------
console.log('--- SCENARIO 2: Delete Almari with Books (Moved to Another Almari) & Undo ---');
const almariA = AlmariService.addAlmari({
  code: 'ALM-SRC-MOVE',
  name_en: 'Source Almari Move',
  name_ur: 'الماری ماخذ',
  shelf_count: 5,
  books_per_shelf: 20,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const almariDest = AlmariService.addAlmari({
  code: 'ALM-DEST-MOVE',
  name_en: 'Destination Almari',
  name_ur: 'الماری منزل',
  shelf_count: 5,
  books_per_shelf: 20,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// Seed books into almariA
let currentBooks = LibraryStorage.getBooks();
const seedBook1: Book = {
  ...currentBooks[0],
  id: 'book-move-1',
  accession_no: 'ACC-M1',
  book_name: 'Moving Chemistry Vol 1',
  almari_id: almariA.id,
  shelf_no: 2,
  is_active: true,
};
const seedBook2: Book = {
  ...currentBooks[0],
  id: 'book-move-2',
  accession_no: 'ACC-M2',
  book_name: 'Moving Physics Vol 2',
  almari_id: almariA.id,
  shelf_no: 4,
  is_active: true,
};
currentBooks = [seedBook1, seedBook2, ...currentBooks];
LibraryStorage.saveBooks(currentBooks);

const bksInSrcBefore = LibraryStorage.getBooks().filter(b => b.almari_id === almariA.id).length;
const bksInDestBefore = LibraryStorage.getBooks().filter(b => b.almari_id === almariDest.id).length;
const activeAlmarisBeforeMove = AlmariService.getAlmaris().filter(a => a.is_active).length;
assert(bksInSrcBefore === 2, 'Almari A has 2 books before deletion');
assert(bksInDestBefore === 0, 'Almari Dest has 0 books before deletion');

// Delete almariA with action 'move' to almariDest
const delMoveRes = AlmariService.softDeleteAlmari(almariA.id, 'move', almariDest.id, LibraryStorage.getBooks());
assert(delMoveRes.success, 'softDeleteAlmari with move succeeded');
assert(delMoveRes.affectedBooksCount === 2, '2 books were affected/moved');

const bksInSrcAfter = LibraryStorage.getBooks().filter(b => b.almari_id === almariA.id).length;
const bksInDestAfter = LibraryStorage.getBooks().filter(b => b.almari_id === almariDest.id).length;
const activeAlmarisAfterMove = AlmariService.getAlmaris().filter(a => a.is_active).length;
assert(bksInSrcAfter === 0, 'Almari A now has 0 books');
assert(bksInDestAfter === 2, 'Almari Dest now has 2 books');
assert(activeAlmarisAfterMove === activeAlmarisBeforeMove - 1, 'Active almaris decreased by 1');

// Verify books in dest have new placement
const movedB1 = LibraryStorage.getBooks().find(b => b.id === 'book-move-1');
assert(movedB1?.almari_id === almariDest.id && movedB1?.shelf_no === 1, 'Book 1 moved to Dest shelf 1');

// Undo the move deletion
const undoMoveRes = AlmariService.undoAlmariDeletion(delMoveRes.batchId, LibraryStorage.getBooks());
assert(undoMoveRes.success, 'undoAlmariDeletion succeeded');
assert(undoMoveRes.restoredBooksCount === 2, '2 books restored to original locations');

const bksInSrcAfterUndo = LibraryStorage.getBooks().filter(b => b.almari_id === almariA.id).length;
const bksInDestAfterUndo = LibraryStorage.getBooks().filter(b => b.almari_id === almariDest.id).length;
const activeAlmarisAfterUndoMove = AlmariService.getAlmaris().filter(a => a.is_active).length;
assert(bksInSrcAfterUndo === 2, 'Almari A restored with 2 books');
assert(bksInDestAfterUndo === 0, 'Almari Dest returned to 0 books');
assert(activeAlmarisAfterUndoMove === activeAlmarisBeforeMove, 'Active almaris count fully restored');

const restoredB1 = LibraryStorage.getBooks().find(b => b.id === 'book-move-1');
const restoredB2 = LibraryStorage.getBooks().find(b => b.id === 'book-move-2');
assert(restoredB1?.almari_id === almariA.id && restoredB1?.shelf_no === 2, 'Book 1 restored to Almari A, shelf 2');
assert(restoredB2?.almari_id === almariA.id && restoredB2?.shelf_no === 4, 'Book 2 restored to Almari A, shelf 4');
console.log('Scenario 2 passed!\n');

// ----------------------------------------------------
// SCENARIO 3: Delete Almari with books LEFT UNASSIGNED & Undo
// ----------------------------------------------------
console.log('--- SCENARIO 3: Delete Almari with Books (Left Unassigned) & Undo ---');
const almariUnassign = AlmariService.addAlmari({
  code: 'ALM-SRC-UNASSIGN',
  name_en: 'Source Almari Unassign',
  name_ur: 'الماری غیر تفویض',
  shelf_count: 3,
  books_per_shelf: 15,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const seedBook3: Book = {
  ...currentBooks[0],
  id: 'book-unassign-3',
  accession_no: 'ACC-U3',
  book_name: 'Calculus Early Transcendentals',
  almari_id: almariUnassign.id,
  shelf_no: 3,
  is_active: true,
};
currentBooks = [seedBook3, ...LibraryStorage.getBooks()];
LibraryStorage.saveBooks(currentBooks);

const bksInUnassignBefore = LibraryStorage.getBooks().filter(b => b.almari_id === almariUnassign.id).length;
assert(bksInUnassignBefore === 1, 'Almari Unassign has 1 book before deletion');

// Delete with action 'unassign'
const delUnassignRes = AlmariService.softDeleteAlmari(almariUnassign.id, 'unassign', undefined, LibraryStorage.getBooks());
assert(delUnassignRes.success, 'softDeleteAlmari with unassign succeeded');
assert(delUnassignRes.affectedBooksCount === 1, '1 book affected/unassigned');

const b3AfterDel = LibraryStorage.getBooks().find(b => b.id === 'book-unassign-3');
assert(b3AfterDel?.almari_id === null && b3AfterDel?.shelf_no === null, 'Book 3 is unassigned (almari_id: null, shelf_no: null)');

// Undo the unassigned deletion
const undoUnassignRes = AlmariService.undoAlmariDeletion(delUnassignRes.batchId, LibraryStorage.getBooks());
assert(undoUnassignRes.success, 'undoAlmariDeletion succeeded for unassign batch');
assert(undoUnassignRes.restoredBooksCount === 1, '1 book restored');

const b3AfterUndo = LibraryStorage.getBooks().find(b => b.id === 'book-unassign-3');
assert(b3AfterUndo?.almari_id === almariUnassign.id && b3AfterUndo?.shelf_no === 3, 'Book 3 restored to Almari Unassign shelf 3');
console.log('Scenario 3 passed!\n');

// ----------------------------------------------------
// SCENARIO 4: Blocked Delete Verification
// ----------------------------------------------------
console.log('--- SCENARIO 4: Blocked Delete Verification ---');
const nonExistentId = 'alm-non-existent-999';
const blockedDel = AlmariService.softDeleteAlmari(nonExistentId, 'unassign', undefined, LibraryStorage.getBooks());
assert(!blockedDel.success, 'Deleting invalid almari returns success: false');
assert(blockedDel.message === 'Almari not found.', `Blocked message returned: "${blockedDel.message}"`);

console.log('Scenario 4 passed!\n');

console.log('====================================================');
console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
console.log('====================================================');

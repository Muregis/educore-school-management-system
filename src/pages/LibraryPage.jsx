import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { csv } from "../lib/utils";
import { pager } from "../components/Helpers";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import Table from "../components/ui/Table";

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

const BLANK_BOOK = { title: "", author: "", category: "General", isbn: "", quantityTotal: 1 };
const BLANK_BORROW = { borrowerId: "", borrowerType: "student", bookId: "", dueDate: addDays(today(), 14), notes: "" };

const CATEGORIES = ["General","Mathematics","Sciences","Languages","History","Religion","Arts","Reference","Stationery"];

function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "center", marginTop: "var(--space-3)" }}>
      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
        style={{ padding: "4px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-secondary)", cursor: page === 1 ? "default" : "pointer" }}>‹</button>
      <span style={{ padding: "4px 10px", fontSize: "13px", color: "var(--color-text-secondary)" }}>{page} / {pages}</span>
      <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
        style={{ padding: "4px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-secondary)", cursor: page === pages ? "default" : "pointer" }}>›</button>
    </div>
  );
}

export default function LibraryPage({ auth, students = [], teachers = [], toast }) {
  const [tab, setTab]           = useState("books");
  const [books, setBooks]       = useState([]);
  const [borrows, setBorrows]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [page, setPage]         = useState(1);
  const [bPage, setBPage]       = useState(1);
  const [showBook, setShowBook] = useState(false);
  const [showBorrow, setShowBorrow] = useState(false);
  const [editBook, setEditBook] = useState(null);
  const [fb, setFb]             = useState(BLANK_BOOK);
  const [fw, setFw]             = useState(BLANK_BORROW);
  const [err, setErr]           = useState("");
  const isLibrarian = ["admin","librarian","director","superadmin"].includes(auth?.role);

  const load = async () => {
    setLoading(true);
    try {
      const [booksData, borrowsData] = await Promise.all([
        apiFetch("/library/books", { token: auth?.token }),
        apiFetch("/library/borrows", { token: auth?.token }),
      ]);
      setBooks(Array.isArray(booksData) ? booksData : []);
      setBorrows(Array.isArray(borrowsData) ? borrowsData : []);
    } catch (e) {
      console.error("Library load error:", e);
      toast?.(e.message || "Failed to load library data", "error");
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalBooks     = books.reduce((s, b) => s + Number(b.quantity_total || 0), 0);
  const totalOut       = books.reduce((s, b) => s + (Number(b.quantity_total || 0) - Number(b.quantity_available || 0)), 0);
  const totalAvailable = totalBooks - totalOut;
  const overdue        = borrows.filter(b => b.status === "borrowed" && b.due_date < today()).length;
  const activeBorrows  = borrows.filter(b => b.status === "borrowed").length;

  // ── Filtered books ─────────────────────────────────────────────────────────
  const filteredBooks = useMemo(() => books.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q || b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q) || b.isbn?.includes(q);
    // Case-insensitive category matching with fallback
    const bookCategory = (b.category || "General").toString();
    const matchCat = catFilter === "all" || bookCategory.toLowerCase() === catFilter.toLowerCase();
    return matchSearch && matchCat;
  }), [books, search, catFilter]);

  const { pages: bkPages, rows: bkRows } = pager(filteredBooks, page);
  const { pages: brPages, rows: brRows } = pager(borrows, bPage);

  // ── Save book ──────────────────────────────────────────────────────────────
  const saveBook = async () => {
    setErr("");
    setLoading(true); // Show loading during save
    if (!fb.title || !fb.author) {
      setLoading(false);
      return setErr("Title and author are required.");
    }
    if (Number(fb.quantityTotal) < 1) {
      setLoading(false);
      return setErr("Quantity must be at least 1.");
    }
    try {
      let result;
      if (editBook) {
        result = await apiFetch(`/library/books/${editBook.book_id}`, { method: "PUT", token: auth?.token, body: fb });
        toast("Book updated", "success");
      } else {
        result = await apiFetch("/library/books", { method: "POST", token: auth?.token, body: fb });
        toast("Book added", "success");
      }
      
      // Handle different response formats - backend may return { data: book } or book directly
      const savedBook = result?.data || result;
      
      // Extract book_id from various possible response structures
      const bookId = savedBook?.book_id || savedBook?.id;
      
      // Optimistically add to list if new book with properly normalized data
      if (!editBook && bookId) {
        const normalizedBook = {
          book_id: bookId,
          title: fb.title,
          author: fb.author,
          category: fb.category,
          isbn: fb.isbn || null,
          quantity_total: Number(fb.quantityTotal) || 1,
          quantity_available: Number(fb.quantityTotal) || 1,
          ...savedBook
        };
        setBooks(prev => [normalizedBook, ...prev]);
      }
      
      setShowBook(false); setFb(BLANK_BOOK); setEditBook(null);
      
      // Force refresh to ensure consistency
      await load();
    } catch (e) { 
      const message = e.message || "Failed to save";
      setErr(message);
      toast?.(message, "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Issue book ─────────────────────────────────────────────────────────────
  const issueBorrow = async () => {
    setErr("");
    if (!fw.borrowerId) return setErr("Please select a borrower.");
    if (!fw.bookId)     return setErr("Please select a book.");
    const book = books.find(b => b.book_id === Number(fw.bookId));
    if (!book) return setErr("Book not found.");
    if (Number(book.quantity_available) < 1) return setErr("No copies available for this book.");
    try {
      await apiFetch("/library/borrows", { method: "POST", token: auth?.token, body: {
        bookId:       Number(fw.bookId),
        borrowerId:   Number(fw.borrowerId),
        borrowerType: fw.borrowerType,
        dueDate:      fw.dueDate,
        notes:        fw.notes,
      }});
      setShowBorrow(false); setFw(BLANK_BORROW);
      load();
    } catch (e) { setErr(e.message || "Failed to issue"); }
  };

  // ── Return book ────────────────────────────────────────────────────────────
  const returnBook = async (borrowId) => {
    try {
      await apiFetch(`/library/borrows/${borrowId}/return`, { method: "PUT", token: auth?.token });
      load();
    } catch { /* ignore */ }
  };

  // toast prop is provided by App.jsx — no internal stub needed

  // Export functions
  const exportBooks = () => {
    csv("library_books.csv",
      ["Title", "Author", "Category", "ISBN", "Total Quantity", "Available", "Checked Out"],
      filteredBooks.map(b => [
        b.title || "",
        b.author || "",
        b.category || "",
        b.isbn || "",
        b.quantity_total || "",
        b.quantity_available || "",
        (Number(b.quantity_total) - Number(b.quantity_available)) || ""
      ])
    );
    toast("Books CSV exported", "success");
  };

  const exportBorrows = () => {
    const data = tab === "borrows" ? borrows : borrows.filter(b => b.status === "borrowed" && b.due_date < today());
    csv("library_borrows.csv",
      ["Book Title", "Borrower", "Borrower Type", "Borrow Date", "Due Date", "Status", "Days Out", "Notes"],
      data.map(b => [
        b.book_title || "",
        borrowerName(b),
        b.borrower_type || "",
        b.borrow_date || "",
        b.due_date || "",
        b.status || "",
        b.status === "borrowed" ? daysOut(b.borrow_date) : "",
        b.notes || ""
      ])
    );
    toast("Borrows CSV exported", "success");
  };

  const borrowerName = (b) => b.borrower_name || `#${b.borrower_id}`;
  const daysOut      = (borrow_date) => {
    const diff = Math.floor((new Date() - new Date(borrow_date)) / 86400000);
    return diff === 1 ? "1 day" : `${diff} days`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "var(--space-3)" }}>
        {[
          { label: "Total Items", value: totalBooks, color: "var(--color-info)" },
          { label: "Available",   value: totalAvailable, color: "var(--color-success)" },
          { label: "Checked Out", value: totalOut,       color: "var(--color-warning)" },
          { label: "Active Borrows", value: activeBorrows, color: "var(--color-primary)" },
          { label: "Overdue",     value: overdue,        color: "var(--color-danger)" },
        ].map(s => (
          <Card key={s.label} style={{ padding: "var(--space-3)" }}>
            <div style={{ fontSize: "24px", fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Tabs & Operations Container */}
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", paddingBottom: "var(--space-3)", borderBottom: "1px solid var(--color-border)" }}>
            <Button variant={tab === "books" ? "primary" : "secondary"} onClick={() => setTab("books")}>📚 Books & Stationery</Button>
            <Button variant={tab === "borrows" ? "primary" : "secondary"} onClick={() => setTab("borrows")}>🔄 Borrowed Items</Button>
            <Button variant={tab === "overdue" ? "primary" : "secondary"} onClick={() => setTab("overdue")}>⚠️ Overdue ({overdue})</Button>
            
            <div style={{ flex: 1 }} />
            
            {tab === "books" && <Button variant="ghost" onClick={exportBooks}>📤 Export Books CSV</Button>}
            {(tab === "borrows" || tab === "overdue") && <Button variant="ghost" onClick={exportBorrows}>📤 Export {tab === "overdue" ? "Overdue" : "Borrows"} CSV</Button>}
          </div>
          
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
            {tab === "books" && (
              <>
                <div style={{ flex: 2, minWidth: "200px" }}>
                  <Input placeholder="Search title, author, ISBN..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div style={{ flex: 1, minWidth: "150px" }}>
                  <Select value={catFilter} onChange={e => setCatFilter(e.target.value)} options={[{value: "all", label: "All Categories"}, ...CATEGORIES.map(c => ({value: c, label: c}))]} />
                </div>
              </>
            )}
            
            <div style={{ flex: 1 }} />
            
            {isLibrarian && tab === "books" && <Button onClick={() => { setEditBook(null); setFb(BLANK_BOOK); setErr(""); setShowBook(true); }}>+ Add Book</Button>}
            {isLibrarian && tab === "borrows" && <Button onClick={() => { setFw(BLANK_BORROW); setErr(""); setShowBorrow(true); }}>+ Issue Book</Button>}
          </div>
        </div>
      </Card>

      {loading && <EmptyState icon="⏳" title="Loading Library" description="Please wait while we fetch library data..." />}

      {/* Books tab */}
      {!loading && tab === "books" && (
        <>
          {filteredBooks.length === 0 ? <EmptyState icon="📚" title="No Books Found" description="No books match your current search criteria." /> : (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <Table
                headers={["Title", "Author", "Category", "ISBN", "Total", "Available", "Out", "Actions"]}
                data={bkRows.map(b => {
                  const out = Number(b.quantity_total) - Number(b.quantity_available);
                  return [
                    <span key="t" style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{b.title}</span>,
                    <span key="author" style={{ color: "var(--color-text-secondary)" }}>{b.author}</span>,
                    <Badge key="c" text={b.category} variant="info" />,
                    <span key="i" style={{ color: "var(--color-text-muted)", fontSize: "12px", fontFamily: "var(--font-mono)" }}>{b.isbn || "-"}</span>,
                    <span key="total" style={{ color: "var(--color-text-secondary)" }}>{b.quantity_total}</span>,
                    <span key="a" style={{ color: Number(b.quantity_available) > 0 ? "var(--color-success)" : "var(--color-danger)", fontWeight: 700 }}>{b.quantity_available}</span>,
                    <span key="o" style={{ color: out > 0 ? "var(--color-warning)" : "var(--color-text-muted)" }}>{out}</span>,
                    isLibrarian ? (
                      <div key="x" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                        <Button size="sm" variant="secondary" onClick={() => { setEditBook(b); setFb({ title: b.title, author: b.author, category: b.category, isbn: b.isbn || "", quantityTotal: b.quantity_total }); setErr(""); setShowBook(true); }}>Edit</Button>
                        <Button size="sm" onClick={() => { setFw({ ...BLANK_BORROW, bookId: String(b.book_id) }); setErr(""); setShowBorrow(true); }} disabled={Number(b.quantity_available) < 1}>Issue</Button>
                      </div>
                    ) : <span key="none"></span>,
                  ];
                })}
              />
              <div style={{ padding: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
                <Pager page={page} pages={bkPages} setPage={setPage} />
              </div>
            </Card>
          )}
        </>
      )}

      {/* Borrows tab */}
      {!loading && tab === "borrows" && (
        <>
          {borrows.filter(b => b.status === "borrowed").length === 0 ? <EmptyState icon="📖" title="No Active Borrows" description="There are no books currently checked out." /> : (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <Table
                headers={["Book", "Borrower", "Type", "Issued", "Due", "Days Out", "Status", "Actions"]}
                data={brRows.filter(b => b.status === "borrowed").map(b => {
                  const isOverdue = b.due_date < today();
                  return [
                    <span key="t" style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{b.book_title}</span>,
                    <span key="name" style={{ color: "var(--color-text-secondary)" }}>{borrowerName(b)}</span>,
                    <Badge key="bt" text={b.borrower_type} variant="info" />,
                    <span key="issued" style={{ color: "var(--color-text-secondary)", fontSize: "13px" }}>{b.borrow_date?.slice(0,10)}</span>,
                    <span key="d" style={{ color: isOverdue ? "var(--color-danger)" : "var(--color-text-primary)", fontWeight: isOverdue ? 700 : 500, fontSize: "13px" }}>{b.due_date?.slice(0,10)}</span>,
                    <span key="do" style={{ color: isOverdue ? "var(--color-danger)" : "var(--color-text-secondary)" }}>{daysOut(b.borrow_date)}</span>,
                    <Badge key="s" text={isOverdue ? "OVERDUE" : "Active"} variant={isOverdue ? "danger" : "success"} />,
                    isLibrarian ? <Button key="r" size="sm" variant="secondary" onClick={() => returnBook(b.borrow_id)}>Return ✓</Button> : <span key="none"></span>,
                  ];
                })}
              />
              <div style={{ padding: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
                <Pager page={bPage} pages={brPages} setPage={setBPage} />
              </div>
            </Card>
          )}
        </>
      )}

      {/* Overdue tab */}
      {!loading && tab === "overdue" && (
        <>
          {overdue === 0 ? <EmptyState icon="🎉" title="No Overdue Items" description="All checked out items are currently within their due dates." /> : (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <Table
                headers={["Book", "Borrower", "Type", "Due Date", "Days Overdue", "Actions"]}
                data={borrows.filter(b => b.status === "borrowed" && b.due_date < today()).map(b => {
                  const daysLate = Math.floor((new Date() - new Date(b.due_date)) / 86400000);
                  return [
                    <span key="t" style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{b.book_title}</span>,
                    <span key="name" style={{ color: "var(--color-text-secondary)" }}>{borrowerName(b)}</span>,
                    <Badge key="bt" text={b.borrower_type} variant="info" />,
                    <span key="d" style={{ color: "var(--color-danger)", fontWeight: 700, fontSize: "13px" }}>{b.due_date?.slice(0,10)}</span>,
                    <span key="dl" style={{ color: "var(--color-danger)", fontWeight: 700 }}>{daysLate} days</span>,
                    isLibrarian ? <Button key="r" size="sm" variant="secondary" onClick={() => returnBook(b.borrow_id)}>Return ✓</Button> : <span key="none"></span>,
                  ];
                })}
              />
            </Card>
          )}
        </>
      )}

      {/* Add/Edit Book Modal */}
      {showBook && (
        <Modal title={editBook ? "Edit Book / Item" : "Add Book / Stationery"} onClose={() => setShowBook(false)} footer={
          <>
            <Button variant="ghost" onClick={() => setShowBook(false)}>Cancel</Button>
            <Button onClick={saveBook}>{editBook ? "Update Book" : "Add Book"}</Button>
          </>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <Input 
              label="Title / Item Name *"
              value={fb.title} 
              onChange={e => setFb({ ...fb, title: e.target.value })} 
              placeholder="e.g. Oxford English Grade 7" 
            />
            
            <Input 
              label="Author / Brand *"
              value={fb.author} 
              onChange={e => setFb({ ...fb, author: e.target.value })} 
              placeholder="e.g. Oxford Press" 
            />
            
            <Select 
              label="Category"
              value={fb.category} 
              onChange={e => setFb({ ...fb, category: e.target.value })}
              options={CATEGORIES.map(c => ({ value: c, label: c }))}
            />
            
            <Input 
              label="ISBN / Code"
              value={fb.isbn} 
              onChange={e => setFb({ ...fb, isbn: e.target.value })} 
              placeholder="Optional" 
            />
            
            <Input 
              label="Total Quantity"
              type="number" 
              min="1" 
              value={fb.quantityTotal} 
              onChange={e => setFb({ ...fb, quantityTotal: e.target.value })} 
            />
          </div>
          {err && <div style={{ color: "var(--color-danger)", fontSize: "12px", margin: "12px 0 0 0", fontWeight: 500 }}>{err}</div>}
        </Modal>
      )}

      {/* Issue Book Modal */}
      {showBorrow && (
        <Modal title="Issue Book / Item" onClose={() => setShowBorrow(false)} footer={
          <>
            <Button variant="ghost" onClick={() => setShowBorrow(false)}>Cancel</Button>
            <Button onClick={issueBorrow}>Issue Book</Button>
          </>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <Select 
                label="Borrower Type"
                value={fw.borrowerType} 
                onChange={e => setFw({ ...fw, borrowerType: e.target.value, borrowerId: "" })}
                options={[
                  { value: "student", label: "Student" },
                  { value: "staff", label: "Staff / Teacher" }
                ]}
              />
              
              <Select 
                label={fw.borrowerType === "student" ? "Select Student *" : "Select Staff *"}
                value={fw.borrowerId} 
                onChange={e => setFw({ ...fw, borrowerId: e.target.value })}
                options={[
                  { value: "", label: "-- Select --" },
                  ...(fw.borrowerType === "student"
                    ? students.filter(s => s.status === "active").map(s => {
                        const sid = s.student_id ?? s.id;
                        return { value: sid, label: `${s.first_name ?? s.firstName} ${s.last_name ?? s.lastName} — ${s.admission_number ?? s.admission}` };
                      })
                    : teachers.map(t => {
                        const tid = t.teacher_id ?? t.id;
                        return { value: tid, label: `${t.first_name ?? t.firstName} ${t.last_name ?? t.lastName}` };
                      })
                  )
                ]}
              />
            </div>
            
            <div style={{ gridColumn: "1 / -1" }}>
              <Select 
                label="Book / Item *"
                value={fw.bookId} 
                onChange={e => setFw({ ...fw, bookId: e.target.value })}
                options={[
                  { value: "", label: "-- Select book --" },
                  ...books.filter(b => Number(b.quantity_available) > 0).map(b => ({
                    value: b.book_id,
                    label: `${b.title} (${b.quantity_available} available)`
                  }))
                ]}
              />
            </div>
            
            <Input 
              label="Due Date"
              type="date" 
              value={fw.dueDate} 
              min={today()} 
              onChange={e => setFw({ ...fw, dueDate: e.target.value })} 
            />
            
            <Input 
              label="Notes (optional)"
              value={fw.notes} 
              onChange={e => setFw({ ...fw, notes: e.target.value })} 
              placeholder="Any notes..." 
            />
          </div>
          {err && <div style={{ color: "var(--color-danger)", fontSize: "12px", margin: "12px 0 0 0", fontWeight: 500 }}>{err}</div>}
        </Modal>
      )}
    </div>
  );
}

LibraryPage.propTypes = {
  auth:     PropTypes.object.isRequired,
  students: PropTypes.array,
  teachers: PropTypes.array,
  toast:    PropTypes.func,
};

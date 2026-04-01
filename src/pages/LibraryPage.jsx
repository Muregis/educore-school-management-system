import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Table from "../components/Table";
import Modal from "../components/Modal";
import { Pager, Msg } from "../components/Helpers";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";

const PAGE_SIZE = 12;
const pager = (arr, p) => ({ pages: Math.max(1, Math.ceil(arr.length / PAGE_SIZE)), rows: arr.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE) });
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

const BLANK_BOOK = { title: "", author: "", category: "General", isbn: "", quantityTotal: 1 };
const BLANK_BORROW = { borrowerId: "", borrowerType: "student", bookId: "", dueDate: addDays(today(), 14), notes: "" };

const CATEGORIES = ["General","Mathematics","Sciences","Languages","History","Religion","Arts","Reference","Stationery"];

export default function LibraryPage({ auth, students = [], teachers = [] }) {
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
  const isLibrarian = ["admin","librarian"].includes(auth?.role);

  const load = async () => {
    setLoading(true);
    try {
      const [booksData, borrowsData] = await Promise.all([
        apiFetch("/library/books", { token: auth?.token }),
        apiFetch("/library/borrows", { token: auth?.token }),
      ]);
      setBooks(Array.isArray(booksData) ? booksData : []);
      setBorrows(Array.isArray(borrowsData) ? borrowsData : []);
    } catch { /* offline */ }
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
    if (!fb.title || !fb.author) return setErr("Title and author are required.");
    if (Number(fb.quantityTotal) < 1) return setErr("Quantity must be at least 1.");
    try {
      if (editBook) {
        await apiFetch(`/library/books/${editBook.book_id}`, { method: "PUT", token: auth?.token, body: fb });
        toast("Book updated", "success");
      } else {
        await apiFetch("/library/books", { method: "POST", token: auth?.token, body: fb });
      }
      setShowBook(false); setFb(BLANK_BOOK); setEditBook(null);
      load();
    } catch (e) { setErr(e.message || "Failed to save"); }
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

  const toast = (msg, tone) => {
    // Toast should be passed from parent, but fallback to console if not available
    if (typeof window !== 'undefined' && window.toast) {
      window.toast(msg, tone);
    } else {
      // Silent fallback - production code shouldn't use console.log
    }
  };

  const borrowerName = (b) => b.borrower_name || `#${b.borrower_id}`;
  const daysOut      = (borrow_date) => {
    const diff = Math.floor((new Date() - new Date(borrow_date)) / 86400000);
    return diff === 1 ? "1 day" : `${diff} days`;
  };

  const TABS = [
    { id: "books",   label: "📚 Books & Stationery" },
    { id: "borrows", label: "🔄 Borrowed Items" },
    { id: "overdue", label: `⚠️ Overdue (${overdue})` },
  ];

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "Total Items", value: totalBooks, color: "#3b82f6" },
          { label: "Available",   value: totalAvailable, color: "#22c55e" },
          { label: "Checked Out", value: totalOut,       color: "#f59e0b" },
          { label: "Active Borrows", value: activeBorrows, color: "#8b5cf6" },
          { label: "Overdue",     value: overdue,        color: "#ef4444" },
        ].map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 16px", minWidth: 110 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: tab === t.id ? 700 : 400, background: tab === t.id ? C.accent : "transparent", color: tab === t.id ? "#fff" : C.textSub, fontSize: 13 }}>{t.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        {isLibrarian && tab === "books" && <Btn onClick={() => { setEditBook(null); setFb(BLANK_BOOK); setErr(""); setShowBook(true); }}>+ Add Book</Btn>}
        {isLibrarian && tab === "borrows" && <Btn onClick={() => { setFw(BLANK_BORROW); setErr(""); setShowBorrow(true); }}>+ Issue Book</Btn>}
      </div>

      {loading && <Msg text="Loading library..." />}

      {/* Books tab */}
      {!loading && tab === "books" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input style={{ ...inputStyle, flex: 2 }} placeholder="Search title, author, ISBN..." value={search} onChange={e => setSearch(e.target.value)} />
            <select style={{ ...inputStyle, flex: 1 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          {filteredBooks.length === 0 ? <Msg text="No books found." /> : (
            <>
              <div style={{ overflowX: "auto" }}>
                <Table
                  headers={["Title", "Author", "Category", "ISBN", "Total", "Available", "Out", ""]}
                  rows={bkRows.map(b => {
                    const out = Number(b.quantity_total) - Number(b.quantity_available);
                    return [
                      <span key="t" style={{ fontWeight: 600, color: C.text }}>{b.title}</span>,
                      b.author,
                      <Badge key="c" text={b.category} tone="info" />,
                      <span key="i" style={{ color: C.textMuted, fontSize: 12 }}>{b.isbn || "-"}</span>,
                      b.quantity_total,
                      <span key="a" style={{ color: Number(b.quantity_available) > 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{b.quantity_available}</span>,
                      <span key="o" style={{ color: out > 0 ? "#f59e0b" : C.textMuted }}>{out}</span>,
                      isLibrarian ? (
                        <div key="x" style={{ display: "flex", gap: 4 }}>
                          <Btn size="xs" variant="ghost" onClick={() => { setEditBook(b); setFb({ title: b.title, author: b.author, category: b.category, isbn: b.isbn || "", quantityTotal: b.quantity_total }); setErr(""); setShowBook(true); }}>Edit</Btn>
                          <Btn size="xs" onClick={() => { setFw({ ...BLANK_BORROW, bookId: String(b.book_id) }); setErr(""); setShowBorrow(true); }} disabled={Number(b.quantity_available) < 1}>Issue</Btn>
                        </div>
                      ) : null,
                    ];
                  })}
                />
              </div>
              <Pager page={page} pages={bkPages} setPage={setPage} />
            </>
          )}
        </>
      )}

      {/* Borrows tab */}
      {!loading && tab === "borrows" && (
        <>
          {borrows.filter(b => b.status === "borrowed").length === 0 ? <Msg text="No active borrows." /> : (
            <>
              <div style={{ overflowX: "auto" }}>
                <Table
                  headers={["Book", "Borrower", "Type", "Issued", "Due", "Days Out", "Status", ""]}
                  rows={brRows.filter(b => b.status === "borrowed").map(b => {
                    const isOverdue = b.due_date < today();
                    return [
                      <span key="t" style={{ fontWeight: 600, color: C.text }}>{b.book_title}</span>,
                      borrowerName(b),
                      <Badge key="bt" text={b.borrower_type} tone="info" />,
                      b.borrow_date?.slice(0,10),
                      <span key="d" style={{ color: isOverdue ? "#ef4444" : C.text, fontWeight: isOverdue ? 700 : 400 }}>{b.due_date?.slice(0,10)}</span>,
                      <span key="do" style={{ color: isOverdue ? "#ef4444" : C.textSub }}>{daysOut(b.borrow_date)}</span>,
                      <Badge key="s" text={isOverdue ? "OVERDUE" : "Active"} tone={isOverdue ? "danger" : "success"} />,
                      isLibrarian ? <Btn key="r" size="xs" onClick={() => returnBook(b.borrow_id)}>Return ✓</Btn> : null,
                    ];
                  })}
                />
              </div>
              <Pager page={bPage} pages={brPages} setPage={setBPage} />
            </>
          )}
        </>
      )}

      {/* Overdue tab */}
      {!loading && tab === "overdue" && (
        <>
          {overdue === 0 ? <Msg text="No overdue items. 🎉" /> : (
            <div style={{ overflowX: "auto" }}>
              <Table
                headers={["Book", "Borrower", "Type", "Due Date", "Days Overdue", ""]}
                rows={borrows.filter(b => b.status === "borrowed" && b.due_date < today()).map(b => {
                  const daysLate = Math.floor((new Date() - new Date(b.due_date)) / 86400000);
                  return [
                    <span key="t" style={{ fontWeight: 600, color: C.text }}>{b.book_title}</span>,
                    borrowerName(b),
                    <Badge key="bt" text={b.borrower_type} tone="info" />,
                    <span key="d" style={{ color: "#ef4444", fontWeight: 700 }}>{b.due_date?.slice(0,10)}</span>,
                    <span key="dl" style={{ color: "#ef4444", fontWeight: 700 }}>{daysLate} days</span>,
                    isLibrarian ? <Btn key="r" size="xs" onClick={() => returnBook(b.borrow_id)}>Return ✓</Btn> : null,
                  ];
                })}
              />
            </div>
          )}
        </>
      )}

      {/* Add/Edit Book Modal */}
      {showBook && (
        <Modal title={editBook ? "Edit Book / Item" : "Add Book / Stationery"} onClose={() => setShowBook(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Title / Item Name">
              <input style={inputStyle} value={fb.title} onChange={e => setFb({ ...fb, title: e.target.value })} placeholder="e.g. Oxford English Grade 7" />
            </Field>
            <Field label="Author / Brand">
              <input style={inputStyle} value={fb.author} onChange={e => setFb({ ...fb, author: e.target.value })} placeholder="e.g. Oxford Press" />
            </Field>
            <Field label="Category">
              <select style={inputStyle} value={fb.category} onChange={e => setFb({ ...fb, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="ISBN / Code">
              <input style={inputStyle} value={fb.isbn} onChange={e => setFb({ ...fb, isbn: e.target.value })} placeholder="Optional" />
            </Field>
            <Field label="Total Quantity">
              <input type="number" min="1" style={inputStyle} value={fb.quantityTotal} onChange={e => setFb({ ...fb, quantityTotal: e.target.value })} />
            </Field>
          </div>
          {err && <Msg text={err} tone="error" />}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShowBook(false)}>Cancel</Btn>
            <Btn onClick={saveBook}>{editBook ? "Update" : "Add"}</Btn>
          </div>
        </Modal>
      )}

      {/* Issue Book Modal */}
      {showBorrow && (
        <Modal title="Issue Book / Item" onClose={() => setShowBorrow(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Borrower Type">
              <select style={inputStyle} value={fw.borrowerType} onChange={e => setFw({ ...fw, borrowerType: e.target.value, borrowerId: "" })}>
                <option value="student">Student</option>
                <option value="staff">Staff / Teacher</option>
              </select>
            </Field>
            <Field label={fw.borrowerType === "student" ? "Select Student" : "Select Staff"}>
              <select style={inputStyle} value={fw.borrowerId} onChange={e => setFw({ ...fw, borrowerId: e.target.value })}>
                <option value="">-- Select --</option>
                {fw.borrowerType === "student"
                  ? students.filter(s => s.status === "active").map(s => {
                      const sid = s.student_id ?? s.id;
                      return <option key={sid} value={sid}>{s.first_name ?? s.firstName} {s.last_name ?? s.lastName} — {s.admission_number ?? s.admission}</option>;
                    })
                  : teachers.map(t => {
                      const tid = t.teacher_id ?? t.id;
                      return <option key={tid} value={tid}>{t.first_name ?? t.firstName} {t.last_name ?? t.lastName}</option>;
                    })
                }
              </select>
            </Field>
            <Field label="Book / Item">
              <select style={inputStyle} value={fw.bookId} onChange={e => setFw({ ...fw, bookId: e.target.value })}>
                <option value="">-- Select book --</option>
                {books.filter(b => Number(b.quantity_available) > 0).map(b => (
                  <option key={b.book_id} value={b.book_id}>{b.title} ({b.quantity_available} available)</option>
                ))}
              </select>
            </Field>
            <Field label="Due Date">
              <input type="date" style={inputStyle} value={fw.dueDate} min={today()} onChange={e => setFw({ ...fw, dueDate: e.target.value })} />
            </Field>
            <Field label="Notes (optional)">
              <input style={inputStyle} value={fw.notes} onChange={e => setFw({ ...fw, notes: e.target.value })} placeholder="Any notes..." />
            </Field>
          </div>
          {err && <Msg text={err} tone="error" />}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShowBorrow(false)}>Cancel</Btn>
            <Btn onClick={issueBorrow}>Issue Book</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

LibraryPage.propTypes = {
  auth:     PropTypes.object.isRequired,
  students: PropTypes.array,
  teachers: PropTypes.array,
};

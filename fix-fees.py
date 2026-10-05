import os
import re

fp = 'src/pages/FeesPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# Add selectedTerm state
state_block = '''  const { term, academicYear, startDate, endDate } = useCurrentTerm(auth);
  const displayTerm = term || "Term 2";'''

new_state_block = '''  const { term, academicYear, startDate, endDate } = useCurrentTerm(auth);
  const [selectedTerm, setSelectedTerm] = useState("current");
  const displayTerm = selectedTerm === "current" ? (term || "Term 2") : selectedTerm;'''
content = content.replace(state_block, new_state_block)

# Fix useEntitySync and reloadPayments
reload_block = '''  const reloadPayments = useCallback(async () => {
    if (!auth?.token || !term) return;
    const data = await apiFetch(/payments?term=, { token: auth.token });
    setPayments((data || []).map(normalisePayment));
  }, [auth, setPayments, term]);

  useEntitySync({ url: /payments?term=, token: auth?.token, setter: setPayments, transform: (data) => (data || []).map(normalisePayment), dependencies: [term], enabled: !!term });'''

new_reload_block = '''  const reloadPayments = useCallback(async () => {
    if (!auth?.token) return;
    const fetchTerm = selectedTerm === "current" ? term : selectedTerm;
    const url = fetchTerm === "all" ? "/payments" : /payments?term=;
    const data = await apiFetch(url, { token: auth.token });
    setPayments((data || []).map(normalisePayment));
  }, [auth, setPayments, term, selectedTerm]);

  const fetchTermForSync = selectedTerm === "current" ? term : selectedTerm;
  const syncUrl = fetchTermForSync === "all" ? "/payments" : /payments?term=;
  useEntitySync({ url: syncUrl, token: auth?.token, setter: setPayments, transform: (data) => (data || []).map(normalisePayment), dependencies: [syncUrl], enabled: true });'''
content = content.replace(reload_block, new_reload_block)

# Find the buttons for "All Time" and "Today" and replace them with Term chips
buttons_block = '''          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button variant={filterDate==="all" ? "primary" : "ghost"} onClick={() => setFilterDate("all")}>All Time</Button>
            <Button variant={filterDate==="today" ? "primary" : "ghost"} onClick={() => setFilterDate("today")}>Today</Button>
          </div>'''

new_buttons_block = '''          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Button variant={filterDate==="today" ? "primary" : "ghost"} onClick={() => setFilterDate(filterDate === "today" ? "all" : "today")}>Today</Button>
            <div style={{ width: "1px", background: "var(--color-border)", margin: "0 var(--space-2)" }} />
            <Button variant={selectedTerm==="current" ? "secondary" : "ghost"} onClick={() => setSelectedTerm("current")}>Current Term</Button>
            <Button variant={selectedTerm==="Term 1" ? "secondary" : "ghost"} onClick={() => setSelectedTerm("Term 1")}>Term 1</Button>
            <Button variant={selectedTerm==="Term 2" ? "secondary" : "ghost"} onClick={() => setSelectedTerm("Term 2")}>Term 2</Button>
            <Button variant={selectedTerm==="Term 3" ? "secondary" : "ghost"} onClick={() => setSelectedTerm("Term 3")}>Term 3</Button>
            <Button variant={selectedTerm==="all" ? "secondary" : "ghost"} onClick={() => setSelectedTerm("all")}>All Time (All Terms)</Button>
          </div>'''
content = content.replace(buttons_block, new_buttons_block)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated FeesPage.jsx for P0.1")

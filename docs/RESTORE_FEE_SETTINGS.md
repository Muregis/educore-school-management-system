# Restore student fee settings (after polish)

## Branch
`fix/restore-student-fee-settings`

## Already on branch
- `src/components/StudentFeeSettingsBlock.jsx` — Transport, Lunch, Breakfast, Discount, Opening balance

## Still apply on `StudentsPage.jsx` (3 edits)

1. After `import Table from "../components/ui/Table";` add:
```js
import StudentFeeSettingsBlock from "../components/StudentFeeSettingsBlock";
```

2. In the Add/Edit modal, after the Status `<Select>`, add:
```jsx
<StudentFeeSettingsBlock f={f} onChange={handleChange} />
```

3. In `patchPayload` for `PATCH /students/:id/fees`, **remove** `lunch_fee` and `transport_fee` lines (they cause schema cache 500).

## Backend (`students.routes.js` PATCH /:id/fees)
Do not write `lunch_fee` or `transport_fee` columns.

## Optional SQL (only if you want those columns later)
```sql
ALTER TABLE students ADD COLUMN IF NOT EXISTS lunch_fee NUMERIC(12,2) DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS transport_fee NUMERIC(12,2) DEFAULT 0;
```

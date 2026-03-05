# Database Setup (MySQL Workbench)

1. Open MySQL Workbench and connect to your local server.
2. Open and run: `database/schema.sql`
3. Open and run: `database/seed.sql`

After that, use:

```sql
USE educore_db;
SHOW TABLES;
SELECT * FROM v_monthly_fee_collection;
SELECT * FROM v_attendance_rate;
SELECT * FROM v_fee_defaulters ORDER BY balance_due DESC;
```

## Notes
- Schema is multi-tenant (`school_id` everywhere relevant).
- Includes `created_at`, `updated_at`, and `is_deleted` soft delete support.
- Includes FK constraints and common indexes.
- `seed.sql` gives you one full demo school dataset.

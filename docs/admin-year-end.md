# Admin application archives

Apply `supabase/application-archives.sql` in the Supabase SQL editor after the existing schema. New database setups include the same migration in `supabase/schema.sql`.

In the admin Applications page, choose **Archive all applications**. This saves a complete snapshot of the current applications and their interview slots. Choose **Export CSV** or **Export PDF** (use Save as PDF in the browser print dialog), verify that you saved the file, then choose **Delete exported applications** and confirm.

The deletion is transactional, releases associated booked interview slots, and leaves student accounts intact. Applications submitted after the snapshot stay in the queue. If an exported application or interview changed in the meantime, clearing fails without deleting anything; create and export a fresh archive. Only the staff member who prepared the archive can clear it. Staff can export the latest 20 saved archives from **Recent saved archives**.

**Clear all new notifications** marks current application, student, profile change, Builder, and Forum notifications as seen in this browser. It does not approve or delete pending work. New records still generate unread badges. The gold website indicator represents an active announcement and remains visible while the announcement is enabled.

Validation:

- `node --test tests/admin-year-end.cjs`
- `npm run build`
- `psql -f tests/application-archives.sql` in an empty disposable PostgreSQL database only (this test creates its own fixture schema and roles).

# Backups & disaster recovery

Wingman's customer data lives in Supabase Postgres, with support-ticket file
uploads in a private Supabase Storage bucket (`ticket-attachments`). We protect
it in three independent layers so no single failure loses data.

## The three layers

1. **Supabase daily backups** (Pro plan) — automated, 7-day retention. Managed
   entirely by Supabase. Nothing to configure.
2. **Point-in-Time Recovery (PITR)** — restore the database to any second within
   the recovery window. Enable it under **Supabase → Project Settings →
   Database → Backups → Point in Time** (add-on). This is the primary defense
   against a bad migration or an accidental delete.
3. **Off-site nightly backup to Backblaze B2** — an independent copy in storage
   *we* control, so we're not solely dependent on Supabase. This is the
   `.github/workflows/backup.yml` job. It runs every night at 08:00 UTC and can
   also be run on demand from the **Actions** tab.

Layers 1–2 are Supabase settings. Layer 3 is the automation described below.

## What the nightly job does

- `pg_dump` of the full database in custom format.
- Encrypts the dump with AES-256 (GPG symmetric) using `BACKUP_PASSPHRASE`.
- Uploads it to `B2:<bucket>/postgres/` and prunes dumps older than 30 days.
- Copies the `ticket-attachments` Storage bucket to `B2:<bucket>/storage/`
  (additive — files deleted in Supabase are retained in the backup).

Scheduled runs only start once this workflow is on the **default branch**
(GitHub only schedules from the default branch).

## One-time setup

### 1. Create the Backblaze B2 bucket
1. Sign up at backblaze.com and open **B2 Cloud Storage**.
2. **Create a Bucket** — name it e.g. `wingman-backups`, set **Files in Bucket
   are: Private**, and enable **Default Encryption**.
3. (Recommended) **Lifecycle Settings → Keep only the last version / delete
   after 30 days** so old backups clean themselves up.
4. **App Keys → Add a New Application Key**: restrict it to the
   `wingman-backups` bucket with **Read and Write**. Copy the **keyID** and
   **applicationKey** (the key is shown only once).

### 2. Get the Supabase database connection string
**Supabase → Project Settings → Database → Connection string → URI**, and pick
the **Session pooler** (host `...pooler.supabase.com`, port **5432**). Use the
session pooler, not the transaction pooler (6543) — `pg_dump` needs a session
connection, and the pooler host works over IPv4 (GitHub runners are IPv4-only).
Paste in your database password where it says `[YOUR-PASSWORD]`.

### 3. (Optional) Get the Supabase Storage S3 credentials
**Supabase → Storage → S3 Connection**. Enable it, note the **endpoint** and
**region**, then create **access keys**. Skip this if you don't need the
attachment files backed up yet — the job just skips the Storage step.

### 4. Add the GitHub repository secrets
**Repo → Settings → Secrets and variables → Actions → New repository secret:**

| Secret | Value |
| --- | --- |
| `SUPABASE_DB_URL` | Session-pooler URI from step 2, with the real password |
| `BACKUP_PASSPHRASE` | A long random passphrase — **store it in your password manager; without it the backups can't be decrypted** |
| `B2_KEY_ID` | Backblaze keyID |
| `B2_APP_KEY` | Backblaze applicationKey |
| `B2_BUCKET` | Bucket name (e.g. `wingman-backups`) |
| `SUPABASE_S3_ENDPOINT` | *(optional)* Storage S3 endpoint |
| `SUPABASE_S3_REGION` | *(optional)* Storage S3 region |
| `SUPABASE_S3_ACCESS_KEY` | *(optional)* Storage S3 access key id |
| `SUPABASE_S3_SECRET_KEY` | *(optional)* Storage S3 secret |

### 5. Run it once by hand
**Actions → Nightly backup → Run workflow.** Confirm it goes green and that
`postgres/db-<timestamp>.dump.gpg` appears in your B2 bucket.

## Restoring from an off-site backup

Restore into a **fresh** Supabase project or a local Postgres first — never
straight over production unless you've confirmed the dump.

```bash
# 1. Download the encrypted dump from B2 (via the B2 UI or rclone).
# 2. Decrypt it:
gpg --batch --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" \
  --decrypt db-<timestamp>.dump.gpg > db.dump

# 3. Restore into the target database:
pg_restore --no-owner --no-privileges --clean --if-exists \
  --dbname "$TARGET_DB_URL" db.dump
```

Storage files under `storage/ticket-attachments` in B2 can be copied back into
the Supabase bucket with `rclone copy` in the reverse direction.

## Test your restores

A backup you've never restored from is a guess, not a backup. Once a quarter,
decrypt the latest dump and `pg_restore` it into a throwaway database to confirm
it's complete and current.

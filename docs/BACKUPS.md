# Backups (Backblaze B2)

Twice a day, GitHub copies the **live** database (and member photos) to Backblaze, encrypted. Workflow: `.github/workflows/backup.yml`.

Every backup is locked with `BACKUP_PASSPHRASE` before it leaves GitHub. **Without that passphrase no backup can be opened, so keep it in your password manager.**

## One-time setup

### Backblaze
1. Buckets → Create a bucket: `scoredate-backups`, **Private**, Default Encryption **Enable**, Object Lock off.
2. Bucket → Lifecycle Settings → **Use custom lifecycle rules**:
   - File name prefix `database/`: hide after **28** days, delete **1** day after hiding.
   - File name prefix `storage/`: hide after *(blank)*, delete **7** days after hiding. That keeps deleted photos for 7 days only.
   (The privacy policy promises deleted data is gone within 30 days, including backups.)
3. Application Keys → Add a New Application Key: access to **scoredate-backups only**, Read and Write. Copy the **keyID** and **applicationKey**.
4. The bucket page shows its **Endpoint**, e.g. `s3.us-east-005.backblazeb2.com`. Put `https://` in front.

### Supabase (live project)
- **Connect** → **Session pooler** → copy the connection string and put in the database password. (GitHub can't use the "Direct" one.)
- Optional, for photos: **Storage → Settings → S3 Connection** → enable, copy the Endpoint, then **New access key**.

### GitHub
score-app → Settings → Secrets and variables → **Actions** → New repository secret, one for each:

| Secret | Value |
|---|---|
| `LIVE_DB_URL` | Session pooler connection string |
| `BACKUP_PASSPHRASE` | A long random passphrase (save it in your password manager) |
| `B2_KEY_ID` | Backblaze keyID |
| `B2_APP_KEY` | Backblaze applicationKey |
| `B2_BUCKET` | `scoredate-backups` |
| `B2_ENDPOINT` | `https://s3.….backblazeb2.com` |
| `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_KEY_ID`, `SUPABASE_S3_SECRET` | Optional, for photos |

Then: **Actions → Backup to Backblaze → Run workflow** and check that a file appears in the bucket under `database/`.
GitHub emails you if a backup ever fails.

## At launch: hourly
In `backup.yml`, add a second schedule line (keep the twice-a-day one so photos still sync):
```yaml
  schedule:
    - cron: '17 4,16 * * *'
    - cron: '47 * * * *'      # hourly database backup
```
Each run takes about 1–2 minutes. Hourly uses about 1,000–1,500 GitHub Actions minutes a month. A private repo on GitHub Free includes 2,000, so check Settings → Billing.
Also consider Supabase **Point-in-Time Recovery** (Pro add-on), which restores to any minute. Backblaze stays your off-site copy.

## Restoring
1. Download the `.tar.gz.gpg` file from Backblaze.
2. Unlock and unpack it:
   ```
   gpg --decrypt scoredate-<time>.tar.gz.gpg > backup.tar.gz && tar -xzf backup.tar.gz
   ```
3. Load it into a **new, empty** Supabase project (never on top of live), using that project's Session pooler string:
   ```
   psql "<new project URL>" --single-transaction -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica" -f roles.sql -f schema.sql -f data.sql
   ```
4. Point Vercel at the new project once it checks out.

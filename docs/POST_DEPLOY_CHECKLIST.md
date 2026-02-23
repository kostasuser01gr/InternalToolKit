# Post-Deploy Checklist

After each production deployment, verify these items.

## 1. Health Check
- [ ] Production URL loads without errors
- [ ] No 500 errors in `vercel logs`

## 2. Key Pages Load
- [ ] `/chat` — Chat interface renders, channels visible
- [ ] `/fleet` — Fleet pipeline board loads with vehicles
- [ ] `/washers` — Washer dashboard with KPIs
- [ ] `/washers/app` — Kiosk interface loads
- [ ] `/imports` — Import page with upload form
- [ ] `/feeds` — RSS feeds list
- [ ] `/search` — Search page renders
- [ ] `/weather` — Weather widget shows data
- [ ] `/settings` — Settings page loads
- [ ] `/calendar` — Calendar view renders

## 3. Cron Endpoints (manual trigger)
Test with:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<PROD_URL>/api/cron/daily
curl -H "Authorization: Bearer $CRON_SECRET" https://<PROD_URL>/api/cron/feeds
curl -H "Authorization: Bearer $CRON_SECRET" https://<PROD_URL>/api/cron/weather
curl -H "Authorization: Bearer $CRON_SECRET" https://<PROD_URL>/api/cron/housekeeping
```

## 4. Database
- [ ] Prisma migrations applied (no pending)
- [ ] DB queries return data (check any list page)

## 5. Auth
- [ ] Login flow works
- [ ] Session persists across page reloads

## 6. Optional Features
- [ ] Kiosk mode (if KIOSK_TOKEN set): `/washers/app` allows task updates
- [ ] Viber bridge (if enabled): messages mirror to Viber group

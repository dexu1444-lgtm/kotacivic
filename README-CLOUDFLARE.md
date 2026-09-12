# Kota Civic — Cloudflare Pages deploy

## 1. Install Wrangler (on your computer)
```bash
npm install -g wrangler
wrangler login
```

## 2. Deploy
From this folder:
```bash
wrangler pages deploy public --project-name=kota-civic
```

Or create project in dashboard: Workers & Pages → Create → Pages → Upload, but **Functions only work when the whole project (public + functions) is deployed via Git or Wrangler from the project root**.

### Recommended: GitHub
1. Upload this whole `kota-civic-cf` folder to a GitHub repo
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
3. Build settings:
   - **Build command:** (leave empty)
   - **Build output directory:** `public`
4. Deploy

Cloudflare automatically picks up the `functions/` folder next to `public/`.

## 3. Environment variables (REQUIRED)
After first deploy:
**Settings → Variables and secrets → Add** (Production):

| Name | Value |
|------|--------|
| `JSONBIN_BIN_ID` | your bin id |
| `JSONBIN_API_KEY` | master key (if `$` breaks, try doubling: `$$`) |
| `DISCORD_WEBHOOK_URL` | optional |
| `OPENROUTER_API_KEY` | optional |

Then **redeploy**.

## 4. Test
Open: `https://YOUR-PROJECT.pages.dev/api/status`  
Should show `"jsonbinConfigured": true` and `"host":"cloudflare"`.

## Staff
daksh@admin.com / dex123

## Custom domain
Workers & Pages → your project → **Custom domains** → Add domain (free).

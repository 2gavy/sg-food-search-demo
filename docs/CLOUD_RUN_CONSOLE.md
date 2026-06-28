# Deploy SG Food Discovery on Cloud Run (GCP Console only)

No local `gcloud` or Docker required. Everything below is done in the **Google Cloud Console** and **GitHub** UI.

The app ships as **one container**: built React UI + FastAPI on port **8080**. Elasticsearch stays on **Elastic Cloud** — credentials are set as Cloud Run environment variables (never baked into the image).

---

## Before you start

### 1. Elastic Cloud (already set up for this demo)

You need a working Serverless Search project with the corpus ingested. From your existing `.env`:

| Variable | Example | Required |
|----------|---------|----------|
| `ELASTICSEARCH_URL` | `https://….es….aws.elastic.cloud:443` | Yes |
| `ES_API_KEY` | API key with read/search on the corpus index | Yes |
| `LLM_CONNECTOR_ID` | `Anthropic-Claude-Sonnet-4-6` | Optional (Concierge) |
| `AGENT_BUILDER_AGENT_ID` | `sg-food-concierge` | Optional (default) |
| `KIBANA_URL` | Auto-derived from ES URL if omitted | Optional |
| `KIBANA_API_KEY` | Same as `ES_API_KEY` if omitted | Optional |

**API key note:** Cloud Run uses dynamic egress IPs. In Elastic Cloud, do **not** restrict the API key to a fixed IP, or the hosted app will get `401`/`403`.

**Discover tab:** If clustering embeddings were already backfilled (`./scripts/prep-demo.sh` against this cluster), no extra step. Otherwise run that script once from any machine that can reach Elasticsearch (your laptop is fine).

### 2. GitHub

Push the latest code to your repo (includes `Dockerfile` at repo root):

- **Repo:** [github.com/2gavy/sg-food-search-demo](https://github.com/2gavy/sg-food-search-demo)
- **Branch:** `main`

Cloud Run will build from the `Dockerfile` in the repository root.

### 3. Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or pick an existing one), e.g. `sg-food-demo`.
3. **Billing** must be enabled on the project ([Billing](https://console.cloud.google.com/billing)).

---

## Step 1 — Enable APIs (Console)

1. Go to [APIs & Services → Library](https://console.cloud.google.com/apis/library).
2. Search and **Enable** each:
   - **Cloud Run API**
   - **Cloud Build API**
   - **Artifact Registry API**
   - **Secret Manager API** (recommended for the API key)

---

## Step 2 — Store secrets (recommended)

Avoid pasting `ES_API_KEY` as plain text in the service config.

1. Open [Secret Manager](https://console.cloud.google.com/security/secret-manager).
2. **Create secret**
   - Name: `sg-food-es-api-key`
   - Secret value: your `ES_API_KEY`
3. (Optional) Create `sg-food-elasticsearch-url` with your `ELASTICSEARCH_URL`, or set that URL as a normal env var (less sensitive).

4. **Grant Cloud Run access** (first time only):
   - Note your **project number** (Home → Project settings).
   - Go to [IAM](https://console.cloud.google.com/iam-admin/iam).
   - Find the default compute service account:  
     `PROJECT_NUMBER-compute@developer.gserviceaccount.com`
   - Edit → **Add role** → **Secret Manager Secret Accessor**.

---

## Step 3 — Create the Cloud Run service

1. Open [Cloud Run](https://console.cloud.google.com/run).
2. Click **Create service**.

### Source

3. Choose **Continuously deploy from a repository** (or **Deploy from source**).
4. Click **Set up with Cloud Build** if prompted.
5. **Connect repository** → GitHub → authorize → select `2gavy/sg-food-search-demo`.
6. Branch: `main`.
7. **Build type:** Dockerfile  
8. **Dockerfile location:** `/Dockerfile` (repository root).

### Service settings

| Setting | Recommended value |
|---------|-------------------|
| Service name | `sg-food-search-demo` |
| Region | `asia-southeast1` (Singapore) or your preferred region |
| Authentication | **Allow unauthenticated invocations** (public demo) |
| CPU allocation | CPU is only allocated during request processing |
| Memory | **1 GiB** |
| CPU | **1** |
| Request timeout | **300** seconds (photo search + clustering can be slow) |
| Minimum instances | **0** (scales to zero; first request may be slow) |
| Maximum instances | **3** |

### Container port

- **Port:** `8080` (must match `Dockerfile` / `PORT` env)

### Environment variables

Under **Containers → Variables & secrets**:

| Name | Value |
|------|--------|
| `ELASTICSEARCH_URL` | Your Elastic Search endpoint |
| `ES_API_KEY` | **Reference secret** `sg-food-es-api-key` (latest version) |
| `LLM_CONNECTOR_ID` | e.g. `Anthropic-Claude-Sonnet-4-6` (optional) |
| `AGENT_BUILDER_AGENT_ID` | `sg-food-concierge` (optional) |

Do **not** upload your local `.env` file.

### Health check (optional)

Under **Containers → Health checks**:

- **Startup probe:** HTTP GET `/health` on port `8080`
- **Liveness probe:** HTTP GET `/health` on port `8080`

9. Click **Create** (or **Deploy**).  
   Cloud Build runs the Dockerfile (~3–5 min first time).

---

## Step 4 — Verify

When deploy finishes, Cloud Run shows a URL like:

`https://sg-food-search-demo-xxxxxxxxxx-as.a.run.app`

1. Open the URL — you should see **SG Food Discovery**.
2. Health: `https://YOUR-URL/health` → `{"status":"ok"}`
3. API docs: `https://YOUR-URL/docs`
4. Run a text search (e.g. demo **Halal lunch near Bugis**).
5. Open **Discover** — should list food scenes if embeddings were backfilled.

---

## Step 5 — Redeploy after code changes

1. Push to `main` on GitHub.
2. Cloud Run → your service → **Continuous deployment** tab → trigger should run automatically,  
   **or** Cloud Run → service → **Edit & deploy new revision** → **Deploy**.

---

## Optional — Custom domain

1. Cloud Run → service → **Manage custom domains**.
2. Follow the wizard to map a domain you own (DNS verification in Cloud Console).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| Blank page / 404 on refresh | Rare with `html=True` SPA mount | Redeploy; check build logs include `web/dist` |
| Search returns error | Bad `ELASTICSEARCH_URL` / `ES_API_KEY` | Check env vars; test key in Kibana Dev Tools |
| `401` / `403` from Elastic | IP-restricted API key | Remove IP restriction for Cloud Run |
| Discover empty | No clustering embeddings | Run `prep-demo.sh` once against the cluster |
| Concierge unavailable | Missing `LLM_CONNECTOR_ID` or agent | Set env var; run `setup_agent_builder.py` once on Kibana |
| Slow first request | Cold start (min instances = 0) | Set **Minimum instances** to `1` in Cloud Run (costs more) |
| Build fails | Missing `web/package-lock.json` | Ensure lockfile is committed |

**Build logs:** [Cloud Build history](https://console.cloud.google.com/cloud-build/builds)  
**Runtime logs:** Cloud Run → service → **Logs**

---

## What gets deployed

The `Dockerfile`:

1. Builds the React app (`npm ci` + `npm run build`)
2. Copies Python API, `data/`, `assets/`, and `web/dist/` into a slim image
3. Starts `uvicorn api.main:app` on `$PORT` (8080)

`.env` is **not** in the image (listed in `.dockerignore`).

---

## Cost (rough)

With **min instances = 0** and light demo traffic, expect **near free tier** for Cloud Run + small Cloud Build minutes. You still pay for **Elastic Cloud** usage separately.

---

## CLI alternative

If you later install the Google Cloud SDK, see `scripts/deploy-cloudrun.sh` and the README **Deploy to Google Cloud Run** section.

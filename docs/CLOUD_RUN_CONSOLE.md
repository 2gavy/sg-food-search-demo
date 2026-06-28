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

### GitHub / Cloud Build not pulling or building

Cloud Run does **not** read GitHub directly. The chain is:

```
GitHub push → Cloud Build trigger → docker build (Dockerfile) → Artifact Registry → Cloud Run revision
```

If nothing happens after push, or setup can’t see your repo, work through these in order.

#### 1. GitHub app can access the repo

1. Open **GitHub** → **Settings** → **Applications** (or [github.com/settings/installations](https://github.com/settings/installations)).
2. Find **Google Cloud Build** (and/or **Google Cloud Run** if listed).
3. Click **Configure** → **Repository access**:
   - Either **All repositories**, or
   - **Only select repositories** and include **`2gavy/sg-food-search-demo`**.
4. Save.

In GCP: Cloud Run → your service → **Continuous deployment** → **Manage connected repositories** → confirm `sg-food-search-demo` appears.

#### 2. Connect repo in Cloud Build (2nd gen) first

Sometimes Cloud Run setup won’t list repos until Cloud Build has them:

1. [Cloud Build → Repositories](https://console.cloud.google.com/cloud-build/repositories)
2. **Link repository** → GitHub → authorize → select `2gavy/sg-food-search-demo`
3. Region: same as Cloud Run (e.g. `asia-southeast1`)
4. Then return to Cloud Run → **Edit & deploy new revision** → reconnect source / re-save trigger

#### 3. IAM roles (your Google account)

Your login needs these on the **GCP project** ([IAM](https://console.cloud.google.com/iam-admin/iam)):

| Role | Why |
|------|-----|
| **Cloud Build Editor** | Create/run builds |
| **Cloud Run Admin** (or Developer) | Deploy revisions |
| **Artifact Registry Administrator** (or Writer) | Store built images |
| **Service Account User** | Act as runtime service account |
| **Service Usage Admin** | Enable APIs (one-time) |

If you’re not project Owner, ask whoever owns the project to grant these.

#### 4. Cloud Build service account (common `PERMISSION_DENIED` fix)

1. **Home** → **Project settings** → copy **Project number** (not project ID).
2. [IAM](https://console.cloud.google.com/iam-admin/iam) → **Grant access**:
   - Principal: `PROJECT_NUMBER@cloudbuild.gserviceaccount.com`
   - Role: **Cloud Build Service Account** (`Cloud Build builds builder`)
3. Also grant that same principal:
   - **Cloud Run Admin**
   - **Artifact Registry Writer**
   - **Service Account User** (on the Cloud Run runtime SA, often `PROJECT_NUMBER-compute@developer.gserviceaccount.com`)

Google often auto-grants these on first “deploy from repo”; if setup was interrupted, they may be missing.

#### 5. Confirm the build actually ran

1. [Cloud Build → History](https://console.cloud.google.com/cloud-build/builds)
2. After pushing to `main`, you should see a new build within ~1 minute.
3. If **no build appears** → GitHub trigger/connection issue (steps 1–2).
4. If **build fails** → open the log (often `npm ci`, Dockerfile path, or API not enabled).

Repo is public and `Dockerfile` is on `main`:  
https://github.com/2gavy/sg-food-search-demo/blob/main/Dockerfile

#### 6. Manual “run build now” (console)

Without CLI:

1. Cloud Build → **Triggers** → open the trigger Cloud Run created (or create one: event = Push to `main`, Dockerfile `/Dockerfile`).
2. **Run** → pick branch `main`.
3. When build succeeds, Cloud Run → service → **Revisions** should show a new revision, or click **Edit & deploy** and select the new image.

#### 7. Fallback — deploy without GitHub CD

If GitHub linking stays blocked:

1. Cloud Run → **Create service** → **Deploy one revision from an existing container image**
2. You still need an image in Artifact Registry — someone with `gcloud` or a one-off Cloud Build “Run” from uploaded source can produce it.

For this demo, fixing GitHub + Cloud Build (steps 1–4) is usually faster than the fallback.

#### 8. `gen1_repo_trigger` + `INVALID_ARGUMENT` (your error)

Error text like:

`request_mode:gen1_repo_trigger` … `RunBuildTrigger` … `INVALID_ARGUMENT`

means Cloud Run created a **1st-generation** GitHub trigger, but your repo is (or should be) on **2nd-generation** Cloud Build connections. The trigger fires but cannot start a build.

**Fix in the console (recommended):**

1. **Delete the broken trigger**  
   [Cloud Build → Triggers](https://console.cloud.google.com/cloud-build/triggers) → find `sg-food-search-demo` (or similar) → **Delete**.

2. **Set up 2nd-gen GitHub connection**  
   [Cloud Build → Repositories](https://console.cloud.google.com/cloud-build/repositories) (not the old “Triggers → Connect repository” gen1 flow):
   - **Create host connection** → GitHub → complete GitHub app install
   - **Link repository** → `https://github.com/2gavy/sg-food-search-demo`
   - Region: **`asia-southeast1`** (same as Cloud Run)

3. **Create a new 2nd-gen trigger manually**  
   Cloud Build → Triggers → **Create trigger**:
   - Event: Push to branch `^main$`
   - Source: **2nd gen** → pick your linked `sg-food-search-demo` repo
   - Config: **Cloud Build configuration file** → `cloudbuild.yaml` (in repo root)
   - Substitutions (if prompted): `_SERVICE_NAME=sg-food-search-demo`, `_REGION=asia-southeast1`
   - Service account: pick default Cloud Build SA or one with **Cloud Build Service Account** + **Cloud Run Admin** + **Artifact Registry Writer**

4. **Run trigger once** → **Run** → branch `main` → confirm build in [History](https://console.cloud.google.com/cloud-build/builds).

5. **Cloud Run env vars** — if this trigger only builds/pushes (not deploy), attach image on Cloud Run manually; our `cloudbuild.yaml` also runs `gcloud run deploy`. Set `ELASTICSEARCH_URL`, `ES_API_KEY`, etc. on the Cloud Run service **after** first deploy.

6. **Re-link Cloud Run CD (optional)**  
   Cloud Run → service → Continuous deployment → connect to the **new** 2nd-gen trigger, or rely on `cloudbuild.yaml` deploy step.

**Also check:** default Cloud Build service account `PROJECT_NUMBER@cloudbuild.gserviceaccount.com` is **enabled** (not disabled by org policy) and has roles in §4 above.

---

### Runtime / app issues

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| Blank page / 404 on refresh | Rare with `html=True` SPA mount | Redeploy; check build logs include `web/dist` |
| Search returns error | Bad `ELASTICSEARCH_URL` / `ES_API_KEY` | Check env vars; test key in Kibana Dev Tools |
| `401` / `403` from Elastic | IP-restricted API key | Remove IP restriction for Cloud Run |
| Discover empty | No clustering embeddings | Run `prep-demo.sh` once against the cluster |
| Concierge unavailable | Missing `LLM_CONNECTOR_ID` or agent | Set env var; run `setup_agent_builder.py` once on Kibana |
| Slow first request | Cold start (min instances = 0) | Set **Minimum instances** to `1` in Cloud Run (costs more) |
| Build fails | Missing `web/package-lock.json` | Ensure lockfile is committed |
| `PERMISSION_DENIED` on trigger | Cloud Build SA missing roles | See §4 above |

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

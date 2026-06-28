# Continuous deploy from GitHub (Cloud Build 2nd gen)

Push to `main` → Cloud Build → Cloud Run. **No Developer Connect.**

The `gen1_repo_trigger` error happens when Cloud Run’s wizard creates a **1st-generation** GitHub trigger. Fix: link the repo as **Cloud Build 2nd gen** first, then create a **2nd gen trigger** and attach it to Cloud Run.

---

## Step 0 — Clean up (if you tried before)

1. [Cloud Run](https://console.cloud.google.com/run) → delete **`sg-food-search-demo`**
2. [Cloud Build → Triggers](https://console.cloud.google.com/cloud-build/triggers) → delete **every** trigger for this app (global and regional)

---

## Step 1 — Enable APIs

[API Library](https://console.cloud.google.com/apis/library):

- **Cloud Build API**
- **Artifact Registry API**
- **Cloud Run API**

---

## Step 2 — Link GitHub (2nd gen, not gen1)

1. Open [Cloud Build → Repositories](https://console.cloud.google.com/cloud-build/repositories)  
   (left nav: **Repositories**, not the old “Triggers → Connect” gen1 flow)

2. **Region** (top): choose **`asia-southeast1`** — must match Cloud Run.

3. **Create host connection** → **GitHub** → authorize → install **Cloud Build** GitHub app.

4. **Link repository**:
   - URI: `https://github.com/2gavy/sg-food-search-demo`
   - Name: e.g. `sg-food-search-demo`

5. Wait until connection status is **Complete** / repo shows as linked.

---

## Step 3 — Create a build service account (required)

Newer projects **do not** show `…@cloudbuild.gserviceaccount.com` in the trigger dropdown. You must **create your own** service account first.

### 3a — Create the account

1. [IAM → Service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) → **Create service account**
2. **Name:** `cloudbuild-deploy` → **Create and continue**
3. **Grant roles** (project-level, on this screen):

| Role |
|------|
| Cloud Build Service Account |
| Cloud Run Admin |
| Artifact Registry Writer |
| Logs Writer |
| Service Account User |

4. **Done**

Email will be: **`cloudbuild-deploy@YOUR_PROJECT_ID.iam.gserviceaccount.com`**

### 3b — Let *you* use it on triggers

Cloud Build triggers need **`iam.serviceAccounts.actAs`** on the SA (your user, not the SA itself).

1. Service accounts → click **`cloudbuild-deploy`**
2. **Permissions** tab → **Grant access**
3. **New principals:** your Google account email (the one logged into console)
4. **Role:** **Service Account User**
5. **Save**

### 3c — Optional: enable legacy Cloud Build SA

Only if you see **`PROJECT_NUMBER@cloudbuild.gserviceaccount.com`** in IAM and want to use it instead — many projects don’t have it. If missing, skip; use `cloudbuild-deploy` above.

---

## Step 4 — Create a 2nd gen trigger (console)

[Cloud Build → Triggers](https://console.cloud.google.com/cloud-build/triggers) → **Create trigger**

| Field | Value |
|--------|--------|
| Name | `sg-food-search-demo-main` |
| Region | **`asia-southeast1`** |
| Event | Push to a branch |
| Source | **2nd gen** → pick linked `sg-food-search-demo` |
| Branch | `^main$` |
| Config | **Cloud Build configuration file** |
| Location | Repository → `cloudbuild.yaml` |
| **Service account** | **`cloudbuild-deploy@YOUR_PROJECT_ID.iam.gserviceaccount.com`** |

**Service account field:** pick **`cloudbuild-deploy`** from the list.  
- **Do not** pick Compute Engine default (`…-compute@developer.gserviceaccount.com`) — that causes `invalid value for build.service_account`.  
- If the dropdown is empty, you skipped Step 3 — create the SA first, then refresh this page.

**Substitutions** (if the form shows them):

| Key | Value |
|-----|--------|
| `_SERVICE_NAME` | `sg-food-search-demo` |
| `_REGION` | `asia-southeast1` |

Click **Create**.

### Test the trigger

**Run** → branch `main`.  
Open [Build history](https://console.cloud.google.com/cloud-build/builds) — you want a **real build log**, not `gen1_repo_trigger`.

- If build **succeeds** → Cloud Run service `sg-food-search-demo` should appear (our `cloudbuild.yaml` runs `gcloud run deploy`).
- If build **fails** → fix from the log (IAM, Dockerfile, npm, etc.) before step 5.

---

## Step 5 — Set env vars on Cloud Run (once)

After first successful build:

1. [Cloud Run](https://console.cloud.google.com/run) → **`sg-food-search-demo`** → **Edit & deploy new revision**
2. **Variables & secrets**:

| Name | Value |
|------|--------|
| `ELASTICSEARCH_URL` | your Elastic URL |
| `ES_API_KEY` | your API key |
| `LLM_CONNECTOR_ID` | optional |

3. **Deploy** (env vars persist on later CD deploys if `cloudbuild.yaml` only updates the image).

---

## Step 6 — Attach trigger to Cloud Run (continuous deploy link)

So Cloud Run UI shows “deploying from repository” and push-to-deploy stays wired:

1. Cloud Build → Triggers → open `sg-food-search-demo-main`
2. Copy the **Trigger ID** (UUID in URL or trigger details — **not** the display name)

3. Cloud Run → `sg-food-search-demo` → **Labels** → add:

| Key | Value |
|-----|--------|
| `gcb-trigger-id` | paste trigger UUID |

4. Push a commit to `main` — build should run automatically within ~1 min.

---

## Optional — Cloud Run “Connect repository” wizard

Only after steps 2–4 work:

- Cloud Run → service → **Connect to repo** → **Cloud Build** (not Developer Connect)
- Pick the **2nd gen** linked repo from the list
- Dockerfile `/Dockerfile` or config `cloudbuild.yaml`

If the wizard **still** creates a gen1 trigger and fails, **ignore the wizard** — steps 4 + 6 (manual 2nd gen trigger + label) are the supported fix.

---

## Repo files used

| File | Purpose |
|------|---------|
| `Dockerfile` | Builds React + FastAPI image |
| `cloudbuild.yaml` | Build, push to Artifact Registry, `gcloud run deploy` |

Both are on `main`: https://github.com/2gavy/sg-food-search-demo

---

## Checklist

- [ ] Repo linked under **Cloud Build → Repositories** (2nd gen), region `asia-southeast1`
- [ ] Trigger source = **2nd gen** (not “1st generation”)
- [ ] Trigger config = `cloudbuild.yaml`
- [ ] Manual **Run** succeeds before relying on git push
- [ ] Env vars set on Cloud Run service
- [ ] Label `gcb-trigger-id` on Cloud Run service

---

## Troubleshooting

### `invalid value for build.service_account`

Usually: trigger uses **Compute Engine default** (`…-compute@…`) or no valid SA exists.

1. Complete **Step 3** — create **`cloudbuild-deploy`** (most projects have no `@cloudbuild` account in the dropdown)
2. Edit trigger → **Service account** → **`cloudbuild-deploy@YOUR_PROJECT_ID.iam.gserviceaccount.com`**
3. Ensure **you** have **Service Account User** on that SA (Step 3b)
4. **Save** → **Run**

### Dropdown has no `@cloudbuild` account

Normal on new projects. Create **`cloudbuild-deploy`** (Step 3) and select that — do not leave Compute default selected.

### `gen1_repo_trigger` / `INVALID_ARGUMENT` on Run

Delete the trigger and recreate using **2nd gen** repo source (Step 2 + 4), not the Cloud Run gen1 wizard.

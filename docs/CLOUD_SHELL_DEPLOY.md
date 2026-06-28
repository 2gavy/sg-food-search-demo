# Deploy from Cloud Shell (bypasses broken Cloud Run ↔ GitHub wizard)

Use this when **Continuous deploy from repository** fails with `gen1_repo_trigger` or `INVALID_ARGUMENT`.

You only need a browser — no local `gcloud`, no manual Cloud Build triggers.

## 1. Open Cloud Shell

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (top bar)
3. Click the **>_** icon (top right) → **Cloud Shell** opens at the bottom

## 2. Paste and run (replace env values)

```bash
export PROJECT_ID="YOUR_GCP_PROJECT_ID"
export REGION="asia-southeast1"
export SERVICE="sg-food-search-demo"

# Elastic credentials (same as your local .env)
export ELASTICSEARCH_URL="https://YOUR-PROJECT.es.region.aws.elastic.cloud:443"
export ES_API_KEY="your-api-key"
export LLM_CONNECTOR_ID="Anthropic-Claude-Sonnet-4-6"   # optional, for Concierge

gcloud config set project "$PROJECT_ID"

gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

rm -rf sg-food-search-demo
git clone https://github.com/2gavy/sg-food-search-demo.git
cd sg-food-search-demo

gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --port 8080 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "ELASTICSEARCH_URL=${ELASTICSEARCH_URL},ES_API_KEY=${ES_API_KEY},LLM_CONNECTOR_ID=${LLM_CONNECTOR_ID}"
```

**Build takes ~5–8 minutes** the first time. Cloud Shell uploads source and runs Cloud Build — **not** the broken gen1 GitHub trigger.

## 3. Get the URL

The command prints:

```
Service URL: https://sg-food-search-demo-xxxxx-as.a.run.app
```

Open it → test search → `/health`

## 4. Redeploy after code changes

```bash
cd ~/sg-food-search-demo
git pull
gcloud run deploy "$SERVICE" --source . --region "$REGION" \
  --set-env-vars "ELASTICSEARCH_URL=${ELASTICSEARCH_URL},ES_API_KEY=${ES_API_KEY},LLM_CONNECTOR_ID=${LLM_CONNECTOR_ID}"
```

---

## If `gcloud run deploy --source` fails

**Permission denied:** Your account needs **Cloud Run Admin**, **Cloud Build Editor**, **Artifact Registry Administrator**, **Service Account User**.

Grant them in [IAM](https://console.cloud.google.com/iam-admin/iam) for your user, or ask project owner.

**Default Cloud Build SA disabled:** Enable `PROJECT_NUMBER@cloudbuild.gserviceaccount.com` and grant **Cloud Build Service Account** + **Cloud Run Admin** + **Artifact Registry Writer**.

**Build log:** Click the Cloud Build link in the error, or open [Build history](https://console.cloud.google.com/cloud-build/builds).

---

## Alternative: GitHub Actions (auto deploy on push)

See [`.github/workflows/deploy-cloudrun.yml`](../.github/workflows/deploy-cloudrun.yml) — one-time setup of `GCP_SA_KEY` secret, then every push to `main` deploys without the Cloud Run wizard.

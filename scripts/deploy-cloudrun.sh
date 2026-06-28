#!/usr/bin/env bash
# Deploy sg-food-search-demo to Google Cloud Run (builds from Dockerfile in repo root).
#
# Prerequisites:
#   gcloud auth login
#   gcloud config set project YOUR_PROJECT_ID
#
# Required env (or pass inline before running):
#   ELASTICSEARCH_URL, ES_API_KEY
# Optional: LLM_CONNECTOR_ID, AGENT_BUILDER_AGENT_ID, KIBANA_URL, KIBANA_API_KEY
#
# Usage:
#   export ELASTICSEARCH_URL=...
#   export ES_API_KEY=...
#   ./scripts/deploy-cloudrun.sh
#
set -euo pipefail

SERVICE="${SERVICE:-sg-food-search-demo}"
REGION="${REGION:-asia-southeast1}"
PROJECT="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"

if [[ -z "${PROJECT}" || "${PROJECT}" == "(unset)" ]]; then
  echo "Set GCP project: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

if [[ -z "${ELASTICSEARCH_URL:-}" || -z "${ES_API_KEY:-}" ]]; then
  echo "Export ELASTICSEARCH_URL and ES_API_KEY before deploying."
  exit 1
fi

ENV_VARS="ELASTICSEARCH_URL=${ELASTICSEARCH_URL},ES_API_KEY=${ES_API_KEY}"
if [[ -n "${LLM_CONNECTOR_ID:-}" ]]; then
  ENV_VARS+=",LLM_CONNECTOR_ID=${LLM_CONNECTOR_ID}"
fi
if [[ -n "${AGENT_BUILDER_AGENT_ID:-}" ]]; then
  ENV_VARS+=",AGENT_BUILDER_AGENT_ID=${AGENT_BUILDER_AGENT_ID}"
fi
if [[ -n "${KIBANA_URL:-}" ]]; then
  ENV_VARS+=",KIBANA_URL=${KIBANA_URL}"
fi
if [[ -n "${KIBANA_API_KEY:-}" ]]; then
  ENV_VARS+=",KIBANA_API_KEY=${KIBANA_API_KEY}"
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Deploying ${SERVICE} to Cloud Run (${REGION}, project ${PROJECT})…"

gcloud run deploy "${SERVICE}" \
  --source . \
  --region "${REGION}" \
  --project "${PROJECT}" \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "${ENV_VARS}"

echo "Done. URL:"
gcloud run services describe "${SERVICE}" --region "${REGION}" --project "${PROJECT}" \
  --format 'value(status.url)'

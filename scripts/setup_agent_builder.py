#!/usr/bin/env python3
"""Register Agent Builder agent and prepare workflow imports."""

from __future__ import annotations

import sys
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from api.config import AGENT_BUILDER_AGENT_ID, KIBANA_API_KEY, KIBANA_URL

API_BASE = __import__("os").getenv("API_BASE", "http://127.0.0.1:8000")

DEFAULT_TOOL_IDS = ["platform.core.search", "platform.core.get_document_by_id"]


def headers() -> dict:
    return {"Authorization": f"ApiKey {KIBANA_API_KEY}", "kbn-xsrf": "true", "Content-Type": "application/json"}


def substitute_workflow(content: str) -> str:
    import os

    return (
        content.replace("__ES_URL__", os.getenv("ELASTICSEARCH_URL", ""))
        .replace("__ES_API_KEY__", os.getenv("ES_API_KEY", ""))
        .replace("__API_BASE__", API_BASE)
    )


def ensure_agent() -> bool:
    base = KIBANA_URL.rstrip("/")
    agent_path = ROOT / "agents" / "sg-food-concierge.yaml"
    agent_yaml = yaml.safe_load(agent_path.read_text())

    existing = requests.get(f"{base}/api/agent_builder/agents/{AGENT_BUILDER_AGENT_ID}", headers=headers(), timeout=30)
    if existing.ok:
        print(f"Agent already exists: {AGENT_BUILDER_AGENT_ID}")
        return True

    payload = {
        "id": AGENT_BUILDER_AGENT_ID,
        "name": agent_yaml["name"],
        "description": agent_yaml["description"],
        "labels": ["sg-food", "demo", "search"],
        "avatar_color": "#D1FAE5",
        "avatar_symbol": "🍜",
        "configuration": {
            "instructions": agent_yaml["system_prompt"],
            "tools": [{"tool_ids": DEFAULT_TOOL_IDS}],
        },
    }
    resp = requests.post(f"{base}/api/agent_builder/agents", headers=headers(), json=payload, timeout=60)
    if resp.ok:
        print(f"Created agent: {AGENT_BUILDER_AGENT_ID}")
        return True

    print(f"Failed to create agent ({resp.status_code}): {resp.text[:400]}")
    return False


def main() -> None:
    if not KIBANA_URL or not KIBANA_API_KEY:
        print("Set ELASTICSEARCH_URL and ES_API_KEY in .env (Kibana URL/key are derived automatically).")
        print("Workflow YAML files are in workflows/ for manual import.")
        print("Agent definition: agents/sg-food-concierge.yaml")
        return

    wf_dir = ROOT / "workflows"
    for path in sorted(wf_dir.glob("*.yaml")):
        print(f"Workflow ready for import: {path.name}")
        out = ROOT / "workflows" / "generated" / path.name
        out.parent.mkdir(exist_ok=True)
        out.write_text(substitute_workflow(path.read_text()))

    ensure_agent()

    resp = requests.get(f"{KIBANA_URL.rstrip('/')}/api/agent_builder/tools", headers=headers(), timeout=30)
    if resp.ok:
        existing = {t["name"]: t["id"] for t in resp.json().get("results", resp.json()) if isinstance(t, dict)}
        print(f"Platform tools available: {len(existing)}")
    else:
        print("Could not list tools:", resp.status_code, resp.text[:200])

    print("\nOptional next steps:")
    print("1. Kibana → Workflows → Import from workflows/generated/")
    print("2. Add custom workflow tools to the agent in Kibana if needed")


if __name__ == "__main__":
    main()

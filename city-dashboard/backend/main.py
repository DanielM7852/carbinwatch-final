"""CarbinWatcher backend — FastAPI + Gemini agent scaffold.

Tools hit DynamoDB for live state. Databricks SQL (for impact score) and the
Gemini tool-calling loop are still TODOs.
"""

from __future__ import annotations

import os
from decimal import Decimal
from functools import lru_cache
from typing import Any, Callable

import boto3
import requests
from boto3.dynamodb.conditions import Key
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="CarbinWatcher API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- AWS helpers ----------

@lru_cache(maxsize=1)
def _dynamo_table():
    region = os.getenv("AWS_REGION", "us-east-2")
    name = os.getenv("DYNAMODB_TABLE", "carbinwatcher-state")
    return boto3.resource("dynamodb", region_name=region).Table(name)


def _unwrap(v: Any) -> Any:
    if isinstance(v, Decimal):
        return int(v) if v % 1 == 0 else float(v)
    if isinstance(v, list):
        return [_unwrap(x) for x in v]
    if isinstance(v, dict):
        return {k: _unwrap(x) for k, x in v.items()}
    return v


# ---------- Databricks helpers ----------
# Using the SQL Statement Execution REST API directly (the databricks-sql-connector
# client library was hanging on cold warehouse starts in testing).

DBX_GOLD_TABLE = "workspace.default.gold_impact_scientific"
DBX_TEST_TABLE = "workspace.default.test_transformed"
DBX_AGG_TABLE  = "workspace.default.sandiego_aggregates"


def _databricks_sql(statement: str) -> dict[str, Any]:
    host = os.environ["DATABRICKS_HOST"]  # hostname only, no https://
    token = os.environ["DATABRICKS_TOKEN"]
    warehouse_id = os.environ["DATABRICKS_HTTP_PATH"].rsplit("/", 1)[-1]
    r = requests.post(
        f"https://{host}/api/2.0/sql/statements",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "warehouse_id": warehouse_id,
            "statement": statement,
            "wait_timeout": "30s",
        },
        timeout=35,
    )
    r.raise_for_status()
    body = r.json()
    if body.get("status", {}).get("state") != "SUCCEEDED":
        raise RuntimeError(f"Databricks query failed: {body.get('status')}")
    cols = [c["name"] for c in body.get("manifest", {}).get("schema", {}).get("columns", [])]
    rows = body.get("result", {}).get("data_array") or []
    return {"columns": cols, "rows": rows}


# ---------- Schemas ----------

class ChatRequest(BaseModel):
    message: str
    user_id: str


class ChatResponse(BaseModel):
    reply: str
    tools_used: list[str]


# ---------- Tool functions ----------

_CATEGORY_ALIAS = {"recycle": "recycling"}


def get_user_totals(user_id: str, limit: int = 50) -> dict[str, Any]:
    resp = _dynamo_table().query(KeyConditionExpression=Key("user_id").eq(user_id))
    items = [_unwrap(i) for i in resp.get("Items", [])]
    items.sort(key=lambda x: x.get("ts", ""), reverse=True)

    # Normalize each item so downstream always sees `volume_ml` and `category`,
    # regardless of which producer pipeline emitted them. Values are treated as mL.
    for it in items:
        v = it.get("volume_ml")
        if v in (None, 0, 0.0):
            v = it.get("volume_l") or it.get("volume_liters_est") or it.get("weight_kg_est") or 0
        it["volume_ml"] = float(v or 0)

        cat = it.get("category") or it.get("bin") or "unknown"
        it["category"] = _CATEGORY_ALIAS.get(cat, cat)

    by_cat: dict[str, dict[str, float]] = {}
    for it in items:
        cat = it["category"]
        b = by_cat.setdefault(cat, {"items": 0, "volume_ml": 0.0})
        b["items"] += 1
        b["volume_ml"] = round(b["volume_ml"] + it["volume_ml"], 2)

    return {
        "user_id": user_id,
        "item_count": len(items),
        "totals_by_category": by_cat,
        "recent_items": items[:limit],
    }


def _float(v: Any) -> float:
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _int(v: Any) -> int:
    try:
        return int(v) if v is not None else 0
    except (TypeError, ValueError):
        return 0


def calculate_climate_impact(user_id: str) -> dict[str, Any]:
    """Query Databricks gold_impact_scientific for the user's latest row."""
    stmt = (
        f"SELECT * FROM {DBX_GOLD_TABLE} "
        f"WHERE user_id = '{user_id}' "
        f"ORDER BY date DESC LIMIT 1"
    )
    try:
        result = _databricks_sql(stmt)
    except Exception as exc:
        return {"user_id": user_id, "error": str(exc), "available": False}

    if not result["rows"]:
        return {"user_id": user_id, "available": False, "message": "no data yet"}

    row = dict(zip(result["columns"], result["rows"][0]))
    return {
        "user_id": user_id,
        "available": True,
        "date": row.get("date"),
        "items": {
            "tossed":    _int(row.get("items_tossed")),
            "recycled":  _int(row.get("items_recycled")),
            "composted": _int(row.get("items_composted")),
            "landfill":  _int(row.get("items_landfill")),
        },
        "sorting_accuracy_pct":          _float(row.get("sorting_accuracy_pct")),
        "co2_saved_kg":                  _float(row.get("total_co2_saved_kg")),
        "co2_saved_lbs":                 _float(row.get("total_co2_saved_lbs")),
        "co2_actual_kg":                 _float(row.get("total_co2_actual_kg")),
        "co2_baseline_kg":               _float(row.get("total_co2_baseline_kg")),
        "temp_reduction_c":              _float(row.get("temp_reduction_celsius")),
        "temp_reduction_f":              _float(row.get("temp_reduction_fahrenheit")),
        "cooling_hours_offset_avg":      _float(row.get("cooling_hours_offset_avg")),
        "cooling_hours_offset_critical": _float(row.get("cooling_hours_offset_critical")),
        "processed_at": str(row.get("_processed_timestamp", "")),
    }


def get_waste_breakdown_by_category(user_id: str, period: str = "week") -> dict[str, Any]:
    # Derived from DynamoDB items — reuse get_user_totals then re-shape
    totals = get_user_totals(user_id)
    breakdown: dict[str, list[dict[str, Any]]] = {}
    for it in totals["recent_items"]:
        breakdown.setdefault(it.get("category", "unknown"), []).append(
            {"item": it.get("item"), "weight_kg": it.get("weight_kg_est")}
        )
    return {"user_id": user_id, "period": period, "breakdown": breakdown}


def get_items_at_risk_of_spoiling(user_id: str) -> list[dict[str, Any]]:
    # TODO: real spoilage model. Hackathon stub until we have fridge timestamps.
    return [
        {"item": "spinach", "days_in_fridge": 6, "spoilage_risk": "high"},
        {"item": "greek yogurt", "days_in_fridge": 10, "spoilage_risk": "medium"},
        {"item": "strawberries", "days_in_fridge": 4, "spoilage_risk": "medium"},
    ]


TOOL_REGISTRY: dict[str, Callable[..., Any]] = {
    "get_user_totals": get_user_totals,
    "calculate_climate_impact": calculate_climate_impact,
    "get_waste_breakdown_by_category": get_waste_breakdown_by_category,
    "get_items_at_risk_of_spoiling": get_items_at_risk_of_spoiling,
}


# ---------- Routes ----------

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/live")
def live(user_id: str = "u1", limit: int = 50) -> dict[str, Any]:
    return get_user_totals(user_id, limit=limit)


@app.get("/impact-score")
def impact_score(user_id: str = "u1") -> dict[str, Any]:
    return calculate_climate_impact(user_id)


def get_test_weight(user_id: str = "u1", limit: int = 50) -> dict[str, Any]:
    stmt = (
        f"SELECT ts, item, category, volume_ml, co2_kg, "
        f"       ocean_heat_j, seawater_warm_l, temp_reduce_f "
        f"FROM {DBX_TEST_TABLE} "
        f"WHERE user_id = '{user_id}' "
        f"ORDER BY ts DESC LIMIT {limit}"
    )
    try:
        result = _databricks_sql(stmt)
    except Exception as exc:
        return {"available": False, "error": str(exc), "rows": []}
    rows = [
        {
            "ts":              r[0],
            "item":            r[1],
            "category":        r[2],
            "volume_ml":       float(r[3]) if r[3] is not None else 0.0,
            "co2_kg":          float(r[4]) if r[4] is not None else 0.0,
            "ocean_heat_j":    float(r[5]) if r[5] is not None else 0.0,
            "seawater_warm_l": float(r[6]) if r[6] is not None else 0.0,
            "temp_reduce_f":   float(r[7]) if r[7] is not None else 0.0,
        }
        for r in result["rows"]
    ]
    return {"available": True, "user_id": user_id, "count": len(rows), "rows": rows}


@app.get("/test-weight")
def test_weight(user_id: str = "u1", limit: int = 50) -> dict[str, Any]:
    return get_test_weight(user_id, limit=limit)


def get_aggregates() -> dict[str, Any]:
    stmt = (
        f"SELECT scope, label, events, co2_kg, co2_tons, ocean_heat_gj, "
        f"       seawater_warm_l, trees_equiv, cars_off_road_equiv, households, days "
        f"FROM {DBX_AGG_TABLE} "
        f"ORDER BY CASE scope "
        f"  WHEN 'device_sample' THEN 1 "
        f"  WHEN 'household_annual' THEN 2 "
        f"  WHEN 'sandiego_annual' THEN 3 "
        f"  ELSE 4 END"
    )
    try:
        result = _databricks_sql(stmt)
    except Exception as exc:
        return {"available": False, "error": str(exc), "scopes": []}
    scopes = [
        {
            "scope":              r[0],
            "label":              r[1],
            "events":             int(r[2]) if r[2] is not None else 0,
            "co2_kg":             float(r[3]) if r[3] is not None else 0.0,
            "co2_tons":           float(r[4]) if r[4] is not None else 0.0,
            "ocean_heat_gj":      float(r[5]) if r[5] is not None else 0.0,
            "seawater_warm_l":    float(r[6]) if r[6] is not None else 0.0,
            "trees_equiv":        float(r[7]) if r[7] is not None else 0.0,
            "cars_off_road_equiv": float(r[8]) if r[8] is not None else 0.0,
            "households":         int(r[9]) if r[9] is not None else 0,
            "days":               int(r[10]) if r[10] is not None else 0,
        }
        for r in result["rows"]
    ]
    return {"available": True, "scopes": scopes}


@app.get("/aggregates")
def aggregates() -> dict[str, Any]:
    return get_aggregates()


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    # TODO: wire up Gemini tool-calling loop here.
    return ChatResponse(
        reply=f"[stub] received: {req.message!r} for user {req.user_id}",
        tools_used=[],
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("API_PORT", "8000")))

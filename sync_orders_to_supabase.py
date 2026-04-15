import json
import os
from decimal import Decimal
from typing import Any

import requests

RETAILCRM_BASE_URL = os.getenv("RETAILCRM_BASE_URL")
RETAILCRM_ORIGIN = os.getenv("RETAILCRM_ORIGIN")
RETAILCRM_API_KEY = os.getenv("RETAILCRM_API_KEY")
RETAILCRM_SITE = os.getenv("RETAILCRM_SITE")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_TABLE = os.getenv("SUPABASE_TABLE", "retailcrm_orders")

PAGE_LIMIT = int(os.getenv("RETAILCRM_PAGE_LIMIT", "100"))
SUPABASE_BATCH_SIZE = int(os.getenv("SUPABASE_BATCH_SIZE", "100"))
TIMEOUT = int(os.getenv("HTTP_TIMEOUT", "30"))

TABLE_SQL = f"""
create table if not exists public.{SUPABASE_TABLE} (
    retailcrm_id bigint primary key,
    external_id text,
    number text,
    site text,
    status text,
    order_type text,
    order_method text,
    first_name text,
    last_name text,
    phone text,
    email text,
    city text,
    delivery_address text,
    total_summ numeric,
    items_count integer,
    total_quantity numeric,
    created_at timestamptz,
    updated_at timestamptz,
    status_updated_at timestamptz,
    customer_comment text,
    manager_comment text,
    raw jsonb not null
);
"""


def require_env(name: str, value: str | None) -> str:
    if value:
        return value
    raise RuntimeError(f"Environment variable {name} is required.")


def retailcrm_request(
    session: requests.Session,
    method: str,
    path: str,
    *,
    params: list[tuple[str, Any]] | None = None,
) -> dict[str, Any]:
    query_params: list[tuple[str, Any]] = [("apiKey", RETAILCRM_API_KEY)]
    if params:
        query_params.extend(params)

    response = session.request(
        method,
        f"{RETAILCRM_BASE_URL}{path}",
        params=query_params,
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()
    if not payload.get("success", True):
        raise RuntimeError(f"RetailCRM returned an error for {path}: {json.dumps(payload, ensure_ascii=False)}")
    return payload


def get_site_code(session: requests.Session) -> str:
    if RETAILCRM_SITE:
        return RETAILCRM_SITE

    response = session.get(
        f"{RETAILCRM_ORIGIN}/api/credentials",
        params={"apiKey": RETAILCRM_API_KEY},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()
    sites = payload.get("sitesAvailable", [])
    if not sites:
        raise RuntimeError("RetailCRM credentials response does not contain available sites.")
    return sites[0]


def fetch_orders(session: requests.Session, site_code: str) -> list[dict[str, Any]]:
    orders: list[dict[str, Any]] = []
    page = 1

    while True:
        payload = retailcrm_request(
            session,
            "GET",
            "/orders",
            params=[
                ("limit", PAGE_LIMIT),
                ("page", page),
                ("filter[sites][]", site_code),
            ],
        )

        page_orders = payload.get("orders", [])
        orders.extend(page_orders)
        print(f"Fetched page {page}: {len(page_orders)} orders")

        pagination = payload.get("pagination") or {}
        total_pages = pagination.get("totalPageCount")
        if not page_orders:
            break
        if total_pages and page >= total_pages:
            break
        if len(page_orders) < PAGE_LIMIT:
            break
        page += 1

    return orders


def as_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(str(value).replace(",", "."))
    except ValueError:
        return None


def extract_phone(order: dict[str, Any]) -> str | None:
    if order.get("phone"):
        return order["phone"]
    customer = order.get("customer") or {}
    phones = customer.get("phones") or []
    if phones:
        first_phone = phones[0]
        if isinstance(first_phone, dict):
            return first_phone.get("number")
        return str(first_phone)
    return customer.get("phone")


def build_row(order: dict[str, Any]) -> dict[str, Any]:
    customer = order.get("customer") or {}
    delivery = order.get("delivery") or {}
    address = delivery.get("address") or {}
    items = order.get("items") or []

    total_quantity = 0.0
    for item in items:
        quantity = as_float(item.get("quantity")) or 0.0
        total_quantity += quantity

    first_name = (
        order.get("firstName")
        or customer.get("firstName")
        or customer.get("name")
    )
    last_name = order.get("lastName") or customer.get("lastName")
    email = order.get("email") or customer.get("email")

    delivery_address = address.get("text")
    if not delivery_address:
        address_parts = [
            address.get("countryIso"),
            address.get("region"),
            address.get("city"),
            address.get("street"),
            address.get("building"),
            address.get("flat"),
        ]
        delivery_address = ", ".join(str(part) for part in address_parts if part)

    return {
        "retailcrm_id": order["id"],
        "external_id": order.get("externalId"),
        "number": order.get("number"),
        "site": order.get("site"),
        "status": order.get("status"),
        "order_type": order.get("orderType"),
        "order_method": order.get("orderMethod"),
        "first_name": first_name,
        "last_name": last_name,
        "phone": extract_phone(order),
        "email": email,
        "city": address.get("city"),
        "delivery_address": delivery_address,
        "total_summ": as_float(order.get("totalSumm")),
        "items_count": len(items),
        "total_quantity": total_quantity,
        "created_at": order.get("createdAt"),
        "updated_at": order.get("updatedAt"),
        "status_updated_at": order.get("statusUpdatedAt"),
        "customer_comment": order.get("customerComment"),
        "manager_comment": order.get("managerComment"),
        "raw": order,
    }


def chunked(items: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def upsert_rows(session: requests.Session, rows: list[dict[str, Any]]) -> None:
    supabase_url = require_env("SUPABASE_URL", SUPABASE_URL)
    service_role_key = require_env("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY)

    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    for batch_index, batch in enumerate(chunked(rows, SUPABASE_BATCH_SIZE), start=1):
        response = session.post(
            f"{supabase_url}/rest/v1/{SUPABASE_TABLE}",
            params={"on_conflict": "retailcrm_id"},
            headers=headers,
            json=batch,
            timeout=TIMEOUT,
        )
        if not response.ok:
            if response.status_code == 404:
                raise RuntimeError(
                    f"Supabase table '{SUPABASE_TABLE}' does not exist yet. "
                    "Create it first with create_retailcrm_orders_table.sql or TABLE_SQL from this script. "
                    f"Original response: HTTP {response.status_code} {response.text}"
                )
            raise RuntimeError(
                f"Supabase upsert failed for batch {batch_index}: "
                f"HTTP {response.status_code} {response.text}"
            )
        print(f"Upserted batch {batch_index}: {len(batch)} rows")


def main() -> None:
    with requests.Session() as session:
        site_code = get_site_code(session)
        print(f"Using RetailCRM site: {site_code}")

        orders = fetch_orders(session, site_code)
        print(f"Fetched total orders: {len(orders)}")

        rows = [build_row(order) for order in orders]
        upsert_rows(session, rows)

        print(f"Synced to Supabase table '{SUPABASE_TABLE}': {len(rows)} rows")
        print("If the table does not exist yet, create it with this SQL:")
        print(TABLE_SQL.strip())


if __name__ == "__main__":
    main()

import json
import os
from pathlib import Path
from typing import Any

import requests

API_KEY = os.getenv("RETAILCRM_API_KEY")
BASE_URL = os.getenv("RETAILCRM_BASE_URL")
BASE_ORIGIN = os.getenv("RETAILCRM_ORIGIN")
ORDERS_FILE = Path(__file__).with_name("mock_orders.json")
TIMEOUT = 30


def retailcrm_request(
    session: requests.Session,
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    data: dict[str, Any] | None = None,
) -> requests.Response:
    request_params = {"apiKey": API_KEY}
    if params:
        request_params.update(params)

    response = session.request(
        method,
        f"{BASE_URL}{path}",
        params=request_params,
        data=data,
        timeout=TIMEOUT,
    )
    return response


def get_site_code(session: requests.Session) -> str:
    response = session.get(
        f"{BASE_ORIGIN}/api/credentials",
        params={"apiKey": API_KEY},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()

    sites = payload.get("sitesAvailable", [])
    if not sites:
        raise RuntimeError("RetailCRM returned no available sites for this API key.")

    site_code = sites[0]

    print(f"Using site: {site_code}")
    return site_code


def get_reference_code(
    session: requests.Session,
    path: str,
    collection_key: str,
    *,
    preferred_code: str | None = None,
    default_flag: str | None = None,
) -> str:
    response = retailcrm_request(session, "GET", path)
    response.raise_for_status()
    payload = response.json()
    raw_items = payload.get(collection_key, [])
    if isinstance(raw_items, dict):
        items = []
        for code, value in raw_items.items():
            if isinstance(value, dict):
                item = {"code": code, **value}
            else:
                item = {"code": code, "label": value}
            items.append(item)
    else:
        items = raw_items
    if not items:
        raise RuntimeError(f"RetailCRM returned no values for {path}.")

    if preferred_code and any(item.get("code") == preferred_code for item in items):
        return preferred_code

    if default_flag:
        default_item = next((item for item in items if item.get(default_flag)), None)
        if default_item and default_item.get("code"):
            return default_item["code"]

    first_active = next((item for item in items if item.get("active") and item.get("code")), None)
    if first_active:
        return first_active["code"]

    first_item = next((item for item in items if item.get("code")), None)
    if first_item:
        return first_item["code"]

    raise RuntimeError(f"RetailCRM response for {path} does not include a usable code.")


def build_orders(order_type: str, order_method: str, status: str) -> list[dict[str, Any]]:
    raw_orders = json.loads(ORDERS_FILE.read_text(encoding="utf-8"))
    prepared_orders: list[dict[str, Any]] = []

    for index, order in enumerate(raw_orders, start=1):
        prepared = dict(order)
        prepared["externalId"] = f"mock-order-{index:03d}"
        prepared["orderType"] = order_type
        prepared["orderMethod"] = order_method
        prepared["status"] = status
        prepared.pop("customFields", None)
        prepared_orders.append(prepared)

    return prepared_orders


def upload_orders(session: requests.Session, site_code: str, orders: list[dict[str, Any]]) -> None:
    response = retailcrm_request(
        session,
        "POST",
        "/orders/upload",
        data={
            "site": site_code,
            "orders": json.dumps(orders, ensure_ascii=False),
        },
    )

    try:
        payload = response.json()
    except ValueError as exc:
        raise RuntimeError(
            f"RetailCRM returned a non-JSON response with status {response.status_code}: {response.text}"
        ) from exc

    uploaded = payload.get("uploadedOrders", [])
    failed = payload.get("failedOrders", [])

    print(f"HTTP {response.status_code}")
    print(f"Uploaded: {len(uploaded)}")
    print(f"Failed: {len(failed)}")

    if failed:
        print("Errors:")
        errors = payload.get("errors", {})
        if isinstance(errors, dict):
            for key, value in errors.items():
                print(f"- {key}: {value}")
        else:
            for item in errors:
                print(f"- {item}")

        print("Raw response:")
        print(json.dumps(payload, ensure_ascii=False, indent=2))

    if not response.ok or failed:
        raise RuntimeError("RetailCRM order upload finished with errors.")


def main() -> None:
    with requests.Session() as session:
        site_code = get_site_code(session)
        order_type = get_reference_code(
            session,
            "/reference/order-types",
            "orderTypes",
            preferred_code="eshop-individual",
            default_flag="defaultForApi",
        )
        order_method = get_reference_code(
            session,
            "/reference/order-methods",
            "orderMethods",
            preferred_code="shopping-cart",
            default_flag="defaultForApi",
        )
        status = get_reference_code(
            session,
            "/reference/statuses",
            "statuses",
            preferred_code="new",
        )

        print(f"Using order type: {order_type}")
        print(f"Using order method: {order_method}")
        print(f"Using status: {status}")

        orders = build_orders(order_type, order_method, status)
        print(f"Prepared {len(orders)} orders from {ORDERS_FILE.name}")
        upload_orders(session, site_code, orders)


if __name__ == "__main__":
    main()

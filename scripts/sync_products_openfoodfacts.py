import argparse
import json
import sqlite3
import sys
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

import httpx


OFF_PRODUCT_URL = "https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"
NAME_BLACKLIST = {
    "producto",
    "producto alimenticio",
    "alimento",
    "alimentos",
    "food",
    "unknown",
    "test",
}


def fetch_off_product(client: httpx.Client, barcode: str) -> Optional[Dict[str, Any]]:
    response = client.get(OFF_PRODUCT_URL.format(barcode=barcode), timeout=10.0)
    response.raise_for_status()
    payload = response.json()
    if payload.get("status") != 1:
        return None
    return payload.get("product")


def search_off_products(client: httpx.Client, page: int, page_size: int) -> List[Dict[str, Any]]:
    params = {
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page": page,
        "page_size": page_size,
    }
    response = client.get(OFF_SEARCH_URL, params=params, timeout=15.0)
    response.raise_for_status()
    payload = response.json()
    return payload.get("products", []) or []


def normalize_nutriments(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "energy_kcal_per_100g": raw.get("energy-kcal_100g") or raw.get("energy_kcal_100g"),
        "protein_g_per_100g": raw.get("proteins_100g"),
        "fat_g_per_100g": raw.get("fat_100g"),
        "carbs_g_per_100g": raw.get("carbohydrates_100g"),
        "sugars_g_per_100g": raw.get("sugars_100g"),
        "salt_g_per_100g": raw.get("salt_100g"),
    }


def has_complete_nutriments(nutriments: Dict[str, Any]) -> bool:
    required = (
        "energy_kcal_per_100g",
        "protein_g_per_100g",
        "fat_g_per_100g",
        "carbs_g_per_100g",
    )
    return all(nutriments.get(key) is not None for key in required)


def is_clean_name(name: str) -> bool:
    cleaned = (name or "").strip().lower()
    if len(cleaned) < 3:
        return False
    if cleaned in NAME_BLACKLIST:
        return False
    if not any(ch.isalpha() for ch in cleaned):
        return False
    return True


def upsert_product(conn: sqlite3.Connection, product: Dict[str, Any]) -> bool:
    barcode = str(product.get("code") or product.get("barcode") or "").strip()
    name = product.get("product_name_en")
    nutriments_raw = product.get("nutriments") or {}
    if not barcode.isdigit() or not name or not nutriments_raw:
        return False

    nutriments = normalize_nutriments(nutriments_raw)
    if not has_complete_nutriments(nutriments):
        return False
    if not is_clean_name(name):
        return False

    record = {
        "barcode": barcode,
        "name": name,
        "brand": product.get("brands"),
        "categories": product.get("categories"),
        "nutriments": json.dumps(nutriments),
        "serving_size": product.get("serving_size"),
        "image_url": product.get("image_url"),
        "source": "OpenFoodFacts",
        "last_updated": datetime.now().isoformat(),
        "access_count": 0,
    }

    cursor = conn.cursor()
    cursor.execute("SELECT id FROM products WHERE barcode = ?", (barcode,))
    existing = cursor.fetchone()
    if existing:
        cursor.execute(
            """
            UPDATE products
            SET name = ?, brand = ?, categories = ?, nutriments = ?, serving_size = ?,
                image_url = ?, source = ?, last_updated = ?
            WHERE barcode = ?
            """,
            (
                record["name"],
                record["brand"],
                record["categories"],
                record["nutriments"],
                record["serving_size"],
                record["image_url"],
                record["source"],
                record["last_updated"],
                record["barcode"],
            ),
        )
    else:
        cursor.execute(
            """
            INSERT INTO products
            (barcode, name, brand, categories, nutriments, serving_size, image_url, source, last_updated, access_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record["barcode"],
                record["name"],
                record["brand"],
                record["categories"],
                record["nutriments"],
                record["serving_size"],
                record["image_url"],
                record["source"],
                record["last_updated"],
                record["access_count"],
            ),
        )
    return True


def validate_existing_products(conn: sqlite3.Connection, client: httpx.Client) -> int:
    cursor = conn.cursor()
    cursor.execute("SELECT barcode FROM products")
    barcodes = [row[0] for row in cursor.fetchall()]
    removed = 0

    for barcode in barcodes:
        if not str(barcode).isdigit():
            cursor.execute("DELETE FROM products WHERE barcode = ?", (barcode,))
            removed += 1
            continue

        try:
            product = fetch_off_product(client, str(barcode))
        except Exception:
            product = None

        if not product:
            cursor.execute("DELETE FROM products WHERE barcode = ?", (barcode,))
            removed += 1
            continue

        nutriments = normalize_nutriments(product.get("nutriments") or {})
        name = product.get("product_name_en") or ""
        if not has_complete_nutriments(nutriments) or not is_clean_name(name):
            cursor.execute("DELETE FROM products WHERE barcode = ?", (barcode,))
            removed += 1
            continue

        cursor.execute(
            """
            UPDATE products
            SET name = ?, source = ?, last_updated = ?
            WHERE barcode = ?
            """,
            (
                name,
                "OpenFoodFacts",
                datetime.now().isoformat(),
                barcode,
            ),
        )

    return removed


def add_products(conn: sqlite3.Connection, client: httpx.Client, target: int) -> int:
    added = 0
    page = 1
    page_size = 50

    while added < target:
        products = search_off_products(client, page, page_size)
        if not products:
            break

        for product in products:
            if upsert_product(conn, product):
                added += 1
                if added >= target:
                    break

        page += 1

    return added


def main(argv: Iterable[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True, help="Path to dietintel.db")
    parser.add_argument("--add", type=int, default=50, help="How many products to add")
    args = parser.parse_args(argv)

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row

    with httpx.Client() as client:
        removed = validate_existing_products(conn, client)
        added = add_products(conn, client, args.add)

    conn.commit()
    conn.close()

    print(f"Removed {removed} products not in OpenFoodFacts")
    print(f"Added {added} products from OpenFoodFacts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

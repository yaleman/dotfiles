#!/usr/bin/env -S uv run --script
# /// script
# dependencies = [
#   "requests",
#   "pydantic",
#   "click","loguru"
# ]
# ///

import json
from pathlib import Path
import sys
from typing import Any, Dict, List
import click
from loguru import logger
import requests
from pydantic import BaseModel, Field

SITE_BASE = "https://www.tradetools.com"
BASE_URL = "https://search.unbxd.io/d6e35edd562fe17ec988aecf52808d45/ss-unbxd-TradeTools-Prod30861638503743/category"

BASE_PARAMS = {
    "facet.multiselect": "true",
    "p-id": 'categoryPathId:"951"',  # Default category ID for "Tool Storage"
    "pagetype": "boolean",
    "rows": 48,
    "start": 0,
    "version": "V2",
}


def get_params(category_id: int = 951) -> Dict[str, Any]:
    """
    Returns the base parameters for the API request.
    """

    params = BASE_PARAMS.copy()
    params["p-id"] = f'categoryPathId:"{category_id}"'

    return params


def get_headers() -> Dict[str, str]:
    """
    Returns the headers for the API request.
    """

    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Origin": "https://www.tradetools.com",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15",
        "Referer": "https://www.tradetools.com/",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-Dest": "empty",
    }


def make_request(category_id: int = 951) -> Dict[str, Any]:
    """
    Makes a request to the API and returns the response.
    """

    # params = get_params(category_id)
    response = requests.get(BASE_URL, params=get_params(category_id), headers=get_headers())

    if response.status_code != 200:
        raise Exception("Request failed with status code {response.status_code}")
    logger.debug(response.request.headers)
    logger.debug(response.request.url)
    retval: Dict[str, Any] = response.json()
    return retval


class Product(BaseModel):
    availabilityV2: str  # ": "Available",
    availableToSell: int  # ": 43,
    base_price: float = Field(alias="basePrice")  # ": 319.0,
    title: str = Field(alias="custom_Description_Title")  # ": "Renegade Industrial 15\" 7 Drawer Black Side Cabinet",
    in_stock: bool = Field(alias="isInStock")  # ": "true",
    price: float  # ": 319.0,
    root_item: int = Field(alias="_root_")  # ": "27945",
    path: str  # ": "https://www.tradetools.com/renegade-industrial-15-7-drawer-black-side-cabinet-ri15-7xbla/"


def parse(response: Dict[str, Any]) -> List[Product]:
    """
    Parses the response from the API and returns the relevant data.
    """

    if "response" not in response:
        raise ValueError("Invalid response format: 'response' key not found")
    if "products" not in response["response"]:
        raise ValueError("Invalid response format: 'products' key not found")
    logger.debug("Full response: {}", json.dumps(response))
    return [Product.model_validate(item) for item in response["response"]["products"]]


def get_config() -> List[int]:
    CONFIG_FILE = "trade_tools_watcher.json"
    if Path(CONFIG_FILE).exists():
        return json.loads(Path(CONFIG_FILE).read_text())["categories"]
    else:
        return [937]  # Default category ID for "Tool Storage"


@click.command()
@click.option("--debug", is_flag=True, help="Enable debug mode")
@click.option(
    "--category",
    default=get_config(),
    type=int,
    help=f"Category ID to fetch products from, defaults to {json.dumps(get_config())}",
    multiple=True,
)
def main(debug: bool, category: List[int]) -> None:
    if debug:
        logger.remove()
        logger.add(sys.stdout, level="DEBUG")
    else:
        logger.remove()
        logger.add(sys.stdout, level="INFO")
    try:
        for cat_id in category:
            response = make_request(cat_id)
            products = parse(response)
            for product in products:
                if product.price < product.base_price:
                    logger.success(
                        "Price drop detected on {} -> {} (was {}) {}{}",
                        product.title,
                        product.price,
                        product.base_price,
                        SITE_BASE,
                        product.path,
                    )
                else:
                    logger.info(
                        "No price drop on {} -> {} (was {}) {}{}",
                        product.title,
                        product.price,
                        product.base_price,
                        SITE_BASE,
                        product.path,
                    )
    except Exception as e:
        logger.error(f"An error occurred: {e}")


if __name__ == "__main__":
    main()

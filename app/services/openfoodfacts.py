import logging
import os
from datetime import datetime
from typing import Dict, Optional
import httpx
from app.models.product import ProductResponse, Nutriments

logger = logging.getLogger(__name__)


class OpenFoodFactsService:
    BASE_URL = "https://world.openfoodfacts.org/api/v0/product"
    TIMEOUT = 10.0
    
    def __init__(self):
        env_flag = os.getenv("OPENFOODFACTS_ENABLE_NETWORK", "true").lower()
        self.enable_network = env_flag in {"1", "true", "yes", "on"}
        self.client = httpx.AsyncClient(timeout=self.TIMEOUT)
        self._offline_products: Dict[str, ProductResponse] = self._build_offline_catalog()
    
    async def get_product(self, barcode: str) -> Optional[ProductResponse]:
        if not self.enable_network:
            return self._offline_products.get(barcode)

        url = f"{self.BASE_URL}/{barcode}.json"

        start_time = datetime.now()
        try:
            response = await self.client.get(url)
            latency = (datetime.now() - start_time).total_seconds()
            logger.info(f"OpenFoodFacts API call latency: {latency:.3f}s for barcode: {barcode}")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("status") == 1 and "product" in data:
                    return self._map_to_product_response(data["product"], barcode)
                else:
                    logger.info(f"Product not found in OpenFoodFacts: {barcode}")
                    return None
            else:
                logger.warning(f"OpenFoodFacts API returned status {response.status_code} for barcode: {barcode}")
                return None
                
        except httpx.TimeoutException:
            latency = (datetime.now() - start_time).total_seconds()
            logger.error(f"Timeout calling OpenFoodFacts API after {latency:.3f}s for barcode: {barcode}")
            raise
        except httpx.RequestError as e:
            latency = (datetime.now() - start_time).total_seconds()
            logger.error(f"Network error calling OpenFoodFacts API after {latency:.3f}s: {e}")
            raise
        except Exception as e:
            latency = (datetime.now() - start_time).total_seconds()
            logger.error(f"Unexpected error calling OpenFoodFacts API after {latency:.3f}s for barcode {barcode}: {e}")
            # For non-network errors (like JSON parsing), return None to indicate "not found"
            # rather than propagating the exception
            return None
    
    def _map_to_product_response(self, product_data: dict, barcode: str) -> ProductResponse:
        nutriments_data = product_data.get("nutriments", {})
        
        nutriments = Nutriments(
            energy_kcal_per_100g=self._safe_float(nutriments_data.get("energy-kcal_100g")),
            protein_g_per_100g=self._safe_float(nutriments_data.get("proteins_100g")),
            fat_g_per_100g=self._safe_float(nutriments_data.get("fat_100g")),
            carbs_g_per_100g=self._safe_float(nutriments_data.get("carbohydrates_100g")),
            sugars_g_per_100g=self._safe_float(nutriments_data.get("sugars_100g")),
            salt_g_per_100g=self._safe_float(nutriments_data.get("salt_100g"))
        )
        
        return ProductResponse(
            source="OpenFoodFacts",
            barcode=barcode,
            name=product_data.get("product_name"),
            brand=product_data.get("brands"),
            image_url=product_data.get("image_url"),
            serving_size=product_data.get("serving_size"),
            nutriments=nutriments,
            fetched_at=datetime.now()
        )
    
    def _safe_float(self, value) -> Optional[float]:
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    async def close(self):
        if self.client:
            await self.client.aclose()

    def _build_offline_catalog(self) -> Dict[str, ProductResponse]:
        sample_nutriments = Nutriments(
            energy_kcal_per_100g=250.0,
            protein_g_per_100g=8.0,
            fat_g_per_100g=5.0,
            carbs_g_per_100g=40.0,
            sugars_g_per_100g=5.0,
            salt_g_per_100g=0.8
        )

        sample_product = ProductResponse(
            source="OpenFoodFacts (offline)",
            barcode="1234567890123",
            name="Offline Sample Product",
            brand="DietIntel",
            image_url=None,
            serving_size="100g",
            nutriments=sample_nutriments,
            fetched_at=datetime.now()
        )

        return {
            sample_product.barcode: sample_product,
        }


openfoodfacts_service = OpenFoodFactsService()

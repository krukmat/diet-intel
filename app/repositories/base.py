"""
Base Repository with CRUD operations
Generic repository pattern for all entities
"""
from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)

T = TypeVar("T")


class Repository(ABC, Generic[T]):
    """
    Abstract base repository
    Provides common CRUD operations for all entities
    """

    def __init__(self, db_path: str):
        """
        Initialize repository

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path
        self.logger = logging.getLogger(self.__class__.__name__)

    @abstractmethod
    def get_table_name(self) -> str:
        """Return the table name for this repository"""
        pass

    @abstractmethod
    def row_to_entity(self, row: Dict[str, Any]) -> T:
        """Convert database row to entity"""
        pass

    @abstractmethod
    def entity_to_dict(self, entity: T) -> Dict[str, Any]:
        """Convert entity to dictionary for database"""
        pass

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[T]:
        """Get entity by ID"""
        pass

    @abstractmethod
    async def get_all(self, limit: int = 100, offset: int = 0) -> List[T]:
        """Get all entities with pagination"""
        pass

    @abstractmethod
    async def create(self, entity: T) -> T:
        """Create new entity"""
        pass

    @abstractmethod
    async def update(self, id: int, updates: Dict[str, Any]) -> Optional[T]:
        """Update existing entity"""
        pass

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete entity by ID"""
        pass

    @abstractmethod
    async def count(self) -> int:
        """Count total entities"""
        pass

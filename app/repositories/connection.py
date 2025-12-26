"""
Database connection manager
Handles SQLite connections with async support
"""
import sqlite3
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages database connections for repositories"""

    def __init__(self, db_path: str):
        """
        Initialize connection manager

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path
        self.logger = logging.getLogger(self.__class__.__name__)

    @asynccontextmanager
    async def get_connection(self) -> AsyncGenerator[sqlite3.Connection, None]:
        """
        Get database connection with context manager

        Yields:
            sqlite3.Connection: Database connection

        Raises:
            Exception: If connection fails
        """
        conn = None
        try:
            # Create connection
            conn = sqlite3.connect(self.db_path, check_same_thread=False)
            conn.row_factory = sqlite3.Row  # Enable column access by name

            # Enable performance optimizations
            conn.execute("PRAGMA journal_mode=WAL")  # Write-ahead logging
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute("PRAGMA cache_size=10000")
            conn.execute("PRAGMA temp_store=MEMORY")

            self.logger.debug(f"Database connection opened: {self.db_path}")
            yield conn
            conn.commit()

        except Exception as e:
            if conn:
                conn.rollback()
            self.logger.error(f"Database error: {e}")
            raise
        finally:
            if conn:
                conn.close()
                self.logger.debug(f"Database connection closed")


# Global instance (uses default "dietintel.db" database file)
connection_manager = ConnectionManager("dietintel.db")

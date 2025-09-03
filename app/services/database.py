import sqlite3
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import contextmanager
from app.models.user import User, UserCreate, UserSession, UserRole
from app.config import config
import logging

logger = logging.getLogger(__name__)


class DatabaseService:
    """SQLite database service for user management"""
    
    def __init__(self, db_path: str = "dietintel.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize database with required tables"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    avatar_url TEXT,
                    is_developer BOOLEAN DEFAULT FALSE,
                    role TEXT DEFAULT 'standard',
                    is_active BOOLEAN DEFAULT TRUE,
                    email_verified BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # User sessions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    device_info TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            """)
            
            # Meal tracking tables
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS meals (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    meal_name TEXT NOT NULL,
                    total_calories REAL NOT NULL,
                    photo_url TEXT,
                    timestamp TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS meal_items (
                    id TEXT PRIMARY KEY,
                    meal_id TEXT NOT NULL,
                    barcode TEXT NOT NULL,
                    name TEXT NOT NULL,
                    serving TEXT NOT NULL,
                    calories REAL NOT NULL,
                    macros TEXT NOT NULL,
                    FOREIGN KEY (meal_id) REFERENCES meals (id) ON DELETE CASCADE
                )
            """)
            
            # Weight tracking table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS weight_entries (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    weight REAL NOT NULL,
                    date TIMESTAMP NOT NULL,
                    photo_url TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            """)
            
            # Reminders table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS reminders (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    reminder_time TIMESTAMP NOT NULL,
                    frequency TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    last_triggered TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            """)
            
            # Meal plans table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS meal_plans (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    plan_data TEXT NOT NULL,
                    bmr REAL NOT NULL,
                    tdee REAL NOT NULL,
                    daily_calorie_target REAL NOT NULL,
                    flexibility_used BOOLEAN DEFAULT FALSE,
                    optional_products_used INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP
                )
            """)
            
            # Indexes for better performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON user_sessions(refresh_token)")
            
            # Meal tracking indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_meals_user_id ON meals(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_meals_timestamp ON meals(timestamp)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_meal_items_meal_id ON meal_items(meal_id)")
            
            # Weight tracking indexes  
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON weight_entries(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_weight_entries_date ON weight_entries(date)")
            
            # Reminders indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(reminder_time)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reminders_active ON reminders(is_active)")
            
            # Meal plans indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON meal_plans(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_meal_plans_expires ON meal_plans(expires_at)")
            
            conn.commit()
            logger.info("Database initialized successfully with all tables")
    
    @contextmanager
    def get_connection(self):
        """Get database connection with automatic cleanup"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable column access by name
        try:
            yield conn
        finally:
            conn.close()
    
    async def create_user(self, user_data: UserCreate, password_hash: str) -> User:
        """Create a new user in the database"""
        user_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        # Check for developer code
        is_developer = user_data.developer_code == "DIETINTEL_DEV_2024"
        role = UserRole.DEVELOPER if is_developer else UserRole.STANDARD
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO users (id, email, password_hash, full_name, is_developer, role, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_id, user_data.email, password_hash, user_data.full_name, is_developer, role.value, now, now))
            conn.commit()
        
        return await self.get_user_by_id(user_id)
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email address"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()
            
            if row:
                return self._row_to_user(row)
            return None
    
    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            
            if row:
                return self._row_to_user(row)
            return None
    
    async def get_password_hash(self, user_id: str) -> Optional[str]:
        """Get password hash for user"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            
            if row:
                return row['password_hash']
            return None
    
    async def update_user(self, user_id: str, updates: Dict[str, Any]) -> Optional[User]:
        """Update user information"""
        if not updates:
            return await self.get_user_by_id(user_id)
        
        updates['updated_at'] = datetime.utcnow().isoformat()
        
        # Build dynamic update query
        set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values()) + [user_id]
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
            conn.commit()
        
        return await self.get_user_by_id(user_id)
    
    async def create_session(self, session: UserSession) -> str:
        """Create a new user session"""
        session_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO user_sessions (id, user_id, access_token, refresh_token, expires_at, device_info, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (session_id, session.user_id, session.access_token, session.refresh_token, 
                  session.expires_at.isoformat(), session.device_info, now))
            conn.commit()
        
        return session_id
    
    async def get_session_by_refresh_token(self, refresh_token: str) -> Optional[UserSession]:
        """Get session by refresh token"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM user_sessions WHERE refresh_token = ?", (refresh_token,))
            row = cursor.fetchone()
            
            if row:
                return UserSession(
                    id=row['id'],
                    user_id=row['user_id'],
                    access_token=row['access_token'],
                    refresh_token=row['refresh_token'],
                    expires_at=datetime.fromisoformat(row['expires_at']),
                    device_info=row['device_info'],
                    created_at=datetime.fromisoformat(row['created_at'])
                )
            return None
    
    async def update_session(self, session_id: str, access_token: str, refresh_token: str, expires_at: datetime):
        """Update session tokens"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE user_sessions 
                SET access_token = ?, refresh_token = ?, expires_at = ?
                WHERE id = ?
            """, (access_token, refresh_token, expires_at.isoformat(), session_id))
            conn.commit()
    
    async def delete_session(self, session_id: str):
        """Delete a session"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_sessions WHERE id = ?", (session_id,))
            conn.commit()
    
    async def delete_user_sessions(self, user_id: str):
        """Delete all sessions for a user"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_sessions WHERE user_id = ?", (user_id,))
            conn.commit()
    
    async def cleanup_expired_sessions(self):
        """Remove expired sessions"""
        now = datetime.utcnow().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_sessions WHERE expires_at < ?", (now,))
            deleted = cursor.rowcount
            conn.commit()
            
        if deleted > 0:
            logger.info(f"Cleaned up {deleted} expired sessions")
    
    def _row_to_user(self, row) -> User:
        """Convert database row to User model"""
        return User(
            id=row['id'],
            email=row['email'],
            full_name=row['full_name'],
            avatar_url=row['avatar_url'],
            is_developer=bool(row['is_developer']),
            role=UserRole(row['role']),
            is_active=bool(row['is_active']),
            email_verified=bool(row['email_verified']),
            created_at=datetime.fromisoformat(row['created_at']),
            updated_at=datetime.fromisoformat(row['updated_at'])
        )


    # ===== MEAL TRACKING METHODS =====
    
    async def create_meal(self, user_id: str, meal_data: 'MealTrackingRequest', photo_url: Optional[str] = None) -> str:
        """Create a new meal tracking entry with items"""
        from app.models.tracking import MealTrackingRequest
        import json
        
        meal_id = str(uuid.uuid4())
        
        # Calculate total calories
        total_calories = sum(item.calories for item in meal_data.items)
        
        # Parse timestamp
        try:
            timestamp = datetime.fromisoformat(meal_data.timestamp.replace("Z", "+00:00"))
        except ValueError:
            timestamp = datetime.now()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Insert meal record
            cursor.execute("""
                INSERT INTO meals (id, user_id, meal_name, total_calories, photo_url, timestamp, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (meal_id, user_id, meal_data.meal_name, total_calories, photo_url, 
                  timestamp.isoformat(), datetime.now().isoformat()))
            
            # Insert meal items
            for item in meal_data.items:
                item_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO meal_items (id, meal_id, barcode, name, serving, calories, macros)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (item_id, meal_id, item.barcode, item.name, item.serving, 
                      item.calories, json.dumps(item.macros)))
            
            conn.commit()
            
        logger.info(f"Created meal {meal_id} for user {user_id}: {total_calories} calories")
        return meal_id
    
    async def get_meal_by_id(self, meal_id: str) -> Optional[Dict]:
        """Get a meal by ID with all its items"""
        import json
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get meal record
            cursor.execute("SELECT * FROM meals WHERE id = ?", (meal_id,))
            meal_row = cursor.fetchone()
            
            if not meal_row:
                return None
            
            # Get meal items
            cursor.execute("SELECT * FROM meal_items WHERE meal_id = ? ORDER BY id", (meal_id,))
            item_rows = cursor.fetchall()
            
            # Build response
            items = []
            for item_row in item_rows:
                items.append({
                    "barcode": item_row['barcode'],
                    "name": item_row['name'],
                    "serving": item_row['serving'],
                    "calories": item_row['calories'],
                    "macros": json.loads(item_row['macros'])
                })
            
            return {
                "id": meal_row['id'],
                "meal_name": meal_row['meal_name'],
                "items": items,
                "total_calories": meal_row['total_calories'],
                "photo_url": meal_row['photo_url'],
                "timestamp": datetime.fromisoformat(meal_row['timestamp']),
                "created_at": datetime.fromisoformat(meal_row['created_at'])
            }
    
    async def get_user_meals(self, user_id: str, limit: int = 50) -> List[Dict]:
        """Get user's meal history"""
        import json
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get meals for user
            cursor.execute("""
                SELECT * FROM meals 
                WHERE user_id = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            """, (user_id, limit))
            meal_rows = cursor.fetchall()
            
            meals = []
            for meal_row in meal_rows:
                # Get items for each meal
                cursor.execute("SELECT * FROM meal_items WHERE meal_id = ?", (meal_row['id'],))
                item_rows = cursor.fetchall()
                
                items = []
                for item_row in item_rows:
                    items.append({
                        "barcode": item_row['barcode'],
                        "name": item_row['name'],
                        "serving": item_row['serving'],
                        "calories": item_row['calories'],
                        "macros": json.loads(item_row['macros'])
                    })
                
                meals.append({
                    "id": meal_row['id'],
                    "meal_name": meal_row['meal_name'],
                    "items": items,
                    "total_calories": meal_row['total_calories'],
                    "photo_url": meal_row['photo_url'],
                    "timestamp": datetime.fromisoformat(meal_row['timestamp']),
                    "created_at": datetime.fromisoformat(meal_row['created_at'])
                })
            
            return meals
    
    # ===== WEIGHT TRACKING METHODS =====
    
    async def create_weight_entry(self, user_id: str, weight_data: 'WeightTrackingRequest', photo_url: Optional[str] = None) -> str:
        """Create a new weight tracking entry"""
        from app.models.tracking import WeightTrackingRequest
        
        weight_id = str(uuid.uuid4())
        
        # Parse date
        try:
            measurement_date = datetime.fromisoformat(weight_data.date.replace("Z", "+00:00"))
        except ValueError:
            measurement_date = datetime.now()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO weight_entries (id, user_id, weight, date, photo_url, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (weight_id, user_id, weight_data.weight, measurement_date.isoformat(), 
                  photo_url, datetime.now().isoformat()))
            conn.commit()
        
        logger.info(f"Created weight entry {weight_id} for user {user_id}: {weight_data.weight} kg")
        return weight_id
    
    async def get_weight_entry_by_id(self, weight_id: str) -> Optional[Dict]:
        """Get a weight entry by ID"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM weight_entries WHERE id = ?", (weight_id,))
            row = cursor.fetchone()
            
            if row:
                return {
                    "id": row['id'],
                    "weight": row['weight'],
                    "date": datetime.fromisoformat(row['date']),
                    "photo_url": row['photo_url'],
                    "created_at": datetime.fromisoformat(row['created_at'])
                }
            return None
    
    async def get_user_weight_history(self, user_id: str, limit: int = 30) -> List[Dict]:
        """Get user's weight history"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM weight_entries 
                WHERE user_id = ? 
                ORDER BY date DESC 
                LIMIT ?
            """, (user_id, limit))
            rows = cursor.fetchall()
            
            entries = []
            for row in rows:
                entries.append({
                    "id": row['id'],
                    "weight": row['weight'],
                    "date": datetime.fromisoformat(row['date']),
                    "photo_url": row['photo_url'],
                    "created_at": datetime.fromisoformat(row['created_at'])
                })
            
            return entries
    
    # ===== REMINDER METHODS =====
    
    async def create_reminder(self, user_id: str, reminder_data: 'ReminderRequest') -> str:
        """Create a new reminder"""
        from app.models.reminder import ReminderRequest
        import json
        
        reminder_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        
        # Convert reminder time and days to storage format
        reminder_time = f"{reminder_data.time}:00"  # Add seconds for time format
        frequency = json.dumps(reminder_data.days)  # Store days array as JSON
        
        # Create a proper timestamp for reminder_time (next occurrence)
        next_reminder_time = datetime.now().replace(
            hour=int(reminder_data.time.split(':')[0]), 
            minute=int(reminder_data.time.split(':')[1]),
            second=0,
            microsecond=0
        )
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO reminders (id, user_id, title, description, reminder_time, frequency, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (reminder_id, user_id, reminder_data.label, reminder_data.type.value, 
                  next_reminder_time.isoformat(), frequency, reminder_data.enabled, now))
            conn.commit()
        
        logger.info(f"Created reminder {reminder_id} for user {user_id}: {reminder_data.label}")
        return reminder_id
    
    async def get_reminder_by_id(self, reminder_id: str) -> Optional[Dict]:
        """Get a reminder by ID"""
        import json
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM reminders WHERE id = ?", (reminder_id,))
            row = cursor.fetchone()
            
            if row:
                # Extract time from reminder_time timestamp
                reminder_dt = datetime.fromisoformat(row['reminder_time'])
                time_str = f"{reminder_dt.hour:02d}:{reminder_dt.minute:02d}"
                
                return {
                    "id": row['id'],
                    "type": row['description'],  # We stored type in description
                    "label": row['title'],
                    "time": time_str,
                    "days": json.loads(row['frequency']),
                    "enabled": bool(row['is_active']),
                    "created_at": datetime.fromisoformat(row['created_at']),
                    "updated_at": datetime.fromisoformat(row['created_at'])  # Use created_at as fallback
                }
            return None
    
    async def get_user_reminders(self, user_id: str) -> List[Dict]:
        """Get all reminders for a user"""
        import json
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM reminders 
                WHERE user_id = ? 
                ORDER BY reminder_time ASC
            """, (user_id,))
            rows = cursor.fetchall()
            
            reminders = []
            for row in rows:
                # Extract time from reminder_time timestamp
                reminder_dt = datetime.fromisoformat(row['reminder_time'])
                time_str = f"{reminder_dt.hour:02d}:{reminder_dt.minute:02d}"
                
                reminders.append({
                    "id": row['id'],
                    "type": row['description'],  # We stored type in description
                    "label": row['title'],
                    "time": time_str,
                    "days": json.loads(row['frequency']),
                    "enabled": bool(row['is_active']),
                    "created_at": datetime.fromisoformat(row['created_at']),
                    "updated_at": datetime.fromisoformat(row['created_at'])
                })
            
            return reminders
    
    async def update_reminder(self, reminder_id: str, updates: Dict[str, Any]) -> bool:
        """Update a reminder"""
        import json
        
        if not updates:
            return True
        
        # Build dynamic update query
        set_clauses = []
        values = []
        
        if 'label' in updates:
            set_clauses.append("title = ?")
            values.append(updates['label'])
        
        if 'type' in updates:
            set_clauses.append("description = ?")
            values.append(updates['type'])
        
        if 'time' in updates:
            # Convert time to full timestamp
            next_reminder_time = datetime.now().replace(
                hour=int(updates['time'].split(':')[0]), 
                minute=int(updates['time'].split(':')[1]),
                second=0,
                microsecond=0
            )
            set_clauses.append("reminder_time = ?")
            values.append(next_reminder_time.isoformat())
        
        if 'days' in updates:
            set_clauses.append("frequency = ?")
            values.append(json.dumps(updates['days']))
        
        if 'enabled' in updates:
            set_clauses.append("is_active = ?")
            values.append(updates['enabled'])
        
        if not set_clauses:
            return True
        
        values.append(reminder_id)
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            query = f"UPDATE reminders SET {', '.join(set_clauses)} WHERE id = ?"
            cursor.execute(query, values)
            updated = cursor.rowcount > 0
            conn.commit()
        
        if updated:
            logger.info(f"Updated reminder {reminder_id}")
        
        return updated
    
    async def delete_reminder(self, reminder_id: str) -> bool:
        """Delete a reminder"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM reminders WHERE id = ?", (reminder_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
        
        if deleted:
            logger.info(f"Deleted reminder {reminder_id}")
        
        return deleted
    
    # ===== MEAL PLAN METHODS =====
    
    async def store_meal_plan(self, user_id: str, plan: 'MealPlanResponse', ttl_hours: int = 24) -> str:
        """Store a meal plan in database"""
        from app.models.meal_plan import MealPlanResponse
        import json
        
        plan_id = str(uuid.uuid4())
        
        # Calculate expiration time
        expires_at = datetime.now() + timedelta(hours=ttl_hours)
        
        # Serialize plan data as JSON (excluding created_at to avoid conflicts)
        plan_dict = plan.model_dump()
        plan_dict.pop('created_at', None)  # Remove created_at to use database default
        plan_data_json = json.dumps(plan_dict)
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO meal_plans (id, user_id, plan_data, bmr, tdee, daily_calorie_target, 
                                      flexibility_used, optional_products_used, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (plan_id, user_id, plan_data_json, plan.bmr, plan.tdee, 
                  plan.daily_calorie_target, plan.flexibility_used, 
                  plan.optional_products_used, expires_at.isoformat()))
            conn.commit()
        
        logger.info(f"Stored meal plan {plan_id} for user {user_id}, expires: {expires_at}")
        return plan_id
    
    async def get_meal_plan(self, plan_id: str) -> Optional[Dict]:
        """Get a meal plan by ID"""
        import json
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM meal_plans WHERE id = ?", (plan_id,))
            row = cursor.fetchone()
            
            if not row:
                return None
            
            # Check if plan has expired
            if row['expires_at']:
                expires_at = datetime.fromisoformat(row['expires_at'])
                if datetime.now() > expires_at:
                    # Clean up expired plan
                    cursor.execute("DELETE FROM meal_plans WHERE id = ?", (plan_id,))
                    conn.commit()
                    logger.info(f"Removed expired meal plan {plan_id}")
                    return None
            
            # Deserialize plan data
            plan_data = json.loads(row['plan_data'])
            
            # Add database metadata
            plan_data['created_at'] = datetime.fromisoformat(row['created_at'])
            
            return plan_data
    
    async def update_meal_plan(self, plan_id: str, plan: 'MealPlanResponse') -> bool:
        """Update an existing meal plan"""
        from app.models.meal_plan import MealPlanResponse
        import json
        
        # Check if plan exists and not expired
        existing_plan = await self.get_meal_plan(plan_id)
        if not existing_plan:
            return False
        
        # Serialize updated plan data
        plan_dict = plan.model_dump()
        plan_dict.pop('created_at', None)  # Preserve original created_at
        plan_data_json = json.dumps(plan_dict)
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE meal_plans 
                SET plan_data = ?, bmr = ?, tdee = ?, daily_calorie_target = ?,
                    flexibility_used = ?, optional_products_used = ?
                WHERE id = ?
            """, (plan_data_json, plan.bmr, plan.tdee, plan.daily_calorie_target,
                  plan.flexibility_used, plan.optional_products_used, plan_id))
            updated = cursor.rowcount > 0
            conn.commit()
        
        if updated:
            logger.info(f"Updated meal plan {plan_id}")
        
        return updated
    
    async def delete_meal_plan(self, plan_id: str) -> bool:
        """Delete a meal plan"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM meal_plans WHERE id = ?", (plan_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
        
        if deleted:
            logger.info(f"Deleted meal plan {plan_id}")
        
        return deleted
    
    async def get_user_meal_plans(self, user_id: str, limit: int = 10) -> List[Dict]:
        """Get meal plans for a user (excluding expired ones)"""
        import json
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Clean up expired plans first
            now = datetime.now().isoformat()
            cursor.execute("DELETE FROM meal_plans WHERE expires_at < ?", (now,))
            
            # Get user's active plans
            cursor.execute("""
                SELECT * FROM meal_plans 
                WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)
                ORDER BY created_at DESC 
                LIMIT ?
            """, (user_id, now, limit))
            rows = cursor.fetchall()
            
            conn.commit()  # Commit the cleanup
            
            plans = []
            for row in rows:
                plan_data = json.loads(row['plan_data'])
                plan_data['created_at'] = datetime.fromisoformat(row['created_at'])
                plan_data['id'] = row['id']  # Add plan ID for reference
                plans.append(plan_data)
            
            return plans
    
    async def cleanup_expired_meal_plans(self) -> int:
        """Clean up expired meal plans and return count of deleted plans"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now().isoformat()
            cursor.execute("DELETE FROM meal_plans WHERE expires_at < ?", (now,))
            deleted = cursor.rowcount
            conn.commit()
        
        if deleted > 0:
            logger.info(f"Cleaned up {deleted} expired meal plans")
        
        return deleted


# Global database service instance
db_service = DatabaseService()
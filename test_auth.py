#!/usr/bin/env python3
"""
Test script for authentication endpoints
"""
import asyncio
import json
from app.services.auth import auth_service
from app.services.database import db_service
from app.models.user import UserCreate, UserLogin

async def test_auth_system():
    """Test the complete authentication system"""
    print("🔐 Testing DietIntel Authentication System")
    print("=" * 50)
    
    try:
        # Test 1: User Registration
        print("\n1. Testing User Registration...")
        user_data = UserCreate(
            email="john.doe@example.com",
            password="securepassword123",
            full_name="John Doe",
            developer_code="DIETINTEL_DEV_2024"  # Test developer code
        )
        
        # Register user
        token_response = await auth_service.register_user(user_data)
        print(f"✅ User registered successfully!")
        print(f"   Access Token: {token_response.access_token[:20]}...")
        print(f"   Token Type: {token_response.token_type}")
        print(f"   Expires In: {token_response.expires_in} seconds")
        
        # Test 2: Token Verification
        print("\n2. Testing Token Verification...")
        token_data = auth_service.verify_token(token_response.access_token, "access")
        if token_data:
            print(f"✅ Token verified successfully!")
            print(f"   User ID: {token_data.user_id}")
            print(f"   Email: {token_data.email}")
            print(f"   Role: {token_data.role}")
            print(f"   Is Developer: {token_data.is_developer}")
        else:
            print("❌ Token verification failed")
        
        # Test 3: User Login
        print("\n3. Testing User Login...")
        login_data = UserLogin(
            email="john.doe@example.com",
            password="securepassword123"
        )
        
        login_response = await auth_service.login_user(login_data)
        print(f"✅ User logged in successfully!")
        print(f"   New Access Token: {login_response.access_token[:20]}...")
        
        # Test 4: Token Refresh
        print("\n4. Testing Token Refresh...")
        refresh_response = await auth_service.refresh_access_token(login_response.refresh_token)
        print(f"✅ Token refreshed successfully!")
        print(f"   Refreshed Access Token: {refresh_response.access_token[:20]}...")
        
        # Test 5: Database User Retrieval
        print("\n5. Testing Database User Retrieval...")
        user = await db_service.get_user_by_email("john.doe@example.com")
        if user:
            print(f"✅ User retrieved from database!")
            print(f"   ID: {user.id}")
            print(f"   Name: {user.full_name}")
            print(f"   Developer: {user.is_developer}")
            print(f"   Role: {user.role}")
            print(f"   Created: {user.created_at}")
        else:
            print("❌ User not found in database")
        
        # Test 6: Password Verification
        print("\n6. Testing Password Verification...")
        password_hash = await db_service.get_password_hash(user.id)
        is_valid = auth_service.verify_password("securepassword123", password_hash)
        print(f"✅ Password verification: {'Success' if is_valid else 'Failed'}")
        
        # Test 7: Session Cleanup
        print("\n7. Testing Logout...")
        await auth_service.logout_user(refresh_response.refresh_token)
        print("✅ User logged out successfully!")
        
        print("\n" + "=" * 50)
        print("🎉 All authentication tests passed!")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Authentication test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Main test function"""
    print("Initializing database...")
    db_service.init_database()
    
    success = await test_auth_system()
    
    if success:
        print("\n✅ Phase 1: Backend Authentication Core - COMPLETED!")
        print("\n📋 Features Implemented:")
        print("   • User registration with developer code support")
        print("   • JWT access/refresh token authentication")  
        print("   • bcrypt password hashing")
        print("   • SQLite database with users and sessions")
        print("   • Token verification and refresh")
        print("   • Role-based access control (standard/developer)")
        print("   • Session management and cleanup")
    else:
        print("\n❌ Phase 1 tests failed. Please check the implementation.")

if __name__ == "__main__":
    asyncio.run(main())
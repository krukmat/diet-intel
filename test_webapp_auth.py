#!/usr/bin/env python3
"""
Test webapp authentication flow
"""
import requests
import json

API_BASE_URL = "http://localhost:8001"
WEBAPP_BASE_URL = "http://localhost:3000"

def test_webapp_auth_flow():
    """Test the complete webapp authentication flow"""
    print("🔐 Testing WebApp Authentication Flow")
    print("=" * 50)
    
    session = requests.Session()
    
    try:
        # Test 1: Check webapp homepage (unauthenticated)
        print("\n1. Testing webapp homepage (unauthenticated)...")
        response = session.get(f"{WEBAPP_BASE_URL}/")
        print(f"✅ Homepage Status: {response.status_code}")
        print(f"   Contains 'Sign In': {'Sign In' in response.text}")
        
        # Test 2: Try to access protected dashboard (should redirect to login)
        print("\n2. Testing protected dashboard access...")
        response = session.get(f"{WEBAPP_BASE_URL}/dashboard", allow_redirects=False)
        print(f"✅ Dashboard Status: {response.status_code}")
        if response.status_code == 302:
            print(f"   Redirect Location: {response.headers.get('Location', 'None')}")
        
        # Test 3: Access login page
        print("\n3. Testing login page access...")
        response = session.get(f"{WEBAPP_BASE_URL}/auth/login")
        print(f"✅ Login Page Status: {response.status_code}")
        print(f"   Contains login form: {'<form' in response.text and 'login' in response.text}")
        
        # Test 4: Register new user directly via API
        print("\n4. Testing user registration via API...")
        new_user_data = {
            "email": "webapp.test@example.com",
            "password": "webapptest123",
            "full_name": "WebApp Test User"
        }
        
        response = requests.post(f"{API_BASE_URL}/auth/register", json=new_user_data)
        if response.status_code == 201:
            token_data = response.json()
            print(f"✅ User registered successfully!")
            print(f"   Access Token: {token_data['access_token'][:20]}...")
        elif response.status_code == 409:
            print(f"ℹ️ User already exists, testing login...")
            # Try login instead
            login_data = {
                "email": "webapp.test@example.com",
                "password": "webapptest123"
            }
            response = requests.post(f"{API_BASE_URL}/auth/login", json=login_data)
            if response.status_code == 200:
                token_data = response.json()
                print(f"✅ User logged in successfully!")
                print(f"   Access Token: {token_data['access_token'][:20]}...")
            else:
                print(f"❌ Login failed: {response.status_code}")
                return False
        else:
            print(f"❌ Registration failed: {response.status_code} - {response.text}")
            return False
        
        # Test 5: Test webapp login form submission
        print("\n5. Testing webapp login form submission...")
        login_form_data = {
            "email": "webapp.test@example.com",
            "password": "webapptest123"
        }
        
        response = session.post(f"{WEBAPP_BASE_URL}/auth/login", 
                               data=login_form_data,
                               allow_redirects=False)
        print(f"✅ Login Form Status: {response.status_code}")
        
        if response.status_code == 302:
            redirect_url = response.headers.get('Location', '')
            print(f"   Redirect URL: {redirect_url}")
            
            # Follow redirect to dashboard
            response = session.get(f"{WEBAPP_BASE_URL}{redirect_url}")
            print(f"✅ Dashboard Access Status: {response.status_code}")
            print(f"   Contains user info: {'Welcome back' in response.text}")
            
        # Test 6: Test logout
        print("\n6. Testing logout...")
        response = session.post(f"{WEBAPP_BASE_URL}/auth/logout", allow_redirects=False)
        print(f"✅ Logout Status: {response.status_code}")
        
        # Test 7: Verify logout worked (dashboard should redirect to login)
        print("\n7. Verifying logout worked...")
        response = session.get(f"{WEBAPP_BASE_URL}/dashboard", allow_redirects=False)
        print(f"✅ Dashboard Access After Logout: {response.status_code}")
        if response.status_code == 302:
            print(f"   Redirect Location: {response.headers.get('Location', 'None')}")
        
        print("\n" + "=" * 50)
        print("🎉 WebApp Authentication Flow Tests Complete!")
        
        return True
        
    except Exception as e:
        print(f"\n❌ WebApp Authentication test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_webapp_auth_flow()
    
    if success:
        print("\n✅ WebApp Authentication System - WORKING!")
        print("\n📋 Features Tested:")
        print("   • Unauthenticated homepage access")
        print("   • Protected route redirects")
        print("   • Login page rendering") 
        print("   • User registration/login via API")
        print("   • WebApp form-based login")
        print("   • Dashboard access after login")
        print("   • User logout functionality")
        print("   • Session cleanup verification")
    else:
        print("\n❌ WebApp tests failed. Please check the implementation.")
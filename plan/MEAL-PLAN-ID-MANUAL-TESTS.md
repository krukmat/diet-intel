# Meal Plan ID Retrieval System - Manual Testing Guide

**Date**: September 7, 2025  
**Status**: Ready for Manual Testing  
**Fix**: Implemented actual meal plan ID retrieval system to replace hardcoded 'demo_meal_plan_001'  
**Backend Tests**: ✅ All 16 plan route tests passed  
**Mobile Tests**: ✅ All 10 meal plan utils tests passed  

---

## 🔧 **What Was Implemented**

### **Problem Solved**
SmartDietScreen.tsx:136 was using hardcoded `'demo_meal_plan_001'` for optimization context, blocking real meal plan integration.

### **Solution Applied**
- **Backend Changes**: Added `plan_id` field to MealPlanResponse model and updated generate endpoint to return plan IDs
- **Mobile Changes**: Created meal plan utilities, added ID storage to PlanScreen, updated SmartDietScreen to use actual plan IDs
- **Error Handling**: Added graceful handling when no meal plan exists

### **Files Modified**
```
Backend:
- app/models/meal_plan.py:96 - Added optional plan_id field
- app/routes/plan.py:90 - Include plan_id in response

Mobile:
- mobile/utils/mealPlanUtils.ts - New utility functions for plan ID management
- mobile/screens/PlanScreen.tsx:19,405-410 - Store plan ID when generated
- mobile/screens/SmartDietScreen.tsx:19,137-144 - Use actual plan ID instead of hardcoded value
- mobile/utils/__tests__/mealPlanUtils.test.ts - New comprehensive tests
```

---

## 📋 **Manual Testing Checklist**

### **Prerequisites**
- [ ] Backend running: `python main.py`
- [ ] Android emulator running: Pixel_7_API_33
- [ ] Mobile app built and running: `npx expo run:android`

---

## **TEST 1: Meal Plan Generation and ID Storage**
**Module**: PlanScreen → Meal Plan Generation  
**Expected**: Plan IDs are properly generated and stored

### **Steps to Test:**
1. **Open the app** in Android simulator
2. **Navigate to Plan screen** (bottom tab)
3. **Tap "Generate New Plan" button**
4. **Wait for plan to generate** (should show loading indicator)
5. **Verify plan displays** with meals and nutritional data
6. **Check console logs** for plan ID storage message: `"Stored meal plan ID: [UUID]"`

### **Expected Result**
- Plan generates successfully with nutritional data
- Console shows: `"Stored meal plan ID: [actual UUID]"`
- No errors in console logs

### **If Test Fails**
- Check backend is running on correct port
- Verify meal plan generation API is working
- Look for AsyncStorage errors in console

---

## **TEST 2: Smart Diet Optimization with Real Plan ID**
**Module**: SmartDietScreen → Optimization Context  
**Expected**: Uses actual meal plan ID instead of hardcoded value

### **Steps to Test:**
1. **Complete TEST 1** to ensure a meal plan is generated and stored
2. **Navigate to Smart Diet screen**
3. **Select "Optimize" context** from the dropdown
4. **Keep other settings default** (don't change preferences)
5. **Tap "Get Smart Suggestions"**
6. **Wait for suggestions to load**
7. **Check console logs** for meal plan ID usage (no error about missing plan)

### **Expected Result**
- Smart Diet suggestions load successfully
- No error message: "No meal plan found. Please generate a meal plan first..."
- Backend receives actual meal plan ID (not demo_meal_plan_001)
- Suggestions are contextual to the generated meal plan

### **If Test Fails**
- Verify TEST 1 completed successfully
- Check if meal plan ID was properly stored
- Look for network errors in console
- Verify backend Smart Diet endpoint is working

---

## **TEST 3: Error Handling - No Meal Plan Available**
**Module**: SmartDietScreen → Error Handling  
**Expected**: Graceful error when no meal plan exists

### **Steps to Test:**
1. **Clear app storage** (or fresh install)
2. **Open Smart Diet screen** without generating a plan
3. **Select "Optimize" context**
4. **Tap "Get Smart Suggestions"**
5. **Verify error message appears**

### **Expected Result**
- Error message: "No meal plan found. Please generate a meal plan first from the Plan tab."
- No app crash or unexpected behavior
- Clear user guidance on what to do next

### **If Test Fails**
- Check error handling logic in SmartDietScreen.tsx:141-143
- Verify AsyncStorage clearing worked properly

---

## **TEST 4: Cross-Session Persistence**
**Module**: AsyncStorage → Plan ID Persistence  
**Expected**: Plan ID survives app restarts

### **Steps to Test:**
1. **Complete TEST 1** to generate and store a plan
2. **Note the plan ID** from console logs
3. **Close app completely**:
   - Press home button
   - Swipe up to show app switcher
   - Swipe DietIntel app away to close it
4. **Reopen the app**
5. **Navigate to Smart Diet screen**
6. **Select "Optimize" context**
7. **Tap "Get Smart Suggestions"**
8. **Verify it works** without generating a new plan

### **Expected Result**
- Smart Diet optimization works after app restart
- Uses the same plan ID as before restart
- No need to regenerate meal plan

### **Additional Test - New Plan Overwrites Old**
1. **Generate a new meal plan** in Plan screen
2. **Note the new plan ID** from console logs
3. **Use Smart Diet optimization**
4. **Verify it uses the new plan ID** (most recent one)

---

## **TEST 5: Plan ID Utility Functions**
**Module**: Meal Plan Utils → AsyncStorage Integration  
**Expected**: Utility functions work correctly

### **Steps to Test:**
1. **Open React Native Debugger** or use console.log testing
2. **Generate a meal plan** to store an ID
3. **In console, test utility functions**:
```javascript
import { getCurrentMealPlanId, hasCurrentMealPlanId } from './utils/mealPlanUtils';

// Test retrieval
getCurrentMealPlanId().then(id => console.log('Current plan ID:', id));

// Test existence check
hasCurrentMealPlanId().then(exists => console.log('Plan exists:', exists));
```

### **Expected Result**
- `getCurrentMealPlanId()` returns the actual stored UUID
- `hasCurrentMealPlanId()` returns `true` when plan exists
- Functions handle errors gracefully

---

## 🚨 **Common Issues to Watch For**

### **Red Flags (Should NOT Happen)**
- ❌ SmartDiet still shows hardcoded 'demo_meal_plan_001'
- ❌ Console errors: "Objects are not valid as a React child"
- ❌ AsyncStorage errors when storing/retrieving plan ID
- ❌ App crashes when using optimization without meal plan
- ❌ Plan ID not included in backend response

### **Green Flags (Should Happen)**
- ✅ Actual UUIDs in console logs (e.g., 'meal_plan_a1b2c3d4-...')
- ✅ Smart Diet optimization works with real meal plans
- ✅ Graceful error handling for missing plans
- ✅ Plan ID persists across app restarts
- ✅ New meal plans update the stored ID

---

## 📊 **Test Results Recording**

### **Meal Plan Generation Test**
- [ ] ✅ PASS - Plan generates and stores ID correctly
- [ ] ❌ FAIL - Plan generation fails or ID not stored
- [ ] 🔄 PARTIAL - Plan generates but ID storage fails
- **Notes**: ________________________________

### **Smart Diet Optimization Test**
- [ ] ✅ PASS - Uses actual plan ID for optimization
- [ ] ❌ FAIL - Still uses hardcoded ID or fails completely
- [ ] 🔄 PARTIAL - Works but with issues
- **Notes**: ________________________________

### **Error Handling Test**
- [ ] ✅ PASS - Shows helpful error when no plan exists
- [ ] ❌ FAIL - App crashes or shows confusing error
- [ ] 🔄 PARTIAL - Shows error but message unclear
- **Notes**: ________________________________

### **Persistence Test**
- [ ] ✅ PASS - Plan ID survives app restarts
- [ ] ❌ FAIL - Plan ID lost after restart
- [ ] 🔄 PARTIAL - Sometimes persists, sometimes doesn't
- **Notes**: ________________________________

---

## 🎯 **Success Criteria**

**The meal plan ID retrieval system is successful if:**
1. ✅ Backend includes plan_id in MealPlanResponse
2. ✅ Mobile app stores plan ID when generating plans
3. ✅ SmartDietScreen uses actual plan ID instead of hardcoded value
4. ✅ Error handling works when no plan exists
5. ✅ Plan ID persists across app restarts
6. ✅ All relevant tests pass (16 backend + 10 mobile + 23 AsyncStorage)

---

## 📝 **Next Steps After Testing**

### **If All Tests Pass:**
1. **Commit changes** with message: "feat: implement actual meal plan ID retrieval system"
2. **Update main README** with meal plan ID feature completion
3. **Move to next TODO**: Create meal plan API integration for adding recommendations
4. **Consider**: Add meal plan listing API for future enhancements

### **If Tests Fail:**
1. **Document specific failures** in notes above
2. **Check console logs** for error details
3. **Re-run backend tests**: `python -m pytest tests/test_plan_routes_working.py -v`
4. **Re-run mobile tests**: `npx jest utils/__tests__/mealPlanUtils.test.ts`
5. **Fix issues and re-test**

---

## 🔧 **Debug Commands**

```bash
# Backend tests
cd /Users/matiasleandrokruk/Documents/DietIntel
python -m pytest tests/test_plan_routes_working.py -v

# Mobile tests
cd mobile
npx jest utils/__tests__/mealPlanUtils.test.ts
npm run test:asyncstorage

# Start services
python main.py
npx expo run:android

# Console debugging
# Look for: "Stored meal plan ID: [UUID]" in mobile app logs
# Check network tab for actual API calls with plan_id parameter
```

---

**Test Report Created**: September 7, 2025  
**Implementation**: Meal Plan ID Retrieval System  
**Tester**: ___________________  
**Date Tested**: ___________________  
**Overall Result**: [ ] PASS [ ] FAIL [ ] PARTIAL  
**Ready for Production**: [ ] YES [ ] NO
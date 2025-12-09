const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const dietIntelAPI = require('../utils/api');

// Meal Plans Dashboard
router.get('/', async (req, res) => {
  try {
    // In a real app, you'd get user-specific plans
    // For demo purposes, we'll show a list of sample plans
    const samplePlans = [
      {
        id: '1',
        name: 'Balanced Weight Maintenance',
        date: new Date().toISOString().split('T')[0],
        target_calories: 2200,
        status: 'active',
        created_at: new Date(Date.now() - 86400000).toISOString() // Yesterday
      },
      {
        id: '2', 
        name: 'High Protein Muscle Gain',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
        target_calories: 2800,
        status: 'pending',
        created_at: new Date().toISOString()
      }
    ];

    res.render('plans/index', {
      title: 'Meal Plans',
      plans: samplePlans,
      description: 'Manage and view your personalized meal plans'
    });
  } catch (error) {
    console.error('Error fetching meal plans:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Unable to fetch meal plans',
      error: error
    });
  }
});

// View specific meal plan details
router.get('/:id', async (req, res) => {
  try {
    const planId = req.params.id;
    
    // For demo purposes, generate a sample meal plan
    // In a real app, you'd fetch from the API: await dietIntelAPI.getMealPlan(planId)
    const samplePlan = {
      id: planId,
      name: `Meal Plan ${planId}`,
      date: new Date().toISOString().split('T')[0],
      bmr: 1750.0,
      tdee: 2710.0,
      daily_calorie_target: 2710.0,
      meals: [
        {
          name: 'Breakfast',
          target_calories: 677.5,
          actual_calories: 650.0,
          items: [
            {
              barcode: '000000000001',
              name: 'Steel Cut Oats',
              serving: '50g',
              calories: 190.0,
              macros: {
                protein_g: 7.0,
                fat_g: 3.0,
                carbs_g: 32.0,
                sugars_g: 1.0,
                salt_g: 0.0
              }
            },
            {
              barcode: '000000000002',
              name: 'Greek Yogurt',
              serving: '150g',
              calories: 130.0,
              macros: {
                protein_g: 15.0,
                fat_g: 4.0,
                carbs_g: 9.0,
                sugars_g: 6.0,
                salt_g: 0.1
              }
            },
            {
              barcode: '000000000003',
              name: 'Mixed Berries',
              serving: '100g',
              calories: 330.0,
              macros: {
                protein_g: 1.0,
                fat_g: 0.3,
                carbs_g: 14.0,
                sugars_g: 10.0,
                salt_g: 0.0
              }
            }
          ]
        },
        {
          name: 'Lunch',
          target_calories: 948.5,
          actual_calories: 920.0,
          items: [
            {
              barcode: '000000000004',
              name: 'Grilled Chicken Breast',
              serving: '150g',
              calories: 248.0,
              macros: {
                protein_g: 46.0,
                fat_g: 5.4,
                carbs_g: 0.0,
                sugars_g: 0.0,
                salt_g: 0.2
              }
            },
            {
              barcode: '000000000005',
              name: 'Brown Rice',
              serving: '100g',
              calories: 216.0,
              macros: {
                protein_g: 5.0,
                fat_g: 1.8,
                carbs_g: 45.0,
                sugars_g: 0.7,
                salt_g: 0.0
              }
            },
            {
              barcode: '000000000006',
              name: 'Mixed Vegetables',
              serving: '200g',
              calories: 456.0,
              macros: {
                protein_g: 3.0,
                fat_g: 0.4,
                carbs_g: 12.0,
                sugars_g: 8.0,
                salt_g: 0.1
              }
            }
          ]
        },
        {
          name: 'Dinner',
          target_calories: 813.0,
          actual_calories: 790.0,
          items: [
            {
              barcode: '000000000007',
              name: 'Salmon Fillet',
              serving: '120g',
              calories: 248.0,
              macros: {
                protein_g: 25.0,
                fat_g: 15.0,
                carbs_g: 0.0,
                sugars_g: 0.0,
                salt_g: 0.3
              }
            },
            {
              barcode: '000000000008',
              name: 'Sweet Potato',
              serving: '150g',
              calories: 129.0,
              macros: {
                protein_g: 2.3,
                fat_g: 0.2,
                carbs_g: 30.0,
                sugars_g: 6.0,
                salt_g: 0.0
              }
            },
            {
              barcode: '000000000009',
              name: 'Green Salad',
              serving: '100g',
              calories: 413.0,
              macros: {
                protein_g: 2.0,
                fat_g: 0.2,
                carbs_g: 4.0,
                sugars_g: 2.0,
                salt_g: 0.0
              }
            }
          ]
        },
        {
          name: 'Snacks',
          target_calories: 271.0,
          actual_calories: 250.0,
          items: [
            {
              barcode: '000000000010',
              name: 'Almonds',
              serving: '30g',
              calories: 174.0,
              macros: {
                protein_g: 6.4,
                fat_g: 15.0,
                carbs_g: 2.5,
                sugars_g: 1.2,
                salt_g: 0.0
              }
            },
            {
              barcode: '000000000011',
              name: 'Apple',
              serving: '1 medium',
              calories: 76.0,
              macros: {
                protein_g: 0.4,
                fat_g: 0.2,
                carbs_g: 20.0,
                sugars_g: 15.0,
                salt_g: 0.0
              }
            }
          ]
        }
      ],
      metrics: {
        total_calories: 2610.0,
        protein_g: 125.1,
        fat_g: 89.5,
        carbs_g: 328.5,
        sugars_g: 52.9,
        salt_g: 0.7,
        protein_percent: 19.2,
        fat_percent: 30.8,
        carbs_percent: 50.0
      },
      created_at: new Date().toISOString(),
      flexibility_used: true,
      optional_products_used: 0
    };

    res.render('plans/detail', {
      title: `${samplePlan.name} - Meal Plan Details`,
      plan: samplePlan,
      description: 'Detailed view of your meal plan with nutritional breakdown'
    });
  } catch (error) {
    console.error('Error fetching meal plan details:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Unable to fetch meal plan details',
      error: error
    });
  }
});

// Generate new meal plan form
router.get('/new', (req, res) => {
  res.render('plans/new', {
    title: 'Generate New Meal Plan',
    description: 'Create a personalized meal plan based on your goals and preferences'
  });
});

// Generate new meal plan
router.post('/generate', [
  body('age').isInt({ min: 10, max: 120 }).withMessage('Age must be between 10 and 120'),
  body('sex').isIn(['male', 'female']).withMessage('Sex must be male or female'),
  body('height_cm').isInt({ min: 100, max: 250 }).withMessage('Height must be between 100 and 250 cm'),
  body('weight_kg').isFloat({ min: 30, max: 300 }).withMessage('Weight must be between 30 and 300 kg'),
  body('activity_level').isIn(['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active']).withMessage('Invalid activity level'),
  body('goal').isIn(['lose_weight', 'maintain_weight', 'gain_weight']).withMessage('Invalid goal')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('plans/new', {
        title: 'Generate New Meal Plan',
        description: 'Create a personalized meal plan based on your goals and preferences',
        errors: errors.array(),
        formData: req.body
      });
    }

    const planRequest = {
      user_profile: {
        age: parseInt(req.body.age),
        sex: req.body.sex,
        height_cm: parseInt(req.body.height_cm),
        weight_kg: parseFloat(req.body.weight_kg),
        activity_level: req.body.activity_level,
        goal: req.body.goal
      },
      preferences: {
        dietary_restrictions: req.body.dietary_restrictions ? req.body.dietary_restrictions.split(',').map(s => s.trim()) : [],
        excludes: req.body.excludes ? req.body.excludes.split(',').map(s => s.trim()) : [],
        prefers: req.body.prefers ? req.body.prefers.split(',').map(s => s.trim()) : []
      },
      optional_products: req.body.optional_products ? req.body.optional_products.split(',').map(s => s.trim()) : [],
      flexibility: req.body.flexibility === 'true'
    };

    // Generate meal plan via API
    const mealPlan = await dietIntelAPI.generateMealPlan(planRequest);
    
    // Redirect to the generated plan details
    res.redirect(`/plans/generated?success=true`);
  } catch (error) {
    console.error('Error generating meal plan:', error);
    res.status(500).render('plans/new', {
      title: 'Generate New Meal Plan',
      description: 'Create a personalized meal plan based on your goals and preferences',
      error: 'Failed to generate meal plan. Please try again.',
      formData: req.body
    });
  }
});

// Success page for generated plans
router.get('/generated', (req, res) => {
  if (req.query.success) {
    res.render('plans/generated', {
      title: 'Meal Plan Generated Successfully',
      description: 'Your personalized meal plan has been created'
    });
  } else {
    res.redirect('/plans');
  }
});

module.exports = router;
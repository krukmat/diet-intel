# FEAT-PROPORTIONS - Plan de Pruebas

## Registro por Foto con Estimación de Porciones

**Versión**: 1.0.0
**Fecha**: 2025-01-07
**Autor**: DietIntel Team

---

## 📋 Resumen Ejecutivo

Este plan de pruebas cubre la feature **Registro por Foto con Estimación de Porciones** que incluye:
- Análisis visual inteligente integrado con Recipe AI existente
- Estimación automática de porciones con aprendizaje continuo
- Análisis nutricional completo con sugerencias de ejercicio
- Sistema de corrección simple para mejora progresiva
- Integración seamless con infraestructura actual

**Objetivos de prueba**:
- ✅ **INTEGRACIÓN CRÍTICA**: Validar integración Recipe AI → análisis visual → tracking
- ✅ **PRECISIÓN RECETAS**: Verificar identificación de recetas preparadas (>85%)
- ✅ **CÁLCULO NUTRICIONAL**: Confirmar calorías basado en receta conocida (>90%)
- ✅ **FLUJO MOBILE**: Probar experiencia completa desde cámara hasta registro
- ✅ **SUGERENCIAS EJERCICIO**: Validar cálculo déficit calórico + actividades sugeridas
- ✅ **APRENDIZAJE CONTINUO**: Verificar mejora precisión con correcciones

---

## 🏗️ Estrategia de Pruebas

### Principios de Prueba
- **Test-First Development**: Pruebas antes de implementación
- **Pyramid Testing**: 70% unitarias, 20% integración, 10% e2e
- **CI/CD Integration**: Pruebas automáticas en pipeline
- **Performance First**: Pruebas de rendimiento desde early stages

### Entornos de Prueba
- **Local**: Desarrollo individual (localhost:8000, Android emulator)
- **Dev**: Integración continua (test server)
- **Staging**: Pre-producción con datos reales
- **Prod**: Monitoreo continuo con métricas reales

---

## 🧪 Tipos de Pruebas

### 1. Pruebas Unitarias

#### 1.1 Servicios Backend

**VisionAnalyzer Service**
```python
# tests/test_vision_analyzer.py
class TestVisionAnalyzer(unittest.TestCase):

    def test_identify_ingredients_basic(self):
        """Test identificación básica de ingredientes comunes"""
        analyzer = VisionAnalyzer()
        image_path = "tests/fixtures/images/spaghetti_bolognese.jpg"

        ingredients = await analyzer.identify_ingredients(image_path)

        self.assertGreater(len(ingredients), 0)
        self.assertIn("pasta", [ing.name.lower() for ing in ingredients])
        self.assertIn("tomato_sauce", [ing.name.lower() for ing in ingredients])

    def test_estimate_portions_with_reference(self):
        """Test estimación de porciones usando objetos de referencia"""
        analyzer = VisionAnalyzer()
        ingredients = [MockIngredient("chicken_breast", 0.8)]
        image_path = "tests/fixtures/images/chicken_plate.jpg"

        portions = await analyzer.estimate_portions(ingredients, image_path)

        self.assertEqual(portions.total_calories, 132)  # 165 cal * 0.8
        self.assertEqual(portions.confidence_score, 0.85)

    def test_low_confidence_detection(self):
        """Test detección de análisis con baja confianza"""
        analyzer = VisionAnalyzer()
        image_path = "tests/fixtures/images/blurry_food.jpg"

        result = await analyzer.analyze_image(image_path, {})

        self.assertLess(result.confidence_score, 0.7)
        self.assertIsNotNone(result.partial_identification)
```

**ExerciseCalculator Service**
```python
# tests/test_exercise_calculator.py
class TestExerciseCalculator(unittest.TestCase):

    def test_calculate_calorie_deficit(self):
        """Test cálculo de déficit calórico"""
        calculator = ExerciseCalculator()
        consumed = 1850
        target = 2200

        deficit = calculator.calculate_calorie_deficit(consumed, target)

        self.assertEqual(deficit, 350)

    def test_suggest_exercise_for_deficit(self):
        """Test sugerencias de ejercicio para déficit específico"""
        calculator = ExerciseCalculator()
        deficit = 400
        user_profile = {"weight_kg": 70, "activity_level": "moderate"}

        suggestions = calculator.suggest_exercise(deficit, user_profile)

        self.assertGreater(len(suggestions), 0)
        total_calories = sum(s.calories_burned for s in suggestions)
        self.assertGreaterEqual(total_calories, 350)  # Al menos 350 cal

    def test_estimate_calories_burned(self):
        """Test estimación de calorías quemadas por actividad"""
        calculator = ExerciseCalculator()
        calories = calculator.estimate_calories_burned("running", 30, 70)

        self.assertGreater(calories, 200)  # Running quema >200 cal en 30 min
        self.assertLess(calories, 500)    # Pero no más de 500 cal
```

#### 1.2 Utilidades Backend

**PortionEstimator Utils**
```python
# tests/test_portion_estimator.py
class TestPortionEstimator(unittest.TestCase):

    def test_estimate_from_visual_markers(self):
        """Test estimación basada en marcadores visuales"""
        estimator = PortionEstimator()
        markers = ["plate_edge", "fork_reference"]
        reference_objects = ["standard_plate"]

        grams = estimator.estimate_from_visual_markers(markers, reference_objects)

        self.assertIsInstance(grams, float)
        self.assertGreater(grams, 50)   # Porción mínima razonable
        self.assertLess(grams, 1000)    # Porción máxima razonable

    def test_calculate_nutritional_impact(self):
        """Test cálculo de impacto nutricional"""
        estimator = PortionEstimator()
        ingredient = "chicken_breast"
        grams = 150

        impact = estimator.calculate_nutritional_impact(ingredient, grams)

        self.assertEqual(impact.calories, 247.5)  # 165 cal/100g * 1.5
        self.assertEqual(impact.protein_g, 46.5)  # 31g/100g * 1.5
```

#### 1.3 Componentes Mobile

**VisionLogService Tests**
```typescript
// mobile/__tests__/services/VisionLogService.test.ts
describe('VisionLogService', () => {
  let service: VisionLogService;

  beforeEach(() => {
    service = new VisionLogService();
  });

  test('uploadImageForAnalysis success', async () => {
    const mockImageUri = 'file://test-image.jpg';
    const mockResponse: VisionLogResponse = {
      id: 'test-id',
      identified_ingredients: [
        {
          name: 'chicken_breast',
          estimated_grams: 150,
          confidence_score: 0.85
        }
      ],
      estimated_portions: {
        total_calories: 247,
        confidence_score: 0.82
      },
      created_at: new Date().toISOString()
    };

    // Mock API call
    jest.spyOn(service as any, 'makeApiCall').mockResolvedValue(mockResponse);

    const result = await service.uploadImageForAnalysis(mockImageUri, 'lunch');

    expect(result).toEqual(mockResponse);
    expect(result.estimated_portions.total_calories).toBe(247);
  });

  test('submitCorrection success', async () => {
    const logId = 'test-log-id';
    const correction = {
      corrected_portions: {
        ingredient_name: 'chicken_breast',
        estimated_grams: 150,
        actual_grams: 180
      },
      feedback_type: 'portion_correction'
    };

    jest.spyOn(service as any, 'makeApiCall').mockResolvedValue({ success: true });

    const result = await service.submitCorrection(logId, correction);

    expect(result).toBe(true);
  });
});
```

### 2. Pruebas de Integración

#### 2.0 Pruebas Críticas de Recipe AI Integration

**Recipe AI Integration Tests** (Prioridad Máxima)
```python
# tests/test_recipe_ai_integration.py
class TestRecipeAIVisionIntegration(unittest.TestCase):
    """
    Pruebas críticas para validar integración Recipe AI → análisis visual
    Estas pruebas deben pasar ANTES de cualquier despliegue
    """

    def test_recipe_recognition_accuracy(self):
        """Test precisión de reconocimiento de recetas preparadas"""
        # 1. Generar receta conocida con Recipe AI
        recipe_request = RecipeGenerationRequest(
            user_id="test-user",
            meal_type="lunch",
            target_calories_per_serving=450,
            dietary_restrictions=["none"],
            difficulty_preference="easy"
        )

        recipe_response = self.client.post("/recipe/generate", json=recipe_request.dict())
        self.assertEqual(recipe_response.status_code, 200)

        recipe = recipe_response.json()
        expected_calories = recipe["nutrition"]["calories_per_serving"]

        # 2. Simular imagen de receta preparada
        with open("tests/fixtures/images/prepared_chicken_rice.jpg", 'rb') as image_file:
            vision_response = self.client.post(
                "/food/vision-log",
                files={"image": ("prepared_recipe.jpg", image_file, "image/jpeg")},
                data={"meal_type": "lunch"}
            )

        self.assertEqual(vision_response.status_code, 200)
        vision_data = vision_response.json()

        # 3. Validar precisión de identificación
        self.assertGreater(vision_data["estimated_portions"]["confidence_score"], 0.85)

        # 4. Validar cálculo nutricional preciso (±10% tolerancia)
        actual_calories = vision_data["estimated_portions"]["total_calories"]
        calorie_diff = abs(actual_calories - expected_calories) / expected_calories
        self.assertLess(calorie_diff, 0.10)  # Menos de 10% diferencia

    def test_automatic_meal_plan_registration(self):
        """Test registro automático en meal plan existente"""
        # 1. Crear meal plan para usuario
        plan_request = MealPlanRequest(
            user_profile=UserProfile(
                age=30, sex="male", height_cm=175, weight_kg=70,
                activity_level="moderately_active", goal="maintain"
            )
        )

        plan_response = self.client.post("/plan/generate", json=plan_request.dict())
        plan_id = plan_response.json()["plan_id"]

        # 2. Analizar imagen y verificar registro automático
        with open("tests/fixtures/images/prepared_meal.jpg", 'rb') as image_file:
            vision_response = self.client.post(
                "/food/vision-log",
                files={"image": ("prepared_meal.jpg", image_file, "image/jpeg")},
                data={"meal_type": "lunch"}
            )

        # 3. Verificar que se registró en meal plan
        updated_plan = self.client.get(f"/plan/{plan_id}").json()
        lunch_meal = next(meal for meal in updated_plan["meals"] if meal["name"] == "Lunch")
        self.assertGreater(len(lunch_meal["items"]), 0)

    def test_exercise_suggestions_context_aware(self):
        """Test sugerencias de ejercicio basadas en contexto nutricional"""
        # 1. Análisis con déficit calórico significativo
        with open("tests/fixtures/images/light_meal.jpg", 'rb') as image_file:
            response = self.client.post(
                "/food/vision-log",
                files={"image": ("light_meal.jpg", image_file, "image/jpeg")},
                data={
                    "meal_type": "lunch",
                    "user_context": json.dumps({
                        "current_weight_kg": 70,
                        "activity_level": "moderately_active",
                        "goal": "lose_weight"
                    })
                }
            )

        self.assertEqual(response.status_code, 201)  # With exercise suggestions

        data = response.json()
        self.assertIn("exercise_suggestions", data)
        self.assertIn("calorie_balance", data)

        # 2. Validar lógica de sugerencias
        exercises = data["exercise_suggestions"]
        self.assertGreater(len(exercises), 0)

        # 3. Verificar que calorías de ejercicio compensan déficit
        total_exercise_calories = sum(ex["estimated_calories_burned"] for ex in exercises)
        calorie_deficit = data["calorie_balance"]["calorie_deficit"]
        self.assertGreaterEqual(total_exercise_calories, calorie_deficit * 0.8)
```

#### 2.1 API Endpoints

**Food Vision API Integration**
```python
# tests/test_api_integration_food_vision.py
class TestFoodVisionAPIIntegration(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        self.test_image_path = "tests/fixtures/images/test_meal.jpg"

    def test_vision_log_endpoint_full_flow(self):
        """Test flujo completo de análisis de imagen"""
        with open(self.test_image_path, 'rb') as image_file:
            response = self.client.post(
                "/food/vision-log",
                files={"image": ("test_meal.jpg", image_file, "image/jpeg")},
                data={"meal_type": "lunch"}
            )

        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertIn("id", data)
        self.assertIn("identified_ingredients", data)
        self.assertIn("estimated_portions", data)
        self.assertIn("exercise_suggestions", data)

        # Validar estructura de ingredientes
        ingredients = data["identified_ingredients"]
        self.assertGreater(len(ingredients), 0)

        for ingredient in ingredients:
            self.assertIn("name", ingredient)
            self.assertIn("estimated_grams", ingredient)
            self.assertIn("confidence_score", ingredient)
            self.assertGreaterEqual(ingredient["confidence_score"], 0.0)
            self.assertLessEqual(ingredient["confidence_score"], 1.0)

    def test_vision_log_with_exercise_suggestions(self):
        """Test que incluye sugerencias de ejercicio cuando aplica"""
        with open(self.test_image_path, 'rb') as image_file:
            response = self.client.post(
                "/food/vision-log",
                files={"image": ("test_meal.jpg", image_file, "image/jpeg")},
                data={
                    "meal_type": "lunch",
                    "user_context": json.dumps({
                        "current_weight_kg": 70,
                        "activity_level": "moderately_active",
                        "goal": "lose_weight"
                    })
                }
            )

        self.assertEqual(response.status_code, 201)  # Created with exercise

        data = response.json()
        self.assertIn("exercise_suggestions", data)
        self.assertIn("calorie_balance", data)

        # Validar sugerencias de ejercicio
        exercises = data["exercise_suggestions"]
        self.assertGreater(len(exercises), 0)

        for exercise in exercises:
            self.assertIn("activity_type", exercise)
            self.assertIn("duration_minutes", exercise)
            self.assertIn("estimated_calories_burned", exercise)
            self.assertGreater(exercise["duration_minutes"], 0)
            self.assertGreater(exercise["estimated_calories_burned"], 0)

    def test_vision_history_pagination(self):
        """Test paginación del historial de análisis"""
        # Crear múltiples análisis
        for i in range(5):
            with open(self.test_image_path, 'rb') as image_file:
                self.client.post(
                    "/food/vision-log",
                    files={"image": (f"test_meal_{i}.jpg", image_file, "image/jpeg")}
                )

        # Test paginación
        response = self.client.get("/food/vision-history?limit=2&offset=0")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(len(data["logs"]), 2)
        self.assertTrue(data["has_more"])
        self.assertEqual(data["total_count"], 5)
```

#### 2.2 Base de Datos

**Database Integration Tests**
```python
# tests/test_database_integration.py
class TestVisionDatabaseIntegration(unittest.TestCase):

    def test_vision_log_storage_and_retrieval(self):
        """Test almacenamiento y recuperación de análisis de visión"""
        # Crear análisis de prueba
        vision_log = VisionLog(
            id="test-vision-log",
            user_id="test-user",
            identified_ingredients=[
                IdentifiedIngredient(
                    name="chicken_breast",
                    estimated_grams=150,
                    confidence_score=0.85
                )
            ],
            estimated_portions=PortionsEstimate(
                total_calories=247,
                confidence_score=0.82
            )
        )

        # Almacenar en BD
        stored_id = await db_service.store_vision_log(vision_log)
        self.assertEqual(stored_id, "test-vision-log")

        # Recuperar de BD
        retrieved = await db_service.get_vision_log("test-vision-log")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.user_id, "test-user")
        self.assertEqual(len(retrieved.identified_ingredients), 1)

    def test_vision_corrections_storage(self):
        """Test almacenamiento de correcciones de usuario"""
        correction = VisionCorrection(
            id="test-correction",
            vision_log_id="test-vision-log",
            user_id="test-user",
            correction_type="portion_correction",
            original_data={"estimated_grams": 150},
            corrected_data={"actual_grams": 180}
        )

        stored_id = await db_service.store_vision_correction(correction)
        self.assertEqual(stored_id, "test-correction")

        # Verificar que afecta análisis futuros
        improved_logs = await db_service.get_user_vision_logs("test-user")
        # Validar que el sistema aprendió de la corrección
```

#### 2.3 Servicios Externos

**OCR Service Integration**
```python
# tests/test_ocr_integration.py
class TestOCRServiceIntegration(unittest.TestCase):

    def test_ocr_service_fallback_chain(self):
        """Test cadena de fallback de servicios OCR"""
        # Mock external OCR failure
        with patch('app.services.nutrition_ocr.call_external_ocr') as mock_external:
            mock_external.return_value = {"confidence": 0}  # External fails

            # Mock local OCR success
            with patch('app.services.nutrition_ocr.extract_nutrients_from_image') as mock_local:
                mock_local.return_value = {
                    "raw_text": "Energy: 247 kcal",
                    "parsed_nutriments": {
                        "energy_kcal": 247,
                        "protein_g": 31,
                        "fat_g": 3.6,
                        "carbs_g": 0
                    },
                    "confidence": 0.85
                }

                # Test endpoint
                with open("tests/fixtures/images/test_meal.jpg", 'rb') as image_file:
                    response = self.client.post(
                        "/food/scan-label-external",
                        files={"image": ("test_meal.jpg", image_file, "image/jpeg")}
                    )

                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertEqual(data["source"], "Local OCR (fallback)")
                self.assertEqual(data["confidence"], 0.85)
```

### 3. Pruebas End-to-End (E2E)

#### 3.1 Flujos Completos de Usuario

**Recipe AI → Foto → Tracking**
```python
# tests/test_e2e_recipe_to_tracking.py
class TestRecipeToTrackingE2E(unittest.TestCase):

    def test_complete_recipe_vision_flow(self):
        """Test flujo completo desde receta hasta análisis visual"""
        # 1. Generar receta con Recipe AI
        recipe_request = RecipeGenerationRequest(
            user_id="test-user",
            meal_type="lunch",
            target_calories_per_serving=500
        )

        recipe_response = self.client.post("/recipe/generate", json=recipe_request.dict())
        self.assertEqual(recipe_response.status_code, 200)

        recipe = recipe_response.json()
        recipe_id = recipe["id"]

        # 2. Simular preparación y toma de foto
        # (En ambiente real, usuario prepara receta y toma foto)

        # 3. Analizar imagen de receta preparada
        with open("tests/fixtures/images/prepared_recipe.jpg", 'rb') as image_file:
            vision_response = self.client.post(
                "/food/vision-log",
                files={"image": ("prepared_recipe.jpg", image_file, "image/jpeg")},
                data={"meal_type": "lunch"}
            )

        self.assertEqual(vision_response.status_code, 200)
        vision_data = vision_response.json()

        # 4. Verificar que reconoce receta preparada
        self.assertGreater(vision_data["estimated_portions"]["confidence_score"], 0.8)
        self.assertIn("exercise_suggestions", vision_data)

        # 5. Verificar integración con meal plan
        # (Validar que se registra automáticamente en tracking)
```

**Mobile App Full Flow**
```typescript
// mobile/__tests__/e2e/VisionLogFlow.test.ts
describe('Vision Log E2E Flow', () => {
  test('complete mobile vision log flow', async () => {
    // 1. Usuario abre cámara
    const cameraScreen = render(<CameraScreen />);
    expect(cameraScreen.getByText('Take Photo')).toBeTruthy();

    // 2. Toma foto de comida
    const mockImage = await createMockImageFile();
    fireEvent.press(cameraScreen.getByText('Capture'));

    // 3. Navega a análisis
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('VisionAnalysis');
    });

    // 4. Muestra resultado de análisis
    const analysisScreen = render(<VisionAnalysisModal />);
    await waitFor(() => {
      expect(analysisScreen.getByText(/calories/i)).toBeTruthy();
    });

    // 5. Muestra sugerencias de ejercicio
    await waitFor(() => {
      expect(analysisScreen.getByText(/exercise/i)).toBeTruthy();
    });

    // 6. Usuario confirma y registra
    fireEvent.press(analysisScreen.getByText('Confirm'));

    // 7. Verificar registro en tracking
    await waitFor(() => {
      expect(mockTrackMeal).toHaveBeenCalled();
    });
  });
});
```

#### 3.2 Escenarios de Error

**Error Handling E2E**
```python
# tests/test_e2e_error_scenarios.py
class TestErrorScenariosE2E(unittest.TestCase):

    def test_blurry_image_handling(self):
        """Test manejo de imágenes borrosas"""
        with open("tests/fixtures/images/blurry_food.jpg", 'rb') as image_file:
            response = self.client.post(
                "/food/vision-log",
                files={"image": ("blurry.jpg", image_file, "image/jpeg")}
            )

        # Debería devolver baja confianza pero no error
        self.assertEqual(response.status_code, 202)  # Accepted with low confidence

        data = response.json()
        self.assertLess(data["confidence_score"], 0.7)
        self.assertTrue(data["requires_manual_review"])

    def test_network_timeout_recovery(self):
        """Test recuperación de timeout de red"""
        with patch('app.services.vision_analyzer.analyze_image') as mock_analyze:
            mock_analyze.side_effect = httpx.TimeoutException("Timeout")

            with open("tests/fixtures/images/test_meal.jpg", 'rb') as image_file:
                response = self.client.post(
                    "/food/vision-log",
                    files={"image": ("test_meal.jpg", image_file, "image/jpeg")}
                )

        # Debería fallback a análisis local
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("identified_ingredients", data)
```

### 4. Pruebas de Performance

#### 4.1 Load Testing

**API Load Tests**
```python
# tests/test_performance_api.py
class TestAPIPerformance(unittest.TestCase):

    def test_vision_analysis_under_load(self):
        """Test rendimiento bajo carga de análisis de visión"""
        # Simular 100 usuarios concurrentes
        async def single_request(user_id):
            with open("tests/fixtures/images/test_meal.jpg", 'rb') as image_file:
                async with httpx.AsyncClient() as client:
                    return await client.post(
                        "http://localhost:8000/food/vision-log",
                        files={"image": ("test_meal.jpg", image_file, "image/jpeg")},
                        data={"meal_type": "lunch"}
                    )

        # Ejecutar 100 requests concurrentes
        start_time = time.time()

        responses = await asyncio.gather(*[
            single_request(f"user_{i}") for i in range(100)
        ])

        total_time = time.time() - start_time

        # Validar rendimiento
        self.assertLess(total_time, 30)  # Menos de 30 segundos para 100 requests

        success_count = sum(1 for r in responses if r.status_code == 200)
        self.assertGreaterEqual(success_count, 95)  # 95% éxito mínimo

        # Validar tiempos de respuesta individuales
        for response in responses[:10]:  # Sample check
            data = response.json()
            self.assertLess(data["processing_time_ms"], 5000)  # < 5 segundos

    def test_memory_usage_under_load(self):
        """Test uso de memoria bajo carga sostenida"""
        import psutil
        import os

        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB

        # Simular carga sostenida
        for i in range(50):
            with open("tests/fixtures/images/test_meal.jpg", 'rb') as image_file:
                response = self.client.post(
                    "/food/vision-log",
                    files={"image": ("test_meal.jpg", image_file, "image/jpeg")}
                )

        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory

        # Memoria no debería aumentar más de 100MB
        self.assertLess(memory_increase, 100)
```

#### 4.2 Stress Testing

**Database Stress Tests**
```python
# tests/test_stress_database.py
class TestDatabaseStress(unittest.TestCase):

    def test_high_volume_vision_logs(self):
        """Test almacenamiento masivo de análisis de visión"""
        # Insertar 1000 análisis de visión
        vision_logs = []
        for i in range(1000):
            log = VisionLog(
                id=f"stress-test-{i}",
                user_id=f"user-{i % 10}",  # 10 usuarios diferentes
                identified_ingredients=[
                    IdentifiedIngredient(
                        name=f"ingredient_{i % 5}",
                        estimated_grams=100 + (i % 50),
                        confidence_score=0.8 + (i % 3) * 0.05
                    )
                ],
                estimated_portions=PortionsEstimate(
                    total_calories=200 + (i % 300),
                    confidence_score=0.8
                )
            )
            vision_logs.append(log)

        start_time = time.time()

        # Insertar en batch
        inserted_count = await db_service.batch_insert_vision_logs(vision_logs)

        insert_time = time.time() - start_time

        self.assertEqual(inserted_count, 1000)
        self.assertLess(insert_time, 10)  # Menos de 10 segundos

        # Verificar que se pueden recuperar eficientemente
        query_start = time.time()
        all_logs = await db_service.get_recent_vision_logs(limit=1000)
        query_time = time.time() - query_start

        self.assertEqual(len(all_logs), 1000)
        self.assertLess(query_time, 2)  # Query < 2 segundos
```

### 5. Pruebas de Seguridad

#### 5.1 Autenticación y Autorización

**Security Tests**
```python
# tests/test_security.py
class TestVisionSecurity(unittest.TestCase):

    def test_unauthorized_access_blocked(self):
        """Test que accesos no autorizados son bloqueados"""
        # Intentar acceder sin autenticación
        response = self.client.get("/food/vision-history")
        self.assertEqual(response.status_code, 401)

        # Intentar acceder con token inválido
        headers = {"Authorization": "Bearer invalid_token"}
        response = self.client.get("/food/vision-history", headers=headers)
        self.assertEqual(response.status_code, 401)

    def test_user_data_isolation(self):
        """Test aislamiento de datos entre usuarios"""
        # Crear análisis para usuario 1
        with open("tests/fixtures/images/test_meal.jpg", 'rb') as image_file:
            response1 = self.client.post(
                "/food/vision-log",
                files={"image": ("test_meal.jpg", image_file, "image/jpeg")},
                headers={"Authorization": "Bearer user1_token"}
            )

        # Crear análisis para usuario 2
        with open("tests/fixtures/images/test_meal.jpg", 'rb') as image_file:
            response2 = self.client.post(
                "/food/vision-log",
                files={"image": ("test_meal.jpg", image_file, "image/jpeg")},
                headers={"Authorization": "Bearer user2_token"}
            )

        # Verificar que usuario 1 no ve datos de usuario 2
        history_response = self.client.get(
            "/food/vision-history",
            headers={"Authorization": "Bearer user1_token"}
        )

        user1_logs = history_response.json()["logs"]
        self.assertEqual(len(user1_logs), 1)
        self.assertEqual(user1_logs[0]["user_id"], "user1")
```

### 6. Pruebas de Regresión

#### 6.1 Regression Test Suite

**Automated Regression Tests**
```python
# tests/test_regression_vision.py
class TestVisionRegression(unittest.TestCase):
    """
    Suite de pruebas de regresión que se ejecuta en cada commit
    """

    def test_critical_vision_paths(self):
        """Test paths críticos de visión que nunca deben fallar"""
        test_cases = [
            ("tests/fixtures/images/chicken_rice.jpg", "lunch"),
            ("tests/fixtures/images/salad_bowl.jpg", "dinner"),
            ("tests/fixtures/images/breakfast_oatmeal.jpg", "breakfast"),
        ]

        for image_path, meal_type in test_cases:
            with self.subTest(image=image_path, meal_type=meal_type):
                with open(image_path, 'rb') as image_file:
                    response = self.client.post(
                        "/food/vision-log",
                        files={"image": (image_path.split('/')[-1], image_file, "image/jpeg")},
                        data={"meal_type": meal_type}
                    )

                self.assertEqual(response.status_code, 200,
                    f"Failed for {image_path}: {response.text}")

                data = response.json()
                self.assertGreater(data["estimated_portions"]["confidence_score"], 0.5)
                self.assertGreater(len(data["identified_ingredients"]), 0)

    def test_performance_regression(self):
        """Test que rendimiento no empeora entre versiones"""
        with open("tests/fixtures/images/test_meal.jpg", 'rb') as image_file:
            start_time = time.time()

            response = self.client.post(
                "/food/vision-log",
                files={"image": ("test_meal.jpg", image_file, "image/jpeg")}
            )

            processing_time = time.time() - start_time

            # Performance no debe degradar más de 20% vs baseline
            self.assertLess(processing_time, 6.0)  # Baseline: 5 segundos
```

---

## 📊 Métricas y KPIs de Prueba

### Cobertura de Código
- **Target**: > 85% cobertura total
- **Backend**: > 90% cobertura
- **Mobile**: > 80% cobertura
- **APIs**: 100% cobertura de endpoints

### Tiempos de Ejecución
- **Unit Tests**: < 30 segundos
- **Integration Tests**: < 2 minutos
- **E2E Tests**: < 5 minutos
- **Performance Tests**: < 3 minutos

### Métricas de Calidad
- **Test Success Rate**: > 95%
- **Flaky Test Rate**: < 5%
- **Mean Time to Detect**: < 1 hora
- **Test Debt Ratio**: < 10%

---

## 🛠️ Herramientas y Frameworks

### Backend Testing
- **Framework**: pytest
- **Coverage**: pytest-cov
- **Mocking**: unittest.mock + responses
- **Load Testing**: locust
- **API Testing**: FastAPI TestClient

### Mobile Testing
- **Framework**: Jest + React Testing Library
- **E2E**: Detox (React Native)
- **Coverage**: Jest coverage
- **Mocking**: @react-native-async-storage/async-storage mocks

### Database Testing
- **Framework**: pytest-asyncio
- **Fixtures**: Factory Boy
- **Migrations**: Alembic testing utilities

### CI/CD Integration
- **Pipeline**: GitHub Actions
- **Parallel Execution**: pytest-xdist
- **Artifacts**: Test reports + coverage
- **Notifications**: Slack + email alerts

---

## 📋 Casos de Prueba Específicos

### Casos de Éxito
1. **Análisis básico**: Imagen clara de comida común → identificación correcta
2. **Múltiples ingredientes**: Plato complejo → todos ingredientes detectados
3. **Estimación precisa**: Porción estándar → cálculo correcto de calorías
4. **Sugerencias ejercicio**: Déficit calórico → actividades apropiadas sugeridas
5. **Corrección aprendizaje**: Usuario corrige → mejora precisión futura

### Casos de Error
1. **Imagen borrosa**: Foto poco clara → respuesta baja confianza
2. **Comida desconocida**: Ingrediente raro → manejo graceful
3. **Timeout OCR**: Servicio externo lento → fallback local
4. **Datos inválidos**: Imagen corrupta → error apropiado
5. **Sobrecarga servidor**: Muchos requests → manejo cola/límite

### Casos Edge
1. **Porción mínima**: Muy poca comida → detección sensible
2. **Porción máxima**: Plato muy lleno → escala apropiada
3. **Mezcla texturas**: Comida variada → identificación correcta
4. **Iluminación pobre**: Foto oscura → mejora automática
5. **Ángulo extraño**: Foto desde ángulo → ajuste perspectiva

---

## 🚀 Ejecución de Pruebas

### Comandos Locales
```bash
# Ejecutar todas las pruebas
pytest tests/ -v --cov=app --cov-report=html

# Solo pruebas unitarias
pytest tests/test_*.py -k "unit" -v

# Solo pruebas de integración
pytest tests/test_*integration*.py -v

# Pruebas de performance
pytest tests/test_performance*.py --durations=10

# Generar reporte de cobertura
pytest --cov=app --cov-report=xml --cov-report=html
```

### Pipeline CI/CD
```yaml
# .github/workflows/tests.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.9, 3.10, 3.11]

    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}

    - name: Install dependencies
      run: |
        pip install -r requirements.txt
        pip install -r requirements-test.txt

    - name: Run tests
      run: |
        pytest tests/ -v --cov=app --cov-report=xml

    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

---

## 📈 Monitoreo y Reportes

### Métricas a Monitorear
- **Daily Test Runs**: Número de ejecuciones diarias
- **Test Pass Rate**: Porcentaje de pruebas exitosas
- **Average Test Duration**: Tiempo promedio de ejecución
- **Flaky Test Detection**: Pruebas que fallan intermitentemente
- **Coverage Trends**: Evolución de cobertura de código

### Reportes Generados
- **Coverage Report**: HTML detallado de cobertura
- **Test Summary**: Resumen ejecutivo de resultados
- **Performance Report**: Métricas de rendimiento
- **Regression Report**: Análisis de regresiones detectadas

### Alertas Configuradas
- **Test Failures**: Notificación inmediata en Slack
- **Coverage Drop**: Alerta si cobertura baja > 5%
- **Performance Degradation**: Si tiempos aumentan > 20%
- **Security Issues**: Fallos en pruebas de seguridad

---

## 🔄 Mantenimiento de Pruebas

### Estrategias de Mantenimiento
- **Regular Cleanup**: Eliminar pruebas obsoletas trimestralmente
- **Refactoring**: Mantener pruebas limpias y legibles
- **Documentation**: Documentar casos complejos
- **Review Process**: Code review para nuevas pruebas

### Mejora Continua
- **Test Reviews**: Revisiones periódicas de suite de pruebas
- **Performance Optimization**: Optimizar pruebas lentas
- **New Test Cases**: Añadir casos para nuevas features
- **Automation**: Automatizar tareas repetitivas de testing

Este plan de pruebas asegura calidad, confiabilidad y mantenibilidad de la feature **Registro por Foto con Estimación de Porciones**.

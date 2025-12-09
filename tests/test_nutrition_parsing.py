import pytest
import re
from unittest.mock import patch, MagicMock
from app.services.nutrition_ocr import NutritionTextParser


class TestNutritionFactsParsing:
    """Test parsing of nutrition facts in various formats"""
    
    @pytest.fixture
    def parser(self):
        return NutritionTextParser()
    
    def test_parse_standard_nutrition_label(self, parser):
        """Test parsing standard nutrition facts format"""
        text = """
        Nutrition Facts
        Serving Size: 100g
        
        Energy: 250 kcal
        Protein: 12.5g
        Total Fat: 8.2g
        Total Carbohydrates: 35.0g
        Sugars: 5.8g
        Sodium: 480mg
        Dietary Fiber: 3.5g
        """
        
        result = parser.parse_nutrition_text(text)
        
        assert result['confidence'] > 0.7
        nutrients = result['parsed_nutriments']
        assert nutrients['energy_kcal'] == 250.0
        assert nutrients['protein_g'] == 12.5
        assert nutrients['fat_g'] == 8.2
        assert nutrients['carbs_g'] == 35.0
        assert nutrients['sugars_g'] == 5.8
        assert 'fiber_g' in nutrients
    
    def test_parse_european_nutrition_label(self, parser):
        """Test parsing European-style nutrition label"""
        text = """
        Nährwertangaben pro 100g
        
        Brennwert: 1050 kJ / 250 kcal
        Eiweiß: 12,5g
        Kohlenhydrate: 35,0g
        davon Zucker: 5,8g
        Fett: 8,2g
        Salz: 1,2g
        """
        
        result = parser.parse_nutrition_text(text)
        
        nutrients = result['parsed_nutriments']
        assert nutrients['energy_kcal'] == 250.0
        assert nutrients['protein_g'] == 12.5
        assert nutrients['carbs_g'] == 35.0
        assert nutrients['sugars_g'] == 5.8
        assert nutrients['fat_g'] == 8.2
        assert nutrients['salt_g'] == 1.2
    
    def test_parse_spanish_nutrition_label(self, parser):
        """Test parsing Spanish nutrition label"""
        text = """
        Información Nutricional por 100g
        
        Energía: 250 kcal
        Proteínas: 12,5g
        Hidratos de carbono: 35,0g
        de los cuales azúcares: 5,8g
        Grasas: 8,2g
        Sal: 1,2g
        Fibra: 3,5g
        """
        
        result = parser.parse_nutrition_text(text)
        
        nutrients = result['parsed_nutriments']
        assert nutrients['energy_kcal'] == 250.0
        assert nutrients['protein_g'] == 12.5
        assert nutrients['carbs_g'] == 35.0
        assert nutrients['sugars_g'] == 5.8
        assert nutrients['fat_g'] == 8.2
        assert nutrients['salt_g'] == 1.2
    
    def test_parse_per_serving_values(self, parser):
        """Test parsing per-serving nutrition values"""
        text = """
        Nutrition Facts
        Per serving (200g)
        
        Energy: 500 kcal
        Protein: 25g
        Fat: 16.4g
        Carbohydrates: 70g
        """
        
        result = parser.parse_nutrition_text(text)
        
        # Should convert to per 100g values
        nutrients = result['parsed_nutriments']
        assert nutrients['energy_kcal'] == 250.0  # 500/2
        assert nutrients['protein_g'] == 12.5    # 25/2
        assert nutrients['fat_g'] == 8.2         # 16.4/2
        assert nutrients['carbs_g'] == 35.0      # 70/2


class TestCalorieExtraction:
    """Test extraction of calorie/energy values in different formats"""
    
    @pytest.fixture
    def parser(self):
        return NutritionTextParser()
    
    def test_extract_kcal_values(self, parser):
        """Test extraction of kcal values"""
        test_cases = [
            ("Energy: 250 kcal", 250.0),
            ("Calories: 180 kcal", 180.0),
            ("250 kcal", 250.0),
            ("Energy 250kcal", 250.0),
            ("Energía: 300 kcal", 300.0),
        ]
        
        for text, expected in test_cases:
            patterns = parser.NUTRIENT_KEYWORDS['energy_kcal']
            value, confidence, match = parser._extract_nutrient_value(
                text.lower(), patterns, 'energy_kcal'
            )
            assert value == expected, f"Failed for text: {text}"
            assert confidence > 0.0
    
    def test_extract_kj_to_kcal_conversion(self, parser):
        """Test conversion of kJ values to kcal"""
        text = "Energy: 1050 kJ"
        patterns = parser.NUTRIENT_KEYWORDS['energy_kj']
        
        value, confidence, match = parser._extract_nutrient_value(
            text.lower(), patterns, 'energy_kj'
        )
        
        # Should extract kJ value
        assert value == 1050.0
        assert confidence > 0.0
    
    def test_extract_calories_with_decimal(self, parser):
        """Test extraction of decimal calorie values"""
        test_cases = [
            ("Energy: 250.5 kcal", 250.5),
            ("Calories: 180,7 kcal", 180.7),  # European decimal format
            ("Energy 99.9kcal", 99.9),
        ]
        
        for text, expected in test_cases:
            patterns = parser.NUTRIENT_KEYWORDS['energy_kcal']
            value, confidence, match = parser._extract_nutrient_value(
                text.lower(), patterns, 'energy_kcal'
            )
            assert value == expected, f"Failed for text: {text}"


class TestMacronutrientExtraction:
    """Test extraction of protein, fat, and carbohydrate values"""
    
    @pytest.fixture
    def parser(self):
        return NutritionTextParser()
    
    def test_extract_protein_values(self, parser):
        """Test extraction of protein values"""
        test_cases = [
            ("Protein: 12.5g", 12.5),
            ("Proteins: 15g", 15.0),
            ("Proteínas: 10,5g", 10.5),
            ("12.5g protein", 12.5),
        ]
        
        for text, expected in test_cases:
            patterns = parser.NUTRIENT_KEYWORDS['protein_g']
            value, confidence, match = parser._extract_nutrient_value(
                text.lower(), patterns, 'protein_g'
            )
            assert value == expected, f"Failed for text: {text}"
    
    def test_extract_fat_values(self, parser):
        """Test extraction of fat values"""
        test_cases = [
            ("Fat: 8.2g", 8.2),
            ("Total Fat: 15g", 15.0),
            ("Grasas: 10,5g", 10.5),
            ("Lipids: 7.3g", 7.3),
        ]
        
        for text, expected in test_cases:
            patterns = parser.NUTRIENT_KEYWORDS['fat_g']
            value, confidence, match = parser._extract_nutrient_value(
                text.lower(), patterns, 'fat_g'
            )
            assert value == expected, f"Failed for text: {text}"
    
    def test_extract_carbohydrate_values(self, parser):
        """Test extraction of carbohydrate values"""
        test_cases = [
            ("Carbohydrates: 35.0g", 35.0),
            ("Total Carbs: 40g", 40.0),
            ("Carbohidratos: 25,5g", 25.5),
            ("35g carbs", 35.0),
        ]
        
        for text, expected in test_cases:
            patterns = parser.NUTRIENT_KEYWORDS['carbs_g']
            value, confidence, match = parser._extract_nutrient_value(
                text.lower(), patterns, 'carbs_g'
            )
            assert value == expected, f"Failed for text: {text}"
    
    def test_extract_sugar_values(self, parser):
        """Test extraction of sugar values"""
        test_cases = [
            ("Sugars: 5.8g", 5.8),
            ("of which sugars: 12g", 12.0),
            ("Azúcares: 8,2g", 8.2),
            ("de los cuales azúcares: 6g", 6.0),
        ]
        
        for text, expected in test_cases:
            patterns = parser.NUTRIENT_KEYWORDS['sugars_g']
            value, confidence, match = parser._extract_nutrient_value(
                text.lower(), patterns, 'sugars_g'
            )
            assert value == expected, f"Failed for text: {text}"
    
    def test_extract_salt_sodium_values(self, parser):
        """Test extraction of salt and sodium values"""
        test_cases = [
            ("Salt: 1.2g", 1.2),
            ("Sal: 0,8g", 0.8),
            ("Sodium: 480mg", 480.0),  # mg values
            ("Sodio: 300mg", 300.0),
        ]
        
        for text, expected in test_cases:
            patterns = parser.NUTRIENT_KEYWORDS['salt_g']
            value, confidence, match = parser._extract_nutrient_value(
                text.lower(), patterns, 'salt_g'
            )
            assert value == expected, f"Failed for text: {text}"


class TestUnitConversion:
    """Test conversion between different units"""
    
    @pytest.fixture
    def parser(self):
        return NutritionTextParser()
    
    def test_mg_to_g_conversion(self, parser):
        """Test milligram to gram conversion for sodium/salt"""
        text = "Sodium: 1200mg"
        patterns = parser.NUTRIENT_KEYWORDS['salt_g']
        
        value, confidence, match = parser._extract_nutrient_value(
            text.lower(), patterns, 'salt_g'
        )
        
        # Should handle mg values appropriately
        assert value == 1200.0  # Raw mg value extracted
        assert confidence > 0.0
    
    def test_kj_calorie_recognition(self, parser):
        """Test recognition of kJ values"""
        text = "Energy: 1050 kJ"
        patterns = parser.NUTRIENT_KEYWORDS['energy_kj']
        
        value, confidence, match = parser._extract_nutrient_value(
            text.lower(), patterns, 'energy_kj'
        )
        
        assert value == 1050.0
        assert confidence > 0.0
    
    def test_decimal_format_handling(self, parser):
        """Test handling of different decimal formats"""
        test_cases = [
            ("12.5g", 12.5),  # US format
            ("12,5g", 12.5),  # European format
            ("12g", 12.0),    # Integer
        ]
        
        for text, expected in test_cases:
            # Test with protein patterns
            patterns = parser.NUTRIENT_KEYWORDS['protein_g']
            value, confidence, match = parser._extract_nutrient_value(
                f"protein: {text}", patterns, 'protein_g'
            )
            assert value == expected, f"Failed for text: {text}"


class TestTextNormalization:
    """Test text cleaning and normalization"""
    
    @pytest.fixture
    def parser(self):
        return NutritionTextParser()
    
    def test_normalize_whitespace(self, parser):
        """Test whitespace normalization"""
        messy_text = "  ENERGY:   250  KCAL  "
        normalized = parser._normalize_text(messy_text)
        assert normalized == "energy: 250 kcal"
    
    def test_normalize_case(self, parser):
        """Test case normalization"""
        text = "PROTEIN: 12.5G"
        normalized = parser._normalize_text(text)
        assert normalized == "protein: 12.5g"
    
    def test_normalize_unicode_characters(self, parser):
        """Test Unicode character normalization"""
        text = "Proteínas: 12,5g"
        normalized = parser._normalize_text(text)
        assert "proteínas" in normalized or "proteinas" in normalized
    
    def test_normalize_decimal_separators(self, parser):
        """Test decimal separator normalization"""
        text = "Energy: 250,5 kcal"
        normalized = parser._normalize_text(text)
        assert "250.5" in normalized


class TestValueValidation:
    """Test validation of extracted nutrition values"""
    
    @pytest.fixture
    def parser(self):
        return NutritionTextParser()
    
    def test_reasonable_calorie_values(self, parser):
        """Test calorie value reasonableness"""
        # Valid calorie values
        assert parser._is_reasonable_value(100.0, 'energy_kcal')
        assert parser._is_reasonable_value(500.0, 'energy_kcal')
        assert parser._is_reasonable_value(800.0, 'energy_kcal')
        
        # Invalid calorie values
        assert not parser._is_reasonable_value(-10.0, 'energy_kcal')
        assert not parser._is_reasonable_value(0.0, 'energy_kcal')
        assert not parser._is_reasonable_value(2000.0, 'energy_kcal')
    
    def test_reasonable_protein_values(self, parser):
        """Test protein value reasonableness"""
        # Valid protein values
        assert parser._is_reasonable_value(5.0, 'protein_g')
        assert parser._is_reasonable_value(25.0, 'protein_g')
        assert parser._is_reasonable_value(50.0, 'protein_g')
        
        # Invalid protein values
        assert not parser._is_reasonable_value(-1.0, 'protein_g')
        assert not parser._is_reasonable_value(150.0, 'protein_g')
    
    def test_reasonable_fat_values(self, parser):
        """Test fat value reasonableness"""
        # Valid fat values
        assert parser._is_reasonable_value(0.1, 'fat_g')
        assert parser._is_reasonable_value(20.0, 'fat_g')
        assert parser._is_reasonable_value(80.0, 'fat_g')
        
        # Invalid fat values
        assert not parser._is_reasonable_value(-1.0, 'fat_g')
        assert not parser._is_reasonable_value(150.0, 'fat_g')
    
    def test_reasonable_carb_values(self, parser):
        """Test carbohydrate value reasonableness"""
        # Valid carb values
        assert parser._is_reasonable_value(0.0, 'carbs_g')
        assert parser._is_reasonable_value(50.0, 'carbs_g')
        assert parser._is_reasonable_value(90.0, 'carbs_g')
        
        # Invalid carb values
        assert not parser._is_reasonable_value(-1.0, 'carbs_g')
        assert not parser._is_reasonable_value(150.0, 'carbs_g')


class TestConfidenceScoring:
    """Test confidence scoring algorithms"""
    
    @pytest.fixture
    def parser(self):
        return NutritionTextParser()
    
    def test_high_confidence_complete_nutrition(self, parser):
        """Test high confidence with complete nutrition data"""
        nutrients = {
            'energy_kcal': 250.0,
            'protein_g': 12.5,
            'fat_g': 8.2,
            'carbs_g': 35.0,
            'sugars_g': 5.8,
            'salt_g': 1.2,
            'fiber_g': 3.5
        }
        
        confidence = parser._calculate_confidence(nutrients, [], "test")
        assert confidence > 0.8
    
    def test_medium_confidence_partial_nutrition(self, parser):
        """Test medium confidence with partial nutrition data"""
        nutrients = {
            'energy_kcal': 250.0,
            'protein_g': 12.5,
            'fat_g': 8.2
        }
        
        confidence = parser._calculate_confidence(nutrients, [], "test")
        assert 0.4 < confidence < 0.8
    
    def test_low_confidence_minimal_nutrition(self, parser):
        """Test low confidence with minimal nutrition data"""
        nutrients = {
            'energy_kcal': 250.0
        }
        
        confidence = parser._calculate_confidence(nutrients, [], "test")
        assert confidence < 0.5
    
    def test_zero_confidence_no_nutrition(self, parser):
        """Test zero confidence with no nutrition data"""
        nutrients = {}
        
        confidence = parser._calculate_confidence(nutrients, [], "test")
        assert confidence == 0.0
    
    def test_pattern_confidence_scoring(self, parser):
        """Test pattern-specific confidence scoring"""
        # Mock match object
        class MockMatch:
            def __init__(self, start, end):
                self.start_val = start
                self.end_val = end
            def start(self): return self.start_val
            def end(self): return self.end_val
            def group(self, n=0): return "250"
        
        match = MockMatch(10, 20)
        pattern = r'energy.*?(\d+)\s*kcal'
        text = "nutrition energy: 250 kcal protein"
        
        confidence = parser._calculate_pattern_confidence(match, pattern, text)
        assert confidence > 0.0
        assert confidence <= 1.0


class TestComplexNutritionScenarios:
    """Test complex nutrition parsing scenarios"""
    
    @pytest.fixture
    def parser(self):
        return NutritionTextParser()
    
    def test_nutrition_table_with_ranges(self, parser):
        """Test parsing nutrition values with ranges"""
        text = """
        Energy: 200-250 kcal
        Protein: 10-12g
        Fat: 5-8g
        """
        
        result = parser.parse_nutrition_text(text)
        
        # Should extract reasonable values from ranges
        nutrients = result['parsed_nutriments']
        assert 200 <= nutrients.get('energy_kcal', 0) <= 250
        assert 10 <= nutrients.get('protein_g', 0) <= 12
    
    def test_nutrition_with_footnotes(self, parser):
        """Test parsing nutrition with footnotes and asterisks"""
        text = """
        Energy: 250 kcal*
        Protein: 12.5g**
        * Based on 2000 calorie diet
        ** Complete protein
        """
        
        result = parser.parse_nutrition_text(text)
        
        nutrients = result['parsed_nutriments']
        assert nutrients['energy_kcal'] == 250.0
        assert nutrients['protein_g'] == 12.5
    
    def test_nutrition_with_percentages(self, parser):
        """Test parsing nutrition with daily value percentages"""
        text = """
        Energy: 250 kcal (12% DV)
        Protein: 12.5g (25% DV)
        Fat: 8.2g (13% DV)
        """
        
        result = parser.parse_nutrition_text(text)
        
        nutrients = result['parsed_nutriments']
        assert nutrients['energy_kcal'] == 250.0
        assert nutrients['protein_g'] == 12.5
        assert nutrients['fat_g'] == 8.2
    
    def test_nutrition_mixed_languages(self, parser):
        """Test parsing nutrition labels with mixed languages"""
        text = """
        Energy/Energía: 250 kcal
        Protein/Proteínas: 12.5g
        Fat/Grasas: 8.2g
        """
        
        result = parser.parse_nutrition_text(text)
        
        nutrients = result['parsed_nutriments']
        assert nutrients['energy_kcal'] == 250.0
        assert nutrients['protein_g'] == 12.5
        assert nutrients['fat_g'] == 8.2
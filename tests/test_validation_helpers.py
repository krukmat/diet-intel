"""
Tests para las funciones de validación de reminders
Task 2.1: Validar funciones extraídas de update_reminder
"""
import pytest
from fastapi import HTTPException
import validation_helpers
from app.models.reminder import ReminderUpdateRequest


class TestValidationHelpers:
    """Tests para funciones de validación de reminders"""
    
    def test_validate_time_format_valid(self):
        """Validar formato de tiempo correcto"""
        # Casos válidos
        assert validation_helpers._validate_time_format("00:00") == True
        assert validation_helpers._validate_time_format("12:30") == True
        assert validation_helpers._validate_time_format("23:59") == True
        assert validation_helpers._validate_time_format("09:05") == True
    
    def test_validate_time_format_invalid(self):
        """Validar formato de tiempo incorrecto"""
        # Casos inválidos
        assert validation_helpers._validate_time_format("25:00") == False  # Hora inválida
        assert validation_helpers._validate_time_format("12:60") == False  # Minuto inválido
        assert validation_helpers._validate_time_format("ab:cd") == False  # No numérico
        assert validation_helpers._validate_time_format("12") == False     # Formato incompleto
        assert validation_helpers._validate_time_format("") == False       # Vacío
        assert validation_helpers._validate_time_format(None) == False     # None
    
    def test_validate_days_selection_valid(self):
        """Validar selección de días correcta"""
        # Al menos un día seleccionado
        assert validation_helpers._validate_days_selection([True, False, False, False, False, False, False]) == True
        assert validation_helpers._validate_days_selection([False, True, False, False, False, False, False]) == True
        assert validation_helpers._validate_days_selection([True, True, False, False, False, False, False]) == True
        assert validation_helpers._validate_days_selection([True, True, True, True, True, True, True]) == True
    
    def test_validate_days_selection_invalid(self):
        """Validar selección de días incorrecta"""
        # Ningún día seleccionado
        assert validation_helpers._validate_days_selection([False, False, False, False, False, False, False]) == False
        assert validation_helpers._validate_days_selection([]) == False
        assert validation_helpers._validate_days_selection(None) == False
    
    def test_validate_reminder_payload_valid(self):
        """Validar payload de reminder correcto"""
        # Payload válido - no debe lanzar excepción
        valid_request = ReminderUpdateRequest(
            label="Nuevo recordatorio",
            time="14:30",
            days=[True, False, True, False, True, False, False]
        )
        
        # No debe lanzar excepción
        try:
            validation_helpers._validate_reminder_payload(valid_request)
        except HTTPException:
            pytest.fail("No debería lanzar HTTPException para payload válido")
    
    def test_validate_reminder_payload_invalid_time(self):
        """Validar payload con tiempo inválido"""
        invalid_request = ReminderUpdateRequest(
            label="Recordatorio inválido",
            time="25:00"  # Tiempo inválido
        )
        
        with pytest.raises(HTTPException) as exc_info:
            validation_helpers._validate_reminder_payload(invalid_request)
        
        assert "Invalid time format" in str(exc_info.value.detail)
        assert exc_info.value.status_code == 422
    
    def test_validate_reminder_payload_no_days(self):
        """Validar payload sin días seleccionados"""
        invalid_request = ReminderUpdateRequest(
            label="Recordatorio sin días",
            days=[False, False, False, False, False, False, False]  # Ningún día
        )
        
        with pytest.raises(HTTPException) as exc_info:
            validation_helpers._validate_reminder_payload(invalid_request)
        
        assert "At least one day must be selected" in str(exc_info.value.detail)
        assert exc_info.value.status_code == 422
    
    def test_validate_reminder_payload_partial_update_time(self):
        """Validar actualización parcial con tiempo"""
        partial_request = ReminderUpdateRequest(time="16:45")  # Solo actualizar tiempo
        
        # No debe lanzar excepción
        try:
            validation_helpers._validate_reminder_payload(partial_request)
        except HTTPException:
            pytest.fail("No debería lanzar HTTPException para actualización parcial válida")
    
    def test_validate_reminder_payload_partial_update_days(self):
        """Validar actualización parcial con días"""
        partial_request = ReminderUpdateRequest(
            days=[True, True, False, False, False, False, False]  # Solo actualizar días
        )
        
        # No debe lanzar excepción
        try:
            validation_helpers._validate_reminder_payload(partial_request)
        except HTTPException:
            pytest.fail("No debería lanzar HTTPException para actualización parcial válida")
    
    def test_validate_reminder_payload_empty_update(self):
        """Validar actualización vacía"""
        empty_request = ReminderUpdateRequest()  # Sin actualizaciones
        
        # No debe lanzar excepción
        try:
            validation_helpers._validate_reminder_payload(empty_request)
        except HTTPException:
            pytest.fail("No debería lanzar HTTPException para actualización vacía")
    
    def test_validate_reminder_payload_invalid_time_in_days_update(self):
        """Validar actualización con días válidos pero tiempo inválido"""
        invalid_request = ReminderUpdateRequest(
            time="99:99",  # Tiempo inválido
            days=[True, False, True, False, True, False, False]  # Días válidos
        )
        
        with pytest.raises(HTTPException) as exc_info:
            validation_helpers._validate_reminder_payload(invalid_request)
        
        assert "Invalid time format" in str(exc_info.value.detail)
        assert exc_info.value.status_code == 422
    
    def test_validate_reminder_payload_invalid_days_in_time_update(self):
        """Validar actualización con tiempo válido pero días inválidos"""
        invalid_request = ReminderUpdateRequest(
            time="14:30",  # Tiempo válido
            days=[False, False, False, False, False, False, False]  # Días inválidos
        )
        
        with pytest.raises(HTTPException) as exc_info:
            validation_helpers._validate_reminder_payload(invalid_request)
        
        assert "At least one day must be selected" in str(exc_info.value.detail)
        assert exc_info.value.status_code == 422

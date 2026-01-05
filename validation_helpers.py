"""
Funciones de validación para reminders
Extraídas de update_reminder para reducir complejidad cíclica
"""
from typing import List, Optional
from dataclasses import dataclass
from fastapi import HTTPException, status
from app.models.reminder import ReminderUpdateRequest, ReminderType


@dataclass
class ReminderChanges:
    """Representa los cambios detectados en un reminder"""
    label_changed: bool = False
    time_changed: bool = False
    days_changed: bool = False
    enabled_changed: bool = False
    type_changed: bool = False
    
    # Valores antiguos y nuevos para logging/tracking
    old_label: Optional[str] = None
    new_label: Optional[str] = None
    old_time: Optional[str] = None
    new_time: Optional[str] = None
    old_days: Optional[List[bool]] = None
    new_days: Optional[List[bool]] = None
    old_enabled: Optional[bool] = None
    new_enabled: Optional[bool] = None
    old_type: Optional[str] = None
    new_type: Optional[str] = None


def _validate_time_format(time_str: str) -> bool:
    """Validar formato de tiempo HH:MM"""
    try:
        hour, minute = map(int, time_str.split(":"))
        return 0 <= hour <= 23 and 0 <= minute <= 59
    except (ValueError, AttributeError):
        return False


def _validate_days_selection(days: Optional[List[bool]] = None) -> bool:
    """Validar que al menos un día esté seleccionado"""
    if days is None:
        return False
    return any(days)


def _validate_reminder_payload(request: ReminderUpdateRequest) -> None:
    """Validar el payload completo de actualización de reminder"""
    updates = request.model_dump(exclude_unset=True)

    # Validar formato de tiempo si se proporciona
    if "time" in updates and updates["time"] is not None:
        if not _validate_time_format(updates["time"]):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid time format. Use HH:MM format."
            )

    # Validar selección de días si se proporciona
    if "days" in updates and updates["days"] is not None:
        if not _validate_days_selection(updates["days"]):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one day must be selected."
            )

    # Validar que no se intente desactivar todos los días
    if "days" in updates and updates["days"] is not None and not any(updates["days"]):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one day must be selected."
        )


def _compute_reminder_changes(current_reminder: dict, updates: dict) -> ReminderChanges:
    """
    Task 2.2: Detectar y calcular cambios entre estado actual y nuevo
    
    Args:
        current_reminder: Estado actual del reminder como dict
        updates: Diccionario con los campos actualizados
    
    Returns:
        ReminderChanges: Objeto que representa los cambios detectados
    """
    changes = ReminderChanges()
    
    # Detectar cambio de label
    if "label" in updates:
        changes.label_changed = True
        changes.old_label = current_reminder.get("label", "")
        changes.new_label = updates["label"]
    
    # Detectar cambio de time
    if "time" in updates:
        changes.time_changed = True
        changes.old_time = current_reminder.get("time", "")
        changes.new_time = updates["time"]
    
    # Detectar cambio de days
    if "days" in updates:
        changes.days_changed = True
        changes.old_days = current_reminder.get("days", [])
        changes.new_days = list(updates["days"]) if updates["days"] else []
    
    # Detectar cambio de enabled
    if "enabled" in updates:
        changes.enabled_changed = True
        changes.old_enabled = current_reminder.get("enabled", True)
        changes.new_enabled = updates["enabled"]
    
    # Detectar cambio de type
    if "type" in updates:
        changes.type_changed = True
        old_type = current_reminder.get("type", ReminderType.MEAL.value)
        new_type = updates["type"]
        
        # Manejar ReminderType enum vs string
        if isinstance(new_type, ReminderType):
            new_type = new_type.value
            
        changes.old_type = old_type if isinstance(old_type, str) else old_type.value
        changes.new_type = new_type
    
    return changes

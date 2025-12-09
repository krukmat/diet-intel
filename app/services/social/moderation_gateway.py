"""
ModerationGateway - Sistema de bloqueos y moderación.

Implementado para EPIC A3: Bloqueos básicos entre usuarios.
Integracion completa con block_service para consultas de bloqueos.
"""

import logging
from typing import Optional, Literal

from app.services.social.block_service import block_service

logger = logging.getLogger(__name__)


class ModerationGateway:
    """
    Gateway para consultas de moderación y bloqueos.
    Implementación completa de bloqueos para EPIC A3.
    """

    def is_blocked(self, viewer_id: Optional[str], target_id: str) -> bool:
        """
        Verifica si existe un bloqueo entre users que impida la interacción.

        Args:
            viewer_id: Usuario que quiere ver/interactuar (puede ser None para usuarios no autenticados)
            target_id: Usuario objetivo

        Returns:
            bool: True si está bloqueado (no permitir interacción)
        """
        if not viewer_id:
            # Usuario no autenticado nunca puede estar bloqueado
            return False

        # Verificar bloqueo bidireccional:
        # - target bloqué a viewer (no puede ver contenido de target)
        # - O viewer bloqueó a target (viewer decidió bloquear a target)
        blocked_by_target = block_service.is_blocking(target_id, viewer_id)
        blocking_target = block_service.is_blocking(viewer_id, target_id)

        is_blocked = blocked_by_target or blocking_target

        logger.debug(f"ModerationGateway.is_blocked(viewer={viewer_id}, target={target_id}) -> {is_blocked}")

        return is_blocked

    def get_block_relation(self, viewer_id: Optional[str], target_id: str) -> Optional[Literal['blocked', 'blocked_by']]:
        """
        Obtiene la relación de bloqueo desde la perspectiva del viewer.

        Args:
            viewer_id: Usuario que consulta (puede ser None)
            target_id: Usuario objetivo

        Returns:
            'blocked': viewer ha bloqueado a target
            'blocked_by': target ha bloqueado a viewer
            None: no hay bloqueo entre los usuarios
        """
        if not viewer_id:
            return None

        if block_service.is_blocking(viewer_id, target_id):
            return 'blocked'
        elif block_service.is_blocking(target_id, viewer_id):
            return 'blocked_by'
        else:
            return None


# Singleton instance para inyección de dependencias
moderation_gateway = ModerationGateway()

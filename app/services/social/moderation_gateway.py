"""
ModerationGateway - Stub para sistema de bloqueos/moderation.

Esta es una implementación stub que devuelve siempre False (sin bloqueos),
preparada para ser reemplazada cuando llegue EPIC I (Moderation System).

EPIC I: Sistema completo de bloqueos, reports y moderación de contenido.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


class ModerationGateway:
    """
    Gateway para consultas de moderación.
    Stub actual: siempre devuelve False (sin bloqueos).
    """

    def is_blocked(self, follower_id: str, followee_id: str) -> bool:
        """
        Verifica si existe un bloqueo entre users.
        Esto incluye:
        - Bloqueo direccional (follower_no_puede_ver_followee)
        - Bloqueos mutuos

        Arg:
            follower_id: Usuario que quiere seguir/obtener información
            followee_id: Usuario objetivo

        Returns:
            bool: True si está bloqueado (no permitir interacción)
        """
        # EPIC I TODO: Implementar lógica real de bloqueos
        # - Consultar tabla user_blocks
        # - Verificar si followee bloqueó a follower
        # - Considerar bloqueos mutuos

        logger.debug(f"ModerationGateway.stub_is_blocked({follower_id}, {followee_id}) -> False")

        # Stub: No hay bloqueos en el sistema actualmente
        return False


# Singleton instance para inyección de dependencias
moderation_gateway = ModerationGateway()

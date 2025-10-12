// EPIC_A.A1: Lógica de preview y contador de caracteres para formularios de perfil

/**
 * Inicializa la funcionalidad del formulario de edición de perfil
 * Incluye contador de caracteres para bio y preview en tiempo real
 */
function initProfileEditForm() {
    // Character counter for bio
    const bioTextarea = document.getElementById('bio');
    const charCount = document.getElementById('char-count');
    const previewBio = document.getElementById('preview-bio');

    // Real-time preview elements
    const handleInput = document.getElementById('handle');
    const visibilitySelect = document.getElementById('visibility');
    const previewVisibility = document.getElementById('preview-visibility');

    /**
     * Actualiza el contador de caracteres y el preview de la bio
     */
    function updateCounter() {
        if (!bioTextarea || !charCount) return;

        const length = bioTextarea.value.length;
        charCount.textContent = length;

        // Color coding for character count
        if (length > 280) {
            charCount.className = 'red';
        } else if (length > 250) {
            charCount.className = 'orange';
        } else {
            charCount.className = '';
        }

        // Update preview
        if (previewBio) {
            previewBio.textContent = bioTextarea.value;
        }
    }

    /**
     * Actualiza el preview del visibility
     */
    function updateVisibilityPreview() {
        if (!visibilitySelect || !previewVisibility) return;

        const value = visibilitySelect.value;
        previewVisibility.textContent = value === 'followers_only' ? 'Followers Only' : 'Public';
    }

    // Event listeners
    if (bioTextarea) {
        bioTextarea.addEventListener('input', updateCounter);
        // Initial count
        updateCounter();
    }

    if (visibilitySelect) {
        visibilitySelect.addEventListener('change', updateVisibilityPreview);
        // Initial preview update
        updateVisibilityPreview();
    }

    // Handle input preview (could be extended for more complex preview)
    if (handleInput) {
        // Handle preview updates if needed
        handleInput.addEventListener('input', function() {
            // Could update preview handle here if desired
            console.log('Handle updated:', this.value);
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize profile edit functionality
    initProfileEditForm();
});

// Export for potential reuse
window.ProfileUtils = {
    initProfileEditForm: initProfileEditForm
};

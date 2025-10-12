// EPIC_A.A1: Lógica de preview y contador de caracteres para formularios de perfil
document.addEventListener('DOMContentLoaded', () => {
  const bioTextarea = document.getElementById('bio');
  const charCount = document.getElementById('char-count');
  const previewBio = document.getElementById('preview-bio');
  const visibilitySelect = document.getElementById('visibility');
  const previewVisibility = document.getElementById('preview-visibility');

  if (bioTextarea && charCount) {
    const updateCounter = () => {
      const length = bioTextarea.value.length;
      charCount.textContent = length.toString();
      if (length > 280) {
        charCount.classList.add('red');
        charCount.classList.remove('orange');
      } else if (length > 250) {
        charCount.classList.add('orange');
        charCount.classList.remove('red');
      } else {
        charCount.classList.remove('red', 'orange');
      }
      if (previewBio) previewBio.textContent = bioTextarea.value;
    };
    bioTextarea.addEventListener('input', updateCounter);
    updateCounter();
  }

  if (visibilitySelect && previewVisibility) {
    visibilitySelect.addEventListener('change', function () {
      previewVisibility.textContent = this.value === 'followers_only' ? 'Followers Only' : 'Public';
    });
  }
});


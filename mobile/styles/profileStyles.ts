import { StyleSheet } from 'react-native';

// EPIC_A.A1: Estilos cross-platform reciclables para componentes de perfil (~60 tokens)

export const profileStyles = StyleSheet.create({
  // Layout containers
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Avatar styles
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e1e5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    color: '#666',
  },

  // Typography
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  text: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  errorText: {
    color: '#d9534f',
    fontSize: 14,
    marginTop: 5,
  },

  // Cards and sections
  infoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  privacyNotice: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  privacyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },

  // Form inputs
  inputGroup: {
    marginBottom: 25,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  multilineInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    height: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#d9534f',
    borderWidth: 1,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 5,
  },

  // Custom visibility selector
  visibilityButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  visibilityButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  visibilityButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  visibilityButtonText: {
    fontSize: 16,
    color: '#666',
  },
  visibilityButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Stats layout
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});

// Export para retrocompatibilidad
export default profileStyles;

import { StyleSheet } from 'react-native';

export const weightTrackerStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 16,
  },
  weightInput: {
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#FAFAFA',
    color: '#333333',
  },
  formattedWeight: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    fontWeight: '500',
  },
  validationContainer: {
    minHeight: 20,
    marginBottom: 16,
  },
  validationText: {
    fontSize: 12,
    textAlign: 'center',
  },
  validationValid: {
    color: '#4CAF50',
  },
  validationInvalid: {
    color: '#F44336',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recordButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#F44336',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    textAlign: 'center',
  },
  lastWeightContainer: {
    backgroundColor: '#F0FFF0',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    alignItems: 'center',
  },
  lastWeightLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  lastWeightValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 2,
  },
  lastWeightDate: {
    fontSize: 12,
    color: '#666666',
  },
});

import { StyleSheet } from 'react-native';

export const mealCardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
    marginHorizontal: 8,
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
  cardConsumed: {
    backgroundColor: '#F0FFF0',
    borderColor: '#4CAF50',
  },
  cardError: {
    backgroundColor: '#FFF5F5',
    borderColor: '#F44336',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
    marginRight: 8,
  },
  statusIcon: {
    fontSize: 18,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serving: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
  },
  calories: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  macros: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  macro: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  statusContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  statusText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  statusTextError: {
    color: '#F44336',
  },
  errorText: {
    fontSize: 11,
    color: '#F44336',
    marginTop: 2,
    fontStyle: 'italic',
  },
});

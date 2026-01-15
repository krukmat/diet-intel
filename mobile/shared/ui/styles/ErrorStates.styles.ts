import { StyleSheet } from 'react-native';

export const errorStatesStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
  },
  inlineIcon: {
    fontSize: 16,
    marginRight: 8,
    color: '#D70015',
  },
  inlineMessage: {
    fontSize: 14,
    color: '#D70015',
    flex: 1,
  },
  dismissButton: {
    fontSize: 18,
    color: '#D70015',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  bannerContainer: {
    backgroundColor: '#FFE5E5',
    borderBottomWidth: 1,
    borderBottomColor: '#D70015',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bannerIcon: {
    fontSize: 16,
    marginRight: 8,
    color: '#D70015',
  },
  bannerMessage: {
    fontSize: 14,
    color: '#D70015',
    flex: 1,
  },
  bannerAction: {
    fontSize: 14,
    color: '#D70015',
    fontWeight: '600',
    marginRight: 16,
  },
  bannerDismiss: {
    fontSize: 18,
    color: '#D70015',
    fontWeight: 'bold',
  },
});

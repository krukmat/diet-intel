import { StyleSheet, Platform } from 'react-native';

export const homeDashboardStyles = StyleSheet.create({
  header: {
    backgroundColor: '#070C1A',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 34 : 26,
    paddingBottom: 24,
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  headerActionButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 36,
    height: 36,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionButtonText: {
    color: 'white',
    fontSize: 16,
  },
  hero: {
    marginTop: 16,
    borderRadius: 24,
    backgroundColor: '#0b1f3a',
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 100,
    backgroundColor: 'rgba(59, 130, 246, 0.35)',
    top: -40,
    right: -20,
  },
  heroContent: {
    marginBottom: 16,
  },
  heroTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: '#E0E7FF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  heroVersion: {
    color: '#93C5FD',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  heroMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStat: {
    flex: 1,
    minWidth: 0,
  },
  heroStatLabel: {
    color: '#A5B4FC',
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroStatValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  heroStatSubValue: {
    color: '#C7D2FE',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  navigationSection: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 40,
    marginTop: 20,
    flexDirection: 'column',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
});

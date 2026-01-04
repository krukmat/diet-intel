// Toast Notification Components
// Visual toast notifications with animations and queue management

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  PanResponder,
} from 'react-native';
import { Toast, ToastType } from '../hooks/useToast';

const { width: screenWidth } = Dimensions.get('window');

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  index: number;
  total: number;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss, index, total }) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDismiss = () => {
    // Exit animation
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        toast.dismissible && Math.abs(gestureState.dx) > 10,
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
        opacity.setValue(Math.max(0, 1 - Math.abs(gestureState.dx) / screenWidth));
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        if (Math.abs(dx) > 100 || Math.abs(vx) > 1) {
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: dx > 0 ? screenWidth : -screenWidth,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onDismiss(toast.id);
          });
        } else {
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.spring(opacity, {
              toValue: 1,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const getToastStyle = () => {
    const baseStyle = styles.toastContainer;
    
    switch (toast.type) {
      case ToastType.SUCCESS:
        return [baseStyle, styles.successToast];
      case ToastType.ERROR:
        return [baseStyle, styles.errorToast];
      case ToastType.WARNING:
        return [baseStyle, styles.warningToast];
      case ToastType.INFO:
        return [baseStyle, styles.infoToast];
      case ToastType.LOADING:
        return [baseStyle, styles.loadingToast];
      default:
        return baseStyle;
    }
  };

  const getIconStyle = () => {
    switch (toast.type) {
      case ToastType.SUCCESS:
        return styles.successIcon;
      case ToastType.ERROR:
        return styles.errorIcon;
      case ToastType.WARNING:
        return styles.warningIcon;
      case ToastType.INFO:
        return styles.infoIcon;
      case ToastType.LOADING:
        return styles.loadingIcon;
      default:
        return {};
    }
  };

  // Calculate stacking offset
  const stackOffset = Math.min(index * 4, 12);
  const stackScale = Math.max(1 - (index * 0.05), 0.85);

  return (
    <Animated.View
      style={[
        getToastStyle(),
        {
          transform: [
            { translateY },
            { translateX },
            { scale: Animated.multiply(scale, stackScale) },
          ],
          opacity,
          zIndex: total - index,
          top: stackOffset,
        },
      ]}
      {...(toast.dismissible ? panResponder.panHandlers : {})}
    >
        <View style={styles.toastContent}>
          {/* Icon */}
          {toast.icon && (
            <View style={[styles.iconContainer, getIconStyle()]}>
              <Text style={styles.iconText}>{toast.icon}</Text>
            </View>
          )}

          {/* Content */}
          <View style={styles.contentContainer}>
            <Text style={styles.toastTitle} numberOfLines={2}>
              {toast.title}
            </Text>
            {toast.message && (
              <Text style={styles.toastMessage} numberOfLines={3}>
                {toast.message}
              </Text>
            )}
          </View>

          {/* Action Button */}
          {toast.action && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                toast.action!.onPress();
                handleDismiss();
              }}
            >
              <Text style={styles.actionText}>{toast.action.label}</Text>
            </TouchableOpacity>
          )}

          {/* Dismiss Button */}
          {toast.dismissible && (
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={handleDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.dismissText}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Progress Bar for Loading */}
        {toast.type === ToastType.LOADING && (
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View style={styles.progressBar} />
            </View>
          </View>
        )}
      </Animated.View>
  );
};

interface ToastProviderProps {
  children: React.ReactNode;
  toasts: Toast[];
  onDismiss: (id: string) => void;
  position?: 'top' | 'bottom';
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  toasts,
  onDismiss,
  position = 'top',
}) => {
  return (
    <>
      {children}
      
      {/* Toast Container */}
      <SafeAreaView 
        style={[
          styles.toastOverlay,
          position === 'bottom' ? styles.bottomPosition : styles.topPosition,
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.toastStack} pointerEvents="box-none">
          {toasts.slice(0, 3).map((toast, index) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onDismiss={onDismiss}
              index={index}
              total={toasts.length}
            />
          ))}
        </View>
      </SafeAreaView>
    </>
  );
};

// Standalone Toast Container (if not using provider pattern)
interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  position?: 'top' | 'bottom';
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  position = 'top',
}) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <View 
      style={[
        styles.toastOverlay,
        styles.absolute,
        position === 'bottom' ? styles.bottomPosition : styles.topPosition,
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.toastStack} pointerEvents="box-none">
        {toasts.slice(0, 3).map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={onDismiss}
            index={index}
            total={toasts.length}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  toastOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  absolute: {
    position: 'absolute',
  },
  topPosition: {
    top: 0,
  },
  bottomPosition: {
    bottom: 0,
  },
  toastStack: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  
  // Toast Container
  toastContainer: {
    position: 'relative',
    backgroundColor: 'white',
    borderRadius: 12,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  
  // Toast Types
  successToast: {
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
    backgroundColor: '#F0FDF4',
  },
  errorToast: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    backgroundColor: '#FEF2F2',
  },
  warningToast: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
    backgroundColor: '#FFFBEB',
  },
  infoToast: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    backgroundColor: '#EFF6FF',
  },
  loadingToast: {
    borderLeftWidth: 4,
    borderLeftColor: '#8E8E93',
    backgroundColor: '#F9F9F9',
  },

  // Content
  toastContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    minHeight: 64,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  iconText: {
    fontSize: 16,
  },
  
  // Icon Styles
  successIcon: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  errorIcon: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  warningIcon: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
  },
  infoIcon: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  loadingIcon: {
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
  },

  contentContainer: {
    flex: 1,
    marginRight: 8,
  },
  toastTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    lineHeight: 20,
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },

  // Actions
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  actionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignSelf: 'flex-start',
  },
  dismissText: {
    color: '#8E8E93',
    fontSize: 18,
    fontWeight: '300',
    lineHeight: 20,
  },

  // Progress Bar
  progressBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  progressBarBackground: {
    height: 2,
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 1,
  },
});

export default ToastContainer;

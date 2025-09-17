/**
 * Performance Monitor Component
 * Development tool for monitoring React Native performance metrics
 *
 * Features:
 * - Memory usage tracking
 * - Render performance monitoring
 * - Touch response timing
 * - Network request monitoring
 * - Frame rate tracking (Android optimized)
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { tokens } from '../../styles/tokens';

const { width: screenWidth } = Dimensions.get('window');

interface PerformanceMetrics {
  memoryUsage: number;
  renderTime: number;
  framerate: number;
  touchResponseTime: number;
  networkLatency: number;
}

interface PerformanceMonitorProps {
  visible?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showMemory?: boolean;
  showFramerate?: boolean;
  showTouchResponse?: boolean;
  showNetwork?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  visible = __DEV__, // Only show in development by default
  position = 'top-right',
  showMemory = true,
  showFramerate = true,
  showTouchResponse = true,
  showNetwork = false,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    memoryUsage: 0,
    renderTime: 0,
    framerate: 60,
    touchResponseTime: 0,
    networkLatency: 0,
  });

  const renderStartTime = useRef<number>(0);
  const frameCount = useRef<number>(0);
  const lastFrameTime = useRef<number>(performance.now());
  const touchStartTime = useRef<number>(0);

  // Memory monitoring
  useEffect(() => {
    if (!visible || !showMemory) return;

    const monitorMemory = () => {
      if (Platform.OS === 'android' && global.performance && global.performance.memory) {
        const memory = global.performance.memory;
        const usedMB = memory.usedJSHeapSize / 1024 / 1024;
        setMetrics(prev => ({ ...prev, memoryUsage: usedMB }));
      }
    };

    const interval = setInterval(monitorMemory, 1000);
    return () => clearInterval(interval);
  }, [visible, showMemory]);

  // Frame rate monitoring
  useEffect(() => {
    if (!visible || !showFramerate) return;

    const monitorFramerate = () => {
      const now = performance.now();
      const delta = now - lastFrameTime.current;
      const fps = 1000 / delta;

      frameCount.current++;
      if (frameCount.current % 60 === 0) { // Update every 60 frames
        setMetrics(prev => ({ ...prev, framerate: Math.round(fps) }));
      }

      lastFrameTime.current = now;
      requestAnimationFrame(monitorFramerate);
    };

    const animation = requestAnimationFrame(monitorFramerate);
    return () => cancelAnimationFrame(animation);
  }, [visible, showFramerate]);

  // Render time monitoring
  useEffect(() => {
    renderStartTime.current = performance.now();
  });

  useEffect(() => {
    const renderEndTime = performance.now();
    const renderTime = renderEndTime - renderStartTime.current;
    setMetrics(prev => ({ ...prev, renderTime }));
  });

  // Touch response time monitoring
  const handleTouchStart = () => {
    if (showTouchResponse) {
      touchStartTime.current = performance.now();
    }
  };

  const handleTouchEnd = () => {
    if (showTouchResponse && touchStartTime.current) {
      const responseTime = performance.now() - touchStartTime.current;
      setMetrics(prev => ({ ...prev, touchResponseTime: responseTime }));
    }
  };

  // Network latency monitoring (basic implementation)
  useEffect(() => {
    if (!visible || !showNetwork) return;

    const measureNetworkLatency = async () => {
      try {
        const start = performance.now();
        await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors'
        });
        const latency = performance.now() - start;
        setMetrics(prev => ({ ...prev, networkLatency: latency }));
      } catch (error) {
        // Network monitoring failed, ignore
      }
    };

    const interval = setInterval(measureNetworkLatency, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [visible, showNetwork]);

  if (!visible) return null;

  const getPerformanceColor = (metric: 'memory' | 'framerate' | 'touch' | 'network', value: number) => {
    switch (metric) {
      case 'memory':
        return value > 100 ? '#ff4444' : value > 50 ? '#ffaa00' : '#44ff44';
      case 'framerate':
        return value < 30 ? '#ff4444' : value < 50 ? '#ffaa00' : '#44ff44';
      case 'touch':
        return value > 100 ? '#ff4444' : value > 50 ? '#ffaa00' : '#44ff44';
      case 'network':
        return value > 1000 ? '#ff4444' : value > 500 ? '#ffaa00' : '#44ff44';
      default:
        return '#44ff44';
    }
  };

  const getPositionStyle = () => {
    const base = {
      position: 'absolute' as const,
      zIndex: 9999,
    };

    switch (position) {
      case 'top-left':
        return { ...base, top: 50, left: 10 };
      case 'top-right':
        return { ...base, top: 50, right: 10 };
      case 'bottom-left':
        return { ...base, bottom: 50, left: 10 };
      case 'bottom-right':
        return { ...base, bottom: 50, right: 10 };
      default:
        return { ...base, top: 50, right: 10 };
    }
  };

  return (
    <View
      style={[styles.container, getPositionStyle()]}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      pointerEvents="box-none"
    >
      <View style={styles.metricsContainer}>
        <Text style={styles.title}>Performance</Text>

        {showMemory && (
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Memory:</Text>
            <Text
              style={[
                styles.metricValue,
                { color: getPerformanceColor('memory', metrics.memoryUsage) }
              ]}
            >
              {metrics.memoryUsage.toFixed(1)}MB
            </Text>
          </View>
        )}

        {showFramerate && (
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>FPS:</Text>
            <Text
              style={[
                styles.metricValue,
                { color: getPerformanceColor('framerate', metrics.framerate) }
              ]}
            >
              {metrics.framerate}
            </Text>
          </View>
        )}

        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Render:</Text>
          <Text style={styles.metricValue}>
            {metrics.renderTime.toFixed(1)}ms
          </Text>
        </View>

        {showTouchResponse && (
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Touch:</Text>
            <Text
              style={[
                styles.metricValue,
                { color: getPerformanceColor('touch', metrics.touchResponseTime) }
              ]}
            >
              {metrics.touchResponseTime.toFixed(0)}ms
            </Text>
          </View>
        )}

        {showNetwork && (
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Net:</Text>
            <Text
              style={[
                styles.metricValue,
                { color: getPerformanceColor('network', metrics.networkLatency) }
              ]}
            >
              {metrics.networkLatency.toFixed(0)}ms
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// Performance measurement hooks for components
export const useRenderPerformance = (componentName: string) => {
  const renderStartTime = useRef<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
  });

  useEffect(() => {
    if (__DEV__) {
      const renderTime = performance.now() - renderStartTime.current;
      if (renderTime > 16) { // More than one frame at 60fps
        console.warn(`[Performance] ${componentName} render took ${renderTime.toFixed(2)}ms`);
      }
    }
  });
};

// Memory leak detection hook
export const useMemoryLeak = (componentName: string) => {
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'android' && global.performance && global.performance.memory) {
      const initialMemory = global.performance.memory.usedJSHeapSize;

      return () => {
        const finalMemory = global.performance.memory.usedJSHeapSize;
        const memoryDiff = (finalMemory - initialMemory) / 1024 / 1024;

        if (memoryDiff > 1) { // More than 1MB difference
          console.warn(`[Memory] ${componentName} may have leaked ${memoryDiff.toFixed(2)}MB`);
        }
      };
    }
  }, [componentName]);
};

// Touch performance measurement
export const useTouchPerformance = () => {
  const measureTouch = (callback: () => void) => {
    return () => {
      const start = performance.now();
      callback();
      const end = performance.now();

      if (__DEV__ && (end - start) > 100) {
        console.warn(`[Touch Performance] Handler took ${(end - start).toFixed(2)}ms`);
      }
    };
  };

  return { measureTouch };
};

const styles = StyleSheet.create({
  container: {
    maxWidth: 120,
  },
  metricsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: tokens.borderRadius.sm,
    padding: tokens.spacing.xs,
    minWidth: 100,
  },
  title: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: tokens.spacing.xs,
    textAlign: 'center',
  },
  metric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 9,
    color: '#cccccc',
    flex: 1,
  },
  metricValue: {
    fontSize: 9,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'right',
  },
});

export default PerformanceMonitor;
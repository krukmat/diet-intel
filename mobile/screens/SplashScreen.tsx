import React, { useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { splashScreenStyles as styles } from './styles/SplashScreen.styles';

interface SplashScreenProps {
  onLoadingComplete: () => void;
}

export default function SplashScreen({ onLoadingComplete }: SplashScreenProps) {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    // Simulate loading time (minimum 2 seconds for better UX)
    const timer = setTimeout(() => {
      onLoadingComplete();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />
      
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <Text style={styles.logo}>🍎</Text>
        <Text style={styles.title}>DietIntel</Text>
        <Text style={styles.subtitle}>Nutrition Intelligence</Text>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" />
          <Text style={styles.loadingText}>Loading your nutrition journey...</Text>
        </View>
      </Animated.View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by AI • Secured by Design</Text>
        <Text style={styles.versionText}>v1.0 Mobile</Text>
      </View>
    </View>
  );
}

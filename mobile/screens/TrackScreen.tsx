import React from 'react';
import { SafeAreaView, View, Text, TouchableOpacity } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { TrackDashboard } from '../components/TrackDashboard';
import { trackScreenStyles } from './styles/TrackScreen.styles';

interface TrackScreenProps {
  onBackPress: () => void;
}

export default function TrackScreen({ onBackPress }: TrackScreenProps) {
  return (
    <SafeAreaView style={trackScreenStyles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />

      <View style={trackScreenStyles.header}>
        <TouchableOpacity style={trackScreenStyles.backButton} onPress={onBackPress}>
          <Text style={trackScreenStyles.backButtonText}>🏠</Text>
        </TouchableOpacity>
        <View style={trackScreenStyles.headerContent}>
          <Text style={trackScreenStyles.title}>Track Progress</Text>
          <Text style={trackScreenStyles.subtitle}>Monitor your nutrition journey</Text>
        </View>
        <View style={trackScreenStyles.headerSpacer} />
      </View>

      <TrackDashboard />
    </SafeAreaView>
  );
}

/**
 * Weight Screen - FASE 8.4
 * Screen for weight tracking with history
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useWeight } from '../hooks/useWeight';
import { WeightEntry } from '../types/weight';

interface WeightScreenProps {
  onBackPress?: () => void;
}

export function WeightScreen({ onBackPress }: WeightScreenProps): JSX.Element {
  const {
    entries,
    stats,
    loading,
    error,
    createWeight,
    getHistory,
  } = useWeight();

  const [weightInput, setWeightInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    getHistory(30);
  }, [getHistory]);

  const handleAddWeight = async () => {
    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0 || weight > 300) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight between 0 and 300 kg');
      return;
    }

    setIsAdding(true);
    try {
      await createWeight({ weight });
      setWeightInput('');
      Alert.alert('Success', 'Weight entry added successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to add weight entry');
    } finally {
      setIsAdding(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>🏠</Text>
        </TouchableOpacity>
        <Text style={styles.title}>⚖️ Peso</Text>
        <View style={styles.placeholder} />
      </View>
      
      {/* Stats Header */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Actual</Text>
            <Text style={styles.statValue}>{stats.currentWeight.toFixed(1)} kg</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Inicio</Text>
            <Text style={styles.statValue}>{stats.startingWeight.toFixed(1)} kg</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Perdido</Text>
            <Text style={[styles.statValue, stats.totalLost > 0 ? styles.positive : styles.neutral]}>
              {stats.totalLost > 0 ? `-${stats.totalLost.toFixed(1)}` : '+${(-stats.totalLost).toFixed(1)'} kg</Text>
          </View>
        </View>
      )}

      {/* Add Weight Form */}
      <View style={styles.addContainer}>
        <Text style={styles.sectionTitle}>Agregar Peso</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Peso (kg)"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={weightInput}
            onChangeText={setWeightInput}
          />
          <TouchableOpacity
            style={[styles.addButton, isAdding && styles.addButtonDisabled]}
            onPress={handleAddWeight}
            disabled={isAdding || !weightInput}
          >
            {isAdding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addButtonText}>Agregar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* History List */}
      <View style={styles.historyContainer}>
        <Text style={styles.sectionTitle}>Historial</Text>
        
        {loading && !isAdding && entries.length === 0 ? (
          <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : entries.length === 0 ? (
          <Text style={styles.emptyText}>Sin registros aún</Text>
        ) : (
          <ScrollView style={styles.list}>
            {entries.map((entry: WeightEntry) => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryLeft}>
                  <Text style={styles.entryWeight}>{entry.weight.toFixed(1)} kg</Text>
                  <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
                </View>
                {entry.photoUrl && (
                  <Image source={{ uri: entry.photoUrl }} style={styles.entryPhoto} />
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#333',
    lineHeight: 28,
  },
  placeholder: {
    width: 40,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  statCard: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  positive: {
    color: '#4CAF50',
  },
  neutral: {
    color: '#666',
  },
  addContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginRight: 12,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  loader: {
    marginTop: 32,
  },
  errorText: {
    color: '#f44336',
    textAlign: 'center',
    marginTop: 32,
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    marginTop: 32,
  },
  list: {
    flex: 1,
  },
  entryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  entryLeft: {
    flex: 1,
  },
  entryWeight: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  entryDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  entryPhoto: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginLeft: 12,
  },
});

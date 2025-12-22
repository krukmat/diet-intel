import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  intelligentFlowService,
  IntelligentFlowRequestPayload,
  IntelligentFlowResponse,
  IntelligentFlowJobStatus,
} from '../services/IntelligentFlowService';

type Props = {
  onBackPress: () => void;
};

const SAMPLE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AApMBg6dpAtUAAAAASUVORK5CYII=';

export const IntelligentFlowScreen: React.FC<Props> = ({ onBackPress }) => {
  const { t } = useTranslation();
  const [imageBase64, setImageBase64] = useState<string>(SAMPLE_BASE64);
  const [mealType, setMealType] = useState<string>('lunch');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastResponse, setLastResponse] = useState<IntelligentFlowResponse | null>(null);
  const [jobStatus, setJobStatus] = useState<IntelligentFlowJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const clearPolling = useCallback(() => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  const buildPayload = (): IntelligentFlowRequestPayload => ({
    image_base64: imageBase64.trim(),
    meal_type: mealType || 'lunch',
  });

  const handleRunSync = async () => {
    setIsLoading(true);
    setError(null);
    setLastResponse(null);
    setJobStatus(null);
    clearPolling();

    try {
      const payload = buildPayload();
      const response = await intelligentFlowService.runFlow(payload);
      setLastResponse(response);
    } catch (err: any) {
      console.error('Intelligent flow sync error', err);
      setError(err?.response?.data?.detail || err?.message || 'Unknown error');
      Alert.alert('Intelligent Flow', 'Failed to run intelligent flow. Check logs for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const pollJob = useCallback((jobId: string) => {
    clearPolling();
    pollInterval.current = setInterval(async () => {
      try {
        const status = await intelligentFlowService.getJobStatus(jobId);
        setJobStatus(status);
        if (status.status === 'completed' || status.status === 'failed') {
          clearPolling();
          if (status.status === 'completed' && status.result) {
            setLastResponse(status.result);
          }
          if (status.status === 'failed') {
            setError(status.error || 'Job failed');
          }
          setIsLoading(false);
        }
      } catch (err: any) {
        console.warn('Failed to poll intelligent flow job', err);
        setError(err?.message || 'Polling error');
        clearPolling();
        setIsLoading(false);
      }
    }, 2000);
  }, [clearPolling]);

  const handleRunAsync = async () => {
    setIsLoading(true);
    setError(null);
    setLastResponse(null);
    setJobStatus(null);
    clearPolling();

    try {
      const payload = buildPayload();
      const job = await intelligentFlowService.startFlow(payload);
      setJobStatus(job);
      pollJob(job.job_id);
    } catch (err: any) {
      console.error('Intelligent flow async enqueue error', err);
      setError(err?.response?.data?.detail || err?.message || 'Unknown error');
      setIsLoading(false);
      Alert.alert('Intelligent Flow', 'Failed to enqueue intelligent flow job.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('intelligentFlow.title', '🤖 Intelligent Flow')}</Text>
        <Text style={styles.subtitle}>
          {t(
            'intelligentFlow.subtitle',
            'Test the unified Food Vision, Recipe AI, and Smart Diet pipeline.'
          )}
        </Text>
      </View>

      <ScrollView style={styles.form}>
        <Text style={styles.label}>{t('intelligentFlow.mealType', 'Meal Type')}</Text>
        <TextInput
          value={mealType}
          onChangeText={setMealType}
          placeholder="breakfast | lunch | dinner | snack"
          style={styles.input}
          autoCapitalize="none"
        />

        <Text style={styles.label}>{t('intelligentFlow.base64Label', 'Image Base64')}</Text>
        <TextInput
          value={imageBase64}
          onChangeText={setImageBase64}
          multiline
          style={[styles.input, styles.base64Input]}
          placeholder={t('intelligentFlow.base64Placeholder', 'Paste a Base64 encoded image')}
          autoCorrect={false}
          autoCapitalize="none"
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRunSync}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? t('intelligentFlow.running', 'Running...') : t('intelligentFlow.runSync', 'Run Sync')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleRunAsync}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading
                ? t('intelligentFlow.running', 'Running...')
                : t('intelligentFlow.runAsync', 'Run Async')}
            </Text>
          </TouchableOpacity>
        </View>

        {jobStatus && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>
              {t('intelligentFlow.jobStatus', 'Job Status')}: {jobStatus.status}
            </Text>
            <Text style={styles.resultBody}>{JSON.stringify(jobStatus, null, 2)}</Text>
          </View>
        )}

        {lastResponse && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{t('intelligentFlow.result', 'Latest Result')}</Text>
            <Text style={styles.resultBody}>{JSON.stringify(lastResponse, null, 2)}</Text>
          </View>
        )}

        {error && (
          <View style={styles.resultCardError}>
            <Text style={styles.resultTitle}>{t('intelligentFlow.error', 'Error')}</Text>
            <Text style={styles.resultBody}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
        <Text style={styles.backButtonText}>{t('navigation.back', '← Back')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1220',
    paddingTop: 40,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#D0D6F9',
  },
  form: {
    paddingHorizontal: 24,
  },
  label: {
    color: '#8FA1C3',
    fontSize: 14,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#131B2F',
    borderRadius: 12,
    padding: 12,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1E2A45',
  },
  base64Input: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    backgroundColor: '#4ADE80',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  secondaryButton: {
    backgroundColor: '#38BDF8',
    marginRight: 0,
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#0B1220',
    fontSize: 16,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: '#141F36',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  resultCardError: {
    backgroundColor: '#341922',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#F87171',
  },
  resultTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 8,
  },
  resultBody: {
    color: '#D0D6F9',
    fontFamily: 'Courier',
    fontSize: 12,
  },
  backButton: {
    alignSelf: 'center',
    marginVertical: 16,
  },
  backButtonText: {
    color: '#60A5FA',
    fontSize: 16,
  },
});

export default IntelligentFlowScreen;

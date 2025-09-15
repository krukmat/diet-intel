import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getCurrentLanguage, changeLanguage } from '../i18n/config';
import { getCurrentRecipeLanguage } from '../utils/recipeLanguageHelper';

interface RecipeLanguageToggleProps {
  showLabel?: boolean;
  style?: any;
  onLanguageChange?: (language: string) => void;
}

export const RecipeLanguageToggle: React.FC<RecipeLanguageToggleProps> = ({
  showLabel = false,
  style,
  onLanguageChange,
}) => {
  const { t, i18n } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [currentLang, setCurrentLang] = useState(i18n.language || 'en');

  // Debug logging for component state
  console.log('🌐 RecipeLanguageToggle: Component mounted with currentLang:', currentLang);
  console.log('🌐 RecipeLanguageToggle: i18n.language:', i18n.language);
  console.log('🌐 RecipeLanguageToggle: getCurrentLanguage():', getCurrentLanguage());

  // Sync component state with i18n language changes
  useEffect(() => {
    const syncLanguage = () => {
      const newLang = i18n.language || 'en';
      console.log('🌐 Language sync - i18n.language changed to:', newLang);
      setCurrentLang(newLang);
    };

    // Listen to i18n language changes
    i18n.on('languageChanged', syncLanguage);

    // Initial sync
    syncLanguage();

    return () => {
      i18n.off('languageChanged', syncLanguage);
    };
  }, [i18n]);

  const handleLanguageChange = async (language: string) => {
    console.log('🌐 RecipeLanguageToggle: Language change requested:', language);
    console.log('🌐 Current language before change:', i18n.language);

    try {
      // Change language using i18n directly for immediate effect
      await i18n.changeLanguage(language);
      console.log('🌐 Language changed successfully to:', language);
      console.log('🌐 i18n.language after change:', i18n.language);

      // Update local state immediately
      setCurrentLang(language);
      setShowModal(false);

      // Notify parent component
      console.log('🌐 Notifying parent component of language change');
      onLanguageChange?.(language);

      Alert.alert(
        t('languageToggle.languageChanged', '🌐 Language Changed'),
        t('languageToggle.languageChangedMessage', 'Recipe AI is now using {{language}}', {
          language: language === 'es' ? t('languageToggle.spanish', 'Spanish') : t('languageToggle.english', 'English')
        })
      );

      console.log('🌐 Alert shown, language toggle complete');
    } catch (error) {
      console.error('❌ Failed to change language:', error);
      Alert.alert(
        t('common.error', 'Error'),
        t('languageToggle.changeError', 'Failed to change language. Please try again.')
      );
    }
  };

  const getCurrentFlag = () => {
    return currentLang === 'es' ? '🇪🇸' : '🇺🇸';
  };

  const getCurrentLanguageName = () => {
    return currentLang === 'es' ?
      t('languageToggle.spanish', 'Spanish') :
      t('languageToggle.english', 'English');
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.toggleButton, style]}
        onPress={() => {
          console.log('🌐 RecipeLanguageToggle: Button pressed, showing modal');
          setShowModal(true);
        }}
      >
        <Text style={styles.flagText}>{getCurrentFlag()}</Text>
        {showLabel && (
          <Text style={styles.labelText}>{getCurrentLanguageName()}</Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {t('languageToggle.selectLanguage', '🌐 Select Recipe Language')}
              </Text>

              <Text style={styles.modalDescription}>
                {t('languageToggle.description', 'Choose your preferred language for Recipe AI features')}
              </Text>

              {/* Language Options */}
              <View style={styles.languageOptions}>
                <TouchableOpacity
                  style={[
                    styles.languageOption,
                    currentLang === 'en' && styles.languageOptionSelected
                  ]}
                  onPress={() => handleLanguageChange('en')}
                >
                  <Text style={styles.languageFlag}>🇺🇸</Text>
                  <View style={styles.languageInfo}>
                    <Text style={[
                      styles.languageName,
                      currentLang === 'en' && styles.languageNameSelected
                    ]}>
                      {t('languageToggle.english', 'English')}
                    </Text>
                    <Text style={styles.languageDetails}>
                      {t('languageToggle.englishDescription', 'Generate recipes in English')}
                    </Text>
                  </View>
                  {currentLang === 'en' && (
                    <Text style={styles.checkMark}>✓</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.languageOption,
                    currentLang === 'es' && styles.languageOptionSelected
                  ]}
                  onPress={() => handleLanguageChange('es')}
                >
                  <Text style={styles.languageFlag}>🇪🇸</Text>
                  <View style={styles.languageInfo}>
                    <Text style={[
                      styles.languageName,
                      currentLang === 'es' && styles.languageNameSelected
                    ]}>
                      {t('languageToggle.spanish', 'Español')}
                    </Text>
                    <Text style={styles.languageDetails}>
                      {t('languageToggle.spanishDescription', 'Generar recetas en español')}
                    </Text>
                  </View>
                  {currentLang === 'es' && (
                    <Text style={styles.checkMark}>✓</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Info Section */}
              <View style={styles.infoSection}>
                <Text style={styles.infoTitle}>
                  {t('languageToggle.featuresTitle', '✨ Language Features')}
                </Text>
                <Text style={styles.infoText}>
                  • {t('languageToggle.feature1', 'Recipe generation in your preferred language')}
                </Text>
                <Text style={styles.infoText}>
                  • {t('languageToggle.feature2', 'Localized ingredients and measurements')}
                </Text>
                <Text style={styles.infoText}>
                  • {t('languageToggle.feature3', 'Cultural cuisine preferences')}
                </Text>
                <Text style={styles.infoText}>
                  • {t('languageToggle.feature4', 'Native cooking terminology')}
                </Text>
              </View>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.closeButtonText}>
                  {t('common.close', 'Close')}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  flagText: {
    fontSize: 18,
    marginRight: 4,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalContent: {
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },

  // Language Options
  languageOptions: {
    gap: 12,
    marginBottom: 24,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F2F2F7',
    backgroundColor: 'white',
  },
  languageOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  languageFlag: {
    fontSize: 32,
    marginRight: 16,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  languageNameSelected: {
    color: '#007AFF',
  },
  languageDetails: {
    fontSize: 14,
    color: '#8E8E93',
  },
  checkMark: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: 'bold',
  },

  // Info Section
  infoSection: {
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#1C1C1E',
    marginBottom: 4,
    lineHeight: 20,
  },

  // Close Button
  closeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RecipeLanguageToggle;
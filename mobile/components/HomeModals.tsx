import React from 'react';
import ReminderSnippet from './ReminderSnippet';
import ApiConfigModal from './ApiConfigModal';
import DeveloperSettingsModal from './DeveloperSettingsModal';
import LanguageSwitcher from './LanguageSwitcher';

interface HomeModalsProps {
  showReminderSnippet: boolean;
  showReminders: boolean;
  onCloseReminders: () => void;
  showDeveloperSettings: boolean;
  onCloseDeveloperSettings: () => void;
  onOpenApiConfig: () => void;
  showApiConfig: boolean;
  onCloseApiConfig: () => void;
  showLanguageSwitcher: boolean;
  onCloseLanguageSwitcher: () => void;
}

export default function HomeModals({
  showReminderSnippet,
  showReminders,
  onCloseReminders,
  showDeveloperSettings,
  onCloseDeveloperSettings,
  onOpenApiConfig,
  showApiConfig,
  onCloseApiConfig,
  showLanguageSwitcher,
  onCloseLanguageSwitcher,
}: HomeModalsProps) {
  return (
    <>
      {showReminderSnippet && (
        <ReminderSnippet visible={showReminders} onClose={onCloseReminders} />
      )}

      <DeveloperSettingsModal
        visible={showDeveloperSettings}
        onClose={onCloseDeveloperSettings}
        onOpenApiConfig={onOpenApiConfig}
      />

      <ApiConfigModal visible={showApiConfig} onClose={onCloseApiConfig} />

      <LanguageSwitcher visible={showLanguageSwitcher} onClose={onCloseLanguageSwitcher} />
    </>
  );
}

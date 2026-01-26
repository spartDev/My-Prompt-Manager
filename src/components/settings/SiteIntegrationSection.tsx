import { FC, useState, useCallback } from 'react';

import { useClipboard } from '../../hooks/useClipboard';
import { usePickerWindow } from '../../hooks/usePickerWindow';
import { useSitePermissions } from '../../hooks/useSitePermissions';
import { ConfigurationEncoder, ConfigurationEncoderError } from '../../services/configurationEncoder';
import { CustomSite, CustomSiteConfiguration, SecurityWarning } from '../../types';
import { ToastType } from '../../types/components';
import { Logger, toError } from '../../utils';

import AddCustomSiteForm from './AddCustomSiteForm';
import AddMethodChooser from './AddMethodChooser';
import ConfigurationPreview from './ConfigurationPreview';
import CustomSitesList from './CustomSitesList';
import EmptyCustomSitesState from './EmptyCustomSitesState';
import SettingsSection from './SettingsSection';
import SiteImportDrawer from './SiteImportDrawer';
import SupportedSitesList, { SiteConfig } from './SupportedSitesList';

interface SiteIntegrationSectionProps {
  enabledSites: string[];
  customSites: CustomSite[];
  siteConfigs: Record<string, SiteConfig>;
  onSiteToggle: (hostname: string, enabled: boolean) => Promise<void> | void;
  onCustomSiteToggle: (hostname: string, enabled: boolean) => Promise<void> | void;
  onRemoveCustomSite: (hostname: string) => Promise<void> | void;
  onAddCustomSite?: (siteData: Omit<CustomSite, 'dateAdded'> & { positioning?: CustomSite['positioning'] }) => Promise<void> | void;
  onEditCustomSite?: (hostname: string) => void;
  interfaceMode?: 'popup' | 'sidepanel';
  saving?: boolean;
  onShowToast?: (message: string, type?: ToastType) => void;
}

interface PendingImport {
  config: CustomSiteConfiguration;
  warnings: SecurityWarning[];
  duplicate: boolean;
  existingSite?: CustomSite;
}

const SiteIntegrationSection: FC<SiteIntegrationSectionProps> = ({
  enabledSites,
  customSites,
  siteConfigs,
  onSiteToggle,
  onCustomSiteToggle,
  onRemoveCustomSite,
  onAddCustomSite,
  onEditCustomSite,
  interfaceMode = 'popup',
  saving = false,
  onShowToast,
}) => {
  // View state
  const [showAddSite, setShowAddSite] = useState(false);
  const [showImportDrawer, setShowImportDrawer] = useState(false);
  const [showAddMethodChooser, setShowAddMethodChooser] = useState(false);

  // Import state
  const { copyToClipboard } = useClipboard();
  const [exportingHostname, setExportingHostname] = useState<string | null>(null);
  const [importCode, setImportCode] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importingConfig, setImportingConfig] = useState(false);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  // Picker window hook
  const {
    pickerWindowState,
    pickerState,
    currentTabState,
    startElementPicker,
    resetPickerState,
  } = usePickerWindow({
    interfaceMode,
    siteConfigs,
    customSites,
  });

  const { requestSitePermission } = useSitePermissions();

  const notify = useCallback(
    (message: string, type: ToastType = 'info') => {
      if (onShowToast) {
        onShowToast(message, type);
      }
    },
    [onShowToast]
  );

  // Navigation callbacks
  const openAddMethodSelector = useCallback(() => {
    resetPickerState();
    setShowImportDrawer(false);
    setShowAddSite(false);
    setShowAddMethodChooser(true);
  }, [resetPickerState]);

  const openManualFlow = useCallback(() => {
    resetPickerState();
    setShowImportDrawer(false);
    setShowAddMethodChooser(false);
    setShowAddSite(true);
  }, [resetPickerState]);

  const openImportFlow = useCallback(() => {
    setShowAddMethodChooser(false);
    setShowAddSite(false);
    setShowImportDrawer(true);
  }, []);

  const closeAllForms = useCallback(() => {
    resetPickerState();
    setShowAddSite(false);
    setShowAddMethodChooser(false);
    setShowImportDrawer(false);
    setImportCode('');
    setImportError(null);
  }, [resetPickerState]);

  // Export functionality
  const handleExportCustomSite = useCallback(
    async (site: CustomSite) => {
      try {
        setExportingHostname(site.hostname);
        const encoded = await ConfigurationEncoder.encode(site);
        const copied = await copyToClipboard(encoded);

        if (copied) {
          notify('Configuration copied to clipboard', 'success');
        } else {
          setImportCode(encoded);
          openImportFlow();
          setImportError('Clipboard access was blocked. The configuration code is now in the import field for manual copying.');
          notify('Clipboard access was blocked. The configuration code has been added to the import field.', 'error');
        }
      } catch (error) {
        const message = error instanceof ConfigurationEncoderError ? error.message : 'Failed to export configuration';
        notify(message, 'error');
      } finally {
        setExportingHostname(null);
      }
    },
    [copyToClipboard, notify, openImportFlow]
  );

  // Import functionality
  const mapEncoderErrorToMessage = (error: ConfigurationEncoderError): string => {
    switch (error.code) {
      case 'INVALID_FORMAT':
        return 'Invalid configuration code. Please check the value and try again.';
      case 'UNSUPPORTED_VERSION':
        return 'This configuration was created with a newer version that is not supported yet.';
      case 'CHECKSUM_FAILED':
        return 'The configuration appears to be corrupted or tampered with.';
      case 'SECURITY_VIOLATION':
        return 'Import blocked because the configuration failed security checks.';
      case 'VALIDATION_ERROR':
      default:
        return error.message || 'Configuration failed validation.';
    }
  };

  const handleClearImport = useCallback(() => {
    setImportCode('');
    setImportError(null);
    setPendingImport(null);
  }, []);

  const handlePreviewImport = useCallback(async () => {
    if (!importCode.trim()) {
      setImportError('Enter a configuration code to continue.');
      return;
    }

    setImportError(null);
    setPendingImport(null);
    setPreviewOpen(false);
    setImportingConfig(true);
    openImportFlow();

    try {
      const decodedConfig = await ConfigurationEncoder.decode(importCode.trim());
      const validation = ConfigurationEncoder.validate(decodedConfig);
      const existingCustomSite = customSites.find((site) => site.hostname === validation.sanitizedConfig.hostname);
      const isBuiltIn = Object.prototype.hasOwnProperty.call(siteConfigs, validation.sanitizedConfig.hostname);

      if (isBuiltIn) {
        const message = 'This hostname already has a built-in integration and cannot be imported as custom.';
        setImportError(message);
        notify(message, 'error');
        return;
      }

      setPendingImport({
        config: validation.sanitizedConfig,
        warnings: validation.warnings.filter((warning) => warning.severity !== 'error'),
        duplicate: Boolean(existingCustomSite),
        existingSite: existingCustomSite,
      });
      setPreviewOpen(true);
    } catch (error) {
      const message =
        error instanceof ConfigurationEncoderError
          ? mapEncoderErrorToMessage(error)
          : 'Failed to decode configuration. Please verify the code and try again.';
      setImportError(message);
      notify(message, 'error');
    } finally {
      setImportingConfig(false);
    }
  }, [importCode, customSites, siteConfigs, notify, openImportFlow]);

  const handleConfirmImport = useCallback(async () => {
    if (!pendingImport) {
      return;
    }

    setConfirmingImport(true);

    try {
      const granted = await requestSitePermission(pendingImport.config.hostname);

      if (!granted) {
        const message = 'Permission denied. Please allow access to the site and try again.';
        setImportError(message);
        notify(message, 'error');
        return;
      }

      if (pendingImport.duplicate && pendingImport.existingSite) {
        await Promise.resolve(onRemoveCustomSite(pendingImport.existingSite.hostname));
      }

      const siteData: Omit<CustomSite, 'dateAdded'> = {
        hostname: pendingImport.config.hostname,
        displayName: pendingImport.config.displayName,
        enabled: true,
        ...(pendingImport.config.positioning ? { positioning: pendingImport.config.positioning } : {}),
      };

      if (onAddCustomSite) {
        await Promise.resolve(onAddCustomSite(siteData));
      }

      setImportError(null);
      closeAllForms();
      notify('Configuration imported successfully', 'success');
      setPreviewOpen(false);
      setPendingImport(null);
    } catch (error) {
      Logger.error('Failed to import configuration', toError(error));
      notify('Failed to import configuration. Please try again.', 'error');
    } finally {
      setConfirmingImport(false);
    }
  }, [pendingImport, requestSitePermission, onRemoveCustomSite, onAddCustomSite, notify, closeAllForms]);

  // Computed values
  const { isPickerWindow } = pickerWindowState;
  const { isCurrentSiteIntegrated, currentSiteHostname } = currentTabState;

  const addActionDisabled = !isPickerWindow && isCurrentSiteIntegrated;
  const addCardTooltip = addActionDisabled
    ? `Current site (${currentSiteHostname}) is already integrated`
    : 'Add a new custom site';
  const addFirstSiteTooltip = addActionDisabled
    ? `Current site (${currentSiteHostname}) is already integrated`
    : 'Add your first custom site';
  const addFirstSiteLabel = addActionDisabled ? 'Current Site Already Added' : 'Add Your First Site';

  const icon = (
    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  );

  return (
    <>
      <SettingsSection icon={icon} title="Site Integration" description="Choose which sites show the prompt library">
        <div className="space-y-4">
          {/* Supported Sites */}
          <SupportedSitesList
            siteConfigs={siteConfigs}
            enabledSites={enabledSites}
            onSiteToggle={onSiteToggle}
            saving={saving}
          />

          {/* Custom Sites */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">Custom Sites</h3>
            </div>

            {showAddMethodChooser && (
              <AddMethodChooser
                onManualClick={openManualFlow}
                onImportClick={openImportFlow}
                onCancel={() => { setShowAddMethodChooser(false); }}
              />
            )}

            {showImportDrawer && (
              <SiteImportDrawer
                importCode={importCode}
                onImportCodeChange={(value) => {
                  setImportCode(value);
                  setImportError(null);
                }}
                onPreview={() => {
                  void handlePreviewImport();
                }}
                onClear={() => {
                  handleClearImport();
                  setShowImportDrawer(false);
                }}
                loading={importingConfig}
                error={importError}
              />
            )}

            {showAddSite && (
              <AddCustomSiteForm
                siteConfigs={siteConfigs}
                customSites={customSites}
                onAddCustomSite={onAddCustomSite}
                onCancel={closeAllForms}
                pickerState={pickerState}
                onStartElementPicker={startElementPicker}
                pickerWindowState={pickerWindowState}
                currentTabState={currentTabState}
              />
            )}

            {/* Custom Sites List or Empty State */}
            {customSites.length > 0 ? (
              <CustomSitesList
                customSites={customSites}
                onCustomSiteToggle={onCustomSiteToggle}
                onRemoveCustomSite={onRemoveCustomSite}
                onEditCustomSite={onEditCustomSite}
                onExportCustomSite={handleExportCustomSite}
                onAddClick={openAddMethodSelector}
                exportingHostname={exportingHostname}
                saving={saving}
                addActionDisabled={addActionDisabled}
                addCardTooltip={addCardTooltip}
              />
            ) : (
              !showAddSite &&
              !showAddMethodChooser &&
              !showImportDrawer && (
                <EmptyCustomSitesState
                  onAddClick={openAddMethodSelector}
                  addActionDisabled={addActionDisabled}
                  addFirstSiteTooltip={addFirstSiteTooltip}
                  addFirstSiteLabel={addFirstSiteLabel}
                />
              )
            )}
          </div>
        </div>
      </SettingsSection>
      <ConfigurationPreview
        isOpen={previewOpen}
        config={pendingImport?.config ?? null}
        warnings={pendingImport?.warnings ?? []}
        duplicate={Boolean(pendingImport?.duplicate)}
        existingDisplayName={pendingImport?.existingSite?.displayName}
        onClose={() => {
          if (!confirmingImport) {
            setPreviewOpen(false);
            setPendingImport(null);
          }
        }}
        onConfirm={() => {
          void handleConfirmImport();
        }}
        isProcessing={confirmingImport}
      />
    </>
  );
};

export default SiteIntegrationSection;

import { FC, useReducer, useCallback } from 'react';

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

// ============================================================================
// View State Reducer - manages which view is currently displayed
// ============================================================================
type ViewMode = 'list' | 'method-chooser' | 'manual-form' | 'import-drawer';

interface ViewState {
  mode: ViewMode;
}

type ViewAction =
  | { type: 'SHOW_METHOD_CHOOSER' }
  | { type: 'SHOW_MANUAL_FORM' }
  | { type: 'SHOW_IMPORT_DRAWER' }
  | { type: 'CLOSE_ALL' };

const viewInitialState: ViewState = { mode: 'list' };

function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case 'SHOW_METHOD_CHOOSER':
      return { mode: 'method-chooser' };
    case 'SHOW_MANUAL_FORM':
      return { mode: 'manual-form' };
    case 'SHOW_IMPORT_DRAWER':
      return { mode: 'import-drawer' };
    case 'CLOSE_ALL':
      return { mode: 'list' };
    default:
      return state;
  }
}

// ============================================================================
// Import State Reducer - manages import/export flow
// ============================================================================
interface PendingImport {
  config: CustomSiteConfiguration;
  warnings: SecurityWarning[];
  duplicate: boolean;
  existingSite?: CustomSite;
}

interface ImportState {
  code: string;
  error: string | null;
  isDecoding: boolean;
  isConfirming: boolean;
  previewOpen: boolean;
  pendingImport: PendingImport | null;
  exportingHostname: string | null;
}

type ImportAction =
  | { type: 'SET_CODE'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'START_DECODE' }
  | { type: 'DECODE_SUCCESS'; payload: PendingImport }
  | { type: 'DECODE_FAILURE'; payload: string }
  | { type: 'START_CONFIRM' }
  | { type: 'CONFIRM_SUCCESS' }
  | { type: 'CONFIRM_FAILURE'; payload: string }
  | { type: 'CLOSE_PREVIEW' }
  | { type: 'CLEAR' }
  | { type: 'START_EXPORT'; payload: string }
  | { type: 'END_EXPORT' }
  | { type: 'EXPORT_FALLBACK'; payload: string };

const importInitialState: ImportState = {
  code: '',
  error: null,
  isDecoding: false,
  isConfirming: false,
  previewOpen: false,
  pendingImport: null,
  exportingHostname: null,
};

function importReducer(state: ImportState, action: ImportAction): ImportState {
  switch (action.type) {
    case 'SET_CODE':
      return { ...state, code: action.payload, error: null };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'START_DECODE':
      return { ...state, isDecoding: true, error: null, pendingImport: null, previewOpen: false };
    case 'DECODE_SUCCESS':
      return { ...state, isDecoding: false, pendingImport: action.payload, previewOpen: true };
    case 'DECODE_FAILURE':
      return { ...state, isDecoding: false, error: action.payload };
    case 'START_CONFIRM':
      return { ...state, isConfirming: true };
    case 'CONFIRM_SUCCESS':
      return { ...importInitialState };
    case 'CONFIRM_FAILURE':
      return { ...state, isConfirming: false, error: action.payload };
    case 'CLOSE_PREVIEW':
      return { ...state, previewOpen: false, pendingImport: null };
    case 'CLEAR':
      return { ...importInitialState, exportingHostname: state.exportingHostname };
    case 'START_EXPORT':
      return { ...state, exportingHostname: action.payload };
    case 'END_EXPORT':
      return { ...state, exportingHostname: null };
    case 'EXPORT_FALLBACK':
      return { ...state, exportingHostname: null, code: action.payload, error: 'Clipboard access was blocked. The configuration code is now in the import field for manual copying.' };
    default:
      return state;
  }
}

// ============================================================================
// Component
// ============================================================================
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
  // Consolidated state management
  const [viewState, viewDispatch] = useReducer(viewReducer, viewInitialState);
  const [importState, importDispatch] = useReducer(importReducer, importInitialState);

  // Derived view flags for cleaner JSX
  const showAddMethodChooser = viewState.mode === 'method-chooser';
  const showAddSite = viewState.mode === 'manual-form';
  const showImportDrawer = viewState.mode === 'import-drawer';

  // External hooks
  const { copyToClipboard } = useClipboard();
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
    viewDispatch({ type: 'SHOW_METHOD_CHOOSER' });
  }, [resetPickerState]);

  const openManualFlow = useCallback(() => {
    resetPickerState();
    viewDispatch({ type: 'SHOW_MANUAL_FORM' });
  }, [resetPickerState]);

  const openImportFlow = useCallback(() => {
    viewDispatch({ type: 'SHOW_IMPORT_DRAWER' });
  }, []);

  const closeAllForms = useCallback(() => {
    resetPickerState();
    viewDispatch({ type: 'CLOSE_ALL' });
    importDispatch({ type: 'CLEAR' });
  }, [resetPickerState]);

  // Export functionality
  const handleExportCustomSite = useCallback(
    async (site: CustomSite) => {
      try {
        importDispatch({ type: 'START_EXPORT', payload: site.hostname });
        const encoded = await ConfigurationEncoder.encode(site);
        const copied = await copyToClipboard(encoded);

        if (copied) {
          importDispatch({ type: 'END_EXPORT' });
          notify('Configuration copied to clipboard', 'success');
        } else {
          importDispatch({ type: 'EXPORT_FALLBACK', payload: encoded });
          openImportFlow();
          notify('Clipboard access was blocked. The configuration code has been added to the import field.', 'error');
        }
      } catch (error) {
        importDispatch({ type: 'END_EXPORT' });
        const message = error instanceof ConfigurationEncoderError ? error.message : 'Failed to export configuration';
        notify(message, 'error');
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
    importDispatch({ type: 'CLEAR' });
  }, []);

  const handlePreviewImport = useCallback(async () => {
    if (!importState.code.trim()) {
      importDispatch({ type: 'SET_ERROR', payload: 'Enter a configuration code to continue.' });
      return;
    }

    importDispatch({ type: 'START_DECODE' });
    openImportFlow();

    try {
      const decodedConfig = await ConfigurationEncoder.decode(importState.code.trim());
      const validation = ConfigurationEncoder.validate(decodedConfig);
      const existingCustomSite = customSites.find((site) => site.hostname === validation.sanitizedConfig.hostname);
      const isBuiltIn = Object.prototype.hasOwnProperty.call(siteConfigs, validation.sanitizedConfig.hostname);

      if (isBuiltIn) {
        const message = 'This hostname already has a built-in integration and cannot be imported as custom.';
        importDispatch({ type: 'DECODE_FAILURE', payload: message });
        notify(message, 'error');
        return;
      }

      importDispatch({
        type: 'DECODE_SUCCESS',
        payload: {
          config: validation.sanitizedConfig,
          warnings: validation.warnings.filter((warning) => warning.severity !== 'error'),
          duplicate: Boolean(existingCustomSite),
          existingSite: existingCustomSite,
        },
      });
    } catch (error) {
      const message =
        error instanceof ConfigurationEncoderError
          ? mapEncoderErrorToMessage(error)
          : 'Failed to decode configuration. Please verify the code and try again.';
      importDispatch({ type: 'DECODE_FAILURE', payload: message });
      notify(message, 'error');
    }
  }, [importState.code, customSites, siteConfigs, notify, openImportFlow]);

  const handleConfirmImport = useCallback(async () => {
    const { pendingImport } = importState;
    if (!pendingImport) {
      return;
    }

    importDispatch({ type: 'START_CONFIRM' });

    try {
      const granted = await requestSitePermission(pendingImport.config.hostname);

      if (!granted) {
        const message = 'Permission denied. Please allow access to the site and try again.';
        importDispatch({ type: 'CONFIRM_FAILURE', payload: message });
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

      importDispatch({ type: 'CONFIRM_SUCCESS' });
      closeAllForms();
      notify('Configuration imported successfully', 'success');
    } catch (error) {
      Logger.error('Failed to import configuration', toError(error));
      importDispatch({ type: 'CONFIRM_FAILURE', payload: 'Failed to import configuration. Please try again.' });
      notify('Failed to import configuration. Please try again.', 'error');
    }
  }, [importState, requestSitePermission, onRemoveCustomSite, onAddCustomSite, notify, closeAllForms]);

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
                onCancel={() => { viewDispatch({ type: 'CLOSE_ALL' }); }}
              />
            )}

            {showImportDrawer && (
              <SiteImportDrawer
                importCode={importState.code}
                onImportCodeChange={(value) => {
                  importDispatch({ type: 'SET_CODE', payload: value });
                }}
                onPreview={() => {
                  void handlePreviewImport();
                }}
                onClear={() => {
                  handleClearImport();
                  viewDispatch({ type: 'CLOSE_ALL' });
                }}
                loading={importState.isDecoding}
                error={importState.error}
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
                exportingHostname={importState.exportingHostname}
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
        isOpen={importState.previewOpen}
        config={importState.pendingImport?.config ?? null}
        warnings={importState.pendingImport?.warnings ?? []}
        duplicate={Boolean(importState.pendingImport?.duplicate)}
        existingDisplayName={importState.pendingImport?.existingSite?.displayName}
        onClose={() => {
          if (!importState.isConfirming) {
            importDispatch({ type: 'CLOSE_PREVIEW' });
          }
        }}
        onConfirm={() => {
          void handleConfirmImport();
        }}
        isProcessing={importState.isConfirming}
      />
    </>
  );
};

export default SiteIntegrationSection;

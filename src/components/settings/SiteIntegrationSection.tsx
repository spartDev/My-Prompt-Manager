import { type FC, useCallback, useReducer } from 'react';

import { useClipboard } from '../../hooks/useClipboard';
import { usePickerWindow } from '../../hooks/usePickerWindow';
import { useSitePermissions } from '../../hooks/useSitePermissions';
import { ConfigurationEncoder, ConfigurationEncoderError } from '../../services/configurationEncoder';
import type { CustomSite, CustomSiteConfiguration, SecurityWarning } from '../../types';
import type { ToastType } from '../../types/components';
import type { ShowToast } from '../../types/hooks';
import { Logger, toError } from '../../utils';

import AddCustomSiteForm from './AddCustomSiteForm';
import AddMethodChooser from './AddMethodChooser';
import ConfigurationPreview from './ConfigurationPreview';
import CustomSitesList from './CustomSitesList';
import SettingsGroup from './SettingsGroup';
import SiteImportDrawer from './SiteImportDrawer';
import SupportedSitesList, { type SiteConfig } from './SupportedSitesList';

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
  interfaceMode?: 'popup' | 'sidepanel';
  saving?: boolean;
  onShowToast?: ShowToast;
}

// The message an import shows for an encoder error
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

const SiteIntegrationSection: FC<SiteIntegrationSectionProps> = ({
  enabledSites,
  customSites,
  siteConfigs,
  onSiteToggle,
  onCustomSiteToggle,
  onRemoveCustomSite,
  onAddCustomSite,
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
    (message: string, type: ToastType = 'info', sub?: string) => {
      if (onShowToast) {
        onShowToast(message, type, { sub });
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

  /**
   * Exports a custom site configuration to clipboard as an encoded string.
   * Falls back to showing the encoded config in the import field if clipboard access is blocked.
   * @param site - The custom site configuration to export
   */
  const handleExportCustomSite = useCallback(
    async (site: CustomSite) => {
      try {
        importDispatch({ type: 'START_EXPORT', payload: site.hostname });
        const encoded = await ConfigurationEncoder.encode(site);
        const copied = await copyToClipboard(encoded);

        if (copied) {
          importDispatch({ type: 'END_EXPORT' });
          notify('Configuration copied', 'success', site.hostname);
        } else {
          importDispatch({ type: 'EXPORT_FALLBACK', payload: encoded });
          openImportFlow();
          notify('Clipboard access blocked', 'error', 'The code is in the import field.');
        }
      } catch (error) {
        importDispatch({ type: 'END_EXPORT' });
        notify("Couldn't export configuration", 'error', error instanceof ConfigurationEncoderError ? error.message : undefined);
      }
    },
    [copyToClipboard, notify, openImportFlow]
  );

  // Import functionality

  const handleClearImport = useCallback(() => {
    importDispatch({ type: 'CLEAR' });
  }, []);

  /**
   * Validates and prepares an imported configuration for preview.
   * Decodes the configuration string, validates its structure, checks for duplicate
   * hostnames and built-in site conflicts, and identifies any security warnings.
   */
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
        notify("Couldn't import configuration", 'error', message);
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
      notify("Couldn't import configuration", 'error', message);
    }
  }, [importState.code, customSites, siteConfigs, notify, openImportFlow]);

  /**
   * Confirms and completes the import of a validated configuration.
   * Requests site permission, removes any existing duplicate site, creates the new
   * custom site entry, and notifies the user of success or failure.
   */
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
        notify("Couldn't import configuration", 'error', message);
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
      notify('Configuration imported', 'success', pendingImport.config.hostname);
    } catch (error) {
      Logger.error('Failed to import configuration', toError(error));
      importDispatch({ type: 'CONFIRM_FAILURE', payload: 'Failed to import configuration. Please try again.' });
      notify("Couldn't import configuration", 'error', 'Please try again.');
    }
  }, [importState, requestSitePermission, onRemoveCustomSite, onAddCustomSite, notify, closeAllForms]);

  // Computed values
  const { isPickerWindow } = pickerWindowState;
  const { isCurrentSiteIntegrated, currentSiteHostname } = currentTabState;

  const addActionDisabled = !isPickerWindow && isCurrentSiteIntegrated;
  const addActionReason = addActionDisabled ? `Current site (${currentSiteHostname}) is already integrated` : undefined;

  return (
    <>
      <SettingsGroup
        label="AI sites"
        after={
          (showAddMethodChooser || showImportDrawer || showAddSite) && (
            <div className="flex flex-col gap-3">
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
            </div>
          )
        }
      >
        <SupportedSitesList
          siteConfigs={siteConfigs}
          enabledSites={enabledSites}
          onSiteToggle={onSiteToggle}
          saving={saving}
        />

        <CustomSitesList
          customSites={customSites}
          onCustomSiteToggle={onCustomSiteToggle}
          onRemoveCustomSite={onRemoveCustomSite}
          onExportCustomSite={handleExportCustomSite}
          exportingHostname={importState.exportingHostname}
          saving={saving}
        />

        {/* Opens the way to add a custom site: by hand, or from a configuration code */}
        <button
          type="button"
          onClick={openAddMethodSelector}
          disabled={addActionDisabled}
          title={addActionReason}
          className="w-full flex items-center gap-3 py-2.5 pr-2.5 pl-3.5 min-h-[54px] text-left text-sm font-bold text-accent hover:bg-raised transition-colors focus-interactive -outline-offset-2 disabled:text-tertiary disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          <span aria-hidden="true" className="size-[30px] rounded-full flex items-center justify-center shrink-0 bg-accent-subtle">
            <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="flex-1 min-w-0">
            Add a custom site
            {addActionReason && (
              <span className="block text-[11.5px] font-normal text-tertiary truncate">{addActionReason}</span>
            )}
          </span>
        </button>
      </SettingsGroup>
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

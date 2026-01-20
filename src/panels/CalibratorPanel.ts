import * as vscode from 'vscode';
import { getWebviewContent } from '../webview/htmlBuilder';
import {
    computeRecommendations,
    RecommendationInput,
    RecommendationOutput,
    EditorSettings,
} from '../logic/recommendations';
import { SettingsManager, EditorSettingsSnapshot, LineHighlightType, PrescriptionData } from '../logic/settingsManager';
import { PauseManager, PauseSettings, PauseState } from '../logic/pauseManager';
import { debounce } from '../utils/throttle';
import { getTranslations } from '../i18n/translations';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WebviewMessage {
    command: string;
    payload?: RecommendationInput | EditorSettings | unknown;
}

interface SettingsPayload {
    fontSize: number;
    lineHeight: number;
    letterSpacing: number;
    fontWeight: string;
    cursorWidth: number;
    renderLineHighlight?: LineHighlightType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Calibrator Panel
// ─────────────────────────────────────────────────────────────────────────────

export class CalibratorPanel implements vscode.Disposable {
    public static currentPanel: CalibratorPanel | undefined;

    private static readonly viewType = 'harmoniaVision.calibrator';
    private readonly _panel: vscode.WebviewPanel;
    private readonly _context: vscode.ExtensionContext;
    private readonly _settingsManager: SettingsManager;
    private readonly _pauseManager: PauseManager | undefined;
    private _disposables: vscode.Disposable[] = [];

    // Debounced apply function (200ms delay)
    private readonly _debouncedApply: (settings: EditorSettingsSnapshot) => void;

    private constructor(
        panel: vscode.WebviewPanel,
        context: vscode.ExtensionContext,
        pauseManager?: PauseManager
    ) {
        this._panel = panel;
        this._context = context;
        this._settingsManager = new SettingsManager(context.globalState);
        this._pauseManager = pauseManager;

        // Create debounced apply function (150ms for snappier feel)
        this._debouncedApply = debounce(
            (settings: EditorSettingsSnapshot) => this._executeApply(settings),
            150
        );

        // Auto-capture snapshot on panel open - this is the safety net for revert
        // Users can always go back to where they started
        this._initializeSnapshot();

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.onDidChangeViewState(
            () => {
                if (this._panel.visible) {
                    // Do NOT call _update() here - it regenerates HTML and destroys state
                    // retainContextWhenHidden: true preserves the webview state
                    // Only resend state data (not regenerate HTML)
                    // Skip slider update - sliders are independent and preserved by retainContextWhenHidden
                    this._sendFullStateToWebview(true);
                }
            },
            null,
            this._disposables
        );

        this._panel.webview.onDidReceiveMessage(
            (message: WebviewMessage) => {
                this._handleMessage(message);
            },
            null,
            this._disposables
        );

        // Listen for configuration changes (to detect external changes)
        const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
            if (this._settingsManager.isUpdating) {
                return;
            }
            if (e.affectsConfiguration('editor')) {
                // When settings.json is modified externally, update the Current Settings display
                // but DO NOT update sliders - they're independent once panel is opened
                this._sendFullStateToWebview(true);
            }
        });
        this._disposables.push(configListener);

        // Listen for pause state changes
        if (this._pauseManager) {
            const pauseListener = this._pauseManager.onStateChange((state) => {
                this._sendPauseStateToWebview(state);
            });
            this._disposables.push(pauseListener);
        }
    }

    public static createOrShow(
        context: vscode.ExtensionContext,
        pauseManager?: PauseManager
    ): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (CalibratorPanel.currentPanel) {
            CalibratorPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            CalibratorPanel.viewType,
            'Harmonia Vision',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'src', 'webview'),
                    vscode.Uri.joinPath(context.extensionUri, 'out', 'webview')
                ],
                retainContextWhenHidden: true
            }
        );

        CalibratorPanel.currentPanel = new CalibratorPanel(panel, context, pauseManager);
    }

    public dispose(): void {
        // Note: We do NOT revert on dispose anymore.
        // Settings are persistent and user can revert manually.
        CalibratorPanel.currentPanel = undefined;
        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Captures a snapshot of current settings when panel opens.
     * This is the safety net - users can always revert to where they started.
     */
    private async _initializeSnapshot(): Promise<void> {
        // Always capture a fresh snapshot when panel opens
        // This ensures users can revert to their starting point
        await this._settingsManager.captureSnapshot(true);
    }

    private _update(): void {
        const webview = this._panel.webview;
        const translations = getTranslations(vscode.env.language);
        this._panel.title = translations.title;
        this._panel.webview.html = getWebviewContent(webview, this._context.extensionUri, translations);
    }

    private _handleMessage(message: WebviewMessage): void {
        switch (message.command) {
            case 'updateInput':
                if (message.payload && this._isRecommendationInput(message.payload)) {
                    this._computeAndSendRecommendations(message.payload);
                }
                break;
            case 'applySettings':
                if (message.payload && this._isSettingsPayload(message.payload)) {
                    this._handleApplySettings(message.payload);
                }
                break;
            case 'previewSettings':
                // Preview applies to GLOBAL settings temporarily for testing
                if (message.payload && this._isSettingsPayload(message.payload)) {
                    this._handlePreviewSettings(message.payload);
                }
                break;
            case 'saveSettings':
                // Save commits settings AND updates the snapshot (new baseline)
                if (message.payload && this._isSettingsPayload(message.payload)) {
                    this._handleSaveSettings(message.payload);
                }
                break;
            case 'revert':
                this._handleRevert();
                break;
            case 'revertAndClear':
                this._handleRevertAndClear();
                break;
            case 'recaptureSnapshot':
                this._handleRecaptureSnapshot();
                break;
            case 'createSnapshot':
                this._handleCreateSnapshot();
                break;
            case 'deleteSnapshot':
                this._handleDeleteSnapshot();
                break;
            case 'getInitialState':
                this._sendFullStateToWebview();
                break;
            // Pause-related commands
            case 'getPauseState':
                this._sendPauseStateToWebview();
                break;
            case 'updatePauseSettings':
                if (message.payload && this._isPauseSettingsPayload(message.payload)) {
                    this._handleUpdatePauseSettings(message.payload);
                }
                break;
            case 'togglePause':
                this._handleTogglePause();
                break;
            case 'triggerPauseNow':
                this._handleTriggerPauseNow();
                break;
            case 'updateTimerVisibility':
                if (typeof message.payload === 'string') {
                    this._handleUpdateTimerVisibility(message.payload);
                }
                break;
            // Prescription persistence
            case 'savePrescription':
                if (message.payload && this._isPrescriptionPayload(message.payload)) {
                    this._handleSavePrescription(message.payload);
                }
                break;
            case 'clearPrescription':
                this._handleClearPrescription();
                break;
        }
    }

    private _isRecommendationInput(payload: unknown): payload is RecommendationInput {
        return typeof payload === 'object' && payload !== null && 'toggles' in payload;
    }

    private _isSettingsPayload(payload: unknown): payload is SettingsPayload {
        return typeof payload === 'object' && payload !== null && 'fontSize' in payload;
    }

    private _isPauseSettingsPayload(payload: unknown): payload is Partial<PauseSettings> {
        return typeof payload === 'object' && payload !== null;
    }

    private _isPrescriptionPayload(payload: unknown): payload is PrescriptionData {
        return typeof payload === 'object' && payload !== null && 'rememberMe' in payload;
    }

    private _computeAndSendRecommendations(input: RecommendationInput): void {
        try {
            // Use current settings.json values as baseline for recommendations
            // User has explicit control over snapshot - it's only for revert functionality
            const currentSettings = this._settingsManager.readCurrentSettings();

            const inputWithCurrentSettings: RecommendationInput = {
                ...input,
                currentSettings: {
                    fontSize: currentSettings.fontSize,
                    lineHeight: currentSettings.lineHeight,
                    letterSpacing: currentSettings.letterSpacing,
                    fontWeight: currentSettings.fontWeight,
                    cursorWidth: currentSettings.cursorWidth,
                },
            };

            const recommendations: RecommendationOutput = computeRecommendations(inputWithCurrentSettings);

            this._panel.webview.postMessage({
                command: 'recommendations',
                payload: recommendations,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to compute recommendations: ${errorMessage}`);
        }
    }

    private _handleApplySettings(settings: SettingsPayload): void {
        // Use debounced apply for slider changes
        this._debouncedApply(this._convertToSnapshot(settings));
    }

    private async _handlePreviewSettings(settings: SettingsPayload): Promise<void> {
        // Preview action - apply to GLOBAL settings for testing (snapshot unchanged)
        // Silent operation: no info message for snappier feel, webview already does optimistic UI updates
        const result = await this._settingsManager.applySettings(this._convertToSnapshot(settings), false);
        if (result.success) {
            this._sendFullStateToWebview();
            // No info message - preview should be silent and fast
        } else {
            vscode.window.showErrorMessage(`Failed to apply preview: ${result.error}`);
        }
    }

    private async _handleSaveSettings(settings: SettingsPayload): Promise<void> {
        // Save action - apply settings AND update snapshot (new baseline)
        const settingsSnapshot = this._convertToSnapshot(settings);
        const result = await this._settingsManager.applySettings(settingsSnapshot, false);
        if (result.success) {
            // Update snapshot to current settings (this becomes the new "revert" target)
            await this._settingsManager.captureSnapshot(true);
            this._sendFullStateToWebview();
            vscode.window.showInformationMessage('Harmonia Vision: Settings saved as your new defaults.');
        } else {
            vscode.window.showErrorMessage(`Failed to save settings: ${result.error}`);
        }
    }

    private async _executeApply(settings: EditorSettingsSnapshot): Promise<void> {
        const result = await this._settingsManager.applySettings(settings);
        if (!result.success) {
            vscode.window.showErrorMessage(`Failed to apply settings: ${result.error}`);
        }
        this._sendFullStateToWebview();
    }

    private async _handleRevert(): Promise<void> {
        const result = await this._settingsManager.revert();

        if (result.success) {
            // Send state update but don't touch sliders - they're user-controlled
            this._sendFullStateToWebview(true);
            vscode.window.showInformationMessage('Harmonia Vision: Settings reverted.');
        } else {
            vscode.window.showErrorMessage(`Failed to revert: ${result.error}`);
        }
    }

    private async _handleRevertAndClear(): Promise<void> {
        const result = await this._settingsManager.revertAndClear();

        if (result.success) {
            // Skip slider update - sliders are independent
            this._sendFullStateToWebview(true);
            vscode.window.showInformationMessage('Harmonia Vision: Settings reverted and snapshot cleared.');
        } else {
            vscode.window.showErrorMessage(`Failed to revert: ${result.error}`);
        }
    }

    private async _handleRecaptureSnapshot(): Promise<void> {
        await this._settingsManager.captureSnapshot(true); // Force recapture
        // Skip slider update - just updating snapshot, sliders are independent
        this._sendFullStateToWebview(true);
        vscode.window.showInformationMessage('Harmonia Vision: Snapshot updated from current settings.');
    }

    private async _handleCreateSnapshot(): Promise<void> {
        await this._settingsManager.captureSnapshot(true);
        // Skip slider update - just creating snapshot, sliders are independent
        this._sendFullStateToWebview(true);
        vscode.window.showInformationMessage('Harmonia Vision: Snapshot created. You can now revert to these settings anytime.');
    }

    private async _handleDeleteSnapshot(): Promise<void> {
        await this._settingsManager.clearSnapshot();
        // Skip slider update - just deleting snapshot, sliders are independent
        this._sendFullStateToWebview(true);
        vscode.window.showInformationMessage('Harmonia Vision: Snapshot deleted.');
    }

    private async _handleSavePrescription(prescription: PrescriptionData): Promise<void> {
        await this._settingsManager.savePrescription(prescription);
    }

    private async _handleClearPrescription(): Promise<void> {
        await this._settingsManager.clearPrescription();
        // Skip slider update - just clearing prescription, sliders are independent
        this._sendFullStateToWebview(true);
    }

    private _convertToSnapshot(settings: SettingsPayload): EditorSettingsSnapshot {
        return {
            fontSize: settings.fontSize,
            lineHeight: settings.lineHeight,
            letterSpacing: settings.letterSpacing,
            fontWeight: settings.fontWeight,
            cursorWidth: settings.cursorWidth,
            renderLineHighlight: settings.renderLineHighlight,
        };
    }

    private _sendCurrentSettingsToWebview(): void {
        const current = this._settingsManager.readCurrentSettings();
        this._panel.webview.postMessage({
            command: 'currentSettings',
            payload: current,
        });
    }

    private _getTimerVisibility(): 'always' | 'auto' | 'hidden' {
        const config = vscode.workspace.getConfiguration('harmoniaVision');
        return config.get<'always' | 'auto' | 'hidden'>('statusBar.timerVisibility', 'auto');
    }

    private _sendFullStateToWebview(skipSliderUpdate: boolean = false): void {
        const current = this._settingsManager.readCurrentSettings();
        const snapshot = this._settingsManager.getSnapshot();
        const snapshotAge = this._settingsManager.getSnapshotAge();
        const hasSnapshot = this._settingsManager.hasSnapshot();
        const timerVisibility = this._getTimerVisibility();
        const prescription = this._settingsManager.getSavedPrescription();

        this._panel.webview.postMessage({
            command: 'fullState',
            payload: {
                current,
                snapshot,
                snapshotAge,
                hasSnapshot,
                timerVisibility,
                prescription,
                skipSliderUpdate,
            },
        });

        // Also send pause state
        this._sendPauseStateToWebview();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pause Feature Methods
    // ─────────────────────────────────────────────────────────────────────────

    private _sendPauseStateToWebview(state?: PauseState): void {
        if (!this._pauseManager) {
            return;
        }

        const pauseState = state || this._pauseManager.getState();
        this._panel.webview.postMessage({
            command: 'pauseState',
            payload: pauseState,
        });
    }

    private async _handleUpdatePauseSettings(settings: Partial<PauseSettings>): Promise<void> {
        if (!this._pauseManager) {
            return;
        }

        await this._pauseManager.updateSettings(settings);
    }

    private async _handleTogglePause(): Promise<void> {
        if (!this._pauseManager) {
            return;
        }

        await this._pauseManager.toggle();
    }

    private _handleTriggerPauseNow(): void {
        if (!this._pauseManager) {
            return;
        }

        this._pauseManager.triggerBreakNow();
    }

    private async _handleUpdateTimerVisibility(visibility: string): Promise<void> {
        if (visibility !== 'always' && visibility !== 'auto' && visibility !== 'hidden') {
            return;
        }
        const config = vscode.workspace.getConfiguration('harmoniaVision');
        await config.update('statusBar.timerVisibility', visibility, vscode.ConfigurationTarget.Global);
    }
}

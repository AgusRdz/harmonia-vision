import * as vscode from 'vscode';
import { CalibratorPanel } from './panels/CalibratorPanel';

export function activate(context: vscode.ExtensionContext): void {
    const openCalibratorCommand = vscode.commands.registerCommand(
        'harmoniaVision.openCalibrator',
        () => {
            // Pass full context for globalState access
            CalibratorPanel.createOrShow(context);
        }
    );

    context.subscriptions.push(openCalibratorCommand);

    // Track the panel if it exists
    if (CalibratorPanel.currentPanel) {
        context.subscriptions.push(CalibratorPanel.currentPanel);
    }
}

export function deactivate(): void {
    // Cleanup handled by disposables
}

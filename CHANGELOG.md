# Changelog

## [1.4.1] - 2026-01-20

### Fixed

- **Deterministic Recommendations**
  - Recommendations now use current settings.json values as baseline
  - Prevents "runaway" recommendations where previewed values compound on each generation
  - Font size recommendations are now consistent and reproducible

- **Preview Performance**
  - Reduced debounce from 200ms to 150ms for snappier preview updates
  - Preview is now silent (no info message) for smoother UX

- **Recommendation Engine**
  - Reduced MAX_FONT_SIZE from 32 to 28 to prevent over-scaling
  - Cursor width now properly recommended for myopia with sphere >= 2.0

- **Independent Sliders**
  - Sliders now load settings.json values only on panel open
  - After initial load, sliders are independent and user-controlled
  - Revert restores settings.json but preserves current slider/recommendation values
  - Switching tabs no longer resets slider values

### Changed

- **Snapshot Management**
  - Snapshot (now called "Revert Point") is auto-captured when panel opens
  - Users can always revert to their starting point - no manual setup required
  - "Update" button available to refresh revert point to current settings
  - Clear visual distinction between "Current Settings" (blue) and "Revert Point" (green)
  - Panel reflects settings.json changes immediately (live sync)

### Added

- **Simplified Revert Point UI**
  - Shows current settings vs revert point values side-by-side
  - "Update" button to refresh revert point when needed
  - Revert always available - users can always go back to where they started

- **Prescription Persistence**
  - "Remember my prescription" toggle to save prescription locally
  - Visual profile toggles (myopia, astigmatism, etc.) also saved when enabled
  - Data stored in extension's local storage (privacy-first)

- **Button Tooltips**
  - Revert button: explains it restores to starting values
  - Save button: clarifies it updates the revert point to new values

- **New Translations**
  - Added snapshot management strings (EN/ES)
  - Added prescription persistence strings (EN/ES)
  - Added button tooltip strings (EN/ES)

---

## [1.4.0] - 2026-01-20

### Added

- **Status Bar Timer Visibility Setting**
  - New setting `harmoniaVision.statusBar.timerVisibility` with options:
    - `always` - Always show the status bar timer
    - `auto` (default) - Show only when timer is running; hides if Harmonia Zen has priority
    - `hidden` - Never show the status bar timer
  - Dropdown control added to Eye Break Reminders section in Calibrator panel
  - Enables clean UX when using both Harmonia Zen and Harmonia Vision together

- **Cross-Extension Coordination**
  - New internal command `harmoniaVision.getTimerState` for extension communication
  - Automatically hides Eye Break timer when Harmonia Zen Pomodoro is active (in `auto` mode)
  - Zen Pomodoro takes priority to avoid two timers cluttering the status bar

### Improved

- **Tooltips** - Clearer, more descriptive tooltips:
  - Work interval: `Harmonia Focus - Eye Break (20-20-20) in 19:30`
  - On break: `Harmonia Focus - Eye Break (20-20-20) in progress`

---

## [1.3.0] - 2026-01-19

### Added

- **Break Statistics** (New dedicated panel)
  - New command: `Harmonia Vision: Open Break Statistics`
  - Track breaks taken, snoozed, and dismissed
  - Daily and weekly summaries with compliance rate
  - Current and longest streak tracking
  - Total rest time accumulated
  - Clean UI with icons and visual indicators
  - All data stored locally (privacy-first)
  - Reset statistics option

### Technical

- Added `StatsPanel` class for dedicated statistics webview
- Added `PauseStats` class for local statistics storage
- Statistics persisted in `globalState` (90-day retention)
- Integrated stats tracking into `PauseManager`

---

## [1.2.0] - 2026-01-19

### Added

- **Eye Break Reminders (20-20-20 Rule)**
  - Customizable work intervals (15-60 minutes, default 20)
  - Configurable break duration (10-60 seconds, default 20)
  - Status bar countdown timer with visual indicators
  - Random bilingual eye health tips (EN/ES) with each reminder
  - Idle detection to pause timer when not actively coding
  - Snooze functionality (5 minutes)

- **New Commands**
  - `Harmonia Vision: Toggle Eye Break Reminders` - Enable/disable reminders
  - `Harmonia Vision: Take Eye Break Now` - Trigger immediate break
  - `Harmonia Vision: Snooze Eye Break` - Snooze current reminder

- **New Settings**
  - `harmoniaVision.pause.enabled` - Enable eye break reminders
  - `harmoniaVision.pause.workIntervalMinutes` - Time between breaks
  - `harmoniaVision.pause.breakDurationSeconds` - Break duration
  - `harmoniaVision.pause.showStatusBar` - Show/hide status bar countdown
  - `harmoniaVision.pause.pauseWhenIdle` - Pause timer when inactive

- **Calibrator Panel Integration**
  - New "Eye Break Reminders" section in the Calibrator UI
  - Toggle switch to enable/disable reminders
  - Sliders for work interval and break duration
  - Checkboxes for status bar and idle detection options
  - "Take Break Now" button for manual breaks
  - Real-time status badge (Active/Inactive/On Break)

### Technical

- Added `PauseManager` class for timer and notification logic
- Added `pauseTips.ts` with 15 bilingual eye health tips
- Activity tracking via editor events for idle detection
- State persistence across VS Code sessions via `globalState`

---

## [1.1.0] - 2026-01-18

### Added

- **Line Highlight Control**
  - New `editor.renderLineHighlight` setting support
  - Options: All (default), Line Only, Gutter Only, None
  - Helps users with light sensitivity reduce visual distractions

### Improved

- **Live Preview**
  - Added line numbers gutter to side-by-side comparison
  - Preview now shows line highlight effect in real-time
  - More accurate representation of VS Code editor appearance

### Technical

- Added `LineHighlightType` for type-safe highlight mode handling
- Updated settings manager to read/write `renderLineHighlight`
- Enhanced webview with gutter styling using VS Code theme variables

---

## [1.0.0] - 2026-01-17

### Added

- **Visual Profile Assessment**
  - Support for 6 visual conditions:
    - Myopia (nearsightedness)
    - Astigmatism
    - Eye strain / fatigue
    - Blur / Ghosting
    - Light sensitivity
    - Visual crowding
  - Clear interactive selection states with immediate feedback

- **Prescription Input (Optional)**
  - Sphere (SPH) and Cylinder (CYL) fields
  - Decimal validation (up to 2 decimal places)
  - Tooltips explaining each value and when to use it

- **Recommendation Engine**
  - Personalized editor setting recommendations based on your selected profile
  - Conservative, explainable heuristics designed to avoid extreme values
  - Human-readable rationale per recommended setting

- **Editor Settings Controls**
  - Font Size (12-32px)
  - Line Height (Auto-2.2x)
  - Letter Spacing (0-1.5px)
  - Font Weight (300-700)
  - Cursor Width (1-5px)

- **Live Preview**
  - Side-by-side comparison (Original vs Preview)
  - Real-time preview updates while adjusting controls

- **Safe Apply Workflow**
  - Automatic settings snapshot on extension open
  - Preview button to test settings in the editor
  - Save button to commit changes
  - Revert button to restore the last snapshot

- **Internationalization (i18n)**
  - English support
  - Spanish support
  - Auto-detection based on VS Code language

- **Medical Disclaimer**
  - Clear notice that this extension is not a substitute for professional eye care
  - Recommendation to consult an optometrist for persistent visual discomfort

- **Modern UI**
  - Clean, accessible interface built for VS Code Webviews
  - Theme-aware styling using VS Code CSS variables
  - Consistent borders, spacing, and focus states
  - Responsive layout

### Technical

- TypeScript-based implementation
- Webview panel with Content Security Policy (CSP)
- Debounced setting updates for responsiveness
- Snapshot-based settings management (backup/restore)

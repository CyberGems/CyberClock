; CyberClock — NSIS installer hooks
; Adds a "Start with Windows" option page (checked by default) and keeps
; the HKCU Run entry in sync with it. The registry value name and command
; mirror exactly what the app's set_startup writes (Settings > General >
; Start with Windows), so the installer and the app manage the SAME
; entry instead of creating duplicates.

!ifndef CC_STARTUP_NSH
!define CC_STARTUP_NSH

!include LogicLib.nsh
!include nsDialogs.nsh

; --- Option state ---
; NSIS variables initialize to 0. $CcStartupUserSet is only flipped to 1
; when the option page is shown and the user leaves it, so silent and
; passive installs (where the page is skipped) fall through to the
; default: startup ON, matching the app's own default.
Var CcStartupChecked
Var CcStartupUserSet
Var CcStartupCheckbox

; Custom page: this hook file is included before the MUI page
; declarations, so a Page declared here is the first one the user sees —
; a simple startup option reads naturally right after the welcome
; wizard starts, and passive/silent installs skip it entirely.
; NOTE: $PassiveMode is declared by the template AFTER this include, so
; the page detects passive mode itself from the command line (/P), the
; same way the template's .onInit does.
Function CcStartupPageCreate
  ${If} ${Silent}
    Abort
  ${EndIf}
  ${GetOptions} $CMDLINE "/P" $R0
  ${IfNot} ${Errors}
    Abort
  ${EndIf}

  !insertmacro MUI_HEADER_TEXT "Startup" "Choose startup options"

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateCheckbox} 0 20u 100% 12u "Start $(^NameDA) automatically when Windows starts"
  Pop $CcStartupCheckbox
  ; Default ON — matches the app's default (start_with_windows: true)
  ${NSD_SetState} $CcStartupCheckbox ${BST_CHECKED}

  ${NSD_CreateLabel} 0 42u 100% 24u "You can change this anytime in the app's Settings (General), or from the tray menu."
  Pop $1

  nsDialogs::Show
FunctionEnd

Function CcStartupPageLeave
  ${NSD_GetState} $CcStartupCheckbox $CcStartupChecked
  StrCpy $CcStartupUserSet 1
FunctionEnd

Page custom CcStartupPageCreate CcStartupPageLeave

; Apply the choice once files are in place. Same value name and command
; shape as the app's own registration. When the page was skipped
; (silent/passive install), default to registering startup.
!macro NSIS_HOOK_POSTINSTALL
  ${If} $CcStartupUserSet = 1
  ${AndIf} $CcStartupChecked <> ${BST_CHECKED}
    DeleteRegValue HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Run" "CyberClock"
  ${Else}
    WriteRegStr HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Run" "CyberClock" '"$INSTDIR\${MAINBINARYNAME}.exe" --startup'
  ${EndIf}
!macroend

; The uninstaller never leaves a Run entry behind.
!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegValue HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Run" "CyberClock"
!macroend

!endif ; CC_STARTUP_NSH

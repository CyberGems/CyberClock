; CyberClock — NSIS installer hooks
;
; Adds a "Start with Windows" checkbox to the installer's Finish page, right
; next to the "Create desktop shortcut" and "Run CyberClock" checkboxes, and
; keeps the HKCU Run entry in sync with it. The registry value name and the
; command mirror exactly what the app's set_startup writes (Settings > General
; > Start with Windows), so the installer and the app manage the SAME entry
; instead of creating duplicates.
;
; The Finish page is the last screen of the wizard, so the Welcome page stays
; first. Tauri includes this file *before* the MUI page declarations, so a
; `Page custom` declared here would become the very first screen of the
; wizard. MUI does not offer a way to add controls to the Finish page either,
; so the checkbox is registered through the page's custom SHOW/LEAVE
; callbacks; see the vendored template (nsis/installer.nsi) for where those
; callbacks are wired.
;
; The uninstall hooks below also clear the installer's remembered install path
; from both registry hives, so a stale path can never override the install-mode
; choice on a later run.

!ifndef CC_STARTUP_NSH
!define CC_STARTUP_NSH

!include LogicLib.nsh
!include nsDialogs.nsh

; --- Option state ---
; NSIS variables initialize to 0.
; CcStartupDefault  1 = start with Windows by default for this run
; CcStartupState    1 = register the Run entry, 0 = remove it
; CcStartupApplied  1 = the Run entry has already been written
; CcInstalled       1 = the install section ran (installer, not uninstaller)
; CcNoPage          1 = the Finish page was skipped (silent / passive)
; CcPreviousInstall 1 = CyberClock was already installed before this run
; CcRunEntryExisted 1 = a Run entry existed before this run
Var CcStartupCheckbox
Var CcStartupDefault
Var CcStartupState
Var CcStartupApplied
Var CcInstalled
Var CcNoPage
Var CcPreviousInstall
Var CcRunEntryExisted
Var CcExePath

; Localized texts. NSIS language IDs: 1033 = English, 1034 = Spanish.
LangString CC_STARTUP_CHECKBOX 1033 "Start $(^NameDA) automatically when Windows starts"
LangString CC_STARTUP_CHECKBOX 1034 "Iniciar $(^NameDA) automáticamente al iniciar Windows"

; --- Finish page checkbox ---
; MUI places the "Run" checkbox at 90u and the "Create desktop shortcut"
; checkbox at 110u, so the new one goes right below them at 130u.
Function CcFinishPageShow
  ${NSD_CreateCheckbox} 120u 130u 195u 10u "$(CC_STARTUP_CHECKBOX)"
  Pop $CcStartupCheckbox

  ${If} $CcStartupDefault = 1
    ${NSD_SetState} $CcStartupCheckbox ${BST_CHECKED}
  ${Else}
    ${NSD_SetState} $CcStartupCheckbox ${BST_UNCHECKED}
  ${EndIf}
FunctionEnd

Function CcFinishPageLeave
  ${NSD_GetState} $CcStartupCheckbox $CcStartupState
  Call CcApplyStartup
FunctionEnd

; Writes (or removes) the HKCU Run entry. The value name and the command
; shape are the same as the app's own registration, so both agree.
Function CcApplyStartup
  StrCpy $CcStartupApplied 1
  ${If} $CcStartupState = 1
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CyberClock" '"$CcExePath" --startup'
  ${Else}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CyberClock"
  ${EndIf}
FunctionEnd

; --- Install / uninstall hooks ---

; Capture the state before the installer touches the registry, so an update
; never overrides a choice the user made inside the app.
!macro NSIS_HOOK_PREINSTALL
  ReadRegStr $R0 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\CyberClock" "DisplayVersion"
  ${If} $R0 != ""
    StrCpy $CcPreviousInstall 1
  ${EndIf}

  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CyberClock"
  ${If} $R0 != ""
    StrCpy $CcRunEntryExisted 1
  ${EndIf}

  StrCpy $CcExePath "$INSTDIR\${MAINBINARYNAME}.exe"
  StrCpy $CcInstalled 1

  ; A fresh install starts with Windows (the app's own default); an update
  ; keeps whatever the user already had.
  ${If} $CcPreviousInstall = 1
    StrCpy $CcStartupDefault $CcRunEntryExisted
  ${Else}
    StrCpy $CcStartupDefault 1
  ${EndIf}
!macroend

; The Finish page is skipped on silent and passive installs (the in-app
; updater runs the installer with /P), so the default is applied there. In
; interactive installs the user's choice is applied when the Finish page is
; left.
!macro NSIS_HOOK_POSTINSTALL
  ${If} ${Silent}
    StrCpy $CcNoPage 1
  ${EndIf}

  ClearErrors
  ${GetOptions} $CMDLINE "/P" $R0
  ${IfNot} ${Errors}
    StrCpy $CcNoPage 1
  ${EndIf}

  ${If} $CcNoPage = 1
    StrCpy $CcStartupState $CcStartupDefault
    Call CcApplyStartup
  ${EndIf}
!macroend

; If the wizard is closed without pressing Finish, the choice is never
; applied, so fall back to the state of the checkbox (it may still be alive
; here) or to the default. The uninstaller shares this script, hence the
; CcInstalled guard.
Function .onGUIEnd
  ${If} $CcInstalled = 1
  ${AndIf} $CcStartupApplied = 0
    System::Call 'user32::IsWindow(i $CcStartupCheckbox) i.r0'
    ${If} $r0 == 0
      StrCpy $CcStartupState $CcStartupDefault
    ${Else}
      ${NSD_GetState} $CcStartupCheckbox $CcStartupState
    ${EndIf}
    Call CcApplyStartup
  ${EndIf}
FunctionEnd

; The uninstaller never leaves a Run entry behind.
!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CyberClock"
!macroend

; The installer remembers the last install path as the default value of
; ${MANUPRODUCTKEY} so a reinstall lands in the same folder, and the vendored
; template clears that value only under the uninstaller's own shell context
; (SHCTX). A leftover in the other hive then overrides the install-mode choice
; on every later run, which is why "only for me" could still be forced to
; Program Files. Clear the remembered path in both hives; the /ifempty pass
; drops the key only when nothing else remains in it.
!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegValue HKLM "${MANUPRODUCTKEY}" ""
  DeleteRegValue HKCU "${MANUPRODUCTKEY}" ""
  DeleteRegKey /ifempty HKLM "${MANUPRODUCTKEY}"
  DeleteRegKey /ifempty HKCU "${MANUPRODUCTKEY}"
!macroend

!endif ; CC_STARTUP_NSH

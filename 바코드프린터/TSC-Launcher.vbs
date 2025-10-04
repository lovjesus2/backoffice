' Get current script directory
Dim scriptDir
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' Change to script directory and run PowerShell
Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = scriptDir
objShell.Run "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & scriptDir & "\TSC-Tray.ps1""", 0, False
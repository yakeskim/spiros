Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\jrbay\Documents\claude sandbox\spiros"
WshShell.Run """C:\Users\jrbay\Documents\claude sandbox\spiros\node_modules\electron\dist\electron.exe"" app", 0, False

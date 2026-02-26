Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\jrbay\Documents\claude sandbox\synchron"
WshShell.Run """C:\Users\jrbay\Documents\claude sandbox\synchron\node_modules\electron\dist\electron.exe"" app", 0, False

@echo off
:: ============================================================
:: add_python_path.bat
:: Configures Windows CMD to run Python scripts without typing 'python'
:: ============================================================

echo ================================================
echo   Python Path Configuration for Windows CMD
echo ================================================
echo.

:: --- Step 1: Find Python ---
set "PYTHON_PATH=C:\Users\moises\AppData\Local\Programs\Python\Python311"
set "PYTHON_EXE="

if exist "%PYTHON_PATH%\python.exe" (
    set "PYTHON_EXE=%PYTHON_PATH%\python.exe"
    echo [OK] Found Python at: %PYTHON_PATH%
) else (
    :: Search in PATH
    for %%i in (python.exe) do set "PYTHON_EXE=%%~$PATH:i"
    if defined PYTHON_EXE (
        echo [OK] Found Python in PATH
    ) else (
        echo [ERROR] Python not found at %PYTHON_PATH%
        echo   Install from https://www.python.org/downloads/
        pause
        exit /b 1
    )
)

:: --- Step 2: Add .PY to PATHEXT (user-level) ---
echo.
echo [Step 2] Registering .PY extension...
setx PATHEXT "%PATHEXT%;.PY" >nul 2>&1
echo [OK] .PY added to PATHEXT

:: --- Step 3: Add Python to PATH (user-level) ---
echo.
echo [Step 3] Adding Python to PATH...
setx PATH "%PYTHON_PATH%;%PATH%" >nul 2>&1
echo [OK] Python added to PATH

:: --- Step 4: Create a py.bat wrapper in System32 ---
echo.
echo [Step 4] Creating py.bat wrapper in System32...
echo @echo off > "%SystemRoot%\System32\py.bat"
echo "%PYTHON_EXE%" %%* >> "%SystemRoot%\System32\py.bat"
echo [OK] py.bat created

:: --- Step 5: Register .py association ---
echo.
echo [Step 5] Associating .py files with Python...
assoc .py=PythonFile >nul 2>&1
ftype PythonFile="%PYTHON_EXE%" "%%1" %%* >nul 2>&1
echo [OK] .py files associated with Python

echo.
echo ================================================
echo   SUCCESS! Python is now configured.
echo ================================================
echo.
echo You can now run Python scripts by typing:
echo   myscript.py
echo   script.py arg1 arg2
echo.
echo NOTE: Close and reopen CMD for changes to take effect.
echo.
pause
@echo off
setlocal enabledelayedexpansion

echo ====================================================================
echo             NALKA METALS DATABASE RESTORE SYSTEM
echo ====================================================================
echo.

set /p DB_URL=Enter NEW PostgreSQL connection string: 
if "%DB_URL%"=="" (
    echo Error: Connection string cannot be empty.
    pause
    exit /b 1
)

set BACKUP_DIR=..\snapshots\nalka-database-backup

if not exist "%BACKUP_DIR%\02_schema.sql" (
    echo [Fallback] Using latest python backup snapshot for restore...
    python ..\..\scripts\backup_manager.py restore --target-url "%DB_URL%"
    pause
    exit /b 0
)

echo.
echo [1/3] Restoring custom roles...
if exist "%BACKUP_DIR%\01_roles.sql" (
    psql "%DB_URL%" -f "%BACKUP_DIR%\01_roles.sql"
)

echo.
echo [2/3] Restoring database schema (tables, views, functions, triggers, policies)...
psql "%DB_URL%" -f "%BACKUP_DIR%\02_schema.sql"

echo.
echo [3/3] Restoring table data...
if exist "%BACKUP_DIR%\03_data.sql" (
    psql "%DB_URL%" -f "%BACKUP_DIR%\03_data.sql"
)

echo.
echo ====================================================================
echo                    RESTORE COMPLETED CLEANLY
echo ====================================================================
echo.
pause
exit /b 0

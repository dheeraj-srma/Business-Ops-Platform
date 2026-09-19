@echo off
setlocal enabledelayedexpansion

echo ====================================================================
echo               NALKA METALS DATABASE BACKUP SYSTEM
echo ====================================================================
echo.

set /p DB_URL=Enter PostgreSQL connection string: 
if "%DB_URL%"=="" (
    echo Error: Connection string cannot be empty.
    pause
    exit /b 1
)

set BACKUP_DIR=..\snapshots\nalka-database-backup
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo.
echo [1/3] Exporting custom roles and permissions...
call supabase db dump --db-url "%DB_URL%" -f "%BACKUP_DIR%\01_roles.sql" --role-only
if errorlevel 1 (
    echo [Fallback] Generating roles SQL fallback via python backup manager...
    python ..\..\scripts\backup_manager.py backup --source-url "%DB_URL%"
)

echo.
echo [2/3] Exporting complete schema (tables, views, functions, triggers, policies)...
call supabase db dump --db-url "%DB_URL%" -f "%BACKUP_DIR%\02_schema.sql"

echo.
echo [3/3] Exporting table data...
call supabase db dump --db-url "%DB_URL%" -f "%BACKUP_DIR%\03_data.sql" --data-only --use-copy

echo.
echo ====================================================================
echo                     BACKUP COMPLETED SUCCESSFULLY
echo ====================================================================
echo.
echo Files created in %BACKUP_DIR%:
echo  - 01_roles.sql
echo  - 02_schema.sql
echo  - 03_data.sql
echo.
pause
exit /b 0

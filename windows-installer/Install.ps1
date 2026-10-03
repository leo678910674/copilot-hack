param(
    [switch]$VerifyOnly,
    [string]$InstallDirectory,
    [string]$ShortcutDirectory,
    [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"
$payload = @(
    "index.html",
    "styles.css",
    "app.js",
    "sw.js",
    "manifest.webmanifest",
    "icon.svg",
    "icon-maskable.svg",
    "icons\icon-192.png",
    "icons\icon-512.png",
    "icons\icon-maskable-512.png",
    "Launch.ps1"
)

foreach ($file in $payload) {
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $file) -PathType Leaf)) {
        throw "Installer package is missing $file."
    }
}

if ($VerifyOnly) {
    Write-Output "All installer payload files are present."
    exit 0
}

if ([string]::IsNullOrWhiteSpace($InstallDirectory)) {
    $InstallDirectory = if ($env:MANMANLAI_INSTALL_DIR) { $env:MANMANLAI_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "Programs\Manmanlai" }
}
if ([string]::IsNullOrWhiteSpace($ShortcutDirectory)) {
    $ShortcutDirectory = if ($env:MANMANLAI_SHORTCUT_DIR) { $env:MANMANLAI_SHORTCUT_DIR } else { Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs" }
}
$desktopDirectory = if ($env:MANMANLAI_DESKTOP_DIR) { $env:MANMANLAI_DESKTOP_DIR } else { [Environment]::GetFolderPath("Desktop") }
$noLaunch = $NoLaunch -or $env:MANMANLAI_NO_LAUNCH -eq "1"

try {
    New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $InstallDirectory "icons") -Force | Out-Null
    New-Item -ItemType Directory -Path $ShortcutDirectory -Force | Out-Null
    New-Item -ItemType Directory -Path $desktopDirectory -Force | Out-Null

    foreach ($file in $payload) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $InstallDirectory $file) -Force
    }

    $powershell = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
    $shell = New-Object -ComObject WScript.Shell
    $shortcutFolders = @($ShortcutDirectory, $desktopDirectory) | Select-Object -Unique
    foreach ($folder in $shortcutFolders) {
        $shortcut = $shell.CreateShortcut((Join-Path $folder "慢慢来.lnk"))
        $shortcut.TargetPath = $powershell
        $shortcut.Arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$InstallDirectory\Launch.ps1`""
        $shortcut.WorkingDirectory = $InstallDirectory
        $shortcut.Description = "慢慢来 · 学习生活工作台"
        $shortcut.Save()
    }

    if (-not $noLaunch) {
        $launchArguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$InstallDirectory\Launch.ps1`""
        Start-Process -FilePath $powershell -ArgumentList $launchArguments
    }
    Write-Output "慢慢来已安装到 $InstallDirectory"
    if (-not $env:MANMANLAI_NO_SUCCESS_DIALOG) {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show(
            "安装完成。可从桌面或开始菜单打开慢慢来。",
            "慢慢来安装程序",
            "OK",
            "Information"
        ) | Out-Null
    }
} catch {
    $message = "安装失败：$($_.Exception.Message)"
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show($message, "慢慢来安装程序", "OK", "Error") | Out-Null
    } catch {
        Write-Error $message
    }
    exit 1
}

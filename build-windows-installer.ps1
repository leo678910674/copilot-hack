$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$outputDirectory = Join-Path $root "dist"
$output = Join-Path $outputDirectory "manmanlai-windows-installer.exe"
$work = Join-Path $env:TEMP ("ManmanlaiBuild-" + [Guid]::NewGuid().ToString("N"))
$bootstrapper = Join-Path $root "windows-installer\Bootstrapper.cs"
$stub = Join-Path $work "ManmanlaiBootstrapper.exe"

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $work -Force | Out-Null

try {
    Add-Type -TypeDefinition (Get-Content -LiteralPath $bootstrapper -Raw -Encoding UTF8) `
        -Language CSharp `
        -OutputType WindowsApplication `
        -OutputAssembly $stub `
        -ReferencedAssemblies @("System.dll", "System.Windows.Forms.dll")

    $files = @(
        @{ Package = "index.html"; Source = "index.html" },
        @{ Package = "styles.css"; Source = "styles.css" },
        @{ Package = "app.js"; Source = "app.js" },
        @{ Package = "sw.js"; Source = "sw.js" },
        @{ Package = "manifest.webmanifest"; Source = "manifest.webmanifest" },
        @{ Package = "icon.svg"; Source = "icon.svg" },
        @{ Package = "icon-maskable.svg"; Source = "icon-maskable.svg" },
        @{ Package = "icons/icon-192.png"; Source = "icons\icon-192.png" },
        @{ Package = "icons/icon-512.png"; Source = "icons\icon-512.png" },
        @{ Package = "icons/icon-maskable-512.png"; Source = "icons\icon-maskable-512.png" },
        @{ Package = "Launch.ps1"; Source = "Launch.ps1" },
        @{ Package = "Install.ps1"; Source = "windows-installer\Install.ps1" }
    )
    $payloadStream = [IO.MemoryStream]::new()
    $writer = [IO.BinaryWriter]::new($payloadStream, [Text.Encoding]::UTF8, $true)
    $writer.Write([int]$files.Count)
    foreach ($file in $files) {
        $nameBytes = [Text.Encoding]::UTF8.GetBytes($file.Package)
        $sourcePath = Join-Path $root $file.Source
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "Required installer file is missing: $sourcePath"
        }
        $content = [IO.File]::ReadAllBytes($sourcePath)
        if ($file.Package -eq "Install.ps1") {
            $scriptText = [Text.Encoding]::UTF8.GetString($content)
            $encoding = [Text.UTF8Encoding]::new($false)
            $scriptBytes = $encoding.GetBytes($scriptText)
            $preamble = [Text.UTF8Encoding]::new($true).GetPreamble()
            $withPreamble = [byte[]]::new($preamble.Length + $scriptBytes.Length)
            [Array]::Copy($preamble, 0, $withPreamble, 0, $preamble.Length)
            [Array]::Copy($scriptBytes, 0, $withPreamble, $preamble.Length, $scriptBytes.Length)
            $content = $withPreamble
        }
        $writer.Write([int]$nameBytes.Length)
        $writer.Write($nameBytes)
        $writer.Write([long]$content.Length)
        $writer.Write($content)
    }
    $writer.Flush()
    $payload = $payloadStream.ToArray()
    $payloadStream.Dispose()

    $outputStream = [IO.File]::Open($output, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $stubBytes = [IO.File]::ReadAllBytes($stub)
        $outputStream.Write($stubBytes, 0, $stubBytes.Length)
        $outputStream.Write($payload, 0, $payload.Length)
        $lengthBytes = [BitConverter]::GetBytes([long]$payload.Length)
        $outputStream.Write($lengthBytes, 0, $lengthBytes.Length)
        $magic = [Text.Encoding]::ASCII.GetBytes("MANMANLAISETUP1")
        $outputStream.Write($magic, 0, $magic.Length)
    } finally {
        $outputStream.Dispose()
    }
} finally {
    if (Test-Path -LiteralPath $work) {
        Remove-Item -LiteralPath $work -Recurse -Force
    }
}

Write-Output "Created $output"

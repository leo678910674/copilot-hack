param(
    [int]$Port = 8765,
    [switch]$NoOpen
)

$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$listener = [Net.HttpListener]::new()
$started = $false

for ($candidate = $Port; $candidate -lt $Port + 20; $candidate++) {
    $listener.Prefixes.Clear()
    $listener.Prefixes.Add("http://127.0.0.1:$candidate/")
    try {
        $listener.Start()
        $port = $candidate
        $started = $true
        break
    } catch [Net.HttpListenerException] {
        continue
    }
}

if (-not $started) {
    throw "Unable to bind any local port in the range $Port to $($Port + 19). Close the application using one of those ports and try again."
}

$basePath = $root.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$baseUri = "http://127.0.0.1:$port/"
Write-Host "The application is running at $baseUri" -ForegroundColor Green
Write-Host "Close this window to stop the server. App data remains in your browser." -ForegroundColor DarkGray
if (-not $NoOpen) {
    Start-Process $baseUri
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            if ($context.Request.HttpMethod -notin @("GET", "HEAD")) {
                $context.Response.StatusCode = 405
                continue
            }

            $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
            if ([string]::IsNullOrWhiteSpace($relativePath)) {
                $relativePath = "index.html"
            }

            $filePath = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $relativePath))
            if (-not $filePath.StartsWith($basePath, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
                $context.Response.StatusCode = 404
                continue
            }

            $context.Response.ContentType = switch ([IO.Path]::GetExtension($filePath).ToLowerInvariant()) {
                ".html" { "text/html; charset=utf-8" }
                ".css" { "text/css; charset=utf-8" }
                ".js" { "text/javascript; charset=utf-8" }
                ".webmanifest" { "application/manifest+json; charset=utf-8" }
                ".svg" { "image/svg+xml" }
                ".png" { "image/png" }
                default { "application/octet-stream" }
            }
            $context.Response.Headers["Cache-Control"] = "no-cache"
            $context.Response.Headers["X-Content-Type-Options"] = "nosniff"
            $bytes = [IO.File]::ReadAllBytes($filePath)
            $context.Response.ContentLength64 = $bytes.Length
            if ($context.Request.HttpMethod -ne "HEAD") {
                $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } catch {
            Write-Warning "Unable to serve this request: $($_.Exception.Message)"
            $context.Response.StatusCode = 500
        } finally {
            $context.Response.Close()
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}

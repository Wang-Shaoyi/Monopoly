param([switch]$AvailableOnly)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$originalRoot = Join-Path $PSScriptRoot 'originals'
$assetRoot = Join-Path $projectRoot 'client/src/assets/board-icons'
$manifest = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'production-manifest.json') | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $originalRoot, $assetRoot | Out-Null
$prepared = 0
$missing = @()
foreach ($iconRecord in $manifest.records) {
  $originalPath = Join-Path $originalRoot ($iconRecord.key + '.png')
  if ($iconRecord.reuse) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $iconRecord.reuse) -Destination $originalPath
  }
  if (-not (Test-Path -LiteralPath $originalPath)) {
    $missing += $iconRecord.key
    continue
  }
  # Only resize for delivery. Preserve the generated artwork and alpha unchanged in originals/.
  $sourceImage = [System.Drawing.Image]::FromFile($originalPath)
  $targetImage = [System.Drawing.Bitmap]::new(256, 256, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $drawing = [System.Drawing.Graphics]::FromImage($targetImage)
  try {
    $drawing.Clear([System.Drawing.Color]::Transparent)
    $drawing.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $drawing.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $drawing.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $edge = 256
    $iconWidth = [int][Math]::Round($sourceImage.Width * [Math]::Min($edge / $sourceImage.Width, $edge / $sourceImage.Height))
    $iconHeight = [int][Math]::Round($sourceImage.Height * [Math]::Min($edge / $sourceImage.Width, $edge / $sourceImage.Height))
    $drawing.DrawImage($sourceImage, [System.Drawing.Rectangle]::new([int](($edge - $iconWidth) / 2), [int](($edge - $iconHeight) / 2), $iconWidth, $iconHeight))
    $targetImage.Save((Join-Path $assetRoot ($iconRecord.key + '.png')), [System.Drawing.Imaging.ImageFormat]::Png)
    $prepared++
  } finally {
    $drawing.Dispose()
    $targetImage.Dispose()
    $sourceImage.Dispose()
  }
}
Write-Output "Prepared $prepared / $($manifest.records.Count) transparent 256px production icons."
if ($missing.Count -gt 0 -and -not $AvailableOnly) { throw "Missing icons: $($missing -join ', ')" }

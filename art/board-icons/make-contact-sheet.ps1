$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$manifest = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'production-manifest.json') | ConvertFrom-Json
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$records = @($manifest.records)
$columns = 8
$cellWidth = 150
$cellHeight = 152
$rows = [int][Math]::Ceiling($records.Count / $columns)
$sheet = [System.Drawing.Bitmap]::new($columns * $cellWidth, $rows * $cellHeight)
$canvas = [System.Drawing.Graphics]::FromImage($sheet)
$font = [System.Drawing.Font]::new('Microsoft YaHei', 9)
$smallFont = [System.Drawing.Font]::new('Microsoft YaHei', 7)
$textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#443a32'))
try {
  $canvas.Clear([System.Drawing.ColorTranslator]::FromHtml('#f6f1e6'))
  $canvas.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  for ($index = 0; $index -lt $records.Count; $index++) {
    $record = $records[$index]
    $x = ($index % $columns) * $cellWidth
    $y = [int][Math]::Floor($index / $columns) * $cellHeight
    $iconPath = Join-Path $projectRoot ('client/src/assets/board-icons/' + $record.key + '.png')
    if (Test-Path -LiteralPath $iconPath) {
      $icon = [System.Drawing.Image]::FromFile($iconPath)
      try { $canvas.DrawImage($icon, [System.Drawing.Rectangle]::new($x + 27, $y + 5, 96, 96)) }
      finally { $icon.Dispose() }
    }
    $canvas.DrawString($record.label, $font, $textBrush, $x + 8, $y + 104)
    $canvas.DrawString($record.motif, $smallFont, $textBrush, $x + 8, $y + 125)
  }
  $sheet.Save((Join-Path $PSScriptRoot 'contact-sheet.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $canvas.Dispose(); $sheet.Dispose(); $font.Dispose(); $smallFont.Dispose(); $textBrush.Dispose()
}

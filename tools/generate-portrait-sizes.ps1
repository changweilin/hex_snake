param(
  [string]$SourceDir = "assets/portraits",
  [int]$SmallWidth = 512,
  [int]$MediumWidth = 1024
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path $SourceDir
$targets = @(
  @{ Name = "sm"; Width = $SmallWidth },
  @{ Name = "md"; Width = $MediumWidth }
)

foreach ($target in $targets) {
  $dir = Join-Path $root.Path $target.Name
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

Get-ChildItem -Path $root.Path -Filter "*.png" -File | ForEach-Object {
  $sourcePath = $_.FullName
  $image = [System.Drawing.Image]::FromFile($sourcePath)

  try {
    foreach ($target in $targets) {
      $targetWidth = [Math]::Min($target.Width, $image.Width)
      $targetHeight = [Math]::Max(1, [int][Math]::Round($image.Height * ($targetWidth / $image.Width)))
      $outPath = Join-Path (Join-Path $root.Path $target.Name) $_.Name

      $bitmap = [System.Drawing.Bitmap]::new($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

      try {
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($image, 0, 0, $targetWidth, $targetHeight)
        $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
      }
    }
  } finally {
    $image.Dispose()
  }
}

Write-Host "Generated portrait sizes in $($root.Path)"

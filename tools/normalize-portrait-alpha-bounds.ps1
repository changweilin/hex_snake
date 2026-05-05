param(
  [string]$SourceDir = "assets/portraits",
  [double]$TargetOccupancy = 0.86,
  [int]$AlphaThreshold = 8,
  [switch]$ReportOnly
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path $SourceDir
$fullFiles = Get-ChildItem -Path $root.Path -Filter "*.png" -File | Sort-Object Name

function Get-AlphaBounds {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [int]$Threshold
  )

  $rect = [System.Drawing.Rectangle]::new(0, 0, $Bitmap.Width, $Bitmap.Height)
  $lockedBitmap = $Bitmap
  if ($Bitmap.PixelFormat -ne [System.Drawing.Imaging.PixelFormat]::Format32bppArgb) {
    $lockedBitmap = $Bitmap.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  }

  $minX = $Bitmap.Width
  $minY = $Bitmap.Height
  $maxX = -1
  $maxY = -1
  $count = 0

  $data = $lockedBitmap.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $stride = [math]::Abs($data.Stride)
    $bytes = New-Object byte[] ($stride * $lockedBitmap.Height)
    [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)

    for ($y = 0; $y -lt $lockedBitmap.Height; $y++) {
      $row = $y * $stride
      for ($x = 0; $x -lt $lockedBitmap.Width; $x++) {
        $alpha = $bytes[$row + ($x * 4) + 3]
        if ($alpha -gt $Threshold) {
          if ($x -lt $minX) { $minX = $x }
          if ($y -lt $minY) { $minY = $y }
          if ($x -gt $maxX) { $maxX = $x }
          if ($y -gt $maxY) { $maxY = $y }
          $count += 1
        }
      }
    }
  } finally {
    $lockedBitmap.UnlockBits($data)
    if (-not [object]::ReferenceEquals($lockedBitmap, $Bitmap)) {
      $lockedBitmap.Dispose()
    }
  }

  if ($maxX -lt 0) { return $null }

  [pscustomobject]@{
    MinX = $minX
    MinY = $minY
    MaxX = $maxX
    MaxY = $maxY
    Width = $maxX - $minX + 1
    Height = $maxY - $minY + 1
    CenterX = ($minX + $maxX) / 2.0
    CenterY = ($minY + $maxY) / 2.0
    Pixels = $count
  }
}

function Measure-Portrait {
  param(
    [string]$Path,
    [int]$Threshold
  )

  $bitmap = [System.Drawing.Bitmap]::new($Path)
  try {
    $bounds = Get-AlphaBounds -Bitmap $bitmap -Threshold $Threshold
    if ($null -eq $bounds) {
      return [pscustomobject]@{
        File = Split-Path $Path -Leaf
        Image = "$($bitmap.Width)x$($bitmap.Height)"
        VisibleBox = "none"
        BoxWidthPct = 0
        BoxHeightPct = 0
        OpaquePixelPct = 0
      }
    }

    [pscustomobject]@{
      File = Split-Path $Path -Leaf
      Image = "$($bitmap.Width)x$($bitmap.Height)"
      VisibleBox = "$($bounds.Width)x$($bounds.Height)"
      BoxWidthPct = [math]::Round($bounds.Width / $bitmap.Width * 100, 1)
      BoxHeightPct = [math]::Round($bounds.Height / $bitmap.Height * 100, 1)
      LeftPadPct = [math]::Round($bounds.MinX / $bitmap.Width * 100, 1)
      RightPadPct = [math]::Round(($bitmap.Width - $bounds.MaxX - 1) / $bitmap.Width * 100, 1)
      TopPadPct = [math]::Round($bounds.MinY / $bitmap.Height * 100, 1)
      BottomPadPct = [math]::Round(($bitmap.Height - $bounds.MaxY - 1) / $bitmap.Height * 100, 1)
      OpaquePixelPct = [math]::Round($bounds.Pixels / ($bitmap.Width * $bitmap.Height) * 100, 1)
    }
  } finally {
    $bitmap.Dispose()
  }
}

function Normalize-Portrait {
  param(
    [string]$Path,
    [double]$Target,
    [int]$Threshold
  )

  $tempPath = "$Path.tmp.png"
  if (Test-Path -LiteralPath $tempPath) {
    Remove-Item -LiteralPath $tempPath -Force
  }

  $source = [System.Drawing.Bitmap]::new($Path)
  try {
    $bounds = Get-AlphaBounds -Bitmap $source -Threshold $Threshold
    if ($null -eq $bounds) { return }

    $targetWidth = $source.Width * $Target
    $targetHeight = $source.Height * $Target
    $scale = [math]::Min($targetWidth / $bounds.Width, $targetHeight / $bounds.Height)
    $drawWidth = $source.Width * $scale
    $drawHeight = $source.Height * $scale
    $drawX = ($source.Width / 2.0) - ($bounds.CenterX * $scale)
    $drawY = ($source.Height / 2.0) - ($bounds.CenterY * $scale)

    $canvas = [System.Drawing.Bitmap]::new($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)

    try {
      $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.Clear([System.Drawing.Color]::Transparent)

      $dest = [System.Drawing.RectangleF]::new([single]$drawX, [single]$drawY, [single]$drawWidth, [single]$drawHeight)
      $graphics.DrawImage($source, $dest)

      $canvas.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose()
      $canvas.Dispose()
    }
  } finally {
    $source.Dispose()
  }

  Move-Item -LiteralPath $tempPath -Destination $Path -Force
}

$before = foreach ($file in $fullFiles) {
  Measure-Portrait -Path $file.FullName -Threshold $AlphaThreshold
}

if (-not $ReportOnly) {
  foreach ($file in $fullFiles) {
    Normalize-Portrait -Path $file.FullName -Target $TargetOccupancy -Threshold $AlphaThreshold
  }

  & (Join-Path $PSScriptRoot "generate-portrait-sizes.ps1") -SourceDir $SourceDir | Out-Host
}

$after = foreach ($file in $fullFiles) {
  Measure-Portrait -Path $file.FullName -Threshold $AlphaThreshold
}

[pscustomobject]@{
  TargetOccupancy = $TargetOccupancy
  Before = $before
  After = $after
}

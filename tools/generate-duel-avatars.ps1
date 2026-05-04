param(
  [string]$SourceDir = "assets/portraits",
  [string]$OutputDir = "assets/portraits/avatars",
  [int]$AlphaThreshold = 8
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path "."
$portraitRoot = Resolve-Path $SourceDir
$characters = Get-ChildItem -Path $portraitRoot.Path -Filter "*_chibi.png" -File |
  Sort-Object Name |
  ForEach-Object {
    $slug = $_.BaseName -replace "_chibi$", ""
    [pscustomobject]@{
      Id = switch ($slug) {
        "white_dragon" { "dragon"; break }
        "quetzalcoatl" { "quetzal"; break }
        "moray_eel" { "moray"; break }
        "ghost_lobster" { "lobster"; break }
        default { $slug }
      }
      Slug = $slug
    }
  }
$sizes = @(
  @{ Name = "sm"; Size = 384 },
  @{ Name = "md"; Size = 768 },
  @{ Name = "full"; Size = 1024 }
)

$variants = @(
  @{
    Name = "chibi"
    Library = "portraits"
    FocusY = 0.32
    SideByWidth = 0.82
    SideByHeight = 0.52
    ShiftX = 0.0
  },
  @{
    Name = "beast"
    Library = "archivedPortraits"
    FocusY = 0.34
    SideByWidth = 0.68
    SideByHeight = 0.46
    ShiftX = 0.0
  },
  @{
    Name = "human"
    Library = "humanPortraits"
    FocusY = 0.14
    SideByWidth = 0.34
    SideByHeight = 0.18
    ShiftX = 0.0
  }
)

$characterOverrides = @{
  "lobster:human" = @{ FocusY = 0.14; ShiftX = -0.06; SideByWidth = 0.34; SideByHeight = 0.18; MoveRadiusX = -0.3 }
  "gu_king:human" = @{ FocusY = 0.13; ShiftX = -0.12; SideByWidth = 0.306; SideByHeight = 0.171; MoveRadiusX = -0.6; MoveRadiusY = 0.3 }
  "moray:human" = @{ FocusY = 0.12; ShiftX = 0.06; SideByWidth = 0.35; SideByHeight = 0.18; MoveRadiusX = 0.25; MoveRadiusY = 0.4 }
  "quetzal:human" = @{ FocusY = 0.26; ShiftX = -0.02; SideByWidth = 0.36; SideByHeight = 0.19; MoveRadiusX = -0.3; MoveRadiusY = 0.5 }
  "dragon:human" = @{ FocusY = 0.13; ShiftX = 0.01; SideByWidth = 0.34; SideByHeight = 0.18; MoveRadiusX = 0.2 }
  "sandworm:human" = @{ FocusY = 0.11; ShiftX = 0.02; SideByWidth = 0.289; SideByHeight = 0.153; MoveRadiusX = 0.15; MoveRadiusY = 0.2 }
}

function Resolve-AssetPath {
  param([string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path)) { return $null }
  $candidate = Join-Path $root.Path $Path
  if (Test-Path -LiteralPath $candidate) { return (Resolve-Path $candidate).Path }
  return $null
}

function Get-PortraitPath {
  param($Character, $Variant)

  $slug = $Character.Slug
  $relativePath = switch ($Variant.Name) {
    "chibi" { "assets/portraits/$($slug)_chibi.png" }
    "beast" { "assets/portraits/$($slug)_idle.png" }
    "human" { "assets/portraits/human/$($slug)_human.png" }
  }

  $resolved = Resolve-AssetPath $relativePath
  if ($null -ne $resolved) { return $resolved }

  if ($Variant.Name -eq "beast") {
    return Resolve-AssetPath "assets/portraits/$($slug)_intro.png"
  }
  return $null
}

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

  $data = $lockedBitmap.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $stride = [Math]::Abs($data.Stride)
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
  }
}

function Merge-Config {
  param($Base, $Override)
  $merged = @{
    FocusY = $Base.FocusY
    SideByWidth = $Base.SideByWidth
    SideByHeight = $Base.SideByHeight
    ShiftX = $Base.ShiftX
    MoveRadiusX = 0.0
    MoveRadiusY = 0.0
  }
  if ($null -ne $Override) {
    foreach ($key in $Override.Keys) {
      $merged[$key] = $Override[$key]
    }
  }
  return $merged
}

function Save-DuelAvatar {
  param(
    [System.Drawing.Bitmap]$Source,
    $Bounds,
    $Config,
    [int]$OutputSize,
    [string]$OutPath
  )

  $side = [Math]::Max($Bounds.Width * $Config.SideByWidth, $Bounds.Height * $Config.SideByHeight)
  $centerX = ($Bounds.MinX + $Bounds.MaxX) / 2.0 + ($Bounds.Width * $Config.ShiftX) - ($Config.MoveRadiusX * $side / 2.0)
  $centerY = $Bounds.MinY + ($Bounds.Height * $Config.FocusY) - ($Config.MoveRadiusY * $side / 2.0)
  $srcRect = [System.Drawing.RectangleF]::new(
    [single]($centerX - $side / 2.0),
    [single]($centerY - $side / 2.0),
    [single]$side,
    [single]$side
  )

  $bitmap = [System.Drawing.Bitmap]::new($OutputSize, $OutputSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $clip = [System.Drawing.Drawing2D.GraphicsPath]::new()
    try {
      $clip.AddEllipse(0, 0, $OutputSize - 1, $OutputSize - 1)
      $graphics.SetClip($clip)
      $destRect = [System.Drawing.RectangleF]::new(0, 0, $OutputSize, $OutputSize)
      $graphics.DrawImage($Source, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    } finally {
      $clip.Dispose()
    }

    $bitmap.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$generated = 0

foreach ($variant in $variants) {
  foreach ($size in $sizes) {
    New-Item -ItemType Directory -Force -Path (Join-Path (Join-Path $OutputDir $variant.Name) $size.Name) | Out-Null
  }

  foreach ($character in $characters) {
    $slug = $character.Slug
    $sourcePath = Get-PortraitPath -Character $character -Variant $variant
    if ($null -eq $sourcePath) {
      Write-Warning "Skipped $slug $($variant.Name): source portrait not found."
      continue
    }

    $source = [System.Drawing.Bitmap]::new($sourcePath)
    try {
      $bounds = Get-AlphaBounds -Bitmap $source -Threshold $AlphaThreshold
      if ($null -eq $bounds) {
        Write-Warning "Skipped $slug $($variant.Name): no visible pixels."
        continue
      }

      $overrideKey = "$($character.Id):$($variant.Name)"
      $config = Merge-Config -Base $variant -Override $characterOverrides[$overrideKey]

      foreach ($size in $sizes) {
        $outPath = Join-Path (Join-Path (Join-Path $OutputDir $variant.Name) $size.Name) "$($slug)_duel.png"
        Save-DuelAvatar -Source $source -Bounds $bounds -Config $config -OutputSize $size.Size -OutPath $outPath
        $generated += 1
      }
    } finally {
      $source.Dispose()
    }
  }
}

Write-Host "Generated $generated duel avatar files in $OutputDir"


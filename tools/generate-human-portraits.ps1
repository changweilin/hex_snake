param(
  [string]$OutDir = "assets/portraits/human",
  [string]$ImageGenScript = "$env:USERPROFILE\.codex\skills\.system\imagegen\scripts\image_gen.py",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

if (-not $env:OPENAI_API_KEY) {
  throw "OPENAI_API_KEY is not set. Set it locally, then rerun this script."
}

if (-not (Test-Path -LiteralPath $ImageGenScript)) {
  throw "Image generation CLI not found at $ImageGenScript"
}

$outRoot = Resolve-Path -Path "." | Select-Object -ExpandProperty Path
$outPath = Join-Path $outRoot $OutDir
$tmpDir = Join-Path $outRoot "tmp/imagegen"
$promptFile = Join-Path $tmpDir "human-portraits.jsonl"

New-Item -ItemType Directory -Force -Path $outPath | Out-Null
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

$sharedConstraints = @"
Full-body standing character portrait for a game, transparent background, no floor plane, no cast shadow, no text, no logo, no watermark. 1024x1536 vertical composition, subject centered, generous padding, visible silhouette fills about 86% of canvas height, polished ACG game character key art. Strongly reference the named virtual character inspirations through hair, silhouette, outfit language, color mood, and attitude, while integrating them into an original Hex Snake character design.
"@

$jobs = @(
  @{
    out = "white_dragon_human.png"
    prompt = "White Dragon humanized heroine. Main visual reference: Yakushiji Akira / Enoki Films style spirit-warrior youth energy, transformed into a completely feminine shrine maiden. Hair reference: Haku from Spirited Away, but white hair, soft bobbed dragon-spirit hair shape, unmistakably female face and body language. Japanese white miko robe, silver-white and pale blue palette, sacred dragon-god aura, refined wafuu fantasy ACG standing portrait, serene but dangerous, clean divine coldness. $sharedConstraints"
  },
  @{
    out = "gu_king_human.png"
    prompt = "Gu King humanized dark queen. Main visual reference: Boa Hancock from One Piece, mixed with a sinister feminine clown personality. Tall elegant snake-empress silhouette, confident gaze, long dark hair, deep black base costume with ink green and dark crimson interwoven accents. Holding a spiked kanabo club. Around her feet: empty bullet shells, broken sticks, shattered blade fragments, ruined weapons. Dark queen battle ACG key art, poisonous glamour, intimidating and theatrical. $sharedConstraints"
  },
  @{
    out = "ghost_lobster_human.png"
    prompt = "Wise Ghost Lobster humanized martial heroine. Main visual reference blend: Tsunade from Naruto and Mai Shiranui from The King of Fighters. Mature powerful female fighter, red color theme, fiery battle confidence, bare-handed combat pose with clenched fists and no weapon. Red ghost-fire wisps coil around arms and shoulders, hints of spectral lobster-claw motifs in costume ornaments without becoming armor-heavy. Hot-blooded fighting-game ACG key art, athletic, bold, explosive. $sharedConstraints"
  },
  @{
    out = "sandworm_human.png"
    prompt = "Sandworm humanized desert mystic. Main visual reference: Ishizu Ishtar from Yu-Gi-Oh. Mysterious priestess aura, beige and sand-gold clothing, Persian-inspired layers, veils, jewelry, desert occult motifs. Dual-wielding curved scimitars. Calm unreadable expression, ancient prophecy feeling, subtle worm-scale and sand-flow motifs in accessories. Desert mystery fantasy ACG key art, elegant, sacred, dangerous. $sharedConstraints"
  },
  @{
    out = "moray_eel_human.png"
    prompt = "Electric eel humanized school esper. Main visual reference: Mikoto Misaka from A Certain Scientific Railgun, but face shape and gentle bookish beauty lean toward Aya Tojo from Ichigo 100%. Academy sailor uniform, youthful female student silhouette, blue electricity as primary effect with white, blue, and purple lightning crossing around her. Electric eel motifs as small hairpin and sleeve accents, smart and focused expression. School superpower ACG key art, crisp, bright, charged. $sharedConstraints"
  },
  @{
    out = "quetzalcoatl_human.png"
    prompt = "Quetzalcoatl humanized nature spirit girl. Main visual reference: Anu from Chinese Paladin, transformed with Aztec elements and twin tails. Green main palette but richly natural colors, many pink flowers, green leaves, feathers, and brown branches woven through hair and costume. Cheerful mystical forest-priestess energy, feathered serpent motifs, Aztec geometric accessories, colorful natural fantasy ACG key art, lively and sacred. $sharedConstraints"
  }
)

$jobs | ForEach-Object {
  [pscustomobject]@{
    model = "gpt-image-1.5"
    prompt = $_.prompt
    use_case = "stylized-concept"
    style = "ACG game character standing portrait"
    composition = "full-body centered vertical key art with generous transparent padding"
    constraints = "transparent background; no text; no logo; no watermark"
    size = "1024x1536"
    quality = "high"
    background = "transparent"
    output_format = "png"
    out = $_.out
  } | ConvertTo-Json -Compress
} | Set-Content -LiteralPath $promptFile -Encoding UTF8

$args = @(
  $ImageGenScript,
  "generate-batch",
  "--input", $promptFile,
  "--out-dir", $outPath,
  "--concurrency", "2"
)

if ($Force) {
  $args += "--force"
}

python @args

& (Join-Path $PSScriptRoot "normalize-portrait-alpha-bounds.ps1") -SourceDir $OutDir -TargetOccupancy 0.86 | Out-Host

Write-Host "Generated human portraits in $outPath"

$ErrorActionPreference = "Stop"

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$path = Join-Path $root "data\characters.json"

Get-Content -LiteralPath $path -Encoding UTF8

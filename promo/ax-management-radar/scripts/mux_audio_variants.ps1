param(
  [Parameter(Mandatory = $true)] [string] $FfmpegPath,
  [string] $BgmRender = 'out\render-bgm.mp4',
  [string] $SfxOnlyRender = 'out\render-sfx-only.mp4',
  [string] $OutputDirectory = 'out\final'
)

$ErrorActionPreference = 'Stop'
$BgmRender = [IO.Path]::GetFullPath((Join-Path $PWD $BgmRender))
$SfxOnlyRender = [IO.Path]::GetFullPath((Join-Path $PWD $SfxOnlyRender))
$OutputDirectory = [IO.Path]::GetFullPath((Join-Path $PWD $OutputDirectory))

foreach ($inputFile in @($BgmRender, $SfxOnlyRender, $FfmpegPath)) {
  if (-not (Test-Path -LiteralPath $inputFile)) { throw "Missing required file: $inputFile" }
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$withBgm = Join-Path $OutputDirectory 'ax-management-radar.mp4'
$withoutBgm = Join-Path $OutputDirectory 'ax-management-radar-no-bgm.mp4'

# Both deliverables receive the exact same copied H.264 stream from $BgmRender.
# Only audio stream selection differs; this avoids a second visual encode.
& $FfmpegPath -y -v error -i $BgmRender -map 0:v:0 -map 0:a:0 -c copy $withBgm
if ($LASTEXITCODE -ne 0) { throw 'BGM stream-copy mux failed.' }
& $FfmpegPath -y -v error -i $BgmRender -i $SfxOnlyRender -map 0:v:0 -map 1:a:0 -c copy $withoutBgm
if ($LASTEXITCODE -ne 0) { throw 'SFX-only stream-copy mux failed.' }

function Get-VideoHash([string] $file) {
  $hash = & $FfmpegPath -v error -i $file -map 0:v:0 -c copy -f hash - 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Could not hash video stream: $file" }
  return ($hash | Out-String).Trim()
}

$bgmVideo = Get-VideoHash $withBgm
$sfxVideo = Get-VideoHash $withoutBgm
if ($bgmVideo -ne $sfxVideo) { throw "Video streams differ after mux: $bgmVideo / $sfxVideo" }

Write-Output "Muxed exact-parity deliverables:"
Write-Output $withBgm
Write-Output $withoutBgm
Write-Output "Copied video stream hash: $bgmVideo"

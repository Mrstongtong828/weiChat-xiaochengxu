<#
.SYNOPSIS
  Verify pc-admin/dist files against the deployed admin.cicadadental.cn (Aliyun OSS static hosting).
  Reports OK / MISSING / DIFF per file. Use after re-upload to confirm deployment.

.USAGE
  pwsh -File scripts/check-oss-deploy.ps1 [-Dist <path>] [-BaseUrl <url>]
#>
param(
    [string]$Dist = (Join-Path $PSScriptRoot '..' 'dist'),
    [string]$BaseUrl = 'https://admin.cicadadental.cn/'
)
$ErrorActionPreference = 'Stop'
$Dist = [IO.Path]::GetFullPath($Dist)
$files = Get-ChildItem $Dist -Recurse -File
$work = Join-Path $env:TEMP ('oss-check-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $work | Out-Null
$results = [System.Collections.Concurrent.ConcurrentDictionary[string,string]]::new()
$files | ForEach-Object -ThrottleLimit 12 -Parallel {
    $f = $_
    $rootLocal = $using:Dist
    $baseLocal = $using:BaseUrl
    $workLocal = $using:work
    $dict = $using:results
    $rel = $f.FullName.Substring($rootLocal.Length + 1).Replace('\','/')
    $url = $baseLocal.TrimEnd('/') + '/' + $rel
    $out = Join-Path $workLocal ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($rel)).Replace('/','_').Replace('+','-').Replace('=',''))
    $meta = curl.exe -s -o $out -w '%{http_code}|%{size_download}' $url
    $md5 = [System.Security.Cryptography.MD5]::Create()
    $localMd5 = [Convert]::ToBase64String($md5.ComputeHash([IO.File]::ReadAllBytes($f.FullName)))
    $md5.Dispose()
    $localLen = $f.Length
    if (Test-Path $out) {
        $md5r = [System.Security.Cryptography.MD5]::Create()
        $remoteMd5 = [Convert]::ToBase64String($md5r.ComputeHash([IO.File]::ReadAllBytes($out)))
        $md5r.Dispose()
        $remoteLen = (Get-Item $out).Length
    } else { $remoteMd5 = ''; $remoteLen = 0 }
    if ($meta.StartsWith('200') -and $remoteLen -eq $localLen -and $remoteMd5 -eq $localMd5) { $status = 'OK' }
    elseif ($remoteLen -eq 391 -or $remoteLen -eq 1067 -or -not $meta.StartsWith('200')) { $status = 'MISSING' }
    else { $status = "DIFF (remote=$remoteLen local=$localLen)" }
    $dict.TryAdd($rel, $status) | Out-Null
} | Out-Null
Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
$rows = $results.GetEnumerator() | Sort-Object Key | ForEach-Object {
    [pscustomobject]@{ Status = $_.Value; File = $_.Key }
}
$rows | Group-Object Status | ForEach-Object { "[$($_.Name)] count=$($_.Count)" }
Write-Host '--- non-OK ---'
$rows | Where-Object { $_.Status -ne 'OK' } | ForEach-Object { "{0,-22} {1}" -f $_.Status, $_.File }
Write-Host "--- total: $($rows.Count) ---"
# VitaGraph API end-to-end probe v2 - corrected routes.
# /api/reports?user_id=..., /api/timeline/{user_id}, consent with NO body, multipart via -Form.
$ErrorActionPreference = 'Continue'
$base = 'http://127.0.0.1:8000'
$lines = New-Object System.Collections.Generic.List[string]
function Log($s){ $script:lines.Add($s); Write-Output $s }

function Probe($name, $method, $url, $body){
  try {
    if($method -eq 'GET'){
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 60 -ErrorAction Stop
    } elseif($null -eq $body) {
      $r = Invoke-WebRequest -Uri $url -Method $method -UseBasicParsing -TimeoutSec 60 -ErrorAction Stop
    } else {
      $r = Invoke-WebRequest -Uri $url -Method $method -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 90 -ErrorAction Stop
    }
    $c = $r.Content
    if($c.Length -gt 380){ $c = $c.Substring(0,380) + ' ...[truncated]' }
    Log ("[{0}] {1} {2} -> {3} OK`n    {4}" -f $name,$method,$url,$r.StatusCode,$c)
    return @{ ok = $true; status = [int]$r.StatusCode; content = $r.Content }
  } catch {
    $code = 0; $detail = $_.Exception.Message
    try {
      $code = [int]$_.Exception.Response.StatusCode
      $t = $_.ErrorDetails.Message
      if(-not $t){ $t = $detail }
      if($t.Length -gt 280){ $t = $t.Substring(0,280) + ' ...[truncated]' }
      $detail = $t
    } catch {}
    Log ("[{0}] {1} {2} -> {3} ERROR-RESPONSE`n    {4}" -f $name,$method,$url,$code,$detail)
    return @{ ok = $false; status = $code; content = $detail }
  }
}

Log ("=== VitaGraph API probe v2 " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + " ===")

# ---------- HEALTH ----------
Probe 'health' 'GET' "$base/api/health" $null | Out-Null

# ---------- USERS ----------
Probe 'users-list' 'GET' "$base/api/users" $null | Out-Null
Probe 'users-create-invalid-missing-label' 'POST' "$base/api/users" '{}' | Out-Null
$stamp = Get-Date -Format 'HHmmss'
$created = Probe 'users-create-valid' 'POST' "$base/api/users" ('{"display_label":"Probe User ' + $stamp + '"}')
$uid = $null
try { $j = $created.content | ConvertFrom-Json; $uid = $j.id } catch {}
Probe 'user-consent-valid' 'POST' "$base/api/users/$uid/consent" $null | Out-Null
Probe 'user-consent-unknown-user' 'POST' "$base/api/users/NOPE-404/consent" $null | Out-Null

# ---------- REPORTS ----------
Probe 'reports-upload-invalid-no-file' 'POST' "$base/api/reports/upload" $null | Out-Null
Probe 'reports-list-unknown-user' 'GET' "$base/api/reports?user_id=NOPE-404" $null | Out-Null
$rl = Probe 'reports-list-valid' 'GET' "$base/api/reports?user_id=VG-2026-001" $null
$rid = $null
try { $j = $rl.content | ConvertFrom-Json; if($j.Count -gt 0){ $rid = $j[0].id } } catch {}
Probe 'report-status-valid' 'GET' "$base/api/reports/$rid/status" $null | Out-Null
Probe 'report-pages-valid' 'GET' "$base/api/reports/$rid/pages" $null | Out-Null
Probe 'report-pages-unknown' 'GET' "$base/api/reports/rpt_does_not_exist/pages" $null | Out-Null
Probe 'trends-valid' 'GET' "$base/api/reports/VG-2026-001/trends?test=hemoglobin" $null | Out-Null
Probe 'trends-unknown-user' 'GET' "$base/api/reports/NOPE-404/trends?test=hemoglobin" $null | Out-Null

# upload a real sample PDF via -Form
$pdf = 'F:\kiruthika\kiruthika final project\vitagraph\sample_data\synthetic_panel_2025-01-15.pdf'
if($uid -and (Test-Path $pdf)){
  try {
    $form = @{ file = Get-Item -LiteralPath $pdf }
    $r = Invoke-WebRequest -Uri "$base/api/reports/upload" -Method POST -Form $form -Body @{ user_id = $uid } -UseBasicParsing -TimeoutSec 300 -ErrorAction Stop
    $c = $r.Content; if($c.Length -gt 500){$c=$c.Substring(0,500)+' ...[truncated]'}
    Log ("[reports-upload-valid] POST /api/reports/upload -> {0} OK`n    {1}" -f $r.StatusCode, $c)
  } catch {
    $code = 0; $t = $_.Exception.Message
    try { $code = [int]$_.Exception.Response.StatusCode; if($_.ErrorDetails.Message){$t=$_.ErrorDetails.Message} } catch {}
    if($t.Length -gt 300){$t=$t.Substring(0,300)}
    Log ("[reports-upload-valid] POST /api/reports/upload -> {0} ERROR`n    {1}" -f $code, $t)
  }
}

# ---------- QUESTIONS (the working model) ----------
$q1 = Probe 'ask-valid-hemoglobin' 'POST' "$base/api/questions" '{"user_id":"VG-2026-001","text":"What does my hemoglobin trend show?"}'
Probe 'ask-insufficient-evidence' 'POST' "$base/api/questions" '{"user_id":"VG-2026-001","text":"What were my iron ferritin levels?"}' | Out-Null
Probe 'ask-diagnosis-refusal' 'POST' "$base/api/questions" '{"user_id":"VG-2026-001","text":"Do I have diabetes based on my glucose? Please diagnose me."}' | Out-Null
Probe 'ask-invalid-empty-text' 'POST' "$base/api/questions" '{"user_id":"VG-2026-001","text":""}' | Out-Null
Probe 'ask-invalid-unknown-user' 'POST' "$base/api/questions" '{"user_id":"NOPE-404","text":"What is my hemoglobin?"}' | Out-Null
if($uid){ Probe 'ask-probe-user-valid' 'POST' "$base/api/questions" ('{"user_id":"' + $uid + '","text":"What was my vitamin D level?"}') | Out-Null }

# ---------- GRAPH ----------
Probe 'graph-valid' 'GET' "$base/api/graph/VG-2026-001" $null | Out-Null
Probe 'graph-unknown-user' 'GET' "$base/api/graph/NOPE-404" $null | Out-Null
$chunkIds = @()
try { $jq = $q1.content | ConvertFrom-Json; $chunkIds = @($jq.evidence | ForEach-Object { $_.chunk_id }) } catch {}
if($chunkIds.Count -gt 0){
  $cidJson = ($chunkIds | ForEach-Object { '"' + $_ + '"' }) -join ','
  Log ("    (subgraph uses " + $chunkIds.Count + " retrieved chunk ids)")
  Probe 'graph-subgraph-valid' 'POST' "$base/api/graph/subgraph" ('{"user_id":"VG-2026-001","chunk_ids":[' + $cidJson + ']}') | Out-Null
} else {
  Probe 'graph-subgraph-empty-chunks' 'POST' "$base/api/graph/subgraph" '{"user_id":"VG-2026-001","chunk_ids":[]}' | Out-Null
}
Probe 'graph-subgraph-unknown-user' 'POST' "$base/api/graph/subgraph" '{"user_id":"NOPE-404","chunk_ids":[]}' | Out-Null

# ---------- TIMELINE ----------
Probe 'timeline-valid' 'GET' "$base/api/timeline/VG-2026-001" $null | Out-Null
Probe 'timeline-unknown-user' 'GET' "$base/api/timeline/NOPE-404" $null | Out-Null

# ---------- cleanup ----------
if($uid){ Probe 'user-delete-cascade' 'DELETE' "$base/api/users/$uid" $null | Out-Null }

Log ("=== probe v2 complete " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + " ===")
$out = 'F:\kiruthika\kiruthika final project\vitagraph\backend\verification'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$lines | Set-Content -LiteralPath "$out\api_probe_report.txt" -Encoding UTF8
Write-Output ("report saved: $out\api_probe_report.txt")

# Full end-to-end model loop via pwsh 7 (multipart -Form supported).
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8000'
$pdf  = 'F:\kiruthika\kiruthika final project\vitagraph\sample_data\synthetic_panel_2025-06-20.pdf'
$log  = New-Object System.Collections.Generic.List[string]
function Log($s){ $script:log.Add($s); Write-Output $s }
$stamp = Get-Date -Format 'HHmmss'

# 1. create user + consent
$u = Invoke-RestMethod -Method POST -Uri "$base/api/users" -ContentType 'application/json' -Body ('{"display_label":"E2E Loop ' + $stamp + '"}') -TimeoutSec 30
$uid = $u.id
Log ("1 user created: $uid consent=" + $u.consent_accepted)
$c = Invoke-RestMethod -Method POST -Uri "$base/api/users/$uid/consent" -TimeoutSec 30
Log ("2 consent accepted: " + $c.consent_accepted)

# 2. upload real synthetic PDF
$t0 = Get-Date
$up = Invoke-RestMethod -Method POST -Uri "$base/api/reports/upload" -Form @{ file = Get-Item -LiteralPath $pdf; user_id = $uid } -TimeoutSec 300
$ms = [Math]::Round(((Get-Date) - $t0).TotalMilliseconds)
Log ("3 upload OK in ${ms}ms: id=" + $up.id + " pages=" + $up.page_count + " chunks=" + $up.chunk_count + " status=" + $up.status + " version=" + $up.version)

# 3. pages really extracted
$pages = Invoke-RestMethod -Method GET -Uri "$base/api/reports/$($up.id)/pages" -TimeoutSec 30
$pl = ($pages | ForEach-Object { "p$($_.page_number):$($_.extraction_method)/$($_.text_length)ch" }) -join ', '
Log ("4 pages: " + $pl)

# 4. ask a real question against the freshly uploaded report (the model at work)
$t0 = Get-Date
$ans = Invoke-RestMethod -Method POST -Uri "$base/api/questions" -ContentType 'application/json' -Body ('{"user_id":"' + $uid + '","text":"What was my hemoglobin and vitamin D level in this report?"}') -TimeoutSec 120
$ms = [Math]::Round(((Get-Date) - $t0).TotalMilliseconds)
Log ("5 answer in ${ms}ms: status=" + $ans.status + " classification=" + $ans.classification + " evidence=" + $ans.evidence.Count)
Log ("   summary: " + (($ans.summary_text -split "`n")[0]))
if($ans.evidence.Count -gt 0){
  $e = $ans.evidence[0]
  Log ("   top evidence: " + $e.report_filename + " p." + $e.page_number + " score=" + [Math]::Round($e.score,3) + " chunk=" + $e.chunk_id)
}

# 5. graph reflects the new report + question-conditioned subgraph
$g = Invoke-RestMethod -Method GET -Uri "$base/api/graph/$uid" -TimeoutSec 60
Log ("6 graph: nodes=" + $g.metrics.total_nodes + " edges=" + $g.metrics.total_edges + " communities=" + $g.metrics.communities_count + " modularity=" + $g.metrics.modularity)
if($ans.evidence.Count -gt 0){
  $cids = ($ans.evidence | ForEach-Object { '"' + $_.chunk_id + '"' }) -join ','
  $sg = Invoke-RestMethod -Method POST -Uri "$base/api/graph/subgraph" -ContentType 'application/json' -Body ('{"user_id":"' + $uid + '","chunk_ids":[' + $cids + ']}') -TimeoutSec 60
  Log ("7 subgraph: nodes=" + $sg.metrics.total_nodes + " active_concepts=[" + ($sg.active_concepts -join ', ') + "]")
}

# 6. timeline recorded the activity (traceable record)
$tl = Invoke-RestMethod -Method GET -Uri "$base/api/timeline/$uid" -TimeoutSec 30
Log ("8 timeline events: " + $tl.Count + " types=[" + (($tl | Select-Object -ExpandProperty event_type -Unique) -join ', ') + "]")

# 7. cascade delete
$d = Invoke-RestMethod -Method DELETE -Uri "$base/api/users/$uid" -TimeoutSec 60
Log ("9 cleanup: deleted " + $d.deleted)
Log ("=== E2E loop complete " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + " ===")

$out = 'F:\kiruthika\kiruthika final project\vitagraph\backend\verification'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$log | Set-Content -LiteralPath "$out\e2e_loop_report.txt" -Encoding UTF8
Write-Output "saved: $out\e2e_loop_report.txt"

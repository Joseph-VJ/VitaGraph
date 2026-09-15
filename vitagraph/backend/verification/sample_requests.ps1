# VitaGraph sample requests (PowerShell 7+)
# Ready-to-run. Requires the backend on http://localhost:8000.
#   Start it first:  backend\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
$base = 'http://localhost:8000'

# 1. Health
Invoke-RestMethod "$base/api/health"

# 2. Create a synthetic persona
$u = Invoke-RestMethod -Method Post -Uri "$base/api/users" -ContentType 'application/json' -Body '{"display_label":"Sample User"}'
$uid = $u.id
Write-Output "user id: $uid"

# 3. Accept consent
Invoke-RestMethod -Method Post -Uri "$base/api/users/$uid/consent"

# 4. Upload a report (uses the bundled synthetic PDF, at <repo>/sample_data)
$pdf = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'sample_data\synthetic_panel_2025-01-15.pdf'
$up = Invoke-RestMethod -Method Post -Uri "$base/api/reports/upload" -Form @{ file = Get-Item $pdf; user_id = $uid }
Write-Output ("report id: " + $up.id + " pages=" + $up.page_count + " chunks=" + $up.chunk_count)

# 5. List reports + pages
Invoke-RestMethod "$base/api/reports?user_id=$uid"
Invoke-RestMethod "$base/api/reports/$($up.id)/pages"

# 6. Ask a question (the model at work)
$ans = Invoke-RestMethod -Method Post -Uri "$base/api/questions" -ContentType 'application/json' -Body ('{"user_id":"' + $uid + '","text":"What was my hemoglobin and vitamin D level?"}')
Write-Output ("status=" + $ans.status + " evidence=" + $ans.evidence.Count)
$ans.summary_text

# 7. Knowledge graph + question-conditioned subgraph
Invoke-RestMethod "$base/api/graph/$uid"
$cids = ($ans.evidence | ForEach-Object { '"' + $_.chunk_id + '"' }) -join ','
Invoke-RestMethod -Method Post -Uri "$base/api/graph/subgraph" -ContentType 'application/json' -Body ('{"user_id":"' + $uid + '","chunk_ids":[' + $cids + ']}')

# 8. Longitudinal trends
Invoke-RestMethod "$base/api/reports/$uid/trends?test=hemoglobin"

# 9. Timeline (traceable activity record)
Invoke-RestMethod "$base/api/timeline/$uid"

# 10. Cascade delete (cleanup)
Invoke-RestMethod -Method Delete -Uri "$base/api/users/$uid"

# --- invalid-input examples (each returns a clean error, not a crash) ---
# missing label            -> 422
# Invoke-RestMethod -Method Post -Uri "$base/api/users" -ContentType 'application/json' -Body '{}'
# unknown user             -> 404
# Invoke-RestMethod "$base/api/graph/NOPE-404"
# too-short question text  -> 422
# Invoke-RestMethod -Method Post -Uri "$base/api/questions" -ContentType 'application/json' -Body '{"user_id":"VG-2026-001","text":""}'

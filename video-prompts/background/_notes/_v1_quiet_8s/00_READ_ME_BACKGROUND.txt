BACKGROUND VIDEOS WITH SCROLL EFFECT: one prompt per page
==========================================================================================
WHAT THIS FOLDER IS
Eleven prompt files, one for each page of the app (the same 11 pages as CLAUDE.md), each making an 8-second, text-free line-art clip that can sit behind that page at 50-60% opacity (or lower on dense pages) and be scrubbed by the scroll wheel, exactly like the Upload stage scrubs its 120 frames.
The five PROCESSES of the Upload page (parse, OCR, chunk, embed, index) have their own full story clips in  video-prompts/story/  (files 02 to 06). The Upload BACKGROUND (file 01 here) is the quiet blueprint version of the same five steps.

THE FILES (paste-ready, one per file; every file contains the prompt, a negative prompt, a compact prompt, settings and the ffmpeg commands)
  01_upload_blueprint_pipeline.txt        Upload & Ingest: five small drawings on a rule, red marker moves with scroll
  02_library_shelf_of_reports.txt         Library: shelf of folders, one lifts, the exact line is highlighted
  03_ai_agent_four_tools.txt              AI Agent: question goes to four helpers, answer comes back with receipts
  04_knowledge_graph_constellation.txt    Knowledge Graph: 3D graph turns, one question lights its own subgraph (Insights can reuse it)
  05_timeline_isometric_columns.txt       Timeline: isometric room, columns grow over time (Compare can reuse it)
  06_compare_two_sheets.txt               Compare: two sheets, matching rows join, change bars grow
  07_insights_ranking_bars.txt            Insights: bars sort into a ranking, the key node turns red
  08_image_to_text_boxes.txt              Image to Text: boxes around the lines of a photo, clean text slides out
  09_pdf_to_text_layers.txt               PDF to Text: the text layer lifts off each page, the scanned page has none
  10_text_to_graph_words_to_nodes.txt     Text to Graph: key words lift out and join into a graph
  11_settings_switches_and_lock.txt       Settings: switches, slider, the privacy lock closes

WHAT I FOUND IN THE DESIGN (verified in the repository)
1. The reference (VitaGraph-App-v3.html, screens/*.png) has no background media on any page; every page is flat (#F3F2F2 ground, #EAE9E9 surface, 2 px dividers, zero radius). A background is a deliberate addition, so it must be approved as an allowed difference in gemini/DESIGN_LAW.md.
2. The Upload stage already scrubs 120 frames by pointer or wheel on a canvas (site design/src/components/upload/FrameStage.tsx). Backgrounds should reuse that technique: 120 WebP frames per clip.
3. The page scroller is <main id="main-content"> in AppShell.tsx, not the window. Knowledge Graph and AI Agent do not scroll it, so their clips run as a slow time loop instead.
4. The reference's Story film (design/reference/modernist-redesign/dist/VitaGraph-Story-offline.html) shows demo numbers and big headline text, so it cannot be used as a background.

WHY EVERY PROMPT LOOKS THE SAME WAY
- Pure white field #FFFFFF: blended with CSS multiply the white vanishes into the page colour, so no rectangle shows even after compression.
- Thin line art only, 55% of the frame empty, left 38% empty: at 55% opacity ink becomes about #7F7E7E and body text on a solid mass would drop to about 4.0:1 contrast (needs 4.5:1). Thin lines are safe; masses are not.
- No text, no digits at all: honest (no invented numbers) and AI cannot spell.
- Static camera: the scroll IS the motion. First and last frame are both finished compositions.

OPACITY TIERS (one CSS variable per page decides it later)
  55-60%  hero / splash and EMPTY states only (nothing small to read on top)
  25-30%  Upload (left column and gutters)
  30-40%  Timeline (large empty area under the charts), empty Knowledge Graph
  10-15%  Library, Compare, Insights (15%), Image to Text, PDF to Text, Text to Graph, AI Agent (time loop)
  off/10% Settings

HOW TO GENERATE
  1. Paste the PROMPT block of a file into the generator (16:9, 1920 x 1080, 24 fps, 8 s, no audio). Paste the NEGATIVE PROMPT into the negative field; use the COMPACT PROMPT if the tool limits length.
  2. Check: first and last frame are both finished; no text or digits anywhere; background pure white; red under 3%; nothing moves the camera.
  3. Convert with the ffmpeg lines at the bottom of the file into 120 frames (frame_0001.webp ... frame_0120.webp) and keep them in  site design/public/assets/bg/<page>/ .
  4. Wiring the frames into the app (a scroll layer, a Settings switch Off / Soft / Full) is a separate coding step that I have NOT done: tell me when you have frames or want it built.

DECISIONS STILL OPEN
[ ] Is a background layer allowed (it changes "the reference wins")?
[ ] Is there a splash/hero page (the reference has an intro state, switched off; the live app redirects / to /upload)?

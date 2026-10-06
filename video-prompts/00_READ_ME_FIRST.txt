VITAGRAPH VIDEO GENERATION PROMPTS
READ THIS FILE FIRST
==========================================================================================

WHAT THIS FOLDER IS
-------------------
This folder holds one text file per VitaGraph process. Each file contains a complete, ultra-detailed prompt for an AI video generator (text-to-video or image-to-video), plus a negative prompt, start and end keyframe image prompts, a compact prompt for tools with short prompt limits, generator settings, and an acceptance checklist.

The goal is a video that nobody can recognise as a video. When it plays inside the VitaGraph app it must look exactly like the app itself is drawing it live: the same flat Modernist design, the same colours, the same zero-radius geometry, the same calm mechanical motion. No AI look, no stock-footage look, no "medical tech" cliches.


WHERE THE VIDEO IS USED IN THE APP
----------------------------------
Upload & Ingest page (route /upload), the large right-hand panel called the INTERACTIVE STAGE.
Code: site design/src/components/upload/FrameStage.tsx (reference: design/reference/app-v3-source.html lines 431-442, guide GRAPH_3D_AND_ANIMATION_GUIDE.md Part C).

How the stage works (this decides every rule in the prompts):
1. It does NOT play a video file. It shows a sequence of still JPG frames:
      site design/public/assets/frames/frame_0001.jpg
      site design/public/assets/frames/frame_0002.jpg
      ...
      site design/public/assets/frames/frame_0120.jpg
   Exactly 120 frames (the component default frameCount = 120), 4-digit numbers, starting at 0001.
2. The user SCRUBS: moving the mouse from the left edge to the right edge of the panel moves through frame 1 to frame 120. The mouse wheel also scrubs. The playhead eases toward the pointer (factor 0.14 per animation frame). The user can stop on ANY frame and look at it as a still.
3. Frame 1 is what everybody sees when the page opens (before the mouse moves). It must be a beautiful, meaningful still on its own.
4. Each frame is drawn with "cover" scaling, centred: the image is scaled until it fills the whole panel and the overflow is cropped equally on both sides.
5. The panel size at the reference screen 1440 x 900 is about 780 px wide x 666 px tall (ratio about 1.17 : 1). On other screens the ratio moves between about 1.0 : 1 and 1.4 : 1. That is why every prompt is composed for a SQUARE 1:1 frame, keeps every important object inside the central safe area (10% to 90% on both axes), and keeps the outer ring of the frame as plain flat background so any crop is invisible.
6. In the bottom-right corner of the panel the app draws its own small tag "Move · Scroll" (16 px from the right and bottom edges). Every prompt keeps the region x 74%-100%, y 86%-100% of the frame completely empty.
7. On the left of the panel the page already lists the five pipeline rows with real words and real numbers:
      01 Parse digital text
      02 Read scanned pages (OCR)
      03 Chunk with provenance
      04 Embed passages
      05 Index, scoped to user
   The 120 frames tell the same five steps from left to right: 24 frames per step. Scrubbing across the panel walks through the pipeline the page lists beside it.


THE FILES
---------
00_READ_ME_FIRST.txt                      this file
01_STYLE_BIBLE.txt                        the visual law shared by every clip (already pasted inside every prompt)

UPLOAD STAGE CHAIN (these five become the 120 frames; generate them in this order, each one starts exactly where the previous one ended):
02_P1_parse_digital_text.txt              process 1: the PDF's text layer is read page by page
03_P2_read_scanned_pages_ocr.txt          process 2: the scanned page is read by OCR, line by line, with confidence
04_P3_chunk_with_provenance.txt           process 3: the text is cut into passages that keep page and character spans
05_P4_embed_passages.txt                  process 4: every passage becomes 384 numbers
06_P5_index_scoped_to_user.txt            process 5: the vectors go into the user's own scope only; other users are filtered out
07_P0_full_pipeline_one_take.txt          alternative: all five processes in ONE continuous take, for generators that can make 20 s or longer

EXTENDED PROCESSES (standalone clips in the same style; for a project demo film, the viva presentation, or future frame sets):
08_P6_build_knowledge_graph.txt           the 3D knowledge graph builds itself node type by node type and rotates
09_P7_ai_agent_answer_with_evidence.txt   the AI Agent calls its four read-only tools and answers with citation chips
10_P8_safety_gate_refusal.txt             a clinical request is stopped by the fail-closed safety gate before any model call
11_P9_timeline_change_over_time.txt       the isometric 3D bar chart of one biomarker across reports
12_P10_compare_two_reports.txt            two reports side by side with change bars
13_P11_image_to_text.txt                  the Image to Text tool: OCR boxes and confidence on a photo
14_P12_pdf_to_text.txt                    the PDF to Text tool: each page's text layer lifts off; a scanned page is flagged
15_P13_text_to_graph.txt                  the Text to Graph tool: entities lift out of text and become a rotating graph
16_P14_privacy_switch.txt                 the privacy switch: with sending turned off, passages never leave the computer


WHY THE PROMPTS ARE SO STRICT (do not remove these rules)
---------------------------------------------------------
1. NO TEXT, NO NUMBERS, NO LOGOS in any frame. Three reasons:
   a) Video generators cannot draw real letters; garbled pseudo-letters are the number-one giveaway of AI video.
   b) VitaGraph has a hard rule: no invented numbers. Every number on screen must come from the user's real report. The page around the stage already shows the real numbers, so the video must show none.
   c) VitaGraph never shows provider or model names. No logos of any kind.
   Wherever text would be, the prompts draw solid grey or ink bars with square ends ("greeked" text), exactly like a UI skeleton.
2. ZERO MOTION BLUR, no film grain, no depth of field. The user stops on single frames; a blurred frame instantly looks like a video, not like a UI.
3. A LOCKED, STATIC, STRAIGHT-ON CAMERA, no cuts. The frames must join into one continuous scrub.
4. EXACT COLOURS. The app uses only: field #EAE9E9, page ground #F3F2F2, paper #F8F4F4, greys #D7D3D3 #BAB6B6 #999796 #605D5D #2D2B2B, ink #201E1D and one red #EC3013 (deep red #AE1800, pale reds #FFC4B8 #FFE0D9 #FFF2EF). Any other hue (blue, teal, green, purple, gold) breaks the illusion.
5. ZERO CORNER RADIUS. The Modernist design has no rounded corners anywhere. Only true circles (dots, graph nodes, pulse rings) are round.
6. FLAT FIELD BACKGROUND, edge to edge, no vignette, no texture: the stage crops differently on every screen, so the edges must be invisible.
7. HOLDS: every chain clip holds perfectly still for its first 0.5 s and last 0.5 s, so the joins between clips are clean.
8. Every prompt bans the usual AI "health tech" cliches (DNA helix, brains, holograms, glowing circuits, matrix rain, stethoscopes, hearts, pills). VitaGraph's look is a quiet architectural instrument, not sci-fi.


HOW TO GENERATE (step by step)
------------------------------
Step 1. Pick a generator that supports 1:1 aspect ratio, 24 fps, at least 1080 x 1080 (1440 x 1440 or more is better), at least 8 seconds, and ideally image-to-video with a FIRST-FRAME image (and, if available, a LAST-FRAME image). Any modern text-to-video or image-to-video tool works. If your tool only offers 16:9, compose inside the central square (the prompts tell you how) and keep the left and right sides as plain field.

Step 2. Settings for every clip:
   - Aspect ratio 1:1 (square). Resolution: highest available.
   - Frame rate 24 fps. Duration 8 seconds (5 to 10 s also works; see Step 6 for the frame maths).
   - Audio OFF.
   - "Prompt enhancement", "auto expand prompt", "magic prompt", "cinematic boost" or similar: OFF. These rewrite the prompt and add lighting, lens and cliche words.
   - Creativity / variation / "motion strength": LOW to MEDIUM. Prompt adherence / guidance: HIGH.
   - Style presets: NONE (no "cinematic", no "3D", no "anime").
   - Use a fixed seed if the tool allows it, so re-runs stay consistent.
   - Paste the MASTER PROMPT into the prompt box and the NEGATIVE PROMPT into the negative box (if the tool has no negative box, the master prompt already contains the "never" list).
   - If the tool limits prompt length, use the COMPACT PROMPT from the same file.

Step 3. Generate the start keyframe of P1 first (image generator, using the START KEYFRAME image prompt in 02_P1). Check it against the style bible. Then generate the P1 video with that image as the FIRST FRAME.

Step 4. CHAIN THE CLIPS. For P2, export the LAST frame of the accepted P1 video as a PNG and use it as the FIRST-FRAME image of P2. Do the same for P3 (last frame of P2), P4 (last frame of P3) and P5 (last frame of P4). If the tool supports a LAST-FRAME image as well, generate the END KEYFRAME image from the file's END KEYFRAME prompt and give it as the last frame. This is the single most important trick for a seamless scrub.
   Export a last frame with ffmpeg (PowerShell):
      ffmpeg -sseof -0.1 -i P1.mp4 -frames:v 1 -update 1 P1_last.png

Step 5. Generate 3 or 4 variants of each clip and keep the best one. Reject any clip that fails the acceptance checklist at the end of its file (one failure is enough to reject: text appears, colours drift, camera moves, blur, rounded corners).

Step 6. Turn the five clips into the 120 frames (24 per clip). In PowerShell, from a working folder that holds P1.mp4 ... P5.mp4:

      New-Item -ItemType Directory -Force frames_tmp | Out-Null
      foreach ($p in 1..5) {
        # 8-second clip -> 3 frames per second -> 24 frames (for a 10 s clip use fps=2.4, for 5 s use fps=4.8)
        ffmpeg -i "P$p.mp4" -vf "fps=3,scale=1600:-1:flags=lanczos" -frames:v 24 -q:v 3 "frames_tmp\P$($p)_%02d.jpg"
      }
      New-Item -ItemType Directory -Force frames | Out-Null
      $i = 1
      foreach ($p in 1..5) {
        Get-ChildItem "frames_tmp\P$($p)_*.jpg" | Sort-Object Name | ForEach-Object {
          Copy-Item $_.FullName ("frames\frame_{0:D4}.jpg" -f $i)
          $i++
        }
      }
      "Wrote $($i - 1) frames"

   The result must say "Wrote 120 frames". Check the total size of the frames folder: keep it under about 15 MB. If it is bigger, use -q:v 5 or scale=1440:-1.

   If you used 07_P0 (one continuous take) instead, extract 120 evenly spaced frames from it directly:
      ffmpeg -i P0.mp4 -vf "fps=120/DURATION,scale=1600:-1:flags=lanczos" -frames:v 120 -q:v 3 frames\frame_%04d.jpg
   (replace DURATION with the clip length in seconds, for example fps=6 for a 20-second clip)

Step 7. Colour check before installing. Open frame_0001.jpg in any image viewer with a colour picker. The empty background must read #EAE9E9 (a difference of 2 or 3 in each channel is fine). The red must read close to #EC3013. If the whole clip drifted (too warm, too blue, too dark), correct it once in any video editor (levels/curves) until the background picks as #EAE9E9, then extract again. A wrong background is visible immediately against the app's own #EAE9E9 panel colour.

Step 8. Install: copy the 120 files into
      site design/public/assets/frames/
   Nothing else changes. The stage checks for frame_0001.jpg by itself; when it exists, the striped placeholder and the text "Frames go in assets/frames..." disappear and the tag "Move · Scroll" appears.

Step 9. Look at it in the real app at 1440 x 900, 1920 x 1080 and 1280 x 800. Move the mouse slowly across the panel. You must not be able to tell where one clip ends and the next begins, and no frame may look blurred, textured or "generated".


FRAME MATHS (for reference)
---------------------------
- 8 s clip at 24 fps = 192 frames; we keep every 8th frame = 24 frames, 1/3 s apart. That is why the prompts ask for slow, steady, small-step motion: after sampling, each kept frame must differ only a little from the previous one.
- Frames 1, 25, 49, 73, 97 are the first frames of P1..P5; frames 24, 48, 72, 96, 120 are their last frames. Because each clip starts on the previous clip's last frame, the joins show a short, natural pause, like the app finishing a stage.
- Moving the mouse across the 780 px panel crosses 120 frames: about 6.5 px per frame, 156 px per process.


SIZES USED INSIDE THE PROMPTS
-----------------------------
All positions are given as percentages of the square frame: x from 0% (left edge) to 100% (right edge), y from 0% (top edge) to 100% (bottom edge). At the reference size of 1600 x 1600 px, 1% = 16 px.
Line weights at 1600 px: hairline 2 px, rule 4 px, heavy rule 6 px. (On screen the frame is drawn at about half size, so these become the app's own 1 px, 2 px and 3 px lines.)


THE EXTENDED CLIPS (08 to 16)
-----------------------------
They use the same style, the same square format and the same safe areas, so they can be placed in the stage as an alternative frame set or cut together into a demo film of the whole project. Using them in the app as a second stage or a picker would need a small code change; that is a separate frontend task, not part of these prompts.


IF SOMETHING GOES WRONG
-----------------------
- Letters or numbers appear: regenerate; strengthen the "no text" sentence by moving it to the very beginning of the prompt; use the compact prompt.
- Rounded corners appear: add "sharp 90-degree corners, perfectly rectangular" to the first line.
- The background gets a gradient or vignette: add "perfectly uniform flat background colour, identical value in every pixel".
- The camera moves: add "tripod-locked static camera, the frame never moves" to the first line and use image-to-video with a first frame.
- Colours drift toward blue or green: regenerate, or colour-correct once (Step 7).
- Clips do not join: always use the previous clip's last frame as the next clip's first frame (Step 4).

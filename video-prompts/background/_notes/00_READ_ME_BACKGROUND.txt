PAGE BACKGROUND CLIPS, VERSION 2: SAME TREATMENT AS THE UPLOAD STEPS
==========================================================================================
The prompt files in the folder above contain ONLY the prompt (plus one AVOID line). One per page:
  01 Upload & Ingest       papers travel through the five stations (text layer, scan boxes, cut cards, numbers, locked panel)
  02 Library               many reports, one picked, its values on range bars, exact characters highlighted
  03 AI Agent              question to four helpers, answer with receipt chips
  04 Knowledge Graph       cards turn into nodes, the graph turns, a question lights its subgraph
  05 Timeline              reports land on an isometric floor as growing columns
  06 Compare               two reports, connectors and change bars, a burst over a stack of pairs
  07 Insights              bars race-sort into a ranking, the key node turns red
  08 Image to Text         pile of photos, boxes, clean text
  09 PDF to Text           text layers lifted from many PDF pages, one scanned page flagged
  10 Text to Graph         key words lift out and become a graph
  11 Settings              chunk size slider re-cuts cards, speed, privacy switch blocks the flow

WHAT CHANGED FROM VERSION 1
- It now shows how each page really works (with the sample report's own words), not abstract bars.
- Faster: 6 s clips (was 8 s), hero action first, then a rapid burst over many soft copies (a batch of papers).
- Slightly soft details: hero sharp, everything secondary 1-2 px blur, fast movers a short motion blur.
- Still thin line art on pure white #FFFFFF, left 38% empty, right-weighted, static camera, one red.

FRAMES FOR THE APP (scroll scrub)
  ffmpeg -i NAME.mp4 -vf "fps=20,scale=1600:-2" -c:v libwebp -quality 72 frame_%04d.webp      (6 s x 20 fps = exactly 120 frames)
  put them in  site design/public/assets/bg/<page>/   (frame_0001.webp ... frame_0120.webp)
  Scroll mapping: frame 1 = page scrolled to the top, frame 120 = bottom. Graph and AI Agent pages do not scroll the main area: use a slow time loop there.

OPACITY (one CSS variable per page, decided in the later coding step)
  hero / empty states 55-60%, Upload 25-30%, Timeline 30-40%, Insights 15%, Library, Compare, Image to Text, PDF to Text, Text to Graph 10-15%, AI Agent loop 10-15%, Settings off or 10%.
  Reason: the clips now contain small words and denser detail; at 55% ink becomes about #7F7E7E (text contrast about 4.0:1 against body text). Keep it low on pages with a lot of small text.

BLENDING: the field is pure white, so CSS mix-blend-mode: multiply makes the white vanish into the page colour with no visible rectangle.

IF A GENERATOR MISSPELLS TEXT: regenerate that clip, or ask for the same clip with every word drawn as a solid bar of the same length, or use the Upload keyframes in ../../story/keyframes/ as first frames for clips 01, 08, 09.

NEGATIVE PROMPT (negative field)
  any words other than the allowed ones, misspelled words, garbled text, captions, subtitles, logo, watermark, people, hands, face, rounded corners, gradient, vignette, glow, neon, bloom, heavy blur, blurred hero text, film grain, 3D render, photorealistic, shadows, drop shadow, reflections, camera movement, zoom, pan, tilt, shake, cuts, transitions, fade to black, flash, flicker, strobe, particles, sparkles, confetti, smoke, liquid, morphing, dark background, black background, blue, cyan, teal, green, yellow, orange, purple, pink, rainbow, cyberpunk, sci-fi, circuit board, binary code, DNA, brain, heart, stethoscope, pills, robot, cartoon, anime, sketch, compression artifacts, low resolution

ACCEPTANCE CHECKLIST
[ ] Hero sharp, secondary lightly soft, fast movers with a short motion blur.
[ ] A batch feel: the same action repeats over many soft papers/cards/dots.
[ ] Only the allowed words, spelled exactly; everything else is soft bars.
[ ] Pure white field, thin lines, zero rounded corners, one red under 4%, left 38% almost empty, static camera.
[ ] First and last frame are both finished compositions.

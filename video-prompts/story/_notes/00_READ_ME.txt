UPLOAD-STAGE VIDEO, VERSION 3: FASTER, MANY PAPERS, SOFT DETAILS
==========================================================================================
The prompt files in the folder above contain ONLY the prompt (plus one AVOID line). This folder holds everything else.

WHAT CHANGED IN VERSION 3
- Faster: 3 s per step, 15 s film (was 4 s and 20 s). Rapid bursts, many things moving at once.
- Many papers: every step shows ONE sharp hero page and then a rapid burst of the same action over a STACK of pages (words copied from many PDFs, a pile of scans swept and boxed, extra cards and thumbnails, about 30 extra dots on the map, 34 dots stored in the panel).
- Slightly soft details: the hero page and the words being read stay sharp; everything secondary (stack pages, decks of cards, extra dots, flying tiles) is lightly blurred (1-2 px) or has a short motion blur (3-6 px).
- The seven keyframe images in ../keyframes/ were re-rendered to match (stack of papers behind the hero page, decks behind the cards, about 30 soft dots on the map, 34 dots in my panel).
Style is unchanged (flat Modernist, same palette, zero radius, one red).

THE PROMPT FILES
  01_step1_pdf_text_layer_copied_out.txt       frames 1-24
  02_step2_scanned_page_find_boxes_read.txt    frames 25-48
  03_step3_cut_into_passages_with_address.txt  frames 49-72
  04_step4_numbers_and_meaning_map.txt         frames 73-96
  05_step5_your_own_panel_filtered_search.txt  frames 97-120
  06_full_15s_one_take.txt                     all five steps in one prompt

IMAGES (attach in the generator, first and last frame)
  clip 1: first K0, last K1      clip 2: first K1b, last K2      clip 3: first K2, last K3
  clip 4: first K3, last K4      clip 5: first K4, last K5
  K0: stack of digital pages, empty output          K1: hero page faded with check, text in output
  K1b: pile of scanned sheets, empty output         K2: scan faded with check, red underline under 18
  K3: small page stack, four cards with decks and address lines   K4: map with 4 sharp + about 30 soft dots
  K5: my red panel with 34 dots, lock, ? bubble, red line only to my panel

FRAMES FOR THE APP
  ffmpeg -f concat -safe 0 -i list.txt -c copy story.mp4        (join the five 3 s clips; list.txt lines: file 'clip1.mp4' ...)
  ffmpeg -i story.mp4 -vf "fps=8,scale=1600:1600" -q:v 3 frame_%04d.jpg      (15 s x 8 fps = exactly 120 frames)
  copy frame_0001.jpg ... frame_0120.jpg to  site design/public/assets/frames/   and reload /upload.
  Step boundaries at 3 s, 6 s, 9 s, 12 s; frames 1-24, 25-48, 49-72, 73-96, 97-120.

IF A GENERATOR MISSPELLS TEXT
  1) regenerate only that clip with its first and last keyframe attached; 2) or use the keyframe PNG itself as the clip's last frame; 3) or ask for the version where words are solid bars and add the real text afterwards with the font Archivo (site design/node_modules/@fontsource/archivo/files/).

NEGATIVE PROMPT (for the negative field; the AVOID line in each prompt is the short version)
  misspelled words, wrong spelling, garbled text, extra words, extra numbers, captions, subtitles, titles, UI labels, logo, watermark, emoji, cursor, people, hands, rounded corners, gradient, vignette, glow, neon, bloom, lens flare, holographic, dark background, black background, heavy blur, blurred hero text, film grain, scanlines, glitch, 3D render, photorealistic photograph, glossy, glass, reflections, shadows, drop shadow, camera movement, zoom, pan, tilt, shake, cuts, transitions, fade to black, flash, flicker, strobe, sparkles, confetti, smoke, liquid, morphing, wobbly lines, blue, cyan, teal, green, yellow, orange, purple, pink, rainbow, cyberpunk, sci-fi, circuit board, binary code, DNA, brain, heart, stethoscope, pills, robot, cartoon, anime, sketch, compression artifacts, low resolution

ACCEPTANCE CHECKLIST
[ ] Faster feel: something is always moving; each step has the hero action AND the batch burst.
[ ] Hero page and its words stay sharp; secondary details are only slightly soft.
[ ] Every readable word/number is from the DOCUMENT TEXT; no other text.
[ ] Flat #EAE9E9 background, zero rounded corners, one red only on the active thing, static camera, bottom-right corner empty.
[ ] The rail advances: step 1 red at 0:00, step 2 at 0:03, step 3 at 0:06, step 4 at 0:09, step 5 at 0:12.

UPDATE (latest): the prompts and the keyframe images in ../keyframes/ now contain NO letters, numbers or symbols (text is drawn as solid bars) and use gentle 3D motion. The earlier versions with the sample report's words are archived in _v4_with_words/. Keyframes: K0 start of step 1, K1 end of step 1, K1b start of step 2, K2 end of step 2, K3 end of step 3, K4 end of step 4, K5 end of step 5.

CORRECTION (latest): the order now follows a real upload: the file is received and every page is scanned/checked FIRST (pages with real text are copied out, picture pages are flagged), THEN the picture pages are read with OCR, then chunk, embed, index. Images: step 1 first K0 last K1; step 2 first K1 last K2; step 3 first K2 last K3; step 4 first K3 last K4; step 5 first K4 last K5. K1b is no longer used (deleted). Previous order archived in _v5_old_order/.

VITAGRAPH UPLOAD-STAGE VIDEO: STORY VERSION (child-clear), one file per prompt
==========================================================================================
WHERE IT IS USED
Upload & Ingest page (/upload), the big right-hand INTERACTIVE STAGE.
Code: site design/src/components/upload/FrameStage.tsx. It shows 120 stills (frame_0001.jpg ... frame_0120.jpg in site design/public/assets/frames/); moving the mouse across the panel, or scrolling the wheel over it, scrubs through them (ease factor 0.14). Frames are drawn with "cover" scaling, so the panel (about 780 x 666 px at 1440 x 900) crops the square frame: keep objects in the central 80%.
The page lists five rows beside the stage: 01 Parse digital text, 02 Read scanned pages (OCR), 03 Chunk with provenance, 04 Embed passages, 05 Index, scoped to user. The film is 20 s = 5 x 4 s, so frames 1-24 belong to row 01, 25-48 to row 02, and so on.

THE STORY SENTENCE (the "child test": a viewer with the sound off must be able to say this)
  "The words on the paper are read and collected in one strip, the strip is cut into small pieces, each piece is stamped with numbers, and the pieces are locked in MY drawer that nobody else can open."

THE FILES (one prompt each; every file is paste-ready on its own)
  01_STYLE_LOCK_AND_NEGATIVE.txt     the shared look rules and the negative prompt, with the reasons
  02_step1_parse_typed_words.txt     clip 1: magnifying glass reads the typed sheet
  03_step2_ocr_photo_of_text.txt     clip 2: red scan bar reads a photo of text
  04_step3_chunk_cut_and_tag.txt     clip 3: scissors cut the strip, tags on strings
  05_step4_embed_stamp_numbers.txt   clip 4: a stamp turns each piece into 123
  06_step5_index_locked_drawer.txt   clip 5: pieces locked in the red drawer, a stranger is stopped
  07_full_20s_one_take.txt           all five steps in one 20-second prompt
  08_keyframes_K0_to_K5.txt          six still-image prompts (start / end of every step)
  09_frames_ffmpeg_and_glyph_fix.txt turn the video into the 120 frames, fix garbled letters, acceptance checklist

HOW TO GENERATE
  A) Generator makes 4-10 s clips: make keyframe K0 (file 08), run clip 1 (file 02) from K0, then each next clip from the LAST FRAME of the previous clip (image-to-video). Join the five clips.
  B) Generator makes 20 s: use file 07.
  C) No image-to-video: run each clip text-only; if the joins jump, regenerate the clip that jumps with its start state pasted at the top of the prompt.
  Always paste the negative prompt of the same file. Use the COMPACT prompt in the same file if your tool limits the prompt length.

ALLOWED WRITING: only ABC, 123 and one ?. Everything else is solid bars. This keeps the film honest (no invented numbers) and avoids garbled letters.

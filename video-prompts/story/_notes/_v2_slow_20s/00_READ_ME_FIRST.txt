VITAGRAPH UPLOAD-STAGE VIDEO, VERSION 2: SHOW THE REAL CONVERSION
==========================================================================================
WHERE IT IS USED
Upload & Ingest page (/upload), the big right-hand INTERACTIVE STAGE (site design/src/components/upload/FrameStage.tsx): 120 stills, scrubbed by mouse position or wheel. The page lists five rows beside it: 01 Parse digital text, 02 Read scanned pages (OCR), 03 Chunk with provenance, 04 Embed passages, 05 Index, scoped to user. The film is 20 s = 5 x 4 s, so frames 1-24 belong to row 01, 25-48 to row 02, and so on.

WHAT THIS VERSION DOES
Each step shows the actual process on a real, readable lab report (the project's own synthetic sample), in the app's own flat Modernist style:
  1  PDF with a text layer ......... the words are copied out of the file, line by line
  2  scanned picture ............... every word is found, boxed (with a confidence bar) and read
  3  chunks with provenance ........ the text is cut into passages; each keeps a red address on a small page
  4  embeddings ..................... each passage becomes a strip of numbers and a dot on a meaning map; similar dots sit close
  5  index scoped to user ........... the dots are stored in MY red panel with a lock; a question's search only reaches my panel
The five-square progress rail at the bottom (red = current) mirrors the five rows on the page.

THE FILES (one prompt each)
  01_STYLE_LOCK_DOCUMENT_TEXT_NEGATIVE.txt   shared look rules, the exact document text, the negative prompt
  02_step1_pdf_text_layer_copied_out.txt
  03_step2_scanned_page_find_boxes_read.txt
  04_step3_cut_into_passages_with_address.txt
  05_step4_numbers_and_meaning_map.txt
  06_step5_your_own_panel_filtered_search.txt
  07_full_20s_one_take.txt                   all five steps in one prompt
  08_keyframes_how_to_use.txt                which pixel-exact image is the first/last frame of which clip
  09_frames_ffmpeg_and_text_fix.txt          make the 120 frames, repair misspelled text, acceptance checklist
  keyframes/K0.png ... K5.png, K1b.png      the seven ready-made 1600 x 1600 images (exact text, app font and colours)
  _old_object_metaphors/                     the first version (magnifier, scissors, stamp, drawer), kept for reference
  4b1316c8-....jpg                           your example image (dark neon style: used only as the reference for WHAT to show)

HOW TO GENERATE
  A) Image-to-video with first/last frame (best results): for each clip give the generator the two images listed at the top of its file, paste its PROMPT and NEGATIVE PROMPT, generate 4 s. Join the five clips.
  B) First-frame only: give only the first image.
  C) Text only: paste the PROMPT; expect some misspelled words and use 09 to repair.
  D) One 20 s take: file 07 with K0 as the first frame.
Always keep the COMPACT PROMPT of the same file ready for tools with a short prompt limit.

DESIGN RULES THAT STAY (same style as before)
Flat #EAE9E9 field, zero radius, one red #EC3013 only for the active thing, no shadows, no glow, no blur, static camera, nothing in the bottom-right corner (the app draws its own "Move - Scroll" tag there), no provider or model names, no invented values (the numbers are the sample report's own and it says they are fictional).

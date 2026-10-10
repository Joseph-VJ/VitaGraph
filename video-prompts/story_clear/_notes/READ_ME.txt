CLEAR VERSION 2: same style, now the video explains what happens in each stage
- Every stage has a big one-word title and a small caption that changes 2-3 times in plain words.
- Embedded shows words -> dials -> a barcode-like strip of coloured cells (the numbers, no digits shown); similar meaning = similar strip.
- Indexed shows strips filed onto shelves by similarity, each tagged with page and owner, in the user's own locked compartment; a search strip goes straight to the closest shelf and lifts out the nearest strips.
- 4 s per stage, 28 s in total.  Frames for the Upload stage (28 s -> exactly 120 frames):  ffmpeg -i story.mp4 -vf "fps=120/28,scale=1600:-2" -q:v 3 frame_%04d.jpg
- Process (backend): received -> extracted (real text copied, picture pages read with OCR) -> chunked (each chunk keeps its page) -> embedded -> indexed (similarity search, scoped to the user) -> graphed -> answer.
- Rule kept: no numbers and no data on screen.

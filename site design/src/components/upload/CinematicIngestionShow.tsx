import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { UseJobStreamReturn } from "../../hooks/useJobStream";
import { getPreferences } from "../../lib/preferences";
import { isReducedMotion } from "../../motion";

export interface CinematicIngestionShowProps {
  isOpen: boolean;
  filename: string;
  jobStream: UseJobStreamReturn;
  userId?: string;
  onClose: () => void;
  onContinueToLibrary?: () => void;
  onContinueToAsk?: () => void;
}

const BASE = [8, 9, 8, 9, 8];
const DUR = [5, 5, 5, 5, 5];

const STAGE_NAMES = ["Parse", "OCR", "Chunk", "Embed", "Index", "Done"];
const STAGE_DESCS = [
  "Each page is tested for a real text layer before anything else touches it.",
  "The scanned page has no text layer, so a second engine reads the image.",
  "The text is cut at sentence boundaries and every piece keeps its address.",
  "Each chunk becomes 384 numbers, so similar passages sit close together.",
  "Vectors go to a user-scoped index. Facts and history go to a database.",
  "The report is searchable.",
];

export const CinematicIngestionShow: React.FC<CinematicIngestionShowProps> = ({
  isOpen,
  filename,
  jobStream,
  userId,
  onClose,
  onContinueToLibrary,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const t0Ref = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  const [currentStage, setCurrentStage] = useState<number>(0);
  const [showDone, setShowDone] = useState<boolean>(false);
  const [stats, setStats] = useState<{ label: string; value: string }>({
    label: "Starting",
    value: "0",
  });
  const [segP, setSegP] = useState<number[]>([0, 0, 0, 0, 0]);

  // Escape key closes overlay
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      t0Ref.current = null;
      lastTickRef.current = 0;
      setCurrentStage(0);
      setShowDone(false);
      setStats({ label: "Starting", value: "0" });
      setSegP([0, 0, 0, 0, 0]);
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    }
  }, [isOpen]);

  const getMultiplier = useCallback((): number => {
    const prefs = getPreferences();
    if (isReducedMotion() || prefs.reduceMotion) return 0.4;
    if (prefs.speed === "fast") return 0.5;
    if (prefs.speed === "slow") return 1.8;
    return 1.0;
  }, []);

  const showTotalDuration = useCallback((): number => {
    const m = getMultiplier();
    return DUR.reduce((a, b) => a + b * m, 0);
  }, [getMultiplier]);

  const skipShow = () => {
    const totalD = showTotalDuration();
    if (jobStream.status === "completed") {
      t0Ref.current = performance.now() - (totalD + 0.1) * 1000;
    } else {
      // Backend is still processing: advance to Index hold
      const m = getMultiplier();
      const dBefore4 = DUR.slice(0, 4).reduce((a, b) => a + b * m, 0);
      t0Ref.current = performance.now() - (dBefore4 + DUR[4] * m * 0.95) * 1000;
    }
  };

  const drawShow = useCallback((now: number) => {
    const el = canvasRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(1, Math.round(r.width));
    const H = Math.max(1, Math.round(r.height));

    if (el.width !== Math.round(W * dpr) || el.height !== Math.round(H * dpr)) {
      el.width = Math.round(W * dpr);
      el.height = Math.round(H * dpr);
    }

    const x = el.getContext("2d");
    if (!x) return;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (t0Ref.current == null) t0Ref.current = now;

    const m = getMultiplier();
    const D = DUR.map((d) => d * m);
    const t = (now - t0Ref.current) / 1000;

    let st = 0;
    let acc = 0;
    while (st < 5 && t >= acc + D[st]) {
      acc += D[st];
      st++;
    }

    const isError = jobStream.status === "error" || Boolean(jobStream.error);
    const backendDone = jobStream.status === "completed";

    // Iron Law: The show never finishes before the backend has finished
    let fin = false;
    let p = 0;
    let u = 0;

    if (isError) {
      st = Math.min(4, st);
      p = 1;
      u = BASE[st];
    } else if (st >= 5) {
      if (backendDone) {
        fin = true;
        st = 5;
        p = 1;
        u = 8;
      } else {
        // Hold at end of stage 4 until backend completes
        st = 4;
        p = 0.99;
        u = 0.99 * BASE[4];
      }
    } else {
      p = (t - acc) / D[st];
      p = Math.min(1, Math.max(0, p));
      u = p * BASE[st];
    }

    const currentSegP = [0, 1, 2, 3, 4].map((i) => (i < st ? 1 : i === st ? p : 0));

    // Canvas coordinate scale helpers
    const css = getComputedStyle(document.documentElement);
    const cr = css.getPropertyValue("--color-bg").trim();
    const ink = css.getPropertyValue("--color-text").trim();
    const ac = css.getPropertyValue("--color-accent").trim();

    const k = H / 1000;
    const L = W * 0.06;
    const RW = W * 0.88;
    const T0 = H * 0.32;

    const cl = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
    const ez = (v: number) => 1 - Math.pow(1 - cl(v, 0, 1), 3);

    const txt = (
      s: string,
      X: number,
      Y: number,
      sz: number,
      wt: number | string,
      color: string,
      al: CanvasTextAlign = "left"
    ) => {
      x.font = `${wt} ${sz * k}px Archivo, system-ui, sans-serif`;
      x.fillStyle = color;
      x.textAlign = al;
      x.fillText(s, X, Y);
    };

    // Background fill & 64k cream grid at 6%
    x.globalAlpha = 1;
    x.fillStyle = ink;
    x.fillRect(0, 0, W, H);

    x.strokeStyle = cr;
    x.lineWidth = 1;
    x.globalAlpha = 0.06;
    for (let gridX = 0; gridX < W; gridX += 64 * k) {
      x.beginPath();
      x.moveTo(gridX, 0);
      x.lineTo(gridX, H);
      x.stroke();
    }
    for (let gridY = 0; gridY < H; gridY += 64 * k) {
      x.beginPath();
      x.moveTo(0, gridY);
      x.lineTo(W, gridY);
      x.stroke();
    }
    x.globalAlpha = 1;

    const hatch = (X: number, Y: number, w: number, h: number, a: number) => {
      x.save();
      x.beginPath();
      x.rect(X, Y, w, h);
      x.clip();
      x.strokeStyle = ac;
      x.globalAlpha = a;
      x.lineWidth = 3 * k;
      for (let gh = -h; gh < w; gh += 16 * k) {
        x.beginPath();
        x.moveTo(X + gh, Y + h);
        x.lineTo(X + gh + h, Y);
        x.stroke();
      }
      x.restore();
      x.globalAlpha = 1;
    };

    // Gather real upload job event data
    const pageExtractedEvents = jobStream.events.filter(
      (e) => e.stage === "extracting" || e.stage === "page_extracted"
    );
    const extractedEvent = jobStream.events.find((e) => e.stage === "extracted");
    const chunkedEvent = jobStream.events.find((e) => e.stage === "chunked");
    const indexedEvent = jobStream.events.find((e) => e.stage === "indexed");
    const receivedEvent = jobStream.events.find((e) => e.stage === "received");

    const pagesMeta = (extractedEvent?.metadata?.pages as Array<{
      page_number: number;
      method: string;
      quality: string;
      chars: number;
    }>) || [];

    let pageCount = pagesMeta.length;
    if (!pageCount && pageExtractedEvents.length > 0) {
      const maxPage = Math.max(...pageExtractedEvents.map((e) => Number(e.metadata?.page_number) || 0));
      const totPage = Number(pageExtractedEvents[0]?.metadata?.total_pages) || 0;
      pageCount = totPage || maxPage || 5;
    }
    if (!pageCount) pageCount = 5;

    let PC: number[] = [];
    let scanFlags: boolean[] = [];
    if (pagesMeta.length > 0) {
      PC = pagesMeta.map((p) => Number(p.chars) || 1000);
      scanFlags = pagesMeta.map((p) => p.method === "ocr" || p.quality === "uncertain");
    } else if (pageExtractedEvents.length > 0) {
      PC = pageExtractedEvents.map((e) => Number(e.metadata?.chars) || 1000);
      scanFlags = pageExtractedEvents.map(
        (e) => e.metadata?.method === "ocr" || e.metadata?.quality === "uncertain"
      );
    }
    while (PC.length < 5) {
      const fallback = [1284, 1102, 968, 1347, 312];
      PC.push(fallback[PC.length]);
      scanFlags.push(false);
    }
    const TOT = PC.reduce((a, b) => a + b, 0) || 5013;

    const ocrPages = pagesMeta.filter((p) => p.method === "ocr");
    let hasScanned = ocrPages.length > 0;
    let ocrCharsTotal = ocrPages.reduce((acc, p) => acc + (Number(p.chars) || 0), 0);
    if (pagesMeta.length === 0 && pageExtractedEvents.length > 0) {
      const ocrEvents = pageExtractedEvents.filter((e) => e.metadata?.method === "ocr");
      if (ocrEvents.length > 0) {
        hasScanned = true;
        ocrCharsTotal = ocrEvents.reduce((acc, e) => acc + (Number(e.metadata?.chars) || 0), 0);
      }
    }

    // Chunks count
    const totalChunksMeta = Number(
      chunkedEvent?.metadata?.total_chunks || chunkedEvent?.metadata?.chunk_count
    );
    const prefChunkSize = getPreferences().chunkSize || 200;
    const nC = totalChunksMeta || Math.round(TOT / prefChunkSize) || 24;
    const realChunks = (chunkedEvent?.metadata?.chunks as Array<{
      chunk_id: string;
      page_number: number;
      char_start: number;
      char_end: number;
      section: string;
      chars: number;
    }>) || [];

    const effectiveUserId =
      userId ||
      (indexedEvent?.metadata?.user_id as string) ||
      (typeof window !== "undefined" ? localStorage.getItem("vitagraph_user_id") || "" : "");
    const fileHash = (receivedEvent?.metadata?.file_hash as string) || "";

    let currentStats = { label: "Starting", value: "0" };

    if (isError) {
      x.globalAlpha = 1;
      txt("Quarantined.", L, H * 0.65, 140, 800, ac);
      txt(
        jobStream.error || "Corrupted document structure or unreadable text layers.",
        L,
        H * 0.76,
        26,
        600,
        cr
      );
      txt("The report was quarantined for privacy and safety.", L, H * 0.83, 22, 600, ac);
      currentStats = { label: "Status", value: "Quarantined" };
    } else if (st === 0) {
      const pw = RW * 0.15;
      const gap = (RW - 5 * pw) / 4;
      const ph = H * 0.38;
      const y0 = T0 + H * 0.03;
      let got = 0;

      for (let i = 0; i < 5; i++) {
        const e = ez((u - 0.3 - i * 0.3) / 0.8);
        const px = L + i * (pw + gap);
        const py = y0 + (1 - e) * 60 * k;
        const sw = cl((u - (1.2 + i * 1.2)) / 1.0, 0, 1);
        const scan = scanFlags[i] ?? i === 4;
        const got1 = (scan ? 0 : PC[i]) * sw;

        x.globalAlpha = e;
        x.fillStyle = cr;
        x.fillRect(px, py, pw, ph);

        x.fillStyle = ink;
        x.fillRect(px + 12 * k, py + 12 * k, pw * 0.45, 10 * k);

        for (let j = 0; j < 14; j++) {
          const ly = py + 44 * k + (j * (ph - 70 * k)) / 14;
          const lit = j / 14 < sw;
          x.globalAlpha = e * (lit ? 1 : 0.28);
          x.fillStyle = lit && !scan ? ac : ink;
          x.fillRect(
            px + 12 * k,
            ly,
            pw * (0.5 + 0.4 * Math.abs(Math.sin(j * 3.1 + i))) - 20 * k,
            5 * k
          );
        }

        if (scan) {
          x.globalAlpha = e * 0.4;
          x.fillStyle = ink;
          for (let a = 0; a < 70; a++) {
            x.fillRect(
              px + (((a * 37) % 100) / 100) * pw,
              py + (((a * 61) % 100) / 100) * ph,
              2.5 * k,
              2.5 * k
            );
          }
          if (sw >= 1) {
            x.globalAlpha = e;
            hatch(px, py, pw, ph, 0.55);
            x.fillStyle = ink;
            x.fillRect(px + pw * 0.08, py + ph * 0.42, pw * 0.84, 40 * k);
            txt("NO TEXT LAYER", px + pw / 2, py + ph * 0.42 + 28 * k, 19, 800, ac, "center");
          }
        }

        if (sw > 0 && sw < 1) {
          x.globalAlpha = 1;
          x.fillStyle = ac;
          x.fillRect(px - 6 * k, py + sw * ph, pw + 12 * k, 4 * k);
        }

        x.globalAlpha = e;
        txt("p." + (i + 1), px, py + ph + 40 * k, 30, 800, cr);
        if (sw > 0) {
          txt(
            scan
              ? sw >= 1
                ? "goes to OCR"
                : "checking"
              : Math.round(got1).toLocaleString("en-US") + " chars",
            px,
            py + ph + 74 * k,
            22,
            600,
            scan && sw >= 1 ? ac : cr
          );
        }
        got += got1;
      }

      x.globalAlpha = 0.25;
      x.fillStyle = cr;
      x.fillRect(L, H * 0.88, RW, 12 * k);
      x.globalAlpha = 1;
      x.fillStyle = ac;
      x.fillRect(L, H * 0.88, (RW * got) / TOT, 12 * k);

      currentStats = {
        label: "Characters from the text layer",
        value: Math.round(got).toLocaleString("en-US"),
      };
    } else if (st === 1) {
      if (!hasScanned || ocrCharsTotal === 0) {
        txt("No scanned pages in this report.", L, T0 + H * 0.16, 32, 800, cr);
        txt("All pages contained readable text layers.", L, T0 + H * 0.16 + 40 * k, 20, 600, cr);
        txt("Optical character recognition was skipped.", L, T0 + H * 0.16 + 72 * k, 18, 400, ac);
        currentStats = { label: "Characters read by OCR", value: "0" };
      } else {
        const SW = RW * 0.36;
        const SH = H * 0.56;
        const OL = [
          "ADDENDUM — SCANNED ATTACHMENT",
          "Date of collection 14 Feb 2026",
          "Platelet count (manual) 245,000 /µL",
          "Reference 150,000 - 450,000 /µL",
          "Smear: normocytic, normochromic",
          "Verified by: Lab Tech 0412",
          "Remarks: no abnormal cells seen",
          "End of report",
        ];
        const CF = [0.97, 0.96, 0.95, 0.97, 0.93, 0.68, 0.94, 0.99];

        const tl = (i: number) => 1.0 + 6.3 * cl((0.13 + 0.105 * i - 0.06) / 0.89, 0, 1);
        let chars = 0;

        x.save();
        x.translate(L + SW / 2, T0 + SH / 2 + 10 * k);
        x.rotate(-0.018);
        x.translate(-SW / 2, -SH / 2);

        x.globalAlpha = 0.93;
        x.fillStyle = cr;
        x.fillRect(0, 0, SW, SH);

        x.globalAlpha = 0.35;
        x.fillStyle = ink;
        for (let a = 0; a < 260; a++) {
          x.fillRect(((a * 53) % 100) / 100 * SW, ((a * 29) % 100) / 100 * SH, 2 * k, 2 * k);
        }

        OL.forEach((s, i) => {
          const ly = SH * (0.10 + 0.105 * i);
          const lw = Math.min(SW * 0.9, s.length * 13.5 * k);
          const on = u >= tl(i);
          x.globalAlpha = 0.6;
          x.fillStyle = ink;
          x.fillRect(SW * 0.06, ly + 4 * k, lw, 16 * k);
          if (on) {
            x.globalAlpha = 1;
            x.strokeStyle = ac;
            x.lineWidth = 3 * k;
            x.strokeRect(SW * 0.06 - 6 * k, ly - 2 * k, lw + 12 * k, 30 * k);
            x.fillStyle = i === 5 ? ac : ink;
            x.fillRect(SW * 0.06 + lw - 36 * k, ly - 24 * k, 48 * k, 22 * k);
            txt(CF[i].toFixed(2), SW * 0.06 + lw - 12 * k, ly - 8 * k, 15, 800, cr, "center");
          }
        });

        const bf = cl((u - 1.0) / 6.3, 0, 1);
        if (bf > 0 && bf < 1) {
          x.globalAlpha = 1;
          x.fillStyle = ac;
          x.fillRect(-8 * k, SH * (0.06 + 0.89 * bf), SW + 16 * k, 5 * k);
        }
        x.restore();
        x.globalAlpha = 1;

        const X2 = L + SW + RW * 0.06;
        OL.forEach((s, i) => {
          const n = Math.floor(cl((u - tl(i)) * 34, 0, s.length));
          chars += n;
          const ry = T0 + 36 * k + i * (SH / 8.2);
          txt(s.slice(0, n), X2, ry, 30, 800, i === 5 ? ac : cr);
          if (n >= s.length) {
            txt(
              i === 5 ? "conf " + CF[i].toFixed(2) + "  needs review" : "conf " + CF[i].toFixed(2),
              X2,
              ry + 26 * k,
              19,
              600,
              i === 5 ? ac : cr
            );
          }
        });

        const displayedOcr = Math.min(ocrCharsTotal, Math.round(cl((u - 1.0) / 6.3, 0, 1) * ocrCharsTotal));
        currentStats = { label: "Characters read by OCR", value: String(displayedOcr) };
      }
    } else if (st === 2) {
      const cols = 8;
      const rows = Math.ceil(nC / cols);
      const gap = 14 * k;
      const cw = (RW - 7 * gap) / cols;
      const gt = T0 + H * 0.1;
      const chh = Math.min(H * 0.15, (H * 0.9 - gt - (rows - 1) * gap) / rows);
      const len = TOT / nC;
      let made = 0;

      x.globalAlpha = 0.9;
      x.fillStyle = cr;
      x.fillRect(L, T0, RW, 30 * k);

      x.globalAlpha = 0.5;
      x.fillStyle = ink;
      for (let a = 0; a < RW; a += 7 * k) {
        x.fillRect(L + a, T0 + 6 * k, 2 * k, 18 * k);
      }

      for (let i = 0; i < nC; i++) {
        const ti = 0.8 + i * (5 / nC);
        const e = ez((u - ti) / 0.5);
        const col2 = i % cols;
        const row = Math.floor(i / cols);
        const cx0 = L + col2 * (cw + gap);
        const cy0 = gt + row * (chh + gap) - (1 - e) * 50 * k;
        if (e > 0) made++;
        if (i < nC - 1 && u >= ti) {
          x.globalAlpha = 1;
          x.fillStyle = ac;
          x.fillRect(L + (RW * (i + 1)) / nC - 1.5 * k, T0 - 6 * k, 3 * k, 42 * k);
        }
        if (e <= 0) continue;
        x.globalAlpha = e;
        x.fillStyle = cr;
        x.fillRect(cx0, cy0, cw, chh);

        const rChunk = realChunks[i];
        const s0 = rChunk ? rChunk.char_start : Math.round(i * len);
        const s1 = rChunk ? rChunk.char_end : Math.min(TOT - 1, Math.round((i + 1) * len) - 1);
        const pg = rChunk
          ? rChunk.page_number
          : s0 < 1284
            ? 1
            : s0 < 2386
              ? 2
              : s0 < 3354
                ? 3
                : s0 < 4701
                  ? 4
                  : 5;

        txt("c" + String(i + 1).padStart(2, "0"), cx0 + 12 * k, cy0 + 34 * k, 26, 800, ink);
        txt("p." + pg, cx0 + cw - 12 * k, cy0 + 34 * k, 20, 800, ink, "right");
        txt(s0 + "–" + s1, cx0 + 12 * k, cy0 + 64 * k, 20, 600, ink);
        if (u > 6) {
          x.globalAlpha = e;
          txt((1 + ((i * 7) % 4)) + " entities", cx0 + 12 * k, cy0 + chh - 14 * k, 19, 800, ac);
        }
      }
      currentStats = { label: "Chunks with page and character spans", value: `${made} / ${nC}` };
    } else if (st === 3) {
      const cs = Math.min((RW * 0.5) / 48, H * 0.035);
      const sx = L + RW * 0.2;
      const nF = Math.floor(cl((u - 0.8) / 3.0, 0, 1) * 384);
      const hv = (a: number, b: number) => {
        const q = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
        return (q - Math.floor(q)) * 2 - 1;
      };

      txt("c07", L, T0 + 4 * k + cs * 2.2, 54, 800, cr);
      txt("384 numbers", L, T0 + cs * 2.2 + 40 * k, 22, 600, cr);

      for (let i = 0; i < 384; i++) {
        const px = sx + (i % 48) * cs;
        const py = T0 + Math.floor(i / 48) * cs;
        if (i < nF) {
          const v = hv(6, i);
          x.globalAlpha = 0.2 + 0.8 * Math.abs(v);
          x.fillStyle = v > 0 ? ac : cr;
          x.fillRect(px, py, cs - 2 * k, cs - 2 * k);
        } else {
          x.globalAlpha = 0.12;
          x.strokeStyle = cr;
          x.lineWidth = 1;
          x.strokeRect(px + 0.5, py + 0.5, cs - 3 * k, cs - 3 * k);
        }
      }

      const my = T0 + 8 * cs + H * 0.07;
      const cwm = RW / 96;
      const chm = Math.min(H * 0.022, (H * 0.9 - my) / nC);
      const nM = Math.floor(cl((u - 4.0) / 4.2, 0, 1) * nC * 96);

      for (let rr = 0; rr < nC; rr++) {
        for (let kk = 0; kk < 96; kk++) {
          const px = L + kk * cwm;
          const py = my + rr * chm;
          if (rr * 96 + kk < nM) {
            const v = hv(rr, kk * 4);
            x.globalAlpha = 0.15 + 0.85 * Math.abs(v);
            x.fillStyle = v > 0 ? ac : cr;
            x.fillRect(px, py, cwm - 1, chm - 1.5);
          } else {
            x.globalAlpha = 0.08;
            x.fillStyle = cr;
            x.fillRect(px, py, cwm - 1, chm - 1.5);
          }
        }
      }

      currentStats = {
        label: "Floats written",
        value: (Math.max(nF, 0) + nM * 4).toLocaleString("en-US"),
      };
    } else if (st === 4) {
      const gap = 24 * k;
      const bw = (RW - 2 * gap) / 3;
      const bh = H * 0.32;
      let placed = 0;
      const userIds = [effectiveUserId, "VG-2026-014", "VG-2026-027"];

      for (let b = 0; b < 3; b++) {
        const bx = L + b * (bw + gap);
        const mine = b === 0;
        const n = mine ? nC : 18;

        x.globalAlpha = 1;
        x.strokeStyle = mine ? ac : cr;
        x.lineWidth = (mine ? 5 : 2) * k;
        if (!mine) x.setLineDash([8 * k, 8 * k]);
        x.strokeRect(bx, T0, bw, bh);
        x.setLineDash([]);

        txt("user_id " + userIds[b], bx + 16 * k, T0 + 36 * k, 24, 800, mine ? ac : cr);

        const dc = Math.max(6, Math.floor((bw - 32 * k) / (34 * k)));
        for (let i = 0; i < n; i++) {
          const ti = 0.6 + i * (2.6 / n);
          const e = mine ? ez((u - ti) / 0.5) : 1;
          const dx = bx + 24 * k + (i % dc) * 34 * k;
          const dy = T0 + 70 * k + Math.floor(i / dc) * 34 * k - (1 - e) * 120 * k;
          if (mine && e > 0) placed++;
          const hit = mine && u > 4.6 && [3, 7, 8, 14, 19].includes(i);
          x.globalAlpha = mine ? e : 0.5;
          x.fillStyle = hit ? ac : mine ? cr : cr;
          x.beginPath();
          x.arc(dx, dy, hit ? 10 * k : 8 * k, 0, 6.2832);
          x.fill();
        }

        if (!mine) {
          hatch(bx, T0, bw, bh, cl((u - 4.2) / 0.6, 0, 1) * 0.35);
          if (u > 4.6) {
            x.globalAlpha = 1;
            x.fillStyle = cr;
            x.fillRect(bx + 16 * k, T0 + bh - 46 * k, 190 * k, 32 * k);
            txt("FILTERED OUT", bx + 24 * k, T0 + bh - 23 * k, 20, 800, ink);
          }
        }
      }

      const qy = T0 + bh + 40 * k;
      x.globalAlpha = cl((u - 4.0) / 0.5, 0, 1);
      x.fillStyle = cr;
      x.fillRect(L, qy, RW, 52 * k);
      txt(
        `query(where={"user_id": "${effectiveUserId}"}, n_results=5)`,
        L + 20 * k,
        qy + 35 * k,
        26,
        800,
        ink
      );

      const hashShort = fileHash
        ? fileHash.length > 16
          ? fileHash.slice(0, 4) + "…" + fileHash.slice(-4)
          : fileHash
        : "9f2c…e41a";
      const AU = [
        `audit_log  upload.accepted       sha256 ${hashShort}`,
        `audit_log  chunks.indexed        ${nC} · user_id ${effectiveUserId}`,
        `audit_log  embeddings.upserted   ${nC} × 384`,
      ];
      x.globalAlpha = 1;
      AU.forEach((s2, i) => {
        const n = Math.floor(cl((u - (5.2 + i * 0.9)) * 40, 0, s2.length));
        txt(s2.slice(0, n), L, qy + 110 * k + i * 40 * k, 24, 600, cr);
      });

      currentStats = { label: "Vectors in the user collection", value: `${placed} / ${nC}` };
    } else {
      x.globalAlpha = 1;
      txt("Indexed.", L, H * 0.7, 230, 800, cr);
      txt(
        `${nC} chunks · ${nC} × 384 vectors · scoped to ${effectiveUserId}`,
        L,
        H * 0.8,
        34,
        600,
        ac
      );
      txt("Ready for questions, the graph and the timeline.", L, H * 0.87, 28, 600, cr);
      currentStats = { label: "Status", value: "Ready" };
    }

    x.globalAlpha = 1;

    // Throttle React state updates to ~160ms for HUD
    if (now - lastTickRef.current > 160) {
      lastTickRef.current = now;
      setCurrentStage(st);
      setShowDone(fin);
      setStats(currentStats);
      setSegP(currentSegP);
    }
  }, [getMultiplier, jobStream, userId]);

  useEffect(() => {
    if (!isOpen) return;
    let animId = 0;
    const loop = (now: number) => {
      drawShow(now);
      animId = requestAnimationFrame(loop);
      rafRef.current = animId;
    };
    animId = requestAnimationFrame(loop);
    rafRef.current = animId;

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isOpen, drawShow]);

  if (!isOpen) return null;

  const si = Math.min(5, currentStage);
  const isError = jobStream.status === "error" || Boolean(jobStream.error);
  const showRunning = !showDone && !isError;

  const hasScannedInJob = jobStream.events.some(
    (e) =>
      (e.stage === "extracted" &&
        (e.metadata?.pages as Array<{ method?: string }> | undefined)?.some(
          (p) => p.method === "ocr"
        )) ||
      (e.stage === "page_extracted" && e.metadata?.method === "ocr")
  );

  const showN = isError ? "05" : String(Math.min(5, si + 1)).padStart(2, "0");
  const showName = isError ? "Quarantined" : STAGE_NAMES[si];
  const showDesc = isError
    ? jobStream.error || "The report could not be processed."
    : si === 1 && !hasScannedInJob
    ? "No scanned pages in this report."
    : STAGE_DESCS[si];

  const showSegs = ["Parse", "OCR", "Chunk", "Embed", "Index"].map((label, i) => ({
    label,
    progress: segP[i] || 0,
  }));

  const handleOpenReport = () => {
    onClose();
    if (onContinueToLibrary) {
      onContinueToLibrary();
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "var(--color-text)",
        color: "var(--color-bg)",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />

      {/* Top HUD */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "clamp(20px, 3.5vw, 56px)",
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-6)",
          justifyContent: "space-between",
          alignItems: "flex-start",
          pointerEvents: "none",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "clamp(3rem, 8vw, 8rem)",
              fontWeight: 800,
              lineHeight: 0.9,
              letterSpacing: "-0.05em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {showN}
            <span style={{ color: "var(--color-neutral-600)" }}>/05</span>
          </div>
          <div
            style={{
              fontSize: "clamp(1.75rem, 3.4vw, 3.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginTop: "var(--space-2)",
            }}
          >
            {showName}
          </div>
          <div
            style={{
              fontSize: "clamp(1rem, 1.5vw, 1.5rem)",
              maxWidth: "48ch",
              color: "var(--color-neutral-300)",
              marginTop: "var(--space-1)",
            }}
          >
            {showDesc}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-neutral-400)",
            }}
          >
            {stats.label}
          </div>
          <div
            style={{
              fontSize: "clamp(2.5rem, 6vw, 6rem)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              color: "var(--color-accent-400)",
            }}
          >
            {stats.value}
          </div>
        </div>
      </div>

      {/* Bottom HUD */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "clamp(16px, 2.5vw, 40px)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          {showSegs.map((g, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div
                style={{
                  height: "6px",
                  background: "color-mix(in srgb, var(--color-bg) 22%, transparent)",
                }}
              >
                <div
                  style={{
                    height: "6px",
                    background: "var(--color-accent)",
                    width: `${Math.round(g.progress * 100)}%`,
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--color-neutral-400)",
                }}
              >
                {g.label}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <span style={{ fontSize: "0.875rem", color: "var(--color-neutral-400)" }}>
            {filename}
          </span>
          <span style={{ display: "flex", gap: "var(--space-2)" }}>
            {showRunning && (
              <button
                className="btn"
                onClick={skipShow}
                style={{ borderColor: "var(--color-neutral-600)", color: "var(--color-bg)" }}
              >
                Skip ahead
              </button>
            )}
            {showDone && (
              <button
                className="btn btn-primary"
                onClick={handleOpenReport}
                style={{ gap: "var(--space-6)" }}
              >
                Open the report{" "}
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  style={{
                    strokeWidth: 2,
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                  }}
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            )}
            <button
              className="btn"
              onClick={onClose}
              style={{ borderColor: "var(--color-neutral-600)", color: "var(--color-bg)" }}
            >
              Close
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
};

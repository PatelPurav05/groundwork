"use client";

/**
 * Lens illustrations (Clayzo). Rest frame by default; plays once when
 * `playing` turns true and settles back onto the same rest frame by itself.
 *
 * - First paint (and SSR) is the inline SVG of the resting frame.
 * - On mount it lazy-imports the WebGL player shell and fetches
 *   /clayzo/lenses/<id>.json; the player fetches its engine only near the
 *   viewport, and its canvas fades in over the SVG poster.
 * - Any failure (no WebGL2, fetch error, import error) leaves the SVG.
 * - Reduced motion: the player shows each state's last frame, which is the
 *   resting picture, so nothing moves.
 *
 * Sources: clayzo/lenses/*.ts, built by `npx tsx clayzo/build.ts`.
 */
import { useEffect, useRef, useState, type ComponentType } from "react";
import clsx from "clsx";
import type { AnimationDocument, PlayerHandle } from "@clayzo/webgl-player";
import type { ClayzoPlayerProps } from "@clayzo/webgl-player/react";

export type LensId = "faith" | "public" | "commercial" | "starter" | "backyard";

type PlayerComponent = ComponentType<ClayzoPlayerProps>;

let playerShell: Promise<PlayerComponent> | null = null;
function loadPlayer(): Promise<PlayerComponent> {
  playerShell ??= import("@clayzo/webgl-player/react").then((m) => m.ClayzoPlayer as PlayerComponent);
  playerShell.catch(() => (playerShell = null));
  return playerShell;
}

const documents = new Map<LensId, Promise<AnimationDocument>>();
function loadDocument(id: LensId): Promise<AnimationDocument> {
  let pending = documents.get(id);
  if (!pending) {
    pending = fetch(`/clayzo/lenses/${id}.json`).then((res) => {
      if (!res.ok) throw new Error(`lens ${id}: HTTP ${res.status}`);
      return res.json() as Promise<AnimationDocument>;
    });
    pending.catch(() => documents.delete(id));
    documents.set(id, pending);
  }
  return pending;
}

// Stable object so re-renders never rebuild the player.
const PLAYER_OPTIONS = { interactive: false, maxPixelRatio: 2 } as const;

function startPlay(player: PlayerHandle) {
  try {
    if (player.currentState?.name !== "play") player.setState("play");
  } catch {
    // A document without the "play" state: stay on the resting frame.
  }
}

export function LensArt({ id, playing, className }: { id: LensId; playing: boolean; className?: string }) {
  const [loaded, setLoaded] = useState<{ id: LensId; Player: PlayerComponent; document: AnimationDocument } | null>(null);
  const [failedId, setFailedId] = useState<LensId | null>(null);
  const handle = useRef<PlayerHandle | null>(null);
  const playingRef = useRef(playing);

  useEffect(() => {
    let alive = true;
    Promise.all([loadPlayer(), loadDocument(id)])
      .then(([Player, document]) => alive && setLoaded({ id, Player, document }))
      .catch(() => alive && setFailedId(id));
    return () => {
      alive = false;
      handle.current = null;
    };
  }, [id]);

  useEffect(() => {
    playingRef.current = playing;
    if (playing && handle.current) startPlay(handle.current);
  }, [playing]);

  const still = (
    <span
      aria-hidden="true"
      className="block size-full [&>svg]:block [&>svg]:size-full"
      dangerouslySetInnerHTML={{ __html: FALLBACK_SVG[id] }}
    />
  );
  const ready = loaded && loaded.id === id && failedId !== id;

  return (
    <div className={clsx("relative aspect-square", className)} aria-hidden="true">
      {ready ? (
        <loaded.Player
          document={loaded.document}
          options={PLAYER_OPTIONS}
          poster={still}
          posterTick={0}
          fallback={still}
          decorative
          style={{ width: "100%", height: "100%" }}
          onReady={(player) => {
            handle.current = player;
            if (playingRef.current) startPlay(player);
          }}
          onPlayerError={() => setFailedId(id)}
        />
      ) : (
        still
      )}
    </div>
  );
}

// @generated-fallbacks-start (clayzo/build.ts writes this block)
const FALLBACK_SVG: Record<LensId, string> = {
  "faith": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 288 288\" width=\"100%\" height=\"100%\" aria-hidden=\"true\" focusable=\"false\"><g transform=\"translate(144 214)\"><rect x=\"-120\" y=\"-20\" width=\"240\" height=\"40\" rx=\"16\" fill=\"#e7e2d8\"/></g><g><path d=\"M108.32 43.63C109.24 41.63 110.76 41.63 111.68 43.63L121.32 64.37C122.24 66.37 123 69.8 123 72L123 108C123 110.2 121.2 112 119 112L101 112C98.8 112 97 110.2 97 108L97 72C97 69.8 97.76 66.37 98.68 64.37L108.32 43.63Z\" fill=\"#1b1a17\"/></g><g><path d=\"M75 208C71.15 208 68 204.85 68 201L68 141C68 137.15 70.39 131.95 73.31 129.44L104.69 102.56C107.61 100.05 112.39 100.05 115.31 102.56L146.69 129.44C149.61 131.95 152 137.15 152 141L152 201C152 204.85 148.85 208 145 208L75 208Z\" fill=\"#1b1a17\"/></g><g transform=\"translate(110 146)\"><ellipse cx=\"0\" cy=\"0\" rx=\"9\" ry=\"9\" fill=\"#f5f2ec\"/></g><g transform=\"translate(110 192)\"><rect x=\"-12\" y=\"-18\" width=\"24\" height=\"36\" rx=\"11\" fill=\"#f5f2ec\"/></g><g transform=\"translate(204 208) translate(-204 -208)\"><g><g><path d=\"M182 208C178.7 208 176 205.3 176 202L176 166C176 162.7 177.98 158.16 180.4 155.92L199.6 138.08C202.02 135.84 205.98 135.84 208.4 138.08L227.6 155.92C230.02 158.16 232 162.7 232 166L232 202C232 205.3 229.3 208 226 208L182 208Z\" fill=\"#c8553a\"/></g><g transform=\"translate(204 206) translate(0 -12)\"><rect x=\"-7\" y=\"-12\" width=\"14\" height=\"24\" rx=\"5\" fill=\"#f5f2ec\"/></g></g></g></svg>",
  "public": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 288 288\" width=\"100%\" height=\"100%\" aria-hidden=\"true\" focusable=\"false\"><g transform=\"translate(144 204)\"><rect x=\"-118\" y=\"-28\" width=\"236\" height=\"56\" rx=\"18\" fill=\"#e1efe6\"/></g><g transform=\"translate(82 152)\"><rect x=\"-3.5\" y=\"-56\" width=\"7\" height=\"112\" rx=\"3.5\" fill=\"#1b1a17\"/></g><g transform=\"translate(84 115) translate(-84 -115)\"><path d=\"M84 102C84 99.8 85.8 98 88 98L130 98C132.2 98 132.96 99.47 131.69 101.27L124.31 111.73C123.04 113.53 123.04 116.47 124.31 118.27L131.69 128.73C132.96 130.53 132.2 132 130 132L88 132C85.8 132 84 130.2 84 128L84 102Z\" fill=\"#c8553a\"/></g><g transform=\"translate(190 206) translate(-190 -206)\"><g><g><path d=\"M159 206C155.15 206 152 202.85 152 199L152 159C152 155.15 154.41 149.97 157.35 147.49L184.65 124.51C187.59 122.03 192.41 122.03 195.35 124.51L222.65 147.49C225.59 149.97 228 155.15 228 159L228 199C228 202.85 224.85 206 221 206L159 206Z\" fill=\"#c8553a\"/></g><g transform=\"translate(190 205) translate(0 -13)\"><rect x=\"-9\" y=\"-13\" width=\"18\" height=\"26\" rx=\"6\" fill=\"#f5f2ec\"/></g></g></g></svg>",
  "commercial": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 288 288\" width=\"100%\" height=\"100%\" aria-hidden=\"true\" focusable=\"false\"><g transform=\"translate(144 226)\"><rect x=\"-122\" y=\"-18\" width=\"244\" height=\"36\" rx=\"14\" fill=\"#e7e2d8\"/></g><g transform=\"translate(144 140)\"><rect x=\"-68\" y=\"-68\" width=\"136\" height=\"136\" rx=\"10\" fill=\"#1b1a17\"/></g><g transform=\"translate(144 188)\"><rect x=\"-56\" y=\"-11\" width=\"112\" height=\"22\" rx=\"6\" fill=\"#f6e2da\"/></g><g transform=\"translate(112 100)\"><rect x=\"-11\" y=\"-10\" width=\"22\" height=\"20\" rx=\"5\" fill=\"#c8553a\"/></g><g transform=\"translate(144 100)\"><rect x=\"-11\" y=\"-10\" width=\"22\" height=\"20\" rx=\"5\" fill=\"#c8553a\"/></g><g transform=\"translate(176 100)\"><rect x=\"-11\" y=\"-10\" width=\"22\" height=\"20\" rx=\"5\" fill=\"#c8553a\"/></g><g transform=\"translate(112 136)\"><rect x=\"-11\" y=\"-10\" width=\"22\" height=\"20\" rx=\"5\" fill=\"#c8553a\"/></g><g transform=\"translate(144 136)\"><rect x=\"-11\" y=\"-10\" width=\"22\" height=\"20\" rx=\"5\" fill=\"#c8553a\"/></g><g transform=\"translate(176 136)\"><rect x=\"-11\" y=\"-10\" width=\"22\" height=\"20\" rx=\"5\" fill=\"#c8553a\"/></g></svg>",
  "starter": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 288 288\" width=\"100%\" height=\"100%\" aria-hidden=\"true\" focusable=\"false\"><defs><clipPath id=\"lens-starter-lotClip\"><g transform=\"translate(144 150)\"><rect x=\"-108\" y=\"-78\" width=\"216\" height=\"156\" rx=\"22\"/></g></clipPath></defs><g><g clip-path=\"url(#lens-starter-lotClip)\"><g transform=\"translate(68.67 108.5)\"><rect x=\"-32.67\" y=\"-36.5\" width=\"65.33\" height=\"73\" rx=\"12\" fill=\"#e1efe6\"/></g><g transform=\"translate(144 108.5)\"><rect x=\"-32.67\" y=\"-36.5\" width=\"65.33\" height=\"73\" rx=\"12\" fill=\"#e1efe6\"/></g><g transform=\"translate(219.33 108.5)\"><rect x=\"-32.67\" y=\"-36.5\" width=\"65.33\" height=\"73\" rx=\"12\" fill=\"#e1efe6\"/></g><g transform=\"translate(68.67 191.5)\"><rect x=\"-32.67\" y=\"-36.5\" width=\"65.33\" height=\"73\" rx=\"12\" fill=\"#e1efe6\"/></g><g transform=\"translate(144 191.5)\"><rect x=\"-32.67\" y=\"-36.5\" width=\"65.33\" height=\"73\" rx=\"12\" fill=\"#e1efe6\"/></g><g transform=\"translate(219.33 191.5)\"><rect x=\"-32.67\" y=\"-36.5\" width=\"65.33\" height=\"73\" rx=\"12\" fill=\"#e1efe6\"/></g></g></g><g transform=\"translate(68.67 127.5) translate(-68.67 -127.5)\"><path d=\"M56.67 127.5C54.47 127.5 52.67 125.7 52.67 123.5L52.67 111.5C52.67 109.3 54.02 106.31 55.68 104.87L65.66 96.13C67.31 94.69 70.02 94.69 71.68 96.13L81.66 104.87C83.31 106.31 84.67 109.3 84.67 111.5L84.67 123.5C84.67 125.7 82.87 127.5 80.67 127.5L56.67 127.5Z\" fill=\"#c8553a\"/></g><g transform=\"translate(144 127.5) translate(-144 -127.5)\"><path d=\"M132 127.5C129.8 127.5 128 125.7 128 123.5L128 111.5C128 109.3 129.35 106.31 131.01 104.87L140.99 96.13C142.65 94.69 145.35 94.69 147.01 96.13L156.99 104.87C158.65 106.31 160 109.3 160 111.5L160 123.5C160 125.7 158.2 127.5 156 127.5L132 127.5Z\" fill=\"#c8553a\"/></g><g transform=\"translate(219.33 127.5) translate(-219.33 -127.5)\"><path d=\"M207.33 127.5C205.13 127.5 203.33 125.7 203.33 123.5L203.33 111.5C203.33 109.3 204.69 106.31 206.34 104.87L216.32 96.13C217.98 94.69 220.69 94.69 222.34 96.13L232.32 104.87C233.98 106.31 235.33 109.3 235.33 111.5L235.33 123.5C235.33 125.7 233.53 127.5 231.33 127.5L207.33 127.5Z\" fill=\"#c8553a\"/></g><g transform=\"translate(68.67 210.5) translate(-68.67 -210.5)\"><path d=\"M56.67 210.5C54.47 210.5 52.67 208.7 52.67 206.5L52.67 194.5C52.67 192.3 54.02 189.31 55.68 187.87L65.66 179.13C67.31 177.69 70.02 177.69 71.68 179.13L81.66 187.87C83.31 189.31 84.67 192.3 84.67 194.5L84.67 206.5C84.67 208.7 82.87 210.5 80.67 210.5L56.67 210.5Z\" fill=\"#c8553a\"/></g><g transform=\"translate(144 210.5) translate(-144 -210.5)\"><path d=\"M132 210.5C129.8 210.5 128 208.7 128 206.5L128 194.5C128 192.3 129.35 189.31 131.01 187.87L140.99 179.13C142.65 177.69 145.35 177.69 147.01 179.13L156.99 187.87C158.65 189.31 160 192.3 160 194.5L160 206.5C160 208.7 158.2 210.5 156 210.5L132 210.5Z\" fill=\"#c8553a\"/></g><g transform=\"translate(219.33 210.5) translate(-219.33 -210.5)\"><path d=\"M207.33 210.5C205.13 210.5 203.33 208.7 203.33 206.5L203.33 194.5C203.33 192.3 204.69 189.31 206.34 187.87L216.32 179.13C217.98 177.69 220.69 177.69 222.34 179.13L232.32 187.87C233.98 189.31 235.33 192.3 235.33 194.5L235.33 206.5C235.33 208.7 233.53 210.5 231.33 210.5L207.33 210.5Z\" fill=\"#c8553a\"/></g></svg>",
  "backyard": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 288 288\" width=\"100%\" height=\"100%\" aria-hidden=\"true\" focusable=\"false\"><g transform=\"translate(144 160)\"><rect x=\"-116\" y=\"-74\" width=\"232\" height=\"148\" rx=\"20\" fill=\"#e1efe6\"/></g><g><path d=\"M160 98L160 222\" fill=\"none\" stroke=\"#1b1a17\" stroke-width=\"5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-opacity=\"0.55\" stroke-dasharray=\"9 10\"/></g><g><path d=\"M59 210C55.15 210 52 206.85 52 203L52 157C52 153.15 54.45 148.02 57.44 145.6L88.56 120.4C91.55 117.98 96.45 117.98 99.44 120.4L130.56 145.6C133.55 148.02 136 153.15 136 157L136 203C136 206.85 132.85 210 129 210L59 210Z\" fill=\"#1b1a17\"/></g><g transform=\"translate(94 193)\"><rect x=\"-10\" y=\"-16\" width=\"20\" height=\"32\" rx=\"7\" fill=\"#f5f2ec\"/></g><g transform=\"translate(210 210) translate(-210 -210)\"><g><g><path d=\"M188 210C184.7 210 182 207.3 182 204L182 176C182 172.7 184.05 168.24 186.56 166.1L205.44 149.9C207.95 147.76 212.05 147.76 214.56 149.9L233.44 166.1C235.95 168.24 238 172.7 238 176L238 204C238 207.3 235.3 210 232 210L188 210Z\" fill=\"#c8553a\"/></g><g transform=\"translate(210 198)\"><rect x=\"-7\" y=\"-11\" width=\"14\" height=\"22\" rx=\"5\" fill=\"#f5f2ec\"/></g></g></g></svg>"
};
// @generated-fallbacks-end

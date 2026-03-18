"use client";

import React, { useState } from "react";

const SIGN_GUIDE = [
  {
    letter: "A",
    desc: "Make a fist. Keep your thumb resting against the side of your index finger (not wrapped over the front).",
    steps: ["Close all fingers into a tight fist", "Place thumb flat against the side of your hand", "Palm faces outward"],
  },
  {
    letter: "B",
    desc: "Hold your hand flat with all four fingers straight up and together. Tuck your thumb across your palm.",
    steps: ["Extend all four fingers straight up, pressed together", "Fold thumb across the palm", "Palm faces the viewer"],
  },
  {
    letter: "C",
    desc: "Curve your hand into the shape of the letter C — like you're gripping a cup.",
    steps: ["Curve all fingers and thumb", "Form a C shape with a gap between thumb and fingers", "Palm faces sideways"],
  },
  {
    letter: "D",
    desc: "Point your index finger straight up. Touch the tips of your middle, ring, and pinky fingers to your thumb to form a circle.",
    steps: ["Raise index finger straight up", "Touch middle, ring, and pinky tips to thumb tip", "Creates a circle at the base with index pointing up"],
  },
  {
    letter: "E",
    desc: "Curl all four fingertips down to touch the top of your palm. Thumb is tucked below the fingers.",
    steps: ["Curl all four fingers downward", "Fingertips rest against the top of your palm", "Tuck thumb underneath the curled fingers"],
  },
  {
    letter: "F",
    desc: "Touch the tip of your index finger to the tip of your thumb forming a circle. Extend the remaining three fingers straight up and spread apart.",
    steps: ["Touch index fingertip to thumb tip (OK-like circle)", "Extend middle, ring, and pinky fingers up and apart", "Palm faces outward"],
  },
  {
    letter: "G",
    desc: "Point your index finger and thumb sideways (horizontally) toward the viewer. Other fingers are curled in.",
    steps: ["Extend index finger horizontally to the side", "Extend thumb parallel to index finger with a gap", "Curl middle, ring, and pinky into palm"],
  },
  {
    letter: "H",
    desc: "Extend your index and middle fingers together, pointing sideways (horizontally). Curl other fingers and thumb.",
    steps: ["Extend index and middle fingers horizontally side by side", "Curl ring and pinky into palm", "Thumb rests over curled fingers"],
  },
  {
    letter: "I",
    desc: "Make a fist and extend only your pinky finger straight up.",
    steps: ["Close all fingers into a fist", "Raise only the pinky finger straight up", "Palm faces the viewer"],
  },
  {
    letter: "J",
    desc: "Start with the 'I' hand shape (pinky up), then trace the letter J in the air by moving your pinky downward and curving it.",
    steps: ["Start with pinky extended up (like letter I)", "Move your hand down and curve the pinky inward", "Trace the shape of the letter J in the air"],
  },
  {
    letter: "K",
    desc: "Point your index finger up, middle finger angled forward, and place your thumb between them touching the middle finger.",
    steps: ["Raise index finger straight up", "Angle middle finger forward/outward", "Place thumb between index and middle, touching middle finger"],
  },
  {
    letter: "L",
    desc: "Extend your index finger straight up and your thumb straight out to the side, forming an L shape. Other fingers curl in.",
    steps: ["Extend index finger straight up", "Extend thumb out to the side at 90°", "Curl middle, ring, and pinky into palm"],
  },
  {
    letter: "M",
    desc: "Place your thumb under your first three fingers (index, middle, ring) which hang over the thumb.",
    steps: ["Tuck thumb under index, middle, and ring fingers", "Three fingers drape over the thumb", "Pinky stays curled, palm faces down"],
  },
  {
    letter: "N",
    desc: "Place your thumb under your first two fingers (index and middle) which hang over the thumb.",
    steps: ["Tuck thumb under index and middle fingers", "Two fingers drape over the thumb", "Ring and pinky stay curled, palm faces down"],
  },
  {
    letter: "O",
    desc: "Curve all your fingers and thumb to meet at the tips, forming a round O shape.",
    steps: ["Curve all fingers inward", "Touch all fingertips to the thumb tip", "Forms a circular O shape"],
  },
  {
    letter: "P",
    desc: "Same hand shape as K (index up, middle angled, thumb between) but point the hand downward.",
    steps: ["Form the same hand shape as the letter K", "Rotate your wrist so fingers point downward", "Index points down, middle finger angles forward"],
  },
  {
    letter: "Q",
    desc: "Same hand shape as G (index and thumb extended) but point the hand downward.",
    steps: ["Form the same hand shape as the letter G", "Rotate your wrist so fingers point downward", "Index and thumb point toward the ground"],
  },
  {
    letter: "R",
    desc: "Cross your index finger over your middle finger, both pointing up. Other fingers curl in.",
    steps: ["Extend index and middle fingers upward", "Cross index finger over middle finger", "Curl ring, pinky, and tuck thumb"],
  },
  {
    letter: "S",
    desc: "Make a fist with your thumb wrapped over the front of your curled fingers (over index and middle).",
    steps: ["Close all four fingers tightly into palm", "Wrap thumb over the front of your fingers", "Palm faces outward"],
  },
  {
    letter: "T",
    desc: "Make a fist and tuck your thumb between your index and middle fingers so the thumb tip peeks out.",
    steps: ["Close all fingers into a fist", "Slide thumb between index and middle fingers", "Thumb tip shows between the two fingers"],
  },
  {
    letter: "U",
    desc: "Extend your index and middle fingers straight up, pressed together. Curl other fingers down with thumb over them.",
    steps: ["Raise index and middle fingers straight up, together", "Curl ring and pinky into palm", "Thumb holds down the curled fingers"],
  },
  {
    letter: "V",
    desc: "Extend your index and middle fingers straight up and spread them apart in a V shape (peace sign).",
    steps: ["Raise index and middle fingers upward", "Spread them apart to form a V", "Curl ring, pinky, and thumb down"],
  },
  {
    letter: "W",
    desc: "Extend your index, middle, and ring fingers straight up and spread them apart. Pinky and thumb touch.",
    steps: ["Raise index, middle, and ring fingers up and spread apart", "Curl pinky down and touch thumb tip to pinky tip", "Three fingers form a W shape"],
  },
  {
    letter: "X",
    desc: "Make a fist and raise your index finger, then bend/hook it into a curved shape.",
    steps: ["Start with a closed fist", "Raise index finger only", "Bend/hook the index finger into a curved hook shape"],
  },
  {
    letter: "Y",
    desc: "Extend your thumb and pinky finger out while curling your index, middle, and ring fingers down.",
    steps: ["Extend thumb outward to the side", "Extend pinky finger upward", "Curl index, middle, and ring fingers into palm"],
  },
  {
    letter: "Z",
    desc: "Point your index finger forward and trace the letter Z in the air — diagonal down-right, horizontal left, diagonal down-right.",
    steps: ["Extend index finger, pointing outward", "Trace the Z shape: move right-down, then left, then right-down again", "This is a motion letter — you draw it in the air"],
  },
];

// ASL hand sign reference images from Wikimedia Commons (public domain)
function getAslImageUrl(letter: string): string {
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${getAslImagePath(letter)}`;
}

function getAslImagePath(letter: string): string {
  const paths: Record<string, string> = {
    A: "2/2a/Sign_language_A.svg/120px-Sign_language_A.svg.png",
    B: "c/c4/Sign_language_B.svg/120px-Sign_language_B.svg.png",
    C: "8/8b/Sign_language_C.svg/120px-Sign_language_C.svg.png",
    D: "c/c0/Sign_language_D.svg/120px-Sign_language_D.svg.png",
    E: "7/7f/Sign_language_E.svg/120px-Sign_language_E.svg.png",
    F: "4/42/Sign_language_F.svg/120px-Sign_language_F.svg.png",
    G: "0/05/Sign_language_G.svg/120px-Sign_language_G.svg.png",
    H: "1/1f/Sign_language_H.svg/120px-Sign_language_H.svg.png",
    I: "4/44/Sign_language_I.svg/120px-Sign_language_I.svg.png",
    J: "6/6e/Sign_language_J.svg/120px-Sign_language_J.svg.png",
    K: "1/17/Sign_language_K.svg/120px-Sign_language_K.svg.png",
    L: "0/01/Sign_language_L.svg/120px-Sign_language_L.svg.png",
    M: "7/76/Sign_language_M.svg/120px-Sign_language_M.svg.png",
    N: "1/19/Sign_language_N.svg/120px-Sign_language_N.svg.png",
    O: "4/4b/Sign_language_O.svg/120px-Sign_language_O.svg.png",
    P: "f/f4/Sign_language_P.svg/120px-Sign_language_P.svg.png",
    Q: "5/5d/Sign_language_Q.svg/120px-Sign_language_Q.svg.png",
    R: "2/25/Sign_language_R.svg/120px-Sign_language_R.svg.png",
    S: "3/34/Sign_language_S.svg/120px-Sign_language_S.svg.png",
    T: "b/bf/Sign_language_T.svg/120px-Sign_language_T.svg.png",
    U: "f/f7/Sign_language_U.svg/120px-Sign_language_U.svg.png",
    V: "4/41/Sign_language_V.svg/120px-Sign_language_V.svg.png",
    W: "5/5a/Sign_language_W.svg/120px-Sign_language_W.svg.png",
    X: "3/3e/Sign_language_X.svg/120px-Sign_language_X.svg.png",
    Y: "0/01/Sign_language_Y.svg/120px-Sign_language_Y.svg.png",
    Z: "3/3a/Sign_language_Z.svg/120px-Sign_language_Z.svg.png",
  };
  return paths[letter] ?? paths["A"];
}

interface SignGuideProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function SignGuide({ isOpen, onToggle }: SignGuideProps) {
  const [expandedLetter, setExpandedLetter] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
      >
        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
          ✋ Sign Reference Guide
        </h3>
        <span className="text-zinc-600 text-xs">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="px-5 pb-4 animate-slide-up">
          <p className="text-xs text-zinc-500 mb-3">
            Click any letter to see the hand shape image and step-by-step instructions.
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[420px] overflow-y-auto pr-1">
            {SIGN_GUIDE.map((sign) => {
              const isExpanded = expandedLetter === sign.letter;
              return (
                <div
                  key={sign.letter}
                  className={`relative flex flex-col items-center p-2 rounded-xl border transition-all cursor-pointer ${
                    isExpanded
                      ? "col-span-4 sm:col-span-6 bg-white/8 border-white/20"
                      : "bg-white/4 hover:bg-white/8 border-white/5 hover:border-white/15"
                  }`}
                  onClick={() => setExpandedLetter(isExpanded ? null : sign.letter)}
                >
                  {!isExpanded ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getAslImageUrl(sign.letter)}
                        alt={`ASL sign for ${sign.letter}`}
                        className="w-10 h-10 object-contain mb-1 opacity-70"
                        loading="lazy"
                      />
                      <span className="text-sm font-bold text-white">{sign.letter}</span>
                    </>
                  ) : (
                    <div className="w-full flex flex-col sm:flex-row gap-4 p-2">
                      <div className="flex flex-col items-center gap-2 sm:min-w-[100px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getAslImageUrl(sign.letter)}
                          alt={`ASL sign for ${sign.letter}`}
                          className="w-20 h-20 object-contain"
                          loading="lazy"
                        />
                        <span className="text-2xl font-bold text-white">{sign.letter}</span>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm text-zinc-300 mb-2">{sign.desc}</p>
                        <ol className="text-xs text-zinc-500 space-y-1 list-decimal list-inside">
                          {sign.steps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-zinc-700 mt-3 text-center">
            Click a letter to expand — images show the correct hand position
          </p>
        </div>
      )}
    </div>
  );
}

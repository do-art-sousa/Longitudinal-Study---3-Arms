# scaffold_policy.py
from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any, Dict, List, Optional, Tuple
import re
import time


class Move(IntEnum):
    NUDGE = 0
    REFLECT = 1
    ANALOGY = 2
    MINI_EXPLANATION = 3


@dataclass
class Turn:
    role: str  # 'child' | 'assistant' | 'system'
    content: str
    move: Optional[Move] = None
    reason: Optional[str] = None
    meta: Dict[str, Any] = field(default_factory=dict)
    ts: float = field(default_factory=lambda: time.time())


@dataclass
class PolicyConfig:
    """Tunable thresholds for ladder escalation (defaults are conservative)."""

    confusion_escalate: float = 0.55
    success_deescalate: float = 0.5


@dataclass
class LadderState:
    history: List[Turn] = field(default_factory=list)
    last_move: Optional[Move] = None


class Heuristics:
    _CONFUSED = re.compile(
        r"\b(idk|i\s*don'?t\s*know|confused|lost|stuck|not\s*sure|"
        r"não\s*sei|nao\s*sei|não\s*percebo|confus[oa])\b",
        re.I,
    )

    @staticmethod
    def confusion_score(text: str) -> float:
        t = (text or "").strip()
        if not t:
            return 0.35
        if Heuristics._CONFUSED.search(t):
            return 0.85
        if "?" in t and len(t.split()) < 6:
            return 0.45
        return 0.25

    @staticmethod
    def success_score(text: str) -> float:
        words = (text or "").split()
        n = len(words)
        if n >= 14:
            return 0.75
        if n >= 8:
            return 0.55
        if n >= 4:
            return 0.4
        return 0.3


class LadderPolicy:
    """
    Four-step scaffolding ladder (Nudge → … → Mini-explanation).
    Heuristic planning runs only for the personalized arm; generic and control
    bypass the ladder (plan returns None).
    """

    def __init__(self, condition: str, config: Optional[PolicyConfig] = None):
        self.cfg = config or PolicyConfig()
        self.state = LadderState()
        self.condition = (condition or "generic").lower()

    def plan(self, child_utterance: str) -> Optional[Move]:
        self.state.history.append(Turn(role="child", content=child_utterance))

        if self.condition in ("generic", "control"):
            self.state.last_move = None
            return None

        last_move = self.state.last_move
        confusion_p = Heuristics.confusion_score(child_utterance)
        success_p = Heuristics.success_score(child_utterance)
        move, _reason = self._choose_next_move(last_move, confusion_p, success_p)

        self.state.last_move = move
        self.state.history.append(
            Turn(
                role="system",
                content=f"policy_decision: {move.name}",
                meta={"confusion_p": confusion_p, "success_p": success_p},
            )
        )
        return move

    def _choose_next_move(
        self,
        last_move: Optional[Move],
        confusion_p: float,
        success_p: float,
    ) -> Tuple[Move, str]:
        if last_move is None:
            return Move.NUDGE, "start"

        if confusion_p >= self.cfg.confusion_escalate:
            nxt = min(last_move.value + 1, Move.MINI_EXPLANATION.value)
            return Move(nxt), "escalate"

        if success_p >= self.cfg.success_deescalate and last_move.value > Move.NUDGE.value:
            nxt = max(last_move.value - 1, Move.NUDGE.value)
            return Move(nxt), "de-escalate"

        return last_move, "hold"

    def log_assistant(
        self, move: Optional[Move], reply: str, reason: str = ""
    ) -> None:
        self.state.history.append(
            Turn(role="assistant", content=reply, move=move, reason=reason or None)
        )

    def validate(self) -> Dict[str, Any]:
        """Lightweight audit hook for the API contract."""
        return {"ok": True, "violations": [], "moves": []}


def render_move(move: Optional[Move], prompt: str, persona_emoji: str = "") -> str:
    if move is None:
        return ""

    templates = {
        Move.NUDGE: f"{persona_emoji} Nice work! What’s the next small step you’d try?",
        Move.REFLECT: f"{persona_emoji} What makes you think that? Can you think out loud?",
        Move.ANALOGY: f"{persona_emoji} Imagine this is like {{ANALOGY}}. How does that help?",
        Move.MINI_EXPLANATION: f"{persona_emoji} Quick tip: {{MINI_EXPLANATION}} Try it your way?",
    }
    return templates.get(move, "")

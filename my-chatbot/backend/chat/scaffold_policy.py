# scaffold_policy.py
from __future__ import annotations
from dataclasses import dataclass, field
from enum import IntEnum
from typing import List, Dict, Any, Optional, Tuple
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

# ... (PolicyConfig and Heuristics remain the same as provided) ...

class LadderPolicy:
    def __init__(self, condition: str, config: Optional[PolicyConfig] = None):
        self.cfg = config or PolicyConfig()
        self.state = LadderState()
        self.condition = condition  # Injected from Participant model

    def plan(self, child_utterance: str) -> Optional[Move]:
        """Chooses the next move. Gated by condition: Generic users bypass the ladder[cite: 15]."""
        self.state.history.append(Turn(role='child', content=child_utterance))

        # GUARDRAIL: Generic condition does not use the dialogic framework
        if self.condition == "generic":
            self.state.last_move = None
            return None

        # Logic for Personalized condition only
        last_move = self.state.last_move
        confusion_p = Heuristics.confusion_score(child_utterance)
        success_p = Heuristics.success_score(child_utterance)
        move, reason = self._choose_next_move(last_move, confusion_p, success_p)

        self.state.last_move = move
        self.state.history.append(Turn(role='system', content=f"policy_decision: {move.name}", meta={
            'confusion_p': confusion_p, 'success_p': success_p
        }))
        return move

    # ... (Internal methods _choose_next_move, etc., remain the same) ...

def render_move(move: Optional[Move], prompt: str, persona_emoji: str = "") -> str:
    """Returns the scaffold string only if a move exists[cite: 15]."""
    if move is None:
        return "" # No scaffold for generic condition
    
    templates = {
        Move.NUDGE: f"{persona_emoji} Nice work! What’s the next small step you’d try?",
        Move.REFLECT: f"{persona_emoji} What makes you think that? Can you think out loud?",
        Move.ANALOGY: f"{persona_emoji} Imagine this is like {{ANALOGY}}. How does that help?",
        Move.MINI_EXPLANATION: f"{persona_emoji} Quick tip: {{MINI_EXPLANATION}} Try it your way?"
    }
    return templates.get(move, "")
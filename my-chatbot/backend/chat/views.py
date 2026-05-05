from __future__ import annotations

from django.shortcuts import render  # if you use it elsewhere
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view

import json
import os
import re
from typing import Dict, List, Optional

from openai import OpenAI
from .scaffold_policy import LadderPolicy, Move, render_move
from .models import Conversation, StudySession
from .audit import compute_audit
from .dialogic_frames import get_dialogic_frame
from .study_services import (
    chat_should_lock,
    get_memory_context_for_chat,
    participant_from_token,
    touch_activity,
)

# ------------------------------
# OpenAI client
# ------------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# ------------------------------
# 1) Persona prompts (you can extend/trim)
# ------------------------------
DEFAULT_PROMPT = (
    # "ALL RESPONSES SHOULD BE IN EUROPEAN PORTUGUESE."
    "Make the first question about what book they are currently reading. "
    "You are a neutral, encouraging reading coach for 10–12 year olds. "
    "Never spoil any part of the book. Only talk about parts the children have read up to."
    "Keep answers short and clear (3–5 sentences total). Avoid spoilers. "
    "Ask exactly one friendly question at the end. Use emojis related to the character and response regularly. Reference characters and parts of each character's universe."
)

CHARACTER_PERSONAS: Dict[str, str] = {
    "spongebob": (
        "You are SpongeBob SquarePants from Bikini Bottom. "
        "Respond in an extremely cheerful, optimistic, and slightly naive manner. "
        "Use phrases like 'Oh boy!', 'I'm ready!', and 'Meow!' (even though you're not a cat). "
        "Reference Krusty Krab, jellyfishing, or your friends Patrick and Squidward when relevant."
    ),
    "po": (
        "You are Po, the Dragon Warrior from the Valley of Peace."
        "Speak with boundless enthusiasm and a touch of goofiness."
        "Mention kung fu, dumplings, and your love of training."
    ),
    "kratos": (
        "You are Kratos, the God of War from the God of War video games. Speak in a deep, commanding tone with terse, powerful sentences."
        "Reflect on themes of rage, duty, and redemption."
        "Reference your Spartan heritage and your journey through Midgard and beyond."
    ),
    "naruto": (
        " You are Naruto Uzumaki, the energetic shinobi of the Hidden Leaf Village. Speak with enthusiastic confidence, sometimes impulsive but always caring."
        "Reference ninja way, shadow clones, Rasengan, the Will of Fire, and your bonds with friends."
    ),
    "peterParker": (
        "You are Peter Parker, the friendly neighborhood Spider-Man."
        "Speak with youthful wit, scientific curiosity, and a strong sense of responsibility."
        "Reference photography, web-swinging, and your duty to protect New York City."
    ),
    "elsa": (
        "You are Elsa, Queen of Arendelle, gifted with the power to create ice and snow."
        "Speak with a calm, graceful, and slightly reserved tone, revealing warmth as you grow more confident."
        "Reference themes of self-acceptance, sisterhood, and the beauty of winter."
    ),
    "geronimo": (
        "You are Geronimo Stilton, the brave and bookish mouse editor of The Rodent's Gazette."
        "Speak with polite enthusiasm, occasional Italian phrases, and playful cheese-related puns."
        "Emphasize curiosity, storytelling flair, and a gentle sense of humor."
        "Encourage exploration and learning with warm, engaging language."
    ),
    "hermione": (
        "You are Hermione Granger, an intelligent and resourceful witch from Gryffindor House."
        "Speak with clarity, precision, and warmth."
        "Reference magical theory, meticulous study habits, and your fierce loyalty to friends."
        "Offer thoughtful advice and encourage learning and justice."
    ),
    "raven": (
        "You are Raven from the Teen Titans."
        "Speak in a calm, introspective tone, with a touch of dry wit."
        "Reference your empathic abilities, dark magic, and the struggle to control your emotions."
        "Offer thoughtful guidance while maintaining your characteristic reserve."
    ),
    "sakura": (
        "You are Sakura Haruno, a kunoichi of Konohagakure and expert in medical ninjutsu."
        "Speak with calm confidence, compassion, and determination."
        "Reference chakra control, healing techniques, and your growth under Tsunade’s mentorship."
        "Encourage perseverance, teamwork, and kindness."
    ),
    "sonic": (
        "You are Sonic the Hedgehog, the fastest hedgehog alive. "
        "Speak with energetic confidence, using speed metaphors and references to golden rings, "
        "Dr. Eggman, and thrilling adventures. Always keep the tone upbeat, heroic, and fun."
    ),
    "masterChief": (
        "You are Master Chief Petty Officer John-117, a stoic and disciplined Spartan warrior. "
        "Speak in a calm, authoritative tone, referencing military strategy, duty, and your experiences fighting the Covenant and the Flood. "
        "Always remain focused, decisive, and protective of humanity."
    ),
    "luzNoceda": (
        "You are Luz Noceda, an optimistic and resourceful human girl navigating the magical world of the Boiling Isles. "
        "Speak with energetic enthusiasm, creativity, and a love for all things fantastical. "
        "Reference your discoveries of hexes, your friendship with Eda and King, and your determination to be yourself."
    ),
    "gregHeffley": (
        "You are Greg Heffley, a sarcastic, self-centered middle schooler who believes he is destined "
        "for greatness but is constantly held back by school, family, and bad luck. "
        "Speak in a casual first-person diary-like tone, full of complaints, excuses, and exaggerated "
        "observations. You always try to make yourself look smart or justified, rarely admit fault, "
        "and blame problems on others or unfair systems. Never break character or acknowledge being fictional."
    ),
    "annabethChase": (
        "You are Annabeth Chase, daughter of Athena and a master strategist among the demigods. "
        "Speak with calm confidence and insightful guidance, referencing Greek mythology, your adventures alongside Percy Jackson, "
        "and the virtues of wisdom and courage."
    ),
    "astrid": (
        "You are Astrid Hofferson, a fierce and determined Viking warrior from How to Train Your Dragon. "
        "Speak with bold confidence, courage, and a competitive spirit. "
        "Reference dragon training, your bond with Stormfly, and the Viking values of honor and bravery. "
        "Encourage the child to face challenges head-on and embrace their inner strength."
    ),
    "mario": (
        "You are Mario, the courageous and optimistic plumber from the Mushroom Kingdom. "
        "Speak with cheerful enthusiasm, using Italian expressions like 'Mamma mia!' and 'Let's-a-go!' "
        "Reference your adventures rescuing Princess Peach, battling Bowser, and collecting power-ups. "
        "Emphasize perseverance, teamwork, and the joy of adventure."
    ),
    "moana": (
        "You are Moana, a courageous wayfinder who heeds the call of the ocean. "
        "Speak with determination, wisdom, and a deep connection to nature and heritage. "
        "Reference your journey across the ocean, your ancestors, and the importance of following your heart. "
        "Encourage the child to discover their purpose and trust their instincts."
    ),
    "trunks": (
        "You are Trunks, a powerful Saiyajin warrior from the future who fights to protect his friends. "
        "Speak with determined intensity, referencing your training, your sword skills, and your mission to change the future. "
        "Emphasize the importance of strength, loyalty, and fighting for what matters most. "
        "Encourage the child to grow stronger and never give up."
    ),
    "tails": (
        "You are Tails, the brilliant two-tailed fox and loyal best friend of Sonic the Hedgehog. "
        "Speak with intelligent enthusiasm, using technical references and problem-solving approaches. "
        "Reference your inventions, your flying abilities, and your unwavering loyalty to Sonic. "
        "Encourage curiosity, creativity, and the power of friendship."
    ),
    "default": "You are a helpful assistant.",
}

# 2) Shared AI-Coach (PEER + CROWD) — appended to EVERY persona
COACHING_PROMPT = """
🎓 FRAMEWORK & TONE
- Audience: children ages 10–12; warm, curious, supportive, easy to understand. Do not get distracted. Only talk about the book even if the children start to get distracted.
- Length: 3–5 short sentences total. Avoid spoilers.
- End with exactly ONE question inviting the child’s next step.

🌀 PEER Framework
- Prompt: Praise/encourage the child’s thought or question in your character’s voice.
- Evaluate: Reflect briefly on why their idea is interesting.
- Expand: Use a metaphor/analogy or a lesson from your world (friendship, courage, curiosity, teamwork).
- Repeat: Motivate them to keep reading and exploring.

💭 CROWD Questioning Cues (pick one when helpful)
- Completion: “What might happen next?”
- Recall: “Do you remember something similar earlier?”
- Open-ended: “Why do you think the character did that?”
- Wh-questions: “Who/What/When/Where/Why/How …?”
- Distancing: “How would you react if you were there?”

Formatting:
Use bold and italics for emphasis.
Add character-related emojis throughout. Include emojis in every message.
Ending: Always close with an encouraging or reflective message that invites the reader to continue reading, thinking, or imagining.
"""

UNCERTAIN_PATTERNS = [
    r"\bidk\b", r"\bnot sure\b", r"\bi\s*(do\s*not|don't)\s*know\b",
    r"\bi\s*(do\s*not|don't)\s*have\s*(any\s*)?questions?\b", r"\bno\s*questions?\b",
    r"\bnothing\s*to\s*ask\b", r"\bno\s*idea\b",
]
_UNCERTAIN_RE = re.compile("|".join(UNCERTAIN_PATTERNS), re.IGNORECASE)

def should_force_question(user_msg: str) -> bool:
    return bool(_UNCERTAIN_RE.search((user_msg or "").strip()))

COACH_ENABLED = True

MOVE_GUIDELINES: Dict[Move, str] = {
    Move.NUDGE: (
        "MOVE=NUDGE. Give ONLY 1–2 sentences of encouragement or a recall cue. "
        "Do NOT introduce new content or hints. Ask exactly one small follow-up question."
    ),
    Move.REFLECT: (
        "MOVE=REFLECT. Ask the child to think aloud with ONE focused question. "
        "Do NOT give hints or answers yet. Keep to 1–2 sentences, then ask one question."
    ),
    Move.ANALOGY: (
        "MOVE=ANALOGY. Offer exactly ONE familiar analogy (kid-friendly) that maps to the concept. "
        "Keep it short (<=2 sentences), then ask one question about how the analogy helps."
    ),
    Move.MINI_EXPLANATION: (
        "MOVE=MINI_EXPLANATION. Provide a very brief clarification (<=2 sentences), "
        "then hand control back with one question inviting them to try."
    ),
}

def _name_prompt(user_name: str) -> str:
    safe = (user_name or "").strip()
    if not safe:
        safe = "friend"
    return (
        f"The student's name is {safe}. "
        "Address the student by name naturally sometimes (especially at the start or when encouraging), "
        "but do NOT overuse their name. "
        "If the student asks what their name is, answer directly with their name."
    )

def build_system_prompt(
    character_key: str,
    user_name: str,
    force_question: bool,
    move: Move,
    memory_context: str = "",
    chapter_context: str = "",
    condition: str = "generic",
) -> str:
    persona = CHARACTER_PERSONAS.get(character_key, CHARACTER_PERSONAS["default"])

    # Always include name guidance (even for default), so the model actually uses it
    base = persona + "\n\n" + _name_prompt(user_name) + "\n\n"

    if character_key != "default":
        base += DEFAULT_PROMPT + "\n\n" + COACHING_PROMPT + "\n\n"

    # Add dialogic reading frame (PEER/CROWD moves)
    base += get_dialogic_frame(condition) + "\n\n"

    base += MOVE_GUIDELINES[move]

    # Add Os Piratas chapter context if provided
    if chapter_context:
        base += "\n\n" + chapter_context
        base += "\n\nSPOILER GUARDRAIL: You must NOT reveal any events, characters, or plot points from future scenes (beyond the current scene). If the child asks about what happens next, politely decline and say 'Vamos descobrir a história juntos!' (Let's explore the story together!)."

    if memory_context:
        base += memory_context

    if force_question:
        base += (
            "\n\nThe child expressed uncertainty or having no questions. "
            "Respond with a SHORT, supportive coaching nudge that ends with EXACTLY ONE clear question. "
            "Choose ONE: ask for a 1–2 sentence summary, a prediction with a reason, a tricky word/line to unpack, "
            "or how a character feels with text evidence. Keep to 1–2 sentences total."
        )
    return base

def sanitize_history(items: List[Dict[str, str]]) -> List[Dict[str, str]]:
    out = []
    for it in items or []:
        role = (it.get("role") or "").strip()
        content = (it.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            out.append({"role": role, "content": content})
    return out[-12:]


_POLICY_STORE: Dict[str, LadderPolicy] = {}


def _auth_bearer(request) -> Optional[str]:
    h = request.META.get("HTTP_AUTHORIZATION", "") or ""
    if h.startswith("Bearer "):
        return h[7:].strip()
    return None


def _session_key(request) -> str:
    if not request.session.session_key:
        request.session.save()
    return f"ladder:{request.session.session_key}"

def _get_policy(request) -> LadderPolicy:
    key = _session_key(request)
    if key not in _POLICY_STORE:
        _POLICY_STORE[key] = LadderPolicy()
    return _POLICY_STORE[key]

@csrf_exempt
def start_conversation(request):
    """
    Creates a new Conversation row with an optional initial bot message.
    Expects JSON body:
      {
        "userName": "Alice",
        "character": "Naruto",
        "initialMessage": "Hi, I'm Naruto..."
      }
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    user_name = body.get("userName") or "Unknown"
    character = body.get("character") or "Default"
    initial_message = body.get("initialMessage")

    messages = []
    if initial_message:
        messages.append(
            {
                "sender": "assistant",
                "content": initial_message,
                "created_at": timezone.now().isoformat(),
                "meta": {"role": "agent", "on_text": True},
            }
        )

    convo = Conversation.objects.create(
        user_name=user_name,
        character=character,
        messages=messages,
    )
    return JsonResponse({"conversationId": str(convo.id)})


@csrf_exempt
def save_message(request):
    """
    Append a message to an existing Conversation.

    Expects JSON body:
      {
        "conversationId": "...",
        "sender": "user" | "assistant" | ...,
        "content": "text",
        "meta": { ... optional annotations for auditing ... }
      }
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    conversation_id = body.get("conversationId")
    sender = body.get("sender")
    content = body.get("content")
    meta = body.get("meta") or {}

    if not conversation_id or not sender or content is None:
        return JsonResponse(
            {"error": "conversationId, sender, and content are required"},
            status=400,
        )

    try:
        convo = Conversation.objects.get(id=conversation_id)
    except Conversation.DoesNotExist:
        return JsonResponse({"error": "Conversation not found"}, status=404)

    if convo.participant_id:
        token = _auth_bearer(request)
        if not token:
            return JsonResponse({"error": "Unauthorized"}, status=401)
        part = participant_from_token(token)
        if not part or part.id != convo.participant_id:
            return JsonResponse({"error": "Unauthorized"}, status=401)
        ss = (
            StudySession.objects.filter(
                conversation=convo,
                participant=part,
                status=StudySession.Status.IN_PROGRESS,
            )
            .first()
        )
        if ss:
            lock = chat_should_lock(ss, part)
            if lock:
                return JsonResponse(
                    {"sessionLocked": True, "lockReason": lock},
                    status=403,
                )
            touch_activity(ss)

    msgs = convo.messages or []
    msgs.append(
        {
            "sender": sender,
            "content": content,
            "created_at": timezone.now().isoformat(),
            "meta": meta,
        }
    )
    convo.messages = msgs
    convo.save(update_fields=["messages"])

    convo.recompute_audit(save=True)

    return JsonResponse({"ok": True})


@method_decorator(csrf_exempt, name="dispatch")
class ChatAPIView(APIView):
    """
    POST JSON: {
      "message": str,
      "character": str (optional),
      "userName": str (optional),
      "history": [{"role": "user"|"assistant", "content": str}, ...] (optional)
    }
    Returns: {
      "reply": str,
      "move": "NUDGE"|"REFLECT"|"ANALOGY"|"MINI_EXPLANATION",
      "log_ok": bool,
      "violations": [...],
      "moves": [{"role": "...", "move": "...", "text": "..."}]
    }
    """

    def post(self, request):
        try:
            user_msg: str = (request.data.get("message") or "").strip()
            character: str = (request.data.get("character") or "default").strip()
            user_name: str = (request.data.get("userName") or "").strip()
            history: List[Dict[str, str]] = sanitize_history(request.data.get("history") or [])

            memory_context = ""
            raw_study_sid = request.data.get("studySessionId") or request.data.get(
                "study_session_id"
            )
            token = _auth_bearer(request)
            if raw_study_sid:
                if not token:
                    return Response(
                        {"error": "Unauthorized", "sessionLocked": False},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
                participant = participant_from_token(token)
                if not participant:
                    return Response(
                        {"error": "Unauthorized", "sessionLocked": False},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
                try:
                    study_session = StudySession.objects.select_related("conversation").get(
                        id=raw_study_sid,
                        participant=participant,
                    )
                except StudySession.DoesNotExist:
                    return Response(
                        {"error": "Invalid study session", "sessionLocked": False},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if study_session.status != StudySession.Status.IN_PROGRESS:
                    return Response(
                        {"error": "Session not active", "sessionLocked": False},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                lock = chat_should_lock(study_session, participant)
                if lock:
                    return Response(
                        {
                            "sessionLocked": True,
                            "lockReason": lock,
                            "reply": "",
                            "move": "NUDGE",
                            "log_ok": True,
                            "violations": [],
                            "moves": [],
                        },
                        status=status.HTTP_200_OK,
                    )
                touch_activity(study_session)
                convo = study_session.conversation
                if convo:
                    character = convo.character
                    user_name = convo.user_name
                memory_context = get_memory_context_for_chat(participant)
                
                # Inject Os Piratas chapter context based on session number
                chapter_context = _get_chapter_context(study_session.slot_index, character)

            if not user_msg:
                return Response(
                    {
                        "reply": "📚 Tell me what you’re thinking about the story, and we’ll figure it out together! What’s on your mind?",
                        "move": "NUDGE",
                        "log_ok": True,
                        "violations": [],
                        "moves": [{"role": "assistant", "move": "NUDGE", "text": "Prompted child to share."}],
                    }
                )

            policy = _get_policy(request)
            force_q = should_force_question(user_msg)
            move: Move = policy.plan(user_msg)

            condition = "generic"
            if raw_study_sid and participant:
                condition = participant.condition
            
            system_prompt = build_system_prompt(
                character_key=character,
                user_name=user_name,
                force_question=force_q,
                move=move,
                memory_context=memory_context,
                chapter_context=chapter_context if raw_study_sid else "",
                condition=condition,
            )

            messages = [
                {"role": "system", "content": system_prompt},
                *history,
                {"role": "user", "content": user_msg},
            ]

            if openai is None:
                return Response(
                    {"error": "OPENAI_API_KEY is not configured on the server."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

            completion = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.7,
                max_tokens=180,
            )

            reply = completion.choices[0].message.content.strip()

            policy.log_assistant(move, reply, reason=f"policy-selected {move.name}")
            report = policy.validate()

            return Response(
                {
                    "reply": reply,
                    "move": move.name,
                    "log_ok": report["ok"],
                    "violations": report["violations"],
                    "moves": report["moves"],
                }
            )

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET"])
def conversation_audit(request, conversation_id):
    """
    Return auditing scores for a given conversation.
    """
    try:
        convo = Conversation.objects.get(id=conversation_id)
    except Conversation.DoesNotExist:
        return Response({"error": "Conversation not found"}, status=404)

    # Either use cached scores or recompute on the fly
    scores = convo.recompute_audit(save=True)
    return Response(scores, status=200)

# Os Piratas chapter context data
OS_PIRATAS_CHAPTERS = {
    1: {
        "title": "Cena 1",
        "summary": "A scene set in an attic during a storm. Manuel and Ana are looking out the window as rain beats down and the wind howls.",
        "keyCharacters": ["Manuel", "Ana"],
        "keyThemes": ["Storm and danger at sea", "Fear and courage", "Connection during crisis"],
    },
    2: {"title": "Cena 2", "summary": "To be filled in", "keyCharacters": [], "keyThemes": []},
    3: {"title": "Cena 3", "summary": "To be filled in", "keyCharacters": [], "keyThemes": []},
    4: {"title": "Cena 4", "summary": "To be filled in", "keyCharacters": [], "keyThemes": []},
    5: {"title": "Cena 5", "summary": "To be filled in", "keyCharacters": [], "keyThemes": []},
    6: {"title": "Cena 6", "summary": "To be filled in", "keyCharacters": [], "keyThemes": []},
    7: {"title": "Cena 7", "summary": "To be filled in", "keyCharacters": [], "keyThemes": []},
    8: {"title": "Cena 8", "summary": "To be filled in", "keyCharacters": [], "keyThemes": []},
    9: {"title": "Cena 9", "summary": "To be filled in", "keyCharacters": [], "keyThemes": []},
}

CHARACTER_CROSS_UNIVERSE_CONNECTIONS = {
    "hermione": "Like Hermione from Harry Potter, analyze the characters' decisions and motivations. Compare the characters' challenges to those faced by wizards and witches. Draw parallels between Os Piratas and magical literature.",
    "naruto": "Like Naruto, focus on the bonds between characters and what they mean. Highlight moments of courage and growth. Encourage the child to believe in themselves like the characters in Os Piratas.",
    "elsa": "Like Elsa, explore how characters discover who they are. Discuss the journey from fear to acceptance. Help the child understand that everyone has inner strength.",
    "annabethChase": "Like Annabeth, emphasize strategic thinking and problem-solving. Discuss how characters make decisions and overcome obstacles through wisdom and planning.",
}

def _get_chapter_context(session_number, character_key):
    """Generate chapter context for the LLM prompt based on session number and character."""
    chapter = OS_PIRATAS_CHAPTERS.get(session_number)
    if not chapter or not chapter.get("summary") or chapter["summary"] == "To be filled in":
        return ""
    
    context = f"""
CURRENT READING: Os Piratas (The Pirates) - {chapter['title']}

Summary: {chapter['summary']}

Key Characters: {', '.join(chapter['keyCharacters']) if chapter['keyCharacters'] else 'Various'}

Key Themes: {', '.join(chapter['keyThemes']) if chapter['keyThemes'] else 'To be determined'}

Your approach:
1. Discuss ONLY this specific scene and its characters, plot events, and themes
2. Help the child understand the story by making connections to your own universe
3. Ask questions about what the characters are feeling, why they make certain choices, and what the themes mean
4. Be engaging and age-appropriate
5. Use Portuguese as your primary language

{CHARACTER_CROSS_UNIVERSE_CONNECTIONS.get(character_key, '')}
"""
    return context.strip()


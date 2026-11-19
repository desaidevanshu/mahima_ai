import re
import unicodedata
from typing import Any


_PHONE_PATTERN = re.compile(
    r"(?<!\d)(?:\+?91[\s.-]?)?(?:0[6-9](?:[\s.-]?\d){9}|[6-9]\d(?:[\s.-]?\d){8})(?!\d)"
)
_NAME_PATTERNS = (
    re.compile(r"\bmy name is\s+([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3})", re.IGNORECASE),
    re.compile(r"\bname is\s+([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3})", re.IGNORECASE),
    re.compile(r"\bi am\s+([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3})", re.IGNORECASE),
    re.compile(r"\bi'm\s+([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3})", re.IGNORECASE),
    re.compile(r"\bmera naam\s+([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3})", re.IGNORECASE),
    re.compile(r"\bmyself\s+([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3})", re.IGNORECASE),
    re.compile(
        r"(?:मेरा नाम(?: है)?|नाम है)\s+"
        r"([\u0900-\u093c\u093e-\u0957]+(?:\s+[\u0900-\u093c\u093e-\u0957]+){0,3})"
    ),
)
_NAME_STOP_WORDS = {
    "and", "i", "am", "is", "hai", "hoon", "hun", "houn", "speaking",
    "calling", "my", "phone", "number", "mobile", "contact",
    "है", "हूँ", "हूं", "जी", "मेरा",
}
_NOT_NAMES = {
    "a", "an", "the", "interested", "looking", "want", "wants", "thinking",
    "calling", "speaking", "from", "इंटरेस्टेड", "चाहिए",
}
_PHONE_CUE = re.compile(
    r"\b(?:phone|mobile|number|contact)\b|नंबर|मोबाइल|फ़ोन|फोन",
    re.IGNORECASE,
)
_PHONE_FRAGMENT = re.compile(r"[\d\s.,;:!?।॥+\-]+")


def _transcript_turns(transcript: Any) -> list[dict[str, str]]:
    if isinstance(transcript, str):
        return [{"role": "user", "text": transcript}]
    if not isinstance(transcript, list):
        return []

    turns = []
    for item in transcript:
        if isinstance(item, str):
            turns.append({"role": "user", "text": item})
            continue
        if not isinstance(item, dict):
            continue

        role = str(item.get("role") or item.get("speaker") or "").casefold()
        text = item.get("text") or item.get("transcript") or item.get("message") or item.get("content")
        if isinstance(text, list):
            text = " ".join(
                str(part.get("text", "")) if isinstance(part, dict) else str(part)
                for part in text
            )
        elif isinstance(text, dict):
            text = text.get("text") or text.get("content") or ""
        if text:
            turns.append({"role": role, "text": str(text)})
    return turns


def _structured_fields(data: Any) -> dict[str, Any]:
    result: dict[str, Any] = {}
    aliases = {
        "name": {"name", "customername", "fullname", "contactname", "prospectname"},
        "phone": {"phone", "phonenumber", "mobile", "mobilenumber", "customerphone", "contactnumber"},
        "configuration": {"configuration", "propertyconfiguration", "bhk", "requirement"},
        "interest": {"interest", "interestlevel", "leadtemperature"},
        "preferredVisitDate": {"preferredvisitdate", "visitdate"},
    }

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            for key, item in value.items():
                normalized_key = re.sub(r"[^a-z]", "", str(key).casefold())
                for field, names in aliases.items():
                    if normalized_key in names and isinstance(item, (str, int, float)):
                        result.setdefault(field, str(item).strip())
                if isinstance(item, (dict, list)):
                    visit(item)
        elif isinstance(value, list):
            for item in value:
                visit(item)

    if isinstance(data, str):
        try:
            import json
            data = json.loads(data)
        except (TypeError, ValueError):
            return result
    visit(data)
    return result


def _valid_name(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = re.sub(r"\s+", " ", value.strip(" \t\r\n.,;:!?"))
    words = cleaned.split()
    if words and words[0].casefold() in _NOT_NAMES:
        return None
    while words and words[-1].casefold() in _NAME_STOP_WORDS:
        words.pop()
    cleaned = " ".join(words)
    if len(cleaned) < 2 or len(cleaned) > 120 or not any(character.isalpha() for character in cleaned):
        return None
    return cleaned


def _valid_phone(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    digits = _digits(value)
    if digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    elif digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) != 10 or digits[0] not in "6789":
        return None
    return digits


def _digits(value: str) -> str:
    return "".join(
        str(unicodedata.digit(character))
        for character in value
        if character.isdigit()
    )


def _normalize_configuration(value: Any) -> str | None:
    if not isinstance(value, str):
        return None

    text = value.casefold().strip()
    if not text or text in {"undecided", "not decided", "unknown", "not specified"}:
        return None
    if re.search(r"\b(?:4|four|4\s*(?:bhk|bedroom)|चार)\b", text):
        return "4 BHK"
    if re.search(r"\b(?:3|three|3\s*(?:bhk|bedroom)|तीन)\b", text):
        return "3 BHK"
    return None


def _extract_phone(turns: list[dict[str, str]]) -> str | None:
    user_turns = [
        turn for turn in turns
        if turn["role"] in {"user", "customer", "caller", "transcript", ""}
    ]

    for index, turn in enumerate(user_turns):
        if _PHONE_CUE.search(turn["text"]):
            candidate = _valid_phone(turn["text"])
            if candidate:
                return candidate

            digits = _digits(turn["text"])
            for next_turn in user_turns[index + 1:index + 5]:
                if not _PHONE_FRAGMENT.fullmatch(next_turn["text"].strip()):
                    break
                digits += _digits(next_turn["text"])
                candidate = _valid_phone(digits)
                if candidate:
                    return candidate

    for turn in user_turns:
        match = _PHONE_PATTERN.search(turn["text"])
        if match:
            candidate = _valid_phone(match.group(0))
            if candidate:
                return candidate
    return None


def extract_voice_lead(transcript: Any, structured_data: Any = None) -> dict[str, str | None]:
    structured = _structured_fields(structured_data)
    turns = _transcript_turns(transcript)
    user_text = " ".join(
        turn["text"] for turn in turns if turn["role"] in {"user", "customer", "caller", "transcript", ""}
    )
    fields: dict[str, str | None] = {
        "name": _valid_name(structured.get("name")),
        "phone": _valid_phone(structured.get("phone")),
        "configuration": _normalize_configuration(structured.get("configuration")),
        "interest": structured.get("interest"),
        "preferredVisitDate": structured.get("preferredVisitDate"),
        "purpose": None,
    }

    if not fields["name"]:
        for pattern in _NAME_PATTERNS:
            match = pattern.search(user_text)
            if match:
                fields["name"] = _valid_name(match.group(1))
                if fields["name"]:
                    break

    if not fields["configuration"]:
        if re.search(r"\bfour\b|4\s*(?:[- ]?(?:bhk|bedroom|bedrooms|बी\s*एच\s*के))|चार\s*(?:बी\s*एच\s*के|bhk)?", user_text, re.IGNORECASE):
            fields["configuration"] = "4 BHK"
        elif re.search(r"\bthree\b|3\s*(?:[- ]?(?:bhk|bedroom|bedrooms|बी\s*एच\s*के))|तीन\s*(?:बी\s*एच\s*के|bhk)?", user_text, re.IGNORECASE):
            fields["configuration"] = "3 BHK"

    if re.search(r"\binvestment\b|इन्वेस्टमेंट|निवेश", user_text, re.IGNORECASE):
        fields["purpose"] = "Investment"
    elif re.search(r"\bself[- ]use\b|खुद रहने|अपने परिवार|फैमिली के लिए", user_text, re.IGNORECASE):
        fields["purpose"] = "Self-use"

    if re.search(r"site\s*visit|साइट\s*विज़िट|साइट\s*विजिट", user_text, re.IGNORECASE):
        fields["status"] = "Site visit requested"

    if not fields["phone"]:
        fields["phone"] = _extract_phone(turns)

    return fields

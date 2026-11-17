from pydantic import BaseModel, Field
from typing import Optional

class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=30)
    configuration: str = Field(default="Undecided", max_length=30)
    interest: str = Field(default="Warm", max_length=20)
    status: str = Field(default="New enquiry", max_length=60)
    source: str = Field(default="Manual dashboard entry", max_length=80)



class PublicEnquiry(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=8, max_length=30)
    email: Optional[str] = Field(default=None, max_length=160)
    configuration: str = Field(default="Undecided", max_length=30)
    purpose: str = Field(default="Not specified", max_length=40)
    message: Optional[str] = Field(default=None, max_length=1000)
    preferredVisitDate: Optional[str] = Field(default=None, max_length=30)
    source: str = Field(default="Website enquiry form", max_length=80)


class VoiceTranscriptTurn(BaseModel):
    role: str = Field(min_length=1, max_length=30)
    text: str = Field(min_length=1, max_length=5000)


class VoiceEnquiryCreate(BaseModel):
    callId: str = Field(min_length=1, max_length=200)
    transcript: list[VoiceTranscriptTurn] = Field(min_length=1, max_length=100)

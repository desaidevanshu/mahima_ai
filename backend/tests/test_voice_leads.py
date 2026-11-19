import unittest
from unittest.mock import patch

from app import main
from app.schemas import VoiceEnquiryCreate
from app.voice_leads import extract_voice_lead


class FakeDocument:
    def __init__(self):
        self.data = {}

    def set(self, value, merge=False):
        if merge:
            self.data.update(value)
        else:
            self.data = dict(value)


class FakeCollection:
    def __init__(self):
        self.documents = {}

    def document(self, document_id):
        return self.documents.setdefault(document_id, FakeDocument())


class FakeStore:
    def __init__(self):
        self.collections = {}

    def collection(self, name):
        return self.collections.setdefault(name, FakeCollection())


class VoiceLeadExtractionTests(unittest.TestCase):
    def test_extracts_name_and_phone_from_customer_turns_only(self):
        transcript = [
            {"role": "assistant", "text": "My name is Mahima Sales Assistant."},
            {"role": "user", "text": "My name is Rahul Sharma and my number is 98765 43210."},
        ]

        lead = extract_voice_lead(transcript)

        self.assertEqual(lead["name"], "Rahul Sharma")
        self.assertEqual(lead["phone"], "9876543210")

    def test_public_voice_enquiry_saves_hindi_contact_as_sales_lead_without_auth(self):
        store = FakeStore()
        transcript = [
            {"role": "user", "text": "4BHK में इंटरेस्टेड हूँ।"},
            {"role": "user", "text": "इससे इन्वेस्टमेंट पर्पस।"},
            {"role": "user", "text": "मुझे इंक्वायरी बुक करनी थी, साइट विज़िट के लिए।"},
            {"role": "user", "text": "मेरा नाम है देवांशु।"},
            {"role": "user", "text": "नंबर है..."},
            {"role": "user", "text": "91672।"},
            {"role": "user", "text": "66279।"},
        ]
        payload = VoiceEnquiryCreate(callId="public-call-123", transcript=transcript)

        with patch.object(main, "require_db", return_value=store):
            result = main.create_public_voice_enquiry(payload)

        lead = next(iter(store.collection("leads").documents.values())).data
        self.assertTrue(result["leadCreated"])
        self.assertEqual(lead["name"], "देवांशु")
        self.assertEqual(lead["phone"], "9167266279")
        self.assertEqual(lead["configuration"], "4 BHK")
        self.assertEqual(lead["purpose"], "Investment")
        self.assertEqual(lead["status"], "Site visit requested")

    def test_structured_data_takes_precedence_over_transcript(self):
        lead = extract_voice_lead(
            [{"role": "user", "text": "My name is Rahul and my number is 9876543210."}],
            {"analysis": {"customerName": "Anita Verma", "phoneNumber": "+91 98765 43210"}},
        )

        self.assertEqual(lead["name"], "Anita Verma")
        self.assertEqual(lead["phone"], "9876543210")

    def test_extracts_spoken_configuration_variants(self):
        cases = [
            ("I want a 3 BHK flat.", "3 BHK"),
            ("I am looking for a 3-bedroom apartment.", "3 BHK"),
            ("Please show me a four bedroom option.", "4 BHK"),
            ("मुझे चार बीएचके चाहिए।", "4 BHK"),
        ]
        for transcript, expected in cases:
            with self.subTest(transcript=transcript):
                lead = extract_voice_lead([{"role": "user", "text": transcript}])
                self.assertEqual(lead["configuration"], expected)

    def test_extracts_hindi_name_and_phone_split_across_transcript_turns(self):
        transcript = [
            {"role": "assistant", "text": "आपका नाम और mobile number बता दीजिए।"},
            {"role": "user", "text": "मेरा नाम है देवांशु।"},
            {"role": "assistant", "text": "आपका mobile number क्या है?"},
            {"role": "user", "text": "नंबर है..."},
            {"role": "user", "text": "91672।"},
            {"role": "user", "text": "66279।"},
            {"role": "user", "text": "4BHK में इंटरेस्टेड हूँ।"},
            {"role": "user", "text": "इससे इन्वेस्टमेंट पर्पस।"},
            {"role": "user", "text": "मुझे इंक्वायरी बुक करनी थी, साइट विज़िट के लिए।"},
        ]

        lead = extract_voice_lead(transcript)

        self.assertEqual(lead["name"], "देवांशु")
        self.assertEqual(lead["phone"], "9167266279")
        self.assertEqual(lead["configuration"], "4 BHK")
        self.assertEqual(lead["purpose"], "Investment")
        self.assertEqual(lead["status"], "Site visit requested")

    def test_does_not_treat_interest_as_a_customer_name(self):
        lead = extract_voice_lead(
            [{"role": "user", "text": "I am interested. My number is 9876543210."}]
        )

        self.assertIsNone(lead["name"])
        self.assertEqual(lead["phone"], "9876543210")

    def test_browser_and_webhook_reports_merge_without_duplicate_leads(self):
        store = FakeStore()
        payload = VoiceEnquiryCreate(
            callId="call-123",
            transcript=[
                {"role": "user", "text": "My name is Rahul Sharma."},
                {"role": "user", "text": "My number is 9876543210."},
            ],
        )

        with patch.object(main, "require_db", return_value=store):
            result = main.create_public_voice_enquiry(payload)
        main._persist_vapi_call(
            store,
            "call-123",
            {},
            {
                "eventType": "end-of-call-report",
                "transcript": payload.model_dump()["transcript"],
                "structuredData": {"customerName": "Rahul Sharma", "phoneNumber": "9876543210"},
            },
        )

        leads = store.collection("leads").documents
        self.assertTrue(result["leadCreated"])
        self.assertEqual(len(leads), 1)
        self.assertEqual(next(iter(leads.values())).data["phone"], "9876543210")
        self.assertEqual(len(store.collection("calls").documents), 1)

    def test_missing_contact_details_save_call_but_not_lead(self):
        store = FakeStore()
        payload = VoiceEnquiryCreate(
            callId="call-456",
            transcript=[{"role": "user", "text": "I am interested in the project."}],
        )

        with patch.object(main, "require_db", return_value=store):
            result = main.create_public_voice_enquiry(payload)

        self.assertFalse(result["leadCreated"])
        self.assertEqual(len(store.collection("calls").documents), 1)
        self.assertEqual(len(store.collection("leads").documents), 0)


if __name__ == "__main__":
    unittest.main()

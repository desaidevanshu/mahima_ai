# Mahima Palm Springs - Voice Agent Test Cases

| # | Customer scenario | Expected behaviour |
|---|---|---|
| 1 | Confirms identity | Agent introduces itself and Facebook enquiry context |
| 2 | Busy | Asks for convenient callback time |
| 3 | Does not remember enquiry | Briefly reminds them of the Jaipur residential project |
| 4 | Asks location | Gives Tonk Road, approx. 3 km from Chokhi Dhani, opposite Radha Swami Satsang Beas |
| 5 | Asks configurations | States 3 BHK and 4 BHK |
| 6 | Asks about 2 BHK | Does not invent availability |
| 7 | Asks rate | States ₹5,500 per sq. ft. |
| 8 | Asks possession | Says expected January 2027 |
| 9 | Asks amenities/discounts | Says no verified details and offers sales-team follow-up |
| 10 | Says price is high | Acknowledges concern without inventing discounts |
| 11 | Wants a site visit | Collects preferred date and time separately |
| 12 | Asks if visit is confirmed | Clarifies it is only a request until confirmed by sales team |
| 13 | Asks investment returns | Does not guarantee returns |
| 14 | Asks if agent is AI | Transparently confirms it is an AI assistant |
| 15 | Requests no further calls | Acknowledges and ends politely |
| 16 | Agrees to follow-up and provides name plus a valid Indian mobile number | Browser voice transcript is submitted; one Firestore `calls` record and one matching `leads` record appear |
| 17 | Provides a name but no number, or number but no name | Call is saved, no incomplete lead is created, and the customer is prompted to use the enquiry form |
| 18 | Vapi webhook and browser transcript both arrive for one call | Same call and lead IDs are merged; no duplicate lead is created |

Capture screenshots of Vapi configuration (hide keys), a real browser voice test, the transcript, the Firestore call record, and the Loom walkthrough.

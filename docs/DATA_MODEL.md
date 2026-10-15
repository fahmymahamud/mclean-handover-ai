# Data Model

## Firestore — collection `jobs`, document ID auto
```json
{
  "jobName": "Unit 12-34 handover clean",
  "status": "in_progress",
  "createdAt": "<Firestore Timestamp>",
  "completedAt": "<Firestore Timestamp | null>",
  "pairs": [
    {
      "id": "pair-1",
      "areaLabel": "Toilet",
      "before": {
        "photoPath": "jobs/<jobId>/pair-1-before.jpg",
        "uploadedAt": "<Timestamp>"
      },
      "after": {
        "photoPath": "jobs/<jobId>/pair-1-after.jpg",
        "uploadedAt": "<Timestamp>"
      },
      "check": {
        "same_location": true,
        "result": "cleaned",
        "reason": "Toilet bowl, sink, and tiles are visibly cleaned with no hair or residue remaining."
      }
    }
  ],
  "complaints": [
    {
      "id": "comp-1",
      "text": "The bedroom floor was still dusty.",
      "createdAt": "<Timestamp>",
      "status": "new",
      "check": {
        "finding": "not_supported",
        "areaLabel": "Bedroom",
        "explanation": "After photo shows the floor has been swept and cleared of visible dust and debris.",
        "suggested_action": "No re-clean needed for bedroom floor."
      }
    }
  ]
}
```
*Note: All timestamps are serialized as ISO 8601 strings when returned by the API.*

## Storage — bucket `$BUCKET_NAME`
- Before photo: `jobs/<jobId>/<pairId>-before.<ext>`
- After photo: `jobs/<jobId>/<pairId>-after.<ext>`

## Gemini response schemas

### 1. Area Labeling (called when before photo is uploaded)
| Field | Type | Description |
|---|---|---|
| `areaLabel` | string | Short title of the area detected in the photo (e.g. "Toilet", "Bedroom", "Living Room", "Kitchen", "Balcony") |

### 2. Before vs After Inspection (called when after photo is uploaded)
| Field | Type | Values | Description |
|---|---|---|---|
| `same_location` | boolean | `true`, `false` | Verifies both photos capture the exact same spot/area |
| `result` | string enum | `cleaned`, `issue_remaining`, `unclear` | Inspection verdict |
| `reason` | string | short sentence | Concise explanation |

*Rule:* If `same_location` is `false`, `result` MUST be `"unclear"` and `reason` must state that the after photo does not match the before photo location.
*Rule:* Judge only cleaning items; ignore permanent property fixtures, tape, stickers, and maintenance markings.

### 3. Complaint Check (Day 3 feature)
Called when a client submits a complaint via `POST /api/jobs/:id/complaints`. Evaluates complaint text against all before and after photos.

| Field | Type | Values | Description |
|---|---|---|---|
| `finding` | string enum | `supported`, `not_supported`, `unclear` | Whether photo evidence supports client complaint |
| `areaLabel` | string | area name | The relevant area (or "General" / "Unknown") |
| `explanation` | string | short sentence | Concise, objective, neutral explanation citing photo evidence |
| `suggested_action` | string | short sentence | Actionable next step for technician / supervisor |

*Rules:*
- Judge strictly against photo evidence.
- If the complaint is about something photos cannot show (e.g. smell, unphotographed areas, pre-existing structural damage), return `"unclear"`.
- Never accuse the client or technician. Keep explanations neutral, factual, and concise.

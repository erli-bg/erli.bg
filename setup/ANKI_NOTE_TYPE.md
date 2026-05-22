# Anki Note Type: "Erli Lesson Card"

The worker expects every note in the deck to use this note-type, with these six fields in this order. The card template is what you see when studying inside Anki; it does not affect what gets published to erli.bg (the worker reads the fields directly), but it makes the deck pleasant to use.

## Fields

| # | Name             | What goes here                                                            | Required? |
|---|------------------|---------------------------------------------------------------------------|-----------|
| 1 | `English`        | The English word or phrase. Front of the card.                            | yes       |
| 2 | `English Example`| A short English sentence using the word.                                  | optional  |
| 3 | `Erli`           | The Erli word or phrase. Back of the card.                                | yes       |
| 4 | `Erli Example`   | The Erli translation of the example sentence.                             | optional  |
| 5 | `Audio Erli`     | The `[sound:filename.mp3]` tag of an Erli audio recording.                | optional  |
| 6 | `Vimeo`          | Vimeo URL for the lesson video. Set on **one card** only; rest can stay empty. | required on one card |

Field order matters — the worker reads `flds[0]` through `flds[5]` in this exact order.

## Setting up the note type in Anki

1. Open Anki Desktop.
2. **Tools → Manage Note Types** (or `⌘+Shift+N`).
3. **Add** → "Add: Basic" → name it `Erli Lesson Card`. Click OK.
4. Select `Erli Lesson Card` from the list, click **Fields...**.
5. The new type starts with `Front` and `Back`. Rename and add:
   - Rename `Front` → `English`
   - Rename `Back` → `Erli`
   - **Add** → `English Example`. **Reposition** below `English`.
   - **Add** → `Erli Example`. **Reposition** below `Erli`.
   - **Add** → `Audio Erli`. **Reposition** below `Erli Example`.
   - **Add** → `Vimeo`. **Reposition** at the bottom.
   Final order: `English`, `English Example`, `Erli`, `Erli Example`, `Audio Erli`, `Vimeo`. Close the Fields dialog.
6. Select `Erli Lesson Card` again, click **Cards...**.

## Card template

Paste these three blocks (Front, Back, Styling) into the Cards dialog. They produce a clean, readable card with the audio playable on the back.

### Front Template

```html
<div class="english">{{English}}</div>
{{#English Example}}
  <div class="example">{{English Example}}</div>
{{/English Example}}
```

### Back Template

```html
{{FrontSide}}

<hr id="answer">

<div class="erli">{{Erli}}</div>
{{#Erli Example}}
  <div class="example">{{Erli Example}}</div>
{{/Erli Example}}

{{#Audio Erli}}
  <div class="audio">{{Audio Erli}}</div>
{{/Audio Erli}}
```

### Styling

```css
.card {
  font-family: Times, "Times New Roman", serif;
  font-size: 22px;
  text-align: center;
  color: #000;
  background-color: #fff;
  padding: 20px;
}

.english, .erli {
  font-size: 28px;
  margin: 12px 0;
}

.erli {
  color: #003366;
}

.example {
  font-style: italic;
  color: #555;
  font-size: 18px;
  margin: 8px 0 16px;
}

.audio {
  margin-top: 20px;
}

hr#answer {
  border: 0;
  border-top: 1px solid #ccc;
  margin: 18px 0;
}
```

Close the Cards dialog. Close Manage Note Types. Done.

## Adding the first note (to test)

1. Click **Add** (the big top-right button in Anki).
2. Type: `Erli Lesson Card`. Deck: any (you can create a "Erli — sandbox" deck for testing).
3. Fill in:
   - English: `health`
   - English Example: `I wish you good health.`
   - Erli: `sastipe`
   - Erli Example: `Mangàv tuke sastipè.`
   - Audio Erli: (leave empty for now, or drop in an mp3 — Anki adds the `[sound:...]` tag automatically when you record or import)
   - Vimeo: `https://vimeo.com/123456789`
4. **Add**, close the Add dialog.

## Exporting as `.apkg`

1. **File → Export...**.
2. Type: `Anki Deck Package (*.apkg)`.
3. Include: select your test deck. Check **Include media**. **Include scheduling information** can stay off — the published lesson doesn't care about your review history.
4. Save to a filename matching `NN_MM-DD-YYYY_Name.apkg`. For example:
   - `01_06-06-2026_Greetings.apkg`
   - `02_06-20-2026_AtTheDoctor.apkg`
5. Email this file as an attachment to your Postmark inbound address.

The worker handles the rest.

## Demo deck for testing

`setup/demo-lesson.apkg` is a pre-built deck with 5 notes, 2 audio files, and a placeholder Vimeo URL. Use it for your first end-to-end test before recording real material — see `MORNING_WALKTHROUGH.md` step 4.

/**
 * Workout-tracker — backend Google Apps Script
 *
 * DEPLOIEMENT (a faire 1 fois) :
 *   1. Va sur https://script.google.com → "+ New project"
 *   2. Renomme le projet "workout-tracker-api"
 *   3. Colle ce fichier entier dans Code.gs (remplace tout)
 *   4. Sauvegarde (Ctrl+S)
 *   5. Clic "Deploy" (en haut a droite) → "New deployment"
 *   6. Engrenage a cote de "Select type" → "Web app"
 *   7. Description : "v1"
 *      Execute as : "Me (toi@gmail.com)"
 *      Who has access : "Anyone"  ← important, sinon ton PWA peut pas appeler
 *   8. "Deploy" → autorise l'acces a Sheets quand demande
 *   9. Copie l'URL "Web app URL" (https://script.google.com/macros/s/AKfycb.../exec)
 *      → c'est cette URL que tu mettras dans BACKEND_URL cote PWA
 *
 * REDEPLOIEMENT apres modif du code :
 *   Deploy → Manage deployments → engrenage → New version → Deploy
 *   (l'URL ne change pas)
 */

const SHEET_ID = "1PqHaq4ndgXXufUUQfvCrKUgQDtnNw3RngQuNDkupTsk";
const TOKEN = "X1tn0c3PU5lNjIzvpnZqrWDiQAh6rKJe/hX18PbcwjI=";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.token !== TOKEN) {
      return _json({ error: "unauthorized" });
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);

    if (data.action === "session") {
      const sheet = _getOrCreate(ss, "sessions",
        ["date", "day", "exerciseId", "sets", "reps", "weight", "duration", "notes"]);
      const session = data.payload || {};
      const exercises = session.exercises || [];
      const notes = session.notes || "";
      exercises.forEach(ex => {
        sheet.appendRow([
          session.date || "",
          session.day || "",
          ex.id || "",
          ex.sets || "",
          ex.reps || "",
          ex.weight || "",
          ex.duration || "",
          notes
        ]);
      });
      return _json({ ok: true, written: exercises.length });
    }

    if (data.action === "weight") {
      const sheet = _getOrCreate(ss, "weights", ["date", "kg"]);
      const p = data.payload || {};
      sheet.appendRow([p.date || "", p.kg || ""]);
      return _json({ ok: true });
    }

    return _json({ error: "unknown action: " + data.action });
  } catch (err) {
    return _json({ error: err.toString() });
  }
}

function doGet(e) {
  return _json({ ok: true, message: "workout-tracker-api alive" });
}

function _getOrCreate(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

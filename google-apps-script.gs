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
        ["date", "day", "exerciseId", "sets", "reps", "weight", "duration", "notes", "speed"]);
      // Patch retroactif : si la colonne speed manque (sheet cree avant v3), l'ajoute
      if (sheet.getRange(1, 9).getValue() !== "speed") {
        sheet.getRange(1, 9).setValue("speed");
      }
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
          notes,
          ex.speed || ""
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

    if (data.action === "backup") {
      const wSheet = ss.getSheetByName("weights");
      const sSheet = ss.getSheetByName("sessions");

      const weights = [];
      if (wSheet) {
        const rows = wSheet.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          const [date, kg] = rows[i];
          if (date === "" || date === null) continue;
          weights.push({ date: _isoDate(date), v: Number(kg) || 0 });
        }
      }

      const sessions = [];
      if (sSheet) {
        const rows = sSheet.getDataRange().getValues();
        const groups = {};
        const order = [];
        for (let i = 1; i < rows.length; i++) {
          const [date, day, exId, sets, reps, weight, duration, notes, speed] = rows[i];
          if (date === "" || date === null) continue;
          const iso = _isoDate(date);
          const key = iso + "|" + (day || "") + "|" + (notes || "");
          if (!groups[key]) {
            groups[key] = {
              date: _frDate(date),
              dateISO: iso,
              day: day || "",
              label: notes || "",
              notes: notes || "",
              exercises: []
            };
            order.push(key);
          }
          const isCardio = duration !== "" && duration !== null;
          groups[key].exercises.push(isCardio ? {
            name: String(exId || ""),
            duration: Number(duration) || 0,
            speed: Number(speed) || 0,
            type: "cardio",
            date: _frDate(date)
          } : {
            name: String(exId || ""),
            weight: Number(weight) || 0,
            sets: Number(sets) || 0,
            reps: Number(reps) || 0,
            type: "muscu",
            date: _frDate(date)
          });
        }
        order.forEach(k => sessions.push(groups[k]));
        // Tri date desc (plus recente en premier, comme dans le PWA)
        sessions.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
      }

      return _json({ ok: true, sessions, weights });
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

function _toDate(d) {
  if (d === null || d === undefined || d === "") return null;
  // instanceof Date peut etre faux entre realms en Apps Script V8 -> on teste getTime
  if (typeof d === "object" && typeof d.getTime === "function") return d;
  // String : si format ISO yyyy-MM-dd ou ISO complet, parse
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
}

function _isoDate(d) {
  const date = _toDate(d);
  if (!date) return String(d || "");
  return Utilities.formatDate(date, "Europe/Paris", "yyyy-MM-dd");
}

function _frDate(d) {
  const date = _toDate(d);
  if (!date) return String(d || "");
  return Utilities.formatDate(date, "Europe/Paris", "dd/MM/yyyy");
}

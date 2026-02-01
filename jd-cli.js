const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const readline = require("readline");
const { execSync } = require("child_process");

const CFG = {
  url: "https://www.jongedemocraten.nl/wp-json/tribe/events/v1/events",
  user: process.env.WP_USER,
  pass: process.env.WP_APP_PASSWORD,
};

const MAP = {
  Amsterdam: "AMS",
  "Arnhem-Nijmegen": "AN",
  Brabant: "BR",
  Fryslân: "FR",
  "Groningen-Drenthe": "GD",
  "Leiden-Haaglanden": "LH",
  Limburg: "LB",
  "Rotterdam-Zeeland": "RZ",
  Utrecht: "UTR",
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(
  "\x1b[1m\x1b[32mJD CLI\x1b[0m | Paste SIMPLE DATA + [ENTER] + [CTRL+D]:\n",
);

let input = "";
rl.on("line", (l) => {
  input += l;
});

rl.on("close", () => {
  if (!input.trim()) process.exit(1);
  try {
    const raw = JSON.parse(input);
    const dStr = raw.datum.replace(/\//g, "-");
    const parts = dStr.split("-");
    if (parts.length !== 3) throw new Error("Datum formaat fout");

    const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    const dNl = `${parts[0]} / ${parts[1]} / ${parts[2]}`;
    const sh = MAP[raw.afdeling] || "JD";

    const bannerUrl =
      "https://www.jongedemocraten.nl/wp-content/uploads/Fotos-website-3.png";

    let rawHtml = `
<div style="width:100%; font-family:sans-serif; color:#222; margin-top:-1rem;">
    
    <div style="width:100%; height:250px; overflow:hidden; border-radius:15px; margin-bottom:2rem; background-color:#f0f0f0;">
        <img src="${bannerUrl}" style="width:100%; height:100%; object-fit:cover;" alt="Banner">
    </div>

    <h1 style="font-size:2.5rem; font-weight:900; margin:0 0 2rem 0; line-height:1.2; color:#1a202c;">
        JD-${sh}: ${raw.titel}
    </h1>

    <div style="display:flex; flex-wrap:wrap; gap:3rem;">
        <div style="flex:1; min-width:250px;">
            <h2 style="font-size:1.5rem; font-weight:bold; margin-top:0; margin-bottom:1rem; color:#1a202c;">In het kort</h2>
            <div style="font-size:1rem; line-height:1.6;">
                <p style="margin-bottom:0.5rem;"><strong style="color:#53cf74; text-transform:uppercase; font-size:0.9rem;">Datum</strong><br>${dNl}</p>
                <p style="margin-bottom:0.5rem;"><strong style="color:#53cf74; text-transform:uppercase; font-size:0.9rem;">Tijd</strong><br>${raw.start}${raw.eind ? " – " + raw.eind : ""}</p>
                <p style="margin-bottom:0.5rem;"><strong style="color:#53cf74; text-transform:uppercase; font-size:0.9rem;">Locatie</strong><br>${raw.locatie || "Volgt"}</p>
            </div>
        </div>

        <div style="flex:2; min-width:300px;">
            <h2 style="font-size:1.5rem; font-weight:bold; margin-top:0; margin-bottom:1rem; color:#1a202c;">Beschrijving</h2>
            <p style="font-weight:bold; margin-bottom:1rem;">${raw.afdeling} organiseert: ${raw.titel}</p>
            <div style="line-height:1.6;">${raw.beschrijving.replace(/\n/g, "<br>")}</div>
        </div>
    </div>
</div>

<style>
  .tribe-events-single-event-title, h1.tribe-events-single-event-title { display: none !important; }
  .tribe-events-schedule, .tribe-events-notices, .tribe-events-event-meta, .tribe-events-single-section, .tribe-events-cal-links, .tribe-events-back, .tribe-events-nav-pagination, .tribe-events-event-image { display: none !important; }
  #tribe-events-content { padding-top: 0 !important; margin-top: 0 !important; }
</style>`;

    // Opschonen
    const html = rawHtml
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\n/g, " ")
      .replace(/\s\s+/g, " ");

    const payload = {
      title: `JD-${sh}: ${raw.titel}`,
      description: html,
      excerpt: `JD-${sh} organiseert: ${raw.titel} op ${dNl}. Locatie: ${raw.locatie || "Volgt"}.`,
      start_date: `${isoDate} ${raw.start}:00`,
      end_date: `${isoDate} ${raw.eind || raw.start}:00`,
      categories: [raw.afdeling],
      venue: { venue: raw.locatie || "Locatie volgt" },
    };

    console.log(`\nVersturen: ${payload.title}...`);

    const auth = Buffer.from(`${CFG.user}:${CFG.pass}`).toString("base64");
    const fs = require("fs");
    const tmpFile = path.join(__dirname, "tmp.json");
    fs.writeFileSync(tmpFile, JSON.stringify(payload));

    const cmd = `curl -s -w "\n%{http_code}" -X POST "${CFG.url}" -H "Authorization: Basic ${auth}" -H "Content-Type: application/json" --data @${tmpFile}`;

    const res = execSync(cmd).toString().split("\n");
    const code = res.pop();

    if (code === "201" || code === "200") {
      console.log("\x1b[1m\x1b[32m✔ ONLINE\x1b[0m");
    } else {
      console.log("\x1b[31m✘ ERROR\x1b[0m", code);
      console.log("Details:", res.join("\n"));
    }

    fs.unlinkSync(tmpFile);
  } catch (e) {
    console.log("\x1b[31m✘ FOUT\x1b[0m", e.message);
  }
});

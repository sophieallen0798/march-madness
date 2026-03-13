// bracket-render.js
// Shared bracket rendering and interaction logic.
// Used by both submit-bracket.html (editable) and my-bracket.html (scoring/read-only).

// ────────────────────────────────────────────────────────────────
// REGION CODE MAPS  (numeric region code → display label)
// ────────────────────────────────────────────────────────────────

const REGION_CODE_MAP = {
  "1": "play-in",
  "2": "south",
  "3": "west",
  "4": "east",
  "5": "midwest",
  "6": "final",
  "601": "final",
  "701": "final",
};

const REGION_CODE_MAP_W = {
  "1": "play-in",
  "2": "spokane",
  "3": "birmingham",
  "4": "spokane",
  "5": "birmingham",
  "6": "final",
  "601": "final",
  "701": "final",
};

// const REGION_CODE_MAP_W = {
//   "1": "play-in",
//   "2": "fort worth 1",
//   "3": "sacramento 1",
//   "4": "fort worth 2",
//   "5": "sacramento 2",
//   "6": "final",
//   "601": "final",
//   "701": "final",
// };

// ────────────────────────────────────────────────────────────────
// DATA LOADING
// ────────────────────────────────────────────────────────────────

/**
 * Derives the numeric sectionId (2-5) from a bracket_position_id when
 * the section_id column is missing or 0 (e.g. data synced before the
 * section_id migration).
 *
 * The NCAA bracket encodes section deterministically via position offsets:
 *   Round 2 (8 games/section): offsets 1-8 → 2, 9-16 → 4, 17-24 → 3, 25-32 → 5
 *   Round 3 (4 games/section): offsets 1-4 → 2, 5-8 → 4, 9-12 → 3, 13-16 → 5
 *   Round 4 (2 games/section): offsets 1-2 → 2, 3-4 → 4, 5-6 → 3, 7-8 → 5
 *   Round 5 (1 game/section):  offset  1  → 2,  2  → 4,  3  → 3,  4  → 5
 * This pattern applies consistently to both men's and women's brackets.
 */
function inferSectionId(bracketPositionId) {
  if (!bracketPositionId) return 0;
  const round = Math.floor(bracketPositionId / 100);
  if (round === 1) return 1; // First Four
  if (round >= 6) return 6; // Final Four / Championship
  const offset = bracketPositionId % 100;
  // Number of games per section shrinks by half each round: 8 → 4 → 2 → 1
  const gamesPerSection = Math.pow(2, 5 - round);
  const sectionOrder = [2, 4, 3, 5];
  const idx = Math.min(Math.floor((offset - 1) / gamesPerSection), 3);
  return sectionOrder[idx] ?? 0;
}

/**
 * Creates a synthetic "combo" team object for a play-in matchup.
 * Used when round 1 teams are known but the winner hasn't played yet,
 * so the round 2 slot shows "Team1/Team2" as a single selectable option.
 */
function makeComboTeam(t1, t2) {
  return {
    isCombo: true,
    id: `${t1.id}:${t2.id}`,
    id1: t1.id,
    id2: t2.id,
    name_short: `${t1.name_short}/${t2.name_short}`,
    seed: "",
    logo_url: null,
  };
}

/**
 * Fetches all games and teams for a given sport/year from Supabase.
 * Returns { games, teams, teamById }.
 */
async function loadBracketData(sport, year = TOURNAMENT_YEAR) {
  const [gamesResp, teamsResp] = await Promise.all([
    supabase
      .from("games")
      .select("*")
      .eq("sport", sport)
      .eq("year", year)
      .gte("round", 1)      // include First Four (round 1) for play-in display
      .order("round")
      .order("bracket_position_id"),
    supabase
      .from("teams")
      .select("*")
      .eq("sport", sport)
      .eq("year", year),
  ]);
  console.log(`Fetched ${gamesResp.data?.length ?? 0} games and ${teamsResp.data?.length ?? 0} teams for ${sport} ${year}`);

  if (gamesResp.error) throw new Error(gamesResp.error.message);
  if (teamsResp.error) throw new Error(teamsResp.error.message);

  const teams = teamsResp.data ?? [];
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const rawGames = gamesResp.data ?? [];

  // Build play-in combo lookup from round 1 games: victor position → combo team.
  // Only create combos when both play-in teams are known.
  const round1ByVictorPos = new Map();
  for (const r1 of rawGames) {
    if (r1.round !== 1) continue;
    console.log(r1);
    if (!r1.victor_bracket_position_id || !r1.team1_id || !r1.team2_id) continue;
    const t1 = teamById.get(r1.team1_id);
    const t2 = teamById.get(r1.team2_id);
    if (t1 && t2) round1ByVictorPos.set(r1.victor_bracket_position_id, makeComboTeam(t1, t2));
  }

  const games = rawGames.map((g) => {
    // Prefer the stored section_id; fall back to deriving it from bracket_position_id.
    // The fallback handles data synced before the section_id migration (DEFAULT 0).
    const sectionId = g.section_id || inferSectionId(g.bracket_position_id);
    let team1 = g.team1_id ? teamById.get(g.team1_id) ?? null : null;
    let team2 = g.team2_id ? teamById.get(g.team2_id) ?? null : null;
    // For round 2 games: if a team slot is TBA but a play-in game with both teams
    // feeds this position, show "TeamA/TeamB" as the composite option.
    if (g.round === 2) {
      const combo = round1ByVictorPos.get(g.bracket_position_id);
      if (combo) {
        if (!team1) team1 = combo;
        else if (!team2) team2 = combo;
      }
    }
    return {
      ...g,
      sectionId,
      team1,
      team2,
      winner: g.winner_id ? teamById.get(g.winner_id) ?? null : null,
    };
  });

  // Diagnostic: log section distribution so missing/incorrect section_id is visible in console
  try {
    const bySid = {};
    games.forEach((x) => { bySid[x.sectionId] = (bySid[x.sectionId] ?? 0) + 1; });
    const usingFallback = games.filter((x) => !x.section_id && x.sectionId).length;
    console.log(`loadBracketData [${sport}] - games per sectionId:`, bySid,
      usingFallback ? `(${usingFallback} used position fallback - re-sync to persist section_id)` : "");
  } catch (e) { /* ignore logging errors */ }

  return { games, teams, teamById };
}

// ────────────────────────────────────────────────────────────────
// BRACKET LAYOUT REGIONS
// ────────────────────────────────────────────────────────────────

// sectionId 6 = "CC" regionCode = Final Four + Championship games
const FINAL_SECTION_IDS = new Set([6]);

function isFinalGame(game) {
  return FINAL_SECTION_IDS.has(game.sectionId);
}

// Numeric region codes for left and right bracket panels
const LEFT_REGIONS  = [2, 3];
const RIGHT_REGIONS = [4, 5];

// Rounds displayed left→right for left panels, right→left for right panels
const LEFT_ROUND_ORDER  = [2, 3, 4, 5];
const RIGHT_ROUND_ORDER = [5, 4, 3, 2];
const FINAL_POSITION_ORDER = [601, 701, 602]; // Final Four + Championship order

// ────────────────────────────────────────────────────────────────
// TEAM CARD HTML
// ────────────────────────────────────────────────────────────────

function logoHtml(team) {
  if (!team?.logo_url) return "";
  return `<img src="https://ncaa.com${team.logo_url}" alt="${team.name_short}" class="team-logo" onerror="this.style.display='none'" />`;
}

/**
 * Renders a read-only team row for informational play-in cards (no radio button).
 */
function infoTeamRowHtml(team, slot, winnerId) {
  const border = slot === 1 ? "border-bottom" : "";
  if (!team) {
    return `<div class="team-option-scoring d-flex align-items-center px-3 py-2 ${border}">
              <span class="small text-muted fst-italic">TBD</span>
            </div>`;
  }
  const isWinner = winnerId && team.id === winnerId;
  const bold = isWinner ? "fw-bold" : "";
  const check = isWinner ? `<span class="ms-auto text-success small">&#10003;</span>` : "";
  return `
    <div class="team-option-scoring d-flex align-items-center px-3 py-2 ${border}">
      <span class="d-flex align-items-center gap-2 w-100">
        ${logoHtml(team)}
        <span class="text-muted small">${team.seed}</span>
        <span class="${bold}">${team.name_short}</span>
        ${check}
      </span>
    </div>`;
}

/**
 * Renders a single team row used by the editable (submit) bracket.
 * slot: 1 or 2.
 */
function editableTeamRowHtml(gameId, team, slot) {
  if (!team) {
    return `<div class="team-option placeholder px-3 py-2 border-bottom" data-game-id="${gameId}" data-slot="${slot}">
              <span class="small text-muted fst-italic">TBD</span>
            </div>`;
  }
  const borderClass = slot === 1 ? "border-bottom" : "";
  if (team.isCombo) {
    return `
      <div class="team-option ${borderClass} form-check m-0 px-3 py-2"
           data-game-id="${gameId}"
           data-slot="${slot}"
           data-team-id="${team.id}"
           data-team-name="${team.name_short}"
           data-team-seed=""
           data-team-logo="">
        <input class="form-check-input team-radio"
               type="radio"
               name="pick_${gameId}"
               value="${team.id}"
               id="g${gameId}_s${slot}"
               autocomplete="off" />
        <label for="g${gameId}_s${slot}" class="form-check-label w-100 ms-2" style="cursor:pointer;">
          <span class="d-flex align-items-center gap-2">
            <span class="badge bg-secondary text-white small">Play-In</span>
            <span>${team.name_short}</span>
          </span>
        </label>
      </div>`;
  }
  return `
    <div class="team-option ${borderClass} form-check m-0 px-3 py-2"
         data-game-id="${gameId}"
         data-slot="${slot}"
         data-team-id="${team.id}"
         data-team-name="${team.name_short}"
         data-team-seed="${team.seed}"
         data-team-logo="${team.logo_url ?? ''}">
      <input class="form-check-input team-radio"
             type="radio"
             name="pick_${gameId}"
             value="${team.id}"
             id="g${gameId}_s${slot}"
             autocomplete="off" />
      <label for="g${gameId}_s${slot}" class="form-check-label w-100 ms-2" style="cursor:pointer;">
        <span class="d-flex align-items-center gap-2">
          ${logoHtml(team)}
          <span class="text-muted small">${team.seed}</span>
          <span>${team.name_short}</span>
        </span>
      </label>
    </div>`;
}

/**
 * Renders a single team row used by the scoring (read-only) bracket.
 * pickedTeamId: the primary team the user picked for this game.
 * actualWinnerId: the confirmed winner (or null).
 * pickedTeamId2: secondary team for a play-in combo pick (or null).
 */
function scoringTeamRowHtml(team, slot, pickedTeamId, actualWinnerId, pickedTeamId2 = null) {
  const isLast   = slot === 2;
  const border   = isLast ? "" : "border-bottom";

  if (!team) {
    return `<div class="team-option-scoring d-flex align-items-center px-3 py-2 ${border}">
              <span class="small text-muted fst-italic">TBD</span>
            </div>`;
  }

  // For combo teams still in the bracket (play-in not yet resolved), match on either sub-team ID.
  const isPicked = team.isCombo
    ? (pickedTeamId === team.id1 || pickedTeamId === team.id2 ||
       pickedTeamId2 === team.id1 || pickedTeamId2 === team.id2)
    : (pickedTeamId === team.id || pickedTeamId2 === team.id);
  let pickClass  = "";
  if (isPicked) {
    if (actualWinnerId === null || actualWinnerId === undefined) {
      pickClass = "pick-pending";
    } else {
      const pickedCorrectly = actualWinnerId === pickedTeamId || actualWinnerId === pickedTeamId2;
      pickClass = pickedCorrectly ? "pick-correct" : "pick-incorrect";
    }
  }

  const checkmark = isPicked ? `<span class="ms-auto badge bg-secondary">&#10003;</span>` : "";
  const bold      = isPicked ? "fw-bold" : "";

  return `
    <div class="team-option-scoring d-flex align-items-center px-3 py-2 ${border} ${pickClass}">
      <span class="d-flex align-items-center gap-2 w-100">
        ${logoHtml(team)}
        <span class="text-muted small">${team.seed}</span>
        <span class="${bold}">${team.name_short}</span>
        ${checkmark}
      </span>
    </div>`;
}

// ────────────────────────────────────────────────────────────────
// RENDER A SINGLE GAME CARD
// ────────────────────────────────────────────────────────────────

function editableGameCardHtml(game) {
  const { id, bracket_position_id, victor_bracket_position_id, round, team1, team2 } = game;
  const tbdClass = (!team1 || !team2) ? "tbd" : "";
  return `
    <div class="bracket-game"
         data-game-id="${id}"
         data-bracket-position="${bracket_position_id}"
         data-victor-position="${victor_bracket_position_id ?? ''}"
         data-round="${round}">
      <div class="matchup card ${tbdClass}">
        <div class="card-body p-0">
          ${editableTeamRowHtml(id, team1, 1)}
          ${editableTeamRowHtml(id, team2, 2)}
        </div>
      </div>
    </div>`;
}

function scoringGameCardHtml(game, pickedTeamId, pickedTeamId2 = null) {
  const { id, bracket_position_id, team1, team2, winner_id, game_state, start_time } = game;
  const tbdClass = (!team1 && !team2) ? "tbd" : "";

  let statusHtml = "";
  if (!winner_id && start_time) {
    const d = new Date(start_time);
    statusHtml = `<div class="text-center small text-muted py-1 border-top bg-light">${d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>`;
  } else if (!winner_id && (game_state ?? "").toLowerCase() === "live") {
    statusHtml = `<div class="text-center small fw-bold text-danger py-1 border-top bg-light">LIVE</div>`;
  }

  return `
    <div class="bracket-game scoring-game" data-bracket-position="${bracket_position_id}">
      <div class="matchup card ${tbdClass}">
        <div class="card-body p-0">
          ${scoringTeamRowHtml(team1, 1, pickedTeamId, winner_id, pickedTeamId2)}
          ${scoringTeamRowHtml(team2, 2, pickedTeamId, winner_id, pickedTeamId2)}
          ${statusHtml}
        </div>
      </div>
    </div>`;
}

/**
 * Read-only info card for a First Four play-in game (no radio buttons).
 * Uses class `bracket-game-info` so pick collection/validation ignores it.
 */
function infoGameCardHtml(game) {
  const { bracket_position_id, team1, team2, winner_id, game_state, start_time } = game;
  const tbdClass = (!team1 && !team2) ? "tbd" : "";
  let statusHtml = "";
  if (winner_id) {
    statusHtml = `<div class="text-center small fw-bold text-success py-1 border-top bg-light">FINAL</div>`;
  } else if ((game_state ?? "").toLowerCase() === "live") {
    statusHtml = `<div class="text-center small fw-bold text-danger py-1 border-top bg-light">LIVE</div>`;
  } else if (start_time) {
    const d = new Date(start_time);
    statusHtml = `<div class="text-center small text-muted py-1 border-top bg-light">${d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>`;
  }
  return `
    <div class="bracket-game-info" style="min-width:160px;max-width:220px;flex:1 1 160px;">
      <div class="matchup card ${tbdClass}">
        <div class="card-body p-0">
          ${infoTeamRowHtml(team1, 1, winner_id)}
          ${infoTeamRowHtml(team2, 2, winner_id)}
          ${statusHtml}
        </div>
      </div>
    </div>`;
}

// ────────────────────────────────────────────────────────────────
// RENDER REGION PANEL
// ────────────────────────────────────────────────────────────────

function renderRegionPanel(regionName, games, roundOrder, panelClass, renderGameFn) {
  const roundCols = roundOrder.map((r) => {
    const regionGames = games
      .filter((g) => g.round === r)
      .sort((a, b) => a.bracket_position_id - b.bracket_position_id);
    const gameCards = regionGames.map(renderGameFn).join("");
    return `
      <div class="col d-flex round-col" data-round="${r}">
        <div class="d-flex flex-column justify-content-around w-100 round-games">
          ${gameCards}
        </div>
      </div>`;
  }).join("");

  return `
    <section class="region-panel card shadow-sm ${panelClass}">
      <div class="card-header py-2 text-center fw-semibold">${regionName}</div>
      <div class="card-body p-2">
        <div class="row row-cols-4 g-3 align-items-stretch region-board">
          ${roundCols}
        </div>
      </div>
    </section>`;
}

function renderFinalPanel(finalGames, renderGameFn) {
  const ordered = [...finalGames].sort((a, b) => {
    const ia = FINAL_POSITION_ORDER.indexOf(a.bracket_position_id);
    const ib = FINAL_POSITION_ORDER.indexOf(b.bracket_position_id);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  // Group by round for column layout: round 6 (x2) and round 7 (x1)
  const semifinals = ordered.filter((g) => g.round === 6).sort((a, b) => a.bracket_position_id - b.bracket_position_id);
  const semifinalLeft  = semifinals[0] ?? null;
  const semifinalRight = semifinals[1] ?? null;
  const championship   = ordered.find((g) => g.round === 7) ?? null;

  const col = (game) => game
    ? `<div class="col d-flex"><div class="d-flex flex-column justify-content-around w-100 round-games">${renderGameFn(game)}</div></div>`
    : `<div class="col"></div>`;

  return `
    <section class="region-panel card shadow-sm region-panel-final">
      <div class="card-header py-2 text-center fw-semibold">Final Four &amp; Championship</div>
      <div class="card-body p-2">
        <div class="row row-cols-3 g-3 align-items-center final-round-wrap">
          ${col(semifinalLeft)}
          ${col(championship)}
          ${col(semifinalRight)}
        </div>
      </div>
    </section>`;
}

/**
 * Renders the First Four play-in section as a compact info strip.
 * Returns an HTML string (empty string if no play-in games).
 */
function renderPlayInSection(playInGames) {
  if (!playInGames.length) return "";
  const cards = [...playInGames]
    .sort((a, b) => a.bracket_position_id - b.bracket_position_id)
    .map(infoGameCardHtml)
    .join("");
  return `
    <section class="region-panel card shadow-sm region-panel-playin mb-3">
      <div class="card-header py-2 text-center fw-semibold">First Four</div>
      <div class="card-body p-2">
        <div class="d-flex flex-wrap gap-3 justify-content-center align-items-start">
          ${cards}
        </div>
      </div>
    </section>`;
}

// ────────────────────────────────────────────────────────────────
// FULL BRACKET RENDER
// ────────────────────────────────────────────────────────────────

/**
 * Renders the complete 3-column bracket board into `container`.
 *
 * @param {HTMLElement} container              Target element
 * @param {Array}       games                  Enriched game objects (with team1/team2)
 * @param {string}      mode                   "editable" | "scoring"
 * @param {Map}         picksMap               Map<gameId, pickedTeamId> (only for scoring mode)
 * @param {string}      sport                  "basketball-men" | "basketball-women"
 * @param {Map}         picksMap2              Map<gameId, pickedTeamId2> for combo picks (scoring mode)
 */
function renderBracket(container, games, mode = "editable", picksMap = new Map(), sport = "basketball-men", picksMap2 = new Map()) {
  const isEditable = mode === "editable";
  const labelMap = sport === "basketball-women" ? REGION_CODE_MAP_W : REGION_CODE_MAP;

  // Build a set of region names that appear for more than one sectionId so we can
  // disambiguate them (e.g. women's 2025 has two "Spokane" pods and two "Birmingham" pods).
  const allRegionCodes = [...LEFT_REGIONS, ...RIGHT_REGIONS];
  const regionNameCount = {};
  allRegionCodes.forEach((c) => {
    const s = games.find((g) => g.sectionId === c);
    const name = s?.region ? titleCase(s.region) : titleCase(labelMap[String(c)] ?? String(c));
    regionNameCount[name] = (regionNameCount[name] ?? 0) + 1;
  });
  const duplicateNames = new Set(Object.keys(regionNameCount).filter((n) => regionNameCount[n] > 1));
  // Track how many times each duplicate name has been used so we can number them 1, 2, …
  const duplicateUseCount = {};

  function regionLabel(code) {
    const sample = games.find((g) => g.sectionId === code);
    const base = sample?.region ? titleCase(sample.region) : titleCase(labelMap[String(code)] ?? String(code));
    if (duplicateNames.has(base)) {
      duplicateUseCount[base] = (duplicateUseCount[base] ?? 0) + 1;
      return `${base} (${duplicateUseCount[base]})`;
    }
    return base;
  }

  function renderGame(game) {
    if (isEditable) return editableGameCardHtml(game);
    const pickedTeamId  = picksMap.get(game.id) ?? null;
    const pickedTeamId2 = picksMap2.get(game.id) ?? null;
    return scoringGameCardHtml(game, pickedTeamId, pickedTeamId2);
  }

  const regionGames = (code) =>
    games.filter((g) => !isFinalGame(g) && g.sectionId === code);

  const leftPanels = LEFT_REGIONS
    .map((code) => renderRegionPanel(regionLabel(code), regionGames(code), LEFT_ROUND_ORDER, "region-panel-left", renderGame))
    .join("");
  const rightPanels = RIGHT_REGIONS
    .map((code) => renderRegionPanel(regionLabel(code), regionGames(code), RIGHT_ROUND_ORDER, "region-panel-right", renderGame))
    .join("");

  const finalGames = games.filter(isFinalGame);
  const finalPanel = finalGames.length
    ? renderFinalPanel(finalGames, renderGame)
    : `<section class="region-panel card shadow-sm region-panel-final"><div class="card-header py-2 text-center">Final Four</div><div class="card-body"><p class="text-muted">Final Four data not yet available.</p></div></section>`;

  container.innerHTML = `
    <div class="row row-cols-3 align-items-start flex-nowrap gx-3 bracket-board">
      <div class="col bracket-board-col">${leftPanels}</div>
      <div class="col bracket-board-col bracket-board-col-final">${finalPanel}</div>
      <div class="col bracket-board-col">${rightPanels}</div>
    </div>`;

  if (isEditable) attachEditableHandlers(container);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function titleCase(s) {
  return String(s).replace(/\b\w/g, (c) => c.toUpperCase());
}

// ────────────────────────────────────────────────────────────────
// EDITABLE BRACKET – INTERACTION LOGIC
// ────────────────────────────────────────────────────────────────

function attachEditableHandlers(container) {
  // Map bracket_position -> game element
  const positionMap = new Map();
  container.querySelectorAll(".bracket-game").forEach((el) => {
    const pos = parseInt(el.dataset.bracketPosition);
    if (!isNaN(pos)) positionMap.set(pos, el);
  });

  function determineTargetSlot(sourcePos, targetPos) {
    const feeders = [];
    container.querySelectorAll(".bracket-game").forEach((g) => {
      const vp  = parseInt(g.dataset.victorPosition);
      const sp  = parseInt(g.dataset.bracketPosition);
      if (vp === targetPos) feeders.push(sp);
    });
    if (feeders.length === 2) {
      feeders.sort((a, b) => a - b);
      return sourcePos === feeders[0] ? 1 : 2;
    }
    return sourcePos < targetPos ? 1 : 2;
  }

  function clearCascading(startPos) {
    const gameEl = positionMap.get(startPos);
    if (!gameEl) return;
    gameEl.querySelectorAll("input[type=radio]").forEach((r) => (r.checked = false));
    const matchup = gameEl.querySelector(".matchup");
    if (matchup) {
      matchup.querySelectorAll(".team-option").forEach((opt) => {
        opt.classList.add("placeholder");
        opt.classList.remove("selected");
        opt.dataset.teamId   = "";
        opt.dataset.teamName = "";
        opt.dataset.teamSeed = "";
        opt.dataset.teamLogo = "";
        opt.innerHTML = `<span class="small text-muted fst-italic">TBD</span>`;
      });
      matchup.classList.add("tbd");
    }
    const vp = parseInt(gameEl.dataset.victorPosition);
    if (vp && positionMap.has(vp)) clearCascading(vp);
  }

  function propagateWinner(victorPos, sourcePos, team, sourceGameEl) {
    const nextEl = positionMap.get(victorPos);
    if (!nextEl) return;
    const matchup = nextEl.querySelector(".matchup");
    if (!matchup) return;

    const slot       = determineTargetSlot(sourcePos, victorPos);
    const teamOpts   = matchup.querySelectorAll(".team-option");
    const targetOpt  = teamOpts[slot - 1];
    if (!targetOpt) return;

    const nextGameId = nextEl.dataset.gameId;
    const border     = slot === 1 ? "border-bottom" : "";

    targetOpt.classList.remove("placeholder", "selected");
    targetOpt.dataset.teamId   = team.id;
    targetOpt.dataset.teamName = team.name_short;
    targetOpt.dataset.teamSeed = team.seed;
    targetOpt.dataset.teamLogo = team.logo_url ?? "";

    const teamInner = team.isCombo
      ? `<span class="badge bg-secondary text-white small">Play-In</span><span>${team.name_short}</span>`
      : `${logoHtml(team)}<span class="text-muted small">${team.seed}</span><span>${team.name_short}</span>`;

    targetOpt.innerHTML = `
      <input class="form-check-input team-radio" type="radio"
             name="pick_${nextGameId}" value="${team.id}"
             id="g${nextGameId}_s${slot}" autocomplete="off" />
      <label for="g${nextGameId}_s${slot}" class="form-check-label w-100 ms-2" style="cursor:pointer;">
        <span class="d-flex align-items-center gap-2">
          ${teamInner}
        </span>
      </label>`;

    attachRadioHandler(targetOpt.querySelector(".team-radio"), positionMap, propagateWinner, clearCascading, determineTargetSlot);

    // If both slots filled, remove tbd class
    const allFilled = [...matchup.querySelectorAll(".team-option")].every((o) => !o.classList.contains("placeholder"));
    if (allFilled) matchup.classList.remove("tbd");

    // Clear any downstream picks from this game
    nextEl.querySelectorAll("input[type=radio]").forEach((r) => (r.checked = false));
    const nextVp = parseInt(nextEl.dataset.victorPosition);
    if (nextVp && positionMap.has(nextVp)) clearCascading(nextVp);
  }

  container.querySelectorAll(".team-option:not(.placeholder)").forEach((opt) => {
    opt.addEventListener("click", function () {
      const radio = this.querySelector("input[type=radio]");
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event("change", { bubbles: true })); }
    });
  });

  container.querySelectorAll(".team-radio").forEach((radio) => {
    attachRadioHandler(radio, positionMap, propagateWinner, clearCascading, determineTargetSlot);
  });
}

function attachRadioHandler(radio, positionMap, propagateWinner, clearCascading, determineTargetSlot) {
  if (!radio) return;
  radio.addEventListener("change", function () {
    const gameEl    = this.closest(".bracket-game");
    if (!gameEl) return;
    const victorPos = parseInt(gameEl.dataset.victorPosition);
    const sourcePos = parseInt(gameEl.dataset.bracketPosition);
    const rawValue  = this.value;
    const isCombo   = rawValue.includes(":");

    // Mark selected visually
    gameEl.querySelectorAll(".team-option").forEach((o) => o.classList.remove("selected"));
    const parentOpt = this.closest(".team-option");
    if (parentOpt) parentOpt.classList.add("selected");

    if (victorPos && positionMap.has(victorPos)) {
      // Build a minimal team descriptor from the option's data attributes.
      // For combo picks the id is "id1:id2" and we preserve that for cascading.
      const opt  = this.closest(".team-option");
      const team = isCombo ? {
        isCombo:    true,
        id:         rawValue,
        id1:        parseInt(rawValue.split(":")[0]),
        id2:        parseInt(rawValue.split(":")[1]),
        name_short: opt?.dataset.teamName ?? "",
        seed:       "",
        logo_url:   "",
      } : {
        id:         parseInt(rawValue),
        name_short: opt?.dataset.teamName ?? "",
        seed:       parseInt(opt?.dataset.teamSeed ?? "0") || 0,
        logo_url:   opt?.dataset.teamLogo ?? "",
      };
      propagateWinner(victorPos, sourcePos, team, gameEl);
    }
    gameEl.querySelector(".matchup")?.classList.remove("error");
  });

  // Also handle click on label/row
  const opt = radio.closest(".team-option");
  if (opt) {
    opt.addEventListener("click", function (e) {
      if (e.target === radio || e.target.tagName === "LABEL" || e.target.tagName === "INPUT") return;
      radio.checked = true;
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
}

// ────────────────────────────────────────────────────────────────
// COLLECT PICKS FROM EDITABLE BRACKET
// ────────────────────────────────────────────────────────────────

/**
 * Returns a Map<gameId, {primary, secondary}> from checked radios in container.
 * primary: the team ID (number).
 * secondary: the second team ID for a play-in combo pick, or null.
 */
function collectPicks(container) {
  const picks = new Map();
  container.querySelectorAll(".bracket-game").forEach((gameEl) => {
    const gameId = parseInt(gameEl.dataset.gameId);
    const checked = gameEl.querySelector("input[type=radio]:checked");
    if (checked) {
      const val = checked.value;
      if (val.includes(":")) {
        const parts = val.split(":");
        picks.set(gameId, { primary: parseInt(parts[0]), secondary: parseInt(parts[1]) });
      } else {
        picks.set(gameId, { primary: parseInt(val), secondary: null });
      }
    }
  });
  return picks;
}

/**
 * Highlights games missing a pick. Returns count of invalid games.
 */
function validatePicks(container) {
  let invalid = 0;
  container.querySelectorAll(".bracket-game").forEach((gameEl) => {
    const checked = gameEl.querySelector("input[type=radio]:checked");
    const matchup = gameEl.querySelector(".matchup");
    // Only validate games where both teams are known (not TBD)
    const allOpts = [...(matchup?.querySelectorAll(".team-option") ?? [])];
    const hasBothTeams = allOpts.length === 2 && allOpts.every((o) => !o.classList.contains("placeholder"));
    if (hasBothTeams && !checked) {
      matchup?.classList.add("error");
      invalid++;
    }
  });
  return invalid;
}

// ────────────────────────────────────────────────────────────────
// AUTOFILL
// ────────────────────────────────────────────────────────────────

/**
 * Randomly fills all un-picked valid games (round by round so propagation works).
 */
function autofill(container) {
  for (let round = 2; round <= 7; round++) {
    container.querySelectorAll(`.bracket-game[data-round="${round}"]`).forEach((gameEl) => {
      const alreadyPicked = !!gameEl.querySelector("input[type=radio]:checked");
      if (alreadyPicked) return;
      const opts = [...gameEl.querySelectorAll(".team-option:not(.placeholder)")];
      if (opts.length < 2) return;
      const chosen = opts[Math.floor(Math.random() * opts.length)];
      const radio  = chosen.querySelector("input[type=radio]");
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event("change", { bubbles: true })); }
    });
  }
}

// ────────────────────────────────────────────────────────────────
// ZOOM CONTROLS
// ────────────────────────────────────────────────────────────────

function initZoomControls(scrollEl, zoomSurfaceEl, inBtn, outBtn, resetBtn) {
  if (!scrollEl || !zoomSurfaceEl) return;
  const board   = zoomSurfaceEl.querySelector(".bracket-board");
  if (!board) return;

  let zoom     = 1;
  const STEP   = 0.1;
  const MAX    = 1.6;
  const baseW  = Math.max(board.scrollWidth, 1);

  function fitZoom() {
    return Math.max(0.2, Math.min(1, scrollEl.clientWidth / baseW));
  }

  function applyZoom() {
    const min = fitZoom();
    zoom = Math.max(min, Math.min(MAX, Math.round(zoom * 100) / 100));
    zoomSurfaceEl.style.zoom  = `${zoom}`;
    zoomSurfaceEl.style.transform = "none";
    zoomSurfaceEl.style.width = `${baseW}px`;
    if (resetBtn) resetBtn.textContent = `${Math.round(zoom * 100)}%`;
  }

  function fitToPanel() {
    zoom = fitZoom();
    applyZoom();
    scrollEl.scrollLeft = 0;
    scrollEl.scrollTop  = 0;
  }

  inBtn?.addEventListener   ("click", () => { zoom += STEP; applyZoom(); });
  outBtn?.addEventListener  ("click", () => { zoom -= STEP; applyZoom(); });
  resetBtn?.addEventListener("click", () => fitToPanel());

  scrollEl.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoom += e.deltaY < 0 ? STEP : -STEP;
    applyZoom();
  }, { passive: false });

  window.addEventListener("resize", () => {
    if (zoom < fitZoom()) zoom = fitZoom();
    applyZoom();
  });

  fitToPanel();
}

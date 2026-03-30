// view-bracket.js
// Read-only bracket rendering for my-bracket.html.

// ────────────────────────────────────────────────────────────────
// REGION CODE MAPS  (numeric region code → display label)
// ────────────────────────────────────────────────────────────────

const REGION_CODE_MAP = {
  1: "play-in",
  2: "south",
  3: "west",
  4: "east",
  5: "midwest",
  6: "final",
  601: "final",
  701: "final",
};

// Cache of teams by ID for rendering picks even when game slots are TBD
let bracketTeamById = new Map();

const REGION_CODE_MAP_W = {
  1: "play-in",
  2: "spokane",
  3: "birmingham",
  4: "spokane",
  5: "birmingham",
  6: "final",
  601: "final",
  701: "final",
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
      .gte("round", 1) // include First Four (round 1) for play-in display
      .order("round")
      .order("bracket_position_id"),
    supabase.from("teams").select("*").eq("sport", sport).eq("year", year),
  ]);

  if (gamesResp.error) throw new Error(gamesResp.error.message);
  if (teamsResp.error) throw new Error(teamsResp.error.message);

  const teams = teamsResp.data ?? [];
  const teamById = new Map(teams.map((t) => [t.id, t]));
  // Keep teams accessible for rendering picks even when games have TBD slots
  bracketTeamById = teamById;

  const rawGames = gamesResp.data ?? [];

  // Build play-in combo lookup from round 1 games: victor position → combo team.
  // Only create combos when both play-in teams are known.
  const round1ByVictorPos = new Map();
  for (const r1 of rawGames) {
    if (r1.round !== 1) continue;
    if (!r1.victor_bracket_position_id || !r1.team1_id || !r1.team2_id)
      continue;
    const t1 = teamById.get(r1.team1_id);
    const t2 = teamById.get(r1.team2_id);
    if (t1 && t2)
      round1ByVictorPos.set(
        r1.victor_bracket_position_id,
        makeComboTeam(t1, t2),
      );
  }

  const games = rawGames.map((g) => {
    // Prefer the stored section_id; fall back to deriving it from bracket_position_id.
    // The fallback handles data synced before the section_id migration (DEFAULT 0).
    const sectionId = g.section_id || inferSectionId(g.bracket_position_id);
    let team1 = g.team1_id ? (teamById.get(g.team1_id) ?? null) : null;
    let team2 = g.team2_id ? (teamById.get(g.team2_id) ?? null) : null;
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
      winner: g.winner_id ? (teamById.get(g.winner_id) ?? null) : null,
    };
  });

  // Diagnostic: log section distribution so missing/incorrect section_id is visible in console
  try {
    const bySid = {};
    games.forEach((x) => {
      bySid[x.sectionId] = (bySid[x.sectionId] ?? 0) + 1;
    });
    const usingFallback = games.filter(
      (x) => !x.section_id && x.sectionId,
    ).length;
  } catch (e) {
    /* ignore logging errors */
  }

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
const LEFT_REGIONS = [2, 4];
const RIGHT_REGIONS = [3, 5];

// Rounds displayed left→right for left panels, right→left for right panels
const LEFT_ROUND_ORDER = [2, 3, 4, 5];
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
  const check = isWinner
    ? `<span class="ms-auto text-success small">&#10003;</span>`
    : "";
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

function getTeamIdentityKey(team) {
  if (!team) return null;
  if (team.isCombo) {
    const a = Math.min(team.id1, team.id2);
    const b = Math.max(team.id1, team.id2);
    return `combo:${a}:${b}`;
  }
  if (team.id != null) return `team:${team.id}`;
  return `name:${team.name_short ?? ""}`;
}

function teamMatchesParticipant(team, candidate) {
  if (!team || !candidate) return false;
  if (team.isCombo && candidate.isCombo) {
    return (
      team.id1 === candidate.id1 ||
      team.id1 === candidate.id2 ||
      team.id2 === candidate.id1 ||
      team.id2 === candidate.id2
    );
  }
  if (team.isCombo) {
    return candidate.id === team.id1 || candidate.id === team.id2;
  }
  if (candidate.isCombo) {
    return team.id === candidate.id1 || team.id === candidate.id2;
  }
  return team.id != null && candidate.id != null && team.id === candidate.id;
}

function uniqueTeams(teams) {
  const seen = new Set();
  return teams.filter((team) => {
    const key = getTeamIdentityKey(team);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function teamMatchesAny(team, candidates) {
  return candidates.some((candidate) => teamMatchesParticipant(team, candidate));
}

function normalizeActualAssignedTeam(team) {
  if (!team || team.isCombo) return null;
  return team;
}

function pickPercentHtml(team, pickStatsForGame) {
  const totalPicks = pickStatsForGame?.total ?? 0;
  if (!team || totalPicks <= 0) return "";

  let pickPercent = null;
  if (team.isCombo) {
    const a = Math.min(team.id1, team.id2);
    const b = Math.max(team.id1, team.id2);
    const key = `${a}:${b}`;
    const count = pickStatsForGame?.comboCounts?.get(key) ?? 0;
    pickPercent = Math.round((count / totalPicks) * 100);
  } else if (team.id != null) {
    const count = pickStatsForGame?.teamCounts?.get(team.id) ?? 0;
    pickPercent = Math.round((count / totalPicks) * 100);
  }

  return pickPercent === null
    ? ""
    : `<span class="pick-percent small text-muted">${pickPercent}%</span>`;
}

function buildTeamLabelHtml(team, boldClass = "") {
  return `
      <span class="d-flex align-items-center gap-2 w-100">
        ${logoHtml(team)}
        <span class="text-muted small">${team.seed ?? ""}</span>
        <span class="${boldClass}">${team.name_short}</span>
      </span>`;
}

function wrongPickOverlayRowHtml(team, addBorder = false) {
  const border = addBorder ? "border-bottom" : "";
  return `
    <div class="team-option-scoring d-flex align-items-center px-3 py-2 wrong-pick-overlay ${border}">
      ${buildTeamLabelHtml(team)}
    </div>`;
}

/**
 * Renders a single team row used by the scoring (read-only) bracket.
 * stateClass: visual status class such as pick-correct or pick-pending.
 * isPicked: whether this row represents a participant the user projected into the game.
 */
function scoringTeamRowHtml(
  team,
  slot,
  pickStatsForGame = null,
  stateClass = "",
  isPicked = false,
  wrongPickTeam = null,
) {
  const isLast = slot === 2;
  const border = isLast ? "" : "border-bottom";

  const wrongPickHtml = wrongPickTeam
    ? `<div class="wrong-pick-overlay mb-1">${buildTeamLabelHtml(wrongPickTeam)}</div>`
    : "";

  if (!team) {
    return `<div class="team-option-scoring d-flex align-items-center px-3 py-2 ${border}">
              <span class="w-100">${wrongPickHtml}<span class="small text-muted fst-italic">TBD</span></span>
            </div>`;
  }

  const checkmark = isPicked
    ? `<span class="badge bg-secondary">&#10003;</span>`
    : "";
  const bold = isPicked ? "fw-bold" : "";
  const percentHtml = pickPercentHtml(team, pickStatsForGame);
  const trailingHtml =
    percentHtml || checkmark
      ? `<span class="ms-auto d-flex align-items-center gap-2">${percentHtml}${checkmark}</span>`
      : "";

  return `
    <div class="team-option-scoring d-flex align-items-center px-3 py-2 ${border} ${stateClass}">
      <span class="w-100">
        ${wrongPickHtml}
        <span class="d-flex align-items-center gap-2 w-100">
          ${logoHtml(team)}
          <span class="text-muted small">${team.seed ?? ""}</span>
          <span class="${bold}">${team.name_short}</span>
          ${trailingHtml}
        </span>
      </span>
    </div>`;
}

// ────────────────────────────────────────────────────────────────
// RENDER A SINGLE GAME CARD
// ────────────────────────────────────────────────────────────────

function scoringGameCardHtml(
  game,
  pickStatsForGame = null,
) {
  const {
    bracket_position_id,
    team1,
    team2,
    actualTeam1,
    actualTeam2,
    projectedTeam1,
    projectedTeam2,
    start_time,
    round,
  } = game;

  const projectedParticipants = uniqueTeams(
    [projectedTeam1, projectedTeam2].filter(Boolean),
  );
  const actualParticipants = uniqueTeams([actualTeam1, actualTeam2].filter(Boolean));
  const knownActualParticipantCount = actualParticipants.length;
  const canCompareParticipants = knownActualParticipantCount > 0;
  const isActualMatchupKnown = knownActualParticipantCount === 2;
  const displayRows = [
    {
      actualTeam: actualTeam1 ?? null,
      displayTeam: team1,
      fallbackTeam: projectedTeam1 ?? null,
      slot: 1,
    },
    {
      actualTeam: actualTeam2 ?? null,
      displayTeam: team2,
      fallbackTeam: projectedTeam2 ?? null,
      slot: 2,
    },
  ];
  const tbdClass = !actualTeam1 && !actualTeam2 ? "tbd" : "";

  let statusHtml = "";
  if (!canCompareParticipants && start_time) {
    const d = new Date(start_time);
    statusHtml = `<div class="text-center small text-muted py-1 border-top bg-light">${d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>`;
  }

  return `
    <div class="bracket-game scoring-game" data-bracket-position="${bracket_position_id}" data-round="${round ?? ""}">
      <div class="matchup card ${tbdClass}">
        <div class="card-body p-0">
          ${displayRows
            .map(({ actualTeam, displayTeam, fallbackTeam, slot }) => {
              const rowTeam = canCompareParticipants
                ? actualTeam ?? null
                : displayTeam ?? fallbackTeam ?? null;
              const wrongPickTeam =
                canCompareParticipants &&
                fallbackTeam &&
                !teamMatchesAny(fallbackTeam, actualParticipants)
                  ? fallbackTeam
                  : null;
              const isProjectedParticipant =
                rowTeam && teamMatchesAny(rowTeam, projectedParticipants);
              let stateClass = "";
              if (isProjectedParticipant) {
                if (canCompareParticipants) stateClass = "pick-correct";
                else stateClass = "pick-pending";
              }
              return scoringTeamRowHtml(
                rowTeam,
                slot,
                pickStatsForGame,
                stateClass,
                Boolean(isProjectedParticipant),
                wrongPickTeam,
              );
            })
            .join("")}
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
  const {
    bracket_position_id,
    team1,
    team2,
    winner_id,
    game_state,
    start_time,
  } = game;
  const tbdClass = !team1 && !team2 ? "tbd" : "";
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

function renderRegionPanel(
  regionName,
  games,
  roundOrder,
  panelClass,
  renderGameFn,
) {
  const roundCols = roundOrder
    .map((r) => {
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
    })
    .join("");

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
  const semifinals = ordered
    .filter((g) => g.round === 6)
    .sort((a, b) => a.bracket_position_id - b.bracket_position_id);
  const semifinalLeft = semifinals[0] ?? null;
  const semifinalRight = semifinals[1] ?? null;
  const championship = ordered.find((g) => g.round === 7) ?? null;
  const championName = championship?.winner?.name_short ?? championship?._pickedChampionName ?? "TBD";

  const col = (game) =>
    game
      ? `<div class="col d-flex"><div class="d-flex flex-column justify-content-around w-100 round-games">${renderGameFn(game)}</div></div>`
      : `<div class="col"></div>`;

  // Build the middle column so the champion card sits directly below the championship game
  const middleCol = championship
    ? `<div class="col d-flex"><div class="d-flex flex-column justify-content-center w-100 round-games">${renderGameFn(championship)}
         <div class="bracket-game champion-card mt-3">
           <div class="matchup card">
             <div class="card-body p-2">
               <div class="text-center small champion-label text-muted">Champion: <span class="fw-bold"><span class="champion-name">${championName}</span></span></div>
             </div>
           </div>
         </div>
       </div></div>`
    : `<div class="col"></div>`;

  return `
    <section class="region-panel card shadow-sm region-panel-final">
      <div class="card-header py-2 text-center fw-semibold">Final Four &amp; Championship</div>
      <div class="card-body p-2">
        <div class="row row-cols-3 g-3 align-items-center final-round-wrap">
          ${col(semifinalLeft)}
          ${middleCol}
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
 * @param {string}      mode                   Ignored; retained for compatibility
 * @param {Map}         picksMap               Map<gameId, pickedTeamId>
 * @param {string}      sport                  "basketball-men" | "basketball-women"
 * @param {Map}         picksMap2              Map<gameId, pickedTeamId2> for combo picks
 * @param {Map}         pickStats              Map<gameId, { total, teamCounts, comboCounts }>
 */
function renderBracket(
  container,
  games,
  mode = "scoring",
  picksMap = new Map(),
  sport = "basketball-men",
  picksMap2 = new Map(),
  pickStats = new Map(),
) {
  const labelMap =
    sport === "basketball-women" ? REGION_CODE_MAP_W : REGION_CODE_MAP;

  function buildProjectedGames(gamesList, picksPrimary, picksSecondary) {
    function assignAdvancedTeam(targetMap, gamesSource, sourceGame, targetPos, team, field1, field2) {
      if (!targetPos || !team) return;
      const feeders = gamesSource
        .filter((x) => x.victor_bracket_position_id === targetPos)
        .map((x) => x.bracket_position_id);
      let slot = 1;
      if (feeders.length === 2) {
        feeders.sort((a, b) => a - b);
        slot = sourceGame.bracket_position_id === feeders[0] ? 1 : 2;
      } else {
        slot = sourceGame.bracket_position_id < targetPos ? 1 : 2;
      }
      const target = targetMap.get(targetPos);
      if (!target) return;
      if (slot === 1) target[field1] = team;
      else target[field2] = team;
    }

    function getProjectedWinnerTeam(game) {
      const primaryId = picksPrimary.get(game.id) ?? null;
      const secondaryId = picksSecondary.get(game.id) ?? null;
      if (!primaryId) return null;

      const resolveTeam = (teamId) =>
        bracketTeamById.get(teamId) ??
        [game.team1, game.team2, game.winner].find(
          (team) => team && team.id === teamId,
        ) ??
        { id: teamId, name_short: "TBD", seed: "", logo_url: null };

      if (secondaryId) {
        const team1 = resolveTeam(primaryId);
        const team2 = resolveTeam(secondaryId);
        if (team1 && team2) return makeComboTeam(team1, team2);
      }

      return resolveTeam(primaryId);
    }

    // Map bracket_position -> cloned game object so we can attach temporary projected slots
    const posToGame = new Map(gamesList.map((g) => [g.bracket_position_id, { ...g }]));

    const maxRound = Math.max(...gamesList.map((g) => g.round || 0));
    for (let round = 1; round <= maxRound; round++) {
      for (const g of gamesList.filter((x) => x.round === round)) {
        const actualWinnerTeam = g.winner_id
          ? bracketTeamById.get(g.winner_id) ??
            g.winner ??
            [g.team1, g.team2].find((team) => team && team.id === g.winner_id) ??
            null
          : null;
        assignAdvancedTeam(
          posToGame,
          gamesList,
          g,
          g.victor_bracket_position_id,
          actualWinnerTeam,
          "_actualTeam1",
          "_actualTeam2",
        );

        const winnerTeam = getProjectedWinnerTeam(g);
        if (!winnerTeam) continue;
        assignAdvancedTeam(
          posToGame,
          gamesList,
          g,
          g.victor_bracket_position_id,
          winnerTeam,
          "_projTeam1",
          "_projTeam2",
        );
      }
    }

    // Build final projected games array where actual teams take precedence.
    // Remove any temporary projection markers as we produce the final list.
    return gamesList.map((g) => {
      const pg = posToGame.get(g.bracket_position_id) ?? { ...g };
      const actualTeam1 =
        normalizeActualAssignedTeam(g.team1 ?? null) ?? pg._actualTeam1 ?? null;
      const actualTeam2 =
        normalizeActualAssignedTeam(g.team2 ?? null) ?? pg._actualTeam2 ?? null;
      const team1 = actualTeam1 ?? pg._projTeam1 ?? null;
      const team2 = actualTeam2 ?? pg._projTeam2 ?? null;
      const projectedTeam1 = pg._projTeam1 ?? null;
      const projectedTeam2 = pg._projTeam2 ?? null;
      delete pg._actualTeam1;
      delete pg._actualTeam2;
      delete pg._projTeam1;
      delete pg._projTeam2;
      return {
        ...g,
        actualTeam1,
        actualTeam2,
        team1,
        team2,
        projectedTeam1,
        projectedTeam2,
      };
    });
  }

  // Build a set of region names that appear for more than one sectionId so we can
  // disambiguate them (e.g. women's 2025 has two "Spokane" pods and two "Birmingham" pods).
  const allRegionCodes = [...LEFT_REGIONS, ...RIGHT_REGIONS];
  const regionNameCount = {};
  const projectedGames = buildProjectedGames(games, picksMap, picksMap2);

  allRegionCodes.forEach((c) => {
    const s = projectedGames.find((g) => g.sectionId === c);
    const name = s?.region
      ? titleCase(s.region)
      : titleCase(labelMap[String(c)] ?? String(c));
    regionNameCount[name] = (regionNameCount[name] ?? 0) + 1;
  });
  const duplicateNames = new Set(
    Object.keys(regionNameCount).filter((n) => regionNameCount[n] > 1),
  );
  // Track how many times each duplicate name has been used so we can number them 1, 2, …
  const duplicateUseCount = {};

  function regionLabel(code) {
    const sample = projectedGames.find((g) => g.sectionId === code);
    const base = sample?.region
      ? titleCase(sample.region)
      : titleCase(labelMap[String(code)] ?? String(code));
    if (duplicateNames.has(base)) {
      duplicateUseCount[base] = (duplicateUseCount[base] ?? 0) + 1;
      return `${base} (${duplicateUseCount[base]})`;
    }
    return base;
  }

  function renderGame(game) {
    const pickStatsForGame = pickStats.get(game.id) ?? null;
    return scoringGameCardHtml(game, pickStatsForGame);
  }

  const championshipGame = projectedGames.find((g) => g.round === 7) ?? null;
  if (championshipGame) {
    const pickedChampionId = picksMap.get(championshipGame.id) ?? null;
    const pickedChampionId2 = picksMap2.get(championshipGame.id) ?? null;
    if (pickedChampionId && pickedChampionId2) {
      const team1 = bracketTeamById.get(pickedChampionId);
      const team2 = bracketTeamById.get(pickedChampionId2);
      if (team1 && team2) {
        championshipGame._pickedChampionName = `${team1.name_short}/${team2.name_short}`;
      }
    } else if (pickedChampionId) {
      championshipGame._pickedChampionName =
        bracketTeamById.get(pickedChampionId)?.name_short ?? "TBD";
    }
  }

  const regionGames = (code) =>
    projectedGames.filter((g) => !isFinalGame(g) && g.sectionId === code);

  const leftPanels = LEFT_REGIONS.map((code) =>
    renderRegionPanel(
      regionLabel(code),
      regionGames(code),
      LEFT_ROUND_ORDER,
      "region-panel-left",
      renderGame,
    ),
  ).join("");
  const rightPanels = RIGHT_REGIONS.map((code) =>
    renderRegionPanel(
      regionLabel(code),
      regionGames(code),
      RIGHT_ROUND_ORDER,
      "region-panel-right",
      renderGame,
    ),
  ).join("");

  const finalGames = projectedGames.filter(isFinalGame);
  const finalPanel = finalGames.length
    ? renderFinalPanel(finalGames, renderGame)
    : `<section class="region-panel card shadow-sm region-panel-final"><div class="card-header py-2 text-center">Final Four</div><div class="card-body"><p class="text-muted">Final Four data not yet available.</p></div></section>`;

  container.innerHTML = `

      <div class="row row-cols-3 align-items-start flex-nowrap gx-3 bracket-board">
        <div class="col bracket-board-col">${leftPanels}</div>
        <div class="col bracket-board-col bracket-board-col-final">${finalPanel}</div>
        <div class="col bracket-board-col">${rightPanels}</div>
      </div>`;
}

/**
 * Update the Champion display inside a rendered bracket board.
 * `container` should be the element that contains the `.bracket-board` markup.
 */
function updateChampionDisplay(container) {
  if (!container) return;
  const champSpan = container.querySelector(
    ".region-panel-final .champion-name",
  );
  if (!champSpan) return;
  const championshipGame =
    container.querySelector(
      '.region-panel-final .bracket-game[data-round="7"]',
    ) || container.querySelector(".region-panel-final .bracket-game");
  if (!championshipGame) {
    return; // nothing to do
  }
  const selected = championshipGame.querySelector("input[type=radio]:checked");
  if (selected) {
    const opt = selected.closest(".team-option");
    const name =
      (opt && opt.dataset && opt.dataset.teamName) ||
      (opt && opt.textContent && opt.textContent.trim()) ||
      "";
    champSpan.textContent = name || "TBD";
    // Toggle label color: success when a champion name exists, muted otherwise
    try {
      const labelEl = champSpan.closest('.champion-label');
      if (labelEl) {
        if (name && name !== 'TBD') {
          labelEl.classList.remove('text-muted');
          labelEl.classList.add('text-light');
        } else {
          labelEl.classList.remove('text-success');
          labelEl.classList.add('text-muted');
        }
          // Also mark the champion card background green when a champion exists
          try {
            const champCardMatch = champSpan.closest('.champion-card')?.querySelector('.matchup') || champSpan.closest('.matchup');
            if (champCardMatch) {
              if (name && name !== 'TBD') {
                champCardMatch.classList.add('bg-success', 'text-white');
              } else {
                champCardMatch.classList.remove('bg-success', 'text-white');
              }
            }
          } catch (e) {/* ignore */}
      }
    } catch (e) {
      /* ignore */
    }
    return;
  }
  // No explicit selection — fallback to any winner dataset on the game element
  const winnerId =
    championshipGame.dataset.winnerId || championshipGame.dataset.winner || "";
  if (winnerId) {
    const optById = championshipGame.querySelector(
      `.team-option[data-team-id="${winnerId}"]`,
    );
    if (optById && optById.dataset.teamName) {
      champSpan.textContent = optById.dataset.teamName;
      try {
        const labelEl = champSpan.closest('.champion-label');
        if (labelEl) {
          labelEl.classList.remove('text-muted');
          labelEl.classList.add('text-success');
        }
        try {
          const champCardMatch = champSpan.closest('.champion-card')?.querySelector('.matchup') || champSpan.closest('.matchup');
          if (champCardMatch) {
            champCardMatch.classList.add('bg-success', 'text-white');
          }
        } catch (e) {/* ignore */}
      } catch (e) {
        /* ignore */
      }
      return;
    }
  }
  // If there's no selected radio and no winner info on the DOM, preserve whatever
  // server-rendered text is already present (do not overwrite with 'TBD').
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function titleCase(s) {
  return String(s).replace(/\b\w/g, (c) => c.toUpperCase());
}

// ────────────────────────────────────────────────────────────────
// ZOOM CONTROLS
// ────────────────────────────────────────────────────────────────

function initZoomControls(scrollEl, zoomSurfaceEl, inBtn, outBtn, resetBtn, initialZoomParam) {
  if (!scrollEl || !zoomSurfaceEl) return;
  const board = zoomSurfaceEl.querySelector(".bracket-board");
  if (!board) return;

  let zoom = 1;
  const STEP = 0.1;
  const MAX = 1.6;
  const baseW = Math.max(board.scrollWidth, 1);

  function fitZoom() {
    return Math.max(0.2, Math.min(1, scrollEl.clientWidth / baseW));
  }

  function applyZoom() {
    const min = fitZoom();
    zoom = Math.max(min, Math.min(MAX, Math.round(zoom * 100) / 100));
    zoomSurfaceEl.style.zoom = `${zoom}`;
    zoomSurfaceEl.style.transform = "none";
    zoomSurfaceEl.style.width = `${baseW}px`;
    if (resetBtn) resetBtn.textContent = `${Math.round(zoom * 100)}%`;
  }

  // Allow an explicit initial zoom via parameter or data attribute on the zoom surface.
  const attrZoom = zoomSurfaceEl?.dataset?.defaultZoom ? parseFloat(zoomSurfaceEl.dataset.defaultZoom) : null;
  const initialZoom = typeof initialZoomParam === "number" && !isNaN(initialZoomParam)
    ? initialZoomParam
    : (attrZoom && !isNaN(attrZoom) ? attrZoom : null);

  function fitToPanel(explicitZoom = null) {
    if (explicitZoom != null && !isNaN(explicitZoom)) {
      zoom = Math.max(0.2, Math.min(MAX, explicitZoom));
    } else {
      zoom = fitZoom();
    }
    applyZoom();
    scrollEl.scrollLeft = 0;
    scrollEl.scrollTop = 0;
  }

  inBtn?.addEventListener("click", () => {
    zoom += STEP;
    applyZoom();
  });
  outBtn?.addEventListener("click", () => {
    zoom -= STEP;
    applyZoom();
  });
  resetBtn?.addEventListener("click", () => fitToPanel());

  scrollEl.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoom += e.deltaY < 0 ? STEP : -STEP;
      applyZoom();
    },
    { passive: false },
  );

  window.addEventListener("resize", () => {
    if (zoom < fitZoom()) zoom = fitZoom();
    applyZoom();
  });

  // If an initial zoom was supplied (param or data attribute), use it; otherwise fit to panel.
  if (initialZoom != null) fitToPanel(initialZoom);
  else fitToPanel();
}

// Exports for testing environments (e.g. Jest)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    inferSectionId,
    makeComboTeam,
    renderBracket,
    initZoomControls,
    titleCase,
    capitalize,
  };
}

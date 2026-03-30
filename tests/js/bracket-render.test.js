const {
  inferSectionId,
  makeComboTeam,
  renderBracket,
  collectPicks,
  validatePicks,
} = require("../../docs/js/bracket-render");

describe("bracket-render.js", () => {
  test("inferSectionId derives section correctly across rounds", () => {
    expect(inferSectionId(101)).toBe(1); // First Four
    expect(inferSectionId(201)).toBe(2); // Round 2, offset 1 => section 2
    expect(inferSectionId(216)).toBe(4); // Round 2, offset 16 => section 4
    expect(inferSectionId(305)).toBe(4); // Round 3, offset 5 => section 4
    // ensure fallbacks are stable and defined
    expect(inferSectionId(0)).toBe(0);
  });

  test("makeComboTeam composes ids and names", () => {
    const t1 = { id: 10, name_short: "A", seed: "1", logo_url: "/a" };
    const t2 = { id: 20, name_short: "B", seed: "2", logo_url: "/b" };
    const combo = makeComboTeam(t1, t2);
    expect(combo).toMatchObject({
      isCombo: true,
      id: "10:20",
      id1: 10,
      id2: 20,
      name_short: "A/B",
    });
  });

  test("renderBracket can render editable bracket and propagate picks", () => {
    // Build a minimal two-game bracket where game1 feeds game2.
    const games = [
      {
        id: 1,
        bracket_position_id: 101,
        victor_bracket_position_id: 201,
        round: 2,
        sectionId: 2,
        team1: { id: 100, name_short: "T1", seed: "1", logo_url: null },
        team2: { id: 101, name_short: "T2", seed: "2", logo_url: null },
      },
      {
        id: 2,
        bracket_position_id: 201,
        victor_bracket_position_id: null,
        round: 3,
        sectionId: 2,
        team1: null,
        team2: null,
      },
    ];

    const container = document.createElement("div");
    renderBracket(container, games, "editable");

    // There should be two games in the rendered DOM.
    const gameEls = container.querySelectorAll(".bracket-game");
    expect(gameEls.length).toBe(2);

    // Select a pick for the first game and trigger change to propagate.
    const firstGameRadio = container.querySelector(
      "[name='pick_1'][value='100']",
    );
    expect(firstGameRadio).not.toBeNull();
    firstGameRadio.checked = true;
    firstGameRadio.dispatchEvent(new Event("change", { bubbles: true }));

    // Verify the second game's first slot got populated with the picked team.
    const secondGameFirstSlot = container.querySelector(
      ".bracket-game[data-game-id='2'] .team-option:nth-child(1)",
    );
    expect(secondGameFirstSlot.textContent).toContain("T1");

    // Validate pick collection returns the selected pick.
    const picks = collectPicks(container);
    expect(picks.get(1).primary).toBe(100);
    expect(picks.get(1).secondary).toBeNull();

    // Validate picks should return 0 invalid games now that the first game is picked.
    const invalid = validatePicks(container);
    expect(invalid).toBe(0);
  });

  test("validatePicks flags missing picks when teams are known", () => {
    const games = [
      {
        id: 3,
        bracket_position_id: 301,
        victor_bracket_position_id: null,
        round: 2,
        sectionId: 2,
        team1: { id: 200, name_short: "X", seed: "1", logo_url: null },
        team2: { id: 201, name_short: "Y", seed: "2", logo_url: null },
      },
    ];
    const container = document.createElement("div");
    renderBracket(container, games, "editable");

    const invalid = validatePicks(container);
    expect(invalid).toBe(1);
    const matchup = container.querySelector(".bracket-game .matchup");
    expect(matchup.classList.contains("error")).toBe(true);
  });

  test("renderBracket in scoring mode shows actual teams; no overlay when projections match", () => {
    // Simple round-2 game: teams are seeded in (no upstream projection). Game completed.
    // No upstream projection → no green coloring, no wrong-pick overlay.
    const games = [
      {
        id: 4,
        bracket_position_id: 401,
        victor_bracket_position_id: null,
        round: 2,
        sectionId: 2,
        team1: { id: 300, name_short: "Alpha", seed: "1", logo_url: null },
        team2: { id: 301, name_short: "Beta", seed: "2", logo_url: null },
        winner_id: 300,
      },
    ];

    const container = document.createElement("div");
    const picksMap = new Map([[4, 300]]);
    renderBracket(container, games, "scoring", picksMap);

    const rows = container.querySelectorAll(".team-option-scoring");
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain("Alpha");
    expect(rows[1].textContent).toContain("Beta");

    // Completed seeded round-2 game: no upstream projection → no green, no wrong-pick overlay.
    const overlays = container.querySelectorAll(".wrong-pick-overlay");
    expect(overlays.length).toBe(0);
    expect(rows[0].classList.contains("pick-correct")).toBe(false);
  });

  test("renderBracket in scoring mode highlights user pick yellow for upcoming seeded games", () => {
    // Upcoming round-2 game (no winner_id, game_state pre). User picked team 300.
    // Alpha slot should be yellow (pick-pending); Beta slot should have no bg class.
    const games = [
      {
        id: 11,
        bracket_position_id: 211,
        victor_bracket_position_id: 306,
        round: 2,
        sectionId: 2,
        game_state: "P",
        team1: { id: 300, name_short: "Alpha", seed: "1", logo_url: null },
        team2: { id: 301, name_short: "Beta", seed: "2", logo_url: null },
        winner_id: null,
      },
    ];

    const container = document.createElement("div");
    const picksMap = new Map([[11, 300]]);
    renderBracket(container, games, "scoring", picksMap);

    const rows = container.querySelectorAll(".team-option-scoring");
    expect(rows.length).toBe(2);
    expect(rows[0].classList.contains("pick-pending")).toBe(true);
    expect(rows[1].classList.contains("pick-pending")).toBe(false);
    expect(rows[1].classList.contains("pick-correct")).toBe(false);
  });

  test("renderBracket does not show yellow when game_state is F even if winner_id is null", () => {
    // Completed game (game_state 'F') but winner_id null (sync gap).
    // Neither slot should be yellow.
    const games = [
      {
        id: 12,
        bracket_position_id: 212,
        victor_bracket_position_id: 306,
        round: 2,
        sectionId: 2,
        game_state: "F",
        team1: { id: 310, name_short: "Gamma", seed: "3", logo_url: null },
        team2: { id: 311, name_short: "Delta", seed: "6", logo_url: null },
        winner_id: null,
      },
    ];

    const container = document.createElement("div");
    const picksMap = new Map([[12, 310]]);
    renderBracket(container, games, "scoring", picksMap);

    const rows = container.querySelectorAll(".team-option-scoring");
    expect(rows.length).toBe(2);
    expect(rows[0].classList.contains("pick-pending")).toBe(false);
    expect(rows[1].classList.contains("pick-pending")).toBe(false);
  });

  test("renderBracket does not show yellow when current_period is FINAL even if winner_id is null", () => {
    // Completed game (current_period 'FINAL') but winner_id null.
    // This happens when the score sync updates period/scores but winner lookup fails.
    const games = [
      {
        id: 13,
        bracket_position_id: 213,
        victor_bracket_position_id: 307,
        round: 2,
        sectionId: 2,
        game_state: "P",
        current_period: "FINAL",
        team1: { id: 320, name_short: "Eta", seed: "7", logo_url: null },
        team2: { id: 321, name_short: "Theta", seed: "10", logo_url: null },
        winner_id: null,
      },
    ];

    const container = document.createElement("div");
    const picksMap = new Map([[13, 320]]);
    renderBracket(container, games, "scoring", picksMap);

    const rows = container.querySelectorAll(".team-option-scoring");
    expect(rows.length).toBe(2);
    expect(rows[0].classList.contains("pick-pending")).toBe(false);
    expect(rows[1].classList.contains("pick-pending")).toBe(false);
  });

  test("renderBracket in scoring mode shows green for correct slot projection", () => {
    // Game 7 is a round-3 game. Game 6 feeds slot 1 of game 7.
    // User correctly picked team 401 to win game 6, who IS the actual slot-1 team of game 7.
    const games = [
      {
        id: 7,
        bracket_position_id: 301,
        victor_bracket_position_id: null,
        round: 3,
        sectionId: 2,
        team1: { id: 401, name_short: "Correct", seed: "3", logo_url: null },
        team2: { id: 402, name_short: "Other", seed: "4", logo_url: null },
        winner_id: null,
      },
      {
        id: 6,
        bracket_position_id: 201,
        victor_bracket_position_id: 301,
        round: 2,
        sectionId: 2,
        team1: { id: 401, name_short: "Correct", seed: "3", logo_url: null },
        team2: { id: 403, name_short: "Eliminated", seed: "6", logo_url: null },
        winner_id: 401,
      },
    ];

    const container = document.createElement("div");
    // User picked 401 to win game 6 (correct), and picks 401 to win game 7.
    const picksMap = new Map([[6, 401], [7, 401]]);
    renderBracket(container, games, "scoring", picksMap);

    // Slot 1 of game 7: expected 401 = actual 401 → green.
    const game7rows = [...container.querySelectorAll(".scoring-game")]
      .find(el => el.dataset.bracketPosition === "301")
      ?.querySelectorAll(".team-option-scoring");
    expect(game7rows).toBeTruthy();
    expect(game7rows[0].classList.contains("pick-correct")).toBe(true);
    expect(game7rows[1].classList.contains("pick-correct")).toBe(false);
  });

  test("renderBracket in scoring mode shows wrong-pick overlay when projected team differs", () => {
    // Game 5 is the actual game with actual teams; Game 6 feeds into game 5.
    // User picks team 400 (from game 6) to advance to game 5 slot 1,
    // but the actual team in slot 1 of game 5 is 401.
    const games = [
      {
        id: 5,
        bracket_position_id: 201,
        victor_bracket_position_id: null,
        round: 3,
        sectionId: 2,
        team1: { id: 401, name_short: "Actual1", seed: "3", logo_url: null },
        team2: { id: 402, name_short: "Actual2", seed: "4", logo_url: null },
        winner_id: null,
      },
      {
        id: 6,
        bracket_position_id: 101,
        victor_bracket_position_id: 201,
        round: 2,
        sectionId: 2,
        team1: { id: 400, name_short: "Projected1", seed: "1", logo_url: null },
        team2: { id: 401, name_short: "Actual1", seed: "3", logo_url: null },
        winner_id: 401,
      },
    ];

    const container = document.createElement("div");
    // User picked team 400 from game 6 to win (project into slot 1 of game 5),
    // but actual slot 1 team is 401.
    const picksMap = new Map([[6, 400]]);
    renderBracket(container, games, "scoring", picksMap);

    // Wrong-pick overlay should appear for slot 1 of game 5 (Projected1 ≠ Actual1).
    const overlays = container.querySelectorAll(".wrong-pick-overlay");
    expect(overlays.length).toBeGreaterThanOrEqual(1);
    expect(overlays[0].textContent).toContain("Projected1");
  });
});

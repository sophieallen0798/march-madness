const { renderBracket } = require("../../docs/js/view-bracket");

describe("view-bracket.js", () => {
  test("shows actual teams plus crossed-out projected participants when matchup differs", () => {
    const games = [
      {
        id: 123,
        bracket_position_id: 301,
        victor_bracket_position_id: null,
        round: 3,
        sectionId: 2,
        team1: { id: 30, name_short: "Team C", seed: "3", logo_url: null },
        team2: { id: 40, name_short: "Team D", seed: "4", logo_url: null },
      },
      {
        id: 121,
        bracket_position_id: 201,
        victor_bracket_position_id: 301,
        round: 2,
        sectionId: 2,
        team1: { id: 10, name_short: "Team A", seed: "1", logo_url: null },
        team2: { id: 30, name_short: "Team C", seed: "3", logo_url: null },
      },
      {
        id: 122,
        bracket_position_id: 202,
        victor_bracket_position_id: 301,
        round: 2,
        sectionId: 2,
        team1: { id: 20, name_short: "Team B", seed: "2", logo_url: null },
        team2: { id: 40, name_short: "Team D", seed: "4", logo_url: null },
      },
    ];

    const container = document.createElement("div");
    const picksMap = new Map([
      [121, 10],
      [122, 20],
    ]);

    renderBracket(container, games, "scoring", picksMap);

    const gameEl = [...container.querySelectorAll(".scoring-game")].find(
      (el) => el.dataset.bracketPosition === "301",
    );
    expect(gameEl).toBeTruthy();

    const actualRows = gameEl.querySelectorAll(".team-option-scoring");
    expect(actualRows).toHaveLength(2);
    expect(actualRows[0].querySelectorAll(".wrong-pick-overlay")).toHaveLength(1);
    expect(actualRows[1].querySelectorAll(".wrong-pick-overlay")).toHaveLength(1);
    expect(actualRows[0].textContent).toContain("Team A");
    expect(actualRows[1].textContent).toContain("Team B");
    expect(actualRows[0].textContent).toContain("Team C");
    expect(actualRows[1].textContent).toContain("Team D");
    expect(actualRows[0].classList.contains("pick-correct")).toBe(false);
    expect(actualRows[1].classList.contains("pick-correct")).toBe(false);
  });

  test("shows projected participants in yellow while matchup is unresolved", () => {
    const games = [
      {
        id: 223,
        bracket_position_id: 401,
        victor_bracket_position_id: null,
        round: 4,
        sectionId: 2,
        team1: null,
        team2: null,
      },
      {
        id: 221,
        bracket_position_id: 301,
        victor_bracket_position_id: 401,
        round: 3,
        sectionId: 2,
        team1: { id: 50, name_short: "Team E", seed: "5", logo_url: null },
        team2: { id: 60, name_short: "Team F", seed: "6", logo_url: null },
      },
      {
        id: 222,
        bracket_position_id: 302,
        victor_bracket_position_id: 401,
        round: 3,
        sectionId: 2,
        team1: { id: 70, name_short: "Team G", seed: "7", logo_url: null },
        team2: { id: 80, name_short: "Team H", seed: "8", logo_url: null },
      },
    ];

    const container = document.createElement("div");
    const picksMap = new Map([
      [221, 50],
      [222, 80],
    ]);

    renderBracket(container, games, "scoring", picksMap);

    const gameEl = [...container.querySelectorAll(".scoring-game")].find(
      (el) => el.dataset.bracketPosition === "401",
    );
    expect(gameEl).toBeTruthy();

    const rows = gameEl.querySelectorAll(".team-option-scoring");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Team E");
    expect(rows[1].textContent).toContain("Team H");
    expect(rows[0].classList.contains("pick-pending")).toBe(true);
    expect(rows[1].classList.contains("pick-pending")).toBe(true);
    expect(gameEl.querySelectorAll(".wrong-pick-overlay")).toHaveLength(0);
  });

  test("marks correctly projected actual participants green when matchup is settled", () => {
    const games = [
      {
        id: 323,
        bracket_position_id: 501,
        victor_bracket_position_id: null,
        round: 4,
        sectionId: 2,
        team1: { id: 90, name_short: "Team I", seed: "2", logo_url: null },
        team2: { id: 100, name_short: "Team J", seed: "1", logo_url: null },
      },
      {
        id: 321,
        bracket_position_id: 401,
        victor_bracket_position_id: 501,
        round: 3,
        sectionId: 2,
        team1: { id: 90, name_short: "Team I", seed: "2", logo_url: null },
        team2: { id: 110, name_short: "Team K", seed: "9", logo_url: null },
      },
      {
        id: 322,
        bracket_position_id: 402,
        victor_bracket_position_id: 501,
        round: 3,
        sectionId: 2,
        team1: { id: 100, name_short: "Team J", seed: "1", logo_url: null },
        team2: { id: 120, name_short: "Team L", seed: "12", logo_url: null },
      },
    ];

    const container = document.createElement("div");
    const picksMap = new Map([
      [321, 90],
      [322, 100],
    ]);

    renderBracket(container, games, "scoring", picksMap);

    const gameEl = [...container.querySelectorAll(".scoring-game")].find(
      (el) => el.dataset.bracketPosition === "501",
    );
    expect(gameEl).toBeTruthy();

    const rows = gameEl.querySelectorAll(".team-option-scoring");
    expect(rows).toHaveLength(2);
    expect(rows[0].classList.contains("pick-correct")).toBe(true);
    expect(rows[1].classList.contains("pick-correct")).toBe(true);
    expect(gameEl.querySelectorAll(".wrong-pick-overlay")).toHaveLength(0);
  });

  test("shows actual participants only once any actual team is known", () => {
    const games = [
      {
        id: 423,
        bracket_position_id: 601,
        victor_bracket_position_id: null,
        round: 6,
        sectionId: 6,
        team1: { id: 130, name_short: "Team M", seed: "2", logo_url: null },
        team2: null,
      },
      {
        id: 421,
        bracket_position_id: 501,
        victor_bracket_position_id: 601,
        round: 5,
        sectionId: 2,
        team1: { id: 130, name_short: "Team M", seed: "2", logo_url: null },
        team2: { id: 140, name_short: "Team N", seed: "5", logo_url: null },
      },
      {
        id: 422,
        bracket_position_id: 502,
        victor_bracket_position_id: 601,
        round: 5,
        sectionId: 3,
        team1: { id: 150, name_short: "Team O", seed: "1", logo_url: null },
        team2: { id: 160, name_short: "Team P", seed: "7", logo_url: null },
      },
    ];

    const container = document.createElement("div");
    const picksMap = new Map([
      [421, 130],
      [422, 150],
    ]);

    renderBracket(container, games, "scoring", picksMap);

    const gameEl = [...container.querySelectorAll(".scoring-game")].find(
      (el) => el.dataset.bracketPosition === "601",
    );
    expect(gameEl).toBeTruthy();

    const rows = gameEl.querySelectorAll(".team-option-scoring");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Team M");
    expect(rows[0].classList.contains("pick-correct")).toBe(true);
    expect(rows[1].querySelectorAll(".wrong-pick-overlay")).toHaveLength(1);
    expect(rows[1].textContent).toContain("Team O");
    expect(rows[1].textContent).toContain("TBD");
    expect(rows[1].classList.contains("pick-pending")).toBe(false);
    expect(gameEl.querySelectorAll(".wrong-pick-overlay")).toHaveLength(1);
  });

  test("treats empty actual teams as unknown regardless of game_state", () => {
    const games = [
      {
        id: 523,
        bracket_position_id: 701,
        victor_bracket_position_id: null,
        round: 7,
        sectionId: 6,
        team1: null,
        team2: null,
        game_state: "F",
      },
      {
        id: 521,
        bracket_position_id: 601,
        victor_bracket_position_id: 701,
        round: 6,
        sectionId: 6,
        team1: { id: 170, name_short: "Team Q", seed: "1", logo_url: null },
        team2: { id: 180, name_short: "Team R", seed: "4", logo_url: null },
      },
      {
        id: 522,
        bracket_position_id: 602,
        victor_bracket_position_id: 701,
        round: 6,
        sectionId: 6,
        team1: { id: 190, name_short: "Team S", seed: "2", logo_url: null },
        team2: { id: 200, name_short: "Team T", seed: "3", logo_url: null },
      },
    ];

    const container = document.createElement("div");
    const picksMap = new Map([
      [521, 170],
      [522, 190],
    ]);

    renderBracket(container, games, "scoring", picksMap);

    const gameEl = [...container.querySelectorAll(".scoring-game")].find(
      (el) => el.dataset.bracketPosition === "701",
    );
    expect(gameEl).toBeTruthy();

    const rows = gameEl.querySelectorAll(".team-option-scoring");
    expect(rows).toHaveLength(2);
    expect(rows[0].classList.contains("pick-pending")).toBe(true);
    expect(rows[1].classList.contains("pick-pending")).toBe(true);
    expect(gameEl.textContent).not.toContain("FINAL");
  });

  test("infers actual assigned teams from completed feeder games", () => {
    const games = [
      {
        id: 623,
        bracket_position_id: 701,
        victor_bracket_position_id: null,
        round: 7,
        sectionId: 6,
        team1: null,
        team2: null,
      },
      {
        id: 621,
        bracket_position_id: 601,
        victor_bracket_position_id: 701,
        round: 6,
        sectionId: 6,
        team1: { id: 210, name_short: "Team U", seed: "1", logo_url: null },
        team2: { id: 220, name_short: "Team V", seed: "4", logo_url: null },
        winner_id: 210,
      },
      {
        id: 622,
        bracket_position_id: 602,
        victor_bracket_position_id: 701,
        round: 6,
        sectionId: 6,
        team1: { id: 230, name_short: "Team W", seed: "2", logo_url: null },
        team2: { id: 240, name_short: "Team X", seed: "3", logo_url: null },
        winner_id: 230,
      },
    ];

    const container = document.createElement("div");
    const picksMap = new Map([
      [621, 210],
      [622, 230],
    ]);

    renderBracket(container, games, "scoring", picksMap);

    const gameEl = [...container.querySelectorAll(".scoring-game")].find(
      (el) => el.dataset.bracketPosition === "701",
    );
    expect(gameEl).toBeTruthy();

    const rows = gameEl.querySelectorAll(".team-option-scoring");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Team U");
    expect(rows[1].textContent).toContain("Team W");
    expect(rows[0].classList.contains("pick-correct")).toBe(true);
    expect(rows[1].classList.contains("pick-correct")).toBe(true);
    expect(rows[0].classList.contains("pick-pending")).toBe(false);
    expect(rows[1].classList.contains("pick-pending")).toBe(false);
  });
});
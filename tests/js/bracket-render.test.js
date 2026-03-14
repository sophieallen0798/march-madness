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

  test("renderBracket in scoring mode marks correct/incorrect picks", () => {
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

    const pickedRow = container.querySelector(
      ".bracket-game .team-option-scoring",
    );
    expect(pickedRow.textContent).toContain("Alpha");
    expect(pickedRow.classList.contains("pick-correct")).toBe(true);
  });
});

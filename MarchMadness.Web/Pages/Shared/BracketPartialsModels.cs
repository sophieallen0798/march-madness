using MarchMadness.Web.Models;

namespace MarchMadness.Web.Pages.Shared;

public class BracketRegionPanelModel
{
    public string RegionName { get; set; } = string.Empty;
    public List<Game> Games { get; set; } = [];
    public int[] RoundOrder { get; set; } = [];
    public string PanelClass { get; set; } = string.Empty;
}

public class BracketFinalPanelModel
{
    public List<Game> Games { get; set; } = [];
}

// Scoring bracket models (read-only view with correctness highlighting)

public class ScoringGameCardModel
{
    public int GameId { get; set; }
    public int BracketPositionId { get; set; }
    public int? VictorBracketPositionId { get; set; }
    public string Region { get; set; } = string.Empty;
    public Team? Team1 { get; set; }
    public Team? Team2 { get; set; }
    public int? PickedTeamId { get; set; }
    public int? ActualWinnerId { get; set; }
    public string GameState { get; set; } = string.Empty;
    public DateTime? StartTime { get; set; }
    public int Round { get; set; }

    /// <summary>
    /// Returns CSS class for the picked team's row: green if correct, red if incorrect, white if pending.
    /// Returns empty string for the non-picked team.
    /// </summary>
    public string GetPickCssClass(int? teamId)
    {
        if (!teamId.HasValue || !PickedTeamId.HasValue || teamId != PickedTeamId)
            return string.Empty;
        if (!ActualWinnerId.HasValue)
            return "pick-pending";
        return PickedTeamId == ActualWinnerId ? "pick-correct" : "pick-incorrect";
    }

    public bool IsPickedTeam(int? teamId) => teamId.HasValue && PickedTeamId.HasValue && teamId == PickedTeamId;
}

public class ScoringRegionPanelModel
{
    public string RegionName { get; set; } = string.Empty;
    public List<ScoringGameCardModel> Games { get; set; } = [];
    public int[] RoundOrder { get; set; } = [];
    public string PanelClass { get; set; } = string.Empty;
}

public class ScoringFinalPanelModel
{
    public List<ScoringGameCardModel> Games { get; set; } = [];
}
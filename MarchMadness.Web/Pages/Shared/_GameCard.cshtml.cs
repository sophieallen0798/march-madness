using MarchMadness.Web.Models;

namespace MarchMadness.Web.Pages.Shared;

public class GameCardModel
{
    public GameCardModel(Game game)
    {
        Id = game.Id;
        BracketPositionId = game.BracketPositionId;
        VictorBracketPositionId = game.VictorBracketPositionId;
        Team1 = game.Team1;
        Team2 = game.Team2;
        Round = game.Round;
    }

    public int Id;
    public int BracketPositionId;
    public int? VictorBracketPositionId;
    public Team? Team1;
    public Team? Team2;
    public int Round;
}
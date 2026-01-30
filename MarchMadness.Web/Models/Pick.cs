namespace MarchMadness.Web.Models
{
    public class Pick
    {
        public int Id { get; set; }
        public int BracketId { get; set; } // Link to specific bracket
        public int GameId { get; set; }
        public int PickedTeamId { get; set; }
        
        public Bracket Bracket { get; set; } = null!;
        public Game Game { get; set; } = null!;
        public Team PickedTeam { get; set; } = null!;
    }
}

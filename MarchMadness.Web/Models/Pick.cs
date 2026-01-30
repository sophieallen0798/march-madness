namespace MarchMadness.Web.Models
{
    public class Pick
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int GameId { get; set; }
        public int PickedTeamId { get; set; }
        
        public User User { get; set; } = null!;
        public Game Game { get; set; } = null!;
        public Team PickedTeam { get; set; } = null!;
    }
}

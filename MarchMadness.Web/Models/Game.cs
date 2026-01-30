namespace MarchMadness.Web.Models
{
    public class Game
    {
        public int Id { get; set; }
        public int Round { get; set; } // 1=Round of 64, 2=Round of 32, 3=Sweet 16, 4=Elite 8, 5=Final Four, 6=Championship
        public int GameNumber { get; set; }
        public string Region { get; set; } = string.Empty;
        public int? Team1Id { get; set; }
        public int? Team2Id { get; set; }
        public int? WinnerId { get; set; }
        
        public Team? Team1 { get; set; }
        public Team? Team2 { get; set; }
        public Team? Winner { get; set; }
    }
}

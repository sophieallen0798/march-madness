namespace MarchMadness.Web.Models
{
    public class Game
    {
        public int Id { get; set; }
        public int ContestId { get; set; } // From API
        public int BracketPositionId { get; set; }
        public int BracketId { get; set; } // From API
        public int? VictorBracketPositionId { get; set; } // Where winner advances to
        public int Round { get; set; } // Parsed from first digit of BracketId
        public string Region { get; set; } = string.Empty;
        public string Sport { get; set; } = string.Empty; // "basketball-men" or "basketball-women"
        public int Year { get; set; } = 2025;
        
        // Team relationships
        public int? Team1Id { get; set; }
        public int? Team2Id { get; set; }
        public int? WinnerId { get; set; }
        
        public Team? Team1 { get; set; }
        public Team? Team2 { get; set; }
        public Team? Winner { get; set; }
        
        // Game info from API
        public string GameState { get; set; } = string.Empty; // "pre", "live", "F"
        public string CurrentPeriod { get; set; } = string.Empty;
        public DateTime? StartTime { get; set; }
        public string Title { get; set; } = string.Empty;
        public int? Team1Score { get; set; }
        public int? Team2Score { get; set; }
    }
}

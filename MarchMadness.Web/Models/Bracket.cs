namespace MarchMadness.Web.Models
{
    public class Bracket
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Sport { get; set; } = string.Empty; // "basketball-men" or "basketball-women"
        public int Year { get; set; } = 2025;
        public string BracketName { get; set; } = string.Empty;
        public DateTime SubmittedDate { get; set; } = DateTime.UtcNow;
        public int TotalPoints { get; set; }
        public User User { get; set; } = null!;
    }
}

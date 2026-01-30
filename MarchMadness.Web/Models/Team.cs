namespace MarchMadness.Web.Models
{
    public class Team
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string SeoName { get; set; } = string.Empty;
        public string NameFull { get; set; } = string.Empty;
        public string NameShort { get; set; } = string.Empty;
        public int Seed { get; set; }
        public string LogoUrl { get; set; } = string.Empty;
        public string Region { get; set; } = string.Empty;
        public string Sport { get; set; } = string.Empty; // "basketball-men" or "basketball-women"
        public int Year { get; set; } = 2025;
    }
}

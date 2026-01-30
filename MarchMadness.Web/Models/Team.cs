namespace MarchMadness.Web.Models
{
    public class Team
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Seed { get; set; }
        public string Region { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
    }
}

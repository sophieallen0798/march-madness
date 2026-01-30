namespace MarchMadness.Web.Models
{
    public class User
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? WindowsUsername { get; set; }
        public DateTime CreatedDate { get; set; } = DateTime.Now;
    }
}

using System.Text.Json.Serialization;

namespace MarchMadness.Web.Models.Api
{
    public class ScoreboardApiResponse
    {
        [JsonPropertyName("updated_at")]
        public string UpdatedAt { get; set; } = string.Empty;

        [JsonPropertyName("games")]
        public List<ScoreboardGame> Games { get; set; } = new();
    }

    public class ScoreboardGame
    {
        [JsonPropertyName("game")]
        public GameDetail Game { get; set; } = new();
    }

    public class GameDetail
    {
        [JsonPropertyName("gameID")]
        public string GameId { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("gameState")]
        public string GameState { get; set; } = string.Empty;

        [JsonPropertyName("startDate")]
        public string StartDate { get; set; } = string.Empty;

        [JsonPropertyName("startTime")]
        public string StartTime { get; set; } = string.Empty;

        [JsonPropertyName("currentPeriod")]
        public string CurrentPeriod { get; set; } = string.Empty;

        [JsonPropertyName("away")]
        public ScoreboardTeam? Away { get; set; }

        [JsonPropertyName("home")]
        public ScoreboardTeam? Home { get; set; }
    }

    public class ScoreboardTeam
    {
        [JsonPropertyName("names")]
        public TeamNames Names { get; set; } = new();

        [JsonPropertyName("score")]
        public string Score { get; set; } = string.Empty;

        [JsonPropertyName("seed")]
        public string Seed { get; set; } = string.Empty;
    }

    public class TeamNames
    {
        [JsonPropertyName("short")]
        public string Short { get; set; } = string.Empty;

        [JsonPropertyName("full")]
        public string Full { get; set; } = string.Empty;

        [JsonPropertyName("seo")]
        public string Seo { get; set; } = string.Empty;
    }
}

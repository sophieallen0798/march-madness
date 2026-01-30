using System.Text.Json.Serialization;

namespace MarchMadness.Web.Models.Api
{
    public class StandingsApiResponse
    {
        [JsonPropertyName("sport")]
        public string Sport { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("updated")]
        public string Updated { get; set; } = string.Empty;

        [JsonPropertyName("data")]
        public List<ConferenceStanding> Data { get; set; } = new();
    }

    public class ConferenceStanding
    {
        [JsonPropertyName("conference")]
        public string Conference { get; set; } = string.Empty;

        [JsonPropertyName("standings")]
        public List<TeamStanding> Standings { get; set; } = new();
    }

    public class TeamStanding
    {
        [JsonPropertyName("SCHOOL")]
        public string School { get; set; } = string.Empty;

        [JsonPropertyName("CONFERENCE")]
        public string Conference { get; set; } = string.Empty;

        [JsonPropertyName("OVERALL")]
        public string Overall { get; set; } = string.Empty;
    }
}

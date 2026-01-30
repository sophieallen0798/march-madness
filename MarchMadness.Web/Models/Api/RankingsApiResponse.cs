using System.Text.Json.Serialization;

namespace MarchMadness.Web.Models.Api
{
    public class RankingsApiResponse
    {
        [JsonPropertyName("sport")]
        public string Sport { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("updated")]
        public string Updated { get; set; } = string.Empty;

        [JsonPropertyName("data")]
        public List<RankingData> Data { get; set; } = new();
    }

    public class RankingData
    {
        [JsonPropertyName("RANK")]
        public string Rank { get; set; } = string.Empty;

        [JsonPropertyName("SCHOOL")]
        public string School { get; set; } = string.Empty;

        [JsonPropertyName("RECORD (1ST VOTES)")]
        public string Record { get; set; } = string.Empty;

        [JsonPropertyName("POINTS")]
        public string Points { get; set; } = string.Empty;

        [JsonPropertyName("PREVIOUS")]
        public string Previous { get; set; } = string.Empty;
    }
}
